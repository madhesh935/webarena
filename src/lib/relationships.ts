import type { Receipt, Relation } from "./model";
import { looksLikeRoute, normalizeNote } from "./parse";

const SESSION_GAP_MS = 30 * 60 * 1000;

export const SESSION_RULE =
  "A nearby listening session is another play within 30 minutes, using the recorded stop times only.";

export function relatedReceipts(focus: Receipt, pool: Receipt[], limit = 8): Relation[] {
  const sameSource = pool.filter((r) => r.id !== focus.id && r.source === focus.source);
  const edges: Relation[] = [];

  if (focus.source === "spotify" && focus.attrs.kind === "spotify") {
    for (const other of sameSource) {
      if (other.attrs.kind !== "spotify") continue;
      if (sameTrack(focus, other)) {
        edges.push(edge(focus, other, "same-track", 100, "Same recorded track.", {
          track: focus.attrs.trackName,
          artist: focus.attrs.artistName,
        }));
      } else if (focus.attrs.artistName && focus.attrs.artistName === other.attrs.artistName) {
        edges.push(edge(focus, other, "same-artist", 80, `Same artist: ${focus.attrs.artistName}.`, {
          artist: focus.attrs.artistName,
        }));
      } else if (focus.attrs.albumName && focus.attrs.albumName === other.attrs.albumName) {
        edges.push(edge(focus, other, "same-album", 70, `Same album: ${focus.attrs.albumName}.`, {
          album: focus.attrs.albumName,
        }));
      } else if (nearbySession(focus, other)) {
        edges.push(edge(focus, other, "nearby-session", 40, `Nearby listening session. ${SESSION_RULE}`, {
          gap: sessionGapLabel(focus, other),
        }));
      }
    }
  }

  if (focus.source === "household" && focus.attrs.kind === "household") {
    for (const other of sameSource) {
      if (other.attrs.kind !== "household") continue;
      const noteA = normalizeNote(focus.attrs.note);
      const noteB = normalizeNote(other.attrs.note);
      if (noteA && noteA === noteB && looksLikeRoute(noteA)) {
        edges.push(edge(focus, other, "same-route", 90, `Matching route text: “${focus.attrs.note}”.`, {
          note: focus.attrs.note,
        }));
      } else if (noteA && noteA === noteB && noteA.length >= 4) {
        edges.push(edge(focus, other, "same-note", 85, `Repeated description: “${focus.attrs.note}”.`, {
          note: focus.attrs.note,
        }));
      } else if (focus.attrs.subcategory && focus.attrs.subcategory === other.attrs.subcategory) {
        edges.push(edge(focus, other, "same-subcategory", 75, `Same subcategory: ${focus.category} / ${focus.attrs.subcategory}.`, {
          subcategory: focus.attrs.subcategory,
        }));
      } else if (focus.category && focus.category === other.category && focus.category !== "Unknown") {
        edges.push(edge(focus, other, "same-category", 60, `Same household category: ${focus.category}.`, {
          category: focus.category,
        }));
      } else if (sameCalendarDay(focus, other)) {
        edges.push(edge(focus, other, "same-date", 25, "Same calendar date. This is a weaker proximity reason, not a repeated routine.", {
          date: focus.occurredAt?.slice(0, 10) ?? "",
        }));
      }
    }
  }

  if (focus.source === "customer" && focus.attrs.kind === "customer") {
    for (const other of sameSource) {
      if (other.attrs.kind !== "customer") continue;
      const sameGroup = Boolean(focus.subjectKey && focus.subjectKey === other.subjectKey);
      if (!sameGroup) continue;
      if (focus.attrs.merchantLabel && focus.attrs.merchantLabel === other.attrs.merchantLabel) {
        edges.push(edge(focus, other, "same-customer-merchant", 95, `Same recorded customer group and merchant: ${focus.attrs.merchantLabel}.`, {
          group: focus.subjectKey ?? "",
          merchant: focus.attrs.merchantLabel,
        }));
      } else if (focus.category && focus.category === other.category && focus.category !== "Unknown") {
        edges.push(edge(focus, other, "same-customer-category", 70, `Same recorded customer group and category: ${focus.category}.`, {
          group: focus.subjectKey ?? "",
          category: focus.category,
        }));
      } else if (nearbyCustomer(focus, other)) {
        edges.push(edge(focus, other, "same-customer-nearby", 35, "Same recorded customer group and timestamps within 24 hours. Grouping uses the recorded ID only.", {
          group: focus.subjectKey ?? "",
        }));
      }
    }
  }

  edges.sort((a, b) => b.rank - a.rank || a.toId.localeCompare(b.toId));
  const seen = new Set<string>();
  const unique: Relation[] = [];
  for (const e of edges) {
    if (seen.has(e.toId)) continue;
    seen.add(e.toId);
    unique.push(e);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function thematicComparisons(focus: Receipt): { label: string; href: string; explanation: string }[] {
  if (focus.source === "spotify") {
    return [
      {
        label: "Compare a similar pattern",
        href: "/explore?sources=household&q=subscription",
        explanation: "Household subscriptions are a recurring recorded activity, not the same listener.",
      },
      {
        label: "Compare a similar pattern",
        href: "/explore?sources=customer&sort=newest",
        explanation: "Customer groups also show repeated merchants. That is a theme, not a shared identity.",
      },
    ];
  }
  if (focus.source === "household") {
    return [
      {
        label: "Compare a similar pattern",
        href: "/explore?sources=spotify&sort=newest",
        explanation: "Listening records also contain repeats (artists, albums). Separate source, shared theme.",
      },
    ];
  }
  return [
    {
      label: "Compare a similar pattern",
      href: "/explore?sources=household&q=food",
      explanation: "Household notes show repeated purchases. Those rows are not this customer group.",
    },
  ];
}

function edge(
  from: Receipt,
  to: Receipt,
  kind: Relation["kind"],
  rank: number,
  explanation: string,
  fields: Record<string, string>,
): Relation {
  return {
    fromId: from.id,
    toId: to.id,
    kind,
    rank,
    explanation,
    fields,
    crossSource: false,
  };
}

function sameTrack(a: Receipt, b: Receipt): boolean {
  if (a.attrs.kind !== "spotify" || b.attrs.kind !== "spotify") return false;
  if (a.attrs.trackUri && b.attrs.trackUri && a.attrs.trackUri === b.attrs.trackUri) {
    return a.attrs.trackName === b.attrs.trackName;
  }
  return Boolean(
    a.attrs.trackName &&
      a.attrs.artistName &&
      a.attrs.trackName === b.attrs.trackName &&
      a.attrs.artistName === b.attrs.artistName,
  );
}

function nearbySession(a: Receipt, b: Receipt): boolean {
  const ta = utcMs(a);
  const tb = utcMs(b);
  if (ta == null || tb == null) return false;
  const gap = Math.abs(ta - tb);
  return gap > 0 && gap <= SESSION_GAP_MS;
}

function nearbyCustomer(a: Receipt, b: Receipt): boolean {
  const ta = unspecifiedMs(a);
  const tb = unspecifiedMs(b);
  if (ta == null || tb == null) return false;
  const gap = Math.abs(ta - tb);
  return gap > 0 && gap <= 24 * 60 * 60 * 1000;
}

function sameCalendarDay(a: Receipt, b: Receipt): boolean {
  if (!a.occurredAt || !b.occurredAt) return false;
  return a.occurredAt.slice(0, 10) === b.occurredAt.slice(0, 10);
}

function utcMs(r: Receipt): number | null {
  if (!r.occurredAt || r.datePrecision !== "datetime") return null;
  const t = Date.parse(r.occurredAt);
  return Number.isFinite(t) ? t : null;
}

function unspecifiedMs(r: Receipt): number | null {
  if (!r.occurredAt || r.datePrecision !== "datetime") return null;
  const iso = r.occurredAt.length === 19 ? `${r.occurredAt}Z` : r.occurredAt;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function sessionGapLabel(a: Receipt, b: Receipt): string {
  const ta = utcMs(a);
  const tb = utcMs(b);
  if (ta == null || tb == null) return "";
  const mins = Math.round(Math.abs(ta - tb) / 60000);
  return `${mins} minutes between recorded stop times`;
}
