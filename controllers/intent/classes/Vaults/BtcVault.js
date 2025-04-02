import { BasePortfolio } from "../BasePortfolio.js";
import { BaseEquilibria } from "../Pendle/BaseEquilibria.js";
export class BtcVault extends BasePortfolio {
  constructor() {
    super(
      {
        gold: {
          arbitrum: [
            {
              interface: new BaseEquilibria(
                "arbitrum",
                42161,
                ["dwbtc", "pt dwbtc 26jun2025"],
                "single",
                {
                  assetAddress: "0x8cAB5Fd029ae2FBF28c53E965E4194C7260aDF0C",
                  symbolOfBestTokenToZapOut: "wbtc",
                  bestTokenAddressToZapOut:
                    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
                  decimalOfBestTokenToZapOut: 8,
                  pidOfEquilibria: 53,
                },
              ),
              weight: 1,
            },
            // {
            //   interface: new BaseConvex(
            //     "arbitrum",
            //     42161,
            //     ["wbtc", "tbtc"],
            //     "LP",
            //     {
            //       pid: 33,
            //       assetDecimals: 18,
            //       assetAddress: "0x186cF879186986A20aADFb7eAD50e3C20cb26CeC",
            //       protocolAddress: "0x186cF879186986A20aADFb7eAD50e3C20cb26CeC",
            //       convexRewardPool:
            //         "0xa4Ed1e1Db18d65A36B3Ef179AaFB549b45a635A4",
            //       lpTokens: [
            //         [
            //           "wbtc",
            //           "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
            //           8,
            //         ],
            //         ["tbtc", "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40", 18],
            //       ],
            //       rewards: [
            //         {
            //           symbol: "crv",
            //           coinmarketcapApiId: 6538,
            //           address: "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
            //           decimals: 18,
            //         },
            //         {
            //           symbol: "cvx",
            //           coinmarketcapApiId: 9903,
            //           address: "0xaAFcFD42c9954C6689ef1901e03db742520829c5",
            //           decimals: 18,
            //         },
            //       ],
            //     },
            //   ),
            //   weight: 0.5,
            // },
          ],
        },
      },
      {
        gold: 1,
      },
      "BTC Vault",
    );
    this.validateStrategyWeights();
  }
  denomination() {
    return "₿";
  }
}
