import { fetchSwapData } from "./oneInch.js";
import { approve } from "./general.js";
import { prepareTransaction } from "thirdweb";
import { ethers } from "ethers";
import { CHAIN_ID_TO_CHAIN } from "./general.js";
import THIRDWEB_CLIENT from "./thirdweb.js";
import assert from "assert";
async function swap(
  walletAddress,
  chainId,
  protocolUniqueId,
  updateProgressAndWaitCallback,
  fromTokenAddress,
  toTokenAddress,
  amount,
  slippage,
  updateProgress,
  fromToken,
  fromTokenDecimals,
  toTokenSymbol,
  toTokenDecimals,
  tokenPricesMappingTable,
) {
  if (fromTokenAddress.toLowerCase() === toTokenAddress.toLowerCase()) {
    return;
  }

  // Try all providers and collect their swap data
  const providers = ["1inch", "0x", "paraswap"];
  const eth_price = tokenPricesMappingTable["eth"];
  const to_token_price = tokenPricesMappingTable[toTokenSymbol];
  const to_token_decimals = toTokenDecimals;
  const swapResults = await Promise.all(
    providers.map(async (provider) => {
      try {
        const swapCallData = await fetchSwapData(
          chainId,
          fromTokenAddress,
          toTokenAddress,
          amount,
          walletAddress,
          slippage,
          provider,
          fromTokenDecimals,
          toTokenDecimals,
          eth_price,
          to_token_price,
          to_token_decimals,
        );
        if (Object.values(swapCallData).length === 0) {
          return null;
        }

        if ("error" in swapCallData) {
          console.warn(`${provider} swap failed:`, swapCallData.error);
          return null;
        }
        const normalizedInputAmount = ethers.utils.formatUnits(
          amount,
          fromTokenDecimals,
        );
        const normalizedOutputAmount = ethers.utils.formatUnits(
          swapCallData["toAmount"],
          toTokenDecimals,
        );
        const inputValue =
          Number(normalizedInputAmount) * tokenPricesMappingTable[fromToken];
        const outputValue =
          Number(normalizedOutputAmount) *
          tokenPricesMappingTable[toTokenSymbol];
        const tradingLoss = outputValue - inputValue;

        const approveTxn = approve(
          fromTokenAddress,
          swapCallData["approve_to"],
          amount,
          () => {},
          chainId,
        );

        return {
          provider,
          swapData: swapCallData,
          minToAmount: swapCallData["minToAmount"],
          gasCostUSD: swapCallData["gasCostUSD"],
          tradingLoss,
          inputValue,
          normalizedInputAmount,
          normalizedOutputAmount,
          toUsd: swapCallData["toUsd"],
          transactions: [
            approveTxn,
            prepareTransaction({
              to: swapCallData["to"],
              chain: CHAIN_ID_TO_CHAIN[chainId],
              client: THIRDWEB_CLIENT,
              data: swapCallData["data"],
              extraGas: BigInt(swapCallData["gas"]),
            }),
          ],
        };
      } catch (error) {
        console.warn(`Failed to fetch swap data from ${provider}:`, error);
        return null;
      }
    }),
  );

  // Filter out failed attempts and sort by best return and gas fee
  const validSwaps = swapResults.filter((result) => result !== null);
  if (validSwaps.length === 0) {
    throw new Error(
      `No valid swap data found from any provider to swap ${
        amount / 10 ** fromTokenDecimals
      } ${fromToken} to ${toTokenSymbol}`,
    );
  }

  // New sorting logic
  let bestSwap;

  // Check if all swaps have valid toUsd values
  const allHaveValidToUsd = validSwaps.every(
    (swap) => swap.toUsd && Number(swap.toUsd) > 0,
  );

  if (allHaveValidToUsd) {
    // Sort by toUsd (descending)
    bestSwap = validSwaps.sort((a, b) => {
      return Number(b.toUsd) - Number(a.toUsd); // Higher USD value is better
    })[0];
  } else {
    // Fall back to minToAmount
    bestSwap = validSwaps.sort((a, b) => {
      const aNetValue = Number(a.minToAmount);
      const bNetValue = Number(b.minToAmount);
      return bNetValue - aNetValue; // Higher net value is better
    })[0];
  }

  // Check slippage for the best quote only
  const priceRatio =
    (bestSwap.normalizedOutputAmount * tokenPricesMappingTable[toTokenSymbol]) /
    (bestSwap.normalizedInputAmount * tokenPricesMappingTable[fromToken]);
  const priceImpactPercentage = (1 - priceRatio) * 100;
  // NOTE: because of our price timetable have a very high latency, we accept a higher price impact
  const hardcodedPriceImpactPercentage = 10;
  console.log(
    `Input amount: ${bestSwap.normalizedInputAmount} ${fromToken} (${
      bestSwap.normalizedInputAmount * tokenPricesMappingTable[fromToken]
    }) , Output amount: ${bestSwap.normalizedOutputAmount} ${toTokenSymbol} (${
      bestSwap.normalizedOutputAmount * tokenPricesMappingTable[toTokenSymbol]
    })`,
    "bestSwap",
    bestSwap.provider,
  );
  if (process.env.TEST !== "true") {
    assert(
      priceImpactPercentage <= hardcodedPriceImpactPercentage,
      `Price impact is too high to swap ${fromToken} to ${toTokenSymbol} . Price impact: ${priceImpactPercentage.toFixed(
        2,
      )}%, Max allowed: ${hardcodedPriceImpactPercentage}%`,
    );
  }
  // Update progress with final trading loss/gain
  await updateProgressAndWaitCallback(
    updateProgress,
    `${protocolUniqueId}-${fromToken}-${toTokenSymbol}-swap`,
    bestSwap.tradingLoss,
  );
  return [bestSwap.transactions, bestSwap.minToAmount];
}
export default swap;
