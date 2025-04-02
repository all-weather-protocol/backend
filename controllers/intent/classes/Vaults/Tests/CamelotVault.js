import { BasePortfolio } from "../../BasePortfolio.js";
import { BaseCamelot } from "../../camelot/BaseCamelot.js";
export class CamelotVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
            {
              interface: new BaseCamelot(
                "arbitrum",
                42161,
                ["eth", "pendle"],
                "LP",
                {
                  assetDecimals: 18,
                  assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                  // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                  protocolAddress: "0xE461f84C3fE6BCDd1162Eb0Ef4284F3bB6e4CAD3",
                  rewardPoolAddress:
                    "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                  lpTokens: [
                    [
                      "pendle",
                      "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8",
                      18,
                    ],
                    ["weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
                  ],
                  tickers: {
                    tickLower: -73500,
                    tickUpper: -60120,
                  },
                  rewards: [
                    {
                      symbol: "grail",
                      priceId: {
                        coinmarketcapApiId: 22949,
                      },
                      address: "0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8",
                      decimals: 18,
                    },
                    {
                      symbol: "xgrail",
                      priceId: {
                        coinmarketcapApiId: 22949,
                      },
                      address: "0x3caae25ee616f2c8e13c74da0813402eae3f496b",
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
                      symbol: "weth",
                      priceId: {
                        coinmarketcapApiId: 1027,
                      },
                      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      decimals: 18,
                    },
                  ],
                },
              ),
              weight: 1,
            },
          ],
        },
      },
      {
        gold: 1,
      },
      "Camelot Vault",
    );
    this.validateStrategyWeights();
  }
}
