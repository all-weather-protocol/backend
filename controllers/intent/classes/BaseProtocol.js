import { readFileSync } from 'fs';
import { CHAIN_ID_TO_CHAIN, PROVIDER, NULL_ADDRESS } from "../../../utils/general.js";
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));
import BaseUniswap from "./uniswapv3/BaseUniswap.js";
import assert from "assert";
import THIRDWEB_CLIENT from "../../../utils/thirdweb.js";
import { prepareContractCall, getContract } from "thirdweb";
import swap from "../../../utils/swapHelper.js";
export default class BaseProtocol extends BaseUniswap {
  // arbitrum's Apollox is staked on PancakeSwap
  constructor(chain, chaindId, symbolList, mode, customParams) {
    super();
    this.protocolName = "placeholder";
    this.protocolVersion = "placeholder";
    this.assetDecimals = "placeholder";
    this.assetContract = "placeholder";
    this.protocolContract = "placeholder";
    this.stakeFarmContract = "placeholder";

    this.chain = chain;
    this.chainId = chaindId;
    this.symbolList = symbolList;
    this.mode = mode;
    this.customParams = customParams;
    assert(chain !== undefined, "chain is not set");
    assert(chaindId !== undefined, "chainId is not set");
    assert(symbolList !== undefined, "symbolList is not set");
    assert(mode !== undefined, "mode is not set");
    assert(customParams !== undefined, "customParams is not set");
  }
  uniqueId() {
    return `${this.chain}/${this.protocolName}/${
      this.protocolVersion
    }/${this.symbolList.join("-")}`;
  }
  toString() {
    // If the symbolList is too long, it will be truncated
    const maxSymbols = 2; // Define the maximum number of symbols to show
    const symbolList =
      this.symbolList.length > maxSymbols
        ? `${this.symbolList.slice(0, maxSymbols).join("-")}-...`
        : this.symbolList.join("-");
    return `${this.chain}/${this.protocolName}/${symbolList}`;
  }
  rewards() {
    throw new Error("Method 'rewards()' must be implemented.");
  }
  _checkIfParamsAreSet() {
    assert(this.protocolName !== "placeholder", "protocolName is not set");
    assert(
      this.protocolVersion !== "placeholder",
      "protocolVersion is not set",
    );
    assert(this.assetDecimals !== "placeholder", "assetDecimals is not set");
    assert(typeof this.assetContract === "object", "assetContract is not set");
    assert(
      typeof this.protocolContract === "object",
      "assetContract is not set",
    );
    assert(
      typeof this.stakeFarmContract === "object",
      "assetContract is not set",
    );
  }

  getZapInFlowChartData(inputToken, tokenInAddress, weight) {
    const nodes = this._generateZapInNodes(inputToken, tokenInAddress);
    const edges = this._generateEdges(nodes, weight);
    this._enrichNodesWithMetadata(nodes);

    return { nodes, edges };
  }

  _generateZapInNodes(inputToken, tokenInAddress) {
    const nodes = [];

    if (this.mode === "single") {
      this._addSingleModeNodes(nodes, inputToken, tokenInAddress);
    } else if (this.mode === "LP") {
      this._addLPModeNodes(nodes, inputToken, tokenInAddress);
    }

    return nodes;
  }

  _addSingleModeNodes(nodes, inputToken, tokenInAddress) {
    const [bestTokenSymbol, bestTokenAddressToZapIn, decimals] =
      this._getTheBestTokenAddressToZapIn(
        inputToken,
        tokenInAddress,
        18, // inputTokenDecimalsPlaceholder
      );
    if (
      bestTokenAddressToZapIn.toLowerCase() !== tokenInAddress.toLowerCase()
    ) {
      nodes.push({
        id: `${this.uniqueId()}-${inputToken}-${bestTokenSymbol}-swap`,
        name: `Swap ${inputToken} to ${bestTokenSymbol}`,
      });
    }

    this._addCommonNodes(nodes);
  }

  _addLPModeNodes(nodes, inputToken, tokenInAddress) {
    const { lpTokens: tokenMetadatas } = this._getLPTokenPairesToZapIn();

    for (const [bestTokenSymbol, bestTokenAddressToZapIn] of tokenMetadatas) {
      if (
        bestTokenAddressToZapIn.toLowerCase() !== tokenInAddress.toLowerCase()
      ) {
        nodes.push({
          id: `${this.uniqueId()}-${inputToken}-${bestTokenSymbol}-swap`,
          name: `Swap ${inputToken} to ${bestTokenSymbol}`,
        });
      }
    }

    this._addCommonNodes(nodes);
  }

  _addCommonNodes(nodes) {
    const commonNodes = [
      {
        id: `${this.uniqueId()}-approve`,
        name: "Approve",
      },
      {
        id: `${this.uniqueId()}-deposit`,
        name: `Deposit ${this.symbolList.join("-")}`,
      },
      {
        id: `${this.uniqueId()}-stake`,
        name: "stake",
      },
    ];

    nodes.push(...commonNodes);
  }

  _generateEdges(nodes, weight) {
    const edges = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${this.uniqueId()}-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        data: { ratio: weight },
      });
    }

    return edges;
  }

  _enrichNodesWithMetadata(nodes) {
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
  }
  getClaimFlowChartData(outputToken, outputTokenAddress) {
    function _autoGenerateEdges(uniqueId, nodes) {
      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${uniqueId}-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          data: {
            ratio: 1,
          },
        });
      }
      return edges;
    }
    const nodes = [];

    if (this.mode === "single") {
      // decimals here doesn't matter
      for (const node of [
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
      ]) {
        nodes.push(node);
      }
      const [bestTokenSymbol, bestTokenAddressToZapIn, _] =
        this._getTheBestTokenAddressToZapOut();
      if (
        outputTokenAddress.toLowerCase() !==
        bestTokenAddressToZapIn.toLowerCase()
      ) {
        nodes.push({
          id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
          name: `Swap ${bestTokenSymbol} to ${outputToken}`,
        });
      }
    } else if (this.mode === "LP") {
      for (const node of [
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
      ]) {
        nodes.push(node);
      }
      const { lpTokens: tokenMetadatas } = this._getLPTokenAddressesToZapOut();
      for (const [
        bestTokenSymbol,
        bestTokenAddressToZapOut,
        decimals,
      ] of tokenMetadatas) {
        if (
          bestTokenAddressToZapOut.toLowerCase() !==
          outputTokenAddress.toLowerCase()
        ) {
          nodes.push({
            id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
            name: `Swap ${bestTokenSymbol} to ${outputToken}`,
          });
        }
      }
    }
    const edges = _autoGenerateEdges(this.uniqueId(), nodes);
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges,
    };
  }
  getZapOutFlowChartData(outputToken, outputTokenAddress, weight) {
    function _autoGenerateEdges(uniqueId, nodes) {
      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${uniqueId}-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          data: {
            ratio: weight,
          },
        });
      }
      return edges;
    }
    const nodes = [];

    if (this.mode === "single") {
      // decimals here doesn't matter
      for (const node of [
        {
          id: `${this.uniqueId()}-unstake`,
          name: "Unstake",
        },
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
        {
          id: `${this.uniqueId()}-withdraw`,
          name: `Withdraw ${this.symbolList.join("-")}`,
        },
      ]) {
        nodes.push(node);
      }
      const [bestTokenSymbol, bestTokenAddressToZapIn, _] =
        this._getTheBestTokenAddressToZapOut();
      if (
        outputTokenAddress.toLowerCase() !==
        bestTokenAddressToZapIn.toLowerCase()
      ) {
        nodes.push({
          id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
          name: `Swap ${bestTokenSymbol} to ${outputToken}`,
        });
      }
    } else if (this.mode === "LP") {
      for (const node of [
        {
          id: `${this.uniqueId()}-unstake`,
          name: "Unstake",
        },
        {
          id: `${this.uniqueId()}-claim`,
          name: "Claim Rewards",
        },
        {
          id: `${this.uniqueId()}-withdraw`,
          name: `Withdraw ${this.symbolList.join("-")}`,
        },
      ]) {
        nodes.push(node);
      }
      const { lpTokens: tokenMetadatas } = this._getLPTokenAddressesToZapOut();
      for (const [
        bestTokenSymbol,
        bestTokenAddressToZapOut,
        decimals,
      ] of tokenMetadatas) {
        if (
          bestTokenAddressToZapOut.toLowerCase() !==
          outputTokenAddress.toLowerCase()
        ) {
          nodes.push({
            id: `${this.uniqueId()}-${bestTokenSymbol}-${outputToken}-swap`,
            name: `Swap ${bestTokenSymbol} to ${outputToken}`,
          });
        }
      }
    }
    const edges = _autoGenerateEdges(this.uniqueId(), nodes);
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges,
    };
  }
  getTransferFlowChartData(weight) {
    const nodes = [
      {
        id: `${this.uniqueId()}-unstake`,
        name: "Unstake",
      },
      {
        id: `${this.uniqueId()}-transfer`,
        name: "Transfer",
      },
    ];
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges: [
        {
          id: `edge-${this.uniqueId()}-0`,
          source: `${this.uniqueId()}-unstake`,
          target: `${this.uniqueId()}-transfer`,
          data: {
            ratio: weight,
          },
        },
      ],
    };
  }
  getStakeFlowChartData() {
    const nodes = [
      {
        id: `${this.uniqueId()}-stake`,
        name: "stake",
      },
    ];
    // add chain, category, protocol, symbol to the nodes
    for (const node of nodes) {
      node.chain = this.chain;
      node.symbolList = this.symbolList.map((symbol) =>
        symbol.replace("(bridged)", ""),
      );
      node.imgSrc = `/projectPictures/${this.protocolName}.webp`;
    }
    return {
      nodes,
      edges: [],
    };
  }
  async usdBalanceOf(address, tokenPricesMappingTable) {
    throw new Error("Method 'usdBalanceOf()' must be implemented.");
  }
  async assetUsdBalanceOf(owner, tokenPricesMappingTable) {
    const balance = await this.assetBalanceOf(owner);
    const assetPrice = await this.assetUsdPrice(tokenPricesMappingTable);

    // Calculate: (balance * price) / (10 ** assetDecimals)
    return balance * assetPrice;
  }
  async stakeBalanceOf(address) {
    throw new Error("Method 'stakeBalanceOf()' must be implemented.");
  }
  async assetBalanceOf(recipient) {
    const assetContractInstance = new ethers.Contract(
      this.assetContract.address,
      ERC20_ABI,
      PROVIDER(this.chain),
    );
    const balance = (
      await assetContractInstance.functions.balanceOf(recipient)
    )[0];
    return balance;
  }
  async pendingRewards(recipient, tokenPricesMappingTable, updateProgress) {
    throw new Error("Method 'pendingRewards()' must be implemented.");
  }
  async assetUsdPrice(tokenPricesMappingTable) {
    throw new Error("Method 'assetUsdPrice()' must be implemented.");
  }
  async zapIn(
    recipient,
    chain,
    investmentAmountInThisPosition,
    inputToken,
    tokenInAddress,
    tokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    if (this.mode === "single") {
      const [
        beforeZapInTxns,
        bestTokenSymbol,
        bestTokenAddressToZapIn,
        amountToZapIn,
        bestTokenToZapInDecimal,
      ] = await this._beforeDeposit(
        recipient,
        tokenInAddress,
        investmentAmountInThisPosition,
        slippage,
        updateProgress,
        inputToken,
        tokenDecimals,
        tokenPricesMappingTable,
      );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-approve`,
        0,
      );
      const zapinTxns = await this.customDeposit(
        recipient,
        bestTokenSymbol,
        bestTokenAddressToZapIn,
        amountToZapIn,
        bestTokenToZapInDecimal,
        tokenPricesMappingTable,
        slippage,
        updateProgress,
      );
      return beforeZapInTxns.concat(zapinTxns);
    } else if (this.mode === "LP") {
      const [beforeZapInTxns, tokenAmetadata, tokenBmetadata] =
        await this._beforeDepositLP(
          recipient,
          tokenInAddress,
          investmentAmountInThisPosition,
          slippage,
          updateProgress,
          inputToken,
          tokenDecimals,
          tokenPricesMappingTable,
        );
      await this._updateProgressAndWait(
        updateProgress,
        `${this.uniqueId()}-approve`,
        0,
      );
      const zapinTxns = await this.customDepositLP(
        recipient,
        tokenAmetadata,
        tokenBmetadata,
        tokenPricesMappingTable,
        slippage,
        updateProgress,
      );
      return beforeZapInTxns.concat(zapinTxns);
    }
  }
  async zapOut(
    recipient,
    percentage,
    outputToken,
    outputTokenSymbol,
    outputTokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    customParams,
    existingInvestmentPositionsInThisChain,
  ) {
    let withdrawTxns = [];
    let redeemTxns = [];
    let withdrawTokenAndBalance = {};
    if (this.mode === "single") {
      const [
        withdrawTxnsForSingle,
        symbolOfBestTokenToZapOut,
        bestTokenAddressToZapOut,
        decimalOfBestTokenToZapOut,
        minOutAmount,
      ] = await this.customWithdrawAndClaim(
        recipient,
        percentage,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
      );
      const [redeemTxnsForSingle, withdrawTokenAndBalanceForSingle] =
        await this._calculateWithdrawTokenAndBalance(
          recipient,
          symbolOfBestTokenToZapOut,
          bestTokenAddressToZapOut,
          decimalOfBestTokenToZapOut,
          minOutAmount,
          tokenPricesMappingTable,
          updateProgress,
        );
      withdrawTxns = withdrawTxnsForSingle;
      redeemTxns = redeemTxnsForSingle;
      withdrawTokenAndBalance = withdrawTokenAndBalanceForSingle;
    } else if (this.mode === "LP") {
      const [withdrawLPTxns, tokenMetadatas, minPairAmounts] =
        await this.customWithdrawLPAndClaim(
          recipient,
          percentage,
          slippage,
          tokenPricesMappingTable,
          updateProgress,
        );
      if (
        withdrawLPTxns === undefined &&
        tokenMetadatas === undefined &&
        minPairAmounts === undefined
      ) {
        // it means the NFT has been burned, so we don't need to do anything
        return [];
      }
      const [redeemTxnsFromLP, withdrawTokenAndBalanceFromLP] =
        await this._calculateWithdrawLPTokenAndBalance(
          recipient,
          tokenMetadatas,
          minPairAmounts,
          tokenPricesMappingTable,
          updateProgress,
        );
      withdrawTxns = withdrawLPTxns;
      redeemTxns = redeemTxnsFromLP;
      withdrawTokenAndBalance = withdrawTokenAndBalanceFromLP;
    }
    const batchSwapTxns = await this._batchSwap(
      recipient,
      withdrawTokenAndBalance,
      outputToken,
      outputTokenSymbol,
      outputTokenDecimals,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    if (redeemTxns.length === 0) {
      return [...withdrawTxns, ...batchSwapTxns];
    } else {
      return [...withdrawTxns, ...redeemTxns, ...batchSwapTxns];
    }
  }
  async claimAndSwap(
    recipient,
    outputToken,
    outputTokenSymbol,
    outputTokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-claim`,
      0,
    );
    const [claimTxns, claimedTokenAndBalance] = await this.customClaim(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const txns = await this._batchSwap(
      recipient,
      claimedTokenAndBalance,
      outputToken,
      outputTokenSymbol,
      outputTokenDecimals,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [...claimTxns, ...txns];
  }

  async transfer(owner, percentage, updateProgress, recipient) {
    let amount;
    let unstakeTxnsOfThisProtocol;
    if (this.mode === "single") {
      [unstakeTxnsOfThisProtocol, amount] = await this._unstake(
        owner,
        percentage,
        updateProgress,
      );
    } else if (this.mode === "LP") {
      [unstakeTxnsOfThisProtocol, amount] = await this._unstakeLP(
        owner,
        percentage,
        updateProgress,
      );
    } else {
      throw new Error("Invalid mode for transfer");
    }

    // Ensure amount is valid
    if (!amount || amount.toString() === "0") {
      throw new Error("No amount available to transfer");
    }

    const transferTxn = prepareContractCall({
      contract: this.assetContract,
      method: "transfer",
      params: [recipient, amount],
    });
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-transfer`,
      0,
    );
    return [...unstakeTxnsOfThisProtocol, transferTxn];
  }
  async stake(protocolAssetDustInWallet, updateProgress) {
    let stakeTxns = [];
    const amount =
      protocolAssetDustInWallet[this.assetContract.address].assetBalance;
    if (amount.toString() === "0") {
      return [];
    }
    if (this.mode === "single") {
      stakeTxns = await this._stake(amount, updateProgress);
    } else if (this.mode === "LP") {
      stakeTxns = await this._stakeLP(amount, updateProgress);
    } else {
      throw new Error("Invalid mode for stake");
    }
    return stakeTxns;
  }
  async customDeposit(
    recipient,
    inputToken,
    bestTokenAddressToZapIn,
    amountToZapIn,
    bestTokenToZapInDecimal,
    tokenPricesMappingTable,
    slippage,
    updateProgress,
  ) {
    throw new Error("Method 'customDeposit()' must be implemented.", amount);
  }
  async customWithdrawAndClaim(
    owner,
    percentage,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const [unstakeTxns, unstakedAmount] = await this._unstake(
      owner,
      percentage,
      updateProgress,
    );
    const [
      withdrawAndClaimTxns,
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      minTokenOut,
    ] = await this._withdrawAndClaim(
      owner,
      unstakedAmount,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
    );
    return [
      [...unstakeTxns, ...withdrawAndClaimTxns],
      symbolOfBestTokenToZapOut,
      bestTokenAddressToZapOut,
      decimalOfBestTokenToZapOut,
      minTokenOut,
    ];
  }
  async customWithdrawLPAndClaim(
    owner,
    percentage,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    const [unstakeTxns, unstakedAmount] = await this._unstakeLP(
      owner,
      percentage,
      updateProgress,
    );
    if (unstakedAmount === undefined) {
      // it means the NFT has been burned
      return [undefined, undefined, undefined];
    }
    const [withdrawAndClaimTxns, tokenMetadatas, minPairAmounts] =
      await this._withdrawLPAndClaim(
        owner,
        unstakedAmount,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
      );
    return [
      [...unstakeTxns, ...withdrawAndClaimTxns],
      tokenMetadatas,
      minPairAmounts,
    ];
  }

  async customClaim(owner, tokenPricesMappingTable, updateProgress) {
    throw new Error("Method 'customClaim()' must be implemented.");
  }

  async customRedeemVestingRewards(pendingRewards, owner) {
    return [];
  }

  _getTheBestTokenAddressToZapIn(inputToken, tokenAddress, InputTokenDecimals) {
    throw new Error(
      "Method '_getTheBestTokenAddressToZapIn()' must be implemented.",
    );
  }
  _getLPTokenPairesToZapIn() {
    return {
      lpTokens: this.customParams.lpTokens,
      tickers: this.customParams.tickers,
    };
  }
  _getTheBestTokenAddressToZapOut() {
    throw new Error(
      "Method '_getTheBestTokenAddressToZapOut()' must be implemented.",
    );
  }
  _getLPTokenAddressesToZapOut() {
    return this._getLPTokenPairesToZapIn();
  }
  async _beforeDeposit(
    recipient,
    tokenInAddress,
    investmentAmountInThisPosition,
    slippage,
    updateProgress,
    inputToken,
    tokenDecimals,
    tokenPricesMappingTable,
  ) {
    let totalSwapTxns = [];
    const [bestTokenSymbol, bestTokenAddressToZapIn, bestTokenToZapInDecimal] =
      this._getTheBestTokenAddressToZapIn(
        inputToken,
        tokenInAddress,
        tokenDecimals,
      );
    let amountToZapIn = investmentAmountInThisPosition;
    if (
      tokenInAddress.toLowerCase() !== bestTokenAddressToZapIn.toLowerCase()
    ) {
      const [swapTxns, swapEstimateAmount] = await swap(
        recipient,
        this.chainId,
        this.uniqueId(),
        this._updateProgressAndWait,
        tokenInAddress,
        bestTokenAddressToZapIn,
        amountToZapIn,
        slippage,
        updateProgress,
        inputToken,
        tokenDecimals,
        bestTokenSymbol,
        bestTokenToZapInDecimal,
        tokenPricesMappingTable,
      );
      amountToZapIn = String(
        Math.floor((swapEstimateAmount * (100 - slippage)) / 100),
      );
      totalSwapTxns = totalSwapTxns.concat(swapTxns);
    }
    return [
      totalSwapTxns,
      bestTokenSymbol,
      bestTokenAddressToZapIn,
      amountToZapIn,
      bestTokenToZapInDecimal,
    ];
  }
  async _beforeDepositLP(
    recipient,
    tokenInAddress,
    investmentAmountInThisPosition,
    slippage,
    updateProgress,
    inputToken,
    tokenDecimals,
    tokenPricesMappingTable,
  ) {
    // Validate and get token pairs
    const { lpTokens: tokenMetadatas, tickers } =
      this._getLPTokenPairesToZapIn();
    if (tokenMetadatas.length !== 2) {
      throw new Error(
        `Currently only support 2 tokens in LP, but got ${tokenMetadatas.length}`,
      );
    }

    // Calculate initial ratios
    const usdAmount =
      investmentAmountInThisPosition * tokenPricesMappingTable[inputToken];
    const lpTokenRatio = await this._calculateTokenAmountsForLP(
      usdAmount,
      tokenMetadatas,
      tickers,
      tokenPricesMappingTable,
    );
    const sumOfLPTokenRatio = lpTokenRatio.reduce(
      (acc, value) => acc.add(value),
      ethers.BigNumber.from(0),
    );
    // Process swaps for each token
    const [swapTxns, amountsAfterSwap] = await this._processTokenSwaps(
      recipient,
      tokenInAddress,
      inputToken,
      tokenDecimals,
      tokenMetadatas,
      lpTokenRatio,
      sumOfLPTokenRatio,
      investmentAmountInThisPosition,
      slippage,
      updateProgress,
      tokenPricesMappingTable,
    );
    // Balance token ratios
    const balancedAmounts = this._balanceTokenRatios(
      amountsAfterSwap,
      tokenMetadatas,
      lpTokenRatio,
      tokenPricesMappingTable,
    );
    // Format final metadata
    const swappedTokenMetadatas = tokenMetadatas.map((metadata, index) => [
      ...metadata.slice(0, 3),
      balancedAmounts[index],
    ]);
    return [swapTxns, swappedTokenMetadatas[0], swappedTokenMetadatas[1]];
  }

  async _processTokenSwaps(
    recipient,
    tokenInAddress,
    inputToken,
    tokenDecimals,
    tokenMetadatas,
    lpTokenRatio,
    sumOfLPTokenRatio,
    investmentAmount,
    slippage,
    updateProgress,
    tokenPricesMappingTable,
  ) {
    let totalSwapTxns = [];
    const amountsAfterSwap = [];

    for (const [
      index,
      [bestTokenSymbol, bestTokenAddress, bestTokenToZapInDecimal],
    ] of tokenMetadatas.entries()) {
      let amountToZapIn = investmentAmount
        .mul(lpTokenRatio[index])
        .div(sumOfLPTokenRatio);

      if (tokenInAddress.toLowerCase() !== bestTokenAddress.toLowerCase()) {
        const [swapTxns, swapEstimateAmount] = await swap(
          recipient,
          this.chainId,
          this.uniqueId(),
          this._updateProgressAndWait,
          tokenInAddress,
          bestTokenAddress,
          amountToZapIn,
          slippage,
          updateProgress,
          inputToken,
          tokenDecimals,
          bestTokenSymbol,
          bestTokenToZapInDecimal,
          tokenPricesMappingTable,
        );

        amountToZapIn = ethers.BigNumber.from(
          BigInt(Math.floor(swapEstimateAmount)),
        );
        totalSwapTxns = totalSwapTxns.concat(swapTxns);
      }

      amountsAfterSwap.push(amountToZapIn);
    }

    return [totalSwapTxns, amountsAfterSwap];
  }

  _balanceTokenRatios(
    amounts,
    tokenMetadatas,
    lpTokenRatio,
    tokenPricesMappingTable,
  ) {
    const PRECISION = 10000000000000;
    const MAX_UINT256 = ethers.BigNumber.from("2").pow(256).sub(1);

    // Calculate USD values and ratios
    const usdValues = this._calculateUsdValues(
      amounts,
      tokenMetadatas,
      tokenPricesMappingTable,
    );
    const { currentRatio, targetRatio } = this._calculateRatios(
      usdValues,
      lpTokenRatio,
    );

    // Convert ratios to BigNumber format
    const ratios = this._convertRatiosToBigNumber(
      currentRatio,
      targetRatio,
      PRECISION,
    );

    // Balance the amounts based on ratios
    return this._adjustAmountsToMatchRatio(amounts, ratios, MAX_UINT256);
  }

  _calculateUsdValues(amounts, tokenMetadatas, tokenPricesMappingTable) {
    return amounts.map((amount, index) => {
      const tokenDecimals = tokenMetadatas[index][2];
      const tokenSymbol = tokenMetadatas[index][0];
      const normalizedAmount = Number(
        ethers.utils.formatUnits(amount, tokenDecimals),
      );
      if (tokenPricesMappingTable[tokenSymbol] === undefined) {
        throw new Error(`No price found for token ${tokenSymbol}`);
      }
      return normalizedAmount * tokenPricesMappingTable[tokenSymbol];
    });
  }

  _calculateRatios(usdValues, lpTokenRatio) {
    return {
      currentRatio: usdValues[0] / usdValues[1],
      targetRatio: lpTokenRatio[0] / lpTokenRatio[1],
    };
  }

  _convertRatiosToBigNumber(currentRatio, targetRatio, precision) {
    return {
      current: ethers.BigNumber.from(
        BigInt(Math.floor(currentRatio * precision)),
      ),
      target: ethers.BigNumber.from(
        BigInt(Math.floor(targetRatio * precision)),
      ),
    };
  }

  _adjustAmountsToMatchRatio(amounts, ratios, maxUint256) {
    const balancedAmounts = [...amounts];
    const isCurrentRatioHigher = ratios.current.gt(ratios.target);
    const indexToAdjust = isCurrentRatioHigher ? 0 : 1;

    const newAmount = isCurrentRatioHigher
      ? amounts[0].mul(ratios.target).div(ratios.current)
      : amounts[1].mul(ratios.current).div(ratios.target);

    if (this._isAmountInValidRange(newAmount, maxUint256)) {
      balancedAmounts[indexToAdjust] = newAmount;
    } else {
      console.error(
        `Amount[${indexToAdjust}] outside safe uint256 range - setting to 0`,
      );
      balancedAmounts[indexToAdjust] = ethers.BigNumber.from("0");
    }

    return balancedAmounts;
  }

  _isAmountInValidRange(amount, maxUint256) {
    return !amount.lt(0) && !amount.gt(maxUint256);
  }

  async _batchSwap(
    recipient,
    withdrawTokenAndBalance,
    outputToken,
    outputTokenSymbol,
    outputTokenDecimals,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let txns = [];
    for (const [address, tokenMetadata] of Object.entries(
      withdrawTokenAndBalance,
    )) {
      const amount = tokenMetadata.balance;
      const fromTokenSymbol = tokenMetadata.symbol;
      const fromTokenDecimals = tokenMetadata.decimals;
      if (
        amount.toString() === "0" ||
        amount === 0 ||
        tokenMetadata.vesting === true ||
        // if usd value of this token is less than 1, then it's easy to suffer from high slippage
        tokenMetadata.usdDenominatedValue < 1
      ) {
        console.warn(
          `Skip selling ${fromTokenSymbol} because its usdDenominatedValue is less than 1`,
          tokenMetadata.usdDenominatedValue,
          "amount:",
          amount,
        );
        continue;
      }
      const swapTxnResult = await swap(
        recipient,
        this.chainId,
        this.uniqueId(),
        this._updateProgressAndWait,
        address,
        outputToken,
        amount,
        slippage,
        updateProgress,
        fromTokenSymbol,
        fromTokenDecimals,
        outputTokenSymbol,
        outputTokenDecimals,
        tokenPricesMappingTable,
      );
      if (swapTxnResult === undefined) {
        continue;
      }
      txns = txns.concat(swapTxnResult[0]);
    }
    return txns;
  }

  async _calculateWithdrawTokenAndBalance(
    recipient,
    symbolOfBestTokenToZapOut,
    bestTokenAddressToZapOut,
    decimalOfBestTokenToZapOut,
    minOutAmount,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let withdrawTokenAndBalance = {};
    withdrawTokenAndBalance[bestTokenAddressToZapOut] = {
      symbol: symbolOfBestTokenToZapOut,
      balance: minOutAmount,
      usdDenominatedValue:
        (tokenPricesMappingTable[symbolOfBestTokenToZapOut] * minOutAmount) /
        Math.pow(10, decimalOfBestTokenToZapOut),
      decimals: decimalOfBestTokenToZapOut,
    };
    assert(
      withdrawTokenAndBalance[bestTokenAddressToZapOut].usdDenominatedValue > 1,
      `usdDenominatedValue is less than 1 for ${symbolOfBestTokenToZapOut}`,
    );
    const pendingRewards = await this.pendingRewards(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const redeemTxns = await this.customRedeemVestingRewards(
      pendingRewards,
      recipient,
    );
    for (const [address, metadata] of Object.entries(pendingRewards)) {
      if (withdrawTokenAndBalance[address]) {
        withdrawTokenAndBalance[address].balance = withdrawTokenAndBalance[
          address
        ].balance.add(metadata.balance);
        const tokenPrice = tokenPricesMappingTable[metadata.symbol];
        if (tokenPrice === undefined) {
          throw new Error(`No price found for token ${metadata.symbol}`);
        } else {
          withdrawTokenAndBalance[address].usdDenominatedValue =
            tokenPrice *
            Number(
              ethers.utils.formatUnits(
                withdrawTokenAndBalance[address].balance,
                withdrawTokenAndBalance[address].decimals,
              ),
            );
        }
      } else {
        withdrawTokenAndBalance[address] = metadata;
      }
    }
    return [redeemTxns, withdrawTokenAndBalance];
  }
  async _calculateWithdrawLPTokenAndBalance(
    recipient,
    tokenMetadatas,
    minPairAmounts,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    let withdrawTokenAndBalance = {};
    for (const [index, tokenMetadata] of tokenMetadatas.entries()) {
      const [
        symbolOfBestTokenToZapOut,
        bestTokenAddressToZapOut,
        decimalOfBestTokenToZapOut,
      ] = tokenMetadata;
      const minOutAmount = minPairAmounts[index];
      if (minOutAmount.toString() === "0" || minOutAmount === 0) {
        continue;
      }
      withdrawTokenAndBalance[bestTokenAddressToZapOut] = {
        symbol: symbolOfBestTokenToZapOut,
        balance: minOutAmount,
        usdDenominatedValue:
          tokenPricesMappingTable[symbolOfBestTokenToZapOut] *
          Number(
            ethers.utils.formatUnits(minOutAmount, decimalOfBestTokenToZapOut),
          ),
        decimals: decimalOfBestTokenToZapOut,
      };
      assert(
        !isNaN(
          withdrawTokenAndBalance[bestTokenAddressToZapOut].usdDenominatedValue,
        ),
        `usdDenominatedValue is NaN for ${symbolOfBestTokenToZapOut}`,
      );
    }
    const pendingRewards = await this.pendingRewards(
      recipient,
      tokenPricesMappingTable,
      updateProgress,
    );
    const redeemTxns = await this.customRedeemVestingRewards(
      pendingRewards,
      recipient,
    );
    for (const [address, metadata] of Object.entries(pendingRewards)) {
      if (withdrawTokenAndBalance[address]) {
        withdrawTokenAndBalance[address].balance = withdrawTokenAndBalance[
          address
        ].balance.add(metadata.balance);
        const tokenPrice = tokenPricesMappingTable[metadata.symbol];
        if (tokenPrice === undefined) {
          withdrawTokenAndBalance[address].usdDenominatedValue = 0;
        } else {
          withdrawTokenAndBalance[address].usdDenominatedValue =
            tokenPrice *
            Number(
              ethers.utils.formatUnits(
                withdrawTokenAndBalance[address].balance,
                withdrawTokenAndBalance[address].decimals,
              ),
            );
        }
      } else {
        withdrawTokenAndBalance[address] = metadata;
      }
    }
    return [redeemTxns, withdrawTokenAndBalance];
  }
  async _stake(amount, updateProgress) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-stake`,
      0,
    );
    // child class should implement this
  }
  async _stakeLP(amount, updateProgress) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-stake`,
      0,
    );
    // child class should implement this
  }
  async _unstake(owner, percentage, updateProgress) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-unstake`,
      0,
    );
    // child class should implement this
  }
  async _unstakeLP(owner, percentage, updateProgress) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-unstake`,
      0,
    );
    // child class should implement this
  }
  async _withdrawAndClaim(
    owner,
    withdrawAmount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-claim`,
      0,
    );
    // child class should implement this
  }
  async _withdrawLPAndClaim(
    owner,
    amount,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
  ) {
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-claim`,
      0,
    );
    // child class should implement this
  }
  async _calculateTokenAmountsForLP(
    usdAmount,
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    throw new Error(
      'Method "_calculateTokenAmountsForLP()" must be implemented.',
    );
  }
  mul_with_slippage_in_bignumber_format(amount, slippage) {
    // Convert amount to BigNumber if it isn't already
    const amountBN = ethers.BigNumber.isBigNumber(amount)
      ? amount
      : ethers.BigNumber.from(BigInt(Math.floor(amount)));

    // Convert slippage to basis points (e.g., 0.5% -> 50)
    const slippageBasisPoints = ethers.BigNumber.from(
      BigInt(Math.floor(slippage * 100)),
    );

    // Calculate (amount * (10000 - slippageBasisPoints)) / 10000
    return amountBN
      .mul(ethers.BigNumber.from(10000).sub(slippageBasisPoints))
      .div(10000);
  }
  async lockUpPeriod(address) {
    throw new Error("Method 'lockUpPeriod()' must be implemented.");
  }
  async approve(tokenAddress, spenderAddress, amount, updateProgress, chainId) {
    if (typeof amount !== "object") {
      amount = ethers.BigNumber.from(BigInt(Math.floor(amount)));
    }
    const approvalAmount = amount;
    if (approvalAmount === 0) {
      throw new Error("Approval amount is 0. Cannot proceed with approving.");
    }
    if (spenderAddress === NULL_ADDRESS) {
      throw new Error(
        "Spender address is null. Cannot proceed with approving.",
      );
    }
    const contractCall = prepareContractCall({
      contract: getContract({
        client: THIRDWEB_CLIENT,
        address: tokenAddress,
        chain: CHAIN_ID_TO_CHAIN[chainId],
        abi: ERC20_ABI,
      }),
      method: "approve", // <- this gets inferred from the contract
      params: [spenderAddress, approvalAmount],
    });
    await this._updateProgressAndWait(
      updateProgress,
      `${this.uniqueId()}-approve`,
      0,
    );
    return contractCall;
  }
  async _updateProgressAndWait(updateProgress, nodeId, tradingLoss) {
    // First, update the progress
    updateProgress(nodeId, tradingLoss);

    // Wait longer to ensure state updates are processed
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500); // Increased to 500ms to ensure state updates have time to propagate
    });
  }
  getDeadline() {
    return Math.floor(Date.now() / 1000) + 600; // 10 minute deadline
  }
}
