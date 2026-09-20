import { describe, expect, it } from "vitest";
import { cacheClear, cacheGet, cacheHas, cacheSet, cacheSize } from "./cache";

describe("in-memory source cache", () => {
  it("stores, hits and clears source-prefixed keys", () => {
    cacheClear();
    expect(cacheSize()).toBe(0);
    cacheSet("source:household", [{ id: "household:1" }]);
    cacheSet("overview", { records: 3 });
    expect(cacheHas("source:household")).toBe(true);
    expect(cacheGet<{ records: number }>("overview")?.records).toBe(3);
    cacheClear("source:household");
    expect(cacheHas("source:household")).toBe(false);
    expect(cacheHas("overview")).toBe(true);
    cacheClear();
    expect(cacheSize()).toBe(0);
  });
});
