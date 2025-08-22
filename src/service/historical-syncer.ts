import {
  getContextualMessagesBySender,
  getHandshakesByReceiver,
  getPaymentsBySender,
  getSelfStashByOwner,
  HandshakeResponse,
  SelfStashResponse,
} from "./indexer/generated";

/**
 * Handles historical events
 */
export class HistoricalSyncer {
  private DISABLED = import.meta.env.VITE_DISABLE_INDEXER === "true";

  constructor(readonly address: string) {}

  /**
   * Emits `initialLoadCompleted` when done
   */
  async initialLoad(): Promise<{
    receivedHandshakes: HandshakeResponse[];
    sentHandshakes: SelfStashResponse[];
  }> {
    if (this.DISABLED) {
      console.log("HistoricalSyncer: initialLoad disabled");
      return {
        receivedHandshakes: [],
        sentHandshakes: [],
      };
    }

    // fetch all historical handhskaes for this address
    const [receivedHandshakes, sentHanshakes] = await Promise.all([
      getHandshakesByReceiver({
        query: { address: this.address },
      }),
      this.fetchHistoricalSelfStashByOwner(this.address, "saved_handshake"),
    ]);

    if (receivedHandshakes.error) {
      console.error(
        "Error fetching received handshakes",
        receivedHandshakes.error
      );
    }

    return {
      receivedHandshakes: receivedHandshakes.data
        ? receivedHandshakes.data
        : [],
      sentHandshakes: sentHanshakes,
    };
  }

  async fetchHistoricalMessagesToAddress(from: string, alias: string) {
    if (this.DISABLED) {
      console.log(
        "HistoricalSyncer: fetchHistoricalMessagesToAddress disabled"
      );
      return [];
    }

    const messages = await getContextualMessagesBySender({
      query: {
        address: from,
        // encode alias as hex string using text encoder
        alias: new TextEncoder()
          .encode(alias)
          .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), ""),
      },
    });

    if (messages.error) {
      console.error("Error fetching messages", messages.error);
      return [];
    }

    return messages.data;
  }

  async fetchHistoricalPaymentsFromAddress(from: string) {
    if (this.DISABLED) {
      console.log(
        "HistoricalSyncer: fetchHistoricalPaymentsFromAddress disabled"
      );
      return [];
    }

    const payments = await getPaymentsBySender({
      query: {
        address: from,
      },
    });

    if (payments.error) {
      console.error("Error fetching payments", payments.error);
      return [];
    }

    return payments.data;
  }

  /**
   * @param owner owner kaspa address
   * @param scope of the stashed zone
   */
  async fetchHistoricalSelfStashByOwner(owner: string, scope: string) {
    if (this.DISABLED) {
      console.log("HistoricalSyncer: fetchHistoricalSelfStashByOwner disabled");
      return [];
    }

    const stashedElements = await getSelfStashByOwner({
      query: {
        owner,
        // encode alias as hex string using text encoder
        scope: new TextEncoder()
          .encode(scope)
          .reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), ""),
      },
    });

    if (stashedElements.error) {
      console.error("Error fetching self stash", stashedElements.error);
      return [];
    }

    return stashedElements.data;
  }
}
