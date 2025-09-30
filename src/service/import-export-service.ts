import type { Repositories } from "../store/repository/db";
import type { Message } from "../store/repository/message.repository";
import type { Contact } from "../store/repository/contact.repository";
import type { Conversation } from "../store/repository/conversation.repository";
import type { Handshake } from "../store/repository/handshake.repository";
import type { Payment } from "../store/repository/payment.repository";
import type { DecryptionTrial } from "../store/repository/decryption-trial.repository";
import type { SavedHandshake } from "../store/repository/saved-handshake.repository";

/**
 * Normalize string dates to Date objects in the backup data
 */
const normalizeDates = (backup: BackupV2): BackupV2 => {
  const normalizeDateField = <T extends Record<string, unknown>>(
    item: T,
    field: keyof T
  ): T => {
    if (item[field] && typeof item[field] === "string") {
      item[field] = new Date(item[field] as string) as T[typeof field];
    }
    return item;
  };

  return {
    ...backup,
    messages: backup.messages.map((msg) =>
      normalizeDateField(msg, "createdAt")
    ),
    contacts: backup.contacts.map((contact) =>
      normalizeDateField(contact, "timestamp")
    ),
    conversations: backup.conversations.map((conv) =>
      normalizeDateField(conv, "lastActivityAt")
    ),
    handshakes: backup.handshakes.map((hs) =>
      normalizeDateField(hs, "createdAt")
    ),
    payments: backup.payments.map((payment) =>
      normalizeDateField(payment, "createdAt")
    ),
    decryptionTrials: backup.decryptionTrials.map((trial) =>
      normalizeDateField(trial, "timestamp")
    ),
    savedHandshakes: backup.savedHandshakes.map((sh) =>
      normalizeDateField(sh, "createdAt")
    ),
  };
};

// we'll re-introduce support for BackupV1 later
export type BackupV1 = {
  version: "1.0";
};

export type BackupV2 = {
  version: "2.0";
  messages: Message[];
  contacts: Contact[];
  conversations: Conversation[];
  handshakes: Handshake[];
  payments: Payment[];
  decryptionTrials: DecryptionTrial[];
  savedHandshakes: SavedHandshake[];
};

/**
 * Export contacts, conversations, messages, handshakes, payments and self handshakes,
 */
export const exportData = async (
  repositories: Repositories
): Promise<BackupV2> => {
  const [
    messages,
    contacts,
    conversations,
    handshakes,
    payments,
    decryptionTrials,
    savedHandshakes,
  ] = await Promise.all([
    repositories.messageRepository.getMessages(),
    repositories.contactRepository.getContacts(),
    repositories.conversationRepository.getConversations(),
    repositories.handshakeRepository.getHandshakes(),
    repositories.paymentRepository.getPayments(),
    repositories.decryptionTrialRepository.getDecryptionTrials(),
    repositories.savedHandshakeRepository.getAllSavedHandshakes(),
  ]);

  return {
    version: "2.0",
    messages,
    contacts,
    conversations,
    handshakes,
    payments,
    decryptionTrials,
    savedHandshakes,
  };
};

export const importData = async (
  repositories: Repositories,
  backup: BackupV2
): Promise<void> => {
  try {
    // Normalize string dates to Date objects
    const normalizedBackup = normalizeDates(backup);

    // Import all data using bulk operations
    await Promise.all([
      repositories.messageRepository.saveBulk(normalizedBackup.messages),
      repositories.contactRepository.saveBulk(normalizedBackup.contacts),
      repositories.conversationRepository.saveBulk(
        normalizedBackup.conversations
      ),
      repositories.handshakeRepository.saveBulk(normalizedBackup.handshakes),
      repositories.paymentRepository.saveBulk(normalizedBackup.payments),
      repositories.decryptionTrialRepository.saveBulk(
        normalizedBackup.decryptionTrials
      ),
      repositories.savedHandshakeRepository.saveBulk(
        normalizedBackup.savedHandshakes
      ),
    ]);
  } catch (error) {
    // If any operation fails, the transaction will be aborted
    console.error("Import failed:", error);
    throw error;
  }
};
