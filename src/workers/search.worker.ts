import { applyDocFilters, sortCompatibility, sortDocs, type ExplorerQuery, type SearchDoc } from "../lib/filters";

type IndexMessage = { type: "index"; docs: SearchDoc[] };
type QueryMessage = { type: "query"; requestId: number; queryKey: string; query: ExplorerQuery };
type Request = IndexMessage | QueryMessage;

type Response = {
  requestId: number;
  queryKey: string;
  ids: string[];
  total: number;
  sortNote?: string;
};

let docs: SearchDoc[] = [];
let latest = 0;

self.onmessage = (event: MessageEvent<Request>) => {
  const data = event.data;
  if (data.type === "index") {
    docs = data.docs;
    return;
  }
  const { requestId, queryKey, query } = data;
  latest = requestId;
  const filtered = applyDocFilters(docs, query);
  if (requestId !== latest) return;
  const compat = sortCompatibility(query.sort, query.sources);
  const sort = compat.ok ? query.sort : "newest";
  const sorted = sortDocs(filtered, sort);
  if (requestId !== latest) return;
  const payload: Response = {
    requestId,
    queryKey,
    ids: sorted.map((row) => row.id),
    total: sorted.length,
    sortNote: compat.reason,
  };
  self.postMessage(payload);
};

export {};
