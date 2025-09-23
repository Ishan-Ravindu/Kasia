import { Settings, ChevronRight } from "lucide-react";
import { NetworkSelector } from "../NetworkSelector";
import { TrustMessage } from "../Layout/TrustMessage";
import { Button } from "../Common/Button";
import { HoldToDelete } from "../Common/HoldToDelete";
import { Wallet } from "../../types/wallet.type";
import { NetworkType } from "../../types/all";
import { ModalType } from "../../store/ui.store";
import clsx from "clsx";

type HomeProps = {
  wallets: Wallet[];
  selectedNetwork: NetworkType;
  onNetworkChange: (network: NetworkType) => void;
  isConnected: boolean;
  isConnecting: boolean;
  onSelectWallet: (wallet: Wallet) => void;
  onDeleteWallet: (walletId: string) => void;
  onStepChange: (
    type:
      | "home"
      | "create"
      | "import"
      | "unlock"
      | "seed"
      | "success"
      | "unlocked",
    walletId?: string
  ) => void;
  openModal: (modal: ModalType) => void;
  isMobile: boolean;
};

export const Home = ({
  wallets,
  selectedNetwork,
  onNetworkChange,
  isConnected,
  isConnecting,
  onSelectWallet,
  onDeleteWallet,
  onStepChange,
  openModal,
  isMobile,
}: HomeProps) => {
  return (
    <>
      <button
        onClick={() => openModal("settings")}
        className="absolute top-4 right-4 size-6 text-[var(--text-secondary)] hover:cursor-pointer hover:opacity-80 active:scale-90"
      >
        <Settings className="size-6" />
      </button>
      <div
        className={clsx(
          "mb-1 flex items-center justify-center",
          isMobile ? "grow-0" : "grow"
        )}
      >
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
          isConnecting={isConnecting}
        />
      </div>
      <TrustMessage />
      <h2 className="text-text-primary mt-2 mb-2 text-center text-xl font-semibold select-none sm:mt-2 sm:mb-3 sm:text-2xl">
        {wallets.length <= 0 ? "No Wallets Found" : "Select Wallet"}
      </h2>
      <div className="mb-3 flex flex-col gap-2 overflow-y-auto sm:gap-3">
        {wallets.map((w) => (
          <div
            key={w.id}
            onClick={() => onSelectWallet(w)}
            tabIndex={0}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onSelectWallet(w)
            }
            className="hover:border-kas-secondary border-primary-border group focus-visible:ring-kas-secondary relative flex min-h-14 cursor-pointer flex-col items-center gap-2 rounded-xl border bg-[var(--primary-bg)] p-3 pr-16 text-center transition-all duration-200 outline-none hover:bg-[var(--primary-bg)]/50 hover:shadow-sm focus-visible:ring-2 active:rounded-4xl sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:pr-20 sm:text-left"
          >
            <div className="flex w-full flex-col items-center gap-1 sm:flex-1 sm:items-start">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="max-w-full truncate font-semibold text-[var(--text-primary)] sm:max-w-lg">
                  {w.name}
                </span>
                <span
                  className={clsx(
                    "rounded-3xl border px-2 py-0.5 text-xs leading-none font-medium",
                    {
                      "bg-kas-secondary/20 border-kas-secondary text-[var(--text-primary)]": true,
                    }
                  )}
                  title="Kaspium Compatible"
                >
                  Standard
                </span>
              </div>

              <time
                className="text-xs text-[var(--text-secondary)] sm:text-[13px]"
                dateTime={new Date(w.createdAt).toISOString()}
              >
                Created: {new Date(w.createdAt).toLocaleDateString()}
              </time>
            </div>

            <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-3">
              <HoldToDelete
                onComplete={() => onDeleteWallet(w.id)}
                size="md"
                className="z-20 text-[var(--text-secondary)] transition-all duration-600 sm:opacity-0 sm:group-hover:opacity-70"
                title="Click and hold to delete wallet"
                hoverClass="hover:text-red-500"
              />
              <ChevronRight
                aria-hidden
                className="pointer-events-none hidden size-6 text-[var(--text-secondary)] opacity-40 transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
        <Button variant="primary" onClick={() => onStepChange("create")}>
          Create New Wallet
        </Button>
        <Button variant="secondary" onClick={() => onStepChange("import")}>
          Import Wallet
        </Button>
      </div>
    </>
  );
};
