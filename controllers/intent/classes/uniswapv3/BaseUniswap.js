// Use Python to calculate upper/lower price back to tick
// Price = token0 / token1, and then calculate your upper price and lower price.
// ```
// import math
// math.log(upper price / (10 ** (18*2 - decimal of token0 - decimal of token 1)), 1.0001)
// ```
import assert from "assert";
import { ethers } from "ethers";

class BaseUniswap {
  calculateUniswapV3LP(
    depositAmountUSD,
    priceUSDX,
    priceUSDY,
    P,
    Pl,
    Pu,
    token0Price,
    token1Price,
    token0Decimals,
    token1Decimals,
  ) {
    // GPT: https://chatgpt.com/c/67a5ba5e-543c-8005-b3ea-5af487c58b4c
    // whitepaper: https://app.uniswap.org/whitepaper-v3.pdf

    // priceUSDX: token0
    // priceUSDY: token1
    // P: current price (token1/token0)
    // Pl: lower price bound
    // Pu: upper price bound
    // Formula: ΔX⋅priceUSDX+ΔY⋅priceUSDY=depositAmountUSD
    // ΔX = ΔL * (1/sqrt(P) - 1/sqrt(Pu)) (6.29)
    // ΔY = ΔL * (sqrt(P) - sqrt(Pl)) (6.30)
    // what we really want to know is ΔX and ΔY
    // so we can replace ΔX and ΔY in the formula with ΔL
    // ΔL * (1/sqrt(P) - 1/sqrt(Pu)) * priceUSDX + ΔL * (sqrt(P) - sqrt(Pl)) * priceUSDY = depositAmountUSD
    // then we can solve for ΔL
    // ΔL = depositAmountUSD / ((sqrt(P) - sqrt(Pl)) * priceUSDY + (1/sqrt(P) - 1/sqrt(Pu)) * priceUSDX)
    // finally, we can solve for ΔX and ΔY
    const deltaL =
      depositAmountUSD /
      ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY +
        (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX);
    const deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl));
    const deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu));
    return [
      ethers.utils.parseUnits(
        String(BigInt(Math.floor(deltaX * token0Price))),
        token0Decimals,
      ),
      ethers.utils.parseUnits(
        String(BigInt(Math.floor(deltaY * token1Price))),
        token1Decimals,
      ),
    ];
  }
  _calculateTokenAmountsForUniswapV3LP(
    tokenMetadatas,
    tickers,
    tokenPricesMappingTable,
  ) {
    // P = token0 / token1
    const placeholderDepositAmount = 1000;
    const { tickLower, tickUpper } = tickers;
    const [
      [token0Symbol, token0Address, token0Decimals],
      [token1Symbol, token1Address, token1Decimals],
    ] = tokenMetadatas;
    const P =
      tokenPricesMappingTable[token0Symbol] /
      tokenPricesMappingTable[token1Symbol];
    const priceUSDX = tokenPricesMappingTable[token0Symbol];
    const priceUSDY = tokenPricesMappingTable[token1Symbol];
    const minPrice =
      1.0001 ** tickLower * 10 ** (18 * 2 - token0Decimals - token1Decimals);
    const maxPrice =
      1.0001 ** tickUpper * 10 ** (18 * 2 - token0Decimals - token1Decimals);
    const currentPrice =
      tokenPricesMappingTable[token0Symbol] /
        tokenPricesMappingTable[token1Symbol] >
        minPrice &&
      tokenPricesMappingTable[token0Symbol] /
        tokenPricesMappingTable[token1Symbol] <
        maxPrice
        ? tokenPricesMappingTable[token0Symbol] /
          tokenPricesMappingTable[token1Symbol]
        : tokenPricesMappingTable[token1Symbol] /
          tokenPricesMappingTable[token0Symbol];
    assert(currentPrice > minPrice);
    assert(currentPrice < maxPrice);

    const deltaL =
      placeholderDepositAmount /
      ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY +
        (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX);
    const deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl));
    const deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu));
    const swapAmountFromInputToToken0 =
      (tokenPricesMappingTable[token0Symbol] * deltaX) /
      tokenPricesMappingTable[inputToken];
    const swapAmountFromInputToToken1 =
      (tokenPricesMappingTable[token1Symbol] * deltaY) /
      tokenPricesMappingTable[inputToken];

    return [swapAmountFromInputToToken0, swapAmountFromInputToToken1];
  }
  async getWithdrawalAmounts(
    token_id,
    positionManager,
    poolContract,
    liquidityToRemove,
  ) {
    const position = await positionManager.positions(token_id);
    const { tickLower, tickUpper, liquidity } = position;
    if (liquidity.toString() === "0") {
      return {
        amount0: ethers.BigNumber.from(0),
        amount1: ethers.BigNumber.from(0),
      };
    }

    // Fetch current price from the pool
    const slot0 = await poolContract.globalState();
    const sqrtPriceX96 = slot0.price;
    // Convert price to decimal
    const P = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
    const P_upper = 1.0001 ** tickUpper;
    const P_lower = 1.0001 ** tickLower;
    // Calculate token0 and token1 amounts based on price position
    let amount0, amount1;
    if (P >= P_upper) {
      // Current price is above range
      amount0 = 0;
      amount1 = liquidityToRemove * (-Math.sqrt(P_upper) + Math.sqrt(P_lower));
    } else if (P < P_lower) {
      // Current price is below range
      amount0 =
        liquidityToRemove * (-1 / Math.sqrt(P_upper) + 1 / Math.sqrt(P_lower));
      amount1 = 0;
    } else {
      // Current price is within range
      amount0 =
        liquidityToRemove * (-1 / Math.sqrt(P_upper) + 1 / Math.sqrt(P));
      amount1 = liquidityToRemove * (Math.sqrt(P) - Math.sqrt(P_lower));
    }

    return {
      amount0: ethers.BigNumber.from(BigInt(Math.floor(amount0))),
      amount1: ethers.BigNumber.from(BigInt(Math.floor(amount1))),
    };
  }
  async getWithdrawalAmountsForUniswapV3(
    token_id,
    positionManager,
    poolContract,
    liquidityToRemove,
  ) {
    const position = await positionManager.positions(token_id);
    const { tickLower, tickUpper, liquidity } = position;
    if (liquidity.toString() === "0") {
      return {
        amount0: ethers.BigNumber.from(0),
        amount1: ethers.BigNumber.from(0),
      };
    }

    // Fetch current price from the pool
    const slot0 = await poolContract.globalState();
    const sqrtPriceX96 = slot0.price;
    // Convert price to decimal
    const P = Number(sqrtPriceX96) ** 2 / 2 ** 192;
    const P_upper = 1.0001 ** tickUpper;
    const P_lower = 1.0001 ** tickLower;
    // Calculate token0 and token1 amounts
    const amount0 =
      (liquidityToRemove * (Math.sqrt(P_upper) - Math.sqrt(P))) /
      (Math.sqrt(P) * Math.sqrt(P_upper));
    const amount1 = liquidityToRemove * (Math.sqrt(P) - Math.sqrt(P_lower));
    return {
      amount0: ethers.BigNumber.from(BigInt(Math.floor(amount0))),
      amount1: ethers.BigNumber.from(BigInt(Math.floor(amount1))),
    };
  }
  async getUncollectedFeesForUniswapV3(
    token_id,
    positionManager,
    poolContract,
  ) {
    // Fetch global fee growth
    // const feeGrowthGlobal0X128 = BigInt(2035451573126599860634365713953696819624);
    const position = await positionManager.positions(token_id);
    let fees0 = position.tokensOwed0;
    let fees1 = position.tokensOwed1;

    if (fees0 > 0n || fees1 > 0n) {
      return { fees0, fees1 }; // Return directly if unclaimed fees are already tracked
    }
    const feeGrowthGlobal0X128 =
      await poolContract.functions.totalFeeGrowth0Token();
    const feeGrowthGlobal1X128 =
      await poolContract.functions.totalFeeGrowth1Token();

    // Fetch fee growth outside the tick range

    const liquidity = position.liquidity;
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    const feeGrowthInside0LastX128 = position.feeGrowthInside0LastX128;
    const feeGrowthInside1LastX128 = position.feeGrowthInside1LastX128;

    // const feeGrowthOutsideLower0X128 = BigInt(1038699449216320604781002198732142450014)
    const lowerTicks = await poolContract.functions.ticks(tickLower);
    const feeGrowthOutsideLower0X128 = lowerTicks.outerFeeGrowth0Token;
    const feeGrowthOutsideLower1X128 = lowerTicks.outerFeeGrowth1Token;
    // const feeGrowthOutsideLower1X128 =  511396598114141877833919722086195606)
    // const feeGrowthOutsideLower1X128 =  511396598114141877833919722086195606)
    const upperTicks = await poolContract.functions.ticks(tickUpper);
    const feeGrowthOutsideUpper0X128 = upperTicks.outerFeeGrowth0Token;
    const feeGrowthOutsideUpper1X128 = upperTicks.outerFeeGrowth1Token;
    // const feeGrowthOutsideUpper0X128 = 30521569702293137486123643089129302063)
    // const feeGrowthOutsideUpper1X128 = 25634207230629328784956795027271311)

    // Compute fee growth inside tick range

    const feeGrowthInside0Current =
      feeGrowthGlobal0X128 -
      feeGrowthOutsideLower0X128 -
      feeGrowthOutsideUpper0X128;
    const feeGrowthInside1Current =
      feeGrowthGlobal1X128 -
      feeGrowthOutsideLower1X128 -
      feeGrowthOutsideUpper1X128;
    // Compute actual uncollected fees
    fees0 =
      ((feeGrowthInside0Current - feeGrowthInside0LastX128) * liquidity) /
      2 ** 128;
    fees1 =
      ((feeGrowthInside1Current - feeGrowthInside1LastX128) * liquidity) /
      2 ** 128;
    return { fees0, fees1 };
  }
  async getUncollectedFeesForCamelot(token_id, positionManager, poolContract) {
    // Fetch global fee growth
    // const feeGrowthGlobal0X128 = BigInt(2035451573126599860634365713953696819624);
    const position = await positionManager.positions(token_id);
    let fees0 = position.tokensOwed0;
    let fees1 = position.tokensOwed1;

    if (fees0 > 0n || fees1 > 0n) {
      return { fees0, fees1 }; // Return directly if unclaimed fees are already tracked
    }
    const feeGrowthGlobal0X128 =
      await poolContract.functions.totalFeeGrowth0Token();
    const feeGrowthGlobal1X128 =
      await poolContract.functions.totalFeeGrowth1Token();

    // Fetch fee growth outside the tick range

    const liquidity = position.liquidity;
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    const feeGrowthInside0LastX128 = position.feeGrowthInside0LastX128;
    const feeGrowthInside1LastX128 = position.feeGrowthInside1LastX128;

    // const feeGrowthOutsideLower0X128 = BigInt(1038699449216320604781002198732142450014)
    const lowerTicks = await poolContract.functions.ticks(tickLower);
    const feeGrowthOutsideLower0X128 = lowerTicks.outerFeeGrowth0Token;
    const feeGrowthOutsideLower1X128 = lowerTicks.outerFeeGrowth1Token;
    // const feeGrowthOutsideLower1X128 =  511396598114141877833919722086195606)
    // const feeGrowthOutsideLower1X128 =  511396598114141877833919722086195606)
    const upperTicks = await poolContract.functions.ticks(tickUpper);
    const feeGrowthOutsideUpper0X128 = upperTicks.outerFeeGrowth0Token;
    const feeGrowthOutsideUpper1X128 = upperTicks.outerFeeGrowth1Token;
    // const feeGrowthOutsideUpper0X128 = 30521569702293137486123643089129302063)
    // const feeGrowthOutsideUpper1X128 = 25634207230629328784956795027271311)

    // Compute fee growth inside tick range

    const feeGrowthInside0Current =
      feeGrowthGlobal0X128 -
      feeGrowthOutsideLower0X128 -
      feeGrowthOutsideUpper0X128;
    const feeGrowthInside1Current =
      feeGrowthGlobal1X128 -
      feeGrowthOutsideLower1X128 -
      feeGrowthOutsideUpper1X128;
    // Compute actual uncollected fees
    fees0 =
      ((feeGrowthInside0Current - feeGrowthInside0LastX128) * liquidity) /
      2 ** 128;
    fees1 =
      ((feeGrowthInside1Current - feeGrowthInside1LastX128) * liquidity) /
      2 ** 128;
    return { fees0, fees1 };
  }
  async getNFTValue(
    tokenId,
    poolContract,
    positionManager,
    tokenPricesMappingTable,
    token0Symbol,
    token1Symbol,
    token0Decimals,
    token1Decimals,
  ) {
    let position;
    try {
      position = await positionManager.positions(tokenId);
    } catch (error) {
      // it means the NFT has been burned
      return undefined;
    }
    const { tickLower, tickUpper, liquidity, tokensOwed0, tokensOwed1 } =
      position;
    // Fetch current price from the pool
    const slot0 = await poolContract.globalState();
    const sqrtPriceX96 = slot0.price;
    // Convert price to decimal
    const P = Number(sqrtPriceX96) ** 2 / 2 ** 192;
    const P_upper = 1.0001 ** tickUpper;
    const P_lower = 1.0001 ** tickLower;
    // Calculate token0 and token1 amounts
    const amount0 =
      (liquidity * (Math.sqrt(P_upper) - Math.sqrt(P))) /
      (Math.sqrt(P) * Math.sqrt(P_upper));
    const amount1 = liquidity * (Math.sqrt(P) - Math.sqrt(P_lower));
    // Fetch token prices from Chainlink or Uniswap
    const priceToken0 = tokenPricesMappingTable[token0Symbol];
    const priceToken1 = tokenPricesMappingTable[token1Symbol];
    // Convert to USD
    const valueToken0 = (amount0 / 10 ** token0Decimals) * priceToken0;
    const valueToken1 = (amount1 / 10 ** token1Decimals) * priceToken1;

    const tokensOwed0Value = (tokensOwed0 / 10 ** token0Decimals) * priceToken0;
    const tokensOwed1Value = (tokensOwed1 / 10 ** token1Decimals) * priceToken1;
    return tokensOwed0Value + tokensOwed1Value + valueToken0 + valueToken1;
  }
  getPositionKey(owner, tickLower, tickUpper) {
    return ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["address", "int24", "int24"],
        [owner, tickLower, tickUpper],
      ),
    );
  }
}

export default BaseUniswap;
