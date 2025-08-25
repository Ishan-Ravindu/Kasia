import { useNetworkStore } from "../store/network.store";
import { useWalletStore } from "../store/wallet.store";
import { NetworkType } from "../types/all";
import { client as indexerClient } from "../service/indexer/generated/client.gen";
import { useToastStore } from "../store/toast.store";
import { useMessagingStore } from "../store/messaging.store";
import { useDBStore } from "../store/db.store";
import { UnlockedWallet } from "../types/wallet.type";
import { SenderAndAcceptanceResolutionService } from "../service/sender-and-acceptance-resolution-service";
import { useLiveStore } from "../store/live.store";

export type ConnectOpts = {
  networkType?: NetworkType;
  nodeUrl?: string | null;
};

export type StartSessionOpts = {
  walletId: string;
  walletPassword: string;
};

export class StartSessionInvalidPasswordException extends Error {
  constructor() {
    super();

    this.name = StartSessionInvalidPasswordException.name;
    this.message = "Invalid Password";
  }
}

export const useGlobalStore = () => {
  const networkStore = useNetworkStore();
  const walletStore = useWalletStore();
  const messagingStore = useMessagingStore();
  const dbStore = useDBStore();
  const liveStore = useLiveStore();

  const toastStore = useToastStore();

  const connect = async (opts?: ConnectOpts) => {
    const baseNetwork = networkStore.network;

    // update indexer base url
    indexerClient.setConfig({
      baseUrl:
        (opts?.networkType ?? baseNetwork) === "mainnet"
          ? import.meta.env.VITE_INDEXER_MAINNET_URL
          : import.meta.env.VITE_INDEXER_TESTNET_URL,
    });

    if (opts?.networkType) {
      networkStore.setNetwork(opts.networkType);
    }

    if (opts?.nodeUrl !== undefined) {
      networkStore.setNodeUrl(opts.nodeUrl);
    }

    try {
      await networkStore.connect();

      const freshNetworkStore = useNetworkStore.getState();

      walletStore.setRpcClient(freshNetworkStore.kaspaClient);
      walletStore.setSelectedNetwork(freshNetworkStore.network);
    } catch (error) {
      if (error instanceof Error) {
        toastStore.add(
          "error",
          `Error while connecting to the network: ${error.message}`,
          5000
        );
        throw error;
      }
      console.error(`Unknown error while connecting to the network`, error);
      throw error;
    }
  };

  // pre-assumption: db has been opened and network is connected
  // 1.  unlock wallet
  // 2.a start account service - later this step will be removed in favor of a wallet service contained in wallet store
  // 2.b init repositories (with tenancy and wallet password)
  // 3.  migrate storage
  // 4.  messaging store initial load, hydrate local store + partially lazy fetch historical ones
  // 5.  start live store which process incoming block and resolve transaction acceptance data and sender
  const startSession = async (opts: StartSessionOpts) => {
    console.log("STARTING SESSION");
    let unlockedWallet: UnlockedWallet | undefined;
    try {
      unlockedWallet = await walletStore.unlock(
        opts.walletId,
        opts.walletPassword
      );
    } catch (error) {
      console.error(error);
      throw new StartSessionInvalidPasswordException();
    }

    dbStore.initRepositories(unlockedWallet);

    const receivedAddressString = unlockedWallet.receivePublicKey
      .toAddress(networkStore.network)
      .toString();

    await dbStore.migrateStorage(receivedAddressString);

    await messagingStore.load(receivedAddressString);

    if (networkStore.kaspaClient.rpc) {
      liveStore.start(networkStore.kaspaClient.rpc, receivedAddressString);
    }
  };

  return { connect, startSession };
};
