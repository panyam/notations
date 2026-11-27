/**
 * entries.ts - The photo page's list of transcriptions.
 *
 * Uploaded pages are sources. A transcription entry names one part of the song, such as
 * "Pallavi - Kedaram", and picks the regions of those pages that hold it. A section can run
 * from the bottom of one page onto the next, so an entry can have several regions. Each entry
 * also carries its own ragam, talam and swaras per beat, since a ragamalika or a later section
 * can change all three. Entries run one at a time, and each result goes after what is in the
 * editor.
 *
 * Everything here is plain data and pure functions, so the page and the store share it and
 * the tests need no DOM.
 */

import type { CropRect } from "./imageUtils";
import type { StoredPage, StoredPhoto } from "./photoStore";
import type { KnownFacts } from "./prompt";
import type { Transcription } from "./grid";

/** Part of a page to send. A null crop sends the whole page. */
export interface Region {
  pageId: string;
  crop: CropRect | null;
}

export type EntryStatus = "draft" | "running" | "done" | "failed";

export interface EntryResult {
  /** The grid the model filled, for appending to the editor. */
  transcription: Transcription;
  /** The same result as standalone DSL, for showing in the entry. */
  notation: string;
  /** Estimated US dollars for the run, or null when the model has no rates. */
  costUsd: number | null;
  /** Grid errors and parse errors left after the repair rounds. */
  problems: number;
}

export interface Entry {
  id: string;
  name: string;
  /** This part's ragam. Empty leaves it to the model to read from the page. */
  ragams: string;
  /** This part's talam as a cycle, e.g. "|4|2|2|". Empty leaves it to the page. Enforced when set. */
  cycle: string;
  /** Swaras per beat in this part. Null leaves it to the page. */
  notesPerBeat: number | null;
  regions: Region[];
  status: EntryStatus;
  /** Why the last run failed, when status is "failed". */
  error?: string;
  /** The last successful run. */
  result?: EntryResult;
  /** Whether the current result is in the editor. A new result starts out not inserted. */
  inserted: boolean;
}

const DEFAULT_NAME = /^Section \d+$/;

/**
 * The list with a new entry at the end, named "Section N". It copies the talam and swaras per
 * beat from the entry above, since consecutive parts usually share them. The ragam starts empty.
 */
export function addEntry(entries: Entry[], newId: () => string): Entry[] {
  const above = entries[entries.length - 1];
  const entry: Entry = {
    id: newId(),
    name: `Section ${entries.length + 1}`,
    ragams: "",
    cycle: above?.cycle ?? "",
    notesPerBeat: above?.notesPerBeat ?? null,
    regions: [],
    status: "draft",
    inserted: false,
  };
  return [...entries, entry];
}

/** The list with the entry at `index` swapped with its neighbour, or unchanged at either end. */
export function moveEntry(entries: Entry[], index: number, delta: number): Entry[] {
  const to = index + delta;
  if (index < 0 || index >= entries.length || to < 0 || to >= entries.length) return entries;
  const next = entries.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** The list with every region on `pageId` removed, after that page is removed. */
export function dropPage(entries: Entry[], pageId: string): Entry[] {
  return entries.map((e) => ({ ...e, regions: e.regions.filter((r) => r.pageId !== pageId) }));
}

/**
 * The facts to send for `entry`: the notebook's (letter case), plus the entry's ragam, talam
 * and swaras per beat where it sets them.
 */
export function entryFacts(notebook: KnownFacts, entry: Entry): KnownFacts {
  const facts: KnownFacts = { ...notebook };
  const ragams = entry.ragams.trim();
  if (ragams) facts.ragams = ragams;
  if (entry.cycle.trim()) facts.cycle = entry.cycle.trim();
  if (entry.notesPerBeat) facts.notesPerBeat = entry.notesPerBeat;
  return facts;
}

/** An entry saved before entries had their own talam and speed, with those fields filled in. */
export function normalizeEntry(entry: Entry): Entry {
  return { ...entry, cycle: entry.cycle ?? "", notesPerBeat: entry.notesPerBeat ?? null };
}

/** The part to ask the model for. A default "Section N" name says nothing, so it sends none. */
export function onlyPart(entry: Entry): string | undefined {
  const name = entry.name.trim();
  return name && !DEFAULT_NAME.test(name) ? name : undefined;
}

/** Why `entry` cannot run yet, or null when it can. `pageIds` are the pages on the page now. */
export function whyNotReady(entry: Entry, pageIds: Set<string>): string | null {
  if (entry.regions.length === 0) return "Add a region from one of the pages";
  if (entry.regions.some((r) => !pageIds.has(r.pageId))) return "A region's page was removed; remove that region";
  return null;
}

/**
 * Whether a new result for `entry` goes straight into the editor.
 *
 * The first result does. After that, the editor may hold that result with hand fixes, so a
 * re-run keeps its result in the entry until the user presses Insert. Pass the entry as it
 * was before the new result.
 */
export function autoInserts(entry: Entry): boolean {
  return !entry.result;
}

/**
 * Converts the photo list the page kept before transcription entries existed.
 *
 * That page sent every photo's region in one request, so the photos with a region become one
 * entry, in order. Each distinct page of a file becomes one page, keeping the first rotation
 * seen for it.
 */
export function fromLegacyPhotos(
  photos: StoredPhoto[],
  newId: () => string,
): { pages: StoredPage[]; entries: Entry[] } {
  const pages: StoredPage[] = [];
  const pageFor = new Map<string, StoredPage>();
  const regions: Region[] = [];
  for (const p of photos) {
    const key = `${p.fileId}#${p.page ?? ""}`;
    let page = pageFor.get(key);
    if (!page) {
      page = { id: newId(), fileId: p.fileId, page: p.page, name: p.name, rotation: p.rotation };
      pageFor.set(key, page);
      pages.push(page);
    }
    if (p.regionSet) regions.push({ pageId: page.id, crop: p.crop });
  }
  if (regions.length === 0) return { pages, entries: [] };
  const [entry] = addEntry([], newId);
  return { pages, entries: [{ ...entry, regions }] };
}
