import type { SavedStateV1 } from "../types";

export type SavedStore = {
  data: SavedStateV1;
  persistError: string | null;
  pendingUndo: { collectionId: string; receiptId: string } | null;
};

export type SavedAction =
  | { type: "replace"; data: SavedStateV1; persistError: string | null }
  | { type: "pending"; pendingUndo: SavedStore["pendingUndo"] };

export function createSavedStore(data: SavedStateV1): SavedStore {
  return { data, persistError: null, pendingUndo: null };
}

export function savedReducer(store: SavedStore, action: SavedAction): SavedStore {
  if (action.type === "replace") {
    return { ...store, data: action.data, persistError: action.persistError };
  }
  return { ...store, pendingUndo: action.pendingUndo };
}
