import { describe, expect, it } from "vitest";
import { createSavedStore, savedReducer } from "./savedReducer";
import type { SavedStateV1 } from "../types";

const empty: SavedStateV1 = {
  version: 1,
  bookmarks: [],
  collections: [],
  annotations: [],
};

describe("saved reducer", () => {
  it("replaces persisted state and records a persist error", () => {
    const next: SavedStateV1 = { ...empty, bookmarks: ["household:15"] };
    const result = savedReducer(createSavedStore(empty), {
      type: "replace",
      data: next,
      persistError: "quota",
    });
    expect(result.data.bookmarks).toEqual(["household:15"]);
    expect(result.persistError).toBe("quota");
  });

  it("stores a pending undo without changing bookmarks", () => {
    const start = createSavedStore({ ...empty, bookmarks: ["spotify:1"] });
    const result = savedReducer(start, {
      type: "pending",
      pendingUndo: { collectionId: "col-1", receiptId: "spotify:1" },
    });
    expect(result.data.bookmarks).toEqual(["spotify:1"]);
    expect(result.pendingUndo?.receiptId).toBe("spotify:1");
  });
});
