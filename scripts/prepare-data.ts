import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import type {
  Chapter,
  CompactFile,
  CustomerCompactRow,
  CustomerGroup,
  HouseholdCompactRow,
  Insight,
  Overview,
  ProcessingReport,
  SpotifyCompactRow,
  StoriesManifest,
} from "../src/lib/model";
import {
  keepAsString,
  parseCustomerDate,
  parseExplicitBoolean,
  parseHouseholdDate,
  parseNumberOrNull,
  parseSpotifyUtc,
  receiptId,
  stripMerchantPrefix,
} from "../src/lib/parse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");

const PATHS = {
  spotify:
    process.env.DATA_SPOTIFY ??
    path.join("C:", "Users", "madhe", "Downloads", "archive", "spotify_history.csv"),
  household:
    process.env.DATA_HOUSEHOLD ??
    path.join("C:", "Users", "madhe", "Downloads", "archive (1)", "Daily Household Transactions.csv"),
  customer:
    process.env.DATA_CUSTOMER ??
    path.join("C:", "Users", "madhe", "Downloads", "archive (2)", "Augmented_IndiaTransactMultiFacet2024.csv"),
};

type Dict = Map<string, number>;
const dicts = () => new Map<string, number>();
function intern(map: Dict, value: string): number {
  const key = value;
  const found = map.get(key);
  if (found != null) return found;
  const idx = map.size;
  map.set(key, idx);
  return idx;
}
function materialize(map: Dict): string[] {
  const out = new Array<string>(map.size);
  for (const [k, i] of map) out[i] = k;
  return out;
}

async function parseCsv(filePath: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  await new Promise<void>((resolve, reject) => {
    Papa.parse<Record<string, string>>(createReadStream(filePath, { encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      step: (result) => {
        if (result.data) rows.push(result.data);
      },
      complete: () => resolve(),
      error: (err) => reject(err),
    });
  });
  return rows;
}

function dayOf(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

async function main() {
  console.log("Reading source CSVs…");
  const [spotifyRows, householdRows, customerRows] = await Promise.all([
    parseCsv(PATHS.spotify),
    parseCsv(PATHS.household),
    parseCsv(PATHS.customer),
  ]);
  console.log(`Spotify ${spotifyRows.length}, household ${householdRows.length}, customer ${customerRows.length}`);

  const spotify = encodeSpotify(spotifyRows);
  const household = encodeHousehold(householdRows);
  const customer = encodeCustomer(customerRows);

  const overview = buildOverview(spotify, household, customer);
  const stories = buildStories(spotify, household, customer, overview);

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "overview.json"), JSON.stringify(overview));
  await writeFile(path.join(outDir, "stories.json"), JSON.stringify(stories));
  await writeFile(path.join(outDir, "spotify.json"), JSON.stringify(spotify.file));
  await writeFile(path.join(outDir, "household.json"), JSON.stringify(household.file));
  await writeFile(path.join(outDir, "customer.json"), JSON.stringify(customer.file));
  await writeFile(path.join(outDir, "processing.json"), JSON.stringify(overview.processing, null, 2));
  console.log(`Wrote compact assets to ${outDir}`);
}

type SpotifyEnc = {
  file: CompactFile<SpotifyCompactRow>;
  meta: {
    records: number;
    dated: number;
    undated: number;
    dateStart: string | null;
    dateEnd: string | null;
    uniqueArtists: number;
    uniqueTracks: number;
    totalMs: number;
    zeroDuration: number;
    shortUnder30s: number;
    years: Map<number, { records: number; listeningMs: number; beatles: number }>;
    artists: Map<string, { count: number; firstIso: string | null; firstId: string; ms: number }>;
    platforms: Map<string, number>;
    categories: { label: string; count: number }[];
    possibleDups: number;
    missingUri: number;
    boolOther: number;
    sampleIds: {
      beatles: string[];
      killers: string[];
      abba: string[];
      caloncho: string[];
    };
  };
};

function encodeSpotify(rows: Record<string, string>[]): SpotifyEnc {
  const uri = dicts();
  const track = dicts();
  const artist = dicts();
  const album = dicts();
  const platform = dicts();
  const reasonStart = dicts();
  const reasonEnd = dicts();
  const compact: SpotifyCompactRow[] = [];
  const years = new Map<number, { records: number; listeningMs: number; beatles: number }>();
  const artists = new Map<string, { count: number; firstIso: string | null; firstId: string; ms: number }>();
  const platforms = new Map<string, number>();
  const seenKey = new Map<string, number>();
  let possibleDups = 0;
  let missingUri = 0;
  let boolOther = 0;
  let dated = 0;
  let totalMs = 0;
  let zeroDuration = 0;
  let shortUnder30s = 0;
  let dateStart: string | null = null;
  let dateEnd: string | null = null;
  const sampleIds = { beatles: [] as string[], killers: [] as string[], abba: [] as string[], caloncho: [] as string[] };

  rows.forEach((raw, sourceRow) => {
    const parsed = parseSpotifyUtc(raw.ts);
    const ms = parseNumberOrNull(raw.ms_played);
    const shuffle = parseExplicitBoolean(raw.shuffle);
    const skipped = parseExplicitBoolean(raw.skipped);
    if (raw.shuffle && shuffle == null) boolOther += 1;
    if (raw.skipped && skipped == null) boolOther += 1;
    const uriVal = keepAsString(raw.spotify_track_uri);
    if (!uriVal) missingUri += 1;
    const trackName = keepAsString(raw.track_name);
    const artistName = keepAsString(raw.artist_name);
    const albumName = keepAsString(raw.album_name);
    const plat = keepAsString(raw.platform);
    let flags = 0;
    if (shuffle != null) flags |= 1;
    if (shuffle) flags |= 2;
    if (skipped != null) flags |= 4;
    if (skipped) flags |= 8;
    const tsSec = parsed.iso ? Math.floor(Date.parse(parsed.iso) / 1000) : null;
    compact.push([
      sourceRow,
      tsSec,
      ms,
      intern(uri, uriVal),
      intern(track, trackName),
      intern(artist, artistName),
      intern(album, albumName),
      intern(platform, plat),
      intern(reasonStart, keepAsString(raw.reason_start)),
      intern(reasonEnd, keepAsString(raw.reason_end)),
      flags,
    ]);
    const id = receiptId("spotify", sourceRow);
    if (parsed.iso) {
      dated += 1;
      if (!dateStart || parsed.iso < dateStart) dateStart = parsed.iso;
      if (!dateEnd || parsed.iso > dateEnd) dateEnd = parsed.iso;
      const year = Number(parsed.iso.slice(0, 4));
      const bucket = years.get(year) ?? { records: 0, listeningMs: 0, beatles: 0 };
      bucket.records += 1;
      bucket.listeningMs += ms ?? 0;
      if (artistName === "The Beatles") bucket.beatles += 1;
      years.set(year, bucket);
    }
    if (ms == null) {
      /* keep missing */
    } else {
      totalMs += ms;
      if (ms === 0) zeroDuration += 1;
      if (ms < 30_000) shortUnder30s += 1;
    }
    platforms.set(plat || "Unknown", (platforms.get(plat || "Unknown") ?? 0) + 1);
    if (artistName) {
      const rec = artists.get(artistName) ?? { count: 0, firstIso: null, firstId: id, ms: 0 };
      rec.count += 1;
      rec.ms += ms ?? 0;
      if (parsed.iso && (!rec.firstIso || parsed.iso < rec.firstIso)) {
        rec.firstIso = parsed.iso;
        rec.firstId = id;
      }
      artists.set(artistName, rec);
    }
    const dupKey = `${raw.ts}|${uriVal}|${trackName}|${ms}`;
    const prev = seenKey.get(dupKey) ?? 0;
    if (prev > 0) possibleDups += 1;
    seenKey.set(dupKey, prev + 1);
    if (artistName === "The Beatles" && sampleIds.beatles.length < 8) sampleIds.beatles.push(id);
    if (artistName === "The Killers" && sampleIds.killers.length < 8) sampleIds.killers.push(id);
    if (artistName === "ABBA" && sampleIds.abba.length < 8) sampleIds.abba.push(id);
    if (artistName === "Caloncho" && sampleIds.caloncho.length < 8) sampleIds.caloncho.push(id);
  });

  const topArtists = [...artists.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  return {
    file: {
      version: 1,
      source: "spotify",
      dicts: {
        uri: materialize(uri),
        track: materialize(track),
        artist: materialize(artist),
        album: materialize(album),
        platform: materialize(platform),
        reasonStart: materialize(reasonStart),
        reasonEnd: materialize(reasonEnd),
      },
      rows: compact,
    },
    meta: {
      records: rows.length,
      dated,
      undated: rows.length - dated,
      dateStart,
      dateEnd,
      uniqueArtists: artists.size,
      uniqueTracks: track.size,
      totalMs,
      zeroDuration,
      shortUnder30s,
      years,
      artists,
      platforms,
      categories: topArtists.map(([label, v]) => ({ label, count: v.count })),
      possibleDups,
      missingUri,
      boolOther,
      sampleIds,
    },
  };
}

type HouseholdEnc = {
  file: CompactFile<HouseholdCompactRow>;
  meta: {
    records: number;
    dated: number;
    undated: number;
    dateOnly: number;
    datetime: number;
    dateStart: string | null;
    dateEnd: string | null;
    currency: string;
    expenseCount: number;
    expenseSum: number;
    incomeCount: number;
    incomeSum: number;
    transferCount: number;
    transferSum: number;
    years: Map<number, { records: number; expenseCount: number; expenseSum: number; milk: number; food: number }>;
    categories: Map<string, { count: number; firstIso: string | null; firstId: string }>;
    subcategories: Map<string, number>;
    notes: Map<string, { count: number; firstId: string }>;
    possibleDups: number;
    unparsedDates: number;
    milkIds: string[];
    netflixIds: string[];
    trainIds: string[];
  };
};

function encodeHousehold(rows: Record<string, string>[]): HouseholdEnc {
  const currency = dicts();
  const category = dicts();
  const subcategory = dicts();
  const note = dicts();
  const mode = dicts();
  const type = dicts();
  const compact: HouseholdCompactRow[] = [];
  const years = new Map<number, { records: number; expenseCount: number; expenseSum: number; milk: number; food: number }>();
  const categories = new Map<string, { count: number; firstIso: string | null; firstId: string }>();
  const subcategories = new Map<string, number>();
  const notes = new Map<string, { count: number; firstId: string }>();
  let dated = 0;
  let dateOnly = 0;
  let datetime = 0;
  let unparsedDates = 0;
  let expenseCount = 0;
  let expenseSum = 0;
  let incomeCount = 0;
  let incomeSum = 0;
  let transferCount = 0;
  let transferSum = 0;
  let dateStart: string | null = null;
  let dateEnd: string | null = null;
  let possibleDups = 0;
  const seen = new Map<string, number>();
  const milkIds: string[] = [];
  const netflixIds: string[] = [];
  const trainIds: string[] = [];
  const currencies = new Map<string, number>();

  rows.forEach((raw, sourceRow) => {
    const parsed = parseHouseholdDate(raw.Date);
    if (keepAsString(raw.Date) && !parsed.iso) unparsedDates += 1;
    const amount = parseNumberOrNull(raw.Amount);
    const cat = keepAsString(raw.Category);
    const sub = keepAsString(raw.Subcategory);
    const noteText = keepAsString(raw.Note);
    const kind = keepAsString(raw["Income/Expense"]);
    const curr = keepAsString(raw.Currency);
    const precision = parsed.precision === "date" ? 0 : parsed.precision === "datetime" ? 1 : 2;
    compact.push([
      sourceRow,
      parsed.iso,
      precision,
      amount,
      intern(currency, curr),
      intern(category, cat),
      intern(subcategory, sub),
      intern(note, noteText),
      intern(mode, keepAsString(raw.Mode)),
      intern(type, kind),
    ]);
    const id = receiptId("household", sourceRow);
    if (parsed.iso) {
      dated += 1;
      if (parsed.dateOnly) dateOnly += 1;
      else if (parsed.precision === "datetime") datetime += 1;
      const day = dayOf(parsed.iso)!;
      if (!dateStart || day < dateStart) dateStart = day;
      if (!dateEnd || day > dateEnd) dateEnd = day;
      const year = Number(day.slice(0, 4));
      const bucket = years.get(year) ?? { records: 0, expenseCount: 0, expenseSum: 0, milk: 0, food: 0 };
      bucket.records += 1;
      if (kind === "Expense") {
        bucket.expenseCount += 1;
        bucket.expenseSum += amount ?? 0;
      }
      const milkish = sub.toLowerCase() === "milk" || noteText.toLowerCase().includes("milk");
      if (milkish) bucket.milk += 1;
      if (cat === "Food") bucket.food += 1;
      years.set(year, bucket);
    }
    if (kind === "Expense") {
      expenseCount += 1;
      expenseSum += amount ?? 0;
    } else if (kind === "Income") {
      incomeCount += 1;
      incomeSum += amount ?? 0;
    } else if (kind === "Transfer-Out") {
      transferCount += 1;
      transferSum += amount ?? 0;
    }
    currencies.set(curr || "Unknown", (currencies.get(curr || "Unknown") ?? 0) + 1);
    if (cat) {
      const rec = categories.get(cat) ?? { count: 0, firstIso: null, firstId: id };
      rec.count += 1;
      if (parsed.iso && (!rec.firstIso || parsed.iso < rec.firstIso)) {
        rec.firstIso = parsed.iso;
        rec.firstId = id;
      }
      categories.set(cat, rec);
    }
    if (sub) subcategories.set(`${cat} / ${sub}`, (subcategories.get(`${cat} / ${sub}`) ?? 0) + 1);
    if (noteText) {
      const rec = notes.get(noteText) ?? { count: 0, firstId: id };
      rec.count += 1;
      notes.set(noteText, rec);
    }
    const dupKey = `${raw.Date}|${kind}|${amount}|${cat}|${sub}|${noteText}`;
    const prev = seen.get(dupKey) ?? 0;
    if (prev > 0) possibleDups += 1;
    seen.set(dupKey, prev + 1);
    if ((sub.toLowerCase() === "milk" || noteText.toLowerCase().includes("milk")) && milkIds.length < 10) milkIds.push(id);
    if (`${sub} ${noteText}`.toLowerCase().includes("netflix") && netflixIds.length < 10) netflixIds.push(id);
    if (sub.toLowerCase() === "train" && trainIds.length < 8) trainIds.push(id);
  });

  const currencyLabel = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "INR";
  return {
    file: {
      version: 1,
      source: "household",
      dicts: {
        currency: materialize(currency),
        category: materialize(category),
        subcategory: materialize(subcategory),
        note: materialize(note),
        mode: materialize(mode),
        type: materialize(type),
      },
      rows: compact,
    },
    meta: {
      records: rows.length,
      dated,
      undated: rows.length - dated,
      dateOnly,
      datetime,
      dateStart,
      dateEnd,
      currency: currencyLabel,
      expenseCount,
      expenseSum,
      incomeCount,
      incomeSum,
      transferCount,
      transferSum,
      years,
      categories,
      subcategories,
      notes,
      possibleDups,
      unparsedDates,
      milkIds,
      netflixIds,
      trainIds,
    },
  };
}

type CustomerEnc = {
  file: CompactFile<CustomerCompactRow>;
  meta: {
    records: number;
    dated: number;
    undated: number;
    dateStart: string | null;
    dateEnd: string | null;
    uniqueGroups: number;
    unassigned: number;
    groupsWithRepeatMerchant: number;
    amountMissing: number;
    duplicateTransIds: number;
    missingTransIds: number;
    years: Map<number, { records: number; amountSum: number; shopping: number }>;
    categories: Map<string, number>;
    groups: CustomerGroup[];
    topGroup: { key: string; label: string; count: number; merchants: Map<string, { count: number; ids: string[] }>; firstMerchant: { label: string; iso: string; id: string } | null; ids: string[] } | null;
    prefixStripped: number;
  };
};

function encodeCustomer(rows: Record<string, string>[]): CustomerEnc {
  const counts = new Map<string, number>();
  for (const raw of rows) {
    const key = keepAsString(raw.customer_id);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const groups: CustomerGroup[] = ranked.map(([key, count], i) => ({
    key,
    label: `Recorded group ${String(i + 1).padStart(3, "0")}`,
    count,
  }));
  const groupIndex = new Map(groups.map((g, i) => [g.key, i]));

  const merchant = dicts();
  const merchantRaw = dicts();
  const category = dicts();
  const transId = dicts();
  const compact: CustomerCompactRow[] = [];
  const years = new Map<number, { records: number; amountSum: number; shopping: number }>();
  const categories = new Map<string, number>();
  const merchByGroup = new Map<string, Map<string, number>>();
  let dated = 0;
  let unassigned = 0;
  let amountMissing = 0;
  let missingTransIds = 0;
  let dateStart: string | null = null;
  let dateEnd: string | null = null;
  let prefixStripped = 0;
  const transCounts = new Map<string, number>();

  const topKey = groups[0]?.key ?? null;
  const top = topKey
    ? {
        key: topKey,
        label: groups[0].label,
        count: groups[0].count,
        merchants: new Map<string, { count: number; ids: string[] }>(),
        firstMerchant: null as { label: string; iso: string; id: string } | null,
        ids: [] as string[],
      }
    : null;

  rows.forEach((raw, sourceRow) => {
    const parsed = parseCustomerDate(raw.trans_date_trans_time);
    const amount = parseNumberOrNull(raw.amt);
    const key = keepAsString(raw.customer_id);
    const merch = stripMerchantPrefix(raw.merchant);
    const cat = keepAsString(raw.category);
    const tid = keepAsString(raw.trans_id);
    if (merch.stripped) prefixStripped += 1;
    if (!key) unassigned += 1;
    if (amount == null) amountMissing += 1;
    if (!tid) missingTransIds += 1;
    else transCounts.set(tid, (transCounts.get(tid) ?? 0) + 1);
    compact.push([
      sourceRow,
      parsed.iso,
      amount,
      intern(merchant, merch.label),
      intern(merchantRaw, merch.asRecorded),
      intern(category, cat),
      key ? groupIndex.get(key) ?? -1 : -1,
      intern(transId, tid),
    ]);
    const id = receiptId("customer", sourceRow);
    if (parsed.iso) {
      dated += 1;
      const day = dayOf(parsed.iso)!;
      if (!dateStart || day < dateStart) dateStart = day;
      if (!dateEnd || day > dateEnd) dateEnd = day;
      const year = Number(day.slice(0, 4));
      const bucket = years.get(year) ?? { records: 0, amountSum: 0, shopping: 0 };
      bucket.records += 1;
      bucket.amountSum += amount ?? 0;
      if (cat === "online_shopping") bucket.shopping += 1;
      years.set(year, bucket);
    }
    categories.set(cat || "Unknown", (categories.get(cat || "Unknown") ?? 0) + 1);
    if (key && merch.label) {
      const map = merchByGroup.get(key) ?? new Map<string, number>();
      map.set(merch.label, (map.get(merch.label) ?? 0) + 1);
      merchByGroup.set(key, map);
    }
    if (top && key === top.key) {
      top.ids.push(id);
      if (merch.label) {
        const rec = top.merchants.get(merch.label) ?? { count: 0, ids: [] };
        rec.count += 1;
        if (rec.ids.length < 6) rec.ids.push(id);
        top.merchants.set(merch.label, rec);
        if (parsed.iso && (!top.firstMerchant || parsed.iso < top.firstMerchant.iso)) {
          top.firstMerchant = { label: merch.label, iso: parsed.iso, id };
        }
      }
    }
  });

  const groupsWithRepeatMerchant = [...merchByGroup.values()].filter((m) => [...m.values()].some((n) => n >= 2)).length;
  const duplicateTransIds = [...transCounts.values()].filter((n) => n > 1).length;

  return {
    file: {
      version: 1,
      source: "customer",
      dicts: {
        merchant: materialize(merchant),
        merchantRaw: materialize(merchantRaw),
        category: materialize(category),
        transId: materialize(transId),
      },
      groups,
      rows: compact,
    },
    meta: {
      records: rows.length,
      dated,
      undated: rows.length - dated,
      dateStart,
      dateEnd,
      uniqueGroups: groups.length,
      unassigned,
      groupsWithRepeatMerchant,
      amountMissing,
      duplicateTransIds,
      missingTransIds,
      years,
      categories,
      groups,
      topGroup: top,
      prefixStripped,
    },
  };
}

function topMap(map: Map<string, number>, n = 8) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
}

function buildOverview(spotify: SpotifyEnc, household: HouseholdEnc, customer: CustomerEnc): Overview {
  const processing: ProcessingReport = {
    spotify: {
      rowsRead: spotify.meta.records,
      dated: spotify.meta.dated,
      possibleExactDuplicatesKept: spotify.meta.possibleDups,
      missingTrackUri: spotify.meta.missingUri,
      unexpectedBooleans: spotify.meta.boolOther,
      zeroDurationKept: spotify.meta.zeroDuration,
      shortUnder30sKept: spotify.meta.shortUnder30s,
      timestampZone: "UTC as recorded",
    },
    household: {
      rowsRead: household.meta.records,
      dated: household.meta.dated,
      dateOnly: household.meta.dateOnly,
      datetime: household.meta.datetime,
      unparsedDates: household.meta.unparsedDates,
      possibleExactDuplicatesKept: household.meta.possibleDups,
      currency: household.meta.currency,
    },
    customer: {
      rowsRead: customer.meta.records,
      dated: customer.meta.dated,
      unassignedCustomerIds: customer.meta.unassigned,
      uniqueRecordedIds: customer.meta.uniqueGroups,
      missingAmounts: customer.meta.amountMissing,
      missingTransIds: customer.meta.missingTransIds,
      duplicateTransIds: customer.meta.duplicateTransIds,
      merchantPrefixStrippedForDisplay: customer.meta.prefixStripped,
      discardedPersonalFields:
        "cc_num, first, last, gender, street, city, state, lat, long, city_pop, job, dob, merch_lat, merch_long, is_fraud",
    },
    exclusions: [
      "No source rows were dropped from the explorer because a field was missing.",
      "Customer names, card numbers, addresses, dates of birth, jobs, coordinates and fraud flags were not published.",
      "Customer identifiers are stored as recorded strings. Scientific notation may already have lost precision; groups are labelled from those strings only.",
      "Household date-only rows stay date-only and are excluded from hour-of-day views.",
      "Customer amounts are never summed with household INR amounts.",
    ],
  };

  return {
    generatedAt: new Date().toISOString(),
    framing: "Separate sources, shared themes.",
    processing,
    spotify: {
      records: spotify.meta.records,
      dated: spotify.meta.dated,
      undated: spotify.meta.undated,
      dateStart: spotify.meta.dateStart,
      dateEnd: spotify.meta.dateEnd,
      uniqueArtists: spotify.meta.uniqueArtists,
      uniqueTracks: spotify.meta.uniqueTracks,
      totalMs: spotify.meta.totalMs,
      zeroDuration: spotify.meta.zeroDuration,
      shortUnder30s: spotify.meta.shortUnder30s,
      years: [...spotify.meta.years.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, v]) => ({ year, records: v.records, listeningMs: v.listeningMs })),
      topArtists: spotify.meta.categories,
      platforms: topMap(spotify.meta.platforms),
      categories: spotify.meta.categories,
      notes: [
        "Each row is a recorded play, not a unique song or person.",
        "ts is the UTC time the track stopped playing.",
        "Zero-duration rows are kept as recorded plays with no listening time.",
      ],
    },
    household: {
      records: household.meta.records,
      dated: household.meta.dated,
      undated: household.meta.undated,
      dateStart: household.meta.dateStart,
      dateEnd: household.meta.dateEnd,
      dateOnly: household.meta.dateOnly,
      datetime: household.meta.datetime,
      currency: household.meta.currency,
      expenseCount: household.meta.expenseCount,
      expenseSum: household.meta.expenseSum,
      incomeCount: household.meta.incomeCount,
      incomeSum: household.meta.incomeSum,
      transferCount: household.meta.transferCount,
      transferSum: household.meta.transferSum,
      years: [...household.meta.years.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, v]) => ({ year, records: v.records, expenseCount: v.expenseCount, expenseSum: v.expenseSum })),
      topSubcategories: topMap(household.meta.subcategories, 10),
      repeatedNotes: [...household.meta.notes.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([label, v]) => ({ label, count: v.count })),
      categories: [...household.meta.categories.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 12)
        .map(([label, v]) => ({ label, count: v.count })),
      notes: [
        "Notes describe transactions; they are not a personal journal.",
        "Transfers are kept separate from expenses and income.",
        "All amounts in this source are INR.",
      ],
    },
    customer: {
      records: customer.meta.records,
      dated: customer.meta.dated,
      undated: customer.meta.undated,
      dateStart: customer.meta.dateStart,
      dateEnd: customer.meta.dateEnd,
      uniqueGroups: customer.meta.uniqueGroups,
      unassigned: customer.meta.unassigned,
      groupsWithRepeatMerchant: customer.meta.groupsWithRepeatMerchant,
      amountMissing: customer.meta.amountMissing,
      duplicateTransIds: customer.meta.duplicateTransIds,
      missingTransIds: customer.meta.missingTransIds,
      identifierNote:
        "Anonymous labels are assigned from the recorded customer_id string. Missing IDs stay unassigned. Scientific-notation values may collide and are not treated as precise identities.",
      years: [...customer.meta.years.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, v]) => ({ year, records: v.records, amountSum: v.amountSum })),
      topGroups: customer.meta.groups.slice(0, 8),
      categories: topMap(customer.meta.categories, 8),
      notes: [
        "This file contains many customers.",
        "Locations and fraud flags were not published and are not used.",
        "Amounts are labelled as currency unspecified.",
      ],
    },
  };
}

function n(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildStories(spotify: SpotifyEnc, household: HouseholdEnc, customer: CustomerEnc, overview: Overview): StoriesManifest {
  const beatles = spotify.meta.artists.get("The Beatles");
  const killers = spotify.meta.artists.get("The Killers");
  const abba = spotify.meta.artists.get("ABBA");
  const caloncho = spotify.meta.artists.get("Caloncho");
  const teskey = spotify.meta.artists.get("The Teskey Brothers");
  const y2017 = spotify.meta.years.get(2017);
  const y2024 = spotify.meta.years.get(2024);
  const milkTotal = [...household.meta.years.values()].reduce((s, v) => s + v.milk, 0);
  const milkNote = [...household.meta.notes.entries()].sort((a, b) => b[1].count - a[1].count).find(([k]) => k.toLowerCase().includes("milk"));
  const h2015 = household.meta.years.get(2015);
  const h2017 = household.meta.years.get(2017);
  const top = customer.meta.topGroup;
  const topMerchant = top ? [...top.merchants.entries()].sort((a, b) => b[1].count - a[1].count)[0] : null;
  const firstHousehold = [...household.meta.categories.entries()]
    .filter(([, v]) => v.firstIso)
    .sort((a, b) => (a[1].firstIso ?? "").localeCompare(b[1].firstIso ?? ""))
    .slice(0, 6);
  const first2023 = [...spotify.meta.artists.entries()]
    .filter(([, v]) => v.firstIso && v.firstIso.startsWith("2023"))
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  const insights: Insight[] = [
    {
      id: "spotify-repeats",
      source: "spotify",
      title: "Repeated artists",
      question: "Which artists keep returning in the listening records?",
      observation: `The Beatles appear in ${n(beatles?.count ?? 0)} of ${n(spotify.meta.records)} recorded plays. The Killers appear in ${n(killers?.count ?? 0)}.`,
      interpretation: "These counts are recorded plays, not unique songs or proof of a favourite. Short and zero-duration plays are included as records.",
      subjectScope: "All listening records",
      periods: [overview.spotify.dateStart ?? "", overview.spotify.dateEnd ?? ""],
      metric: "play_count_by_artist",
      definition: "Number of source rows whose artist_name exactly matches, including zero-duration rows.",
      value: beatles?.count ?? 0,
      unit: "recorded plays",
      receiptIds: spotify.meta.sampleIds.beatles,
      caveats: ["A track URI identifies a track, not a play. Each row is a separate event."],
    },
    {
      id: "household-milk",
      source: "household",
      title: "Milk as a household routine",
      question: "What household activity repeats most clearly?",
      observation: `${n(milkTotal)} household rows mention milk in the subcategory or note, from ${household.meta.dateStart} to ${household.meta.dateEnd}. The most repeated milk note is “${milkNote?.[0] ?? "milk"}” (${milkNote?.[1].count ?? 0} times).`,
      interpretation: "This is a repeated recorded purchase pattern in one household ledger. Notes describe transactions, not diary entries.",
      subjectScope: "All household rows",
      periods: [household.meta.dateStart ?? "", household.meta.dateEnd ?? ""],
      metric: "milk_related_row_count",
      definition: "Rows where Subcategory is Milk (case-insensitive) or Note contains 'milk'.",
      value: milkTotal,
      unit: "records",
      receiptIds: household.meta.milkIds,
      caveats: ["Date-only milk rows are not treated as midnight events."],
    },
    {
      id: "customer-repeat-merchant",
      source: "customer",
      title: "A recorded customer group returns to merchants",
      question: "Do any recorded customer groups show repeated merchants?",
      observation: top && topMerchant
        ? `${top.label} has ${n(top.count)} rows grouped by recorded ID ${top.key}. Merchant “${topMerchant[0]}” appears ${n(topMerchant[1].count)} times in that group.`
        : "No usable customer group was found.",
      interpretation: "Grouping uses the recorded customer_id string only. Scientific notation may already have lost precision. This is not a named person, and it is not the listening or household source.",
      subjectScope: top ? `${top.label} (recorded ID ${top.key})` : "none",
      periods: [customer.meta.dateStart ?? "", customer.meta.dateEnd ?? ""],
      metric: "same_group_same_merchant_count",
      definition: "Count of rows sharing a recorded customer_id string and the same display merchant label.",
      value: topMerchant?.[1].count ?? 0,
      unit: "records",
      receiptIds: topMerchant?.[1].ids ?? [],
      caveats: ["Missing customer IDs are left unassigned.", "A shared merchant across different IDs is not treated as one person."],
    },
    {
      id: "spotify-period",
      source: "spotify",
      title: "Listening volume between 2017 and 2024",
      question: "How do recorded listening years differ?",
      observation: `2017 has ${n(y2017?.records ?? 0)} recorded plays and ${((y2017?.listeningMs ?? 0) / 3_600_000).toFixed(1)} hours of listening time. 2024 (through ${overview.spotify.dateEnd?.slice(0, 10) ?? "the last dated row"}) has ${n(y2024?.records ?? 0)} plays and ${((y2024?.listeningMs ?? 0) / 3_600_000).toFixed(1)} hours. The Beatles’ share of plays is ${(((y2017?.beatles ?? 0) / (y2017?.records || 1)) * 100).toFixed(1)}% in 2017 and ${(((y2024?.beatles ?? 0) / (y2024?.records || 1)) * 100).toFixed(1)}% in 2024.`,
      interpretation: "2017 is a full calendar year; 2024 ends on the last dated record. Unequal coverage means raw totals are not a preference change. Shares use percentage points.",
      subjectScope: "All listening records",
      periods: ["2017-01-01/2017-12-31", `2024-01-01/${overview.spotify.dateEnd?.slice(0, 10) ?? "2024-12-15"}`],
      metric: "year_play_count_and_beatles_share",
      definition: "Row counts by UTC year; Beatles share = Beatles rows / all rows in that year.",
      value: y2017?.records ?? 0,
      unit: "recorded plays",
      receiptIds: [...spotify.meta.sampleIds.beatles.slice(0, 4), ...spotify.meta.sampleIds.abba.slice(0, 4)],
      caveats: ["Zero-duration rows count as recorded plays but add no listening time.", "UTC stop times are not used to infer sleep or mood."],
    },
    {
      id: "household-period",
      source: "household",
      title: "Household expense records, 2015 versus 2017",
      question: "Did the household ledger record a different year?",
      observation: `2015 has ${n(h2015?.expenseCount ?? 0)} expense records totalling ${n(Math.round(h2015?.expenseSum ?? 0))} INR. 2017 has ${n(h2017?.expenseCount ?? 0)} expense records totalling ${n(Math.round(h2017?.expenseSum ?? 0))} INR. Transfer-out and income are kept separate.`,
      interpretation: "Both years are full calendar spans in this file, but recorded activity is denser in 2017. That is coverage and bookkeeping, not proof of a lifestyle change.",
      subjectScope: "All household rows",
      periods: ["2015-01-01/2015-12-31", "2017-01-01/2017-12-31"],
      metric: "expense_count_and_inr_sum",
      definition: "Count and sum of Amount where Income/Expense is Expense. Transfers and income excluded.",
      value: h2017?.expenseCount ?? 0,
      unit: "expense records",
      receiptIds: household.meta.milkIds.slice(0, 6),
      caveats: ["Income and transfer-out are not expenses.", "Do not add these INR totals to customer amounts."],
    },
    {
      id: "customer-period",
      source: "customer",
      title: "Category mix across recorded customer years",
      question: "Does the customer file’s category mix shift between partial 2022 and 2023?",
      observation: `Dated customer rows: ${n(customer.meta.years.get(2022)?.records ?? 0)} in 2022 (from ${customer.meta.dateStart}) and ${n(customer.meta.years.get(2023)?.records ?? 0)} in 2023. online_shopping is ${n(customer.meta.years.get(2022)?.shopping ?? 0)} of the 2022 dated rows and ${n(customer.meta.years.get(2023)?.shopping ?? 0)} of the 2023 dated rows.`,
      interpretation: "This mixes many customers. Window lengths differ. Use a single recorded group when comparing people-like repeats. Amounts stay currency-unspecified.",
      subjectScope: "All dated customer rows (multiple customers)",
      periods: [`${customer.meta.dateStart}/2022-12-31`, "2023-01-01/2023-12-31"],
      metric: "dated_row_count_and_online_shopping_count",
      definition: "Rows with a valid timestamp, grouped by year. Category share uses percentage points when compared.",
      value: customer.meta.years.get(2023)?.records ?? 0,
      unit: "dated records",
      receiptIds: top?.ids.slice(0, 8) ?? [],
      caveats: ["2022 starts in April in this file.", "850 rows have no timestamp and are excluded from year totals."],
    },
    {
      id: "spotify-firsts",
      source: "spotify",
      title: "First recorded artists",
      question: "Which artists first appear late in the listening file?",
      observation: caloncho
        ? `Caloncho is first recorded on ${caloncho.firstIso} and then appears in ${n(caloncho.count)} plays. The Teskey Brothers first appear on ${teskey?.firstIso ?? "n/a"} (${n(teskey?.count ?? 0)} plays). ${n(first2023.length)} high-volume examples first appear in 2023 in this file.`
        : "No late first appearances met the volume threshold.",
      interpretation: "First appearance means first row in this dataset, not the first time anyone heard the artist.",
      subjectScope: "All listening records",
      periods: [overview.spotify.dateStart ?? "", overview.spotify.dateEnd ?? ""],
      metric: "min_timestamp_by_artist",
      definition: "Earliest UTC ts for each artist_name; count is all later rows for that artist.",
      value: caloncho?.count ?? 0,
      unit: "recorded plays after first row",
      receiptIds: [caloncho?.firstId, teskey?.firstId, ...spotify.meta.sampleIds.caloncho].filter((x): x is string => Boolean(x)).slice(0, 8),
      caveats: ["Sparse earlier years are limited coverage, not proof of silence."],
    },
    {
      id: "household-firsts",
      source: "household",
      title: "First recorded household categories",
      question: "What categories appear for the first time in this ledger?",
      observation: `Earliest dated category in these rows: ${firstHousehold[0]?.[0] ?? "Unknown"} on ${firstHousehold[0]?.[1].firstIso ?? "n/a"}. Netflix-related notes appear in ${n(household.meta.netflixIds.length)} sampled rows, used as a subscription example rather than a complete life event.`,
      interpretation: "First means first dated row in this household file. Earlier purchases may exist outside the extract.",
      subjectScope: "All household rows",
      periods: [household.meta.dateStart ?? "", household.meta.dateEnd ?? ""],
      metric: "min_date_by_category",
      definition: "Earliest parsed Date for each Category value.",
      value: firstHousehold[0]?.[0] ?? "",
      unit: "category label",
      receiptIds: [...household.meta.netflixIds.slice(0, 4), ...firstHousehold.map(([, v]) => v.firstId)].slice(0, 8),
      caveats: ["The CSV is not a complete biography."],
    },
    {
      id: "customer-firsts",
      source: "customer",
      title: "First merchant inside one recorded group",
      question: "What is the first observed merchant inside the largest recorded customer group?",
      observation: top?.firstMerchant
        ? `Inside ${top.label}, the earliest dated merchant is “${top.firstMerchant.label}” on ${top.firstMerchant.iso}. That is the first row for that group in this file.`
        : "The largest group has no dated merchant.",
      interpretation: "First is first timestamp among rows sharing this recorded ID. It is not a customer’s first-ever purchase.",
      subjectScope: top ? `${top.label}` : "none",
      periods: [customer.meta.dateStart ?? "", customer.meta.dateEnd ?? ""],
      metric: "min_timestamp_by_group_merchant",
      definition: "Earliest parsed timestamp for the selected recorded customer_id.",
      value: top?.firstMerchant?.label ?? "",
      unit: "merchant label",
      receiptIds: top?.firstMerchant ? [top.firstMerchant.id, ...top.ids.slice(0, 6)] : [],
      caveats: ["Unassigned rows are not merged into this group."],
    },
  ];

  const chapters: Chapter[] = [
    {
      id: "return-to",
      title: "The things we return to",
      question: "What keeps coming back in these separate records?",
      teaser: `Beatles plays ${n(beatles?.count ?? 0)} · milk mentions ${n(milkTotal)} · ${top?.label ?? "a customer group"} repeats a merchant ${n(topMerchant?.[1].count ?? 0)} times`,
      sources: ["spotify", "household", "customer"],
      steps: [
        {
          id: "open",
          kind: "open",
          title: "Three sources, one theme",
          body: "These files were not joined by a shared identity. What they share is repetition: an artist, a household staple, a merchant inside one recorded customer group.",
          receiptIds: [],
        },
        {
          id: "music",
          kind: "observe",
          title: "Artists the listening file returns to",
          body: insights[0].observation,
          insightId: "spotify-repeats",
          visual: "artist-repeat",
          receiptIds: insights[0].receiptIds,
        },
        {
          id: "house",
          kind: "evidence",
          title: "A household staple",
          body: insights[1].observation,
          insightId: "household-milk",
          visual: "milk-routine",
          receiptIds: insights[1].receiptIds,
          bridge: { source: "household", label: "This is a different source from the listening file.", href: "#/explore?sources=household&q=milk" },
        },
        {
          id: "cust",
          kind: "evidence",
          title: "A recorded customer group and its merchants",
          body: insights[2].observation,
          insightId: "customer-repeat-merchant",
          visual: "customer-repeat",
          receiptIds: insights[2].receiptIds,
          bridge: { source: "customer", label: "Customer rows are not the household diarist.", href: "#/explore?sources=customer" },
        },
        {
          id: "close",
          kind: "close",
          title: "What the repeats allow",
          body: "We can say these sources record return visits to artists, staples and merchants. We cannot say they belong to one person, or why someone returned.",
          insightId: "spotify-repeats",
          receiptIds: [],
        },
      ],
    },
    {
      id: "habits-change",
      title: "When habits change",
      question: "What measurable differences appear between recorded periods?",
      teaser: `2017 listening ${n(y2017?.records ?? 0)} plays vs 2024 ${n(y2024?.records ?? 0)} · household expenses ${n(h2015?.expenseCount ?? 0)} vs ${n(h2017?.expenseCount ?? 0)}`,
      sources: ["spotify", "household", "customer"],
      steps: [
        {
          id: "open",
          kind: "open",
          title: "Compare windows, not personalities",
          body: "Each comparison stays inside one source. When window lengths differ, totals are shown with per-day rates. A zero baseline is labelled “No baseline,” not an infinite rise.",
          receiptIds: [],
        },
        {
          id: "music",
          kind: "observe",
          title: "Listening records, 2017 and 2024",
          body: insights[3].observation,
          insightId: "spotify-period",
          visual: "period-spotify",
          receiptIds: insights[3].receiptIds,
        },
        {
          id: "house",
          kind: "evidence",
          title: "Household expenses, 2015 and 2017",
          body: insights[4].observation,
          insightId: "household-period",
          visual: "period-household",
          receiptIds: insights[4].receiptIds,
          bridge: { source: "household", label: "Now leaving the listening file.", href: "#/explore?sources=household&from=2017-01-01&to=2017-12-31" },
        },
        {
          id: "cust",
          kind: "evidence",
          title: "Customer category mix, 2022 and 2023",
          body: insights[5].observation,
          insightId: "customer-period",
          visual: "period-customer",
          receiptIds: insights[5].receiptIds,
          bridge: { source: "customer", label: "Many customers, not one shopper.", href: "#/explore?sources=customer&from=2023-01-01&to=2023-12-31" },
        },
        {
          id: "close",
          kind: "close",
          title: "Limits of a change story",
          body: "Coverage, bookkeeping and file span explain many differences. ABBA’s 2024 volume is a recorded-play change in the listening file, not evidence about the household or any customer.",
          insightId: "spotify-period",
          receiptIds: spotify.meta.sampleIds.abba,
        },
      ],
    },
    {
      id: "first-seen",
      title: "First appearances",
      question: "What is recorded here for the first time?",
      teaser: `Caloncho first on ${caloncho?.firstIso?.slice(0, 10) ?? "n/a"} · Netflix notes in the household file · first merchant in ${top?.label ?? "a customer group"}`,
      sources: ["spotify", "household", "customer"],
      steps: [
        {
          id: "open",
          kind: "open",
          title: "First in the file, not first in a life",
          body: "Sparse early years mean limited observed coverage. A first row is the earliest timestamp in this extract.",
          receiptIds: [],
        },
        {
          id: "music",
          kind: "observe",
          title: "Artists first recorded later",
          body: insights[6].observation,
          insightId: "spotify-firsts",
          visual: "firsts",
          receiptIds: insights[6].receiptIds,
        },
        {
          id: "house",
          kind: "evidence",
          title: "Categories and subscriptions entering the ledger",
          body: insights[7].observation,
          insightId: "household-firsts",
          visual: "firsts",
          receiptIds: insights[7].receiptIds,
          bridge: { source: "household", label: "Household source only.", href: "#/explore?sources=household&q=netflix" },
        },
        {
          id: "cust",
          kind: "evidence",
          title: "First merchant in one recorded group",
          body: insights[8].observation,
          insightId: "customer-firsts",
          visual: "firsts",
          receiptIds: insights[8].receiptIds,
          bridge: { source: "customer", label: "Still a separate customer file.", href: "#/explore?sources=customer" },
        },
        {
          id: "close",
          kind: "close",
          title: "How to read a first",
          body: "Use these firsts to explore the extract, not to date a person’s life. The three sources remain separate.",
          receiptIds: [],
        },
      ],
    },
  ];

  return { chapters, insights };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
