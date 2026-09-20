import { cacheClear, cacheGet, cacheSet } from "./cache";
import {
  emptyStatus as createEmptyStatus,
  loadOverview as readOverview,
  loadSource as readSource,
  loadStories as readStories,
} from "../data/load";
import type { Overview, Receipt, SourceId, StoriesManifest } from "../types";

export function emptyStatus() {
  return createEmptyStatus();
}

export function clearSourceCache(source?: SourceId) {
  if (!source) {
    cacheClear();
    return;
  }
  cacheClear(`source:${source}`);
}

export async function loadOverview(): Promise<Overview> {
  const hit = cacheGet<Overview>("overview");
  if (hit) return hit;
  return cacheSet("overview", await readOverview());
}

export async function loadStories(): Promise<StoriesManifest> {
  const hit = cacheGet<StoriesManifest>("stories");
  if (hit) return hit;
  return cacheSet("stories", await readStories());
}

export async function loadSource(source: SourceId): Promise<Receipt[]> {
  const key = `source:${source}`;
  const hit = cacheGet<Receipt[]>(key);
  if (hit) return hit;
  return cacheSet(key, await readSource(source));
}

export function cachedSource(source: SourceId): Receipt[] | undefined {
  return cacheGet<Receipt[]>(`source:${source}`);
}
