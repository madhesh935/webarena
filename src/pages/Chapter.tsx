import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SimpleBars } from "../components/charts";
import { ReceiptCard, ReceiptDetail } from "../components/receipts";
import { Button, DialogSheet, ErrorBox, SourceChip } from "../components/ui";
import { MEDIA_QUERIES } from "../constants";
import { useAppData } from "../context/app-context";
import { useSaved } from "../context/saved-context";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLockBody, useMedia } from "../hooks/use-media";
import { parseStorySearch } from "../lib/url-state";
import { PageSkeleton } from "../components/PageSkeleton";

export function ChapterPage() {
  const { chapterId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { stories, overview, getReceipt, ensureSources, status } = useAppData();
  const saved = useSaved();
  const desktop = useMedia(MEDIA_QUERIES.desktop);
  const closeRef = useRef<HTMLButtonElement>(null);
  const parsed = parseStorySearch(params.toString());

  const chapter = stories?.chapters.find((c) => c.id === chapterId);
  useDocumentTitle(chapter?.title ?? "Chapter");
  const stepIndex = chapter ? Math.min(Math.max(parsed.step, 1), chapter.steps.length) - 1 : 0;
  const step = chapter?.steps[stepIndex];
  const insight = stories?.insights.find((i) => i.id === step?.insightId);

  useEffect(() => {
    if (chapter) void ensureSources(chapter.sources);
  }, [chapter, ensureSources]);

  useEffect(() => {
    if (parsed.receipt && desktop) closeRef.current?.focus();
  }, [parsed.receipt, desktop]);

  useLockBody(Boolean(parsed.receipt) && !desktop);

  const evidence = useMemo(() => {
    return (step?.receiptIds ?? []).map((id) => getReceipt(id)).filter((r) => r != null);
  }, [getReceipt, step]);

  if (!stories) {
    return <PageSkeleton label="Loading chapter…" />;
  }
  if (!chapter || !step) {
    return (
      <main id="main" className="page">
        <ErrorBox title="Chapter not found">
          That story is not in this build.
        </ErrorBox>
        <Link to="/">Back to stories</Link>
      </main>
    );
  }

  const go = (nextStep: number, receipt: string | null = parsed.receipt) => {
    const next = new URLSearchParams();
    if (nextStep > 1) next.set("step", String(nextStep));
    if (receipt) next.set("receipt", receipt);
    setParams(next, { replace: false });
  };

  const selected = parsed.receipt ? getReceipt(parsed.receipt) : undefined;
  const visualRows =
    insight && overview
      ? insight.id === "spotify-repeats"
        ? overview.spotify.topArtists.slice(0, 6)
        : insight.id === "household-milk"
          ? overview.household.repeatedNotes.slice(0, 6)
          : insight.id === "customer-repeat-merchant"
            ? overview.customer.topGroups.map((g) => ({ label: g.label, count: g.count })).slice(0, 6)
            : insight.id === "spotify-period"
              ? overview.spotify.years.map((y) => ({ label: String(y.year), count: y.records }))
              : insight.id === "household-period"
                ? overview.household.years.map((y) => ({ label: String(y.year), count: y.expenseCount }))
                : insight.id === "customer-period"
                  ? overview.customer.years.map((y) => ({ label: String(y.year), count: y.records }))
                  : []
      : [];

  return (
    <main id="main" className="page">
      <p className="kicker">
        Chapter {stories.chapters.findIndex((c) => c.id === chapter.id) + 1} of {stories.chapters.length}
      </p>
      <h1>{chapter.title}</h1>
      <p>{chapter.question}</p>
      <div className="progress" aria-label="Story steps">
        {chapter.steps.map((s, i) => (
          <button key={s.id} type="button" aria-current={i === stepIndex ? "step" : undefined} onClick={() => go(i + 1, null)}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="hero-actions chapter-actions">
        <Button type="button" onClick={() => navigate("/")}>
          Exit
        </Button>
        <Button type="button" disabled={stepIndex === 0} onClick={() => go(stepIndex, null)}>
          Previous
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={stepIndex === chapter.steps.length - 1}
          onClick={() => go(stepIndex + 2, null)}
        >
          Next
        </Button>
        {insight?.receiptIds[0] ? (
          <Button type="button" onClick={() => saved.toggleBookmark(insight.receiptIds[0])}>
            Save first evidence
          </Button>
        ) : null}
      </div>
      <section className="panel">
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {step.bridge ? (
          <div className="bridge">
            <SourceChip source={step.bridge.source} />
            <p>{step.bridge.label}</p>
            <Link to={step.bridge.href.replace("#", "")}>{step.bridge.label}</Link>
          </div>
        ) : null}
        {insight ? (
          <aside>
            <p className="meta">
              Insight {insight.id} · {insight.metric} · {insight.subjectScope}
            </p>
            <p>{insight.interpretation}</p>
            <ul>
              {insight.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </aside>
        ) : null}
        {visualRows.length > 0 ? (
          <SimpleBars rows={visualRows} caption="Computed from the published source extract, not from a joined biography." />
        ) : null}
      </section>

      {step.receiptIds.length > 0 ? (
        <section>
          <h2>Supporting receipts</h2>
          {chapter.sources.some((s) => status[s] !== "ready") ? (
            <p role="status">Loading evidence from {chapter.sources.filter((s) => status[s] !== "ready").join(", ")}…</p>
          ) : null}
          <div className="card-grid">
            {evidence.map((r) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                onOpen={() => go(parsed.step, r.id)}
                detailHref={`/connections/${r.id}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="hero-actions chapter-actions">
        <Button type="button" onClick={() => navigate("/")}>
          Exit
        </Button>
        <Button type="button" disabled={stepIndex === 0} onClick={() => go(stepIndex, null)}>
          Previous
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={stepIndex === chapter.steps.length - 1}
          onClick={() => go(stepIndex + 2, null)}
        >
          Next
        </Button>
        {insight?.receiptIds[0] ? (
          <Button type="button" onClick={() => saved.toggleBookmark(insight.receiptIds[0])}>
            Save first evidence
          </Button>
        ) : null}
      </div>

      <DialogSheet
        open={Boolean(selected)}
        title="Receipt"
        onClose={() => go(parsed.step, null)}
        desktop={desktop}
        closeRef={closeRef}
      >
        {selected ? <ReceiptDetail receipt={selected} /> : null}
      </DialogSheet>
    </main>
  );
}
