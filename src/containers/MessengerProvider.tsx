import { FC, useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router";
import { ErrorCard } from "../components/ErrorCard";
import { useMessagingStore } from "../store/messaging.store";
import { useWalletStore } from "../store/wallet.store";
import { useUiStore } from "../store/ui.store";
import { useBroadcastStore } from "../store/broadcast.store";
import { useComposerStore } from "../store/message-composer.store";
import { useLiveStore } from "../store/live.store";
import { useMessengerRouting } from "../hooks/useMessengerRouting";
import { useMobileViewManager } from "../hooks/useMobileViewManager";
import { SidebarSection } from "../components/SideBarPane/SidebarSection";
import { LoadingMessages } from "../components/LoadingMessages";

export const MessengerProvider: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

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
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();

  // use mobile view manager hook
  const { mobileView, setMobileView, isMobile } = useMobileViewManager(
    contactId,
    channelId,
    isCurrentlyInBroadcastMode,
    messageStore.isLoaded
  );

  // Ensure contacts are not collapsed on mobile
  useEffect(() => {
    if (isMobile && contactsCollapsed) {
      setContactsCollapsed(false);
    }
  }, [isMobile, contactsCollapsed]);

  const navigate = useNavigate();

  useEffect(() => {
    if (walletStore.unlockedWallet) setIsWalletReady(true);
  }, [walletStore.unlockedWallet]);

  // TODO: eventually refactor this and the UE below this one.
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
    messageStore.oneOnOneConversations,
    walletStore.isAccountServiceRunning,
    walletStore.address,
    isMobile,
    isCurrentlyInBroadcastMode,
    navigate,
    walletId,
  ]);

  // effect to restore last opened broadcast channel after messages are loaded (desktop only)
  useEffect(() => {
    if (
      !isMobile &&
      messageStore.isLoaded &&
      walletStore.isAccountServiceRunning &&
      !channelId &&
      isCurrentlyInBroadcastMode &&
      useBroadcastStore.getState().channels.length > 0
    ) {
      const walletAddress = walletStore.address?.toString();
      if (walletAddress) {
        try {
          // get the last opened channel id from localstorage
          const lastOpenedChannelId = localStorage.getItem(
            `kasia_last_opened_channel_id_${walletAddress}`
          );

          if (lastOpenedChannelId) {
            // check if the channel still exists
            const broadcastStore = useBroadcastStore.getState();
            const channelExists = broadcastStore.channels.some(
              (channel) => channel.id === lastOpenedChannelId
            );

            if (channelExists) {
              navigate(`/${walletId}/broadcasts/${lastOpenedChannelId}`, {
                replace: true,
              });
              return;
            }
          }

          // fallback: select the first available channel
          const firstChannel = useBroadcastStore.getState().channels[0];
          if (firstChannel) {
            navigate(`/${walletId}/broadcasts/${firstChannel.id}`, {
              replace: true,
            });
          }
        } catch (error) {
          console.error(
            "Error restoring last opened broadcast channel:",
            error
          );
        }
      }
    }
  }, [
    messageStore.isLoaded,
    channelId,
    isCurrentlyInBroadcastMode,
    walletStore.isAccountServiceRunning,
    walletStore.address,
    isMobile,
    navigate,
    walletId,
  ]);

  // cleanup effect - only runs when leaving the entire messaging area
  useEffect(() => {
    return () => {
      const messageStore = useMessagingStore.getState();
      const walletStore = useWalletStore.getState();
      const uiStore = useUiStore.getState();
      const composerStore = useComposerStore.getState();

      messageStore.stop();
      walletStore.lock();
      uiStore.setSettingsOpen(false);
      uiStore.closeAllModals();
      messageStore.setOpenedRecipient(null);

      // clear broadcast store state when leaving messaging
      useBroadcastStore.getState().reset();
      useLiveStore.getState().stop();
      composerStore.setAttachment(null);
    };
  }, []);

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
              <Outlet />
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
