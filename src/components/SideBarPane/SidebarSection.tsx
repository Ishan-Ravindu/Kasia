import { FC, useState } from "react";
import { Menu, Search, Plus, X, Radio, MessageCircle } from "lucide-react";
import clsx from "clsx";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUiStore } from "../../store/ui.store";
import { useBroadcastStore } from "../../store/broadcast.store";
import { DesktopMenu } from "../Layout/DesktopMenu";
import { Contact } from "../../store/repository/contact.repository";
import { ContactList } from "./ContactList";
import { BroadcastList } from "./BroadcastList";
import { useFeatureFlagsStore } from "../../store/featureflag.store";
import { ModeSelector } from "../ModeSelector";

interface SidebarSectionProps {
  contacts: Contact[];
  onContactClicked: (contact: Contact) => void;
  openedRecipient: string | null;
  walletAddress: string | undefined;
  mobileView: "contacts" | "messages";
  contactsCollapsed: boolean;
  setContactsCollapsed: (v: boolean) => void;
  setMobileView: (v: "contacts" | "messages") => void;
}

export const SidebarSection: FC<SidebarSectionProps> = ({
  contacts,
  onContactClicked,
  openedRecipient,
  walletAddress,
  mobileView,
  contactsCollapsed,
  setContactsCollapsed,
  setMobileView,
}) => {
  const collapsedW = "w-14";
  const isMobile = useIsMobile();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const { openModal } = useUiStore();
  const { isBroadcastMode, setIsBroadcastMode } = useBroadcastStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const broadcastEnabled = useFeatureFlagsStore(
    (state) => state.flags.broadcast
  );

  const onNewChatClicked = () => {
    try {
      if (isBroadcastMode) {
        openModal("new-broadcast");
      } else {
        openModal("new-chat");
      }
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
  };

  const toggleBroadcastMode = () => setIsBroadcastMode(!isBroadcastMode);

  const containerCls = clsx(
    "flex flex-col bg-bg-primary transition-all duration-200",
    contactsCollapsed ? collapsedW : "w-full sm:w-[200px] md:w-[280px]",
    isMobile && mobileView === "messages" && "hidden"
  );

  return (
    <div className={containerCls}>
      {/* header */}
      <div className="bg-secondary-bg flex h-[60px] items-center justify-between px-4 py-4">
        {/* Search bar and new chat button */}
        {!contactsCollapsed ? (
          <div className="flex flex-1 items-center gap-2">
            {/* Hamburger button for mobile */}
            {isMobile && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="hover:bg-primary-bg/50 mr-2 cursor-pointer rounded-lg p-2 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-7 w-7 text-[var(--text-primary)]" />
              </button>
            )}
            <div className="relative flex-1">
              <Search
                className="hover:text-kas-primary absolute top-1/2 left-3 size-5 -translate-y-1/2 cursor-pointer text-gray-400 hover:scale-110"
                onClick={() => {
                  if (searchQuery.length > 0) {
                    setSearchQuery("");
                    setShowSearch(!showSearch);
                  } else {
                    setShowSearch(!showSearch);
                  }
                }}
              />
              <input
                type="text"
                placeholder={
                  broadcastEnabled ? "Search channels..." : "Search messages..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={clsx(
                  "bg-primary-bg focus:ring-kas-secondary/50 border-primary-border w-full rounded-lg border px-10 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:ring-2 focus:outline-none",
                  showSearch ? "flex" : "hidden"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {broadcastEnabled && !showSearch && (
              <div className="flex items-center pe-1">
                <ModeSelector
                  onModeChange={setIsBroadcastMode}
                  isBroadcastMode={isBroadcastMode}
                  shouldShow={broadcastEnabled && !showSearch}
                />
              </div>
            )}
            <button
              aria-label={broadcastEnabled ? "new channel" : "new chat"}
              className="flex cursor-pointer items-center justify-center rounded-full border border-[var(--color-kas-secondary)]/60 bg-[var(--color-kas-secondary)]/20 p-1 text-[var(--text-primary)] hover:scale-110"
              onClick={onNewChatClicked}
            >
              <Plus className="size-4" />
            </button>
          </div>
        ) : (
          /* Plus button when collapsed */
          <div className="flex flex-1 justify-center">
            <button
              aria-label={broadcastEnabled ? "new channel" : "new chat"}
              className="cursor-pointer rounded-full border border-[var(--color-kas-secondary)]/60 bg-[var(--color-kas-secondary)]/20 p-1 text-[var(--text-primary)] hover:scale-110"
              onClick={onNewChatClicked}
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="bg-secondary-bg flex-1 overflow-y-auto">
        {isBroadcastMode ? (
          <BroadcastList
            searchQuery={searchQuery}
            contactsCollapsed={contactsCollapsed}
            setMobileView={setMobileView}
          />
        ) : (
          <ContactList
            contacts={contacts}
            searchQuery={searchQuery}
            onContactClicked={onContactClicked}
            openedRecipient={openedRecipient}
            contactsCollapsed={contactsCollapsed}
            setMobileView={setMobileView}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Bottom controls (desktop only) */}
      {!isMobile && (
        <DesktopMenu
          contactsCollapsed={contactsCollapsed}
          setContactsCollapsed={setContactsCollapsed}
          isMobile={isMobile}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
};
