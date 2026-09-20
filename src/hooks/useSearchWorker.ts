import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyFilters,
  sortCompatibility,
  sortReceipts,
  toSearchDoc,
  type ExplorerQuery,
} from "../lib/filters";
import type { Receipt } from "../lib/model";

type WorkerResponse = {
  requestId: number;
  queryKey: string;
  ids: string[];
  total: number;
  sortNote?: string;
};

const WORKER_THRESHOLD = 4000;

function queryFingerprint(query: ExplorerQuery): string {
  return [
    query.q,
    query.sources.join(","),
    query.categories.join(","),
    query.dateFrom ?? "",
    query.dateTo ?? "",
    query.customer ?? "",
    query.sort,
  ].join("|");
}

function runLocal(pool: Receipt[], query: ExplorerQuery) {
  const compat = sortCompatibility(query.sort, query.sources);
  const sort = compat.ok ? query.sort : "newest";
  return {
    receipts: sortReceipts(applyFilters(pool, { ...query, sort }), sort),
    sortNote: compat.reason,
    blocked: !compat.ok,
  };
}

export function useFilteredReceipts(pool: Receipt[], query: ExplorerQuery) {
  const queryKey = queryFingerprint(query);
  const useWorker = pool.length >= WORKER_THRESHOLD && typeof Worker !== "undefined";

  const local = useMemo(() => {
    if (useWorker) return null;
    return runLocal(pool, query);
    // queryKey is the stable fingerprint of query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, queryKey, useWorker]);

  const [result, setResult] = useState<WorkerResponse | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const byId = useMemo(() => new Map(pool.map((row) => [row.id, row])), [pool]);

  useEffect(() => {
    if (!useWorker) {
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    const worker = new Worker(new URL("../workers/search.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.requestId !== requestId.current) return;
      setResult(event.data);
    };
    worker.postMessage({ type: "index", docs: pool.map(toSearchDoc) });
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [pool, useWorker]);

  useEffect(() => {
    if (!useWorker || !workerRef.current) return;
    requestId.current += 1;
    workerRef.current.postMessage({
      type: "query",
      requestId: requestId.current,
      queryKey,
      query,
    });
    // queryKey fingerprints query for this worker request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, useWorker, pool]);

  const workerReceipts = useMemo(() => {
    if (!result) return null;
    return result.ids.map((id) => byId.get(id)).filter((row): row is Receipt => Boolean(row));
  }, [result, byId]);

  if (local) {
    return { receipts: local.receipts, sortNote: local.sortNote, blocked: local.blocked, searching: false };
  }

  const compat = sortCompatibility(query.sort, query.sources);
  return {
    receipts: workerReceipts ?? [],
    sortNote: result?.sortNote ?? compat.reason,
    blocked: !compat.ok,
    searching: !result || result.queryKey !== queryKey,
  };
}
