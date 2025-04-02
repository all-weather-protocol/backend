import { StablecoinVault } from "./classes/Vaults/StablecoinVault.js";
import { EthVault } from "./classes/Vaults/EthVault.js";
import { BtcVault } from "./classes/Vaults/BtcVault.js";
import { ConvexStablecoinVault } from "./classes/Vaults/Tests/ConvexStablecoinVault.js";
import { EquilibriaETHVault } from "./classes/Vaults/Tests/EquilibriaETHVault.js";
import { MoonwellStablecoinVault } from "./classes/Vaults/Tests/MoonwellStablecoinVault.js";
import { AllWeatherVault } from "./classes/Vaults/AllWeatherVault.js";
import { MetisVault } from "./classes/Vaults/MetisVault.js";
import { CamelotVault } from "./classes/Vaults/Tests/CamelotVault.js";
import { AerodromeVault } from "./classes/Vaults/Tests/AerodromeVault.js";
import { VenusStablecoinVault } from "./classes/Vaults/Tests/VenusVault.js";
import { DeprecatedVault } from "./classes/Vaults/DeprecatedVault.js";
export function getPortfolioHelper(
  portfolioName,
) {
  let portfolioHelper;
  if (portfolioName === "Stable+ Vault") {
    portfolioHelper = new StablecoinVault();
  } else if (portfolioName === "ETH Vault") {
    portfolioHelper = new EthVault();
  } else if (portfolioName === "Metis Vault") {
    portfolioHelper = new MetisVault();
  } else if (portfolioName === "BTC Vault") {
    portfolioHelper = new BtcVault();
  } else if (portfolioName === "Equilibria ETH Vault") {
    // for testing
    portfolioHelper = new EquilibriaETHVault();
  } else if (portfolioName === "Convex Stablecoin Vault") {
    // for testing
    portfolioHelper = new ConvexStablecoinVault();
  } else if (portfolioName === "Moonwell Stablecoin Vault") {
    // for testing
    portfolioHelper = new MoonwellStablecoinVault();
  } else if (portfolioName === "All Weather Vault") {
    portfolioHelper = new AllWeatherVault();
  } else if (portfolioName === "Camelot Vault") {
    portfolioHelper = new CamelotVault();
  } else if (portfolioName === "Aerodrome Vault") {
    portfolioHelper = new AerodromeVault();
  } else if (portfolioName === "Venus Stablecoin Vault") {
    portfolioHelper = new VenusStablecoinVault();
  } else if (portfolioName === "Deprecated Vault") {
    portfolioHelper = new DeprecatedVault();
  } else {
    return;
  }
  return portfolioHelper;
}
