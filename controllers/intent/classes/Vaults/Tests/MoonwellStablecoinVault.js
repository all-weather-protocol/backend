import { BasePortfolio } from "../../BasePortfolio.js";
import { BaseMoonwell } from "../../Moonwell/BaseMoonwell.js";
export class MoonwellStablecoinVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          base: [
            {
              interface: new BaseMoonwell("base", 8453, ["usdc"], "single", {
                symbolOfBestTokenToZapInOut: "usdc",
                zapInOutTokenAddress:
                  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                decimalsOfZapInOutToken: 18,
                assetAddress: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
                protocolAddress: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
                assetDecimals: 8,
              }),
              weight: 1,
            },
          ],
        },
      },
      {
        gold: 1,
      },
      "Moonwell Stablecoin Vault",
    );
    this.validateStrategyWeights();
  }
}
