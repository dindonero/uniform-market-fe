/**
 * Chain configuration for the application
 */

import { arbitrumSepolia } from "wagmi/chains";
import { defineChain } from "viem";
import outputInfo from "@/../constants/outputInfo.json";

// Nova Cidade (L2/L3) chain definition
export const novaCidadeMainnet = defineChain({
  id: outputInfo.chainInfo.chainId,
  name: outputInfo.chainInfo.chainName,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [outputInfo.chainInfo.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: outputInfo.chainInfo.explorerUrl },
  },
});

// Default chain is Nova Cidade (L2/L3)
export const defaultChain = novaCidadeMainnet;

// Public Arbitrum Sepolia RPC. Heavily rate-limited per IP (a NATted campus shares one),
// so it is only ever a backup behind the keyed endpoint — never the primary.
export const ARBITRUM_SEPOLIA_PUBLIC_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

// Custom Arbitrum Sepolia with your Alchemy RPC
const customRpcUrl = process.env.NEXT_PUBLIC_INFURA_RPC;

export const arbitrumSepoliaRpcUrls = [customRpcUrl, ARBITRUM_SEPOLIA_PUBLIC_RPC].filter(
  (u): u is string => Boolean(u)
);

export const customArbitrumSepolia = customRpcUrl
  ? defineChain({
      ...arbitrumSepolia,
      rpcUrls: {
        default: { http: arbitrumSepoliaRpcUrls },
      },
    })
  : arbitrumSepolia;

// Base chain is Arbitrum Sepolia (L1/L2)
export const baseChain = customArbitrumSepolia;

// All supported chains
export const supportedChains = [defaultChain, customArbitrumSepolia] as const;
