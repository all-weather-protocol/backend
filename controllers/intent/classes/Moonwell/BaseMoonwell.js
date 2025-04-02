import { readFileSync } from 'fs';
const MErc20Delegate = JSON.parse(readFileSync('./utils/ABI/Moonwell/MErc20Delegate.json', 'utf8'));
const MultiRewardDistributor = JSON.parse(readFileSync('./utils/ABI/Moonwell/MultiRewardDistributor.json', 'utf8'));
const Comptroller = JSON.parse(readFileSync('./utils/ABI/Moonwell/Comptroller.json', 'utf8'));
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";
axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class BaseMoonwell extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "moonwell";
    this.protocolVersion = "0";
    this.assetDecimals = customParams.assetDecimals;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.assetAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: MErc20Delegate,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: MErc20Delegate,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: customParams.protocolAddress,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: MErc20Delegate,
    });
    this.assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      MErc20Delegate,
      PROVIDER(this.chain),
    );
    this.protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      MErc20Delegate,
      PROVIDER(this.chain),
    );
    this.stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      MErc20Delegate,
      PROVIDER(this.chain),
    );

    this.symbolOfBestTokenToZapInOut = customParams.symbolOfBestTokenToZapInOut;
    this.zapInOutTokenAddress = customParams.zapInOutTokenAddress;
    this.decimalsOfZapInOutToken = customParams.decimalsOfZapInOutToken;
    this._checkIfParamsAreSet();
  }
  rewards() {
    return [
      {
        symbol: "well",
        priceId: {
          coinmarketcapApiId: 20734,
        },
        address: "0xA88594D404727625A9437C3f886C7643872296AE",
        decimals: 18,
        chain: "base",
      },
    ];
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    let rewardBalance = {};

    const comptroller = (
      await this.protocolContractInstance.functions.comptroller()
    )[0];
    const comptrollerInstance = new ethers.Contract(
      comptroller,
      Comptroller,
      PROVIDER(this.chain),
    );
    const rewardDistributor = (
      await comptrollerInstance.functions.rewardDistributor()
    )[0];
    const rewardDistributorContractInstance = new ethers.Contract(
      rewardDistributor,
      MultiRewardDistributor,
      PROVIDER(this.chain),
    );
    const rewardDistributorBalance =
      await rewardDistributorContractInstance.functions.getOutstandingRewardsForUser(
        this.assetContract.address,
        owner,
      );
    const moolWellReward = rewardDistributorBalance[0][0];
    rewardBalance[moolWellReward.emissionToken] = {
      symbol: "well",
      balance: moolWellReward.totalAmount,
      usdDenominatedValue:
        (tokenPricesMappingTable["well"] * moolWellReward.totalAmount) /
        Math.pow(10, 18),
      decimals: 18,
    };
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
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-deposit`,
      0,
    );
    const approveTxn = approve(
      bestTokenAddressToZapIn,
      this.protocolContract.address,
      amountToZapIn,
      updateProgress,
      this.chainId,
    );
    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "mint",
      params: [amountToZapIn],
    });
    await this._stake(amountToZapIn, updateProgress);
    return [approveTxn, depositTxn];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    const pendingRewards = await this.pendingRewards(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const comptroller = (
      await this.protocolContractInstance.functions.comptroller()
    )[0];
    const comptrollerInstance = getContract({
      client: THIRDWEB_CLIENT,
      address: comptroller,
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Comptroller,
    });

    const claimTxn = prepareContractCall({
      contract: comptrollerInstance,
      method: "claimReward",
      params: [[owner], [this.assetContract.address], true, true],
    });
    return [[claimTxn], pendingRewards];
  }

  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const [userBalance, latestPendleAssetPrice] = await Promise.all([
      this.assetBalanceOf(owner),
      this.assetUsdPrice(tokenPricesMappingTable),
    ]);
    return (
      (userBalance / Math.pow(10, this.assetDecimals)) * latestPendleAssetPrice
    );
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return (
      (await this.exchangeRateOfAssetToRedeem()) *
      tokenPricesMappingTable[this.symbolOfBestTokenToZapInOut]
    );
  }

  async stakeBalanceOf(owner) {
    return ethers.BigNumber.from(0);
  }
  async exchangeRateOfAssetToRedeem() {
    const exchangeRate = (
      await this.assetContractInstance.functions.exchangeRateStored()
    )[0];
    const result =
      ((exchangeRate / 1e18) * Math.pow(10, this.assetDecimals)) /
      Math.pow(10, this.decimalsOfZapInOutToken);
    return result;
  }

  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    return [
      this.symbolOfBestTokenToZapInOut,
      this.zapInOutTokenAddress,
      this.decimalsOfZapInOutToken,
    ];
  }
  _getTheBestTokenAddressToZapOut() {
    return [
      this.symbolOfBestTokenToZapInOut,
      this.zapInOutTokenAddress,
      this.decimalsOfZapInOutToken,
    ];
  }
  async lockUpPeriod() {
    return 0;
  }
  async _stake(amount, updateProgress) {
    await super._stake(amount, updateProgress);
    return [];
  }
  async _unstake(owner, percentage, updateProgress) {
    await super._unstake(owner, percentage, updateProgress);
    // Convert percentage (0-1) to precise BigNumber with 18 decimals
    const percentagePrecision = 18;
    const percentageStr = percentage
      .toFixed(percentagePrecision)
      .replace(".", "");
    const percentageBN = ethers.BigNumber.from(percentageStr);
    const assetAmount = await this.assetBalanceOf(owner);
    const withdrawAmount = assetAmount
      .mul(percentageBN)
      .div(ethers.BigNumber.from("10").pow(percentagePrecision));
    return [[], withdrawAmount];
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
    const [
      symbolOfBestTokenToZapInOut,
      bestTokenAddressToZapInOut,
      decimalsOfZapInOutToken,
    ] = this._getTheBestTokenAddressToZapOut();
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "redeem",
      params: [amount],
    });
    const [claimTxns, _] = await this.customClaim(
      owner,
      tokenPricesMappingTable,
      updateProgress,
    );
    const redeemAmountCeil = await this._calculateRedeemAmount(amount);
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-withdraw`,
      0,
    );
    return [
      [burnTxn, ...claimTxns],
      symbolOfBestTokenToZapInOut,
      bestTokenAddressToZapInOut,
      decimalsOfZapInOutToken,
      redeemAmountCeil,
    ];
  }
  async _calculateRedeemAmount(amount) {
    const exchangeRate = await this.exchangeRateOfAssetToRedeem();
    const scaledExchangeRate = ethers.BigNumber.from(
      Math.floor(exchangeRate * Math.pow(10, this.assetDecimals)).toString(),
    );

    // Calculate redeem amount
    const redeemAmount = ethers.BigNumber.from(amount)
      .mul(scaledExchangeRate)
      .div(ethers.BigNumber.from(10).pow(this.assetDecimals));

    // Return final redeem amount adjusted for decimals
    return redeemAmount
      .mul(ethers.BigNumber.from(10).pow(this.decimalsOfZapInOutToken))
      .div(ethers.BigNumber.from(10).pow(this.assetDecimals));
  }
}