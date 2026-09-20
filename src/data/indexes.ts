import type { Receipt, SourceId } from "../lib/model";

export type SourceIndexes = {
  byId: Map<string, Receipt>;
  artist: Map<string, Receipt[]>;
  album: Map<string, Receipt[]>;
  track: Map<string, Receipt[]>;
  category: Map<string, Receipt[]>;
  subcategory: Map<string, Receipt[]>;
  note: Map<string, Receipt[]>;
  day: Map<string, Receipt[]>;
  groupMerchant: Map<string, Receipt[]>;
  groupCategory: Map<string, Receipt[]>;
  group: Map<string, Receipt[]>;
};

export function buildIndexes(rows: Receipt[]): SourceIndexes {
  const idx: SourceIndexes = {
    byId: new Map(),
    artist: new Map(),
    album: new Map(),
    track: new Map(),
    category: new Map(),
    subcategory: new Map(),
    note: new Map(),
    day: new Map(),
    groupMerchant: new Map(),
    groupCategory: new Map(),
    group: new Map(),
  };
  for (const r of rows) {
    idx.byId.set(r.id, r);
    push(idx.category, r.category, r);
    if (r.occurredAt) push(idx.day, r.occurredAt.slice(0, 10), r);
    if (r.attrs.kind === "spotify") {
      push(idx.artist, r.attrs.artistName, r);
      push(idx.album, r.attrs.albumName, r);
      push(idx.track, `${r.attrs.artistName}|${r.attrs.trackName}`, r);
    }
    if (r.attrs.kind === "household") {
      push(idx.subcategory, r.attrs.subcategory, r);
      if (r.attrs.note) push(idx.note, r.attrs.note.toLowerCase(), r);
    }
    if (r.attrs.kind === "customer" && r.subjectKey) {
      push(idx.group, r.subjectKey, r);
      push(idx.groupMerchant, `${r.subjectKey}|${r.attrs.merchantLabel}`, r);
      push(idx.groupCategory, `${r.subjectKey}|${r.category}`, r);
    }
  }
  return idx;
}

export function candidatesFor(focus: Receipt, idx: SourceIndexes): Receipt[] {
  const bag = new Map<string, Receipt>();
  const add = (rows?: Receipt[]) => {
    if (!rows) return;
    for (const r of rows) if (r.id !== focus.id) bag.set(r.id, r);
  };
  if (focus.attrs.kind === "spotify") {
    add(idx.track.get(`${focus.attrs.artistName}|${focus.attrs.trackName}`));
    add(idx.artist.get(focus.attrs.artistName));
    add(idx.album.get(focus.attrs.albumName));
    if (focus.occurredAt) add(idx.day.get(focus.occurredAt.slice(0, 10)));
  } else if (focus.attrs.kind === "household") {
    add(idx.subcategory.get(focus.attrs.subcategory));
    add(idx.note.get(focus.attrs.note.toLowerCase()));
    add(idx.category.get(focus.category));
    if (focus.occurredAt) add(idx.day.get(focus.occurredAt.slice(0, 10)));
  } else if (focus.subjectKey) {
    add(idx.groupMerchant.get(`${focus.subjectKey}|${focus.attrs.kind === "customer" ? focus.attrs.merchantLabel : ""}`));
    add(idx.groupCategory.get(`${focus.subjectKey}|${focus.category}`));
    add(idx.group.get(focus.subjectKey));
  }
  return [...bag.values()].slice(0, 240);
}

export function receiptMap(sources: Partial<Record<SourceId, Receipt[]>>): Map<string, Receipt> {
  const map = new Map<string, Receipt>();
  for (const rows of Object.values(sources)) {
    if (!rows) continue;
    for (const r of rows) map.set(r.id, r);
  }
  return map;
}

function push(map: Map<string, Receipt[]>, key: string, row: Receipt) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}
