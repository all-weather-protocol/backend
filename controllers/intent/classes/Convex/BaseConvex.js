import { readFileSync } from 'fs';
const CurveStableSwapNG = JSON.parse(readFileSync('./utils/ABI/Curve/CurveStableSwapNG.json', 'utf8'));
const Booster = JSON.parse(readFileSync('./utils/ABI/Convex/Booster.json', 'utf8'));
const ConvexRewardPool = JSON.parse(readFileSync('./utils/ABI/Convex/ConvexRewardPool.json', 'utf8'));
import { CHAIN_ID_TO_CHAIN } from "../../../../utils/general.js";

import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb.js";
import BaseProtocol from "../BaseProtocol.js";
import { approve } from "../../../../utils/general.js";
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));
axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseConvex extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "convex";
    this.protocolVersion = "0";
    this.pid = this.customParams.pid;
    this.assetDecimals = this.customParams.assetDecimals;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: CurveStableSwapNG,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: CurveStableSwapNG,
    });
    // stakeFarmContract is null not used in this protocol
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Booster,
    });
    this.convexRewardPoolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.convexRewardPool,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ConvexRewardPool,
    });

    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      CurveStableSwapNG,
      PROVIDER(this.chain),
    );
    this._checkIfParamsAreSet();
  }
  rewards() {
    return this.customParams.rewards;
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    let rewardBalance = {};
    const stakeFarmContractInstance = new ethers.Contract(
      this.convexRewardPoolContract.address,
      ConvexRewardPool,
      PROVIDER(this.chain),
    );
    const rewards = this.rewards();
    for (const reward of rewards) {
      const reward_address = reward.address;
      const reward_balance = (
        await stakeFarmContractInstance.functions.claimable_reward(
          reward_address,
          owner,
        )
      )[0];
      rewardBalance[reward_address] = {
        symbol: reward.symbol,
        balance: reward_balance,
        usdDenominatedValue:
          (tokenPricesMappingTable[reward.symbol] * reward_balance) /
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
    const tokenPairs = [tokenAmetadata, tokenBmetadata];
    const { approveTxns, amounts, totalNormalizedAmount } =
      await this._prepareTokenApprovals(tokenPairs, updateProgress);

    const { minMintAmount, tradingLoss } = this._calculateMinimumMintAmount(
      totalNormalizedAmount,
      amounts,
      tokenAmetadata,
      tokenBmetadata,
      tokenPricesMappingTable,
      slippage,
    );

    const depositTxn = this._createDepositTransaction(amounts, minMintAmount);

    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      tradingLoss,
    );

    const stakeTxns = await this._stakeLP(amounts, updateProgress);

    return [...approveTxns, depositTxn, ...stakeTxns];
  }

  async _prepareTokenApprovals(tokenPairs, updateProgress) {
    const approveTxns = [];
    const amounts = [];
    let totalNormalizedAmount = 0;

    for (const [symbol, address, decimals, amount] of tokenPairs) {
      const approveTxn = await this.approve(
        address,
        this.protocolContract.address,
        amount,
        updateProgress,
        this.chainId,
      );

      approveTxns.push(approveTxn);
      amounts.push(amount);

      const normalizedAmount = Number(
        ethers.utils.formatUnits(amount.toString(), decimals),
      );
      totalNormalizedAmount += normalizedAmount;
    }

    return { approveTxns, amounts, totalNormalizedAmount };
  }

  _calculateMinimumMintAmount(
    totalNormalizedAmount,
    amounts,
    tokenAmetadata,
    tokenBmetadata,
    tokenPricesMappingTable,
    slippage,
  ) {
    const lpPrice = this._calculateLpPrice(tokenPricesMappingTable);
    const outputPrice =
      totalNormalizedAmount * lpPrice * Math.pow(10, this.assetDecimals);

    // TODO(david): the asset price is not correct here, so we just reduce 0.03% swap fee to estimate the trading loss
    const tradingLoss = 0;

    const minMintAmount = ethers.BigNumber.from(
      BigInt(Math.floor((outputPrice * (100 - slippage)) / 100)),
      this.assetDecimals,
    );

    return { minMintAmount, tradingLoss };
  }

  _createDepositTransaction(amounts, minMintAmount) {
    return prepareContractCall({
      contract: this.protocolContract,
      method: "add_liquidity",
      params: [amounts, minMintAmount],
    });
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const claimTxn = prepareContractCall({
      contract: this.convexRewardPoolContract,
      method: "function getReward(address _account)",
      params: [owner],
    });
    return [[claimTxn], pendingRewards];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const lpBalance = await this.stakeBalanceOf(owner, () => {});
    const lpPrice = this._calculateLpPrice(tokenPricesMappingTable);
    return lpBalance * lpPrice;
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._calculateLpPrice(tokenPricesMappingTable);
  }
  async stakeBalanceOf(owner, updateProgress) {
    const rewardPoolContractInstance = new ethers.Contract(
      this.convexRewardPoolContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    return (await rewardPoolContractInstance.functions.balanceOf(owner))[0];
  }
  async _calculateTokenAmountsForLP(
    usdAmount,
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    const [reserve0, reserve1] = (
      await this.assetContractInstance.functions.get_balances()
    )[0];
    const [decimals0, decimals1] = [tokenMetadatas[0][2], tokenMetadatas[1][2]];
    const normalizedReserve0 = Number(
      ethers.utils.formatUnits(reserve0.toString(), decimals0),
    ).toFixed(18);
    const normalizedReserve1 = Number(
      ethers.utils.formatUnits(reserve1.toString(), decimals1),
    ).toFixed(18);
    return [
      ethers.utils.parseUnits(normalizedReserve0, 18),
      ethers.utils.parseUnits(normalizedReserve1, 18),
    ];
  }
  _calculateLpPrice(tokenPricesMappingTable) {
    // TODO(david): need to calculate the correct LP price
    if (this.pid === 34 || this.pid === 36) {
      // it's a stablecoin pool
      return 1 / Math.pow(10, this.assetDecimals);
    } else if (this.pid === 28) {
      // it's a ETH pool
      return tokenPricesMappingTable["weth"] / Math.pow(10, this.assetDecimals);
    }
    throw new Error("Not implemented");
  }
  async _stakeLP(amount, updateProgress) {
    await super._stakeLP(amount, updateProgress);
    const approveForStakingTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      // TODO(David): not sure why _min_mint_amount cannot be used here
      // here's the failed txn: https://dashboard.tenderly.co/davidtnfsh/project/tx/arbitrum/0x822f5f426de88d1890f8836e825f52a70d22f5bcd8665125a83755eb947a4d88?trace=0.4.0.0.0.0.18.1
      ethers.constants.MaxUint256,
      updateProgress,
      this.chainId,
    );
    const stakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "depositAll",
      params: [this.pid],
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
      contract: this.convexRewardPoolContract,
      method: "withdraw",
      params: [amount, false],
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

    const curvePoolInstance = new ethers.Contract(
      this.protocolContract.address,
      CurveStableSwapNG,
      PROVIDER(this.chain),
    );

    // Get current balances and total supply from Curve pool
    const [token_a_balance, token_b_balance] =
      await curvePoolInstance.get_balances();
    const totalSupply = await curvePoolInstance.totalSupply();

    // Scale up by WeiPerEther before division to maintain precision
    const share = amount.mul(ethers.constants.WeiPerEther).div(totalSupply);
    const expectedAmountA = token_a_balance
      .mul(share)
      .div(ethers.constants.WeiPerEther);
    const expectedAmountB = token_b_balance
      .mul(share)
      .div(ethers.constants.WeiPerEther);
    // Apply slippage to minimum amounts
    const minimumWithdrawAmount_a = this.mul_with_slippage_in_bignumber_format(
      expectedAmountA,
      slippage,
    );
    const minimumWithdrawAmount_b = this.mul_with_slippage_in_bignumber_format(
      expectedAmountB,
      slippage,
    );

    const minPairAmounts = [minimumWithdrawAmount_a, minimumWithdrawAmount_b];
    const withdrawTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "remove_liquidity",
      params: [amount, minPairAmounts],
    });

    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      0,
    );

    const [claimTxns, _] = await this.customClaim(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );

    return [
      [withdrawTxn, ...claimTxns],
      this.customParams.lpTokens,
      minPairAmounts,
    ];
  }
  async lockUpPeriod() {
    return 0;
  }
}
