import Vault from "../../lib/contracts/Interport/Vault.json" ;
import StablecoinFarm from "../../lib/contracts/Interport/StablecoinFarm.json" ;
import axios from "axios";
import { ethers } from "ethers";
import { PROVIDER } from "../../utils/general.js";
import axiosRetry from "axios-retry";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../../utils/thirdweb";
import BaseProtocol from "../BaseProtocol.js";
import { approve, CHAIN_ID_TO_CHAIN } from "../../utils/general";

axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
export class InterportArbitrumUsdc extends BaseProtocol {
  constructor(chain, chaindId, symbolList, mode, customParams) {
    throw new Error(
      "tx.origin !== msg.sender, so interport cannot be integrated until Pectra upgrade!",
    );
    super(chain, chaindId, symbolList, mode, customParams);
    this.protocolName = "interport";
    this.protocolVersion = "0";
    this.assetDecimals = 6;
    this.pid = 2;
    this.assetContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xb6ab8eefae1a2c22ca6338e143cb7de544800c6e",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    this.protocolContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0xb6ab8eefae1a2c22ca6338e143cb7de544800c6e",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: Vault,
    });
    // stakeFarmContract is null not used in this protocol
    this.stakeFarmContract = getContract({
      client: THIRDWEB_CLIENT,
      address: "0x29d44c17f4f83b3c77ae2eac4bc1468a496e3196",
      chain: CHAIN_ID_TO_CHAIN[this.chainId],
      abi: StablecoinFarm,
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
    const depositTxn = prepareContractCall({
      contract: this.protocolContract,
      method: "deposit",
      params: [amountToZapIn],
    });
    // const stakeTxn = prepareContractCall({
    //   contract: this.stakeFarmContract,
    //   method: "stake",
    //   params: [this.pid, amountToZapIn],
    // });
    // return [approveForZapInTxn, depositTxn, stakeTxn];
    return [approveForZapInTxn, depositTxn];
  }
  async customWithdrawAndClaim(
    owner,
    percentage,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const stakeFarmContractInstance = new ethers.Contract(
      this.stakeFarmContract.address,
      YearnV3,
      PROVIDER(this.chain),
    );
    // Assuming 'percentage' is a float between 0 and 1
    const percentageBN = ethers.BigNumber.from(
      BigInt(Math.floor(percentage * 10000)),
    );

    const balance = (
      await stakeFarmContractInstance.functions.userInfo(this.pid, owner)
    )[0];
    const amount = balance.mul(percentageBN).div(10000);
    const unstakeTxn = prepareContractCall({
      contract: this.stakeFarmContract,
      method: "withdraw",
      params: [this.pid, amount],
    });
    const withdrawTxn = prepareContractCall({
      contract: this.assetContract,
      method: "withdraw",
      params: [amount],
    });

    const [
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
    ] = this._getTheBestTokenAddressToZapOut();
    return [
      [unstakeTxn, withdrawTxn],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      amount,
    ];
  }
  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    return [[], {}];
  }
  async usdBalanceOf(owner, tokenPricesMappingTable) {
    const assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      Vault,
      PROVIDER(this.chain),
    );
    const userBalance = await assetContractInstance.functions.balanceOf(owner);
    return (userBalance * tokenPricesMappingTable["usdc"]) / 1e6;
  }

  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const usdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    return ["usdc", usdc, 6];
  }
  _getTheBestTokenAddressToZapOut() {
    // TODO: minor, but we can read the composition of VLP to get the cheapest token to zap in
    const usdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    return ["usdc", usdc, 6];
  }
}
