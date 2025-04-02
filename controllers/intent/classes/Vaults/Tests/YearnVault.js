import { BasePortfolio } from "../../BasePortfolio.js";
import { YearnV3Vault } from "../../Yearn/YearnV3Vault.js";
export class YearnVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          arbitrum: [
            {
              interface: new YearnV3Vault(
                "arbitrum",
                42161,
                ["eth"],
                "single",
                {},
              ),
              weight: 1,
            },
          ],
        },
      },
      {
        long_term_bond: 1,
      },
      "Yearn Vault",
    );
    this.validateStrategyWeights();
  }
}
