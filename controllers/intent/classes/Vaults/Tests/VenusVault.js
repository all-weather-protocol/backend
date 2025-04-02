import { BasePortfolio } from "../../BasePortfolio.js";
import { Venus } from "../../Venus/Venus.js";

export class VenusStablecoinVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
            {
              interface: new Venus("arbitrum", 42161, ["usdc"], "single", {
                symbolOfBestTokenToZapInOut: "usdc",
                zapInOutTokenAddress:
                  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                assetAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                protocolAddress: "0x7d8609f8da70ff9027e9bc5229af4f6727662707",
                assetDecimals: 6,
              }),
              weight: 1,
            },
          ],
        },
      },
      {
        gold: 1,
      },
      "Venus Stablecoin Vault",
    );
    this.validateStrategyWeights();
  }
}
