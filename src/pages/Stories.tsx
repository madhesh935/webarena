import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Compass, GitBranch, Bookmark } from "lucide-react";
import { JourneyChart, PeriodCompare } from "../components/Charts";
import { PageSkeleton } from "../components/PageSkeleton";
import { ErrorBox, SourceChip } from "../components/UiElements";
import { useAppData } from "../context/AppDataContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatHours, formatNumber } from "../lib/format";
import type { SourceId } from "../lib/model";

const PATHS = [
  {
    to: "/",
    title: "Stories",
    blurb: "Three chapters with evidence, limits, and the receipts behind them.",
    icon: BookOpen,
  },
  {
    to: "/explore",
    title: "Explore",
    blurb: "Search, filter, and sort across music, household, and purchase receipts.",
    icon: Compass,
  },
  {
    to: "/connections",
    title: "Connections",
    blurb: "See related receipts in the same source, plus similar patterns elsewhere.",
    icon: GitBranch,
  },
  {
    to: "/saved",
    title: "Saved",
    blurb: "Keep bookmarks, collections, and personal notes on this device.",
    icon: Bookmark,
  },
] as const;

export function StoriesPage() {
  const { overview, stories, shellError, reloadShell, receipts, ensureSource } = useAppData();
  const [journeySource, setJourneySource] = useState<SourceId>("spotify");
  useDocumentTitle("Stories");

  useEffect(() => {
    void ensureSource("spotify");
  }, [ensureSource]);

  if (shellError) {
    return (
      <main id="main" className="page">
        <ErrorBox title="Summaries could not load" onRetry={reloadShell}>
          {shellError}
        </ErrorBox>
      </main>
    );
  }
  if (!overview || !stories) {
    return <PageSkeleton label="Loading stories and source summaries…" />;
  }

  const firstChapter = stories.chapters[0];

  return (
    <main id="main" className="page">
      <section className="hero hero-ticket reveal">
        <div className="hero-copy">
          <p className="kicker">Life in Receipts</p>
          <h1>Small moments. A bigger story.</h1>
          <p className="lede">Explore the habits hidden in music, routines and purchases.</p>
          <p>
            Separate sources, shared themes. These records were never merged into one life story — the collage is
            illustration, not photos from the files.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={`/stories/${firstChapter.id}`}>
              Discover a story
            </Link>
            <Link className="btn btn-secondary" to="/explore">
              Explore receipts
            </Link>
          </div>
        </div>
        <div className="collage" aria-hidden="true">
          <p className="ink-stamp">Separate sources</p>
          <article className="receipt-card tilt-a">
            <SourceChip source="spotify" />
            <p className="meta">UTC listening</p>
            <strong>{formatNumber(overview.spotify.records)}</strong>
            <p>recorded plays</p>
          </article>
          <article className="receipt-card tilt-b">
            <SourceChip source="household" />
            <p className="meta">INR ledger</p>
            <strong>{formatNumber(overview.household.records)}</strong>
            <p>household rows</p>
          </article>
          <article className="receipt-card tilt-c">
            <SourceChip source="customer" />
            <p className="meta">Many customers</p>
            <strong>{formatNumber(overview.customer.records)}</strong>
            <p>purchase rows</p>
          </article>
        </div>
      </section>

      <section className="path-grid" aria-label="Ways to explore">
        <div className="path-head">
          <h2>Ways to explore</h2>
          <p className="muted">
            Stories, search, connections, and saved notes — four ways through the same three sources.
          </p>
        </div>
        <div className="path-cards">
          {PATHS.map((path) => (
            <Link key={path.title} className="path-card" to={path.to === "/" ? `/stories/${firstChapter.id}` : path.to}>
              <path.icon size={18} aria-hidden="true" />
              <strong>{path.title}</strong>
              <span>{path.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="ledger-rule" aria-hidden="true" />

      <section className="stat-row" aria-label="Computed source totals">
        <div className="stat">
          <strong>{formatNumber(overview.spotify.uniqueArtists)}</strong>
          <span>artists in the listening file, not unique people</span>
        </div>
        <div className="stat">
          <strong>{formatHours(overview.spotify.totalMs)}</strong>
          <span>listening time, excluding {formatNumber(overview.spotify.zeroDuration)} zero-duration records</span>
        </div>
        <div className="stat">
          <strong>{formatNumber(overview.household.expenseCount)}</strong>
          <span>household expenses, separate from income and transfers</span>
        </div>
        <div className="stat">
          <strong>{formatNumber(overview.customer.uniqueGroups)}</strong>
          <span>recorded customer IDs, plus {formatNumber(overview.customer.unassigned)} unassigned rows</span>
        </div>
      </section>

      <h2>Chapters</h2>
      <div className="chapter-grid">
        {stories.chapters.map((chapter, index) => (
          <article className="chapter-card" key={chapter.id}>
            <p className="kicker">
              Chapter {index + 1} · {chapter.question}
            </p>
            <h3>{chapter.title}</h3>
            <p>{chapter.teaser}</p>
            <p className="chip-row">
              {chapter.sources.map((s) => (
                <SourceChip key={s} source={s} />
              ))}
            </p>
            <Link className="btn btn-primary" to={`/stories/${chapter.id}`}>
              Open story
            </Link>
          </article>
        ))}
      </div>

      <p className="source-jumps">
        <Link className="btn btn-secondary" to="/explore?sources=spotify">
          Listening receipts
        </Link>
        <Link className="btn btn-secondary" to="/explore?sources=household">
          Household receipts
        </Link>
        <Link className="btn btn-secondary" to="/explore?sources=customer">
          Customer receipts
        </Link>
      </p>

      <div className="story-tools">
        <JourneyChart
          overview={overview}
          source={journeySource}
          onSource={(s) => {
            setJourneySource(s);
            void ensureSource(s);
          }}
        />
        <PeriodCompare
          key={journeySource}
          source={journeySource}
          receipts={receipts[journeySource]}
          customerGroups={overview.customer.topGroups}
        />
      </div>
    </main>
  );
}
