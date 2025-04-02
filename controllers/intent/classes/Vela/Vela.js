import { readFileSync } from 'fs';
const Vault = JSON.parse(readFileSync('./utils/ABI/Vela/Vault.json', 'utf8'));
const TokenFarm = JSON.parse(readFileSync('./utils/ABI/Vela/TokenFarm.json', 'utf8'));
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../../../utils/general.js";
import BaseProtocol from "../BaseProtocol.js";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class Vela extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super(chain, chaindId, symbolList, mode, customParams);
    // arbitrum's Apollox is staked on PancakeSwap
    this.protocolName = "vela";
    this.protocolVersion = "0";
    this.assetDecimals = 18;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xC5b2D9FDa8A82E8DcECD5e9e6e99b78a9188eB05",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: ERC20_ABI,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xC4ABADE3a15064F9E3596943c699032748b13352",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x60b8C145235A31f1949a831803768bF37d7Ab7AA",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: TokenFarm,
    });
    this._checkIfParamsAreSet();
  }
  rewards() {
    return [];
  }
  async pendingRewards(owner, tokenPricesMappingTable, updateProgress) {
    return {};
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

    const latestPrice = await this._fetchVlpPrice(updateProgress);
    // on Arbitrum, we don't stake and then put VLP to pancakeswap for higher APY
    const estimatedVlpAmount =
      ((tokenPricesMappingTable[inputToken] * amountToZapIn) /
        Math.pow(10, bestTokenToZapInDecimal) /
        latestPrice) *
      Math.pow(10, this.assetDecimals);
    const mintTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "stake",
      params: [owner, bestTokenAddressToZapIn, amountToZapIn],
    });
    const minVlpAmount = Math.floor(
      (estimatedVlpAmount * (100 - slippage)) / 100,
    );
    const stakeTxns = await this._stake(minVlpAmount, updateProgress);
    return [approveForZapInTxn, mintTxn, ...stakeTxns];
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    return [[], {}];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      TokenFarm,
      PROVIDER(this.chain),
    );
    const userBalance = (
      await stakeFarmContractInstance.functions.getStakedAmount(
        this.assetContract.address,
        owner,
      )
    )[0];
    const latestVlpPrice = await this._fetchVlpPrice(() => {});
    return userBalance * latestVlpPrice;
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    return await this._fetchVlpPrice(() => {});
  }
  async _fetchVlpPrice(updateProgress) {
    const protocolContractInstance = new ethers.Contract(
      this.protocolContract.address,
      Vault,
      PROVIDER(this.chain),
    );
    const vlpPrice =
      (await protocolContractInstance.functions.getVLPPrice()) / 1e5;
    return vlpPrice / Math.pow(10, this.assetDecimals);
  }
  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    return ["usdc", usdcAddress, 6];
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    return ["usdc", usdcAddress, 6];
  }
  async _stake(amount, updateProgress) {
    await super._stake(amount, updateProgress);
    const approveAlpTxn = approve(
      this.assetContract.address,
      this.stakeFarmContract.address,
      amount,
      updateProgress,
      this.chainId,
    );
    const stakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "stake", // <- this gets inferred from the contract
      params: [this.assetContract.address, amount],
    });
    return [approveAlpTxn, stakeTxn];
  }
  async _unstake(owner, percentage, updateProgress) {
    await super._unstake(owner, percentage, updateProgress);
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      TokenFarm,
      PROVIDER(this.chain),
    );

    // Assuming 'percentage' is a float between 0 and 1
    const percentageBN = ethers.BigNumber.from(
      BigInt(Math.floor(percentage * 10000)),
    );
    const stakedAmount = (
      await stakeFarmContractInstance.functions.getStakedAmount(
        this.assetContract.address,
        owner,
      )
    )[0];
    const vlpAmount = stakedAmount.mul(percentageBN).div(10000);

    const withdrawTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "unstake",
      params: [this.assetContract.address, vlpAmount],
    });
    return [[withdrawTxn], vlpAmount];
  }
  async _withdrawAndClaim(
    owner,
    vlpAmount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await super._withdrawAndClaim(
      owner,
      vlpAmount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    const [
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
    ] = this._getTheBestTokenAddressToZapOut();
    const latestPrice = await this._fetchVlpPrice(updateProgress);
    const minOutAmount = Math.floor(
      ((((vlpAmount / Math.pow(10, this.assetDecimals)) * latestPrice) /
        tokenPricesMappingTable[symbolOfBestTokenToZapOut]) *
        (100 - slippage)) /
        100,
    );
    const approveVlpTxn = approve(
      this.assetContract.address,
      this.protocolContract.address,
      vlpAmount,
      updateProgress,
      this.chainId,
    );
    const burnTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "unstake",
      params: [bestTokenAddressToZapOut, vlpAmount],
    });
    return [
      [approveVlpTxn, burnTxn],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      minOutAmount,
    ];
  }
  async lockUpPeriod(address) {
    try {
      const stakeFarmContractInstance = new ethers.Contract(
        this.stakeFarmContract.address,
        TokenFarm,
        PROVIDER(this.chain),
      );
      const userStakedInfo =
        await stakeFarmContractInstance.functions.userStakedInfo(
          address,
          this.assetContract.address,
        );
      const cooldownDuration =
        await stakeFarmContractInstance.cooldownDuration();
      const amount = userStakedInfo.amount;
      const startTimestamp = userStakedInfo.startTimestamp;
      // if user has staked, we can calculate the lock-up period
      if (!amount.isZero()) {
        const startTimestampValue = startTimestamp.toNumber();
        const cooldownDurationValue = cooldownDuration.toNumber();
        const currentTimestamp = Math.floor(Date.now() / 1000);
        let lockUpPeriod = 0;
        const elapsedTime = currentTimestamp - startTimestampValue;

        // if elapsedTime
        if (elapsedTime > cooldownDurationValue) {
          lockUpPeriod = 0;
        } else {
          lockUpPeriod = cooldownDurationValue - elapsedTime;
        }

        return lockUpPeriod; // return the lock-up period in seconds
      } else {
        return 0;
      }
    } catch (error) {
      console.error("Error fetching lock-up period:", error);
      return 0;
    }
  }
}
