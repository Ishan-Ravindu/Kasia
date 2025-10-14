import { useEffect, useState } from "react";
import { useNetworkStore } from "../../store/network.store";
import { WifiOff, Wifi } from "lucide-react";
import clsx from "clsx";

export const ConnectionIndicator = () => {
  const networkStore = useNetworkStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (networkStore.isConnected) {
      setIsVisible(true);
      // hide after 5 seconds
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [networkStore.isConnected]);

  // show red wifi-off icon when disconnected
  if (!networkStore.isConnected) {
    return <WifiOff className={clsx("size-5 text-[var(--accent-red)]")} />;
  }

  // show green wifi icon when connected and within fade period, otherwise nothing
  return isVisible ? (
    <Wifi
      className={clsx("size-5 text-[var(--accent-green)]")}
      style={{ animation: "fadeOut 5s ease-in-out forwards" }}
    />
  ) : null;
};
