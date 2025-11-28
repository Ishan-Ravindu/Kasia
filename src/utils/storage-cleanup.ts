// cleans up legacy localStorage keys that stored wallet addresses (privacy leaking sorta stuff).
// this can be removed at some point in the future
// this was added in v6.3

export function cleanupLegacyContactStorage(walletAddress: string): void {
  const keysToRemove = [
    `kasia_last_opened_recipient_${walletAddress}`,
    `kasia_last_opened_contact_id_${walletAddress}`,
    `kasia_last_opened_channel_id_${walletAddress}`,
  ];

  let cleanedCount = 0;
  for (const key of keysToRemove) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `Cleaned up ${cleanedCount} legacy localStorage keys for wallet.`
    );
  }
}
