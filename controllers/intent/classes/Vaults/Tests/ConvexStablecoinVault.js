import { BasePortfolio } from "../../BasePortfolio.js";
import { BaseConvex } from "../../Convex/BaseConvex.js";
export class ConvexStablecoinVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
            {
              interface: new BaseConvex(
                "arbitrum",
                42161,
                ["usde", "usdx"],
                "LP",
                {
                  pid: 34,
                  assetDecimals: 18,
                  assetAddress: "0x096A8865367686290639bc50bF8D85C0110d9Fea",
                  protocolAddress: "0x096A8865367686290639bc50bF8D85C0110d9Fea",
                  convexRewardPool:
                    "0xe062e302091f44d7483d9D6e0Da9881a0817E2be",
                  lpTokens: [
                    ["usde", "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", 18],
                    ["susd", "0xb2f30a7c980f052f02563fb518dcc39e6bf38175", 18],
                  ],
                  rewards: [
                    {
                      symbol: "crv",
                      priceId: {
                        coinmarketcapApiId: 6538,
                      },
                      address: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
                      decimals: 18,
                    },
                    {
                      symbol: "cvx",
                      priceId: {
                        coinmarketcapApiId: 9903,
                      },
                      address: "0xaAFcFD42c9954C6689ef1901e03db742520829c5",
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
        long_term_bond: 1,
      },
      "Convex Stablecoin Vault",
    );
    this.validateStrategyWeights();
  }
}
