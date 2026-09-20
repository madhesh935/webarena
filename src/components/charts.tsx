import { useState } from "react";
import { Link } from "react-router-dom";
import type { Overview, SourceId } from "../lib/model";
import { formatHours, formatNumber } from "../lib/format";
import { comparePeriods, defaultWindows, type PeriodWindow } from "../lib/period";
import type { Receipt } from "../lib/model";
import { Button, Field } from "./ui";

const JOURNEY_SOURCES: SourceId[] = ["spotify", "household", "customer"];

export function JourneyChart({
  overview,
  source,
  onSource,
}: {
  overview: Overview;
  source: SourceId;
  onSource: (source: SourceId) => void;
}) {
  const points =
    source === "spotify"
      ? overview.spotify.years.map((y) => ({
          label: String(y.year),
          value: y.records,
          href: `#/explore?sources=spotify&from=${y.year}-01-01&to=${y.year}-12-31`,
          extra: formatHours(y.listeningMs),
        }))
      : source === "household"
        ? overview.household.years.map((y) => ({
            label: String(y.year),
            value: y.expenseCount,
            href: `#/explore?sources=household&from=${y.year}-01-01&to=${y.year}-12-31`,
            extra: `${formatNumber(Math.round(y.expenseSum))} INR expenses`,
          }))
        : overview.customer.years.map((y) => ({
            label: String(y.year),
            value: y.records,
            href: `#/explore?sources=customer&from=${y.year}-01-01&to=${y.year}-12-31`,
            extra: y.amountSum == null ? "Amount; currency unspecified" : `${formatNumber(Math.round(y.amountSum))} (currency unspecified)`,
          }));
  const max = Math.max(...points.map((p) => p.value), 1);
  const metric =
    source === "spotify"
      ? "Recorded plays and listening time (UTC years). Plays include zero-duration rows."
      : source === "household"
        ? "Expense record counts and INR expense totals. Transfers and income are excluded from these bars."
        : "Dated purchase counts across many customers. Amounts are not INR and are not added to the household ledger.";

  const moveTab = (from: SourceId, key: string) => {
    const index = JOURNEY_SOURCES.indexOf(from);
    let next = from;
    if (key === "ArrowRight") next = JOURNEY_SOURCES[(index + 1) % JOURNEY_SOURCES.length];
    if (key === "ArrowLeft") next = JOURNEY_SOURCES[(index - 1 + JOURNEY_SOURCES.length) % JOURNEY_SOURCES.length];
    if (key === "Home") next = JOURNEY_SOURCES[0];
    if (key === "End") next = JOURNEY_SOURCES[JOURNEY_SOURCES.length - 1];
    if (next === from) return;
    onSource(next);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-journey="${next}"]`)?.focus();
    });
  };

  return (
    <section className="panel" aria-labelledby="journey-title">
      <h2 id="journey-title">Observed activity over time</h2>
      <p>{metric}</p>
      <div className="filters-row" role="tablist" aria-label="Journey source">
        {JOURNEY_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-secondary"
            role="tab"
            data-journey={s}
            id={`journey-tab-${s}`}
            aria-selected={source === s}
            tabIndex={source === s ? 0 : -1}
            onClick={() => onSource(s)}
            onKeyDown={(event) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                moveTab(s, event.key);
              }
            }}
          >
            {s === "spotify" ? "Listening" : s === "household" ? "Household" : "Customer"}
          </button>
        ))}
      </div>
      <div className="visually-chart" role="tabpanel" aria-labelledby={`journey-tab-${source}`}>
        {points.map((p) => (
          <div className="chart-row" key={p.label}>
            <span>{p.label}</span>
            <Link to={p.href.replace("#", "")} aria-label={`${p.label}: ${p.value} records. ${p.extra}`}>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${(p.value / max) * 100}%` }} />
              </div>
            </Link>
            <span>{formatNumber(p.value)}</span>
          </div>
        ))}
      </div>
      <p className="muted">Select a year to open the explorer with that date range. Scope stays inside this source.</p>
    </section>
  );
}

type GroupOption = { label: string; count: number };

export function PeriodCompare({
  source,
  receipts,
  customerGroups = [],
}: {
  source: SourceId;
  receipts: Receipt[] | undefined;
  customerGroups?: GroupOption[];
}) {
  const defaults = defaultWindows(source);
  const [aStart, setAStart] = useState(defaults.a.start);
  const [aEnd, setAEnd] = useState(defaults.a.end);
  const [bStart, setBStart] = useState(defaults.b.start);
  const [bEnd, setBEnd] = useState(defaults.b.end);
  const [customerKey, setCustomerKey] = useState("");

  const windowA = makeWindow("Period A", aStart, aEnd);
  const windowB = makeWindow("Period B", bStart, bEnd);
  const invalid = !windowA || !windowB;

  const scope =
    source === "customer"
      ? customerKey === "unassigned"
        ? "Unassigned customer records only"
        : customerKey
          ? `Recorded customer group: ${customerKey}`
          : "All dated customer rows unless a group is selected"
      : "All records in this source";

  const live =
    !invalid && receipts
      ? comparePeriods(receipts, source, windowA, windowB, scope, source === "customer" ? customerKey || null : null)
      : null;

  return (
    <section className="panel" aria-labelledby="period-title">
      <h3 id="period-title">Period A versus period B</h3>
      <p>
        Compare two windows inside this source. Totals are not a preference change when the windows cover different
        numbers of days. Customer amounts stay “Amount; currency unspecified” and are never added to household INR.
      </p>
      <div className="period-grid">
        <fieldset className="period-set">
          <legend>Period A</legend>
          <DateFields from={aStart} to={aEnd} onFrom={setAStart} onTo={setAEnd} />
        </fieldset>
        <fieldset className="period-set">
          <legend>Period B</legend>
          <DateFields from={bStart} to={bEnd} onFrom={setBStart} onTo={setBEnd} />
        </fieldset>
      </div>
      {source === "customer" ? (
        <Field label="Customer group scope">
          <select value={customerKey} onChange={(event) => setCustomerKey(event.target.value)}>
            <option value="">All groups</option>
            <option value="unassigned">Unassigned records</option>
            {customerGroups.map((group) => (
              <option key={group.label} value={group.label}>
                {group.label} ({group.count})
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <p className="filters-row">
        <Button
          type="button"
          onClick={() => {
            const next = defaultWindows(source);
            setAStart(next.a.start);
            setAEnd(next.a.end);
            setBStart(next.b.start);
            setBEnd(next.b.end);
            setCustomerKey("");
          }}
        >
          Reset default windows
        </Button>
      </p>
      {!receipts ? <p>Period comparison will appear after this source loads.</p> : null}
      {receipts && invalid ? (
        <p role="status">Choose a start and end for both periods. The start date must be on or before the end date.</p>
      ) : null}
      {live ? (
        <>
          <p>
            {live.a.label} ({live.a.start}–{live.a.end}, {live.daysA} days) compared with {live.b.label} (
            {live.b.start}–{live.b.end}, {live.daysB} days). {live.coverageNote}
          </p>
          <p className="muted">{live.scope}</p>
          <ul>
            {live.metrics.map((m) => (
              <li key={m.key}>
                <strong>{m.label}.</strong> A: {formatNumber(m.a)} {m.unit}. B: {formatNumber(m.b)} {m.unit}. {m.deltaLabel}
              </li>
            ))}
          </ul>
          <p>
            <Link to={`/explore?sources=${source}&from=${live.a.start}&to=${live.a.end}`}>Receipts in period A</Link>
            {" · "}
            <Link to={`/explore?sources=${source}&from=${live.b.start}&to=${live.b.end}`}>Receipts in period B</Link>
          </p>
        </>
      ) : null}
    </section>
  );
}

function makeWindow(label: string, start: string, end: string): PeriodWindow | null {
  if (!start || !end || start > end) return null;
  return { label, start, end };
}

export function SimpleBars({
  rows,
  caption,
}: {
  rows: { label: string; count: number }[];
  caption: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <figure className="visually-chart">
      {rows.map((r) => (
        <div className="chart-row" key={r.label}>
          <span>{r.label}</span>
          <div className="chart-track" aria-hidden="true">
            <div className="chart-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span>{formatNumber(r.count)}</span>
        </div>
      ))}
      <figcaption className="muted">{caption}</figcaption>
    </figure>
  );
}

export function DateFields({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <>
      <Field label="From">
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </Field>
      <Field label="To">
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </Field>
    </>
  );
}
