import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { SavedCollection, SavedStateV1 } from "../types";
import { exportCollection, loadSavedState, persistSavedState } from "../services/storage";
import { annotationText, createSavedStore, isBookmarked as bookmarkInState, savedReducer } from "../store";

type SavedApi = {
  state: SavedStateV1;
  warning: string | null;
  persistError: string | null;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
  setAnnotation: (id: string, note: string) => void;
  annotation: (id: string) => string;
  createCollection: (name: string) => void;
  addToCollection: (collectionId: string, receiptId: string) => void;
  removeFromCollection: (collectionId: string, receiptId: string) => string | null;
  undoRemove: () => void;
  pendingUndo: { collectionId: string; receiptId: string } | null;
  clearCollection: (collectionId: string) => void;
  exportJson: (collectionId: string) => string | null;
};

const Ctx = createContext<SavedApi | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const initial = loadSavedState();
  const [store, dispatch] = useReducer(savedReducer, createSavedStore(initial.state));
  const warning = initial.warning;
  const state = store.data;

  const commit = useCallback((next: SavedStateV1) => {
    dispatch({ type: "replace", data: next, persistError: persistSavedState(next) });
  }, []);

  const isBookmarked = useCallback((id: string) => bookmarkInState(state, id), [state]);

  const toggleBookmark = useCallback(
    (id: string) => {
      const bookmarks = state.bookmarks.includes(id)
        ? state.bookmarks.filter((x) => x !== id)
        : [...state.bookmarks, id];
      commit({ ...state, bookmarks });
    },
    [commit, state],
  );

  const setAnnotation = useCallback(
    (id: string, note: string) => {
      const rest = state.annotations.filter((a) => a.receiptId !== id);
      commit({
        ...state,
        annotations: note.trim()
          ? [...rest, { receiptId: id, note, updatedAt: new Date().toISOString() }]
          : rest,
      });
    },
    [commit, state],
  );

  const annotation = useCallback((id: string) => annotationText(state, id), [state]);

  const createCollection = useCallback(
    (name: string) => {
      const collection: SavedCollection = {
        id: `col-${Date.now()}`,
        name: name.trim() || "Untitled collection",
        receiptIds: [],
        createdAt: new Date().toISOString(),
      };
      commit({ ...state, collections: [...state.collections, collection] });
    },
    [commit, state],
  );

  const addToCollection = useCallback(
    (collectionId: string, receiptId: string) => {
      commit({
        ...state,
        collections: state.collections.map((c) =>
          c.id === collectionId && !c.receiptIds.includes(receiptId)
            ? { ...c, receiptIds: [...c.receiptIds, receiptId] }
            : c,
        ),
      });
    },
    [commit, state],
  );

  const removeFromCollection = useCallback(
    (collectionId: string, receiptId: string) => {
      commit({
        ...state,
        collections: state.collections.map((c) =>
          c.id === collectionId ? { ...c, receiptIds: c.receiptIds.filter((id) => id !== receiptId) } : c,
        ),
      });
      dispatch({ type: "pending", pendingUndo: { collectionId, receiptId } });
      return receiptId;
    },
    [commit, state],
  );

  const undoRemove = useCallback(() => {
    if (!store.pendingUndo) return;
    addToCollection(store.pendingUndo.collectionId, store.pendingUndo.receiptId);
    dispatch({ type: "pending", pendingUndo: null });
  }, [addToCollection, store.pendingUndo]);

  const clearCollection = useCallback(
    (collectionId: string) => {
      commit({
        ...state,
        collections: state.collections.map((c) => (c.id === collectionId ? { ...c, receiptIds: [] } : c)),
      });
    },
    [commit, state],
  );

  const exportJson = useCallback((collectionId: string) => {
    const payload = exportCollection(state, collectionId);
    return payload ? JSON.stringify(payload, null, 2) : null;
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      warning,
      persistError: store.persistError,
      isBookmarked,
      toggleBookmark,
      setAnnotation,
      annotation,
      createCollection,
      addToCollection,
      removeFromCollection,
      undoRemove,
      pendingUndo: store.pendingUndo,
      clearCollection,
      exportJson,
    }),
    [state, warning, store.persistError, store.pendingUndo, isBookmarked, toggleBookmark, setAnnotation, annotation, createCollection, addToCollection, removeFromCollection, undoRemove, clearCollection, exportJson],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaved() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSaved must be used inside SavedProvider");
  return ctx;
}
