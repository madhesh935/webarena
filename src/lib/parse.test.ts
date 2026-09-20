import { describe, expect, it } from "vitest";
import {
  householdKind,
  keepAsString,
  parseCustomerDate,
  parseExplicitBoolean,
  parseHouseholdDate,
  parseNumberOrNull,
  parseSpotifyUtc,
  receiptId,
} from "./parse";
import { applyDocFilters, applyFilters, EMPTY_QUERY, searchMatches, sortCompatibility, sortReceipts, toSearchDoc } from "./filters";
import { parseExploreSearch, serializeExploreSearch } from "./url-state";
import { comparePeriods } from "./period";
import { relatedReceipts } from "./relationships";
import type { Receipt } from "./model";

describe("household date parsing", () => {
  it("keeps date-only rows as date precision and not midnight", () => {
    const parsed = parseHouseholdDate("19/09/2018");
    expect(parsed.iso).toBe("2018-09-19");
    expect(parsed.precision).toBe("date");
    expect(parsed.dateOnly).toBe(true);
    expect(parsed.iso?.includes("T")).toBe(false);
  });

  it("parses DD/MM/YYYY timed rows without assuming a timezone", () => {
    const parsed = parseHouseholdDate("20/09/2018 12:04:08");
    expect(parsed.iso).toBe("2018-09-20T12:04:08");
    expect(parsed.precision).toBe("datetime");
    expect(parsed.dateOnly).toBe(false);
    expect(parsed.utc).toBe(false);
  });

  it("parses unpadded D/M/YYYY", () => {
    const parsed = parseHouseholdDate("12/9/2018");
    expect(parsed.iso).toBe("2018-09-12");
    expect(parsed.precision).toBe("date");
  });
});

describe("spotify and boolean parsing", () => {
  it("parses Spotify timestamps as UTC", () => {
    const parsed = parseSpotifyUtc("2013-07-08 02:44:34");
    expect(parsed.iso).toBe("2013-07-08T02:44:34Z");
    expect(parsed.precision).toBe("datetime");
    expect(parsed.utc).toBe(true);
  });

  it("does not treat FALSE as true", () => {
    expect(parseExplicitBoolean("FALSE")).toBe(false);
    expect(parseExplicitBoolean("TRUE")).toBe(true);
    expect(parseExplicitBoolean("")).toBeNull();
    expect(parseExplicitBoolean(undefined)).toBeNull();
    expect(Boolean("FALSE")).toBe(true);
  });

  it("keeps zero distinct from missing", () => {
    expect(parseNumberOrNull("0")).toBe(0);
    expect(parseNumberOrNull("")).toBeNull();
    expect(parseNumberOrNull(undefined)).toBeNull();
  });
});

describe("customer identifiers", () => {
  it("keeps scientific-notation IDs as strings and leaves blanks unassigned", () => {
    expect(keepAsString(6.24e18)).toBe(String(6.24e18));
    expect(keepAsString("3.1e+18")).toBe("3.1e+18");
    expect(keepAsString("")).toBe("");
    expect(keepAsString(null)).toBe("");
  });

  it("parses M/D/YYYY H customer dates and rejects invalid days", () => {
    expect(parseCustomerDate("12/26/2023 0:55").iso).toBe("2023-12-26T00:55:00");
    expect(parseCustomerDate("4/25/2023 11:53").iso).toBe("2023-04-25T11:53:00");
    expect(parseCustomerDate("2/31/2023 10:00").iso).toBeNull();
    expect(parseCustomerDate("").iso).toBeNull();
  });
});

describe("stable receipt IDs", () => {
  it("prefixes source row indexes so repeated tracks stay distinct events", () => {
    expect(receiptId("spotify", 0)).toBe("spotify:0");
    expect(receiptId("spotify", 1)).toBe("spotify:1");
    expect(receiptId("customer", 4)).toBe("customer:4");
  });
});

describe("household kinds and currency separation", () => {
  it("distinguishes expense, income and transfer", () => {
    expect(householdKind("Expense")).toBe("Expense");
    expect(householdKind("Income")).toBe("Income");
    expect(householdKind("Transfer-Out")).toBe("Transfer-Out");
  });
});

const spotifyReceipt = (id: string, extra: Partial<Receipt> = {}): Receipt => ({
  id,
  source: "spotify",
  sourceRow: Number(id.split(":")[1]),
  title: "Ode To The Mets",
  category: "The Strokes",
  occurredAt: "2020-01-01T00:00:00Z",
  datePrecision: "datetime",
  timezoneNote: "utc",
  amount: null,
  currency: null,
  subjectKey: null,
  tags: ["The Strokes"],
  attrs: {
    kind: "spotify",
    trackUri: "abc",
    trackName: "Ode To The Mets",
    artistName: "The Strokes",
    albumName: "The New Abnormal",
    platform: "android",
    msPlayed: 1000,
    reasonStart: "clickrow",
    reasonEnd: "trackdone",
    shuffle: false,
    skipped: false,
  },
  ...extra,
});

const householdReceipt = (id: string, extra: Partial<Receipt> = {}): Receipt => ({
  id,
  source: "household",
  sourceRow: Number(id.split(":")[1]),
  title: "Half lit milk",
  category: "Food",
  occurredAt: "2018-09-11",
  datePrecision: "date",
  timezoneNote: "unspecified",
  amount: 36,
  currency: "INR",
  subjectKey: null,
  tags: ["Milk"],
  attrs: {
    kind: "household",
    mode: "Cash",
    subcategory: "Milk",
    note: "Half lit  milk",
    householdKind: "Expense",
    originalDate: "2018-09-11",
  },
  ...extra,
});

const customerReceipt = (id: string, extra: Partial<Receipt> = {}): Receipt => ({
  id,
  source: "customer",
  sourceRow: Number(id.split(":")[1]),
  title: "Rattan Ltd Pvt Ltd",
  category: "online_shopping",
  occurredAt: "2023-08-12T17:09:00",
  datePrecision: "datetime",
  timezoneNote: "unspecified",
  amount: 100,
  currency: null,
  subjectKey: "Recorded group 001",
  tags: ["Recorded group 001"],
  attrs: {
    kind: "customer",
    merchantLabel: "Rattan Ltd Pvt Ltd",
    merchantAsRecorded: "fraud_Rattan Ltd Pvt Ltd",
    merchantPrefixStripped: true,
    customerGroup: "Recorded group 001",
    recordedCustomerKey: "3.1e+18",
    transId: "1",
    amountUnspecifiedCurrency: true,
  },
  ...extra,
});

describe("search and combined filters", () => {
  const rows = [
    spotifyReceipt("spotify:1"),
    householdReceipt("household:1"),
    customerReceipt("customer:1"),
    householdReceipt("household:2", {
      title: "Train",
      category: "Transportation",
      occurredAt: "2018-09-20T12:04:08",
      datePrecision: "datetime",
      tags: ["Train"],
      attrs: {
        kind: "household",
        mode: "Cash",
        subcategory: "Train",
        note: "2 Place 5 to Place 0",
        householdKind: "Expense",
        originalDate: "2018-09-20T12:04:08",
      },
    }),
  ];

  it("searches across all three sources", () => {
    expect(rows.filter((r) => searchMatches(r, "strokes")).map((r) => r.id)).toEqual(["spotify:1"]);
    expect(rows.filter((r) => searchMatches(r, "milk")).map((r) => r.id)).toEqual(["household:1"]);
    expect(rows.filter((r) => searchMatches(r, "rattan")).map((r) => r.id)).toEqual(["customer:1"]);
  });

  it("combines source OR with search AND date AND", () => {
    const found = applyFilters(rows, {
      q: "milk",
      sources: ["household", "spotify"],
      categories: [],
      dateFrom: "2018-01-01",
      dateTo: "2018-12-31",
      customer: null,
      sort: "newest",
    });
    expect(found.map((r) => r.id)).toEqual(["household:1"]);
  });
});

describe("connections", () => {
  it("explains same-artist matches from actual fields", () => {
    const focus = spotifyReceipt("spotify:1");
    const other = spotifyReceipt("spotify:2", {
      title: "The Adults Are Talking",
      attrs: {
        kind: "spotify",
        trackUri: "other",
        trackName: "The Adults Are Talking",
        artistName: "The Strokes",
        albumName: "The New Abnormal",
        platform: "android",
        msPlayed: 1000,
        reasonStart: "clickrow",
        reasonEnd: "trackdone",
        shuffle: false,
        skipped: false,
      },
    });
    const rel = relatedReceipts(focus, [focus, other]);
    expect(rel[0].kind).toBe("same-artist");
    expect(rel[0].fields.artist).toBe("The Strokes");
  });

  it("does not connect different customer groups that share a merchant", () => {
    const a = customerReceipt("customer:1");
    const b = customerReceipt("customer:2", {
      subjectKey: "Recorded group 002",
      attrs: {
        kind: "customer",
        merchantLabel: "Rattan Ltd Pvt Ltd",
        merchantAsRecorded: "fraud_Rattan Ltd Pvt Ltd",
        merchantPrefixStripped: true,
        customerGroup: "Recorded group 002",
        recordedCustomerKey: "-6.6e+18",
        transId: "2",
        amountUnspecifiedCurrency: true,
      },
    });
    const rel = relatedReceipts(a, [a, b]);
    expect(rel).toHaveLength(0);
  });
});

describe("period comparison", () => {
  it("labels unequal windows and zero baselines", () => {
    const rows = [
      householdReceipt("household:1", { occurredAt: "2015-01-10", amount: 10 }),
      householdReceipt("household:2", { occurredAt: "2017-03-10", amount: 20 }),
      householdReceipt("household:3", { occurredAt: "2017-03-11", amount: 5, attrs: {
        kind: "household",
        mode: "Cash",
        subcategory: "",
        note: "salary",
        householdKind: "Income",
        originalDate: "2017-03-11",
      }}),
    ];
    const result = comparePeriods(
      rows,
      "household",
      { label: "Jan 2015", start: "2015-01-01", end: "2015-01-31" },
      { label: "2017", start: "2017-01-01", end: "2017-12-31" },
      "Household records",
    );
    expect(result.unequal).toBe(true);
    expect(result.daysA).toBe(31);
    expect(result.daysB).toBe(365);
    const income = result.metrics.find((m) => m.key === "income-sum");
    expect(income?.deltaLabel).toContain("No baseline");
    const expense = result.metrics.find((m) => m.key === "expense-sum");
    expect(expense?.a).toBe(10);
    expect(expense?.b).toBe(20);
  });
});

describe("sort stability", () => {
  it("keeps undated records last for newest sort and uses IDs as a tie-breaker", () => {
    const rows = [
      spotifyReceipt("spotify:2", { occurredAt: null, datePrecision: "unknown" }),
      spotifyReceipt("spotify:1", { occurredAt: "2020-01-01T00:00:00Z" }),
      spotifyReceipt("spotify:3", { occurredAt: "2020-01-01T00:00:00Z" }),
    ];
    const sorted = sortReceipts(rows, "newest");
    expect(sorted.map((r) => r.id)).toEqual(["spotify:1", "spotify:3", "spotify:2"]);
  });

  it("disables amount sort when only listening records are in scope", () => {
    expect(sortCompatibility("amount-desc", ["spotify"]).ok).toBe(false);
    expect(sortCompatibility("duration-desc", ["household"]).ok).toBe(false);
    expect(sortCompatibility("amount-desc", ["household"]).ok).toBe(true);
  });
});

describe("customer period scope", () => {
  it("keeps comparison inside one recorded group", () => {
    const rows = [
      customerReceipt("customer:1", { occurredAt: "2022-05-01T00:00:00", amount: 10 }),
      customerReceipt("customer:2", {
        occurredAt: "2023-05-01T00:00:00",
        amount: 40,
        subjectKey: "Recorded group 002",
        attrs: {
          kind: "customer",
          merchantLabel: "Other",
          merchantAsRecorded: "Other",
          merchantPrefixStripped: false,
          customerGroup: "Recorded group 002",
          recordedCustomerKey: "2",
          transId: "2",
          amountUnspecifiedCurrency: true,
        },
      }),
      customerReceipt("customer:3", { occurredAt: "2023-06-01T00:00:00", amount: 5 }),
    ];
    const result = comparePeriods(
      rows,
      "customer",
      { label: "A", start: "2022-01-01", end: "2022-12-31" },
      { label: "B", start: "2023-01-01", end: "2023-12-31" },
      "Recorded group 001",
      "Recorded group 001",
    );
    expect(result.metrics.find((m) => m.key === "records")?.a).toBe(1);
    expect(result.metrics.find((m) => m.key === "records")?.b).toBe(1);
  });
});

describe("search docs", () => {
  it("filters compact worker documents the same way as receipts", () => {
    const rows = [spotifyReceipt("spotify:1"), householdReceipt("household:1")];
    const query = {
      q: "strokes",
      sources: ["spotify"] as ["spotify"],
      categories: [],
      dateFrom: null,
      dateTo: null,
      customer: null,
      sort: "newest" as const,
    };
    const fromReceipts = applyFilters(rows, query);
    const fromDocs = applyDocFilters(rows.map(toSearchDoc), query);
    expect(fromReceipts.map((r) => r.id)).toEqual(fromDocs.map((r) => r.id));
  });
});

describe("shareable URL state", () => {
  it("round-trips explore filters including a receipt id", () => {
    const query = {
      q: "milk",
      sources: ["household"] as ["household"],
      categories: ["Food"],
      dateFrom: "2018-01-01",
      dateTo: "2018-12-31",
      customer: null,
      sort: "newest" as const,
    };
    const search = serializeExploreSearch(query, 2, "household:15");
    const parsed = parseExploreSearch(search);
    expect(parsed.q).toBe("milk");
    expect(parsed.sources).toEqual(["household"]);
    expect(parsed.page).toBe(2);
    expect(parsed.receipt).toBe("household:15");
  });

  it("serializes an empty explore query as a blank search string", () => {
    expect(serializeExploreSearch(EMPTY_QUERY, 1, null)).toBe("");
  });
});
