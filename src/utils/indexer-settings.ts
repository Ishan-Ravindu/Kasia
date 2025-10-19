const INDEXER_DISABLED_KEY = "kasia_indexer_disabled";
const INDEXER_URL_KEY = "kasia_indexer_url";

// gets whether the indexer is disabled.
// checks localStorage. Defaults to false (enabled) if no value is set.
export function isIndexerDisabled(): boolean {
  const localStorageValue = localStorage.getItem(INDEXER_DISABLED_KEY);
  return localStorageValue === "true";
}

// sets the indexer disabled setting in localStorage.
export function setIndexerDisabled(disabled: boolean): void {
  localStorage.setItem(INDEXER_DISABLED_KEY, disabled.toString());
}

// gets the indexer URL from localStorage.
export function getIndexerUrl(): string | null {
  return localStorage.getItem(INDEXER_URL_KEY);
}

// Sets the indexer URL in localStorage.
export function setIndexerUrl(url: string | null): void {
  if (url) {
    localStorage.setItem(INDEXER_URL_KEY, url);
  } else {
    localStorage.removeItem(INDEXER_URL_KEY);
  }
}
