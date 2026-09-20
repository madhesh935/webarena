import type { DatePrecision, Receipt, SourceId } from "./model";
import { SOURCE_META } from "./model";

export function formatDate(iso: string | null, precision: DatePrecision, timezoneNote: Receipt["timezoneNote"]): string {
  if (!iso) return "Date not recorded";
  if (precision === "date") return `${iso} (date only)`;
  if (timezoneNote === "utc") return `${iso.replace("T", " ").replace("Z", "")} UTC`;
  if (precision === "datetime") return `${iso.replace("T", " ")} (timezone not recorded)`;
  return iso;
}

export function formatAmount(amount: number | null, currency: string | null, source: SourceId): string {
  if (amount == null) return "Amount not recorded";
  if (source === "customer") {
    return `${formatNumber(amount)} · Amount; currency unspecified`;
  }
  if (currency) return `${formatNumber(amount)} ${currency}`;
  return formatNumber(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "Duration not recorded";
  if (ms === 0) return "0 ms (recorded, no listening time)";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  if (totalSec === 0) return `${ms} ms`;
  return `${s}s`;
}

export function formatHours(ms: number): string {
  return `${formatNumber(Math.round((ms / 3_600_000) * 10) / 10)} hours`;
}

export function sourceLabel(source: SourceId): string {
  return SOURCE_META[source].label;
}

export function boolLabel(value: boolean | null): string {
  if (value == null) return "Not recorded";
  return value ? "True" : "False";
}

export function displayTitle(receipt: Receipt): string {
  return receipt.title || "Untitled record";
}

export function receiptDetailLine(receipt: Receipt): string {
  if (receipt.attrs.kind === "spotify") {
    const listen = formatDuration(receipt.attrs.msPlayed);
    return `${receipt.attrs.artistName || "Unknown artist"} · ${listen}`;
  }
  if (receipt.attrs.kind === "household") {
    return `${receipt.attrs.householdKind} · ${formatAmount(receipt.amount, receipt.currency, "household")}`;
  }
  const group = receipt.subjectKey ?? "Unassigned customer record";
  return `${group} · ${formatAmount(receipt.amount, receipt.currency, "customer")}`;
}
