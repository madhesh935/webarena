import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { JourneyChart, PeriodCompare } from "../components/charts";
import { ReceiptCard, ReceiptDetail } from "../components/receipts";
import { Button, DialogSheet, EmptyState, ErrorBox, Field, LiveRegion, SourceChip } from "../components/ui";
import { useAppData } from "../context/app-context";
import { MEDIA_QUERIES, PAGE_SIZE } from "../constants";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useLockBody, useMedia } from "../hooks/use-media";
import { useFilteredReceipts } from "../hooks/useSearchWorker";
import { paginate, sortCompatibility, type ExplorerQuery, type SortKey } from "../lib/filters";
import { formatNumber } from "../lib/format";
import { SOURCES, type SourceId } from "../lib/model";
import { exploreSearchParams, parseExploreSearch } from "../lib/url-state";

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const parsed = parseExploreSearch(params.toString());
  const { overview, receipts, status, errors, ensureSources, ensureSource, getReceipt } = useAppData();
  const desktop = useMedia(MEDIA_QUERIES.desktop);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollY = useRef(0);
  const [draftQ, setDraftQ] = useState(parsed.q);
  const debouncedQ = useDebouncedValue(draftQ);
  const [journeySource, setJourneySource] = useState<SourceId>(parsed.sources[0] ?? "spotify");

  const needed: SourceId[] = parsed.sources.length ? parsed.sources : [...SOURCES];
  const neededKey = needed.join(",");

  useEffect(() => {
    void ensureSources(neededKey.split(",") as SourceId[]);
  }, [neededKey, ensureSources]);

  useEffect(() => {
    void ensureSource(journeySource);
  }, [journeySource, ensureSource]);

  const closeReceipt = useCallback(() => {
    setParams((prev) => {
      const current = parseExploreSearch(prev.toString());
      return exploreSearchParams(current, current.page, null);
    });
    requestAnimationFrame(() => window.scrollTo(0, scrollY.current));
  }, [setParams]);

  useEffect(() => {
    if (parsed.receipt) closeRef.current?.focus();
  }, [parsed.receipt]);

  useLockBody(Boolean(parsed.receipt) && !desktop);

  const query: ExplorerQuery = {
    q: debouncedQ,
    sources: parsed.sources,
    categories: parsed.categories,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    customer: parsed.customer,
    sort: parsed.sort,
  };

  const loadingSources = needed.filter((s) => status[s] !== "ready" && status[s] !== "error");
  const ready = needed.filter((s) => status[s] === "ready");
  const failed = needed.filter((s) => status[s] === "error");
  const complete = loadingSources.length === 0;

  const readyKey = ready.join(",");
  const pool = useMemo(
    () => (readyKey ? readyKey.split(",").flatMap((s) => receipts[s as SourceId] ?? []) : []),
    [readyKey, receipts],
  );

  const filteredState = useFilteredReceipts(pool, query);
  const filtered = filteredState.receipts;
  const page = paginate(filtered, parsed.page, PAGE_SIZE);
  const selected = parsed.receipt ? getReceipt(parsed.receipt) : undefined;
  const sortNote = filteredState.sortNote;
  const sortBlocked = filteredState.blocked;
  const amountSortOk = sortCompatibility("amount-desc", parsed.sources).ok;
  const durationSortOk = sortCompatibility("duration-desc", parsed.sources).ok;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of pool) {
      if (parsed.sources.length === 0 || parsed.sources.includes(r.source)) set.add(r.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).slice(0, 80);
  }, [pool, parsed.sources]);

  const customerOptions = overview?.customer.topGroups ?? [];

  const update = (next: Partial<typeof parsed>) => {
    setParams((prev) => {
      const current = parseExploreSearch(prev.toString());
      const merged = { ...current, ...next };
      if (
        next.q !== undefined ||
        next.sources ||
        next.categories ||
        next.dateFrom !== undefined ||
        next.dateTo !== undefined ||
        next.customer !== undefined ||
        next.sort
      ) {
        merged.page = 1;
      }
      return exploreSearchParams(merged, merged.page, merged.receipt);
    });
  };

  useEffect(() => {
    if (debouncedQ === parsed.q) return;
    setParams((prev) => {
      const current = parseExploreSearch(prev.toString());
      if (current.q === debouncedQ) return prev;
      return exploreSearchParams({ ...current, q: debouncedQ }, 1, current.receipt);
    });
  }, [debouncedQ, parsed.q, setParams]);

  const openReceipt = (id: string) => {
    scrollY.current = window.scrollY;
    update({ receipt: id });
  };

  const toggleSource = (source: SourceId) => {
    const has = parsed.sources.includes(source);
    update({ sources: has ? parsed.sources.filter((s) => s !== source) : [...parsed.sources, source] });
  };

  return (
    <main id="main" className="page page-wide">
      <h1>Explore receipts</h1>
      <p>
        Search and filter stay inside the published fields. Counts use every loaded matching row, not only this page.
        The address bar keeps your filters so you can share a view.
      </p>

      {overview ? (
        <>
          <JourneyChart
            overview={overview}
            source={journeySource}
            onSource={(source) => {
              setJourneySource(source);
              void ensureSource(source);
            }}
          />
          <PeriodCompare
            key={journeySource}
            source={journeySource}
            receipts={receipts[journeySource]}
            customerGroups={overview.customer.topGroups}
          />
        </>
      ) : null}

      <div className="filters">
        <input
          className="search-box"
          type="search"
          placeholder="Songs, artists, notes, merchants, groups"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          aria-label="Search receipts"
        />
        <div className="filters-row">
          {SOURCES.map((s) => (
            <Button key={s} type="button" aria-pressed={parsed.sources.includes(s)} onClick={() => toggleSource(s)}>
              <SourceChip source={s} />
            </Button>
          ))}
          <Field label="Category">
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                if (!parsed.categories.includes(e.target.value)) update({ categories: [...parsed.categories, e.target.value] });
              }}
            >
              <option value="">Add a category</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="date" value={parsed.dateFrom ?? ""} onChange={(e) => update({ dateFrom: e.target.value || null })} />
          </Field>
          <Field label="To">
            <input type="date" value={parsed.dateTo ?? ""} onChange={(e) => update({ dateTo: e.target.value || null })} />
          </Field>
          <Field label="Customer group">
            <select
              value={parsed.customer ?? ""}
              onChange={(e) => update({ customer: e.target.value || null })}
              disabled={parsed.sources.length > 0 && !parsed.sources.includes("customer")}
            >
              <option value="">All groups</option>
              <option value="unassigned">Unassigned records</option>
              {customerOptions.map((g) => (
                <option key={g.label} value={g.label}>
                  {g.label} ({g.count})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort">
            <select value={parsed.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
              <option value="newest">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="amount-desc" disabled={!amountSortOk}>
                Amount high to low
              </option>
              <option value="amount-asc" disabled={!amountSortOk}>
                Amount low to high
              </option>
              <option value="duration-desc" disabled={!durationSortOk}>
                Listening duration
              </option>
            </select>
          </Field>
          <Button type="button" onClick={() => setParams(new URLSearchParams())}>
            Clear all
          </Button>
        </div>
        <div className="filters-row">
          {parsed.sources.map((s) => (
            <button key={s} className="chip filter-chip" type="button" onClick={() => toggleSource(s)}>
              {s} ×
            </button>
          ))}
          {parsed.categories.map((c) => (
            <button
              key={c}
              className="chip filter-chip"
              type="button"
              onClick={() => update({ categories: parsed.categories.filter((x) => x !== c) })}
            >
              {c} ×
            </button>
          ))}
          {parsed.q ? <span className="chip">Search: {parsed.q}</span> : null}
          {parsed.dateFrom || parsed.dateTo ? (
            <span className="chip">
              {parsed.dateFrom || "…"} to {parsed.dateTo || "…"}
            </span>
          ) : null}
          {parsed.customer ? <span className="chip">{parsed.customer}</span> : null}
        </div>
      </div>

      {sortNote ? <p className="muted">{sortBlocked ? `This sort is disabled. ${sortNote} Showing most recent instead.` : sortNote}</p> : null}

      {failed.map((s) => (
        <ErrorBox key={s} title={`${s} failed to load`} onRetry={() => void ensureSource(s)}>
          {errors[s]}
        </ErrorBox>
      ))}

      {!complete ? (
        <p role="status">
          {loadingSources.join(", ")} {loadingSources.length === 1 ? "is" : "are"} still loading. The count below is not complete.
        </p>
      ) : filteredState.searching ? (
        <p role="status">Updating the full matching count…</p>
      ) : (
        <p>
          <strong>{formatNumber(filtered.length)}</strong> matching receipts
          {needed.length === 3 ? " across all three sources" : ""}.
        </p>
      )}
      <LiveRegion
        message={
          complete
            ? filteredState.searching
              ? "Updating matching receipts"
              : `${filtered.length} matching receipts`
            : "Sources still loading"
        }
      />

      <div className="explore-layout">
        <div>
          {complete && !filteredState.searching && filtered.length === 0 ? (
            <EmptyState title="No receipts match" action={<Button type="button" variant="primary" onClick={() => setParams(new URLSearchParams())}>Reset filters</Button>}>
              Try clearing a facet. Filters combine as OR inside a list and AND across lists.
            </EmptyState>
          ) : (
            <div className="card-grid">
              {page.items.map((r) => (
                <ReceiptCard key={r.id} receipt={r} onOpen={() => openReceipt(r.id)} />
              ))}
            </div>
          )}
          <div className="pager">
            <Button type="button" disabled={page.page <= 1} onClick={() => update({ page: page.page - 1 })}>
              Previous page
            </Button>
            <span>
              Page {page.page} of {page.pages}
            </span>
            <Button type="button" disabled={page.page >= page.pages} onClick={() => update({ page: page.page + 1 })}>
              Next page
            </Button>
          </div>
        </div>
        <DialogSheet open={Boolean(selected)} title="Receipt" onClose={closeReceipt} desktop={desktop} closeRef={closeRef}>
          {selected ? <ReceiptDetail receipt={selected} /> : desktop ? <p>Select a receipt to inspect it.</p> : null}
        </DialogSheet>
      </div>
    </main>
  );
}
