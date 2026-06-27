import { NetworkType } from "../types/all";

export const getExplorerUrl = (txId: string, network: string) => {
  const networkType = network as NetworkType;

  switch (networkType) {
    case "mainnet":
      return `https://kaspa.stream/transactions/${txId}`;
    case "testnet-10":
      return `https://tn10.kaspa.stream/transactions/${txId}`;
    case "testnet-11":
      return `https://explorer-tn11.kaspa.org/txs/${txId}`;
    case "devnet":
      return `https://explorer-devnet.kaspa.org/txs/${txId}`;
    default:
      // fallback to mainnet if there is *somehow* an issue
      return `https://kaspa.stream/transactions/${txId}`;
  }
};
