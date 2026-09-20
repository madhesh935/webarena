import type { Receipt, SourceId } from "./model";
import { compareIso, tokenize } from "./parse";

export type SortKey = "newest" | "oldest" | "amount-desc" | "amount-asc" | "duration-desc";

export type ExplorerQuery = {
  q: string;
  sources: SourceId[];
  categories: string[];
  dateFrom: string | null;
  dateTo: string | null;
  customer: string | "unassigned" | null;
  sort: SortKey;
};

export const EMPTY_QUERY: ExplorerQuery = {
  q: "",
  sources: [],
  categories: [],
  dateFrom: null,
  dateTo: null,
  customer: null,
  sort: "newest",
};

export function searchMatches(receipt: Receipt, q: string): boolean {
  const tokens = tokenize(q);
  if (tokens.length === 0) return true;
  const hay = searchText(receipt);
  return tokens.every((t) => hay.includes(t));
}

export function searchText(receipt: Receipt): string {
  const parts = [receipt.title, receipt.category, receipt.subjectKey ?? "", ...receipt.tags];
  if (receipt.attrs.kind === "spotify") {
    parts.push(receipt.attrs.artistName, receipt.attrs.albumName, receipt.attrs.trackName, receipt.attrs.platform);
  } else if (receipt.attrs.kind === "household") {
    parts.push(receipt.attrs.subcategory, receipt.attrs.note, receipt.attrs.mode, receipt.attrs.householdKind);
  } else {
    parts.push(receipt.attrs.merchantLabel, receipt.attrs.merchantAsRecorded, receipt.attrs.customerGroup ?? "unassigned");
  }
  return parts.join(" ").toLowerCase();
}

export function applyFilters(receipts: Receipt[], query: ExplorerQuery): Receipt[] {
  const sourceSet = new Set(query.sources);
  const catSet = new Set(query.categories);
  return receipts.filter((r) => {
    if (sourceSet.size > 0 && !sourceSet.has(r.source)) return false;
    if (catSet.size > 0 && !catSet.has(r.category)) return false;
    if (query.dateFrom || query.dateTo) {
      if (!r.occurredAt) return false;
      const day = r.occurredAt.slice(0, 10);
      if (query.dateFrom && day < query.dateFrom) return false;
      if (query.dateTo && day > query.dateTo) return false;
    }
    if (query.customer && r.source === "customer") {
      if (query.customer === "unassigned") {
        if (r.subjectKey) return false;
      } else if (r.subjectKey !== query.customer) {
        return false;
      }
    }
    return searchMatches(r, query.q);
  });
}

export function customerFilterApplies(query: ExplorerQuery): boolean {
  return query.sources.length === 0 || query.sources.includes("customer");
}

export function sortReceipts(receipts: Receipt[], sort: SortKey): Receipt[] {
  const copy = receipts.slice();
  copy.sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const dir = sort === "newest" ? -1 : 1;
      const byDate = compareIso(a.occurredAt, b.occurredAt);
      if (byDate !== 0) {
        if (a.occurredAt == null || b.occurredAt == null) return byDate;
        return byDate * dir;
      }
      return a.id.localeCompare(b.id);
    }
    if (sort === "amount-desc" || sort === "amount-asc") {
      const av = a.amount;
      const bv = b.amount;
      if (av == null && bv == null) return a.id.localeCompare(b.id);
      if (av == null) return 1;
      if (bv == null) return -1;
      const diff = sort === "amount-desc" ? bv - av : av - bv;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    const av = a.attrs.kind === "spotify" ? a.attrs.msPlayed : null;
    const bv = b.attrs.kind === "spotify" ? b.attrs.msPlayed : null;
    if (av == null && bv == null) return a.id.localeCompare(b.id);
    if (av == null) return 1;
    if (bv == null) return -1;
    const diff = bv - av;
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
  return copy;
}

export function sortCompatibility(sort: SortKey, sources: SourceId[]): { ok: boolean; reason?: string } {
  if (sort === "amount-desc" || sort === "amount-asc") {
    const money = sources.length === 0 || sources.some((s) => s === "household" || s === "customer");
    if (!money) {
      return { ok: false, reason: "Amount sorting applies to household or customer receipts, not listening records." };
    }
    if (sources.includes("household") && sources.includes("customer")) {
      return {
        ok: true,
        reason: "Amounts are sorted numerically only. Household INR and customer amounts stay in different units and are not added together.",
      };
    }
  }
  if (sort === "duration-desc") {
    if (sources.length > 0 && !sources.includes("spotify")) {
      return { ok: false, reason: "Listening-duration sorting applies only to music records." };
    }
  }
  return { ok: true };
}

export type SearchDoc = {
  id: string;
  source: SourceId;
  category: string;
  occurredAt: string | null;
  subjectKey: string | null;
  amount: number | null;
  msPlayed: number | null;
  text: string;
};

export function toSearchDoc(receipt: Receipt): SearchDoc {
  return {
    id: receipt.id,
    source: receipt.source,
    category: receipt.category,
    occurredAt: receipt.occurredAt,
    subjectKey: receipt.subjectKey,
    amount: receipt.amount,
    msPlayed: receipt.attrs.kind === "spotify" ? receipt.attrs.msPlayed : null,
    text: searchText(receipt),
  };
}

export function applyDocFilters(docs: SearchDoc[], query: ExplorerQuery): SearchDoc[] {
  const sourceSet = new Set(query.sources);
  const catSet = new Set(query.categories);
  const tokens = tokenize(query.q);
  return docs.filter((r) => {
    if (sourceSet.size > 0 && !sourceSet.has(r.source)) return false;
    if (catSet.size > 0 && !catSet.has(r.category)) return false;
    if (query.dateFrom || query.dateTo) {
      if (!r.occurredAt) return false;
      const day = r.occurredAt.slice(0, 10);
      if (query.dateFrom && day < query.dateFrom) return false;
      if (query.dateTo && day > query.dateTo) return false;
    }
    if (query.customer && r.source === "customer") {
      if (query.customer === "unassigned") {
        if (r.subjectKey) return false;
      } else if (r.subjectKey !== query.customer) {
        return false;
      }
    }
    if (tokens.length === 0) return true;
    return tokens.every((t) => r.text.includes(t));
  });
}

export function sortDocs(docs: SearchDoc[], sort: SortKey): SearchDoc[] {
  const copy = docs.slice();
  copy.sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const dir = sort === "newest" ? -1 : 1;
      const byDate = compareIso(a.occurredAt, b.occurredAt);
      if (byDate !== 0) {
        if (a.occurredAt == null || b.occurredAt == null) return byDate;
        return byDate * dir;
      }
      return a.id.localeCompare(b.id);
    }
    if (sort === "amount-desc" || sort === "amount-asc") {
      const av = a.amount;
      const bv = b.amount;
      if (av == null && bv == null) return a.id.localeCompare(b.id);
      if (av == null) return 1;
      if (bv == null) return -1;
      const diff = sort === "amount-desc" ? bv - av : av - bv;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    }
    const av = a.msPlayed;
    const bv = b.msPlayed;
    if (av == null && bv == null) return a.id.localeCompare(b.id);
    if (av == null) return 1;
    if (bv == null) return -1;
    const diff = bv - av;
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
  return copy;
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, pages };
}
