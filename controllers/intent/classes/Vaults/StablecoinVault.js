import { BaseApolloX } from "../ApolloX/BaseApolloX.js";
import { Vela } from "../Vela/Vela.js";
import { BaseConvex } from "../Convex/BaseConvex.js";
import { BaseEquilibria } from "../Pendle/BaseEquilibria.js";
import { BaseMoonwell } from "../Moonwell/BaseMoonwell.js";
import { BaseAave } from "../Aave/BaseAave.js";
import { BaseAura } from "../Aura/BaseAura.js";
import { BaseVelodrome } from "../Velodrome/BaseVelodrome.js";
import { BaseVault } from "./BaseVault.js";
import { Venus } from "../Venus/Venus.js";
export class StablecoinVault extends BaseVault {
  constructor() {
    const strategies = {
      gold: {
        arbitrum: [
          {
            interface: new BaseApolloX(
              "arbitrum",
              42161,
              ["btc", "dai", "eth", "usdc(bridged)", "usdt"],
              "single",
              {},
            ),
            weight: 0.7,
          },
          {
            interface: new Vela(
              "arbitrum",
              42161,
              ["usdc(bridged)"],
              "single",
              {},
            ),
            weight: 0,
          },
          {
            interface: new BaseEquilibria(
              "arbitrum",
              42161,
              ["dai", "pt gdai 27mar2025"],
              "single",
              {
                assetAddress: "0xA9104b8B6698979568852C30231871e28A482b3C",
                symbolOfBestTokenToZapOut: "gdai",
                bestTokenAddressToZapOut:
                  "0xd85E038593d7A098614721EaE955EC2022B9B91B",
                decimalOfBestTokenToZapOut: 18,
                pidOfEquilibria: 48,
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseEquilibria(
              "arbitrum",
              42161,
              ["usdc", "pt gusdc 26dec2024"],
              "single",
              {
                assetAddress: "0xa877a0E177b54A37066c1786F91a1DAb68F094AF",
                symbolOfBestTokenToZapOut: "gusdc",
                bestTokenAddressToZapOut:
                  "0xd3443ee1e91af28e5fb858fbd0d72a63ba8046e0",
                decimalOfBestTokenToZapOut: 6,
                pidOfEquilibria: 45,
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseEquilibria(
              "arbitrum",
              42161,
              ["usdc", "pt gusdc 26jun2025"],
              "single",
              {
                assetAddress: "0x22e0F26320aCE985e3CB2434095F18Bfe114E28e",
                symbolOfBestTokenToZapOut: "gusdc",
                bestTokenAddressToZapOut:
                  "0xd3443ee1e91af28e5fb858fbd0d72a63ba8046e0",
                decimalOfBestTokenToZapOut: 6,
                pidOfEquilibria: 59,
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseEquilibria(
              "arbitrum",
              42161,
              ["usdc", "pt dusdc 26jun2025"],
              "single",
              {
                assetAddress: "0x0bD6890b3Bb15f16430546147734b254d0B03059",
                symbolOfBestTokenToZapOut: "dusdc",
                bestTokenAddressToZapOut:
                  "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
                decimalOfBestTokenToZapOut: 6,
                pidOfEquilibria: 52,
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseEquilibria(
              "arbitrum",
              42161,
              ["ausdc", "pt ausdc 26dec2024"],
              "single",
              {
                assetAddress: "0x875F154f4eC93255bEAEA9367c3AdF71Cdcb4Cc0",
                symbolOfBestTokenToZapOut: "ausdc",
                bestTokenAddressToZapOut:
                  "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
                decimalOfBestTokenToZapOut: 6,
                pidOfEquilibria: 43,
              },
            ),
            weight: 0,
          },
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
                convexRewardPool: "0xe062e302091f44d7483d9D6e0Da9881a0817E2be",
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
            weight: 0,
          },
          {
            interface: new BaseAura(
              "arbitrum",
              42161,
              ["wausdcn", "gho"],
              "LP",
              {
                pid: 69,
                // poolId: asset.getPoolId()
                assetAddress: "0x46472CBA35E6800012aA9fcC7939Ff07478C473E",
                assetDecimals: 18,
                poolId:
                  "0x46472cba35e6800012aa9fcc7939ff07478c473e00020000000000000000056c",
                lpTokens: [
                  ["wausdcn", "0x7CFaDFD5645B50bE87d546f42699d863648251ad", 6],
                  ["gho", "0x7dfF72693f6A4149b17e7C6314655f6A9F7c8B33", 18],
                ],
                originalRewards: [
                  {
                    symbol: "bal",
                    priceId: {
                      coinmarketcapApiId: 5728,
                    },
                    address: "0x040d1edc9569d4bab2d15287dc5a4f10f56a56b8",
                    decimals: 18,
                  },
                ],
                rewards: [
                  {
                    symbol: "aura",
                    priceId: {
                      coinmarketcapApiId: 21532,
                    },
                    address: "0x1509706a6c66ca549ff0cb464de88231ddbe213b",
                    stashAddress: "0xDfb793eE33AF74ad17E86B337b5996e75bf16cfd",
                    decimals: 18,
                  },
                  {
                    symbol: "gho",
                    priceId: {
                      coinmarketcapApiId: 23508,
                    },
                    address: "0x7dff72693f6a4149b17e7c6314655f6a9f7c8b33",
                    stashAddress: "0x3ABC7f66972C06eBa17Bf5fbd4C78076c3fd5E16",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseAura(
              "arbitrum",
              42161,
              ["susdx", "usdx"],
              "LP",
              {
                pid: 93,
                // poolId: asset.getPoolId()
                assetAddress: "0xb3047330c1cb5eb1a3670fabfb99bdc106d631eb",
                assetDecimals: 18,
                poolId:
                  "0xb3047330c1cb5eb1a3670fabfb99bdc106d631eb0000000000000000000005e4",
                lpTokens: [
                  ["susdx", "0x7788a3538c5fc7f9c7c8a74eac4c898fc8d87d92", 18],
                  ["usdx", "0xf3527ef8de265eaa3716fb312c12847bfba66cef", 18],
                ],
                originalRewards: [],
                rewards: [
                  {
                    symbol: "aura",
                    priceId: {
                      coinmarketcapApiId: 21532,
                    },
                    address: "0x1509706a6c66ca549ff0cb464de88231ddbe213b",
                    stashAddress: "0xDfb793eE33AF74ad17E86B337b5996e75bf16cfd",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0,
          },
          {
            interface: new BaseAura("arbitrum", 42161, ["usdx", "usdt"], "LP", {
              pid: 94,
              assetAddress: "0x85564af67760063b994599b640552614238c9ee6",
              assetDecimals: 18,
              poolId:
                "0x85564af67760063b994599b640552614238c9ee60000000000000000000005e3",
              lpTokens: [
                ["usdx", "0xf3527ef8de265eaa3716fb312c12847bfba66cef", 18],
                ["usdt", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", 6],
              ],
              originalRewards: [
                {
                  symbol: "bal",
                  priceId: {
                    coinmarketcapApiId: 5728,
                  },
                  address: "0x040d1edc9569d4bab2d15287dc5a4f10f56a56b8",
                  decimals: 18,
                },
              ],
              rewards: [
                {
                  symbol: "aura",
                  priceId: {
                    coinmarketcapApiId: 21532,
                  },
                  address: "0x1509706a6c66ca549ff0cb464de88231ddbe213b",
                  stashAddress: "0xDfb793eE33AF74ad17E86B337b5996e75bf16cfd",
                  decimals: 18,
                },
              ],
            }),
            weight: 0,
          },
          {
            interface: new BaseConvex(
              "arbitrum",
              42161,
              ["eusd", "usdc"],
              "LP",
              {
                pid: 36,
                assetDecimals: 18,
                assetAddress: "0x93a416206B4ae3204cFE539edfeE6BC05a62963e",
                protocolAddress: "0x93a416206B4ae3204cFE539edfeE6BC05a62963e",
                convexRewardPool: "0xD4f9bCc2e0e920e23763FA8e37eCbC4135959dB4",
                lpTokens: [
                  ["eusd", "0x12275DCB9048680c4Be40942eA4D92c74C63b844", 18],
                  ["usdc", "0xaf88d065e77c8cc2239327c5edb3a432268e5831", 6],
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
                  {
                    symbol: "arb",
                    priceId: {
                      coinmarketcapApiId: 11841,
                    },
                    address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0,
          },
          {
            interface: new Venus("arbitrum", 42161, ["usdc"], "single", {
              symbolOfBestTokenToZapInOut: "usdc",
              zapInOutTokenAddress:
                "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              assetAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              protocolAddress: "0x7d8609f8da70ff9027e9bc5229af4f6727662707",
              assetDecimals: 6,
            }),
            weight: 0,
          },
        ],

        base: [
          {
            interface: new BaseAave("base", 8453, ["usdc"], "single", {
              symbolOfBestTokenToZapInOut: "usdc",
              zapInOutTokenAddress:
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              assetAddress: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
              protocolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
              assetDecimals: 6,
            }),
            weight: 0,
          },
          {
            interface: new BaseMoonwell("base", 8453, ["eurc"], "single", {
              symbolOfBestTokenToZapInOut: "eurc",
              zapInOutTokenAddress:
                "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
              decimalsOfZapInOutToken: 6,
              assetAddress: "0xb682c840B5F4FC58B20769E691A6fa1305A501a2",
              protocolAddress: "0xb682c840B5F4FC58B20769E691A6fa1305A501a2",
              assetDecimals: 8,
            }),
            weight: 0,
          },
          {
            interface: new BaseMoonwell("base", 8453, ["dai"], "single", {
              symbolOfBestTokenToZapInOut: "dai",
              zapInOutTokenAddress:
                "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
              decimalsOfZapInOutToken: 18,
              assetAddress: "0x73b06D8d18De422E269645eaCe15400DE7462417",
              protocolAddress: "0x73b06D8d18De422E269645eaCe15400DE7462417",
              assetDecimals: 8,
            }),
            weight: 0,
          },
          {
            interface: new BaseMoonwell("base", 8453, ["usdc"], "single", {
              symbolOfBestTokenToZapInOut: "usdc",
              zapInOutTokenAddress:
                "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              decimalsOfZapInOutToken: 6,
              assetAddress: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
              protocolAddress: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
              assetDecimals: 8,
            }),
            weight: 0,
          },
          {
            interface: new BaseVelodrome(
              "base",
              8453,
              ["msusd", "usdc"],
              "LP",
              {
                protocolName: "aerodrome",
                protocolVersion: "0",
                assetAddress: "0xcEFC8B799a8EE5D9b312aeca73262645D664AaF7",
                assetDecimals: 18,
                routerAddress: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
                guageAddress: "0xDBF852464fC906C744E52Dbd68C1b07dD33A922a",
                lpTokens: [
                  ["msusd", "0x526728DBc96689597F85ae4cd716d4f7fCcBAE9d", 18],
                  ["usdc", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6],
                ],
                rewards: [
                  {
                    symbol: "aero",
                    priceId: {
                      coinmarketcapApiId: 29270,
                    },
                    address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
                    decimals: 18,
                  },
                ],
              },
            ),
            weight: 0.1,
          },
          {
            interface: new BaseEquilibria(
              "base",
              8453,
              ["susdz", "pt susdz 27mar2025"],
              "single",
              {
                assetAddress: "0x14936C9B8eb798cA6291c2d6CE5de2c6cB5f1f9C",
                symbolOfBestTokenToZapOut: "usdc",
                bestTokenAddressToZapOut:
                  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
                decimalOfBestTokenToZapOut: 6,
                pidOfEquilibria: 5,
              },
            ),
            weight: 0,
          },
        ],
        op: [
          {
            interface: new BaseVelodrome("op", 10, ["usdc", "susd"], "LP", {
              protocolName: "velodrome",
              protocolVersion: "v2",
              assetAddress: "0xbC26519f936A90E78fe2C9aA2A03CC208f041234",
              assetDecimals: 18,
              routerAddress: "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858",
              guageAddress: "0x0E4c56B4a766968b12c286f67aE341b11eDD8b8d",
              lpTokens: [
                ["usdc", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6],
                ["susd", "0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9", 18],
              ],
              rewards: [
                {
                  symbol: "velo",
                  priceId: {
                    coinmarketcapApiId: 20435,
                  },
                  address: "0x9560e827af36c94d2ac33a39bce1fe78631088db",
                  decimals: 18,
                },
              ],
            }),
            weight: 0,
          },
          {
            interface: new BaseVelodrome("op", 10, ["usdc", "msusd"], "LP", {
              protocolName: "velodrome",
              protocolVersion: "v2",
              assetAddress: "0xe148D6Ae042De77c1f9fe0d6c495EbfD7b705B4c",
              assetDecimals: 18,
              routerAddress: "0xa062aE8A9c5e11aaA026fc2670B0D65cCc8B2858",
              guageAddress: "0xf9ddd38A4e0C3237563DBB651D1a155551e54ad6",
              lpTokens: [
                ["usdc", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", 6],
                ["msusd", "0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0", 18],
              ],
              rewards: [
                {
                  symbol: "velo",
                  priceId: {
                    coinmarketcapApiId: 20435,
                  },
                  address: "0x9560e827af36c94d2ac33a39bce1fe78631088db",
                  decimals: 18,
                },
              ],
            }),
            weight: 0.1,
          },
        ],
      },
    };
    const weightMapping = {
      gold: 1,
    };
    super(strategies, weightMapping, "Stable+ Vault");
  }
}