import { FC, useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
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
import { LoadingMessages } from "../components/LoadingMessages";

export const MessengerContainer: FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWalletReady, setIsWalletReady] = useState(false);
  const uiStore = useUiStore();

  // url routing
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { walletId, contactId, channelId } = params;

  const [contactsCollapsed, setContactsCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"contacts" | "messages">(
    "contacts"
  );
  const messageStore = useMessagingStore();
  const walletStore = useWalletStore();
  const {
    isBroadcastMode,
    selectedChannelName,
    setSelectedChannel,
    setIsBroadcastMode,
  } = useBroadcastStore();
  const setAttachment = useComposerStore((s) => s.setAttachment);

  const isMobile = useIsMobile();
  const { closeAllModals } = useUiStore();

  // determine if we're in broadcast mode based on url
  const isCurrentlyInBroadcastMode = location.pathname.includes("/bcast");

  // helper function to find contact address from contactid
  const getContactAddressFromId = (contactId: string): string | null => {
    const contact = messageStore.oneOnOneConversations.find(
      (oooc) => oooc.contact.id === contactId
    );
    return contact?.contact.kaspaAddress || null;
  };

  // helper function to find channel name from channelid
  const getChannelNameFromId = (channelId: string): string | null => {
    const { channels } = useBroadcastStore.getState();
    const channel = channels.find((ch) => ch.id === channelId);
    return channel?.channelName || null;
  };

  // get the actual contact address from the url parameter
  const contactAddress = contactId ? getContactAddressFromId(contactId) : null;

  // get the actual channel name from the url parameter
  const channelName = channelId ? getChannelNameFromId(channelId) : null;

  // effect to sync broadcast mode with url
  useEffect(() => {
    if (isCurrentlyInBroadcastMode !== isBroadcastMode) {
      setIsBroadcastMode(isCurrentlyInBroadcastMode);
    }
  }, [isCurrentlyInBroadcastMode, isBroadcastMode, setIsBroadcastMode]);

  // effect to sync selected contact with url and save to localstorage
  useEffect(() => {
    if (contactAddress && contactAddress !== messageStore.openedRecipient) {
      messageStore.setOpenedRecipient(contactAddress);

      // save to localstorage for persistence (store contactid, not address)
      const walletAddress = walletStore.address?.toString();
      if (walletAddress && contactId) {
        localStorage.setItem(
          `kasia_last_opened_contact_id_${walletAddress}`,
          contactId
        );
      }
    } else if (!contactAddress && messageStore.openedRecipient) {
      messageStore.setOpenedRecipient(null);
    }
  }, [
    contactAddress,
    contactId,
    messageStore.openedRecipient,
    messageStore,
    walletStore.address,
  ]);

  // effect to sync selected channel with url
  useEffect(() => {
    if (channelName && channelName !== selectedChannelName) {
      setSelectedChannel(channelName);
    } else if (
      !channelName &&
      selectedChannelName &&
      isCurrentlyInBroadcastMode
    ) {
      setSelectedChannel(null);
    }
  }, [
    channelName,
    selectedChannelName,
    setSelectedChannel,
    isCurrentlyInBroadcastMode,
  ]);

  // effect to handle invalid contact/channel urls (redirect to fallback)
  useEffect(() => {
    if (!messageStore.isLoaded || !walletStore.isAccountServiceRunning) return;

    // check if contactid exists in conversations
    if (contactId && !isCurrentlyInBroadcastMode) {
      const contactExists = messageStore.oneOnOneConversations.some(
        (oooc) => oooc.contact.id === contactId
      );

      if (!contactExists) {
        console.warn(
          `Contact with ID ${contactId} not found, redirecting to directs`
        );
        navigate(`/${walletId}/directs`, { replace: true });
      }
    }

    // check if channelid exists in broadcast channels (for broadcast mode)
    if (channelId && isCurrentlyInBroadcastMode) {
      const { channels } = useBroadcastStore.getState();
      const channelExists = channels.some(
        (channel) => channel.id === channelId
      );

      if (!channelExists) {
        console.warn(
          `Broadcast channel with ID ${channelId} not found, redirecting to broadcasts`
        );
        navigate(`/${walletId}/bcast`, { replace: true });
      }
    }
  }, [
    contactId,
    channelId,
    isCurrentlyInBroadcastMode,
    messageStore.isLoaded,
    messageStore.oneOnOneConversations,
    walletStore.isAccountServiceRunning,
    navigate,
    walletId,
  ]);

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

  const onContactClicked = (contact: Contact) => {
    if (!walletStore.address) {
      console.error("No wallet address");
      return;
    }

    // navigate to the contact's URL using contact ID instead of address
    navigate(`/${walletId}/directs/${contact.id}`);
  };

  const onModeChange = (isBroadcastMode: boolean) => {
    if (isBroadcastMode) {
      // avigate to broadcast mode
      navigate(`/${walletId}/bcast`);
    } else {
      // navigate to direct messages mode
      navigate(`/${walletId}/directs`);
    }
  };

  // effect to save selected channel ID to localStorage for persistence
  useEffect(() => {
    if (channelId && selectedChannelName) {
      const walletAddress = walletStore.address?.toString();
      if (walletAddress) {
        localStorage.setItem(
          `kasia_last_opened_channel_id_${walletAddress}`,
          channelId
        );
      }
    }
  }, [channelId, selectedChannelName, walletStore.address]);

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
                      navigate(`/${walletId}/bcast`);
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
                      navigate(`/${walletId}/bcast`);
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
      {/* global error Section*/}
      <ErrorCard error={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </>
  );
};
