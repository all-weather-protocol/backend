import { readFileSync } from 'fs';
const PendleMarketV3 = JSON.parse(readFileSync('./utils/ABI/Pendle/PendleMarketV3.json', 'utf8'));
const ActionAddRemoveLiqV3 = JSON.parse(readFileSync('./utils/ABI/Pendle/ActionAddRemoveLiqV3.json', 'utf8'));
const PendleBoosterSidechain = JSON.parse(readFileSync('./utils/ABI/Pendle/PendleBoosterSidechain.json', 'utf8'));
const EqbMinterSidechain = JSON.parse(readFileSync('./utils/ABI/Pendle/EqbMinterSidechain.json', 'utf8'));
const BaseRewardPool = JSON.parse(readFileSync('./utils/ABI/Pendle/BaseRewardPool.json', 'utf8'));
const XEqbToken = JSON.parse(readFileSync('./utils/ABI/Equilibria/XEqbToken.json', 'utf8'));
const EqbZap = JSON.parse(readFileSync('./utils/ABI/Equilibria/EqbZap.json', 'utf8'));
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";  
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseEquilibria extends BaseProtocol {
  static equilibriaFarmAddressMap = {
    8453: "0x2583A2538272f31e9A15dD12A432B8C96Ab4821d",
    42161: "0x4D32C8Ff2fACC771eC7Efc70d6A8468bC30C26bF",
  };
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    // arbitrum's Apollox is staked on PancakeSwap
    this.protocolName = "equilibria";
    this.protocolVersion = "0";
    this.assetDecimals = 18;
    this.pidOfEquilibria = customParams.pidOfEquilibria;
    this.PENDLE_TOKEN_ADDR_MAP = {
      8453: "0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e",
      42161: "0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8",
    };
    this.EQB_TOKEN_ADDR = "0xbfbcfe8873fe28dfa25f1099282b088d52bbad9c";
    this.XEQB_TOKEN_ADDR = "0x96c4a48abdf781e9c931cfa92ec0167ba219ad8e";
    this.OARB_TOKEN_ADDR = "0x03b611858f8e8913f8db7d9fdbf59e352b0c83e8";
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: PendleMarketV3,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x888888888889758F76e7103c6CbF23ABbF58F946",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ActionAddRemoveLiqV3,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: BaseEquilibria.equilibriaFarmAddressMap[String(this.chainId)],
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: PendleBoosterSidechain,
    });
    this.eqbStakeFarmWithdrawContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xc7517f481Cc0a645e63f870830A4B2e580421e32",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: EqbZap,
    });
    this.xEqbContract = getContract({
      client: THIRDWEB_CLIENT,
      address: this.XEQB_TOKEN_ADDR,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: XEqbToken,
    });

    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      PendleMarketV3,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      PendleBoosterSidechain,
      PROVIDER(this.chain),
    );

    this.symbolOfBestTokenToZapOut = customParams.symbolOfBestTokenToZapOut;
    this.bestTokenAddressToZapOut = customParams.bestTokenAddressToZapOut;
    this.decimalOfBestTokenToZapOut = customParams.decimalOfBestTokenToZapOut;
    this._checkIfParamsAreSet();
  }
  rewards() {
    if (this.chainId === 8453) {
      return [
        {
          symbol: "pendle",
          priceId: {
            coinmarketcapApiId: 9481,
          },
          address: "0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e",
          decimals: 18,
        },
      ];
    } else if (this.chainId === 42161) {
      return [
        {
          symbol: "arb",
          priceId: {
            coinmarketcapApiId: 11841,
          },
          address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
          decimals: 18,
        },
        {
          symbol: "oarb",
          priceId: {
            coinmarketcapApiId: 11841,
          },
          address: "0x03b611858f8E8913F8DB7d9fDBF59e352b0c83E8",
          decimals: 18,
        },
        {
          symbol: "pendle",
          priceId: {
            coinmarketcapApiId: 9481,
          },
          address: "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8",
          decimals: 18,
        },
        {
          symbol: "eqb",
          priceId: {
            coinmarketcapApiId: 26556,
          },
          address: "0xbfbcfe8873fe28dfa25f1099282b088d52bbad9c",
          decimals: 18,
        },
        {
          symbol: "xeqb",
          priceId: {
            coinmarketcapApiId: 26556,
          },
          address: "0x96C4A48Abdf781e9c931cfA92EC0167Ba219ad8E",
          decimals: 18,
        },
      ];
    }
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    let rewardBalance = {};
    const rewardPool = (
      await this.stakeFarmContractInstance.functions.poolInfo(
        this.pidOfEquilibria,
      )
    ).rewardPool;
    const rewardPoolContractInstance = new ethers.Contract(
      rewardPool,
      BaseRewardPool,
      PROVIDER(this.chain),
    );
    const rewards = (
      await rewardPoolContractInstance.functions.getRewardTokens()
    )[0];
    let pendleAmount;
    for (const reward of rewards) {
      const earnedReward = (
        await rewardPoolContractInstance.functions.earned(owner, reward)
      )[0];
      const metadata = this._getRewardMetadata(reward);
      if (!metadata) {
        // reward not found
        continue;
      }
      rewardBalance[reward] = {
        symbol: metadata.symbol,
        balance: earnedReward,
        usdDenominatedValue:
          (tokenPricesMappingTable[metadata.symbol] * earnedReward) /
          Math.pow(10, metadata.decimals),
        decimals: metadata.decimals,
        vesting: this._checkIfVesting(reward),
      };
      if (
        reward.toLowerCase() ==
        this.PENDLE_TOKEN_ADDR_MAP[String(this.chainId)].toLowerCase()
      ) {
        pendleAmount = earnedReward;
      }
    }
    const eqbMinterAddr = (
      await this.stakeFarmContractInstance.functions.eqbMinter()
    )[0];
    const eqbMinterInstance = new ethers.Contract(
      eqbMinterAddr,
      EqbMinterSidechain,
      PROVIDER(this.chain),
    );
    const eqbFactor = (await eqbMinterInstance.functions.getFactor())[0];
    const eqbDENOMINATOR = (await eqbMinterInstance.functions.DENOMINATOR())[0];
    const farmEqbShare = (
      await this.stakeFarmContractInstance.functions.farmEqbShare()
    )[0];
    const PENDLE_BOOSTER_DENOMINATOR = (
      await this.stakeFarmContractInstance.functions.DENOMINATOR()
    )[0];
    const sumOfEqbAndXeqb = pendleAmount.mul(eqbFactor).div(eqbDENOMINATOR);
    const eqbAmount = sumOfEqbAndXeqb
      .mul(farmEqbShare)
      .div(PENDLE_BOOSTER_DENOMINATOR);
    const eqbMetadata = this._getRewardMetadata(this.EQB_TOKEN_ADDR);
    if (eqbMetadata) {
      rewardBalance[this.EQB_TOKEN_ADDR] = {
        symbol: eqbMetadata.symbol,
        balance: eqbAmount,
        usdDenominatedValue:
          (tokenPricesMappingTable["eqb"] * eqbAmount) /
          Math.pow(10, eqbMetadata.decimals),
        decimals: eqbMetadata.decimals,
      };
    }

    const xeqbAmount = sumOfEqbAndXeqb.sub(eqbAmount);
    const xeqbMetadata = this._getRewardMetadata(this.XEQB_TOKEN_ADDR);
    if (xeqbMetadata) {
      rewardBalance[this.XEQB_TOKEN_ADDR] = {
        symbol: xeqbMetadata.symbol,
        balance: xeqbAmount,
        usdDenominatedValue:
          (tokenPricesMappingTable["eqb"] * xeqbAmount) /
          Math.pow(10, xeqbMetadata.decimals),
        decimals: xeqbMetadata.decimals,
        vesting: true,
      };
    }
    // TODO: arbitrum incentive
    return rewardBalance;
  }
  async customDeposit(
    owner,
    inputToken,
    bestTokenAddressToZapIn,
    amountToZapIn,
    bestTokenToZapInDecimal,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    const approveForZapInTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      updateProgress,
      this.chainId,
    );
    const resp = await axios.get(
      `https://api-v2.pendle.finance/core/v1/sdk/${this.chainId}/markets/${this.assetContract.address}/add-liquidity`,
      {
        params: {
          receiver: owner,
          // slippage from the website is 0.5 (means 0.5%), so we need to divide it by 100 and pass it to Pendle (0.005 = 0.5%)
          slippage: slippage / 100,
          enableAggregator: true,
          tokenIn: bestTokenAddressToZapIn,
          amountIn: amountToZapIn,
          zpi: false,
        },
      },
    );
    const precision = Math.pow(10, 6);
    const slippageBN = ethers.BigNumber.from(
      BigInt(Math.floor((100 - slippage) * precision)),
    ).div(100);
    const minLPOutAmount = ethers.BigNumber.from(resp.data.data.amountLpOut)
      .mul(slippageBN)
      .div(ethers.BigNumber.from(precision));
    const mintTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "addLiquiditySingleToken",
      params: resp.data.contractCallParams,
    });
    const latestPendleAssetPrice = await this._fetchPendleAssetPrice(() => {});
    const tradingLoss =
      Number(
        ethers.utils.formatUnits(
          resp.data.data.amountLpOut,
          this.assetDecimals,
        ),
      ) *
        latestPendleAssetPrice *
        Math.pow(10, this.assetDecimals) -
      Number(ethers.utils.formatUnits(amountToZapIn, bestTokenToZapInDecimal)) *
        tokenPricesMappingTable[inputToken];
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      tradingLoss,
    );
    const stakeTxns = await this._stake(minLPOutAmount, updateProgress);
    return [approveForZapInTxn, mintTxn, ...stakeTxns];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const claimTxn = prepareContractCall({
      contract: this.eqbStakeFarmWithdrawContract,
      method: "claimRewards",
      params: [[this.pidOfEquilibria]],
    });
    const redeemTxns = await this.customRedeemVestingRewards(
      pendingRewards,
      owner,
    );
    return [[claimTxn, ...redeemTxns], pendingRewards];
  }

  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [userBalance, latestPendleAssetPrice] = await Promise.all([
      this.stakeBalanceOf(owner),
      this._fetchPendleAssetPrice(() => {}),
    ]);
    return userBalance * latestPendleAssetPrice;
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._fetchPendleAssetPrice(() => {});
  }

  async stakeBalanceOf(owner) {
    const rewardPool = (
      await this.stakeFarmContractInstance.functions.poolInfo(
        this.pidOfEquilibria,
      )
    ).rewardPool;
    const eqbPendleLPInstance = new ethers.Contract(
      rewardPool,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    return (await eqbPendleLPInstance.functions.balanceOf(owner))[0];
  }

  async _fetchPendleAssetPrice(updateProgress) {
    const resp = await axios.get(
      `https://api-v2.pendle.finance/core/v1/${this.chainId}/prices/assets/addresses`,
      {
        params: {
          addresses: this.assetContract.address,
        },
      },
    );
    return resp.data.pricesUsd[0] / Math.pow(10, this.assetDecimals);
  }
  _getTheBestTokenAddressToZapIn(inputToken, tokenInAddress, tokenDecimals) {
    return [inputToken, tokenInAddress, tokenDecimals];
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    return [
      this.symbolOfBestTokenToZapOut,
      this.bestTokenAddressToZapOut,
      this.decimalOfBestTokenToZapOut,
    ];
  }
  _getRewardMetadata(address) {
    for (const rewardMetadata of this.rewards()) {
      if (rewardMetadata.address.toLowerCase() === address.toLowerCase()) {
        return rewardMetadata;
      }
    }
  }
  _checkIfVesting(reward) {
    return [
      this.OARB_TOKEN_ADDR.toLowerCase(),
      this.XEQB_TOKEN_ADDR.toLowerCase(),
    ].includes(reward.toLowerCase());
  }
  async customRedeemVestingRewards(pendingRewards, owner) {
    if (
      pendingRewards[this.XEQB_TOKEN_ADDR] === undefined ||
      pendingRewards[this.XEQB_TOKEN_ADDR].balance.toString() === "0"
    ) {
      return [];
    }
    const maxRedeemDuration = 14515200;
    const redeemTxn = prepareContractCall({
      contract: this.xEqbContract,
      method: "redeem",
      params: [pendingRewards[this.XEQB_TOKEN_ADDR].balance, maxRedeemDuration],
    });
    return [redeemTxn];
  }
  async lockUpPeriod() {
    return 0;
  }
  async _stake(amount, updateProgress) {
    await super._stake(amount, updateProgress);
    const approveTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      amount,
      updateProgress,
      this.chainId,
    );

    const stakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "deposit",
      params: [this.pidOfEquilibria, amount, true],
    });
    return [approveTxn, stakeTxn];
  }
  async _unstake(owner, percentage, updateProgress) {
    await super._unstake(owner, percentage, updateProgress);
    // Convert percentage (0-1) to precise BigNumber with 18 decimals
    const percentageStr = percentage.toFixed(18).replace(".", "");
    const percentageBN = ethers.BigNumber.from(percentageStr);
    const stakedAmount = await this.stakeBalanceOf(owner);
    const withdrawAmount = stakedAmount
      .mul(percentageBN)
      .div(ethers.BigNumber.from("10").pow(18));
    const approveEqbLPTxn = approve(
      (
        await this.stakeFarmContractInstance.functions.poolInfo(
          this.pidOfEquilibria,
        )
      ).token,
      this.eqbStakeFarmWithdrawContract.address,
      withdrawAmount,
      updateProgress,
      this.chainId,
    );

    const withdrawTxn = prepareContractCall({
      contract: this.eqbStakeFarmWithdrawContract,
      method: "withdraw",
      params: [this.pidOfEquilibria, withdrawAmount],
    });
    return [[approveEqbLPTxn, withdrawTxn], withdrawAmount];
  }
  async _withdrawAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await super._withdrawAndClaim(
      owner,
      amount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    const approvePendleTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      amount,
      updateProgress,
      this.chainId,
    );
    const [
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
    ] = this._getTheBestTokenAddressToZapOut();
    const zapOutResp = await axios.get(
      `https://api-v2.pendle.finance/core/v1/sdk/${this.chainId}/markets/${this.assetContract.address}/remove-liquidity`,
      {
        params: {
          receiver: owner,
          // slippage from the website is 0.5 (means 0.5%), so we need to divide it by 100 and pass it to Pendle (0.005 = 0.5%)
          slippage: slippage / 100,
          enableAggregator: true,
          tokenOut: bestTokenAddressToZapOut,
          amountIn: amount,
        },
      },
    );
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "removeLiquiditySingleToken",
      params: zapOutResp.data.contractCallParams,
    });
    const latestPendleAssetPrice = await this._fetchPendleAssetPrice(() => {});
    const tradingLoss =
      Number(
        ethers.utils.formatUnits(
          zapOutResp.data.data.amountOut,
          decimalOfBestTokenToZapOut,
        ),
      ) *
        tokenPricesMappingTable[symbolOfBestTokenToZapOut] -
      Number(ethers.utils.formatUnits(amount, this.assetDecimals)) *
        latestPendleAssetPrice *
        Math.pow(10, this.assetDecimals);
    this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      tradingLoss,
    );
    return [
      [approvePendleTxn, burnTxn],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      zapOutResp.data.contractCallParams[3].minTokenOut,
    ];
  }
}
