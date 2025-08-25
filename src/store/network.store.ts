import { create } from "zustand";
import { NetworkType } from "../types/all";
import { KaspaClient } from "../service/kaspa-client";

interface NetworkState {
  isConnected: boolean;
  isConnecting: boolean;
  network: NetworkType;
  kaspaClient: KaspaClient;
  nodeUrl: string | null;

  /**
   * requires a call to `.connect(network: NetworkType)` if you want changes to be applied
   *
   * note: this persist the node url on the local storage and will be re-used on next startup
   */
  setNodeUrl: (url: string | null) => void;
  /**
   * requires a call to `.connect(network: NetworkType)` if you want changes to be applied
   */
  setNetwork: (network: NetworkType) => void;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Responsability: manage Kaspa RPC connection
 */
export const useNetworkStore = create<NetworkState>((set, g) => {
  const initialNetwork =
    import.meta.env.VITE_DEFAULT_KASPA_NETWORK ?? "mainnet";
  const initialNodeUrl =
    localStorage.getItem(`kasia_node_url_${initialNetwork}`) ?? null;
  return {
    isConnected: false,
    isConnecting: false,
    network: initialNetwork,
    nodeUrl: initialNodeUrl,
    kaspaClient: new KaspaClient({
      networkId: initialNetwork,
      nodeUrl: initialNodeUrl ?? undefined,
    }),
    async connect(): Promise<void> {
      let kaspaClient = g().kaspaClient;

      const isDifferentNetwork = kaspaClient.networkId !== g().network;
      const isDifferentUrl =
        kaspaClient.rpc?.url !== (g().nodeUrl ?? undefined);

      if (!isDifferentNetwork && !isDifferentUrl && g().isConnected) {
        console.warn(
          "Trying to connect KaspaClient while it is already connected."
        );
        throw new Error("Already connected.");
      }

      if ((isDifferentNetwork || isDifferentUrl) && kaspaClient.connected) {
        await kaspaClient.disconnect();
      }

      if (isDifferentNetwork || isDifferentUrl) {
        kaspaClient = new KaspaClient({
          networkId: g().network,
          nodeUrl: g().nodeUrl ?? undefined,
        });

        set({
          kaspaClient,
        });
      }

      set({
        isConnecting: true,
        isConnected: false,
      });

      try {
        await kaspaClient.connect();

        // persist the nodeUrl uppon successful connection
        if (kaspaClient.nodeUrl) {
          localStorage.setItem(
            `kasia_node_url_${kaspaClient.networkId}`,
            kaspaClient.nodeUrl ?? ""
          );
        } else {
          localStorage.removeItem(`kasia_node_url_${kaspaClient.networkId}`);
        }

        set({
          isConnected: true,
          isConnecting: false,
        });
        return;
      } catch (error) {
        set({
          isConnecting: false,
        });
        throw error;
      }
    },
    async disconnect() {
      const kaspaClient = g().kaspaClient;
      if (kaspaClient.connected) {
        await kaspaClient.disconnect();
        set({ isConnected: false });
      }
    },
    setNetwork(network) {
      const nodeUrl = localStorage.getItem(`kasia_node_url_${network}`) ?? null;

      set({ network, nodeUrl });
    },
    setNodeUrl(nodeUrl) {
      set({ nodeUrl });
    },
  };
});
