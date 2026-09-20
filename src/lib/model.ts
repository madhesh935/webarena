export const SOURCES = ["spotify", "household", "customer"] as const;
export type SourceId = (typeof SOURCES)[number];

export type DatePrecision = "datetime" | "date" | "unknown";
export type TimezoneNote = "utc" | "unspecified";
export type HouseholdKind = "Expense" | "Income" | "Transfer-Out" | "Unknown";

export type Receipt = {
  id: string;
  source: SourceId;
  sourceRow: number;
  title: string;
  category: string;
  occurredAt: string | null;
  datePrecision: DatePrecision;
  timezoneNote: TimezoneNote | null;
  amount: number | null;
  currency: string | null;
  subjectKey: string | null;
  tags: string[];
  attrs: ReceiptAttrs;
};

export type ReceiptAttrs =
  | SpotifyAttrs
  | HouseholdAttrs
  | CustomerAttrs;

export type SpotifyAttrs = {
  kind: "spotify";
  trackUri: string | null;
  trackName: string;
  artistName: string;
  albumName: string;
  platform: string;
  msPlayed: number | null;
  reasonStart: string;
  reasonEnd: string;
  shuffle: boolean | null;
  skipped: boolean | null;
};

export type HouseholdAttrs = {
  kind: "household";
  mode: string;
  subcategory: string;
  note: string;
  householdKind: HouseholdKind;
  originalDate: string;
};

export type CustomerAttrs = {
  kind: "customer";
  merchantLabel: string;
  merchantAsRecorded: string;
  merchantPrefixStripped: boolean;
  customerGroup: string | null;
  recordedCustomerKey: string | null;
  transId: string | null;
  amountUnspecifiedCurrency: true;
};

export type SourceStatus = "idle" | "loading" | "ready" | "error";

export type OverviewSource = {
  records: number;
  dated: number;
  undated: number;
  dateStart: string | null;
  dateEnd: string | null;
  categories: { label: string; count: number }[];
  notes: string[];
};

export type Overview = {
  generatedAt: string;
  framing: "Separate sources, shared themes.";
  processing: ProcessingReport;
  spotify: OverviewSource & {
    uniqueArtists: number;
    uniqueTracks: number;
    totalMs: number;
    zeroDuration: number;
    shortUnder30s: number;
    years: { year: number; records: number; listeningMs: number }[];
    topArtists: { label: string; count: number }[];
    platforms: { label: string; count: number }[];
  };
  household: OverviewSource & {
    dateOnly: number;
    datetime: number;
    currency: string;
    expenseCount: number;
    expenseSum: number;
    incomeCount: number;
    incomeSum: number;
    transferCount: number;
    transferSum: number;
    years: {
      year: number;
      records: number;
      expenseCount: number;
      expenseSum: number;
    }[];
    topSubcategories: { label: string; count: number }[];
    repeatedNotes: { label: string; count: number }[];
  };
  customer: OverviewSource & {
    uniqueGroups: number;
    unassigned: number;
    groupsWithRepeatMerchant: number;
    amountMissing: number;
    duplicateTransIds: number;
    missingTransIds: number;
    identifierNote: string;
    years: { year: number; records: number; amountSum: number | null }[];
    topGroups: { key: string; label: string; count: number }[];
  };
};

export type ProcessingReport = {
  spotify: Record<string, number | string>;
  household: Record<string, number | string>;
  customer: Record<string, number | string>;
  exclusions: string[];
};

export type Insight = {
  id: string;
  source: SourceId | "cross";
  title: string;
  question: string;
  observation: string;
  interpretation: string;
  subjectScope: string;
  periods: string[];
  metric: string;
  definition: string;
  value: number | string;
  unit: string;
  receiptIds: string[];
  caveats: string[];
};

export type StoryStep = {
  id: string;
  kind: "open" | "observe" | "evidence" | "bridge" | "close";
  title: string;
  body: string;
  insightId?: string;
  visual?: "artist-repeat" | "milk-routine" | "customer-repeat" | "period-spotify" | "period-household" | "period-customer" | "firsts";
  receiptIds: string[];
  bridge?: { source: SourceId; label: string; href: string };
};

export type Chapter = {
  id: string;
  title: string;
  question: string;
  teaser: string;
  sources: SourceId[];
  steps: StoryStep[];
};

export type StoriesManifest = {
  chapters: Chapter[];
  insights: Insight[];
};

export type CustomerGroup = {
  key: string;
  label: string;
  count: number;
};

export type CompactFile<TRow> = {
  version: 1;
  source: SourceId;
  dicts: Record<string, string[]>;
  groups?: CustomerGroup[];
  rows: TRow[];
};

export type SpotifyCompactRow = [
  rowIndex: number,
  tsSec: number | null,
  ms: number | null,
  uri: number,
  track: number,
  artist: number,
  album: number,
  platform: number,
  reasonStart: number,
  reasonEnd: number,
  flags: number,
];

export type HouseholdCompactRow = [
  rowIndex: number,
  dateKey: string | null,
  precision: 0 | 1 | 2,
  amount: number | null,
  currency: number,
  category: number,
  subcategory: number,
  note: number,
  mode: number,
  type: number,
];

export type CustomerCompactRow = [
  rowIndex: number,
  dateKey: string | null,
  amount: number | null,
  merchant: number,
  merchantRaw: number,
  category: number,
  groupIndex: number,
  transId: number,
];

export type RelationKind =
  | "same-track"
  | "same-artist"
  | "same-album"
  | "nearby-session"
  | "same-category"
  | "same-subcategory"
  | "same-note"
  | "same-route"
  | "same-date"
  | "same-customer-merchant"
  | "same-customer-category"
  | "same-customer-nearby"
  | "thematic-compare";

export type Relation = {
  fromId: string;
  toId: string;
  kind: RelationKind;
  rank: number;
  explanation: string;
  fields: Record<string, string>;
  crossSource: boolean;
};

export type SavedAnnotation = {
  receiptId: string;
  note: string;
  updatedAt: string;
};

export type SavedCollection = {
  id: string;
  name: string;
  receiptIds: string[];
  createdAt: string;
};

export type SavedStateV1 = {
  version: 1;
  bookmarks: string[];
  collections: SavedCollection[];
  annotations: SavedAnnotation[];
};

export const SOURCE_META: Record<
  SourceId,
  { label: string; short: string; tint: string; text: string }
> = {
  spotify: { label: "Listening records", short: "Music", tint: "var(--tint-music)", text: "var(--tint-music-text)" },
  household: { label: "Household routines", short: "Household", tint: "var(--tint-household)", text: "var(--tint-household-text)" },
  customer: { label: "Customer purchases", short: "Customer", tint: "var(--tint-customer)", text: "var(--tint-customer-text)" },
};
