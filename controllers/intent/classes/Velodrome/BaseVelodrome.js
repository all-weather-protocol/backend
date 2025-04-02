import { readFileSync } from "fs";
const Router = JSON.parse(
  readFileSync("./utils/ABI/Aerodrome/Router.json", "utf8"),
);
const Guage = JSON.parse(
  readFileSync("./utils/ABI/Aerodrome/Guage.json", "utf8"),
);
const Pool = JSON.parse(
  readFileSync("./utils/ABI/Aerodrome/Pool.json", "utf8"),
);
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb.js";
import BaseProtocol from "../BaseProtocol.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../../../utils/general.js";
const ERC20_ABI = JSON.parse(readFileSync("./utils/ABI/ERC20.json", "utf8"));

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseVelodrome extends BaseProtocol {
  constructor(chain, chainId, symbolList, mode, customParams) {
    super(chain, chainId, symbolList, mode, customParams);
    this.initializeProtocolDetails();
    this.initializeContracts();
    this._checkIfParamsAreSet();
  }

  // Protocol initialization methods
  initializeProtocolDetails() {
    this.protocolName = this.customParams.protocolName;
    this.protocolVersion = this.customParams.protocolVersion;
    this.assetDecimals = this.customParams.assetDecimals;
  }

  initializeContracts() {
    // Initialize Thirdweb contracts
    this.assetContract = this.createThirdwebContract(
      this.customParams.assetAddress,
      Pool,
    );
    this.protocolContract = this.createThirdwebContract(
      this.customParams.routerAddress,
      Router,
    );
    this.stakeFarmContract = this.createThirdwebContract(
      this.customParams.guageAddress,
      Guage,
    );

    // Initialize Ethers contracts
    this.assetContractInstance = this.createEthersContract(
      this.assetContract.address,
      Pool,
    );
    this.protocolContractInstance = this.createEthersContract(
      this.protocolContract.address,
      Router,
    );
    this.stakeFarmContractInstance = this.createEthersContract(
      this.stakeFarmContract.address,
      Guage,
    );
  }

  createThirdwebContract(address, abi) {
    return getContract({
      client: THIRDWEB_CLIENT,
      address: address,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: abi,
    });
  }

  createEthersContract(address, abi) {
    return new ethers.Contract(address, abi, PROVIDER(this.chain));
  }

  // Reward related methods
  rewards() {
    return this.customParams.rewards;
  }

  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    const stakeFarmContractInstance = this.createEthersContract(
      this.stakeFarmContract.address,
      Guage,
    );
    let rewardBalance = {};

    for (const reward of this.rewards()) {
      const rewardAmount = (
        await stakeFarmContractInstance.functions.earned(owner)
      )[0];
      rewardBalance[reward.address] = {
        symbol: reward.symbol,
        balance: rewardAmount,
        usdDenominatedValue:
          (tokenPricesMappingTable[reward.symbol] * rewardAmount) /
          Math.pow(10, reward.decimals),
        decimals: reward.decimals,
      };
    }
    return rewardBalance;
  }

  // LP Token related methods
  async stakeBalanceOf(owner) {
    const stakeFarmContractInstance = this.createEthersContract(
      this.stakeFarmContract.address,
      ERC20_ABI,
    );
    return (await stakeFarmContractInstance.functions.balanceOf(owner))[0];
  }

  async _calculateMintLP(tokenAmetadata, tokenBmetadata) {
    const [metadata, totalSupply] = await Promise.all([
      this.assetContractInstance.functions.metadata(),
      this.assetContractInstance.functions.totalSupply(),
    ]);

    const [reserve0, reserve1] = [metadata.r0, metadata.r1];
    const _totalSupply = totalSupply[0];

    if (reserve0.isZero() || reserve1.isZero()) {
      throw new Error("Pool has no liquidity");
    }

    return ethers.BigNumber.from(
      Math.min(
        tokenAmetadata.minAmount.mul(_totalSupply).div(reserve0),
        tokenBmetadata.minAmount.mul(_totalSupply).div(reserve1),
      ),
    );
  }

  async _calculateWithdrawalAmounts(lpAmount, slippage, lpTokens) {
    const [metadata, totalSupply] = await Promise.all([
      this.assetContractInstance.functions.metadata(),
      this.assetContractInstance.functions.totalSupply(),
    ]);

    const [token0Reserve, token1Reserve] = [metadata.r0, metadata.r1];
    const [token0Decimals, token1Decimals] = [lpTokens[0][2], lpTokens[1][2]];

    const share = lpAmount
      .mul(ethers.constants.WeiPerEther)
      .div(totalSupply[0]);

    const amount0 = token0Reserve.mul(share).div(ethers.constants.WeiPerEther);
    const amount1 = token1Reserve.mul(share).div(ethers.constants.WeiPerEther);

    const estimatedNormalizedAmount0 = Number(
      ethers.utils.formatUnits(amount0, token0Decimals),
    );
    const estimatedNormalizedAmount1 = Number(
      ethers.utils.formatUnits(amount1, token1Decimals),
    );

    const minAmount0 = this.mul_with_slippage_in_bignumber_format(
      amount0,
      slippage,
    );
    const minAmount1 = this.mul_with_slippage_in_bignumber_format(
      amount1,
      slippage,
    );

    return {
      estimatedNormalizedAmount0,
      estimatedNormalizedAmount1,
      minAmount0,
      minAmount1,
    };
  }

  // Price and value calculation methods
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [lpBalance, lpPrice] = await Promise.all([
      this.stakeBalanceOf(owner),
      this._calculateLpPrice(tokenPricesMappingTable),
    ]);
    return lpBalance * lpPrice;
  }

  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._calculateLpPrice(tokenPricesMappingTable);
  }

  async _calculateLpPrice(tokenPricesMappingTable) {
    const [lpMetadata, totalSupply] = await Promise.all([
      this.assetContractInstance.functions.metadata(),
      this.assetContractInstance.functions.totalSupply(),
    ]);

    const [token0Reserve, token1Reserve] = [lpMetadata.r0, lpMetadata.r1];
    const [token0Decimals, token1Decimals] = [
      this.customParams.lpTokens[0][2],
      this.customParams.lpTokens[1][2],
    ];

    const normalizedReserve0 = Number(
      ethers.utils.formatUnits(token0Reserve, token0Decimals),
    );
    const normalizedReserve1 = Number(
      ethers.utils.formatUnits(token1Reserve, token1Decimals),
    );

    const totalPoolValue =
      normalizedReserve0 *
        tokenPricesMappingTable[this.customParams.lpTokens[0][0]] +
      normalizedReserve1 *
        tokenPricesMappingTable[this.customParams.lpTokens[1][0]];

    return totalPoolValue / totalSupply[0];
  }

  // Transaction methods
  async customDepositLP(
    owner,
    tokenAmetadata,
    tokenBmetadata,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    const tokens = [tokenAmetadata, tokenBmetadata].map(
      ([symbol, address, decimals, amount]) => ({
        address,
        amount,
        minAmount: this.mul_with_slippage_in_bignumber_format(amount, slippage),
        decimals,
        symbol,
      }),
    );

    const min_mint_amount = await this._calculateMintLP(tokens[0], tokens[1]);
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      0,
    );

    const approveTxns = tokens.map((token) =>
      approve(
        token.address,
        this.protocolContract.address,
        token.amount,
        updateProgress,
        this.chainId,
      ),
    );

    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "addLiquidity",
      params: [
        tokens[0].address,
        tokens[1].address,
        true,
        tokens[0].amount,
        tokens[1].amount,
        tokens[0].minAmount,
        tokens[1].minAmount,
        owner,
        this.getDeadline(),
      ],
    });

    const stakeTxns = await this._stakeLP(min_mint_amount, updateProgress);
    return [...approveTxns, depositTxn, ...stakeTxns];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const claimTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "getReward",
      params: [owner],
    });
    return [[claimTxn], pendingRewards];
  }

  async _stakeLP(amount, updateProgress) {
    await super._stakeLP(amount, updateProgress);
    const approveForStakingTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      amount,
      updateProgress,
      this.chainId,
    );
    const stakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "function deposit(uint256 _amount)",
      params: [amount],
    });
    return [approveForStakingTxn, stakeTxn];
  }

  async _unstakeLP(owner, percentage, updateProgress) {
    await super._unstakeLP(owner, percentage, updateProgress);
    const percentageBN = ethers.BigNumber.from(
      BigInt(Math.floor(percentage * 10000)),
    );
    const stakeBalance = await this.stakeBalanceOf(owner, updateProgress);
    const amount = stakeBalance.mul(percentageBN).div(10000);

    const unstakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "withdraw",
      params: [amount],
    });
    return [[unstakeTxn], amount];
  }

  async _withdrawLPAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await super._withdrawLPAndClaim(
      owner,
      amount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );

    const approveTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      amount,
      updateProgress,
      this.chainId,
    );

    const { minAmount0, minAmount1 } = await this._calculateWithdrawalAmounts(
      amount,
      slippage,
      this.customParams.lpTokens,
    );

    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      0,
    );

    const withdrawTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "removeLiquidity",
      params: [
        this.customParams.lpTokens[0][1],
        this.customParams.lpTokens[1][1],
        true,
        amount,
        minAmount0,
        minAmount1,
        owner,
        this.getDeadline(),
      ],
    });

    const [claimTxns, _] = await this.customClaim(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );

    return [
      [approveTxn, withdrawTxn, ...claimTxns],
      this.customParams.lpTokens,
      [minAmount0, minAmount1],
    ];
  }

  async lockUpPeriod() {
    return 0;
  }
  async _calculateTokenAmountsForLP(
    usdAmount,
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    const metadata = await this.assetContractInstance.functions.metadata();
    const [r0, r1] = [metadata.r0, metadata.r1];
    const [dec0, dec1] = [metadata.dec0, metadata.dec1];
    return [r0.div(dec0), r1.div(dec1)];
  }
}
