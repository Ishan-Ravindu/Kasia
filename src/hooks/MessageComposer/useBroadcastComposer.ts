import { useComposerStore } from "../../store/message-composer.store";
import { useWalletStore } from "../../store/wallet.store";
import { useBroadcastStore } from "../../store/broadcast.store";
import { toast } from "../../utils/toast-helper";
import { unknownErrorToErrorLike } from "../../utils/errors";

export const useBroadcastComposer = (channelName?: string) => {
  const { sendState, setSendState, clearDraft } = useComposerStore();
  const { addPendingMessage, updateMessageStatus } = useBroadcastStore();

  const draft = useComposerStore((s) =>
    channelName ? s.drafts[channelName] || "" : ""
  );

  const walletStore = useWalletStore();

  const sendBroadcast = async () => {
    toast.removeAll();
    if (!channelName || !walletStore.address || !walletStore.unlockedWallet) {
      toast.error("Error, please reload app");
      return;
    }

    if (!draft.trim()) {
      toast.error("Please enter a message to broadcast.");
      return;
    }

    if (sendState.status === "loading") {
      return;
    }

    let messageId: string | undefined;

    try {
      setSendState({ status: "loading" });

      // Use account service to create the broadcast transaction
      const accountService = walletStore.accountService;
      if (!accountService) {
        throw new Error("Account service not available");
      }

      // Retry logic for UTXO conflicts
      let txId: string;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          txId = await accountService.createBroadcastTransaction({
            channelName: channelName.toLowerCase(),
            message: draft,
          });
          break; // Success, exit retry loop
        } catch (error) {
          attempts++;
          console.log(`Broadcast attempt ${attempts} failed:`, error);

          if (attempts >= maxAttempts) {
            throw error; // Re-throw after max attempts
          }

          // Check if it's a UTXO/funds issue that might resolve
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes("Insufficient funds") ||
            errorMessage.includes("UTXO") ||
            errorMessage.includes("balance")
          ) {
            // Wait a bit and retry
            await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
          } else {
            throw error; // Non-retryable error
          }
        }
      }

      console.log(`Broadcast message sent to channel ${channelName}:`, txId!);

      // Add pending message to store with transaction ID
      messageId = addPendingMessage({
        channelName: channelName.toLowerCase(),
        senderAddress: walletStore.address!.toString(),
        content: draft,
        timestamp: new Date(),
        transactionId: txId!,
      });

      // clear
      clearDraft(channelName);
      setSendState({ status: "idle" });
    } catch (error) {
      console.error("Error sending broadcast message:", error);

      // Mark message as failed if we have a message ID
      if (messageId) {
        updateMessageStatus(messageId, "failed");
      }
      setSendState({ status: "error", error: error as Error });

      // Reset error state after a delay
      setTimeout(() => setSendState({ status: "idle" }), 3000);
    }
  };

  return { sendBroadcast, draft };
};
