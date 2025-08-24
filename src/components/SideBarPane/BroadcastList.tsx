import { FC, useEffect } from "react";
import { BroadcastCard } from "./BroadcastCard";
import { useBroadcastStore } from "../../store/broadcast.store";
import { BroadcastChannel } from "../../store/repository/broadcast-channel.repository";

interface BroadcastListProps {
  searchQuery: string;
  contactsCollapsed: boolean;
  setMobileView: (view: "contacts" | "messages") => void;
}

export const BroadcastList: FC<BroadcastListProps> = ({
  searchQuery,
  contactsCollapsed,
  setMobileView,
}) => {
  const broadcastChannels = useBroadcastStore((state) => state.channels);
  const deleteChannel = useBroadcastStore((state) => state.deleteChannel);
  const loadChannels = useBroadcastStore((state) => state.loadChannels);
  const setSelectedChannel = useBroadcastStore(
    (state) => state.setSelectedChannel
  );
  const selectedChannelName = useBroadcastStore(
    (state) => state.selectedChannelName
  );

  // Load channels when component mounts and auto-select first channel if available
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Auto-select first channel if no channel is currently selected
  useEffect(() => {
    if (broadcastChannels.length > 0 && !selectedChannelName) {
      setSelectedChannel(broadcastChannels[0].channelName);
    }
  }, [broadcastChannels, selectedChannelName, setSelectedChannel]);

  // Filter channels by search query
  const filteredChannels = searchQuery.trim()
    ? broadcastChannels.filter((channel) =>
        channel.channelName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : broadcastChannels;

  const handleChannelClick = (channel: BroadcastChannel) => {
    setSelectedChannel(channel.channelName);
    // Switch to messages view on mobile when channel is clicked
    setMobileView("messages");
  };

  if (!contactsCollapsed && filteredChannels.length === 0) {
    return (
      <div className="m-5 overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.2)] px-5 py-10 text-center text-[var(--text-secondary)] italic">
        {searchQuery
          ? "No search results"
          : "No broadcast channels yet. Click + to add one."}
      </div>
    );
  }

  return (
    <>
      {filteredChannels.map((channel) => (
        <BroadcastCard
          key={channel.id}
          channel={channel}
          onDelete={deleteChannel}
          onClick={handleChannelClick}
          isSelected={selectedChannelName === channel.channelName}
          collapsed={contactsCollapsed}
        />
      ))}
    </>
  );
};
