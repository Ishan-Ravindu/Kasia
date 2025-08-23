import { useState } from "react";
import { useWalletStore } from "../../store/wallet.store";
import { UtxoCompound } from "./UtxoCompound";

type FrozenBalance = {
  matureUtxoCount: number;
  matureDisplay: string;
};

export const WalletInfo = () => {
  const [frozenBalance, setFrozenBalance] = useState<FrozenBalance | null>(
    null
  );

  const unlockedWalletName = useWalletStore(
    (state) => state.unlockedWallet?.name
  );
  const walletBalance = useWalletStore((s) => s.balance);

  // use frozen balance if available, otherwise use current balance
  const currentBalance = frozenBalance
    ? {
        ...walletBalance,
        matureUtxoCount: frozenBalance.matureUtxoCount,
        matureDisplay: frozenBalance.matureDisplay,
      }
    : walletBalance;

  return (
    <div className="m-2 sm:m-4">
      <div className="border-kas-secondary bg-kas-secondary/5 mb-4 rounded-2xl border p-4">
        <div className="mb-2 flex flex-col items-center sm:flex-row sm:justify-start">
          <h4 className="text-text-primary me-2 font-bold">Wallet Name:</h4>
          <div className="text-base font-semibold">{unlockedWalletName}</div>
        </div>
        <div className="flex flex-col items-center sm:flex-row sm:justify-start">
          <h4 className="text-text-primary me-2 font-bold">Balance:</h4>
          <div>
            <span className="font-semibold text-[var(--accent-green)]">
              {currentBalance?.matureDisplay} KAS
            </span>
          </div>
        </div>
      </div>

      {((currentBalance?.matureUtxoCount ?? 0) > 0 ||
        (currentBalance?.pendingUtxoCount ?? 0) > 0) && (
        <div className="border-primary-border bg-primary-bg mb-4 rounded-2xl border p-4">
          <h4 className="text-text-primary mb-2 text-center font-bold sm:text-left">
            UTXO Information
          </h4>
          <ul className="my-0 flex list-none flex-col gap-1 p-0 text-sm">
            <li className="flex flex-col items-center sm:flex-row sm:justify-start">
              <strong className="me-2">Mature UTXOs:</strong>{" "}
              <span className="rounded-xl bg-[var(--kas-primary)] px-2 font-bold text-[var(--text-primary)]">
                {frozenBalance?.matureUtxoCount ??
                  currentBalance?.matureUtxoCount ??
                  "-"}
              </span>
            </li>
            <li className="flex flex-col items-center sm:flex-row sm:justify-start">
              <strong className="me-2">Pending UTXOs:</strong>{" "}
              <span className="rounded-xl bg-[var(--kas-primary)] px-2 font-bold text-[var(--text-primary)]">
                {currentBalance?.pendingUtxoCount ?? "-"}
              </span>
            </li>
            {((currentBalance?.matureUtxoCount ?? 0) > 0 ||
              (currentBalance?.pendingUtxoCount ?? 0) > 0) && (
              <li className="flex flex-col items-center sm:flex-row sm:justify-start">
                <strong className="me-2">Status:</strong>{" "}
                <span className="status">
                  {!currentBalance?.matureUtxoCount
                    ? "Initializing..."
                    : "Ready"}
                </span>
              </li>
            )}
          </ul>
          <UtxoCompound onFrozenBalanceChange={setFrozenBalance} />
        </div>
      )}
    </div>
  );
};
