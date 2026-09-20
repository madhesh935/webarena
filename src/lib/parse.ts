import type { DatePrecision, HouseholdKind } from "./model";

export type ParsedDate = {
  iso: string | null;
  precision: DatePrecision;
  utc: boolean;
};

const SPOTIFY_FORMATS = ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm:ssZ"];

export function parseExplicitBoolean(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const upper = trimmed.toUpperCase();
  if (upper === "TRUE") return true;
  if (upper === "FALSE") return false;
  return null;
}

export function parseNumberOrNull(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function keepAsString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function parseSpotifyUtc(value: string | null | undefined): ParsedDate {
  const raw = keepAsString(value);
  if (!raw) return { iso: null, precision: "unknown", utc: true };
  const normalized = raw.endsWith("Z") ? raw.slice(0, -1) : raw;
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return { iso: null, precision: "unknown", utc: true };
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (!isValidYmdHms(year, month, day, hour, minute, second)) {
    return { iso: null, precision: "unknown", utc: true };
  }
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  return { iso, precision: "datetime", utc: true };
}

export function parseHouseholdDate(value: string | null | undefined): ParsedDate & {
  dateOnly: boolean;
} {
  const raw = keepAsString(value);
  if (!raw) return { iso: null, precision: "unknown", utc: false, dateOnly: false };

  const timed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timed) {
    const day = Number(timed[1]);
    const month = Number(timed[2]);
    const year = Number(timed[3]);
    const hour = Number(timed[4]);
    const minute = Number(timed[5]);
    const second = timed[6] != null ? Number(timed[6]) : 0;
    if (!isValidYmdHms(year, month, day, hour, minute, second)) {
      return { iso: null, precision: "unknown", utc: false, dateOnly: false };
    }
    const iso = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`;
    return { iso, precision: "datetime", utc: false, dateOnly: false };
  }

  const dateOnly = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dateOnly) {
    const day = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const year = Number(dateOnly[3]);
    if (!isValidYmd(year, month, day)) {
      return { iso: null, precision: "unknown", utc: false, dateOnly: false };
    }
    const iso = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
    return { iso, precision: "date", utc: false, dateOnly: true };
  }

  return { iso: null, precision: "unknown", utc: false, dateOnly: false };
}

export function parseCustomerDate(value: string | null | undefined): ParsedDate {
  const raw = keepAsString(value);
  if (!raw) return { iso: null, precision: "unknown", utc: false };

  const timed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timed) {
    const month = Number(timed[1]);
    const day = Number(timed[2]);
    const year = Number(timed[3]);
    const hour = Number(timed[4]);
    const minute = Number(timed[5]);
    const second = timed[6] != null ? Number(timed[6]) : 0;
    if (!isValidYmdHms(year, month, day, hour, minute, second)) {
      return { iso: null, precision: "unknown", utc: false };
    }
    const iso = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}`;
    return { iso, precision: "datetime", utc: false };
  }

  const dateOnly = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dateOnly) {
    const month = Number(dateOnly[1]);
    const day = Number(dateOnly[2]);
    const year = Number(dateOnly[3]);
    if (!isValidYmd(year, month, day)) {
      return { iso: null, precision: "unknown", utc: false };
    }
    return {
      iso: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`,
      precision: "date",
      utc: false,
    };
  }

  return { iso: null, precision: "unknown", utc: false };
}

export function householdKind(value: string | null | undefined): HouseholdKind {
  const raw = keepAsString(value);
  if (raw === "Expense" || raw === "Income" || raw === "Transfer-Out") return raw;
  return raw ? "Unknown" : "Unknown";
}

export function unknownLabel(value: string | null | undefined, fallback = "Unknown"): string {
  const raw = keepAsString(value);
  return raw || fallback;
}

export function stripMerchantPrefix(merchant: string): {
  label: string;
  stripped: boolean;
  asRecorded: string;
} {
  const asRecorded = keepAsString(merchant);
  if (/^fraud_/i.test(asRecorded)) {
    return { label: asRecorded.replace(/^fraud_/i, ""), stripped: true, asRecorded };
  }
  return { label: asRecorded || "Unknown merchant", stripped: false, asRecorded };
}

export function receiptId(source: string, rowIndex: number): string {
  return `${source}:${rowIndex}`;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function normalizeNote(note: string): string {
  return keepAsString(note).toLowerCase().replace(/\s+/g, " ");
}

export function looksLikeRoute(note: string): boolean {
  const n = normalizeNote(note);
  return /\bto\b/.test(n) && (/\bplace\b/.test(n) || /\breturn\b/.test(n) || /\bresidence\b/.test(n) || /\bstation\b/.test(n));
}

export function dateKeyFromIso(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function hourFromIso(iso: string | null, precision: DatePrecision): number | null {
  if (!iso || precision !== "datetime" || iso.length < 13) return null;
  const hour = Number(iso.slice(11, 13));
  return Number.isFinite(hour) ? hour : null;
}

export function compareIso(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function percentPointDiff(shareA: number, shareB: number): number {
  return (shareB - shareA) * 100;
}

export function relativeChange(baseline: number, current: number): number | null {
  if (baseline === 0) return null;
  return (current - baseline) / baseline;
}

export function perDayRate(total: number, startIso: string, endIso: string): number {
  const days = inclusiveDays(startIso, endIso);
  return days === 0 ? total : total / days;
}

export function inclusiveDays(startIso: string, endIso: string): number {
  const start = Date.UTC(
    Number(startIso.slice(0, 4)),
    Number(startIso.slice(5, 7)) - 1,
    Number(startIso.slice(8, 10)),
  );
  const end = Date.UTC(
    Number(endIso.slice(0, 4)),
    Number(endIso.slice(5, 7)) - 1,
    Number(endIso.slice(8, 10)),
  );
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1800 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function isValidYmdHms(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  if (!isValidYmd(year, month, day)) return false;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export const PARSE_FORMATS = { SPOTIFY_FORMATS };
