import { SOURCES, type SourceId } from "./model";
import { EMPTY_QUERY, type ExplorerQuery, type SortKey } from "./filters";

const SORTS: SortKey[] = ["newest", "oldest", "amount-desc", "amount-asc", "duration-desc"];

export function parseExploreSearch(search: string): ExplorerQuery & { page: number; receipt: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sources = (params.get("sources") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SourceId => (SOURCES as readonly string[]).includes(s));
  const sort = params.get("sort");
  const page = Number(params.get("page") || "1");
  return {
    q: params.get("q") ?? EMPTY_QUERY.q,
    sources,
    categories: (params.get("cats") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    dateFrom: params.get("from"),
    dateTo: params.get("to"),
    customer: params.get("customer"),
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "newest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    receipt: params.get("receipt"),
  };
}

export function exploreSearchParams(query: ExplorerQuery, page: number, receipt: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sources.length) params.set("sources", query.sources.join(","));
  if (query.categories.length) params.set("cats", query.categories.join(","));
  if (query.dateFrom) params.set("from", query.dateFrom);
  if (query.dateTo) params.set("to", query.dateTo);
  if (query.customer) params.set("customer", query.customer);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  if (receipt) params.set("receipt", receipt);
  return params;
}

export function serializeExploreSearch(query: ExplorerQuery, page: number, receipt: string | null): string {
  const s = exploreSearchParams(query, page, receipt).toString();
  return s ? `?${s}` : "";
}

export function parseStorySearch(search: string): { step: number; receipt: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const step = Number(params.get("step") || "1");
  return {
    step: Number.isFinite(step) && step > 0 ? step : 1,
    receipt: params.get("receipt"),
  };
}

export function serializeStorySearch(step: number, receipt: string | null): string {
  const params = new URLSearchParams();
  if (step > 1) params.set("step", String(step));
  if (receipt) params.set("receipt", receipt);
  const s = params.toString();
  return s ? `?${s}` : "";
}
