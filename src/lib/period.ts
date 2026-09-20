import type { Receipt, SourceId } from "./model";
import { inclusiveDays, percentPointDiff, relativeChange } from "./parse";

export type PeriodWindow = {
  label: string;
  start: string;
  end: string;
};

export type PeriodMetric = {
  key: string;
  label: string;
  unit: string;
  a: number;
  b: number;
  delta: number;
  deltaLabel: string;
  shareA?: number;
  shareB?: number;
  shareDeltaPp?: number;
};

export type PeriodComparison = {
  source: SourceId;
  scope: string;
  a: PeriodWindow;
  b: PeriodWindow;
  daysA: number;
  daysB: number;
  unequal: boolean;
  coverageNote: string;
  metrics: PeriodMetric[];
  supportingIdsA: string[];
  supportingIdsB: string[];
};

export function receiptsInWindow(receipts: Receipt[], window: PeriodWindow, source: SourceId): Receipt[] {
  return receipts.filter((r) => {
    if (r.source !== source || !r.occurredAt) return false;
    const day = r.occurredAt.slice(0, 10);
    return day >= window.start && day <= window.end;
  });
}

export function comparePeriods(
  receipts: Receipt[],
  source: SourceId,
  a: PeriodWindow,
  b: PeriodWindow,
  scopeLabel: string,
  customerKey?: string | null,
): PeriodComparison {
  let scoped = receipts.filter((r) => r.source === source);
  if (source === "customer" && customerKey) {
    scoped =
      customerKey === "unassigned"
        ? scoped.filter((r) => !r.subjectKey)
        : scoped.filter((r) => r.subjectKey === customerKey);
  }
  const ra = receiptsInWindow(scoped, a, source);
  const rb = receiptsInWindow(scoped, b, source);
  const daysA = inclusiveDays(a.start, a.end);
  const daysB = inclusiveDays(b.start, b.end);
  const unequal = daysA !== daysB;
  const metrics: PeriodMetric[] = [];

  if (source === "spotify") {
    const playsA = ra.length;
    const playsB = rb.length;
    const msA = sumMs(ra);
    const msB = sumMs(rb);
    metrics.push(metric("records", "Recorded plays", "plays", playsA, playsB, daysA, daysB, unequal));
    metrics.push(metric("ms", "Listening time", "ms", msA, msB, daysA, daysB, unequal));
    const beatlesA = ra.filter(isArtist("The Beatles")).length;
    const beatlesB = rb.filter(isArtist("The Beatles")).length;
    metrics.push(shareMetric("beatles-share", "The Beatles share of recorded plays", beatlesA, playsA, beatlesB, playsB));
  } else if (source === "household") {
    const expA = ra.filter(isKind("Expense"));
    const expB = rb.filter(isKind("Expense"));
    const incA = ra.filter(isKind("Income"));
    const incB = rb.filter(isKind("Income"));
    const trA = ra.filter(isKind("Transfer-Out"));
    const trB = rb.filter(isKind("Transfer-Out"));
    metrics.push(metric("expense-count", "Expense records", "records", expA.length, expB.length, daysA, daysB, unequal));
    metrics.push(metric("expense-sum", "Expense total", "INR", sumAmount(expA), sumAmount(expB), daysA, daysB, unequal));
    metrics.push(metric("income-sum", "Income total", "INR", sumAmount(incA), sumAmount(incB), daysA, daysB, unequal));
    metrics.push(metric("transfer-sum", "Transfer-out total", "INR", sumAmount(trA), sumAmount(trB), daysA, daysB, unequal));
    const foodA = expA.filter((r) => r.category === "Food").length;
    const foodB = expB.filter((r) => r.category === "Food").length;
    metrics.push(shareMetric("food-share", "Food share of expense records", foodA, expA.length, foodB, expB.length));
  } else {
    metrics.push(metric("records", "Recorded purchases", "records", ra.length, rb.length, daysA, daysB, unequal));
    const amtA = sumAmount(ra);
    const amtB = sumAmount(rb);
    metrics.push({
      key: "amount",
      label: "Recorded amount total",
      unit: "Amount; currency unspecified",
      a: amtA,
      b: amtB,
      delta: amtB - amtA,
      deltaLabel: baselineDelta(amtA, amtB),
    });
    const shopA = ra.filter((r) => r.category === "online_shopping").length;
    const shopB = rb.filter((r) => r.category === "online_shopping").length;
    metrics.push(shareMetric("shop-share", "online_shopping share", shopA, ra.length, shopB, rb.length));
  }

  return {
    source,
    scope: scopeLabel,
    a,
    b,
    daysA,
    daysB,
    unequal,
    coverageNote: unequal
      ? `Window A is ${daysA} days and window B is ${daysB} days. Raw totals are not a preference change. Per-day rates are shown where the baseline exists.`
      : `Both windows cover ${daysA} days of calendar span. Recorded coverage inside each window can still be uneven.`,
    metrics,
    supportingIdsA: ra.slice(0, 12).map((r) => r.id),
    supportingIdsB: rb.slice(0, 12).map((r) => r.id),
  };
}

function metric(
  key: string,
  label: string,
  unit: string,
  a: number,
  b: number,
  daysA: number,
  daysB: number,
  unequal: boolean,
): PeriodMetric {
  const extra = unequal
    ? ` Per-day: ${rate(a, daysA)} vs ${rate(b, daysB)} ${unit}/day.`
    : "";
  return {
    key,
    label,
    unit,
    a,
    b,
    delta: b - a,
    deltaLabel: `${baselineDelta(a, b)}${extra}`,
  };
}

function shareMetric(
  key: string,
  label: string,
  partA: number,
  wholeA: number,
  partB: number,
  wholeB: number,
): PeriodMetric {
  const shareA = wholeA === 0 ? 0 : partA / wholeA;
  const shareB = wholeB === 0 ? 0 : partB / wholeB;
  return {
    key,
    label,
    unit: "share",
    a: partA,
    b: partB,
    shareA,
    shareB,
    shareDeltaPp: percentPointDiff(shareA, shareB),
    delta: percentPointDiff(shareA, shareB),
    deltaLabel:
      wholeA === 0
        ? "No baseline"
        : `${percentPointDiff(shareA, shareB).toFixed(2)} percentage points (${(shareA * 100).toFixed(1)}% → ${(shareB * 100).toFixed(1)}%)`,
  };
}

function baselineDelta(a: number, b: number): string {
  const rel = relativeChange(a, b);
  if (rel == null) return "No baseline";
  const pct = (rel * 100).toFixed(1);
  return `${b - a >= 0 ? "+" : ""}${(b - a).toLocaleString("en-US")} (${pct}%)`;
}

function rate(total: number, days: number): string {
  if (days === 0) return "n/a";
  return (total / days).toFixed(2);
}

function sumMs(rows: Receipt[]): number {
  return rows.reduce((s, r) => s + (r.attrs.kind === "spotify" && r.attrs.msPlayed != null ? r.attrs.msPlayed : 0), 0);
}

function sumAmount(rows: Receipt[]): number {
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0);
}

function isArtist(name: string) {
  return (r: Receipt) => r.attrs.kind === "spotify" && r.attrs.artistName === name;
}

function isKind(kind: string) {
  return (r: Receipt) => r.attrs.kind === "household" && r.attrs.householdKind === kind;
}

export function defaultWindows(source: SourceId): { a: PeriodWindow; b: PeriodWindow } {
  if (source === "spotify") {
    return {
      a: { label: "2017", start: "2017-01-01", end: "2017-12-31" },
      b: { label: "2024", start: "2024-01-01", end: "2024-12-15" },
    };
  }
  if (source === "household") {
    return {
      a: { label: "2015", start: "2015-01-01", end: "2015-12-31" },
      b: { label: "2017", start: "2017-01-01", end: "2017-12-31" },
    };
  }
  return {
    a: { label: "2022 (from 17 Apr)", start: "2022-04-17", end: "2022-12-31" },
    b: { label: "2023", start: "2023-01-01", end: "2023-12-31" },
  };
}
