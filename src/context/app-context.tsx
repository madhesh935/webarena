import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildIndexes, receiptMap, type SourceIndexes } from "../data/indexes";
import { clearSourceCache, emptyStatus, loadOverview, loadSource, loadStories } from "../services/data";
import type { Overview, Receipt, SourceId, SourceStatus, StoriesManifest } from "../lib/model";

type AppData = {
  overview: Overview | null;
  stories: StoriesManifest | null;
  shellError: string | null;
  status: Record<SourceId, SourceStatus>;
  errors: Record<SourceId, string | null>;
  receipts: Partial<Record<SourceId, Receipt[]>>;
  byId: Map<string, Receipt>;
  indexes: Partial<Record<SourceId, SourceIndexes>>;
  reloadShell: () => void;
  ensureSource: (source: SourceId) => Promise<void>;
  ensureSources: (sources: SourceId[]) => Promise<void>;
  getReceipt: (id: string) => Receipt | undefined;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stories, setStories] = useState<StoriesManifest | null>(null);
  const [shellError, setShellError] = useState<string | null>(null);
  const [status, setStatus] = useState(emptyStatus);
  const [errors, setErrors] = useState<Record<SourceId, string | null>>({
    spotify: null,
    household: null,
    customer: null,
  });
  const [receipts, setReceipts] = useState<Partial<Record<SourceId, Receipt[]>>>({});
  const inflight = useRef<Partial<Record<SourceId, Promise<void>>>>({});

  const reloadShell = useCallback(() => {
    clearSourceCache();
    setShellError(null);
    Promise.all([loadOverview(), loadStories()])
      .then(([o, s]) => {
        setOverview(o);
        setStories(s);
      })
      .catch((err: Error) => setShellError(err.message));
  }, []);

  useEffect(() => {
    reloadShell();
  }, [reloadShell]);

  const ensureSource = useCallback(async (source: SourceId) => {
    if (inflight.current[source]) return inflight.current[source];
    const run = (async () => {
      setStatus((prev) => ({ ...prev, [source]: "loading" }));
      try {
        const rows = await loadSource(source);
        setReceipts((prev) => ({ ...prev, [source]: rows }));
        setStatus((prev) => ({ ...prev, [source]: "ready" }));
        setErrors((prev) => ({ ...prev, [source]: null }));
      } catch (err) {
        delete inflight.current[source];
        setStatus((prev) => ({ ...prev, [source]: "error" }));
        setErrors((prev) => ({ ...prev, [source]: err instanceof Error ? err.message : "Could not load this source." }));
      }
    })();
    inflight.current[source] = run;
    return run;
  }, []);

  const ensureSources = useCallback(
    async (sources: SourceId[]) => {
      await Promise.all(sources.map((s) => ensureSource(s)));
    },
    [ensureSource],
  );

  const indexes = useMemo(() => {
    const next: Partial<Record<SourceId, SourceIndexes>> = {};
    for (const source of ["spotify", "household", "customer"] as SourceId[]) {
      if (receipts[source]) next[source] = buildIndexes(receipts[source]!);
    }
    return next;
  }, [receipts]);

  const byId = useMemo(() => receiptMap(receipts), [receipts]);

  const getReceipt = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo(
    () => ({
      overview,
      stories,
      shellError,
      status,
      errors,
      receipts,
      byId,
      indexes,
      reloadShell,
      ensureSource,
      ensureSources,
      getReceipt,
    }),
    [overview, stories, shellError, status, errors, receipts, byId, indexes, reloadShell, ensureSource, ensureSources, getReceipt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
