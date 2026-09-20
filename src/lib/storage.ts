import type { SavedStateV1 } from "./model";

export const STORAGE_KEY = "life-in-receipts.saved.v1";

const empty = (): SavedStateV1 => ({
  version: 1,
  bookmarks: [],
  collections: [],
  annotations: [],
});

export function loadSavedState(): { state: SavedStateV1; warning: string | null } {
  try {
    if (typeof localStorage === "undefined") {
      return { state: empty(), warning: "Browser storage is unavailable. Saved items will not persist." };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: empty(), warning: null };
    const parsed = JSON.parse(raw) as Partial<SavedStateV1>;
    if (parsed.version !== 1 || !Array.isArray(parsed.bookmarks)) {
      return { state: empty(), warning: "Saved data was from an older or invalid format and was reset." };
    }
    return {
      state: {
        version: 1,
        bookmarks: parsed.bookmarks.filter((id): id is string => typeof id === "string"),
        collections: Array.isArray(parsed.collections)
          ? parsed.collections.filter((c) => c && typeof c.id === "string" && Array.isArray(c.receiptIds))
          : [],
        annotations: Array.isArray(parsed.annotations)
          ? parsed.annotations.filter((a) => a && typeof a.receiptId === "string" && typeof a.note === "string")
          : [],
      },
      warning: null,
    };
  } catch {
    return { state: empty(), warning: "Saved data could not be read and was reset." };
  }
}

export function persistSavedState(state: SavedStateV1): string | null {
  try {
    if (typeof localStorage === "undefined") {
      return "Browser storage is unavailable.";
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch (err) {
    const quota = err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
    return quota
      ? "This browser is out of storage space for saved items."
      : "Could not save in this browser.";
  }
}

export function exportCollection(state: SavedStateV1, collectionId: string) {
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return null;
  const annotations = state.annotations.filter((a) => collection.receiptIds.includes(a.receiptId));
  return {
    product: "Life in Receipts",
    framing: "Separate sources, shared themes.",
    savedInThisBrowser: true,
    collection: {
      name: collection.name,
      createdAt: collection.createdAt,
      receipts: collection.receiptIds.map((id) => ({
        id,
        source: id.split(":")[0],
        sourceRow: Number(id.split(":")[1]),
        visitorNote: annotations.find((a) => a.receiptId === id)?.note ?? null,
      })),
    },
  };
}
