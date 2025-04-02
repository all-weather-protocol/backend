import { BasePortfolio } from "../../BasePortfolio.js";
import { BaseAerodrome } from "../../Aerodrome/BaseAerodrome.js";
export class AerodromeVault extends BasePortfolio {
  constructor() {
    super(
      {
        long_term_bond: {
          base: [
            {
              interface: new BaseAerodrome(
                "base",
                8453,
                ["msusd", "usdc"],
                "LP",
                {
                  assetAddress: "0xcEFC8B799a8EE5D9b312aeca73262645D664AaF7",
                  assetDecimals: 18,
                  guageAddress: "0xDBF852464fC906C744E52Dbd68C1b07dD33A922a",
                  lpTokens: [
                    ["msusd", "0x526728DBc96689597F85ae4cd716d4f7fCcBAE9d", 18],
                    ["usdc", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6],
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
      "Aerodrome Vault",
    );
    this.validateStrategyWeights();
  }
}
