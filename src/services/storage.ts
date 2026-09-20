import type { SavedStateV1 } from "../types";
import {
  STORAGE_KEY as LIB_STORAGE_KEY,
  exportCollection as exportCollectionFromLib,
  loadSavedState as readSavedState,
  persistSavedState as writeSavedState,
} from "../lib/storage";

export const STORAGE_KEY = LIB_STORAGE_KEY;

export function loadSavedState(): { state: SavedStateV1; warning: string | null } {
  return readSavedState();
}

export function persistSavedState(state: SavedStateV1): string | null {
  return writeSavedState(state);
}

export function exportCollection(state: SavedStateV1, collectionId: string) {
  return exportCollectionFromLib(state, collectionId);
}

export function describeStorageHealth(warning: string | null, persistError: string | null): "ok" | "warning" | "error" {
  if (persistError) return "error";
  if (warning) return "warning";
  return "ok";
}
