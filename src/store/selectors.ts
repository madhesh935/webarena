import type { SavedCollection, SavedStateV1 } from "../types";

export function isBookmarked(data: SavedStateV1, id: string): boolean {
  return data.bookmarks.includes(id);
}

export function annotationText(data: SavedStateV1, id: string): string {
  return data.annotations.find((a) => a.receiptId === id)?.note ?? "";
}

export function collectionById(data: SavedStateV1, id: string): SavedCollection | null {
  return data.collections.find((c) => c.id === id) ?? null;
}

export function bookmarkCount(data: SavedStateV1): number {
  return data.bookmarks.length;
}
