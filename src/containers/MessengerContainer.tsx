import { FC, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ErrorCard } from "../components/ErrorCard";
import { useMessagingStore } from "../store/messaging.store";
import { useUiStore } from "../store/ui.store";
import { useWalletStore } from "../store/wallet.store";
import { useIsMobile } from "../hooks/useIsMobile";
import { useMessengerRouting } from "../hooks/useMessengerRouting";
import { SidebarSection } from "../components/SideBarPane/SidebarSection";
import { DirectsSection } from "../components/MessagesPane/DirectsSection";
import { BroadcastSection } from "../components/MessagesPane/BroadcastSection";
import { useBroadcastStore } from "../store/broadcast.store";
import { useComposerStore } from "../store/message-composer.store";
import { LoadingMessages } from "../components/LoadingMessages";

export const MessengerContainer: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const uiStore = useUiStore();

  // use routing hook for all url-related logic
  const {
    walletId,
    contactId,
    channelId,
    isCurrentlyInBroadcastMode,
    onContactClicked,
    onModeChange,
  } = useMessengerRouting();

  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"contacts" | "messages">(
    "contacts"
  );
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const { isBroadcastMode } = useBroadcastStore();
  const setAttachment = useComposerStore((s) => s.setAttachment);

  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { closeAllModals } = useUiStore();

  useEffect(() => {
    if (walletStore.unlockedWallet) setIsWalletReady(true);
  }, [walletStore.unlockedWallet]);

  // effect to handle if you drag from desktop to mobile, we need the mobile view to be aware!
  useEffect(() => {
    const syncToWidth = () => {
      if (isMobile) {
        // on mobile, show messages if there's an opened conversation or broadcast channel (based on url)
        const hasOpenedConversation = contactId;
        const hasOpenedBroadcast = isCurrentlyInBroadcastMode && channelId;

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
  }, [contactId, channelId, isMobile, isCurrentlyInBroadcastMode]);

  // store cleanup functions in refs to avoid re-renders
  const cleanupFnsRef = useRef({
    messageStore,
    walletStore,
    uiStore,
    closeAllModals,
    setAttachment,
  });

  // update refs when dependencies change
  useEffect(() => {
    cleanupFnsRef.current = {
      messageStore,
      walletStore,
      uiStore,
      closeAllModals,
      setAttachment,
    };
  });

  // clean up useeffect
  useEffect(() => {
    return () => {
      const fns = cleanupFnsRef.current;
      fns.messageStore.stop();

      // called when messagingcontainer unmounts (user leaves route), so we can reset all the states
      fns.walletStore.lock();
      fns.uiStore.setSettingsOpen(false);
      fns.closeAllModals();

      fns.messageStore.setOpenedRecipient(null);

      // clear broadcast store state when leaving messaging
      useBroadcastStore.getState().reset();

      // clear any attachments
      fns.setAttachment(null);
    };
  }, []);

  // effect to restore last opened conversation after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      walletStore.isAccountServiceRunning &&
      !contactId && // no contact selected in url
      messageStore.oneOnOneConversations.length > 0 &&
      !isCurrentlyInBroadcastMode // only for direct messages
    ) {
      const walletAddress = walletStore.address?.toString();
      if (walletAddress) {
        // helper function to find contact id from address
        const getContactIdFromAddress = (address: string): string | null => {
          const contact = messageStore.oneOnOneConversations.find(
            (oooc) => oooc.contact.kaspaAddress === address
          );
          return contact?.contact.id || null;
        };

        // get the last opened contact id from localstorage
        try {
          let lastOpenedContactId = localStorage.getItem(
            `kasia_last_opened_contact_id_${walletAddress}`
          );

          // fallback: try to migrate from old address-based storage
          if (!lastOpenedContactId) {
            const lastOpenedAddress = localStorage.getItem(
              `kasia_last_opened_recipient_${walletAddress}`
            );
            if (lastOpenedAddress) {
              lastOpenedContactId = getContactIdFromAddress(lastOpenedAddress);
              if (lastOpenedContactId) {
                // migrate to new storage format
                localStorage.setItem(
                  `kasia_last_opened_contact_id_${walletAddress}`,
                  lastOpenedContactId
                );
                // clean up old storage
                localStorage.removeItem(
                  `kasia_last_opened_recipient_${walletAddress}`
                );
              }
            }
          }

          if (lastOpenedContactId) {
            // check if the contact still exists
            const contactExists = messageStore.oneOnOneConversations.some(
              (oooc) => oooc.contact.id === lastOpenedContactId
            );

            if (contactExists) {
              navigate(`/${walletId}/directs/${lastOpenedContactId}`, {
                replace: true,
              });
              return;
            }
          }

          // fallback: select the first available contact
          const firstContact = messageStore.oneOnOneConversations[0]?.contact;
          if (firstContact) {
            navigate(`/${walletId}/directs/${firstContact.id}`, {
              replace: true,
            });
          }
        } catch (error) {
          console.error("Error restoring last opened contact:", error);
        }
      }
    }
  }, [
    messageStore.isLoaded,
    contactId,
    channelId,
    messageStore.oneOnOneConversations,
    walletStore.isAccountServiceRunning,
    walletStore.address,
    isMobile,
    isCurrentlyInBroadcastMode,
    navigate,
    walletId,
  ]);

  // effect to update mobile view when URL changes (contact/channel selection)
  useEffect(() => {
    if (isMobile && messageStore.isLoaded) {
      const hasOpenedConversation = contactId;
      const hasOpenedBroadcast = isCurrentlyInBroadcastMode && channelId;

      if (hasOpenedConversation || hasOpenedBroadcast) {
        setMobileView("messages");
      } else {
        setMobileView("contacts");
      }
    }
  }, [
    isMobile,
    contactId,
    channelId,
    messageStore.isLoaded,
    messageStore.oneOnOneConversations,
    isCurrentlyInBroadcastMode,
  ]);

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
                onModeChange={onModeChange}
                openedRecipient={messageStore.openedRecipient}
                walletAddress={walletStore.address?.toString()}
                mobileView={mobileView}
                contactsCollapsed={contactsCollapsed}
                setContactsCollapsed={setContactsCollapsed}
                setMobileView={(view) => {
                  setMobileView(view);
                  // when switching to contacts view on mobile, navigate back to the appropriate base route
                  if (isMobile && view === "contacts") {
                    if (isCurrentlyInBroadcastMode) {
                      navigate(`/${walletId}/broadcasts`);
                    } else {
                      navigate(`/${walletId}/directs`);
                    }
                  }
                }}
              />
              {isBroadcastMode ? (
                <BroadcastSection
                  mobileView={mobileView}
                  setMobileView={(view) => {
                    setMobileView(view);
                    // when switching to contacts view on mobile, navigate back to broadcast base route
                    if (isMobile && view === "contacts") {
                      navigate(`/${walletId}/broadcasts`);
                    }
                  }}
                />
              ) : (
                <DirectsSection
                  mobileView={mobileView}
                  setMobileView={(view) => {
                    setMobileView(view);
                    // when switching to contacts view on mobile, navigate back to directs base route
                    if (isMobile && view === "contacts") {
                      navigate(`/${walletId}/directs`);
                    }
                  }}
                />
              )}
            </>
          ) : isWalletReady ? (
            <LoadingMessages />
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
      {/* global error section */}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </>
  );
};
