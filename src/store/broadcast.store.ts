import { create } from "zustand";
import { useDBStore } from "./db.store";
import { BroadcastChannel } from "./repository/broadcast-channel.repository";

export type BroadcastMessage = {
  id: string;
  channelName: string;
  senderAddress: string;
  content: string;
  timestamp: Date;
  transactionId: string;
  status: "pending" | "confirmed" | "failed";
};

interface BroadcastState {
  // Channel management (persisted in DB)
  channels: BroadcastChannel[];
  loadChannels: () => Promise<void>;
  addChannel: (channelName: string, channelValue: string) => Promise<void>;
  deleteChannel: (channelName: string) => Promise<void>;

  // Message management (in-memory only)
  messages: BroadcastMessage[];
  addMessage: (message: Omit<BroadcastMessage, "id">) => void;
  addPendingMessage: (
    message: Omit<BroadcastMessage, "id" | "status">
  ) => string; // Returns message ID
  updateMessageStatus: (
    messageId: string,
    status: "confirmed" | "failed",
    transactionId?: string
  ) => void;
  findPendingMessageByTxId: (
    transactionId: string
  ) => BroadcastMessage | undefined;
  getMessagesForChannel: (channelName: string) => BroadcastMessage[];
  clearAllMessages: () => void;
  clearChannelMessages: (channelName: string) => void;

  // UI state
  selectedChannelName: string | null;
  setSelectedChannel: (channelName: string | null) => void;

  // Broadcast mode state
  isBroadcastMode: boolean;
  setIsBroadcastMode: (enabled: boolean) => void;

  // Participant info state
  selectedParticipant: {
    address: string;
    nickname?: string;
  } | null;
  setSelectedParticipant: (
    participant: { address: string; nickname?: string } | null
  ) => void;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  // Channel management
  channels: [],

  loadChannels: async () => {
    try {
      const repositories = useDBStore.getState().repositories;
      const channels =
        await repositories.broadcastChannelRepository.getBroadcastChannels();
      set({ channels });
    } catch (error) {
      console.error("Failed to load broadcast channels:", error);
      set({ channels: [] });
    }
  },

  addChannel: async (channelName: string, channelValue: string) => {
    try {
      const repositories = useDBStore.getState().repositories;

      // check if channel already exists
      const existingChannel = get().channels.find(
        (channel) => channel.channelName === channelName.toLowerCase()
      );

      if (existingChannel) {
        throw new Error(`Channel "${channelName}" is already added`);
      }

      const newChannel: Omit<BroadcastChannel, "tenantId"> = {
        id: crypto.randomUUID(),
        channelName: channelName.toLowerCase(),
        channelValue,
        timestamp: new Date(),
      };

      await repositories.broadcastChannelRepository.saveBroadcastChannel(
        newChannel
      );
      await get().loadChannels();
    } catch (error) {
      console.error("Failed to add broadcast channel:", error);
      throw error;
    }
  },

  deleteChannel: async (channelName: string) => {
    try {
      const repositories = useDBStore.getState().repositories;
      await repositories.broadcastChannelRepository.deleteBroadcastChannelByName(
        channelName
      );

      // Clear messages for this channel
      get().clearChannelMessages(channelName);

      // If this was the selected channel, clear selection
      if (get().selectedChannelName === channelName) {
        set({ selectedChannelName: null });
      }

      await get().loadChannels();
    } catch (error) {
      console.error("Failed to delete broadcast channel:", error);
      throw error;
    }
  },

  // Message management (in-memory)
  messages: [],

  addMessage: (message: Omit<BroadcastMessage, "id">) => {
    const newMessage: BroadcastMessage = {
      ...message,
      id: crypto.randomUUID(),
      status: "confirmed", // Default status for incoming messages
      channelName: message.channelName.toLowerCase(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      ),
    }));
  },

  addPendingMessage: (message: Omit<BroadcastMessage, "id" | "status">) => {
    const messageId = crypto.randomUUID();
    const newMessage: BroadcastMessage = {
      ...message,
      id: messageId,
      status: "pending",
      channelName: message.channelName.toLowerCase(),
    };

    set((state) => ({
      messages: [...state.messages, newMessage].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      ),
    }));

    return messageId;
  },

  updateMessageStatus: (
    messageId: string,
    status: "confirmed" | "failed",
    transactionId?: string
  ) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, status, ...(transactionId && { transactionId }) }
          : msg
      ),
    }));
  },

  findPendingMessageByTxId: (transactionId: string) => {
    const state = get();
    return state.messages.find(
      (msg) => msg.transactionId === transactionId && msg.status === "pending"
    );
  },

  getMessagesForChannel: (channelName: string) => {
    const state = get();
    return state.messages
      .filter((msg) => msg.channelName === channelName.toLowerCase())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },

  // unused - but we might use in the future (so remove this comment if you use it!)
  clearAllMessages: () => {
    set({ messages: [] });
  },

  clearChannelMessages: (channelName: string) => {
    set((state) => ({
      messages: state.messages.filter(
        (msg) => msg.channelName !== channelName.toLowerCase()
      ),
    }));
  },

  // UI state
  selectedChannelName: null,
  setSelectedChannel: (channelName: string | null) => {
    set({ selectedChannelName: channelName?.toLowerCase() || null });
  },

  // Broadcast mode state
  isBroadcastMode: false,
  setIsBroadcastMode: (enabled: boolean) => {
    set({ isBroadcastMode: enabled });
  },

  // Participant info state
  selectedParticipant: null,
  setSelectedParticipant: (
    participant: { address: string; nickname?: string } | null
  ) => {
    set({ selectedParticipant: participant });
  },
}));
