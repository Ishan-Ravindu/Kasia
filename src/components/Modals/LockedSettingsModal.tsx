import { useState } from "react";
import { NetworkSelector } from "../NetworkSelector";
import { useNetworkStore } from "../../store/network.store";
import { NetworkType } from "../../types/all";
import { Button } from "../Common/Button";
import { useUiStore } from "../../store/ui.store";
import { ThemeToggle } from "../Common/ThemeToggle";
import { Shield } from "lucide-react";
import { devMode } from "../../config/dev-mode";
import { deleteDB } from "idb";
import { useDBStore } from "../../store/db.store";
import { useOrchestrator } from "../../hooks/useOrchestrator";
import { AppVersion } from "../App/AppVersion";

export const LockedSettingsModal: React.FC = () => {
  const networkStore = useNetworkStore();
  const selectedNetwork = useNetworkStore((state) => state.network);
  const isConnected = useNetworkStore((state) => state.isConnected);
  const isConnecting = useNetworkStore((state) => state.isConnecting);
  const { connect } = useOrchestrator();

  const closeModal = useUiStore((s) => s.closeModal);

  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const dbStore = useDBStore();

  const [nodeUrl, setNodeUrl] = useState(
    networkStore.nodeUrl ??
      localStorage.getItem(`kasia_node_url_${selectedNetwork}`) ??
      ""
  );

  const [connectionError, setConnectionError] = useState<string | undefined>();

  const deleteIndexDB = async () => {
    if (dbStore.db) {
      await deleteDB(dbStore.db.name);
    }

    await dbStore.initDB();
  };

  const devInfo = () => {
    if (!devMode) {
      return null;
    }

    return (
      <div className="my-4 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="text-sm">Dev mode enabled</span>
        </div>

        <div className="my-2">
          <Button onClick={() => deleteIndexDB()} variant="primary">
            Delete IndexDB
          </Button>
        </div>
      </div>
    );
  };

  const connectWithErrorWrapper = async (
    networkType: NetworkType,
    nodeUrl?: string | null
  ) => {
    try {
      await connect({
        networkType,
        nodeUrl,
      });
      setConnectionSuccess(true);
      setConnectionError(undefined);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : `${error}`);
      setConnectionSuccess(false);
    }
  };

  const onNetworkChange = (network: NetworkType) => {
    setConnectionSuccess(false);

    const savedNetwork = localStorage.getItem(`kasia_node_url_${network}`);

    setNodeUrl(savedNetwork ?? "");

    connectWithErrorWrapper(network, savedNetwork ?? null);
  };

  const handleSaveNodeUrl = async () => {
    setConnectionSuccess(false);

    if (isConnecting) {
      return;
    }

    await connectWithErrorWrapper(
      selectedNetwork,
      nodeUrl === "" ? null : nodeUrl
    );
  };

  return (
    <div className="w-full max-w-[600px]">
      <div className="mb-6 flex w-full justify-center md:hidden">
        <ThemeToggle />
      </div>
      <div className="mb-1 flex grow items-center justify-center">
        <NetworkSelector
          selectedNetwork={selectedNetwork}
          onNetworkChange={onNetworkChange}
          isConnected={isConnected}
        />
      </div>

      <h2 className="my-8 text-center text-[1.5rem] font-semibold text-[var(--text-primary)]">
        Network Settings
      </h2>

      <label htmlFor="node-url" className="mb-4 block">
        Force using a node url for the selected network
      </label>
      <div className="flex w-full flex-col items-stretch gap-6">
        <input
          type="text"
          id="node-url"
          value={nodeUrl}
          onChange={(e) => setNodeUrl(e.target.value)}
          className="w-full flex-grow rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] p-2 text-[var(--text-primary)]"
          placeholder="wss://your-own-node-url.com"
        />
        <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
          <Button
            onClick={handleSaveNodeUrl}
            variant="primary"
            disabled={isConnecting}
          >
            Save
          </Button>
          <Button onClick={() => closeModal("settings")} variant="secondary">
            Close
          </Button>
        </div>
      </div>
      {connectionError && (
        <div className="mt-4 text-red-500">{connectionError}</div>
      )}
      {connectionSuccess && (
        <div className="text-success mt-4">
          Successfully connected to the node!
        </div>
      )}

      <div className="mt-4 flex items-center justify-center">
        <AppVersion />
      </div>

      {devInfo()}
    </div>
  );
};
