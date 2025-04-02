import { portfolioVaults } from "./oneInch.js";
import axios from "axios";
const API_URL = process.env.NEXT_PUBLIC_API_URL;
export const tokensAndCoinmarketcapIdsFromDropdownOptions = {
  usdc: {
    coinmarketcapApiId: 3408,
    vaults: [
      "Stable+ Vault",
      "Aerodrome Vault",
      "All Weather Vault",
      "Vela Vault (Deprecated)",
    ],
  },
  usdt: {
    coinmarketcapApiId: 825,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  "usdc.e": {
    coinmarketcapApiId: 3408,
    vaults: ["Stable+ Vault", "All Weather Vault", "Vela Vault (Deprecated)"],
  },
  weth: {
    coinmarketcapApiId: 2396,
    vaults: [
      "Stable+ Vault",
      "All Weather Vault",
      "ETH Vault",
      "Camelot Vault",
      "Yearn Vault",
      "Stable+ Vault",
    ],
  },
  eth: {
    coinmarketcapApiId: 2396,
    vaults: [
      "Stable+ Vault",
      "All Weather Vault",
      "ETH Vault",
      "Camelot Vault",
      "Yearn Vault",
      "Stable+ Vault",
      "Camelot Vault",
      "Aerodrome Vault",
      "Convex Stablecoin Vault",
    ],
  },
  dai: {
    coinmarketcapApiId: 4943,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  usde: {
    coinmarketcapApiId: 29470,
    vaults: ["Stable+ Vault", "Convex Stablecoin Vault", "All Weather Vault"],
  },
  wbtc: {
    coinmarketcapApiId: 3717,
    vaults: ["BTC Vault"],
  },
  eurc: {
    coinmarketcapApiId: 20641,
    vaults: ["Stable+ Vault", "Moonwell Vault", "All Weather Vault"],
  },
  bal: {
    coinmarketcapApiId: 5728,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  mseth: {
    geckoterminal: {
      chain: "base",
      address: "0x7Ba6F01772924a82D9626c126347A28299E98c98",
    },
    vaults: ["ETH Vault"],
  },
  zuneth: {
    coinmarketcapApiId: 2396,
    vaults: ["ETH Vault"],
  },
  metis: {
    coinmarketcapApiId: 9640,
    vaults: ["Metis Vault"],
  },
  susd: {
    geckoterminal: {
      chain: "arbitrum",
      address: "0xb2f30a7c980f052f02563fb518dcc39e6bf38175",
    },
    vaults: ["Stable+ Vault", "Convex Stablecoin Vault", "All Weather Vault"],
  },
  msusd: {
    geckoterminal: {
      chain: "base",
      address: "0x526728DBc96689597F85ae4cd716d4f7fCcBAE9d",
    },
    vaults: ["Stable+ Vault", "Aerodrome Vault", "All Weather Vault"],
  },
  eusd: {
    geckoterminal: {
      chain: "arbitrum",
      address: "0x12275DCB9048680c4Be40942eA4D92c74C63b844",
    },
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  gusdc: {
    geckoterminal: {
      chain: "arbitrum",
      address: "0xd3443ee1e91aF28e5FB858Fbd0D72A63bA8046E0",
    },
    vaults: ["Stable+ Vault", "Equilibria Vault", "All Weather Vault"],
  },
  dusdc: {
    coinmarketcapApiId: 3408,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  usdx: {
    coinmarketcapApiId: 34060,
    vaults: ["Stable+ Vault", "Convex Stablecoin Vault", "All Weather Vault"],
  },
  susdx: {
    coinmarketcapApiId: 34088,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  gho: {
    coinmarketcapApiId: 23508,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  gyd: {
    coinmarketcapApiId: 31996,
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  wausdcn: {
    geckoterminal: {
      chain: "arbitrum",
      address: "0xca8ecd05a289b1fbc2e0eaec07360c4bfec07b61",
    },
    vaults: ["Stable+ Vault", "All Weather Vault"],
  },
  wsteth: {
    coinmarketcapApiId: 12409,
    vaults: ["All Weather Vault"],
  },
  pendle: {
    coinmarketcapApiId: 9481,
    vaults: [
      "All Weather Vault",
      "ETH Vault",
      "Stable+ Vault",
      "Camelot Vault",
    ],
  },
  link: {
    coinmarketcapApiId: 1975,
    vaults: ["All Weather Vault"],
  },
  sol: {
    coinmarketcapApiId: 5426,
    vaults: ["All Weather Vault"],
  },
  gmx: {
    coinmarketcapApiId: 11857,
    vaults: ["All Weather Vault"],
  },
  magic: {
    coinmarketcapApiId: 14783,
    vaults: ["All Weather Vault"],
  },
};
export const tokensForDropDown = [
  "eth",
  "usdc",
  "usdc.e",
  "usdt",
  "dai",
  // "wbtc",
  "weth",
  "metis",
  // "frax",
  // "wsteth",
  // "usds",
  // "eura",
  // "usd+",
  // "reth",
  // "pendle",
  // "ezeth",
  // "cbeth",
  // "lusd",
  // "susd",
  // "euroe",
  // "axlusdc",
];

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshTVLData(messageApi) {
  await axios
    .get(
      `${API_URL}/addresses?addresses=${portfolioVaults.join(
        "+",
      )}&refresh=True&worksheet=bsc_contract`,
    )
    .catch((error) =>
      messageApi.error({
        content: `${error.shortMessage}. Please report this issue to our Discord.`,
        duration: 5,
      }),
    );
}

export const chainIDToName = (chainID) => {
  switch (chainID) {
    case 56:
      return "bsc";
    case 42161:
      return "arb";
    case 1:
      return "eth";
    default:
      throw new Error("Unsupported Chain");
  }
};
