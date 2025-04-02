import { readFileSync } from 'fs';
import { tokensAndCoinmarketcapIdsFromDropdownOptions } from "../../../utils/contractInteractions.js";
import assert from "assert";
import { oneInchAddress } from "../../../utils/oneInch.js";
import { getTokenDecimal, approve } from "../../../utils/general.js";
import { ethers } from "ethers";
import { getContract, prepareContractCall } from "thirdweb";
import THIRDWEB_CLIENT from "../../../utils/thirdweb.js";
import getTheBestBridge from "./bridges/bridgeFactory.js";
import { CHAIN_TO_CHAIN_ID, TOKEN_ADDRESS_MAP } from "../../../utils/general.js";
import { toWei } from "thirdweb/utils";
import { TokenPriceBatcher, PriceService } from "./TokenPriceService.js";
import swap from "../../../utils/swapHelper.js";
import { PortfolioFlowChartBuilder } from "./PortfolioFlowChartBuilder.js";

const WETH = JSON.parse(readFileSync('./utils/ABI/Weth.json', 'utf8'));
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));
const PROTOCOL_TREASURY_ADDRESS = "0x2eCBC6f229feD06044CDb0dD772437a30190CD50";
const REWARD_SLIPPAGE = 0.8;

// Add cache for the entire mapping table
const GLOBAL_MAPPING_CACHE = {
  table: null,
  lastUpdated: 0,
  CACHE_DURATION: 60000, // 1 minute cache
};

export class BasePortfolio {
  constructor(strategy, weightMapping, portfolioName, flowChartBuilder) {
    this.portfolioName = portfolioName;
    this.strategy = strategy;
    this.portfolioAPR = {};
    this.existingInvestmentPositions = {};
    this.assetAddressSetByChain = this._getAssetAddressSetByChain();
    this.uniqueTokenIdsForCurrentPrice =
      this._getUniqueTokenIdsForCurrentPrice();
    this.weightMapping = weightMapping;
    this.bridgeUsdThreshold = 10;
    this.flowChartBuilder =
      flowChartBuilder || new PortfolioFlowChartBuilder(this);
    this.validateStrategyWeights();
  }

  denomination() {
    throw new Error("Method 'denomination()' must be implemented.");
  }
  async lockUpPeriod(address) {
    let maxLockUpPeriod = 0;
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocols of Object.values(protocolsInThisCategory)) {
        for (const protocol of protocols) {
          if (protocol.weight === 0) {
            continue;
          }
          if (typeof protocol.interface.lockUpPeriod !== "function") {
            throw new Error("Method 'lockUpPeriod()' must be implemented.");
          }
          const lockUpPeriod = await protocol.interface.lockUpPeriod(address);
          maxLockUpPeriod = Math.max(maxLockUpPeriod, lockUpPeriod);
        }
      }
    }
    return maxLockUpPeriod;
  }
  rebalanceThreshold() {
    return 0.01;
  }
  async usdBalanceOf(address, portfolioAprDict) {
    // Get token prices
    console.time("getTokenPricesMappingTable");
    const tokenPricesMappingTable = await this.getTokenPricesMappingTable();
    console.timeEnd("getTokenPricesMappingTable");
    // Get balances and rewards
    console.time("getBalances");
    const balanceResults = await this._getBalances(
      address,
      tokenPricesMappingTable,
    );
    console.timeEnd("getBalances");
    // Initialize balance dictionary with rewards
    let usdBalance = 0;
    const usdBalanceDict = this._initializeBalanceDict();

    // Process protocol balances
    this._processProtocolBalances(
      balanceResults,
      portfolioAprDict,
      usdBalanceDict,
    );
    // Calculate total balance
    usdBalance += this._calculateTotalBalance(balanceResults);
    // Calculate weights and differences
    const { negativeWeigtDiffSum, positiveWeigtDiffSum } =
      this._calculateWeightDifferences(usdBalanceDict, usdBalance);
    // Build metadata
    const metadata = this._buildMetadata(
      usdBalanceDict,
      negativeWeigtDiffSum,
      positiveWeigtDiffSum,
    );
    usdBalanceDict.metadata = metadata;
    return [usdBalance, usdBalanceDict, tokenPricesMappingTable];
  }

  async _getBalances(address, tokenPricesMappingTable) {
    const balancePromises = Object.values(this.strategy)
      .flatMap((category) => Object.values(category))
      .flat()
      .map((protocol) => {
        return protocol.interface
          .usdBalanceOf(address, tokenPricesMappingTable)
          .then((balance) => {
            return { protocol, balance };
          });
      });

    return await Promise.all(balancePromises);
  }

  _initializeBalanceDict() {
    return {
      pendingRewards: {
        usdBalance: 0,
        weightDiff: 1,
        pendingRewardsDict: {},
        weight: 0,
        APR: 0,
        currentWeight: 0,
      },
    };
  }

  _processProtocolBalances(balanceResults, portfolioAprDict, usdBalanceDict) {
    for (const { protocol, balance } of balanceResults) {
      const protocolUniqueId = `${protocol.interface.uniqueId()}/${
        protocol.interface.constructor.name
      }`;
      usdBalanceDict[protocolUniqueId] = {
        chain: protocol.interface.chain,
        usdBalance: balance,
        weight: protocol.weight,
        symbol: protocol.interface.symbolList,
        protocol: protocol,
        APR: portfolioAprDict?.[protocol.interface.uniqueId()]?.apr * 100,
      };
    }
  }

  _calculateTotalBalance(balanceResults) {
    return balanceResults.reduce((sum, { balance }, index) => {
      if (
        balance === undefined ||
        typeof balance !== "number" ||
        isNaN(balance)
      ) {
        return sum;
      }
      const newSum = sum + balance;
      return newSum;
    }, 0);
  }

  _calculateWeightDifferences(usdBalanceDict, totalUsdBalance) {
    let negativeWeigtDiffSum = 0;
    let positiveWeigtDiffSum = 0;

    for (const [protocolUniqueId, data] of Object.entries(usdBalanceDict)) {
      if (protocolUniqueId === "pendingRewards") continue;

      const currentWeight = isNaN(data.usdBalance)
        ? 0
        : data.usdBalance / totalUsdBalance;
      data.weightDiff = currentWeight - data.weight;
      data.currentWeight = currentWeight;
      data.totalUsdBalance = totalUsdBalance;

      this._calculateZapOutPercentage(data, totalUsdBalance);

      if (data.weightDiff < 0) {
        negativeWeigtDiffSum += data.weightDiff;
      } else {
        positiveWeigtDiffSum += data.weightDiff;
      }
    }

    return { negativeWeigtDiffSum, positiveWeigtDiffSum };
  }

  _calculateZapOutPercentage(data, totalUsdBalance) {
    if (data.weight === 0 && data.usdBalance > 0) {
      data.zapOutPercentage = 1;
    } else if (data.weightDiff > this.rebalanceThreshold()) {
      data.zapOutPercentage =
        ((data.currentWeight - data.weight) * totalUsdBalance) /
        data.usdBalance;
    } else {
      data.zapOutPercentage = 0;
    }
  }

  _buildMetadata(usdBalanceDict, negativeWeigtDiffSum, positiveWeigtDiffSum) {
    const metadata = {
      weightDiffGroupByChain: {},
      rebalanceActionsByChain: [],
    };

    // Initialize chains threshold tracking object
    let chainsExceedRebalanceThreshold = {};
    Object.values(usdBalanceDict).forEach((data) => {
      if (data.chain) {
        chainsExceedRebalanceThreshold[data.chain] = false;
      }
    });

    // Group weight differences by chain
    for (const data of Object.values(usdBalanceDict)) {
      if (!data.chain) continue;

      if (negativeWeigtDiffSum < 0) {
        data.negativeWeigtDiffSum = Math.abs(negativeWeigtDiffSum);
      }
      data.positiveWeigtDiffSum = positiveWeigtDiffSum;

      metadata.weightDiffGroupByChain[data.chain] =
        (metadata.weightDiffGroupByChain[data.chain] || 0) + data.weightDiff;
      if (Math.abs(data.weightDiff) > this.rebalanceThreshold()) {
        chainsExceedRebalanceThreshold[data.chain] = true;
      }
    }

    // First pass: identify chains that need crossChainRebalance
    const crossChainRebalanceChains = Object.entries(
      metadata.weightDiffGroupByChain,
    )
      .filter(
        ([chain, weightDiff]) =>
          weightDiff > 0 && chainsExceedRebalanceThreshold[chain],
      )
      .map(([chain]) => chain);

    // Second pass: determine all rebalance actions
    const rebalanceActions = Object.entries(metadata.weightDiffGroupByChain)
      .filter(([chain, weightDiff]) => {
        if (weightDiff > 0) {
          // For positive weightDiff, only include if it exceeds threshold
          return chainsExceedRebalanceThreshold[chain];
        }

        if (weightDiff < 0) {
          // For negative weightDiff, include if:
          // 1. This chain exceeds threshold, or
          // 2. There are crossChainRebalance chains (we can do localRebalance regardless of threshold)
          return (
            chainsExceedRebalanceThreshold[chain] ||
            crossChainRebalanceChains.length > 0
          );
        }

        return false;
      })
      .sort((a, b) => b[1] - a[1]) // Sort by weightDiff descending
      .map(([chain, weightDiff]) => ({
        chain,
        actionName: weightDiff > 0 ? "crossChainRebalance" : "localRebalance",
      }));

    metadata.rebalanceActionsByChain = rebalanceActions;
    return metadata;
  }

  async pendingRewards(owner, updateProgress, tokenPricesMappingTable) {
    // Flatten the strategy structure and create pending rewards calculation promises
    const rewardsPromises = Object.values(this.strategy)
      .flatMap((category) => Object.values(category))
      .flat()
      .map((protocol) =>
        protocol.interface.pendingRewards(
          owner,
          tokenPricesMappingTable,
          updateProgress,
        ),
      );
    // Wait for all promises to resolve
    const allRewards = await Promise.all(rewardsPromises);
    // Combine all rewards
    const rewardsMappingTable = allRewards.reduce((acc, rewards) => {
      for (const [tokenAddress, rewardMetadata] of Object.entries(rewards)) {
        if (!acc[tokenAddress]) {
          acc[tokenAddress] = rewardMetadata;
        } else {
          // Preserve all existing fields and only update balance and usdDenominatedValue
          acc[tokenAddress] = {
            ...acc[tokenAddress],
            ...rewardMetadata,
            balance: acc[tokenAddress].balance.add(rewardMetadata.balance),
            usdDenominatedValue:
              acc[tokenAddress].usdDenominatedValue +
              rewardMetadata.usdDenominatedValue,
          };
        }
      }
      return acc;
    }, {});
    return {
      rewardUsdBalance: this.sumUsdDenominatedValues(rewardsMappingTable),
      pendingRewardsDict: rewardsMappingTable,
    };
  }

  // Function to sum up the usdDenominatedValue
  sumUsdDenominatedValues(mapping) {
    return Object.values(mapping).reduce((total, entry) => {
      return total + (entry.usdDenominatedValue || 0);
    }, 0);
  }

  mulSwapFeeRate(inputBigBumber) {
    return inputBigBumber.mul(299).div(100000);
  }

  swapFeeRate() {
    return 0.00299;
  }
  mulReferralFeeRate(inputBigBumber) {
    return inputBigBumber.mul(7).div(10);
  }
  referralFeeRate() {
    return 0.7;
  }
  async getPortfolioMetadata() {
    const allProtocols = Object.values(this.strategy)
      .flatMap((protocols) => Object.entries(protocols))
      .flatMap(([chain, protocolArray]) =>
        protocolArray.map((protocol) => ({ chain, protocol })),
      );

    const fetchPoolData = async ({ protocol }) => {
      const poolUniqueKey = protocol.interface.uniqueId();
      const url = `${process.env.NEXT_PUBLIC_API_URL}/pool/${poolUniqueKey}/apr`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        return {
          poolUniqueKey,
          apr: data.value,
          weight: protocol.weight,
          tvl: data.tvl,
        };
      } catch (error) {
        console.error(`Error fetching data for ${url}:`, error);
        return null;
      }
    };

    const poolDataResults = await Promise.all(allProtocols.map(fetchPoolData));

    const aprMappingTable = poolDataResults.reduce((acc, result) => {
      if (result) {
        const { poolUniqueKey, ...data } = result;
        acc[poolUniqueKey] = data;
      }
      return acc;
    }, {});
    const totalTvl = Object.values(aprMappingTable)
      .filter((pool) => pool.weight > 0)
      .reduce((sum, pool) => sum + pool.tvl, 0);

    aprMappingTable["portfolioAPR"] = Object.values(aprMappingTable).reduce(
      (sum, pool) => sum + pool.apr * pool.weight,
      0,
    );

    aprMappingTable["portfolioTVL"] = `${(totalTvl / 1000000).toFixed(2)}M`;
    return aprMappingTable;
  }

  async getExistingInvestmentPositions() {
    throw new Error(
      "Method 'getExistingInvestmentPositions()' must be implemented.",
    );
  }

  async portfolioAction(actionName, actionParams) {
    const updateProgress = async (nodeID, tradingLoss) => {
      // Update stepName first and wait for it to complete
      await new Promise((resolve) => {
        actionParams.setStepName((prevStepName) => {
          resolve();
          return nodeID;
        });
      });

      // Then update the other states
      actionParams.setTradingLoss(tradingLoss);
      if (isNaN(tradingLoss)) {
        console.error(`${nodeID}: tradingLoss is not a number: ${tradingLoss}`);
      } else {
        actionParams.setTotalTradingLoss(
          (prevTotalTradingLoss) => prevTotalTradingLoss + tradingLoss,
        );
      }
    };
    const tokenPricesMappingTable = await this.getTokenPricesMappingTable();
    actionParams.tokenPricesMappingTable = tokenPricesMappingTable;
    actionParams.updateProgress = updateProgress;
    return await this._generateTxnsByAction(actionName, actionParams);
  }

  async _generateTxnsByAction(actionName, actionParams) {
    let totalTxns = [];
    // Handle special pre-processing for specific actions
    if (actionName === "zapIn") {
      if (actionParams.tokenInSymbol === "eth") {
        const [wethTxn, wethAddress, wethSymbol] =
          this._getWrappedEthTxnAddressSymbol(
            actionParams.tokenInSymbol,
            "deposit",
            actionParams.zapInAmount,
            actionParams.chainMetadata,
          );
        actionParams.tokenInSymbol = wethSymbol;
        actionParams.tokenInAddress = wethAddress;
        totalTxns.push(wethTxn);
      }
      if (actionParams.onlyThisChain === false) {
        const platformFee = this.mulSwapFeeRate(actionParams.zapInAmount);
        const normalizedPlatformFeeUSD =
          ethers.utils.formatUnits(platformFee, actionParams.tokenDecimals) *
          actionParams.tokenPricesMappingTable[actionParams.tokenInSymbol];
        const referrer = await this._getReferrer(actionParams.account);
        const platformFeeTxns = this._getPlatformFeeTxns(
          actionParams.tokenInAddress,
          actionParams.chainMetadata,
          platformFee,
          referrer,
        );
        actionParams.zapInAmount = actionParams.zapInAmount.sub(platformFee);
        actionParams.setPlatformFee(-normalizedPlatformFeeUSD);
        totalTxns = totalTxns.concat(platformFeeTxns);
      }
    } else if (
      actionName === "crossChainRebalance" ||
      actionName === "localRebalance"
    ) {
      return await this._generateRebalanceTxns(actionName, actionParams);
    } else if (actionName === "stake") {
      return await this._generateStakeTxns(
        actionParams.protocolAssetDustInWallet,
        actionParams.updateProgress,
      );
    }
    console.time("processProtocolActions");
    // Process each protocol
    const protocolTxns = await this._processProtocolActions(
      actionName,
      actionParams,
    );
    totalTxns = totalTxns.concat(protocolTxns);
    // Handle special post-processing for specific actions
    if (actionName === "zapOut") {
      const portfolioUsdBalance = (
        await this.usdBalanceOf(actionParams.account)
      )[0];
      if (portfolioUsdBalance > 0) {
        const swapFeeTxns = await this._swapFeeTxnsForZapOut(
          actionParams.account,
          actionParams.tokenOutAddress,
          actionParams.tokenOutSymbol,
          actionParams.tokenPricesMappingTable,
          actionParams.zapOutPercentage,
          portfolioUsdBalance,
          actionParams.chainMetadata,
          actionParams.setPlatformFee,
        );
        totalTxns = totalTxns.concat(swapFeeTxns);
      }
    }
    return totalTxns;
  }

  _calculateDerivative(currentChain, onlyThisChain) {
    if (!onlyThisChain) return 1;
    // Calculate total weight for the current chain across all categories
    const totalWeightOnThisChain = Object.values(this.strategy).reduce(
      (categorySum, protocolsInThisCategory) => {
        const chainProtocols = protocolsInThisCategory[currentChain] || [];
        return (
          categorySum +
          chainProtocols.reduce(
            (protocolSum, protocol) => protocolSum + (protocol.weight || 0),
            0,
          )
        );
      },
      0,
    );
    return totalWeightOnThisChain === 0 ? 0 : 1 / totalWeightOnThisChain;
  }

  async _processProtocolActions(actionName, actionParams) {
    const currentChain = actionParams.chainMetadata.name
      .toLowerCase()
      .replace(" one", "")
      .replace(" mainnet", "");

    const actionHandlers = {
      zapIn: async (protocol, chain, derivative) => {
        if (protocol.weight === 0) return null;
        const zapInPrecision = 1000000;
        const percentageBN = ethers.BigNumber.from(
          BigInt(Math.floor(protocol.weight * derivative * zapInPrecision)),
        );
        return protocol.interface.zapIn(
          actionParams.account,
          chain,
          actionParams.zapInAmount.mul(percentageBN).div(zapInPrecision),
          actionParams.tokenInSymbol,
          actionParams.tokenInAddress,
          actionParams.tokenDecimals,
          actionParams.slippage,
          actionParams.tokenPricesMappingTable,
          actionParams.updateProgress,
        );
      },

      zapOut: async (protocol, chain) => {
        const protocolUsdBalance = await protocol.interface.usdBalanceOf(
          actionParams.account,
          actionParams.tokenPricesMappingTable,
        );
        if (protocolUsdBalance === 0) return null;
        let normalizedZapOutPercentage = actionParams.zapOutPercentage;
        if (
          protocolUsdBalance > 1 &&
          protocolUsdBalance * actionParams.zapOutPercentage < 1
        ) {
          // to avoid high slippage, we need to zap out at least 1 dollar
          normalizedZapOutPercentage = 1 / protocolUsdBalance;
        }
        return protocol.interface.zapOut(
          actionParams.account,
          normalizedZapOutPercentage,
          actionParams.tokenOutSymbol === "eth"
            ? TOKEN_ADDRESS_MAP.weth[chain]
            : actionParams.tokenOutAddress,
          actionParams.tokenOutSymbol === "eth"
            ? "weth"
            : actionParams.tokenOutSymbol,
          actionParams.tokenOutDecimals,
          actionParams.slippage,
          actionParams.tokenPricesMappingTable,
          actionParams.updateProgress,
          this.existingInvestmentPositions[chain],
        );
      },

      claimAndSwap: async (protocol, chain) => {
        return protocol.interface.claimAndSwap(
          actionParams.account,
          actionParams.outputToken,
          actionParams.outputTokenSymbol,
          actionParams.outputTokenDecimals,
          actionParams.slippage,
          actionParams.tokenPricesMappingTable,
          actionParams.updateProgress,
        );
      },

      transfer: async (protocol, chain) => {
        const protocolUsdBalance = await protocol.interface.usdBalanceOf(
          actionParams.account,
          actionParams.tokenPricesMappingTable,
        );
        if (protocolUsdBalance === 0) return null;
        return protocol.interface.transfer(
          actionParams.account,
          actionParams.zapOutPercentage,
          actionParams.updateProgress,
          actionParams.recipient,
        );
      },

      stake: async (protocol, chain) => {
        return protocol.stake(
          actionParams.protocolAssetDustInWallet,
          actionParams.updateProgress,
        );
      },
      bridge: async (chain, totalWeight) => {
        if (totalWeight === 0) return [];
        let inputToken =
          TOKEN_ADDRESS_MAP[actionParams.tokenInSymbol][currentChain];
        let inputAmount = String(
          Math.floor(
            actionParams.zapInAmount *
              totalWeight *
              (1 - actionParams.slippage / 100),
          ),
        );
        let txns = [];
        const allowedTokens = ["usdc", "eth", "weth"];
        if (!allowedTokens.includes(actionParams.tokenInSymbol.toLowerCase())) {
          const swapResult = await swap(
            actionParams.account,
            actionParams.chainMetadata.id,
            actionParams.protocolUniqueId,
            this._updateProgressAndWait,
            inputToken,
            TOKEN_ADDRESS_MAP["usdc"][currentChain],
            inputAmount,
            actionParams.slippage,
            actionParams.updateProgress,
            actionParams.tokenInSymbol,
            actionParams.tokenDecimals,
            "usdc",
            6,
            actionParams.tokenPricesMappingTable,
            actionParams,
          );
          // Update input token and amount after the swap
          txns = txns.concat(swapResult[0]);
          inputToken = TOKEN_ADDRESS_MAP["usdc"][currentChain];
          inputAmount = swapResult[1]; // Resulting amount after the swap
        }
        const inputAmountBN = ethers.BigNumber.from(inputAmount);
        const bridge = await getTheBestBridge();
        const targetToken = allowedTokens.includes(
          actionParams.tokenInSymbol.toLowerCase(),
        )
          ? TOKEN_ADDRESS_MAP[actionParams.tokenInSymbol.toLowerCase()][chain]
          : TOKEN_ADDRESS_MAP["usdc"][chain];

        const bridgeTxns = await bridge.getBridgeTxns(
          actionParams.account,
          actionParams.chainMetadata.id,
          CHAIN_TO_CHAIN_ID[chain],
          inputToken,
          targetToken,
          inputAmountBN,
          actionParams.updateProgress,
        );
        return [...txns, ...bridgeTxns];
      },
    };

    const processProtocolTxns = async (currentChain) => {
      const protocolPromises = [];

      const derivative = this._calculateDerivative(
        currentChain,
        actionParams.onlyThisChain,
      );

      // Calculate total weight for the current chain across all categories
      const totalWeightOnThisChain = Object.values(this.strategy).reduce(
        (categorySum, protocolsInThisCategory) => {
          const chainProtocols = protocolsInThisCategory[currentChain] || [];
          return (
            categorySum +
            chainProtocols.reduce(
              (protocolSum, protocol) => protocolSum + (protocol.weight || 0),
              0,
            )
          );
        },
        0,
      );

      for (const protocolsInThisCategory of Object.values(this.strategy)) {
        for (const [chain, protocols] of Object.entries(
          protocolsInThisCategory,
        )) {
          if (chain.toLowerCase() !== currentChain) continue;

          // Process all protocols in parallel
          const chainProtocolPromises = protocols.map(async (protocol) => {
            try {
              const txns = await actionHandlers[actionName](
                protocol,
                chain,
                derivative,
              );
              return txns || [];
            } catch (error) {
              console.error(
                `Error processing protocol ${protocol.interface?.uniqueId?.()}:`,
                error,
              );
              throw error;
            }
          });

          protocolPromises.push(...chainProtocolPromises);
        }
      }
      // Wait for all protocol transactions to complete
      const results = await Promise.all(protocolPromises);
      return results.flat().filter(Boolean);
    };

    const processBridgeTxns = async (currentChain) => {
      // Calculate total weights for each chain
      const chainWeights = this._calculateChainWeights(currentChain);

      // Convert to array format and process bridges
      const bridgePromises = Object.entries(chainWeights).map(
        async ([chain, totalWeight]) => {
          if (
            totalWeight === 0 ||
            (actionParams.zapInAmount * totalWeight) /
              actionParams.tokenDecimals <
              1
          )
            return [];
          try {
            return await actionHandlers["bridge"](chain, totalWeight);
          } catch (error) {
            console.error(`Error processing bridge to ${chain}:`, error);
            return [];
          }
        },
      );

      // Wait for all bridge transactions to complete
      const results = await Promise.all(bridgePromises);
      return results.flat().filter(Boolean);
    };

    // Execute protocol and bridge transactions in parallel
    const [protocolTxns, bridgeTxns] = await Promise.all([
      processProtocolTxns(currentChain),
      actionParams.onlyThisChain ? [] : processBridgeTxns(currentChain),
    ]);
    if (protocolTxns.length === 0) throw new Error("No protocol txns");

    // Combine all transactions, with bridge transactions at the end
    return [...protocolTxns, ...bridgeTxns];
  }

  async _generateRebalanceTxns(actionName, actionParams) {
    const {
      account: owner,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
      rebalancableUsdBalanceDict,
      chainMetadata,
      onlyThisChain,
      usdBalance,
      tokenInSymbol,
      tokenInAddress,
      zapInAmount: zapInAmountFromUI,
    } = actionParams;
    const currentChain = chainMetadata.name
      .toLowerCase()
      .replace(" one", "")
      .replace(" mainnet", "");
    const middleTokenConfig = this._getRebalanceMiddleTokenConfig(
      currentChain,
      false,
    );

    // Run bridge initialization and protocol filtering in parallel
    const [bridge, rebalancableUsdBalanceDictOnThisChain] = await Promise.all([
      getTheBestBridge(),
      this._filterProtocolsForChain(rebalancableUsdBalanceDict, currentChain),
    ]);
    // Generate zap out transactions and calculate total USDC balance
    const [zapOutTxns, zapOutUsdcBalance] = await this._generateZapOutTxns(
      owner,
      middleTokenConfig,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
      rebalancableUsdBalanceDictOnThisChain,
      currentChain,
      onlyThisChain,
    );
    if (zapOutUsdcBalance === 0 && actionName !== "localRebalance") return [];
    // TODO(david): currently we don't support zap in different token than zap out
    // Also, we don't reinvest rewards back to pools, due to the risk of slippage
    const zapInAmount = this.mul_with_slippage_in_bignumber_format(
      ethers.utils
        .parseUnits(
          (
            zapOutUsdcBalance /
            tokenPricesMappingTable[middleTokenConfig.symbol]
          ).toFixed(middleTokenConfig.decimals),
          middleTokenConfig.decimals,
        )
        .add(
          middleTokenConfig.symbol === tokenInSymbol ||
            zapInAmountFromUI === undefined
            ? zapInAmountFromUI
            : ethers.BigNumber.from(0),
        ),
      slippage,
    );
    // Run approval, fee, and zap in transactions generation in parallel
    const [
      [approvalAndFeeTxns, _],
      [zapInTxns, zapInAmountAfterFee],
      rebalancableUsdBalanceDictOnOtherChains,
    ] = await Promise.all([
      this._generateApprovalAndFeeTxns(
        middleTokenConfig,
        zapInAmount,
        chainMetadata,
        actionParams,
      ),
      this._generateZapInTxns(
        owner,
        rebalancableUsdBalanceDictOnThisChain,
        zapInAmount,
        middleTokenConfig,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
        usdBalance,
      ),
      this.filterProtocolsForOtherChains(
        rebalancableUsdBalanceDict,
        currentChain,
      ),
    ]);
    // Combine initial transactions
    const initialTxns = [...zapOutTxns, ...approvalAndFeeTxns, ...zapInTxns];
    // If no other chains to process, return current transactions
    if (Object.keys(rebalancableUsdBalanceDictOnOtherChains).length === 0) {
      return initialTxns;
    }
    if (actionName === "localRebalance" || zapInAmountAfterFee.eq(0)) {
      // This means we only have inflow tokens from other chains, and we need to rebalance on this chain with no need to bridge out
      return initialTxns;
    }
    // Process bridge transactions in parallel
    const bridgePromises = Object.entries(
      rebalancableUsdBalanceDictOnOtherChains,
    ).map(async ([chain, weight]) => {
      const bridgeAmount = ethers.BigNumber.from(
        BigInt(Math.floor(Number(zapInAmountAfterFee) * weight)),
      );

      const bridgeUsd =
        Number(bridgeAmount.toString()) *
        tokenPricesMappingTable[
          this._getRebalanceMiddleTokenConfig(currentChain, true).symbol
        ];
      console.log(`Bridge amount: ${bridgeUsd} to ${chain}`);
      if (bridgeUsd < this.bridgeUsdThreshold) return [];
      const bridgeToOtherChainTxns = await bridge.getBridgeTxns(
        owner,
        chainMetadata.id,
        CHAIN_TO_CHAIN_ID[chain],
        this._getRebalanceMiddleTokenConfig(currentChain, true).address,
        this._getRebalanceMiddleTokenConfig(chain, true).address,
        bridgeAmount,
        updateProgress,
      );

      await this._updateProgressAndWait(actionParams.updateProgress, chain, 0);
      return bridgeToOtherChainTxns;
    });

    const bridgeTxnsArrays = await Promise.all(bridgePromises);
    // Combine all transactions and return
    return [...initialTxns, ...bridgeTxnsArrays.flat()];
  }

  _getRebalanceMiddleTokenConfig(chain, forBridge) {
    if (forBridge) {
      return {
        symbol: "usdc",
        address: TOKEN_ADDRESS_MAP["usdc"][chain],
        decimals: 6,
      };
    }
    if (this.constructor.name === "StablecoinVault") {
      return {
        symbol: "usdc",
        address: TOKEN_ADDRESS_MAP["usdc"][chain],
        decimals: 6,
      };
    } else if (this.constructor.name === "EthVault") {
      return {
        symbol: "weth",
        address: TOKEN_ADDRESS_MAP["weth"][chain],
        decimals: 18,
      };
    } else if (this.constructor.name === "AllWeatherVault") {
      if (chain === "polygon") {
        return {
          symbol: "weth",
          address: TOKEN_ADDRESS_MAP["weth"][chain],
          decimals: 18,
        };
      } else {
        return {
          symbol: "usdc",
          address: TOKEN_ADDRESS_MAP["usdc"][chain],
          decimals: 6,
        };
      }
    }
    return {
      symbol: "usdc",
      address: TOKEN_ADDRESS_MAP["usdc"][chain],
      decimals: 6,
    };
  }

  _filterProtocolsForChain(rebalancableUsdBalanceDict, currentChain) {
    return Object.fromEntries(
      Object.entries(rebalancableUsdBalanceDict).filter(
        ([key, metadata]) =>
          metadata.chain === currentChain || key === "pendingRewards",
      ),
    );
  }

  filterProtocolsForOtherChains(rebalancableUsdBalanceDict, currentChain) {
    // 1. sum up negative weight diffs by each chain
    // 2. and then calculate the total negative weight diff sum from step 1
    // 3. then we'll know the ratio between each chain that I should bridge to. This function is to calculate how many tokens I should bridge to each chain
    // First filter protocols from other chains
    const otherChainProtocols = Object.entries(
      rebalancableUsdBalanceDict,
    ).filter(
      ([key, metadata]) =>
        metadata.chain !== currentChain &&
        key !== "pendingRewards" &&
        key !== "metadata" &&
        metadata.weightDiff < 0,
    );

    if (otherChainProtocols.length === 0) return {};

    // First group and sum negative weight diffs by chain
    const chainWeightDiffs = otherChainProtocols.reduce(
      (acc, [_, metadata]) => {
        acc[metadata.chain] =
          (acc[metadata.chain] || 0) + Math.abs(metadata.weightDiff);
        return acc;
      },
      {},
    );

    // Calculate total negative weight diff across all chains
    const totalNegativeWeightDiff = Object.values(chainWeightDiffs).reduce(
      (sum, diff) => sum + diff,
      0,
    );

    // Calculate normalized ratios for each chain
    return Object.entries(chainWeightDiffs).reduce(
      (acc, [chain, weightDiff]) => {
        acc[chain] = weightDiff / totalNegativeWeightDiff;
        return acc;
      },
      {},
    );
  }

  async _generateZapOutTxns(
    owner,
    middleTokenConfig,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    rebalancableDict,
    currentChain,
    onlyThisChain,
  ) {
    let txns = [];
    let zapOutUsdcBalance = 0;

    // Process all protocols in parallel for better performance
    const protocolPromises = Object.values(this.strategy).flatMap(
      (protocolsInThisCategory) =>
        Object.entries(protocolsInThisCategory).flatMap(
          async ([chain, protocols]) => {
            if (onlyThisChain && chain !== currentChain) return [];

            // Process all protocols in this chain in parallel
            const chainResults = await Promise.all(
              protocols.map(async (protocol) => {
                const [protocolTxns, protocolBalance] =
                  await this._processProtocolZapOut(
                    owner,
                    protocol,
                    middleTokenConfig,
                    slippage,
                    tokenPricesMappingTable,
                    updateProgress,
                    rebalancableDict,
                    chain,
                  );
                return { txns: protocolTxns, balance: protocolBalance };
              }),
            );

            return chainResults;
          },
        ),
    );

    // Wait for all protocol processing to complete
    const results = await Promise.all(protocolPromises);

    // Combine results
    results.flat().forEach((result) => {
      txns = txns.concat(result.txns);
      zapOutUsdcBalance += result.balance;
    });

    return [txns, zapOutUsdcBalance];
  }

  async _processProtocolZapOut(
    owner,
    protocol,
    middleTokenConfig,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    rebalancableDict,
    chain,
  ) {
    const usdBalance = await protocol.interface.usdBalanceOf(
      owner,
      tokenPricesMappingTable,
    );

    const protocolClassName = `${protocol.interface.uniqueId()}/${
      protocol.interface.constructor.name
    }`;
    const zapOutPercentage =
      rebalancableDict[protocolClassName]?.zapOutPercentage;
    if (
      usdBalance === 0 ||
      usdBalance * zapOutPercentage < 1 ||
      !zapOutPercentage ||
      zapOutPercentage <= 0
    )
      return [[], 0];
    const zapOutTxns = await protocol.interface.zapOut(
      owner,
      zapOutPercentage,
      middleTokenConfig.address,
      middleTokenConfig.symbol,
      middleTokenConfig.decimals,
      slippage,
      tokenPricesMappingTable,
      updateProgress,
      {},
      this.existingInvestmentPositions[chain],
    );

    const protocolBalance =
      (usdBalance * zapOutPercentage * (100 - slippage)) / 100;
    return [zapOutTxns, protocolBalance];
  }

  _calculateZapInAmount(
    zapOutAmount,
    rebalancableDict,
    slippage,
    middleTokenConfig,
    tokenPricesMappingTable,
  ) {
    const rewardAmountInMiddleToken =
      (rebalancableDict.pendingRewards.usdBalance * REWARD_SLIPPAGE) /
      tokenPricesMappingTable[middleTokenConfig.symbol];
    const rewardAmount = ethers.utils.parseUnits(
      rewardAmountInMiddleToken.toFixed(middleTokenConfig.decimals),
      middleTokenConfig.decimals,
    );
    return this.mul_with_slippage_in_bignumber_format(
      zapOutAmount,
      slippage,
    ).add(rewardAmount);
  }

  async _generateApprovalAndFeeTxns(
    middleTokenConfig,
    zapInAmount,
    chainMetadata,
    actionParams,
  ) {
    const approveTxn = approve(
      middleTokenConfig.address,
      oneInchAddress,
      zapInAmount,
      () => {},
      chainMetadata.id,
    );

    // need to multiply by 2 because we charge for zap in and zap out
    const platformFee = this.mulSwapFeeRate(zapInAmount).mul(2);
    const zapInAmountAfterFee = zapInAmount.sub(platformFee);

    const rebalanceFeeTxns = await this._getSwapFeeTxnsForZapIn(
      actionParams,
      platformFee,
      middleTokenConfig,
    );

    return [[approveTxn, ...rebalanceFeeTxns], zapInAmountAfterFee];
  }

  async _generateZapInTxns(
    owner,
    rebalancableDict,
    zapInAmountAfterFee,
    middleTokenConfig,
    slippage,
    tokenPricesMappingTable,
    updateProgress,
    usdBalance,
  ) {
    const txns = [];
    let activateStartZapInNode = false;

    // Sort entries by absolute weightDiff
    const sortedEntries = Object.entries(rebalancableDict)
      .filter(
        ([key, metadata]) =>
          key !== "pendingRewards" && metadata.weightDiff < 0,
      )
      .sort((a, b) => Math.abs(a[1].weightDiff) - Math.abs(b[1].weightDiff));

    for (const [key, metadata] of sortedEntries) {
      let zapInUsdValue = usdBalance * Math.abs(metadata.weightDiff);
      let zapInAmount = ethers.BigNumber.from(
        BigInt(
          Math.floor(
            (zapInUsdValue /
              tokenPricesMappingTable[middleTokenConfig.symbol]) *
              10 ** middleTokenConfig.decimals,
          ),
        ),
      );

      if (zapInAmountAfterFee.eq(0)) {
        return [txns, zapInAmountAfterFee];
      }

      if (zapInAmountAfterFee.lt(zapInAmount)) {
        zapInAmount = zapInAmountAfterFee;
        zapInAmountAfterFee = ethers.BigNumber.from(0);
      } else {
        zapInAmountAfterFee = zapInAmountAfterFee.sub(zapInAmount);
      }

      const MIN_USDC_AMOUNT = 100000; // $0.1 in USDC (6 decimals)
      const MIN_WETH_AMOUNT = ethers.utils.parseEther("0.00001"); // 0.00001 ETH

      if (
        (middleTokenConfig.symbol === "usdc" &&
          zapInAmount.lt(MIN_USDC_AMOUNT)) ||
        (middleTokenConfig.symbol === "weth" && zapInAmount.lt(MIN_WETH_AMOUNT))
      ) {
        continue;
      }

      const protocol = metadata.protocol;
      if (activateStartZapInNode === false) {
        await protocol.interface._updateProgressAndWait(
          updateProgress,
          "endOfZapOutOn" + metadata.chain,
          0,
        );
        activateStartZapInNode = true;
      }
      const protocolTxns = await protocol.interface.zapIn(
        owner,
        metadata.chain,
        zapInAmount,
        middleTokenConfig.symbol,
        middleTokenConfig.address,
        middleTokenConfig.decimals,
        slippage,
        tokenPricesMappingTable,
        updateProgress,
        this.existingInvestmentPositions["arbitrum"],
      );
      txns.push(...protocolTxns);
    }

    return [txns, zapInAmountAfterFee];
  }

  async _generateStakeTxns(protocolAssetDustInWallet, updateProgress) {
    let txns = [];
    for (const metadata of Object.values(protocolAssetDustInWallet)) {
      if (metadata.assetBalance.toString() === "0") continue;
      const protocol = metadata.protocol;
      const stakeTxns = await protocol.stake(
        protocolAssetDustInWallet,
        updateProgress,
      );
      txns = txns.concat(stakeTxns);
    }
    return txns;
  }
  async _getProtocolUsdBalanceDictionary(owner, tokenPricesMappingTable) {
    const protocolPromises = Object.values(this.strategy)
      .flatMap((category) => Object.entries(category))
      .flatMap(([chain, protocols]) =>
        protocols
          .filter((protocol) => protocol.weight !== 0)
          .map(async (protocol) => {
            const protocolUsdBalance = await protocol.interface.usdBalanceOf(
              owner,
              tokenPricesMappingTable,
            );
            return {
              chain,
              address: protocol.interface.assetContract.address,
              protocolUsdBalance,
            };
          }),
      );

    const results = await Promise.all(protocolPromises);

    return results.reduce((acc, { chain, address, protocolUsdBalance }) => {
      if (!acc[chain]) acc[chain] = {};
      acc[chain][address] = protocolUsdBalance;
      return acc;
    }, {});
  }
  async calProtocolAssetDustInWalletDictionary(owner, tokenPricesMappingTable) {
    const protocolPromises = Object.values(this.strategy)
      .flatMap((category) => Object.entries(category))
      .flatMap(([chain, protocols]) =>
        protocols.map(async (protocol) => {
          const placeholderForStake = 1;
          if (
            protocol.interface.mode == "single" &&
            (await protocol.interface._stake(placeholderForStake, () => {}))
              .length === 0
          ) {
            return null;
          } else if (
            protocol.interface.mode == "LP" &&
            (await protocol.interface._stakeLP(placeholderForStake, () => {}))
              .length === 0
          ) {
            return null;
          }
          if (Object.keys(tokenPricesMappingTable || {}).length === 0)
            return null;
          return {
            chain,
            protocol: protocol.interface,
            assetBalance: await protocol.interface.assetBalanceOf(owner),
            assetUsdBalanceOf: await protocol.interface.assetUsdBalanceOf(
              owner,
              tokenPricesMappingTable,
            ),
          };
        }),
      );

    const results = await Promise.all(protocolPromises);
    return results
      .filter((result) => result !== null)
      .reduce((acc, result) => {
        if (!acc[result.chain]) {
          acc[result.chain] = {};
        }
        acc[result.chain][result.protocol.assetContract.address] = {
          protocol: result.protocol,
          assetBalance: result.assetBalance,
          assetUsdBalanceOf: result.assetUsdBalanceOf,
        };
        return acc;
      }, {});
  }

  _getUniqueTokenIdsForCurrentPrice() {
    let coinMarketCapIdSet = {};
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocols of Object.values(protocolsInThisCategory)) {
        for (const protocol of protocols) {
          let apiSymbolToIdMapping = {};
          for (const reward of protocol.interface.rewards()) {
            apiSymbolToIdMapping[reward.symbol] = reward.priceId;
          }
          coinMarketCapIdSet = {
            ...coinMarketCapIdSet,
            ...apiSymbolToIdMapping,
          };
        }
      }
    }

    coinMarketCapIdSet = {
      ...coinMarketCapIdSet,
      ...Object.fromEntries(
        Object.entries(tokensAndCoinmarketcapIdsFromDropdownOptions).filter(
          ([_, tokenData]) => tokenData.vaults?.includes(this.portfolioName),
        ),
      ),
    };
    return coinMarketCapIdSet;
  }
  _getAssetAddressSetByChain() {
    let assetAddressSetByChain = {};
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const [chain, protocols] of Object.entries(
        protocolsInThisCategory,
      )) {
        if (!assetAddressSetByChain[chain]) {
          assetAddressSetByChain[chain] = new Set();
        }
        for (const protocol of protocols) {
          assetAddressSetByChain[chain].add(protocol.interface.assetAddress);
        }
      }
    }
    return assetAddressSetByChain;
  }

  async getTokenPricesMappingTable() {
    // Check cache
    if (
      GLOBAL_MAPPING_CACHE.table &&
      Date.now() - GLOBAL_MAPPING_CACHE.lastUpdated <
        GLOBAL_MAPPING_CACHE.CACHE_DURATION
    ) {
      return GLOBAL_MAPPING_CACHE.table;
    }

    const priceService = new PriceService(process.env.NEXT_PUBLIC_API_URL);
    const batcher = new TokenPriceBatcher(priceService);
    const tokensToFetch = Object.entries(
      this.uniqueTokenIdsForCurrentPrice,
    ).filter(
      ([token]) => !Object.keys(PriceService.STATIC_PRICES).includes(token),
    );

    const prices = await batcher.fetchPrices(tokensToFetch);

    // Cache the entire mapping table
    GLOBAL_MAPPING_CACHE.table = prices;
    GLOBAL_MAPPING_CACHE.lastUpdated = Date.now();
    return prices;
  }
  validateStrategyWeights() {
    let totalWeight = 0;
    for (const protocolsInThisCategory of Object.values(this.strategy)) {
      for (const protocolsOnThisChain of Object.values(
        protocolsInThisCategory,
      )) {
        for (const protocol of protocolsOnThisChain) {
          totalWeight += protocol.weight;
        }
      }
    }
    const epsilon = 0.00001; // To account for floating point imprecision
    assert(
      Math.abs(totalWeight - 1) < epsilon,
      `Total weight across all strategies should be 1, but is ${totalWeight}`,
    );
  }
  async _getSwapFeeTxnsForZapIn(actionParams, platformFee, middleTokenConfig) {
    const normalizedPlatformFeeUsd =
      ethers.utils.formatUnits(platformFee, middleTokenConfig.decimals) *
      actionParams.tokenPricesMappingTable[middleTokenConfig.symbol];
    actionParams.setPlatformFee(-normalizedPlatformFeeUsd);
    const referrer = await this._getReferrer(actionParams.account);
    return this._getPlatformFeeTxns(
      middleTokenConfig.address,
      actionParams.chainMetadata,
      platformFee,
      referrer,
    );
  }
  async _swapFeeTxnsForZapOut(
    owner,
    tokenOutAddress,
    tokenOutSymbol,
    tokenPricesMappingTable,
    zapOutPercentage,
    portfolioUsdBalance,
    chainMetadata,
    setPlatformFee,
  ) {
    const referrer = await this._getReferrer(owner);
    const tokenOutUsdBalance = portfolioUsdBalance * zapOutPercentage;
    const swapFeeUsd = tokenOutUsdBalance * this.swapFeeRate();
    setPlatformFee(-swapFeeUsd);
    const tokenOutDecimals = await getTokenDecimal(
      tokenOutAddress,
      chainMetadata.name.toLowerCase(),
    );
    let platformFee = ethers.utils.parseUnits(
      (swapFeeUsd / tokenPricesMappingTable[tokenOutSymbol]).toFixed(
        tokenOutDecimals,
      ),
      tokenOutDecimals,
    );
    return this._getPlatformFeeTxns(
      tokenOutAddress,
      chainMetadata,
      platformFee,
      referrer,
    );
  }
  _calculateReferralFee(amount) {
    return this.mulReferralFeeRate(amount);
  }
  _prepareTransferTxn(contract, recipient, amount) {
    return prepareContractCall({
      contract,
      method: "transfer",
      params: [recipient, amount],
    });
  }
  async _getReferrer(owner) {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_SDK_API_URL
      }/referral/${owner.toLowerCase()}/referees`,
    );
    const data = await response.json();
    return data.referrer;
  }
  async _updateProgressAndWait(updateProgress, nodeId, tradingLoss) {
    await new Promise((resolve) => {
      updateProgress(nodeId, tradingLoss);
      // Use setTimeout to ensure the state update is queued
      setTimeout(resolve, 30);
    });
  }
  _getPlatformFeeTxns(tokenAddress, chainMetadata, platformFee, referrer) {
    let txns = [];
    const contract = getContract({
      client: THIRDWEB_CLIENT,
      address: tokenAddress,
      chain: chainMetadata,
      abi: ERC20_ABI,
    });
    if (referrer) {
      const referralFee = this._calculateReferralFee(platformFee);
      platformFee = platformFee.sub(referralFee);
      const referralFeeTxn = this._prepareTransferTxn(
        contract,
        referrer,
        referralFee,
      );
      txns.push(referralFeeTxn);
    }
    const swapFeeTxn = this._prepareTransferTxn(
      contract,
      PROTOCOL_TREASURY_ADDRESS,
      platformFee,
    );
    txns.push(swapFeeTxn);
    return txns;
  }
  _getWrappedEthTxnAddressSymbol(tokenSymbol, action, amount, chainMetadata) {
    let wrappedTokenAddress;
    let wrappedTokenSymbol;
    let wrappedTokenABI;
    if (tokenSymbol === "eth") {
      wrappedTokenAddress =
        TOKEN_ADDRESS_MAP.weth[
          chainMetadata.name
            .toLowerCase()
            .replace(" one", "")
            .replace(" mainnet", "")
        ];
      wrappedTokenSymbol = "weth";
      wrappedTokenABI = WETH;
    }
    const contract = getContract({
      client: THIRDWEB_CLIENT,
      address: wrappedTokenAddress,
      chain: chainMetadata,
      abi: wrappedTokenABI,
    });
    return [
      prepareContractCall({
        contract,
        method: action,
        ...(action === "deposit"
          ? { value: toWei(ethers.utils.formatEther(amount)) }
          : { params: [amount] }),
      }),
      wrappedTokenAddress,
      wrappedTokenSymbol,
    ];
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
      .mul(ethers.BigNumber.from(String(10000)).sub(slippageBasisPoints))
      .div(10000);
  }

  getFlowChartData(actionName, actionParams) {
    return this.flowChartBuilder.buildFlowChart(actionName, actionParams);
  }

  _calculateChainWeights(currentChain) {
    return Object.values(this.strategy).reduce(
      (acc, protocolsInThisCategory) => {
        Object.entries(protocolsInThisCategory)
          .filter(([chain]) => chain.toLowerCase() !== currentChain)
          .forEach(([chain, protocols]) => {
            if (!acc[chain]) acc[chain] = 0;
            acc[chain] += protocols.reduce(
              (sum, protocol) => sum + (protocol.weight || 0),
              0,
            );
          });
        return acc;
      },
      {},
    );
  }
}
