import { create } from "zustand";
import { SenderAndAcceptanceResolutionService } from "../service/sender-and-acceptance-resolution-service";
import { RpcClient } from "kaspa-wasm";
import {
  BlockProcessorService,
  RawResolvedKasiaTransaction,
} from "../service/block-processor-service";
import { useMessagingStore } from "./messaging.store";

interface LiveState {
  saars: SenderAndAcceptanceResolutionService | undefined;
  blockProcessorService: BlockProcessorService | undefined;

  start: (rpc: RpcClient, walletReceiveAddressString: string) => void;
  stop: () => void;
}

export const useLiveStore = create<LiveState>((set, get) => {
  async function onRawKasiaTransactionReceived(
    tx: RawResolvedKasiaTransaction
  ) {
    try {
      await useMessagingStore.getState().ingestRawResolvedKasiaTransaction(tx);
    } catch (error) {
      console.error(
        "Live Store - Error while ingesting Live Kasia Transaction",
        error
      );
    }
  }

  return {
    saars: undefined,
    blockProcessorService: undefined,
    start(rpc, walletReceiveAddressString) {
      const saars = new SenderAndAcceptanceResolutionService(rpc);
      const blockProcessorService = new BlockProcessorService(
        rpc,
        saars,
        walletReceiveAddressString
      );

      set({
        saars,
        blockProcessorService,
      });

      rpc.addEventListener("disconnect", () => {
        get().stop();
      });

      blockProcessorService.addListener(
        "newTransaction",
        onRawKasiaTransactionReceived.bind(this)
      );
    },
    stop() {
      get().blockProcessorService?.removeListener(
        "newTransaction",
        onRawKasiaTransactionReceived.bind(this)
      );

      get().blockProcessorService?.stop();
      get().saars?.stop();
      set({
        saars: undefined,
        blockProcessorService: undefined,
      });
    },
  };
});
