import { readFileSync } from 'fs';
import { ethers } from "ethers";
import { arbitrum, base, optimism, bsc, polygon } from "thirdweb/chains";
const ERC20_ABI = JSON.parse(readFileSync('./utils/ABI/ERC20.json', 'utf8'));
import { prepareContractCall, getContract, defineChain } from "thirdweb";
import THIRDWEB_CLIENT from "./thirdweb.js";
export const CHAIN_ID_TO_CHAIN = {
  8453: base,
  42161: arbitrum,
  10: optimism,
  56: bsc,
  137: polygon,
  1088: defineChain(1088),
};
export const CHAIN_TO_CHAIN_ID = {
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  op: 10,
  "op mainnet": 10,
  bsc: 56,
  polygon: 137,
  mantle: 5000,
  metis: 1088,
};
// reverse CHAIN_TO_CHAIN_ID
export const CHAIN_ID_TO_CHAIN_STRING = Object.fromEntries(
  Object.entries(CHAIN_TO_CHAIN_ID).map(([key, value]) => [value, key]),
);
export const TOKEN_ADDRESS_MAP = {
  usdc: {
    arbitrum: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "op mainnet": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    op: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
  "usdc.e": {
    arbitrum: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "op mainnet": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    op: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
  },
  dai: {
    arbitrum: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    base: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    "op mainnet": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    op: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  },
  weth: {
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    base: "0x4200000000000000000000000000000000000006",
    "op mainnet": "0x4200000000000000000000000000000000000006",
    op: "0x4200000000000000000000000000000000000006",
  },
  usdt: {
    arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    base: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    "op mainnet": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    op: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
};
export const PROVIDER = (chain) => {
  // Use a predefined mapping of chains to their RPC provider URLs
  const rpcProviders = {
    arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC_PROVIDER_URL,
    "arbitrum one": process.env.NEXT_PUBLIC_ARBITRUM_RPC_PROVIDER_URL,
    base: process.env.NEXT_PUBLIC_BASE_RPC_PROVIDER_URL,
    optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC_PROVIDER_URL,
    op: process.env.NEXT_PUBLIC_OPTIMISM_RPC_PROVIDER_URL,
    "op mainnet": process.env.NEXT_PUBLIC_OPTIMISM_RPC_PROVIDER_URL,
    metis: "https://metis-rpc.publicnode.com",
    // Add other chains as needed
  };
  const providerUrl = rpcProviders[chain.toLowerCase()];
  if (!providerUrl) {
    console.warn(
      `Warning: No RPC provider URL found for chain: ${chain}, need to update PROVIDER in general.js`,
    );
  }

  return new ethers.providers.JsonRpcProvider(providerUrl);
};
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export function timeAgo(dateString) {
  // // 08/10/2024 21:09:57
  // 11/03/2024 20:24:15

  const [datePart, timePart] = dateString.split(" ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  const now = new Date();

  const diffInMs = now - date;

  if (diffInMs < 0) {
    return "in the future";
  }

  const secondsDiff = Math.floor(diffInMs / 1000);

  const minutesDiff = Math.floor(secondsDiff / 60);
  const hoursDiff = Math.floor(minutesDiff / 60);
  const daysDiff = Math.floor(hoursDiff / 24);

  if (daysDiff > 0) return `${daysDiff} day${daysDiff > 1 ? "s" : ""} ago`;
  if (hoursDiff > 0) return `${hoursDiff} hour${hoursDiff > 1 ? "s" : ""} ago`;
  if (minutesDiff > 0)
    return `${minutesDiff} minute${minutesDiff > 1 ? "s" : ""} ago`;
  return `${secondsDiff} second${secondsDiff > 1 ? "s" : ""} ago`;
}

export async function getTokenDecimal(tokenAddress, chain) {
  if (tokenAddress === "0x0000000000000000000000000000000000000000") return 18;
  const tokenInstance = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    PROVIDER(chain),
  );
  return (await tokenInstance.functions.decimals())[0];
}

export function approve(
  tokenAddress,
  spenderAddress,
  amount,
  updateProgress,
  chainId,
) {
  if (typeof amount !== "object") {
    amount = ethers.BigNumber.from(amount);
  }
  const approvalAmount = amount;
  if (approvalAmount === 0) {
    throw new Error("Approval amount is 0. Cannot proceed with approving.");
  }
  if (spenderAddress === NULL_ADDRESS) {
    throw new Error("Spender address is null. Cannot proceed with approving.");
  }
  return prepareContractCall({
    contract: getContract({
      client: THIRDWEB_CLIENT,
      address: tokenAddress,
      chain: CHAIN_ID_TO_CHAIN[chainId],
      abi: ERC20_ABI,
    }),
    method: "approve", // <- this gets inferred from the contract
    params: [spenderAddress, approvalAmount],
  });
}

export function toFixedString(number, decimals) {
  // Ensure number is a string and decimals is a non-negative integer
  const numberStr = String(number);
  decimals = Math.max(0, Math.floor(decimals));

  // Split the number into integer and fractional parts
  let [integerPart, fractionalPart = ""] = numberStr.split(".");

  // Handle negative numbers
  const isNegative = integerPart[0] === "-";
  if (isNegative) {
    integerPart = integerPart.slice(1);
  }

  // Pad or truncate fractional part
  if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, "0");
  } else if (fractionalPart.length > decimals) {
    // Round the fractional part
    const rounded = Math.round(
      Number(`0.${fractionalPart}`) * Math.pow(10, decimals),
    );
    fractionalPart = String(rounded).padStart(decimals, "0");

    // Handle carrying over to integer part
    if (fractionalPart.length > decimals) {
      integerPart = String(BigInt(integerPart) + 1n);
      fractionalPart = fractionalPart.slice(1);
    }
  }

  // Combine parts
  let result = integerPart;
  if (decimals > 0) {
    result += "." + fractionalPart;
  }

  // Add negative sign if necessary
  return isNegative ? "-" + result : result;
}

export function unixToCustomFormat(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export const formatBalance = (balance) => {
  return balance >= 0.01 ? "$" + balance.toFixed(2) : "< $0.01";
};

export function truncateToFixed(num, precision) {
  const factor = Math.pow(10, precision); // e.g., 10^2 = 100 for 2 decimal places
  return Math.floor(num * factor) / factor;
}

export function formatLockUpPeriod(lockUpPeriod) {
  if (lockUpPeriod === 0) {
    return "Unlocked";
  }
  return `${Math.floor(lockUpPeriod / 86400)} d ${Math.ceil(
    (lockUpPeriod % 86400) / 3600,
  )} h`;
}

export const castStringToDate = (dateStr) => {
  const dateMatch = dateStr.match(/\d+/g); // Extract the numeric values
  if (dateMatch && dateMatch.length === 3) {
    const year = parseInt(dateMatch[0]);
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const date = new Date(year, month, day);
    // Format the Date object as 'YYYY-MM-DD'
      return date.toISOString().split("T")[0];
    } else {
      throw new Error("Invalid date string");
    }
  };