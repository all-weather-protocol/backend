import { BaseVault } from "./BaseVault.js";
import { BaseCamelot } from "../camelot/BaseCamelot.js";
export class DeprecatedVault extends BaseVault {
  constructor() {
    const strategies = {
      large_cap_us_stocks: {
        arbitrum: [
          {
            interface: new BaseCamelot(
              "arbitrum",
              42161,
              ["tia", "eth"],
              "LP",
              {
                assetDecimals: 18,
                assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                protocolAddress: "0x1818FF61ba19C06A554C803eD98B603D5b7D1B43",
                rewardPoolAddress: "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                lpTokens: [
                  ["weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
                  ["tia", "0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C", 6],
                ],
                tickers: {
                  //   const minPrice =
                  //   1.0001 ** tickLower * 10 ** (18 * 2 - 18 - 6);
                  // const maxPrice =
                  //   1.0001 ** tickUpper * 10 ** (18 * 2 - 18 - 6);
                  // if minPirnce = 3000, then tickLower = log(3000/10^12)/log(1.0001)
                  tickLower: -228420,
                  tickUpper: -204180,
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
                    symbol: "tia",
                    priceId: {
                      coinmarketcapApiId: 22861,
                    },
                    address: "0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C",
                    decimals: 6,
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
            weight: 0.1,
          },
          {
            interface: new BaseCamelot(
              "arbitrum",
              42161,
              ["sol", "usdc"],
              "LP",
              {
                assetDecimals: 18,
                assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                protocolAddress: "0x622B5186384783BB805c12A808cCF07F41DE1Ff0",
                rewardPoolAddress: "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                lpTokens: [
                  ["sol", "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07", 9],
                  ["usdc", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6],
                ],
                tickers: {
                  //   const minPrice =
                  //   1.0001 ** tickLower * 10 ** (18 * 2 - 18 - 6);
                  // const maxPrice =
                  //   1.0001 ** tickUpper * 10 ** (18 * 2 - 18 - 6);
                  // if minPirnce = 3000, then tickLower = log(3000/10^12)/log(1.0001)
                  tickLower: -887220,
                  tickUpper: 887220,
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
                    symbol: "sol",
                    priceId: {
                      coinmarketcapApiId: 5426,
                    },
                    address: "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07",
                    decimals: 9,
                  },
                  {
                    symbol: "usdc",
                    priceId: {
                      coinmarketcapApiId: 3408,
                    },
                    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                    decimals: 6,
                  },
                ],
              },
            ),
            weight: 0.1,
          },
          {
            interface: new BaseCamelot(
              "arbitrum",
              42161,
              ["gmx", "eth"],
              "LP",
              {
                assetDecimals: 18,
                assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                protocolAddress: "0xC99be44383BC8d82357F5A1D9ae9976EE9d75bee",
                rewardPoolAddress: "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                lpTokens: [
                  ["weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
                  ["gmx", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", 18],
                ],
                tickers: {
                  //   const minPrice =
                  //   1.0001 ** tickLower * 10 ** (18 * 2 - 18 - 6);
                  // const maxPrice =
                  //   1.0001 ** tickUpper * 10 ** (18 * 2 - 18 - 6);
                  // if minPirnce = 3000, then tickLower = log(3000/10^12)/log(1.0001)
                  tickLower: -887220,
                  tickUpper: 887220,
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
                    symbol: "weth",
                    priceId: {
                      coinmarketcapApiId: 2396,
                    },
                    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    decimals: 18,
                  },
                  {
                    symbol: "gmx",
                    priceId: {
                      coinmarketcapApiId: 11857,
                    },
                    address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0.1,
          },
          {
            interface: new BaseCamelot(
              "arbitrum",
              42161,
              ["wsteth", "eth"],
              "LP",
              {
                assetDecimals: 18,
                assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                protocolAddress: "0xdEb89DE4bb6ecf5BFeD581EB049308b52d9b2Da7",
                rewardPoolAddress: "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                lpTokens: [
                  ["wsteth", "0x5979D7b546E38E414F7E9822514be443A4800529", 18],
                  ["weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
                ],
                tickers: {
                  //   const minPrice =
                  //   1.0001 ** tickLower * 10 ** (18 * 2 - 18 - 6);
                  // const maxPrice =
                  //   1.0001 ** tickUpper * 10 ** (18 * 2 - 18 - 6);
                  // if minPirnce = 3000, then tickLower = log(3000/10^12)/log(1.0001)
                  tickLower: -887220,
                  tickUpper: 887220,
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
                    symbol: "weth",
                    priceId: {
                      coinmarketcapApiId: 2396,
                    },
                    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    decimals: 18,
                  },
                  {
                    symbol: "wsteth",
                    priceId: {
                      coinmarketcapApiId: 12409,
                    },
                    address: "0x5979D7b546E38E414F7E9822514be443A4800529",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0.1,
          },
          {
            interface: new BaseCamelot(
              "arbitrum",
              42161,
              ["magic", "eth"],
              "LP",
              {
                assetDecimals: 18,
                assetAddress: "0x00c7f3082833e796a5b3e4bd59f6642ff44dcd15",
                // protocolAddress: NFT manager.factory() -> poolByPair(token0, token1)
                protocolAddress: "0x1106dB7165A8d4a8559B441eCdEe14a5d5070DbC",
                rewardPoolAddress: "0xB312638B4C0d7b49E47057ba1E4feBF4f6aC5A01",
                lpTokens: [
                  ["magic", "0x539bdE0d7Dbd336b79148AA742883198BBF60342", 18],
                  ["weth", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
                ],
                tickers: {
                  //   const minPrice =
                  //   1.0001 ** tickLower * 10 ** (18 * 2 - 18 - 6);
                  // const maxPrice =
                  //   1.0001 ** tickUpper * 10 ** (18 * 2 - 18 - 6);
                  // if minPirnce = 3000, then tickLower = log(3000/10^12)/log(1.0001)
                  tickLower: -887220,
                  tickUpper: 887220,
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
                    symbol: "weth",
                    priceId: {
                      coinmarketcapApiId: 2396,
                    },
                    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    decimals: 18,
                  },
                  {
                    symbol: "magic",
                    priceId: {
                      coinmarketcapApiId: 14783,
                    },
                    address: "0x539bdE0d7Dbd336b79148AA742883198BBF60342",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0.1,
          },
        ],
      },
    };
    const weightMapping = {
      large_cap_us_stocks: 1,
    };
    super(strategies, weightMapping, "Deprecated Vault");
  }
}
