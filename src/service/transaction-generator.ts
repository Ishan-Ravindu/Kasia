import {
  Address,
  UtxoContext,
  Generator,
  PaymentOutput,
  FeeSource,
  IGeneratorSettingsObject,
} from "kaspa-wasm";
import { PriorityFeeConfig } from "../types/all";

export class TransactionGeneratorService {
  /**
   * Create generator for regular transactions with payload (messages)
   */
  static createForTransaction({
    context,
    networkId,
    receiveAddress,
    destinationAddress,
    amount,
    payload,
    priorityFee,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
    destinationAddress: Address;
    amount: bigint;
    payload: string | Uint8Array;
    priorityFee?: PriorityFeeConfig;
  }): Generator {
    // Check if this is a direct self-message (sending to our own receive address)
    const isDirectSelfMessage =
      destinationAddress.toString() === receiveAddress.toString();

    console.log(isDirectSelfMessage);
    // For regular transactions, always use the specified amount and destination
    // For self-messages, use empty outputs array to only use change output
    const outputs = isDirectSelfMessage
      ? []
      : [new PaymentOutput(destinationAddress, amount)];

    const outboundPriorityFee = priorityFee ?? {
      amount: BigInt(0),
      source: FeeSource.SenderPays,
    };

    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: outputs,
      payload,
      networkId,
      feeRate: priorityFee?.feerate,
      priorityFee: outboundPriorityFee,
    };

    return new Generator(settings);
  }

  /**
   * Create generator for compound transactions (UTXO consolidation)
   */
  static createForCompound({
    context,
    networkId,
    receiveAddress,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
  }): Generator {
    // compound transaction - sweep operation to consolidate UTXOs
    // for compound tx, we pass undefined to outputs which means we dont need to specify priority fee
    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: undefined as unknown as PaymentOutput[],
      networkId,
    };

    return new Generator(settings);
  }
  /**
   * Create generator for payment and withdrawal transactions
   */
  static createForPaymentOrWithdraw({
    context,
    networkId,
    receiveAddress,
    destinationAddress,
    amount,
    payload,
    priorityFee,
    isFullBalance,
  }: {
    context: UtxoContext;
    networkId: string;
    receiveAddress: Address;
    destinationAddress: Address;
    amount: bigint;
    payload?: string | Uint8Array;
    priorityFee?: PriorityFeeConfig;
    isFullBalance?: boolean;
  }): Generator {
    // for full balance, use ReceiverPays (no choice). For partial, use SenderPays
    const finalPriorityFee = isFullBalance
      ? { amount: BigInt(0), source: FeeSource.ReceiverPays }
      : priorityFee || {
          amount: BigInt(0),
          source: FeeSource.SenderPays,
        };

    const settings: IGeneratorSettingsObject = {
      changeAddress: receiveAddress,
      entries: context,
      outputs: [new PaymentOutput(destinationAddress, amount)],
      networkId,
      priorityFee: finalPriorityFee,
      ...(payload && { payload }),
    };
    return new Generator(settings);
  }
}
