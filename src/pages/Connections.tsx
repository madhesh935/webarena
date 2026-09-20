import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ReceiptCard, ReceiptDetail } from "../components/receipts";
import { Button, EmptyState, SourceChip } from "../components/ui";
import { useAppData } from "../context/app-context";
import { candidatesFor } from "../data/indexes";
import { relatedReceipts, SESSION_RULE, thematicComparisons } from "../lib/relationships";
import type { Receipt, Relation } from "../lib/model";
import { SOURCES, type SourceId } from "../lib/model";

export function ConnectionsPage() {
  const { receiptId } = useParams();
  const navigate = useNavigate();
  const { getReceipt, ensureSource, ensureSources, indexes, receipts, status } = useAppData();
  const [history, setHistory] = useState<string[]>([]);
  const [why, setWhy] = useState<Relation | null>(null);
  const [listMode, setListMode] = useState(true);

  const focus = receiptId ? getReceipt(receiptId) : undefined;

  useEffect(() => {
    if (focus) void ensureSource(focus.source);
    else void ensureSources([...SOURCES]);
  }, [focus, ensureSource, ensureSources]);

  const related = useMemo(() => {
    if (!focus) return [];
    const idx = indexes[focus.source];
    const pool = idx ? candidatesFor(focus, idx) : (receipts[focus.source] ?? []).slice(0, 240);
    return relatedReceipts(focus, [focus, ...pool], 8);
  }, [focus, indexes, receipts]);

  const relatedReceiptMap = useMemo(() => {
    return related.map((rel) => ({ rel, receipt: getReceipt(rel.toId) })).filter((x): x is { rel: Relation; receipt: Receipt } => Boolean(x.receipt));
  }, [related, getReceipt]);

  const pick = (id: string) => {
    if (receiptId) setHistory((h) => [...h, receiptId]);
    setWhy(null);
    navigate(`/connections/${id}`);
  };

  const back = () => {
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setWhy(null);
    if (prev) navigate(`/connections/${prev}`);
    else navigate("/connections");
  };

  const reset = () => {
    setHistory([]);
    setWhy(null);
    navigate("/connections");
  };

  if (!receiptId) {
    const samples = SOURCES.flatMap((s) => (receipts[s] ?? []).slice(0, 3));
    return (
      <main id="main" className="page">
        <h1>Connections</h1>
        <p>
          Pick a receipt to see about 4–8 related records from the same source. Exact entity matches rank above weak
          proximity. {SESSION_RULE}
        </p>
        {samples.length === 0 ? (
          <p role="status">Loading sources so you can choose a starting receipt…</p>
        ) : (
          <div className="card-grid">
            {samples.map((r) => (
              <ReceiptCard key={r.id} receipt={r} onOpen={() => navigate(`/connections/${r.id}`)} />
            ))}
          </div>
        )}
        <p>
          <Link to="/explore">Or search for a receipt first</Link>
        </p>
      </main>
    );
  }

  if (!focus) {
    return (
      <main id="main" className="page">
        <p role="status">{status[receiptId.split(":")[0] as SourceId] === "ready" ? "That receipt is not in the loaded source." : "Loading the selected receipt…"}</p>
        <Button type="button" onClick={reset}>
          Reset
        </Button>
      </main>
    );
  }

  return (
    <main id="main" className="page">
      <h1>Connections</h1>
      <p>
        Relationships stay inside one source. A dashed action compares a theme in another file without drawing the same
        kind of edge.
      </p>
      <div className="hero-actions">
        <Button type="button" onClick={back} disabled={history.length === 0 && !why}>
          Back
        </Button>
        <Button type="button" onClick={reset}>
          Reset
        </Button>
        <Button type="button" aria-pressed={listMode} onClick={() => setListMode(true)}>
          List
        </Button>
        <Button type="button" aria-pressed={!listMode} onClick={() => setListMode(false)}>
          Map
        </Button>
      </div>

      <section className="panel">
        <h2>Focus</h2>
        <ReceiptDetail receipt={focus} />
      </section>

      {why ? (
        <section className="panel">
          <h2>Why they connect</h2>
          <p>{why.explanation}</p>
          <ul>
            {Object.entries(why.fields).map(([k, v]) => (
              <li key={k}>
                <span className="meta">{k}</span> {v}
              </li>
            ))}
          </ul>
          {getReceipt(why.toId) ? <ReceiptDetail receipt={getReceipt(why.toId)!} /> : null}
        </section>
      ) : null}

      <h2>Related receipts</h2>
      {relatedReceiptMap.length === 0 ? (
        <EmptyState title="No close relations in this source">
          Try another receipt, or compare a similar pattern in a different file.
        </EmptyState>
      ) : listMode ? (
        <div className="connection-list">
          {relatedReceiptMap.map(({ rel, receipt }) => (
            <button key={rel.toId} type="button" className="connection-item" onClick={() => setWhy(rel)}>
              <SourceChip source={receipt.source} />
              <strong> {receipt.title}</strong>
              <p>{rel.explanation}</p>
              <span className="meta">{rel.kind}</span>
            </button>
          ))}
        </div>
      ) : (
        <svg viewBox="0 0 640 360" role="img" aria-label="Related receipts around the focus record">
          <rect width="640" height="360" fill="#fffcf6" stroke="#d4cbb8" />
          <circle cx="320" cy="180" r="36" fill="#b83b15" />
          <text x="320" y="184" textAnchor="middle" fill="#fffdf8" fontSize="11">
            Focus
          </text>
          {relatedReceiptMap.map(({ rel, receipt }, i) => {
            const angle = (-Math.PI / 2) + (i * (2 * Math.PI)) / relatedReceiptMap.length;
            const x = 320 + Math.cos(angle) * 130;
            const y = 180 + Math.sin(angle) * 110;
            return (
              <g key={rel.toId}>
                <line x1="320" y1="180" x2={x} y2={y} stroke="#252722" strokeWidth="1.5" />
                <a href={`#/connections/${receipt.id}`}>
                  <circle cx={x} cy={y} r="22" fill={receipt.source === "spotify" ? "#e7def3" : receipt.source === "household" ? "#d7e5d3" : "#d4e3f2"} />
                  <title>{`${receipt.title}. ${rel.explanation}`}</title>
                </a>
              </g>
            );
          })}
        </svg>
      )}

      {!listMode ? (
        <div className="connection-list" style={{ marginTop: "0.75rem" }}>
          {relatedReceiptMap.map(({ rel, receipt }) => (
            <button key={rel.toId} type="button" className="connection-item" onClick={() => pick(receipt.id)}>
              Make {receipt.title} the focus
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Open a relation to read the evidence, then make that receipt the focus.</p>
      )}

      {why ? (
        <Button type="button" variant="primary" onClick={() => pick(why.toId)}>
          Make related receipt the focus
        </Button>
      ) : null}

      <h2>Compare a similar pattern</h2>
      {thematicComparisons(focus).map((item) => (
        <Link key={item.href} className="connection-item compare-action" to={item.href.replace("#", "")}>
          {item.label}
          <p>{item.explanation}</p>
        </Link>
      ))}
    </main>
  );
}
