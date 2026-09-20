import type {
  CompactFile,
  CustomerCompactRow,
  HouseholdCompactRow,
  Overview,
  Receipt,
  SourceId,
  SourceStatus,
  SpotifyCompactRow,
  StoriesManifest,
} from "../lib/model";
import { decodeCustomer, decodeHousehold, decodeSpotify } from "./decode";

const BASE = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status}).`);
  return res.json() as Promise<T>;
}

export async function loadOverview(): Promise<Overview> {
  return getJson("overview.json");
}

export async function loadStories(): Promise<StoriesManifest> {
  return getJson("stories.json");
}

export async function loadSource(source: SourceId): Promise<Receipt[]> {
  if (source === "spotify") {
    const file = await getJson<CompactFile<SpotifyCompactRow>>("spotify.json");
    return decodeSpotify(file);
  }
  if (source === "household") {
    const file = await getJson<CompactFile<HouseholdCompactRow>>("household.json");
    return decodeHousehold(file);
  }
  const file = await getJson<CompactFile<CustomerCompactRow>>("customer.json");
  return decodeCustomer(file);
}

export function emptyStatus(): Record<SourceId, SourceStatus> {
  return { spotify: "idle", household: "idle", customer: "idle" };
}
