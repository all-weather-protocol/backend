import { readFileSync } from "fs";
const Vault = JSON.parse(readFileSync("./utils/ABI/Aura/Vault.json", "utf8"));
const BoosterLite = JSON.parse(
  readFileSync("./utils/ABI/Aura/BoosterLite.json", "utf8"),
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
const BaseRewardPool4626 = JSON.parse(
  readFileSync("./utils/ABI/Aura/BaseRewardPool4626.json", "utf8"),
);
import {
  AddLiquidityKind,
  AddLiquidity,
  BalancerApi,
  Slippage,
  RemoveLiquidityKind,
  RemoveLiquidity,
} from "@balancer/sdk";
import { prepareTransaction } from "thirdweb";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseAura extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "aura";
    this.protocolVersion = "0";
    this.assetDecimals = this.customParams.assetDecimals;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ERC20_ABI,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x98Ef32edd24e2c92525E59afc4475C1242a30184",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: BoosterLite,
    });
    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    this.protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Vault,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      BoosterLite,
      PROVIDER(this.chain),
    );
    this._checkIfParamsAreSet();
  }
  rewards() {
    return this.customParams.rewards;
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    let rewardBalance = {};
    const poolInfo = await this.stakeFarmContractInstance.functions.poolInfo(
      this.customParams.pid,
    );
    const rewardPool = poolInfo.crvRewards;
    const rewardPoolInstance = new ethers.Contract(
      rewardPool,
      BaseRewardPool4626,
      PROVIDER(this.chain),
    );
    const rewardTokenBalance = (
      await rewardPoolInstance.functions.earned(owner)
    )[0];
    if (this.customParams.originalRewards.length > 0) {
      rewardBalance[this.customParams.originalRewards[0].address] = {
        symbol: this.customParams.originalRewards[0].symbol,
        balance: rewardTokenBalance,
        usdDenominatedValue:
          (tokenPricesMappingTable[
            this.customParams.originalRewards[0].symbol
          ] *
            rewardTokenBalance) /
          Math.pow(10, this.customParams.originalRewards[0].decimals),
        decimals: this.customParams.originalRewards[0].decimals,
      };
    }
    const rewards = this.rewards();
    for (const reward of rewards) {
      const stashAddress = reward.stashAddress;
      const stashInstance = new ethers.Contract(
        stashAddress,
        BaseRewardPool4626,
        PROVIDER(this.chain),
      );
      const rewardTokenBalance = (
        await stashInstance.functions.earned(owner)
      )[0];
      rewardBalance[reward.address] = {
        symbol: reward.symbol,
        balance: rewardTokenBalance,
        usdDenominatedValue:
          (tokenPricesMappingTable[reward.symbol] * rewardTokenBalance) /
          Math.pow(10, reward.decimals),
        decimals: reward.decimals,
      };
    }
    return rewardBalance;
  }
  async customDepositLP(
    owner,
    tokenAmetadata,
    tokenBmetadata,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    // Prepare token amounts and approvals
    const tokens = [tokenAmetadata, tokenBmetadata].map(
      ([symbol, address, decimals, amount]) => ({
        address,
        amount,
        decimals,
        symbol,
      }),
    );
    const { callData, minBptOut: min_mint_amount } =
      await this._calculateMintLP({
        rpcUrl: PROVIDER(this.chain).rpcUrl,
        chainId: this.chainId,
        poolId: this.customParams.poolId,
        referenceAmount: {
          address: tokens[0].address,
          rawAmount: BigInt(tokens[0].amount),
          decimals: tokens[0].decimals,
        },
        slippage: Slippage.fromPercentage(slippage),
        sender: owner,
        recipient: owner,
      });
    const tradingLoss = 0;
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      tradingLoss,
    );
    // Generate approve transactions
    const approveTxns = tokens.map((token) => {
      return approve(
        token.address,
        this.protocolContract.address,
        // NOTE: approvve an extra 10% is dedicated for balancer API. Since we're using it's calldata directly. And that calldata is generated by proposal
        token.amount.mul(11).div(10),
        updateProgress,
        this.chainId,
      );
    });
    const depositTxn = prepareTransaction({
      to: this.protocolContract.address,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      client: THIRDWEB_CLIENT,
      data: callData,
      extraGas: 600000n,
    });
    // Get staking transactions and combine all transactions
    const stakeTxns = await this._stakeLP(min_mint_amount, updateProgress);
    return [...approveTxns, depositTxn, ...stakeTxns];
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const poolInfo = await this.stakeFarmContractInstance.functions.poolInfo(
      this.customParams.pid,
    );
    const rewardPool = poolInfo.crvRewards;
    const rewardPoolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: rewardPool,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: BaseRewardPool4626,
    });
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const claimTxn = prepareContractCall({
      contract: rewardPoolContract,
      method: "function getReward()",
      params: [],
    });
    return [[claimTxn], pendingRewards];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [lpPrice, lpBalance] = await Promise.all([
      this._calculateLpPrice(tokenPricesMappingTable),
      this.stakeBalanceOf(owner, () => {}),
    ]);
    return lpBalance * lpPrice;
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    const assetUsdPrice = await this._calculateLpPrice(tokenPricesMappingTable);
    return assetUsdPrice;
  }
  async stakeBalanceOf(owner) {
    const rewardPool = (
      await this.stakeFarmContractInstance.functions.poolInfo(
        this.customParams.pid,
      )
    ).crvRewards;
    const rewardPoolInstance = new ethers.Contract(
      rewardPool,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    return (await rewardPoolInstance.functions.balanceOf(owner))[0];
  }
  async _calculateTokenAmountsForLP(
    usdAmount,
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    const { maxAmountsIn } = await this._calculateMintLP({
      rpcUrl: PROVIDER(this.chain).rpcUrl,
      chainId: this.chainId,
      poolId: this.customParams.poolId,
      referenceAmount: {
        address: tokenMetadatas[0][1],
        rawAmount: BigInt(100 * Math.pow(10, tokenMetadatas[0][2])),
        decimals: tokenMetadatas[0][2],
      },
      slippage: Slippage.fromPercentage("0"),
      sender: "0xB1d1A96285b09203663533090118BB9f75ABF92C", // just a placeholder
      recipient: "0xB1d1A96285b09203663533090118BB9f75ABF92C", // just a placeholder
    });
    if (maxAmountsIn.length !== 2) {
      const zeroAmountIndex = maxAmountsIn.findIndex(
        (amount) => amount.amount === 0n,
      );
      if (zeroAmountIndex !== -1) {
        maxAmountsIn.splice(zeroAmountIndex, 1);
      }
    }
    const [r0, r1] = [maxAmountsIn[0].amount, maxAmountsIn[1].amount];
    const [dec0, dec1] = [
      maxAmountsIn[0].decimalScale,
      maxAmountsIn[1].decimalScale,
    ];
    return [ethers.BigNumber.from(r0 / dec0), ethers.BigNumber.from(r1 / dec1)];
  }
  async _calculateLpPrice(tokenPricesMappingTable) {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/pool/arbitrum/aura/0/wausdcn-gho/apr`;
    try {
      const response = await axios.get(url);
      return response.data.price / 10 ** this.assetDecimals;
    } catch (error) {
      console.error("Error fetching LP price:", error);
      return 0;
    }
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
      method: "deposit",
      params: [this.customParams.pid, amount, true],
    });
    return [approveForStakingTxn, stakeTxn];
  }
  async _unstakeLP(owner, percentage, updateProgress) {
    await super._unstakeLP(owner, percentage, updateProgress);
    const percentageBN = ethers.BigNumber.from(
      BigInt(Math.floor(percentage * 10000)),
    );
    const poolInfo = await this.stakeFarmContractInstance.functions.poolInfo(
      this.customParams.pid,
    );
    const rewardPool = poolInfo.crvRewards;
    const rewardPoolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: rewardPool,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: BaseRewardPool4626,
    });
    const stakeBalance = await this.stakeBalanceOf(owner, updateProgress);
    const amount = stakeBalance.mul(percentageBN).div(10000);
    const unstakeTxn = prepareContractCall({
      contract: rewardPoolContract,
      method: "withdrawAndUnwrap",
      params: [amount, true],
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
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      0,
    );
    const call = await this.removeLiquidity({
      rpcUrl: PROVIDER(this.chain).rpcUrl,
      chainId: this.chainId,
      owner,
      poolId: this.customParams.poolId,
      slippage: Slippage.fromPercentage(slippage),
      amount,
    });
    const withdrawTxn = prepareTransaction({
      to: call.to,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      client: THIRDWEB_CLIENT,
      data: call.callData,
      extraGas: 500000n,
    });
    return [
      [withdrawTxn],
      this.customParams.lpTokens,
      [
        ethers.BigNumber.from(call.minAmountsOut[0].amount),
        ethers.BigNumber.from(call.minAmountsOut[1].amount),
      ],
    ];
  }
  s;

  _calculateMinWithdrawAmount(
    lpAmount,
    ratio,
    decimals,
    slippage,
    avgDecimals,
  ) {
    // Convert lpAmount from BigNumber to number, accounting for LP token decimals (18)
    const normalizedLpAmount =
      Number(ethers.utils.formatUnits(lpAmount, avgDecimals)) * 2;
    // Calculate expected withdrawal amount
    const expectedAmount = normalizedLpAmount * ratio;
    // Convert back to BigNumber with proper decimals
    const withdrawAmount = ethers.utils.parseUnits(
      expectedAmount.toFixed(decimals).toString(),
      decimals,
    );
    // Apply slippage and return
    return [
      expectedAmount,
      this.mul_with_slippage_in_bignumber_format(withdrawAmount, slippage),
    ];
  }

  async lockUpPeriod() {
    return 0;
  }
  async _calculateMintLP({
    rpcUrl,
    chainId,
    poolId,
    referenceAmount,
    slippage,
    sender,
    recipient,
  }) {
    // API + on-chain calls are used to fetch relevant pool data
    const balancerApi = new BalancerApi("https://api-v3.balancer.fi/", chainId);
    const poolState = await balancerApi.pools.fetchPoolState(poolId);

    // Construct the AddLiquidityInput, in this case an AddLiquidityUnbalanced
    const addLiquidityInput = {
      referenceAmount,
      chainId,
      rpcUrl,
      kind: AddLiquidityKind.Proportional,
    };

    // Simulate addLiquidity to get the amount of BPT out
    const addLiquidity = new AddLiquidity();
    const queryOutput = await addLiquidity.query(addLiquidityInput, poolState);
    // Apply slippage to the BPT amount received from the query and construct the call
    const call = addLiquidity.buildCall({
      ...queryOutput,
      sender,
      recipient,
      slippage,
      chainId,
      wethIsEth: false,
    });
    call.minBptOut = ethers.BigNumber.from(call.minBptOut.amount);
    return call;
  }
  async removeLiquidity({ rpcUrl, chainId, poolId, slippage, amount, owner }) {
    // API can be used to fetch relevant pool data
    const balancerApi = new BalancerApi("https://api-v3.balancer.fi/", chainId);
    const poolState = await balancerApi.pools.fetchPoolState(poolId);

    // Construct the RemoveLiquidityInput, in this case a RemoveLiquiditySingleTokenExactIn
    const bptIn = {
      rawAmount: BigInt(amount),
      decimals: 18,
      address: poolState.address,
    };

    // Construct the RemoveLiquidityInput, in this case an RemoveLiquidityProportional
    const removeLiquidityInput = {
      chainId,
      rpcUrl,
      bptIn,
      kind: RemoveLiquidityKind.Proportional,
    };

    // Query removeLiquidity to get the token out amounts
    const removeLiquidity = new RemoveLiquidity();
    const queryOutput = await removeLiquidity.query(
      removeLiquidityInput,
      poolState,
    );

    // Applies slippage to the tokens out amounts and constructs the call
    const call = removeLiquidity.buildCall({
      ...queryOutput,
      slippage,
      chainId,
      sender: owner,
      recipient: owner,
    });
    if (call.minAmountsOut.length !== 2) {
      const zeroAmountIndex = call.minAmountsOut.findIndex(
        (amount) => amount.amount === 0n,
      );
      if (zeroAmountIndex !== -1) {
        call.minAmountsOut.splice(zeroAmountIndex, 1);
      }
    }
    return {
      ...call,
      protocolVersion: queryOutput.protocolVersion,
    };
  }
}
