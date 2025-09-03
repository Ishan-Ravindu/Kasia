import { LoaderCircle } from "lucide-react";
import { FC, useState, useEffect, useCallback } from "react";
import { ErrorCard } from "../components/ErrorCard";
import { useMessagingStore } from "../store/messaging.store";
import { useUiStore } from "../store/ui.store";
import { useWalletStore } from "../store/wallet.store";
import { useIsMobile } from "../hooks/useIsMobile";
import { SidebarSection } from "../components/SideBarPane/SidebarSection";
import { DirectsSection } from "../components/MessagesPane/DirectsSection";
import { BroadcastSection } from "../components/MessagesPane/BroadcastSection";
import { Contact } from "../store/repository/contact.repository";
import { useBroadcastStore } from "../store/broadcast.store";
import { useComposerStore } from "../store/message-composer.store";

export const MessengerContainer: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const uiStore = useUiStore();

  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"contacts" | "messages">(
    "contacts"
  );
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const { isBroadcastMode, selectedChannelName } = useBroadcastStore();
  const setAttachment = useComposerStore((s) => s.setAttachment);

  const isMobile = useIsMobile();
  const { closeAllModals } = useUiStore();

  // while we load and start message client, keep it interesting
  const loadingMessages = [
    { delay: 0, message: "Starting the message client..." },
    { delay: 5000, message: "Loading your message history..." },
    {
      delay: 10000,
      message:
        "Still loading... \nFun Fact: Kaspa has processed 100 blocks since you started loading.",
    },
    { delay: 14000, message: "Still loading... \nActually.. 140..." },
    { delay: 18000, message: "Still loading... \nNow.. 180..." },
    {
      delay: 20000,
      message: "Yep, still loading... \nOk, now its too many blocks to count.",
    },
    {
      delay: 25000,
      message:
        "Yep, still loading... \nWe just didnt expect you to talk to so many people.\nDon't worry, we will fix this long wait soon.",
    },
  ];

  const [loadingMessage, setLoadingMessage] = useState(
    loadingMessages[0].message
  );

  useEffect(() => {
    if (walletStore.unlockedWallet) setIsWalletReady(true);
  }, [walletStore.unlockedWallet]);

  // Effect to handle if you drag from desktop to mobile, we need the mobile view to be aware!
  useEffect(() => {
    const syncToWidth = () => {
      if (isMobile) {
        // On mobile, show messages if there's an opened conversation or broadcast channel
        const hasOpenedConversation = messageStore.openedRecipient;
        const hasOpenedBroadcast = isBroadcastMode && selectedChannelName;

        if (hasOpenedConversation || hasOpenedBroadcast) {
          setMobileView("messages");
        } else {
          setMobileView("contacts");
        }
      } else {
        setMobileView("contacts");
      }
    };

    syncToWidth(); // run once on mount
    window.addEventListener("resize", syncToWidth);
    return () => window.removeEventListener("resize", syncToWidth);
  }, [
    messageStore.openedRecipient,
    isMobile,
    isBroadcastMode,
    selectedChannelName,
  ]);

  // Clean up useEffect
  useEffect(() => {
    return () => {
      messageStore.stop();

      // Called when MessagingContainer unmounts (user leaves route), so we can reset all the states
      walletStore.lock();
      uiStore.setSettingsOpen(false);
      closeAllModals();

      messageStore.setOpenedRecipient(null);

      // Clear broadcast store state when leaving messaging
      useBroadcastStore.getState().reset();

      // clear any attachments
      setAttachment(null);
    };
  }, []);

  useEffect(() => {
    if (
      isWalletReady &&
      (!messageStore.isLoaded || !walletStore.isAccountServiceRunning)
    ) {
      setLoadingMessage(loadingMessages[0].message);
      const timeouts = loadingMessages
        .slice(1)
        .map(({ delay, message }) =>
          setTimeout(() => setLoadingMessage(message), delay)
        );
      return () => {
        timeouts.forEach(clearTimeout);
      };
    }
  }, [
    isWalletReady,
    messageStore.isLoaded,
    walletStore.isAccountServiceRunning,
  ]);

  // Effect to restore last opened conversation after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      walletStore.isAccountServiceRunning &&
      !messageStore.openedRecipient &&
      messageStore.oneOnOneConversations.length > 0
    ) {
      const walletAddress = walletStore.address?.toString();
      if (walletAddress) {
        messageStore.restoreLastOpenedRecipient(walletAddress);
      }
    }
  }, [
    messageStore.isLoaded,
    messageStore.openedRecipient,
    messageStore.oneOnOneConversations.length,
    walletStore.isAccountServiceRunning,
    walletStore.address,
    messageStore,
    isMobile,
  ]);

  // Effect to update mobile view when opened recipient or broadcast channel changes
  useEffect(() => {
    if (isMobile && messageStore.isLoaded) {
      const hasOpenedConversation = messageStore.openedRecipient;
      const hasOpenedBroadcast = isBroadcastMode && selectedChannelName;

      if (hasOpenedConversation || hasOpenedBroadcast) {
        setMobileView("messages");
      } else {
        setMobileView("contacts");
      }
    }
  }, [
    isMobile,
    messageStore.openedRecipient,
    messageStore.isLoaded,
    isBroadcastMode,
    selectedChannelName,
  ]);

  const onContactClicked = useCallback(
    (contact: Contact) => {
      if (!walletStore.address) {
        console.error("No wallet address");
        return;
      }

      messageStore.setOpenedRecipient(contact.kaspaAddress);
    },
    [messageStore, walletStore.address]
  );

  return (
    <>
      {/* Main Message Section*/}
      <div className="bg-primary-bg flex items-center">
        <div className="flex h-[100dvh] w-full overflow-hidden sm:h-[calc(100dvh-69px)]">
          {isWalletReady &&
          messageStore.isLoaded &&
          walletStore.isAccountServiceRunning ? (
            <>
              <SidebarSection
                onContactClicked={onContactClicked}
                openedRecipient={messageStore.openedRecipient}
                walletAddress={walletStore.address?.toString()}
                mobileView={mobileView}
                contactsCollapsed={contactsCollapsed}
                setContactsCollapsed={setContactsCollapsed}
                setMobileView={setMobileView}
              />
              {isBroadcastMode ? (
                <BroadcastSection
                  mobileView={mobileView}
                  setMobileView={setMobileView}
                />
              ) : (
                <DirectsSection
                  mobileView={mobileView}
                  setMobileView={setMobileView}
                />
              )}
            </>
          ) : isWalletReady ? (
            <div className="flex w-full flex-col items-center text-xs">
              {/* If wallet is unlocked but message are not loaded, show the loading state*/}
              <div className="border-primary-border bg-secondary-bg relative h-full w-full overflow-hidden border-t">
                <div className="bg-secondary-bg/20 absolute inset-0" />
                <div className="relative flex h-full flex-col items-center justify-center space-y-4 select-none">
                  <span className="text-text-secondary text-center text-sm font-medium tracking-wide whitespace-pre-line sm:text-lg">
                    {loadingMessage}
                  </span>
                  <LoaderCircle className="text-text-secondary h-14 w-14 animate-spin" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center">
              <div className="text-center">
                <p className="mb-2 text-lg font-semibold">Wallet not ready</p>
                <p className="text-text-primary text-sm">
                  Please unlock your wallet first
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Global Error Section*/}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </>
  );
};
