import type {
  CompactFile,
  CustomerCompactRow,
  CustomerGroup,
  HouseholdCompactRow,
  Receipt,
  SpotifyCompactRow,
} from "../lib/model";
import { unknownLabel } from "../lib/parse";

export function decodeSpotify(file: CompactFile<SpotifyCompactRow>): Receipt[] {
  const d = file.dicts;
  return file.rows.map((row) => {
    const [sourceRow, tsSec, ms, uri, track, artist, album, platform, reasonStart, reasonEnd, flags] = row;
    const shuffleKnown = (flags & 1) !== 0;
    const shuffle = (flags & 2) !== 0;
    const skippedKnown = (flags & 4) !== 0;
    const skipped = (flags & 8) !== 0;
    const trackName = dict(d.track, track, "Unknown track");
    const artistName = dict(d.artist, artist, "Unknown artist");
    const occurredAt = tsSec == null ? null : new Date(tsSec * 1000).toISOString().replace(".000Z", "Z");
    return {
      id: `spotify:${sourceRow}`,
      source: "spotify",
      sourceRow,
      title: trackName,
      category: artistName,
      occurredAt,
      datePrecision: occurredAt ? "datetime" : "unknown",
      timezoneNote: "utc",
      amount: null,
      currency: null,
      subjectKey: null,
      tags: [artistName, dict(d.album, album, ""), dict(d.platform, platform, "")].filter(Boolean),
      attrs: {
        kind: "spotify",
        trackUri: emptyToNull(dict(d.uri, uri, "")),
        trackName,
        artistName,
        albumName: dict(d.album, album, "Unknown album"),
        platform: dict(d.platform, platform, "Unknown platform"),
        msPlayed: ms,
        reasonStart: dict(d.reasonStart, reasonStart, "Unknown"),
        reasonEnd: dict(d.reasonEnd, reasonEnd, "Unknown"),
        shuffle: shuffleKnown ? shuffle : null,
        skipped: skippedKnown ? skipped : null,
      },
    };
  });
}

export function decodeHousehold(file: CompactFile<HouseholdCompactRow>): Receipt[] {
  const d = file.dicts;
  return file.rows.map((row) => {
    const [sourceRow, dateKey, precision, amount, currency, category, subcategory, note, mode, type] = row;
    const categoryLabel = dict(d.category, category, "Unknown");
    const sub = dict(d.subcategory, subcategory, "");
    const noteText = dict(d.note, note, "");
    const kind = dict(d.type, type, "Unknown");
    const title = noteText || (sub ? `${categoryLabel} · ${sub}` : categoryLabel);
    const datePrecision = precision === 0 ? "date" : precision === 1 ? "datetime" : "unknown";
    return {
      id: `household:${sourceRow}`,
      source: "household",
      sourceRow,
      title,
      category: categoryLabel,
      occurredAt: dateKey,
      datePrecision,
      timezoneNote: dateKey ? "unspecified" : null,
      amount,
      currency: dict(d.currency, currency, "") || null,
      subjectKey: null,
      tags: [sub, kind, dict(d.mode, mode, "")].filter(Boolean),
      attrs: {
        kind: "household",
        mode: dict(d.mode, mode, "Unknown"),
        subcategory: sub || "Unknown",
        note: noteText,
        householdKind: kind === "Expense" || kind === "Income" || kind === "Transfer-Out" ? kind : "Unknown",
        originalDate: dateKey ?? "",
      },
    };
  });
}

export function decodeCustomer(file: CompactFile<CustomerCompactRow>, groups?: CustomerGroup[]): Receipt[] {
  const d = file.dicts;
  const groupList = groups ?? file.groups ?? [];
  return file.rows.map((row) => {
    const [sourceRow, dateKey, amount, merchant, merchantRaw, category, groupIndex, transId] = row;
    const group = groupIndex >= 0 ? groupList[groupIndex] ?? null : null;
    const merchantLabel = dict(d.merchant, merchant, "Unknown merchant");
    const merchantAsRecorded = dict(d.merchantRaw, merchantRaw, merchantLabel);
    const categoryLabel = dict(d.category, category, "Unknown");
    return {
      id: `customer:${sourceRow}`,
      source: "customer",
      sourceRow,
      title: merchantLabel,
      category: categoryLabel,
      occurredAt: dateKey,
      datePrecision: dateKey ? (dateKey.length > 10 ? "datetime" : "date") : "unknown",
      timezoneNote: dateKey ? "unspecified" : null,
      amount,
      currency: null,
      subjectKey: group?.label ?? null,
      tags: [group?.label ?? "unassigned", categoryLabel],
      attrs: {
        kind: "customer",
        merchantLabel,
        merchantAsRecorded,
        merchantPrefixStripped: merchantLabel !== merchantAsRecorded,
        customerGroup: group?.label ?? null,
        recordedCustomerKey: group?.key ?? null,
        transId: emptyToNull(dict(d.transId, transId, "")),
        amountUnspecifiedCurrency: true,
      },
    };
  });
}

function dict(list: string[] | undefined, index: number, fallback: string): string {
  if (!list || index < 0 || index >= list.length) return fallback;
  return unknownLabel(list[index], fallback);
}

function emptyToNull(value: string): string | null {
  return value ? value : null;
}
