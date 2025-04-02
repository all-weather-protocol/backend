import { BasePortfolio } from "../BasePortfolio.js";
import { BaseAave } from "../Aave/BaseAave.js";
export class MetisVault extends BasePortfolio {
  constructor() {
    super(
      {
        gold: {
          metis: [
            {
              interface: new BaseAave("metis", 1088, ["metis"], "single", {
                symbolOfBestTokenToZapInOut: "metis",
                zapInOutTokenAddress:
                  "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000",
                assetAddress: "0x7314ef2ca509490f65f52cc8fc9e0675c66390b8",
                protocolAddress: "0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57",
                assetDecimals: 18,
              }),
              weight: 1,
            },
          ],
        },
      },
      {
        gold: 1,
      },
      "Metis Vault",
    );
    this.validateStrategyWeights();
  }
  denomination() {
    return "$";
  }
}
