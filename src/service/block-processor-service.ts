import { Address, IBlockAdded, ITransaction, RpcClient } from "kaspa-wasm";
import { BlockAddedData, Header } from "../types/all";
import { SenderAndAcceptanceResolutionService } from "./sender-and-acceptance-resolution-service";
import { useMessagingStore } from "../store/messaging.store";
import {
  isKasiaTransaction,
  ParsedKaspaMessagePayload,
  parseKaspaMessagePayload,
} from "../utils/message-payload";
import { useDBStore } from "../store/db.store";
import { PROTOCOL } from "../config/protocol";
import { tryParseBase64AsHexToHex } from "../utils/payload-encoding";
import EventEmitter from "eventemitter3";
import { devMode } from "../config/dev-mode";

export type RawResolvedKasiaTransaction = {
  id: string;
  transaction: ITransaction;
  header: Header;
  senderAddressString: string;
  recipientAddressString: string;
  recipientOutputAmount: bigint;
  parsedPayload: ParsedKaspaMessagePayload;
};

export class BlockProcessorService extends EventEmitter<{
  newTransaction: (
    rawResolvedKasiaTransaction: RawResolvedKasiaTransaction
  ) => void;
}> {
  // ordering matters, Set is safe as per MDN documentation
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
  private processedTransactionIds: Set<string> = new Set();
  private monitoredConversations: Set<string> = new Set(); // Store monitored aliases
  private monitoredAddresses: Map<string, string> = new Map(); // Store address -> alias mappings
  private readonly MAX_TRANSACTION_IDS_RETENTION_COUNT = 1_000; // Prevent unlimited growth

  constructor(
    private readonly rpc: RpcClient,
    private readonly saars: SenderAndAcceptanceResolutionService,
    private readonly walletReceiveAddressString: string
  ) {
    super();

    this.init();
  }

  private async init() {
    this.rpc.addEventListener("block-added", this.processBlockAdded.bind(this));
    await this.rpc.subscribeBlockAdded();
  }

  stop() {
    this.rpc.removeEventListener(
      "block-added",
      this.processBlockAdded.bind(this)
    );
  }

  private async processBlockAdded(_event: IBlockAdded) {
    const event = _event as unknown as BlockAddedData;

    // note: this should be optimized, block processor shouldn't be the owner of that
    // it shouldn't be needed to refresh computation here if the owner of this would be the
    // maintainer of the shared state
    this.updateMonitoredConversations();

    const block = event.data.block;
    const header = block.header;
    await Promise.all(
      block.transactions.map((t) => this.safeProcessTransaction(t, header))
    );

    // clear oldest processed tx ids
    if (
      this.processedTransactionIds.size >
      this.MAX_TRANSACTION_IDS_RETENTION_COUNT
    ) {
      const oldestId = this.processedTransactionIds.values().next().value;

      if (oldestId) {
        this.processedTransactionIds.delete(oldestId);
      }
    }
  }

  private async safeProcessTransaction(tx: ITransaction, header: Header) {
    try {
      const txId = tx.verboseData?.transactionId;

      if (!txId || this.processedTransactionIds.has(txId)) {
        return;
      }

      if (!isKasiaTransaction(tx)) {
        return;
      }

      // mark as processed optimistically
      this.processedTransactionIds.add(txId);

      if (
        await useDBStore.getState().repositories.doesKasiaEventExistsById(txId)
      ) {
        console.log(`Transaction ${txId} already processed`);
        return;
      }

      // try to resolve sender
      const resolvedSenderData = await this.saars.askResolution(txId);
      const resolvedSenderAddress = resolvedSenderData.sender.toString();

      const parsed = parseKaspaMessagePayload(tx.payload);

      const messageType = parsed.type;
      const targetAlias = parsed.alias;

      const isCommForUs =
        messageType === PROTOCOL.headers.COMM.type &&
        targetAlias &&
        this.monitoredConversations.has(targetAlias);

      const isSelfStash = messageType === PROTOCOL.headers.SELF_STASH.type;

      // self stash not from me, abort
      if (
        isSelfStash &&
        resolvedSenderAddress !== this.walletReceiveAddressString
      ) {
        return;
      }

      // if this is a comm message but isn't monitored by us, we can stop straight away
      if (
        messageType === PROTOCOL.headers.COMM.type &&
        targetAlias &&
        !this.monitoredConversations.has(targetAlias)
      ) {
        if (devMode)
          console.log(
            `Block Processor - Received a message that isn't for us`,
            {
              monitored: this.monitoredConversations,
              targetAlias,
              parsed,
              txId,
            }
          );
        return;
      }

      // note: hacky way of determining the recipient and the amount
      // possible improvement, protocol change: signed recipient pubkey
      //
      // if it's a com message that we're tracking, we're the recipient,
      // if it's a self stash message, recipient = sender
      // else it's the first output that isn't targeted to the sender (isn't a change output)
      let guessedRecipientAddressString: string | undefined;
      let recipientOutputAmount: bigint | undefined;
      if (isCommForUs) {
        guessedRecipientAddressString = this.walletReceiveAddressString;
        recipientOutputAmount = BigInt(0);
      } else if (isSelfStash) {
        guessedRecipientAddressString = resolvedSenderAddress;
        recipientOutputAmount = BigInt(0);
      } else {
        const guessedRecipientOutput = tx.outputs.find(
          (o) =>
            o.verboseData?.scriptPublicKeyAddress !==
            resolvedSenderData.sender.toString()
        );

        if (!guessedRecipientOutput) {
          throw new Error("Cannot find recipient output");
        }

        guessedRecipientAddressString =
          guessedRecipientOutput.verboseData?.scriptPublicKeyAddress;
        recipientOutputAmount = guessedRecipientOutput.value;
      }

      if (!guessedRecipientAddressString) {
        // shouldn't happen but type check is unhappy
        throw new Error("Shouldn't happen");
      }

      // ONLY apply base64 parsing for comm (message) transactions, not for payments/handshakes
      let hexEncryptedPayload = parsed.encryptedHex;
      if (parsed.type === PROTOCOL.headers.COMM.type) {
        hexEncryptedPayload = tryParseBase64AsHexToHex(parsed.encryptedHex);
      }

      const encryptedHex = hexEncryptedPayload;
      const isHandshake = messageType === PROTOCOL.headers.HANDSHAKE.type;

      const isMonitoredAddress =
        this.monitoredAddresses.has(resolvedSenderAddress) ||
        this.monitoredAddresses.has(guessedRecipientAddressString);

      // For payments, check if the sender address is one we're monitoring
      // (i.e., we have a conversation with them OR they sent us a payment)
      const isPaymentForUs =
        messageType === PROTOCOL.headers.PAYMENT.type &&
        guessedRecipientAddressString === this.walletReceiveAddressString;

      if (
        !(isHandshake || isMonitoredAddress || isCommForUs || isPaymentForUs)
      ) {
        // not for us or not applicable message
        return;
      }

      const rawTransactionToEmit: RawResolvedKasiaTransaction = {
        id: txId,
        recipientOutputAmount,
        header,
        parsedPayload: {
          ...parsed,
          // apply previous "hack" for message hex that needed base64 decoding
          encryptedHex,
        },
        senderAddressString: resolvedSenderAddress,
        recipientAddressString: guessedRecipientAddressString,
        transaction: tx,
      };

      console.log("Block Processor - Emitting raw transaction", {
        rawTransactionToEmit,
      });

      this.emit("newTransaction", rawTransactionToEmit);
    } catch (error) {
      console.error(
        `Block Processor - Error while processing transaction`,
        tx,
        error
      );
    }
  }

  /*
   * Highly not optimized and shouldn't be block processor responsability
   */
  private updateMonitoredConversations() {
    try {
      const messagingStore = useMessagingStore.getState();
      const conversationManager = messagingStore?.conversationManager;

      if (!conversationManager) return;

      // Update our monitored conversations
      this.monitoredConversations.clear();
      this.monitoredAddresses.clear();
      const conversations = conversationManager.getMonitoredConversations();

      // Silently update monitored conversations
      conversations.forEach((conv) => {
        this.monitoredConversations.add(conv.alias);
        this.monitoredAddresses.set(conv.address, conv.alias);
      });
    } catch (error) {
      console.error("Error updating monitored conversations:", error);
    }
  }
}
