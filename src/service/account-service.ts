import { EventEmitter } from "eventemitter3";
import {
  Address,
  UtxoProcessor,
  UtxoContext,
  UtxoEntry,
  ITransaction,
  PendingTransaction,
  GeneratorSummary,
  FeeSource,
  sompiToKaspaString,
  kaspaToSompi,
  ITransactionOutput,
} from "kaspa-wasm";
import { KaspaClient } from "./kaspa-client";
import {
  decrypt_message,
  encrypt_message,
  EncryptedMessage,
  PrivateKey,
} from "cipher";
import { DecryptionCache } from "./decryption-cache";
import {
  BlockAddedData,
  KasiaTransaction,
  PriorityFeeConfig,
} from "../types/all";
import { UnlockedWallet } from "../types/wallet.type";
import {
  ExplorerTransaction,
  TransactionId,
  getTransactionId,
} from "../types/transactions";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { useDBStore } from "../store/db.store";
import { PROTOCOL, toHex } from "../config/protocol";
import { PLACEHOLDER_ALIAS } from "../config/constants";
import { parseKaspaMessagePayload } from "../utils/message-payload";
import {
  hexToBytes,
  getEncoder,
  tryParseBase64AsHexToHex,
} from "../utils/payload-encoding";
import { WalletStorageService } from "./wallet-storage-service";
import { TransactionGeneratorService } from "./transaction-generator";
import { MAX_TX_FEE } from "../config/constants";

// strictly typed events
type AccountServiceEvents = {
  balance: (balance: {
    mature: bigint;
    pending: bigint;
    outgoing: bigint;
    matureDisplay: string;
    pendingDisplay: string;
    outgoingDisplay: string;
    matureUtxoCount: number;
    pendingUtxoCount: number;
  }) => void;
  utxosChanged: (utxos: UtxoEntry[]) => void;
};

type SendMessageArgs = {
  toAddress: Address;
  message: string;
  password: string;
  amount?: bigint; // Optional custom amount, defaults to 0.2 KAS
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type EstimateSendMessageFeesArgs = {
  toAddress: Address;
  message: string;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type SendMessageWithContextArgs = {
  toAddress: Address;
  message: string;
  password: string;
  theirAlias: string;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreateTransactionArgs = {
  address: Address;
  amount: bigint;
  payload: string | Uint8Array;
  payloadSize?: number;
  messageLength?: number;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreateWithdrawTransactionArgs = {
  address: Address;
  amount: bigint;
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

type CreatePaymentWithMessageArgs = {
  address: Address;
  amount: bigint;
  payload: string | Uint8Array;
  originalMessage?: string; // Add the original message for outgoing record creation
  priorityFee?: PriorityFeeConfig; // Add priority fee support
};

export class AccountService extends EventEmitter<AccountServiceEvents> {
  processor: UtxoProcessor;
  context: UtxoContext;
  networkId: string;

  // only populated when started
  isStarted: boolean = false;
  receiveAddress: Address | null = null;

  private processedMessageIds: Set<string> = new Set();
  private monitoredConversations: Set<string> = new Set(); // Store monitored aliases
  private monitoredAddresses: Map<string, string> = new Map(); // Store address -> alias mappings
  private readonly MAX_PROCESSED_MESSAGES = 1000; // Prevent unlimited growth

  // Add password field
  private password: string | null = null;

  constructor(
    private readonly rpcClient: KaspaClient,
    private readonly unlockedWallet: UnlockedWallet
  ) {
    super();

    if (!rpcClient.rpc) {
      throw new Error("RPC client is not initialized");
    }

    this.networkId = rpcClient.networkId;

    this.processor = new UtxoProcessor({
      networkId: this.networkId,
      rpc: rpcClient.rpc,
    });
    this.context = new UtxoContext({ processor: this.processor });

    // Set password from unlocked wallet if available
    if (unlockedWallet.password) {
      this.password = unlockedWallet.password;
    }
  }

  // Add method to set password
  public setPassword(password: string) {
    if (!password) {
      throw new Error("Password cannot be empty");
    }
    console.log("Setting password in AccountService");
    this.password = password;
  }

  // Add method to check if password is set
  private ensurePasswordSet() {
    if (!this.password) {
      throw new Error("Password not set - cannot perform operation");
    }
  }

  private _emitBalanceUpdate() {
    const balance = this.context.balance;
    if (!balance) return;

    // Get UTXOs for counting
    const matureUtxos = this.context.getMatureRange(
      0,
      this.context.matureLength
    );
    const pendingUtxos = this.context.getPending();

    console.log("Balance update:", {
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length,
      mature: balance.mature.toString(),
      pending: balance.pending.toString(),
      outgoing: balance.outgoing.toString(),
    });

    this.emit("balance", {
      mature: balance.mature,
      pending: balance.pending,
      outgoing: balance.outgoing,
      matureDisplay: sompiToKaspaString(balance.mature),
      pendingDisplay: sompiToKaspaString(balance.pending),
      outgoingDisplay: sompiToKaspaString(balance.outgoing),
      matureUtxoCount: matureUtxos.length,
      pendingUtxoCount: pendingUtxos.length,
    });
  }

  private async _fetchTransactionDetails(txId: string, maxRetries = 10) {
    const retryDelay = 2000; // Changed to 2 seconds between retries

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const baseUrl =
          this.networkId === "mainnet"
            ? "https://api.kaspa.org"
            : "https://api-tn10.kaspa.org";
        const response = await fetch(
          `${baseUrl}/transactions/${txId}?inputs=true&outputs=true&resolve_previous_outpoints=no`
        );

        if (response.status === 404) {
          console.log(
            `Transaction ${txId} not yet available in API (attempt ${
              attempt + 1
            }/${maxRetries}), retrying in 2 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch transaction details: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log(
          `Successfully fetched transaction details for ${txId} on attempt ${
            attempt + 1
          }`
        );
        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(
            `Error fetching transaction details for ${txId} after ${maxRetries} attempts:`,
            error
          );
          return null;
        }
        console.log(
          `Attempt ${
            attempt + 1
          }/${maxRetries} failed, retrying in 2 seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  }

  async start() {
    try {
      // Get the receive address from the wallet
      const initialReceiveAddress =
        this.unlockedWallet.publicKeyGenerator.receiveAddress(
          this.networkId,
          0
        );

      // Ensure it has the proper network prefix
      this.receiveAddress = this.ensureAddressPrefix(initialReceiveAddress);

      console.log(
        "Using primary address for all operations:",
        this.receiveAddress.toString()
      );

      // Set up event listeners
      console.log("Setting up event listeners...");
      this.processor.addEventListener("balance", async () => {
        console.log("Balance event received");
        this._emitBalanceUpdate();
      });

      // start the processor
      console.log("Starting UTXO processor...");
      await this.processor.start();

      // Only track primary address
      const addressesToTrack = [this.receiveAddress!];

      // Now track addresses in UTXO processor
      console.log("Starting address tracking for primary address...");
      await this.context.trackAddresses(addressesToTrack);

      // Set up block subscription with optimized message handling
      console.log("Setting up block subscription...");
      await this.rpcClient.subscribeToBlockAdded((event) => {
        // Fire-and-forget; callback signature remains (event) => void
        void this.processBlockEvent(event as unknown as BlockAddedData);
      });
      console.log("Successfully subscribed to block events");

      this.isStarted = true;
    } catch (error) {
      console.error("Failed to start account service:", error);
      throw error;
    }
  }

  async stop() {
    console.log("Stopping UTXO subscription and processor...");
    try {
      // Stop the UTXO processor
      await this.processor.stop();

      // Clean up our local state
      this.isStarted = false;
      console.log("Successfully cleaned up UTXO subscription and processor");
    } catch (error) {
      console.error(
        "Failed to clean up UTXO subscription and processor:",
        error
      );
    }
  }

  public async createTransaction(
    transaction: CreateTransactionArgs,
    password: string
  ): Promise<TransactionId> {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!transaction.address) {
      throw new Error("Transaction address is required");
    }

    if (transaction.amount === null || transaction.amount === undefined) {
      throw new Error("Transaction amount is required");
    }

    console.log("=== CREATING TRANSACTION ===");
    const primaryAddress = this.receiveAddress;
    console.log(
      "Creating transaction from primary address:",
      primaryAddress.toString()
    );
    console.log(
      "Change will go back to primary address:",
      primaryAddress.toString()
    );
    console.log(`Destination: ${transaction.address.toString()}`);
    console.log(
      `Amount: ${Number(transaction.amount) / 100000000} KAS (${
        transaction.amount
      } sompi)`
    );
    console.log(`Payload length: ${transaction.payload.length / 2} bytes`);

    const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    try {
      // Use our optimized generator creation method
      const generator = TransactionGeneratorService.createForTransaction({
        context: this.context,
        networkId: this.networkId,
        receiveAddress: this.receiveAddress!,
        destinationAddress: transaction.address,
        amount: transaction.amount,
        payload: transaction.payload,
        priorityFee: transaction.priorityFee,
      });

      console.log("Generating transaction...");
      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      if (pendingTransaction.feeAmount > MAX_TX_FEE) {
        throw new Error(
          `Fee cannot exceed ${Number(MAX_TX_FEE) / 100_000_000} KAS`
        );
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();
      console.log(
        `Transaction requires signing ${addressesToSign.length} addresses:`
      );
      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        console.log("Using primary address key for signing");
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      console.log("Signing transaction...");
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      console.log("Submitting transaction to network...");
      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);
      console.log(`Transaction submitted with ID: ${txId}`);
      console.log("========================");

      return txId;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async createPaymentWithMessage(
    paymentTransaction: CreatePaymentWithMessageArgs,
    password: string
  ): Promise<TransactionId> {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!paymentTransaction.address) {
      throw new Error("Transaction address is required");
    }

    if (!paymentTransaction.amount) {
      throw new Error("Transaction amount is required");
    }

    const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    try {
      // Use a modified generator that sends to recipient but includes payload
      const generator = TransactionGeneratorService.createForPaymentOrWithdraw({
        context: this.context,
        networkId: this.networkId,
        receiveAddress: this.receiveAddress!,
        destinationAddress: paymentTransaction.address,
        amount: paymentTransaction.amount,
        payload: paymentTransaction.payload,
        priorityFee: paymentTransaction.priorityFee,
      });

      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      if ((await generator.next()) !== null) {
        throw new Error("Unexpected multiple transaction generation");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();
      console.log(
        `Transaction requires signing ${addressesToSign.length} addresses:`
      );
      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      console.log("Submitting transaction to network...");

      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);

      console.log(`Payment with message submitted with ID: ${txId}`);

      return txId;
    } catch (error) {
      console.error("Error creating payment with message:", error);
      throw error;
    }
  }

  public async createWithdrawTransaction(
    withdrawTransaction: CreateWithdrawTransactionArgs,
    password: string
  ) {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!withdrawTransaction.address) {
      throw new Error("Transaction address is required");
    }

    if (!withdrawTransaction.amount) {
      throw new Error("Transaction amount is required");
    }

    const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    try {
      // Use our optimized generator creation method
      const generator = TransactionGeneratorService.createForPaymentOrWithdraw({
        context: this.context,
        networkId: this.networkId,
        receiveAddress: this.receiveAddress!,
        destinationAddress: withdrawTransaction.address,
        amount: withdrawTransaction.amount,
        priorityFee: withdrawTransaction.priorityFee,
      });

      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();

      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      pendingTransaction.sign(privateKeys);
      // submit
      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);

      console.log(`Transaction submitted with ID: ${txId}`);

      return txId;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  public async createCompoundTransaction() {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    if (!this.context) {
      throw new Error("UTXO context not initialized");
    }

    // ensure password is available
    this.ensurePasswordSet();

    console.log("Consolidating all UTXOs to:", this.receiveAddress.toString());

    const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
      this.unlockedWallet,
      this.password!
    );

    if (!privateKeyGenerator) {
      throw new Error("Failed to generate private key");
    }

    try {
      const balance = this.context.balance;
      if (!balance || balance.mature === 0n) {
        throw new Error("No mature UTXOs available for compound transaction");
      }

      // Use our simple compound transaction generator
      const generator = TransactionGeneratorService.createForCompound({
        context: this.context,
        networkId: this.networkId,
        receiveAddress: this.receiveAddress!,
      });

      const pendingTransaction: PendingTransaction | null =
        await generator.next();

      if (!pendingTransaction) {
        throw new Error("Failed to generate transaction");
      }

      // Log the addresses that need signing
      const addressesToSign = pendingTransaction.addresses();

      addressesToSign.forEach((addr, i) => {
        console.log(`  Address ${i + 1}: ${addr.toString()}`);
      });

      // Always use receive key for all addresses since we only use primary address
      const privateKeys = pendingTransaction.addresses().map(() => {
        const key = privateKeyGenerator.receiveKey(0);
        if (!key) {
          throw new Error("Failed to generate private key for signing");
        }
        return key;
      });

      // Sign the transaction
      pendingTransaction.sign(privateKeys);

      // Submit the transaction
      const txId: string = await pendingTransaction.submit(this.rpcClient.rpc);

      console.log(`Transaction submitted with ID: ${txId}`);

      return txId;
    } catch (error) {
      console.error("Error creating compound transaction:", error);
      throw error;
    }
  }

  public async sendMessage(
    sendMessage: SendMessageArgs
  ): Promise<TransactionId> {
    this.ensurePasswordSet();
    // Use custom amount if provided, otherwise default to 0.2 KAS
    const defaultAmount = kaspaToSompi("0.2");
    const messageAmount = sendMessage.amount || defaultAmount;

    if (!messageAmount) {
      throw new Error("Message amount missing");
    }

    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    if (!sendMessage.password) {
      throw new Error("Password is required");
    }

    const destinationAddress = this.ensureAddressPrefix(sendMessage.toAddress);
    const addressString = destinationAddress.toString();

    // Check if the message is already encrypted (hex format)
    const isPreEncrypted = /^[0-9a-fA-F]+$/.test(sendMessage.message);

    let payload;
    if (isPreEncrypted) {
      // Message is already encrypted, just add the prefix
      payload = PROTOCOL.prefix.hex + sendMessage.message;
    } else {
      console.log("ENCRYPT MESSAGE", sendMessage.message);
      // Message needs to be encrypted
      const encryptedMessage = encrypt_message(
        addressString,
        sendMessage.message
      );

      payload = PROTOCOL.prefix.hex + encryptedMessage.to_hex();
    }

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      const txId = await this.createTransaction(
        {
          address: destinationAddress,
          amount: messageAmount,
          payload: payload,
          priorityFee: sendMessage.priorityFee,
        },
        sendMessage.password
      );

      return txId;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  // estimation with context 1:1 base64
  public async estimateSendMessageFees(
    sendMessage: EstimateSendMessageFeesArgs
  ): Promise<GeneratorSummary> {
    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    const destinationAddress = this.ensureAddressPrefix(sendMessage.toAddress);
    const addressString = destinationAddress.toString();
    // Message needs to be encrypted

    const encryptedMessage = encrypt_message(
      addressString,
      sendMessage.message
    );
    const bytesData = hexToBytes(encryptedMessage.to_hex());
    const base64Data = btoa(String.fromCharCode(...bytesData));
    if (!encryptedMessage) {
      throw new Error("Failed to encrypt message");
    }
    // Build the full protocol string with all components to match sendMessageWithContext
    const protocolString = `ciph_msg:1:comm:${PLACEHOLDER_ALIAS}:${base64Data}`;
    const payload = getEncoder().encode(protocolString);

    if (!payload) {
      throw new Error("Failed to create message payload");
    }

    try {
      return TransactionGeneratorService.createForTransaction({
        context: this.context,
        networkId: this.networkId,
        receiveAddress: this.receiveAddress!,
        destinationAddress: destinationAddress,
        amount: BigInt(0.2 * 100_000_000),
        payload: payload,
        priorityFee: sendMessage.priorityFee,
      }).estimate();
    } catch (error) {
      console.error("Error estimating transaction fees:", error);
      throw error;
    }
  }

  public getMatureUtxos() {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this.context.getMatureRange(0, this.context.matureLength);
  }

  /**
   * Helper method to ensure an address has the proper network prefix
   */
  private ensureAddressPrefix(address: Address): Address {
    const addressString = address.toString();

    // If address already has a prefix, return it unchanged
    if (addressString.includes(":")) {
      return address;
    }

    // Add appropriate prefix based on network
    let prefixedAddressString = addressString;
    if (this.networkId === "testnet-10" || this.networkId === "testnet-11") {
      prefixedAddressString = `kaspatest:${addressString}`;
    } else if (this.networkId === "mainnet") {
      prefixedAddressString = `kaspa:${addressString}`;
    } else if (this.networkId === "devnet") {
      prefixedAddressString = `kaspadev:${addressString}`;
    }

    console.log(`Added prefix to address: ${prefixedAddressString}`);
    return new Address(prefixedAddressString);
  }

  private isKasiaTransaction(tx: ITransaction | ExplorerTransaction): boolean {
    return tx?.payload?.startsWith(PROTOCOL.prefix.hex) ?? false;
  }

  private async processMessageTransaction(
    tx: ITransaction,
    blockTime: number,
    maxRetries = 10
  ) {
    const payload = tx.payload;
    if (!payload.startsWith(PROTOCOL.prefix.hex)) {
      return;
    }

    const txId = getTransactionId(tx);

    if (!txId) {
      console.warn("Transaction ID is missing in real-time processing");
      return;
    }

    if (
      await useDBStore.getState().repositories.doesKasiaEventExistsById(txId)
    ) {
      console.log(`Transaction ${txId} already processed`);
      return;
    }

    // note: ideally we wouldn't need to compute the address once more
    // if this is needed, it means the loading strategy is wrong
    // and should queue added block events before ingesting them
    const walletAddress = this.unlockedWallet.publicKeyGenerator.receiveAddress(
      this.networkId,
      0
    );
    const stringWalletAddress = walletAddress.toString();

    if (DecryptionCache.hasFailed(stringWalletAddress, txId)) {
      if (process.env.NODE_ENV === "development") {
        console.debug(`Real-time: Skipping known failed decryption: ${txId}`);
      }
      return;
    }

    // Get sender address from transaction inputs
    let senderAddress = null;
    if (tx.inputs && tx.inputs.length > 0) {
      const input = tx.inputs[0];
      const prevTxId = input.previousOutpoint?.transactionId;
      const prevOutputIndex = input.previousOutpoint?.index;

      if (prevTxId && typeof prevOutputIndex === "number") {
        try {
          const prevTx = await this._fetchTransactionDetails(
            // this returns an explorer transaction
            prevTxId,
            maxRetries
          );
          if (prevTx?.outputs && prevTx.outputs[prevOutputIndex]) {
            const output = prevTx.outputs[prevOutputIndex];
            console.log("resolved sender address from prevTx: ", output);
            senderAddress = output.script_public_key_address;
          }
        } catch (error) {
          console.error("Error getting sender address:", error);
        }
      }
    }

    // @TODO(indexer): shouldn't use this fallback, can lead to fake id.
    // If we still don't have a sender address, use the change output address
    if (!senderAddress && tx.outputs && tx.outputs.length > 1) {
      senderAddress = tx.outputs[1].verboseData?.scriptPublicKeyAddress;
    }

    // Get the recipient address from the outputs
    let recipientAddress = null;
    if (tx.outputs && tx.outputs.length > 0) {
      recipientAddress = tx.outputs[0].verboseData?.scriptPublicKeyAddress;
    }

    // If we still don't have a sender address, try to fetch it from the previous transaction
    if (!senderAddress && tx.inputs && tx.inputs.length > 0) {
      // Try all inputs to find a valid sender address
      for (let i = 0; i < tx.inputs.length; i++) {
        const input = tx.inputs[i];
        // previous_outpoint_hash
        const prevTxId = input.previousOutpoint.transactionId;
        const prevOutputIndex = input.previousOutpoint.index;

        if (prevTxId) {
          try {
            const prevTx = await this._fetchTransactionDetails(
              prevTxId,
              maxRetries
            );
            if (prevTx?.outputs && prevTx.outputs[prevOutputIndex]) {
              const output = prevTx.outputs[prevOutputIndex];
              senderAddress = output.script_public_key_address;
              break;
            }
          } catch (error) {
            console.error(
              "Error getting sender address from previous transaction:",
              error
            );
          }
        }
      }
    }

    try {
      this.ensurePasswordSet();
    } catch {
      return;
    }

    const parsed = parseKaspaMessagePayload(tx.payload);

    const messageType = parsed.type;
    const targetAlias = parsed.alias;

    // @TODO: check how to do hex manipulation properly, currently parsed.encryptedHex is a hex
    // if we want to handle base64, it would need to find a way to do from/to hex properly in JS
    // from my tests, it seems that the utils alters the hex
    const hexEncryptedPayload = tryParseBase64AsHexToHex(parsed.encryptedHex);

    const encryptedHex = hexEncryptedPayload;
    const isHandshake = parsed.type === PROTOCOL.headers.HANDSHAKE.type;

    const isMonitoredAddress =
      (senderAddress && this.monitoredAddresses.has(senderAddress)) ||
      (recipientAddress && this.monitoredAddresses.has(recipientAddress));
    const isCommForUs =
      messageType === PROTOCOL.headers.COMM.type &&
      targetAlias &&
      this.monitoredConversations.has(targetAlias);

    // For payments, check if the sender address is one we're monitoring
    // (i.e., we have a conversation with them OR they sent us a payment)
    const isPaymentForUs =
      messageType === PROTOCOL.headers.PAYMENT.type &&
      (isMonitoredAddress ||
        recipientAddress === this.receiveAddress?.toString());

    try {
      // note: same remark as earlier in the flow
      // here we should need to re-generate the key because the context should already
      // be unlocked, unless there is a logical error in the general loading strategy
      const privateKeyGenerator = WalletStorageService.getPrivateKeyGenerator(
        this.unlockedWallet,
        this.password!
      );

      let decryptionSuccess = false;

      try {
        const privateKey = privateKeyGenerator.receiveKey(0);

        const decryptedContent = decrypt_message(
          new EncryptedMessage(encryptedHex),
          new PrivateKey(privateKey.toString())
        );

        decryptionSuccess = true;

        if (decryptionSuccess) {
          DecryptionCache.markSuccess(stringWalletAddress, txId);
          if (process.env.NODE_ENV === "development") {
            console.debug(
              `Real-time: Successful decryption for ${txId} - removed from failed cache if present`
            );
          }
        } else {
          DecryptionCache.markFailed(stringWalletAddress, txId);
          if (process.env.NODE_ENV === "development") {
            console.debug(
              `Real-time: Failed decryption for ${txId} - marked as failed in cache`
            );
          }
        }

        if (
          decryptionSuccess &&
          (isHandshake || isMonitoredAddress || isCommForUs || isPaymentForUs)
        ) {
          // this hack is necessary because we have inconsistencies between data parsed at historical level
          // , at live level (here is live level), and when client is the creator of the event
          // so be "re-build" it like the other places, ideally this shouldn't be necessary
          let hackedContent = decryptedContent;

          if (parsed.type === "handshake") {
            // handhshake payload is expected to be utf-8 encoded
            hackedContent = `${PROTOCOL.prefix.string}${PROTOCOL.headers.HANDSHAKE.string}${decryptedContent}`;
          } else if (parsed.type === "message") {
            // message payload is expected to be hex encoded
            hackedContent = `${PROTOCOL.prefix.hex}${PROTOCOL.headers.COMM.hex}${toHex(parsed.alias ?? "UNKNOWN")}:${decryptedContent}`;
          } else if (parsed.type === "payment") {
            // payment payload is expected to be hex encoded
            hackedContent = `${PROTOCOL.prefix.hex}${PROTOCOL.headers.PAYMENT.hex}${decryptedContent}`;
          }

          const kasiaTransaction: KasiaTransaction = {
            transactionId: txId,
            senderAddress: senderAddress || "Unknown",
            recipientAddress: recipientAddress || "Unknown",
            createdAt: new Date(blockTime),
            // @TODO(indexdb): how to get fees?
            fee: 0,
            content: hackedContent,
            amount: Number(tx.outputs[0].value) / 100000000,
            payload: tx.payload,
          };

          console.log("kasiaTransaction from account service", {
            ...kasiaTransaction,
          });

          const messagingStore = useMessagingStore.getState();
          if (messagingStore) {
            await messagingStore.storeKasiaTransactions([kasiaTransaction]);
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    } catch (error) {
      console.error(
        `Error processing message transaction ${getTransactionId(tx)}:`,
        error
      );
    }
  }

  public async sendMessageWithContext(sendMessage: SendMessageWithContextArgs) {
    this.ensurePasswordSet();

    // Ensure we have our receive address
    if (!this.receiveAddress) {
      throw new Error("Receive address not initialized");
    }

    const minimumAmount = kaspaToSompi("0.2");

    if (!minimumAmount) {
      throw new Error("Minimum amount missing");
    }

    if (!sendMessage.toAddress) {
      throw new Error("Destination address is required");
    }

    if (!sendMessage.message) {
      throw new Error("Message is required");
    }

    if (!sendMessage.password) {
      throw new Error("Password is required");
    }

    if (!sendMessage.theirAlias) {
      throw new Error("Conversation alias is required");
    }

    // Get the conversation manager from the messaging store
    const messagingStore = useMessagingStore.getState();
    const conversationManager = messagingStore.conversationManager;
    if (!conversationManager) {
      throw new Error("Conversation manager not initialized");
    }

    // For self-messages, we still want to encrypt using the conversation partner's address
    const conversationWithContact =
      conversationManager.getConversationWithContactByAlias(
        sendMessage.theirAlias
      );
    if (!conversationWithContact) {
      throw new Error("Could not find conversation for the given alias");
    }

    console.log("Encryption details:", {
      conversationPartnerAddress: conversationWithContact.contact.kaspaAddress,
      ourAddress: this.receiveAddress?.toString(),
      theirAlias: sendMessage.theirAlias,
      destinationAddress: this.receiveAddress?.toString(),
      conversation: conversationWithContact,
    });

    // Create the payload with conversation context
    const hexString = sendMessage.message; // This is already encrypted hex
    const hexBytes = hexToBytes(hexString);
    const base64String = btoa(String.fromCharCode(...hexBytes));

    // Build the full protocol string with all components
    const protocolString = `ciph_msg:1:comm:${sendMessage.theirAlias}:${base64String}`;
    const payloadBytes = getEncoder().encode(protocolString);

    const payload = payloadBytes;

    try {
      // Always send to our own address for self-send messages
      const destinationAddress = new Address(this.receiveAddress.toString());
      // Send to our own address
      const txId = await this.createTransaction(
        {
          address: destinationAddress,
          amount: minimumAmount,
          payload: payload,
          priorityFee: sendMessage.priorityFee,
        },
        sendMessage.password
      );

      return txId;
    } catch (error) {
      console.error("Error sending message with context:", error);
      throw error;
    }
  }

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
      conversations.forEach((conv: { alias: string; address: string }) => {
        this.monitoredConversations.add(conv.alias);
        this.monitoredAddresses.set(conv.address, conv.alias);
      });
    } catch (error) {
      console.error("Error updating monitored conversations:", error);
    }
  }

  // note: account service should not be responsible for handling block added logic
  private async processBlockEvent(event: BlockAddedData) {
    try {
      const blockTime =
        Number(event?.data?.block?.header?.timestamp) || Date.now();
      const transactions = event?.data?.block?.transactions || [];

      // Process transactions silently
      const txOutputsMap = new Map<string, ITransactionOutput[]>();
      transactions.forEach((tx) => {
        if (tx.outputs && tx.verboseData?.transactionId) {
          txOutputsMap.set(tx.verboseData.transactionId, tx.outputs);
        }
      });

      // note: this should be optimized, account service shouldn't be the owner of that
      // it shouldn't be needed to refresh computation here if the owner of this would be the
      // maintainer of the shared state
      this.updateMonitoredConversations();

      for (const tx of transactions) {
        const txId = tx.verboseData?.transactionId;
        if (!txId || this.processedMessageIds.has(txId)) continue;

        if (this.isKasiaTransaction(tx)) {
          console.log("found a kasia transaction", { tx });
          // mark the txId as processed to avoid duplicate processing
          this.processedMessageIds.add(txId);
          if (this.processedMessageIds.size > this.MAX_PROCESSED_MESSAGES) {
            const oldestId = this.processedMessageIds.values().next().value;

            if (oldestId) {
              this.processedMessageIds.delete(oldestId);
            }
          }

          try {
            await this.processMessageTransaction(tx, blockTime);
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.debug("Error processing message transaction:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing block event:", error);
    }
  }
}

export const createWithdrawTransaction = async (
  toAddress: string,
  amountSompi: bigint
): Promise<void> => {
  try {
    console.log("Sending withdraw transaction:", {
      toAddress,
      amountSompi,
    });

    const walletStore = useWalletStore.getState();
    const accountService = walletStore.accountService;
    const password = walletStore.unlockedWallet?.password;

    if (!accountService) {
      throw new Error("Account service not initialized");
    }

    if (!password) {
      throw new Error("Wallet is locked. Please unlock your wallet first.");
    }

    // Create and send a native transaction (no payload)
    await accountService.createWithdrawTransaction(
      {
        address: new Address(toAddress),
        amount: amountSompi,
        priorityFee: { amount: BigInt(0), source: FeeSource.ReceiverPays },
      },
      password
    );

    console.log("Withdraw transaction sent successfully");
  } catch (error) {
    console.error("Send withdraw transaction error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to send withdraw transaction"
    );
  }
};
