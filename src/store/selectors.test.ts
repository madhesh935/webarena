import { describe, expect, it } from "vitest";
import { annotationText, bookmarkCount, collectionById, isBookmarked } from "./selectors";
import type { SavedStateV1 } from "../types";

const state: SavedStateV1 = {
  version: 1,
  bookmarks: ["household:15", "spotify:1"],
  collections: [{ id: "col-1", name: "Milk", receiptIds: ["household:15"], createdAt: "2024-01-01T00:00:00.000Z" }],
  annotations: [{ receiptId: "household:15", note: "weekly", updatedAt: "2024-01-02T00:00:00.000Z" }],
};

describe("saved selectors", () => {
  it("reads bookmarks, notes and collections without mutating state", () => {
    expect(isBookmarked(state, "household:15")).toBe(true);
    expect(isBookmarked(state, "customer:9")).toBe(false);
    expect(annotationText(state, "household:15")).toBe("weekly");
    expect(annotationText(state, "spotify:1")).toBe("");
    expect(collectionById(state, "col-1")?.name).toBe("Milk");
    expect(collectionById(state, "missing")).toBeNull();
    expect(bookmarkCount(state)).toBe(2);
  });
});
