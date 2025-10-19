import { useState } from "react";
import { NetworkSelector } from "../NetworkSelector";
import { useNetworkStore } from "../../store/network.store";
import { NetworkType, ConnectionMode } from "../../types/all";
import { Button } from "../Common/Button";
import { useUiStore } from "../../store/ui.store";
import { ThemeToggle } from "../Common/ThemeToggle";
import { Shield, ArrowLeft, Coffee, Check } from "lucide-react";
import { Checkbox } from "@headlessui/react";
import { devMode } from "../../config/dev-mode";
import { deleteDB } from "idb";
import { useDBStore } from "../../store/db.store";
import { useOrchestrator } from "../../hooks/useOrchestrator";
import { AppVersion } from "../App/AppVersion";
import { Donations } from "../Common/Donations";
import {
  isIndexerDisabled,
  setIndexerDisabled,
  getIndexerUrl,
  setIndexerUrl,
  getIndexerConnectionMode,
  setIndexerConnectionMode,
  getNodeConnectionMode,
  setNodeConnectionMode,
} from "../../utils/indexer-settings";

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

  const [indexerDisabled, setIndexerDisabledState] =
    useState(isIndexerDisabled());

  // ui collapsable states
  const [showNodeSettings, setShowNodeSettings] = useState(false);
  const [showIndexerSettings, setShowIndexerSettings] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);

  // connection modes
  const [nodeConnectionMode, setNodeConnectionModeState] =
    useState<ConnectionMode>(getNodeConnectionMode());
  const [indexerConnectionMode, setIndexerConnectionModeState] =
    useState<ConnectionMode>(getIndexerConnectionMode());

  // wrapper functions that update both state and localStorage
  const updateNodeConnectionMode = (mode: ConnectionMode) => {
    setNodeConnectionModeState(mode);
    setNodeConnectionMode(mode);
  };

  const updateIndexerConnectionMode = (mode: ConnectionMode) => {
    setIndexerConnectionModeState(mode);
    setIndexerConnectionMode(mode);
  };

  const [indexerUrl, setIndexerUrlState] = useState(getIndexerUrl() || "");

  const deleteIndexDB = async () => {
    if (dbStore.db) {
      await deleteDB(dbStore.db.name);
    }

    await dbStore.initDB();
  };

  const handleIndexerDisabledChange = (disabled: boolean) => {
    setIndexerDisabled(disabled);
    setIndexerDisabledState(disabled);

    // when disabling indexer, automatically switch to AUTO mode
    if (disabled) {
      updateIndexerConnectionMode("auto");
    }
  };

  const handleIndexerUrlSave = () => {
    if (indexerConnectionMode === "auto") {
      setIndexerUrl(null);
    } else {
      setIndexerUrl(indexerUrl || null);
    }
    setShowIndexerSettings(false);
  };

  const handleIndexerUrlCancel = () => {
    setIndexerUrlState(getIndexerUrl() || "");
    setShowIndexerSettings(false);
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

    const urlToUse =
      nodeConnectionMode === "auto" ? null : nodeUrl === "" ? null : nodeUrl;

    await connectWithErrorWrapper(selectedNetwork, urlToUse);
  };

  return (
    <div className="w-full max-w-[600px]">
      {/* Main settings list - shown when no section is expanded */}
      {!showNodeSettings && !showIndexerSettings && !showDevSettings ? (
        <>
          <div className="mb-6 flex w-full justify-center">
            <ThemeToggle />
          </div>
          <h2 className="my-8 text-center text-[1.5rem] font-semibold text-[var(--text-primary)]">
            Settings
          </h2>

          <div className="space-y-2">
            {/* Node Settings Button */}
            <button
              onClick={() => setShowNodeSettings(true)}
              className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200 active:rounded-4xl"
            >
              <Shield className="h-5 w-5" />
              <div className="text-left">
                <div className="text-sm font-medium">Node Settings</div>
                <div className="text-muted-foreground text-xs">
                  Configure custom node URLs for kaspa network connection
                </div>
              </div>
            </button>

            {/* Indexer Settings Button */}
            <button
              onClick={() => setShowIndexerSettings(true)}
              className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200 active:rounded-4xl"
            >
              <Shield className="h-5 w-5" />
              <div className="text-left">
                <div className="text-sm font-medium">Indexer Settings</div>
                <div className="text-muted-foreground text-xs">
                  Configure indexer URL or disable indexer (no historical data)
                </div>
              </div>
            </button>

            {/* Dev Settings Button - only when dev mode is enabled */}
            {devMode && (
              <button
                onClick={() => setShowDevSettings(true)}
                className="bg-primary-bg hover:bg-primary-bg/50 border-primary-border flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all duration-200 active:rounded-4xl"
              >
                <Coffee className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm font-medium">Dev Settings</div>
                  <div className="text-muted-foreground text-xs">
                    Developer options and tools
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center">
            <AppVersion />
          </div>
        </>
      ) : showNodeSettings ? (
        /* Node Settings Expanded Section */
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setShowNodeSettings(false)}
              className="hover:text-primary text-muted-foreground cursor-pointer p-1 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-medium">Node Settings</h2>
          </div>

          <div className="mb-1 flex grow items-center justify-center">
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={onNetworkChange}
              isConnected={isConnected}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block">Node Connection</label>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    updateNodeConnectionMode("auto");
                    setNodeUrl("");
                    networkStore.setNodeUrl(null);
                  }}
                  className={`cursor-pointer rounded-lg border px-4 py-2 transition-all duration-200 ${
                    nodeConnectionMode === "auto"
                      ? "bg-kas-secondary border-kas-secondary text-[var(--text-primary)] shadow-md"
                      : "border-secondary-border bg-[var(--input-bg)] text-[var(--text-primary)] hover:scale-105 hover:shadow-sm active:scale-90 active:opacity-80"
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => updateNodeConnectionMode("manual")}
                  className={`cursor-pointer rounded-lg border px-4 py-2 transition-all duration-200 ${
                    nodeConnectionMode === "manual"
                      ? "bg-kas-secondary border-kas-secondary text-[var(--text-primary)] shadow-md"
                      : "border-secondary-border bg-[var(--input-bg)] text-[var(--text-primary)] hover:scale-105 hover:shadow-sm active:scale-90 active:opacity-80"
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {nodeConnectionMode === "manual" && (
              <>
                <label htmlFor="node-url" className="block">
                  Custom Node URL
                </label>
                <input
                  type="text"
                  id="node-url"
                  value={nodeUrl}
                  onChange={(e) => setNodeUrl(e.target.value)}
                  className="w-full flex-grow rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] p-2 text-[var(--text-primary)]"
                  placeholder="wss://your-own-node-url.com"
                />
              </>
            )}

            {nodeConnectionMode === "manual" && (
              <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
                <Button
                  onClick={handleSaveNodeUrl}
                  variant="primary"
                  disabled={isConnecting}
                >
                  Save
                </Button>
                <Button
                  onClick={() => closeModal("settings")}
                  variant="secondary"
                >
                  Close
                </Button>
              </div>
            )}
          </div>

          {connectionError && (
            <div className="mt-4 text-red-500">{connectionError}</div>
          )}
          {connectionSuccess && (
            <div className="text-success mt-4">
              Successfully connected to the node!
            </div>
          )}
        </>
      ) : showIndexerSettings ? (
        /* Indexer Settings Expanded Section */
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setShowIndexerSettings(false)}
              className="hover:text-primary text-muted-foreground cursor-pointer p-1 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-medium">Indexer Settings</h2>
          </div>

          <div className="my-2 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={indexerDisabled}
                onChange={handleIndexerDisabledChange}
                className="group data-[checked]:bg-kas-secondary data-[checked]:border-kas-secondary border-secondary-border size-4 cursor-pointer rounded border bg-[var(--input-bg)]"
              >
                <Check
                  className="opacity-0 group-data-[checked]:opacity-100"
                  size={12}
                  color="white"
                />
              </Checkbox>
              <span className="text-sm">
                Disable indexer (prevents loading historical data)
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block">Indexer Connection</label>
              <div className="flex justify-center gap-2">
                <button
                  disabled={indexerDisabled}
                  onClick={() => {
                    if (!indexerDisabled) {
                      updateIndexerConnectionMode("auto");
                      setIndexerUrl("");
                      setIndexerUrl(null);
                    }
                  }}
                  className={`rounded-lg border px-4 py-2 transition-all duration-200 ${
                    indexerDisabled
                      ? "cursor-default opacity-70"
                      : "cursor-pointer"
                  } ${
                    indexerConnectionMode === "auto"
                      ? "bg-kas-secondary border-kas-secondary text-[var(--text-primary)] shadow-md"
                      : "border-secondary-border bg-[var(--input-bg)] text-[var(--text-primary)] hover:scale-105 hover:shadow-sm active:scale-90 active:opacity-80"
                  }`}
                >
                  Auto
                </button>
                <button
                  disabled={indexerDisabled}
                  onClick={() => {
                    if (!indexerDisabled) {
                      updateIndexerConnectionMode("manual");
                    }
                  }}
                  className={`rounded-lg border px-4 py-2 transition-all duration-200 ${
                    indexerDisabled
                      ? "cursor-default opacity-70"
                      : "cursor-pointer"
                  } ${
                    indexerConnectionMode === "manual"
                      ? "bg-kas-secondary border-kas-secondary text-[var(--text-primary)] shadow-md"
                      : "border-secondary-border bg-[var(--input-bg)] text-[var(--text-primary)] hover:scale-105 hover:shadow-sm active:scale-90 active:opacity-80"
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {indexerConnectionMode === "manual" && (
              <>
                <label htmlFor="indexer-url" className="block">
                  Custom Indexer URL
                </label>
                <input
                  type="text"
                  id="indexer-url"
                  value={indexerUrl}
                  onChange={(e) => setIndexerUrlState(e.target.value)}
                  className="w-full flex-grow rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] p-2 text-[var(--text-primary)]"
                  placeholder="https://your-indexer-url.com"
                />
              </>
            )}

            {indexerConnectionMode === "manual" && (
              <div className="flex flex-col justify-center gap-2 sm:flex-row-reverse sm:gap-4">
                <Button onClick={handleIndexerUrlSave} variant="primary">
                  Save
                </Button>
                <Button onClick={handleIndexerUrlCancel} variant="secondary">
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </>
      ) : showDevSettings ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setShowDevSettings(false)}
              className="hover:text-primary text-muted-foreground cursor-pointer p-1 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-medium">Dev Settings</h2>
          </div>

          <div className="space-y-4">
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
        </>
      ) : null}

      {/* show donations at the home settings */}
      {!showNodeSettings && !showIndexerSettings && !showDevSettings && (
        <Donations closeModalKey="settings" />
      )}
    </div>
  );
};
