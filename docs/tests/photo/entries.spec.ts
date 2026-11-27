import {
  addEntry,
  autoInserts,
  dropPage,
  Entry,
  entryFacts,
  fromLegacyPhotos,
  moveEntry,
  onlyPart,
  whyNotReady,
} from "../../components/photo/entries";
import type { StoredPhoto } from "../../components/photo/photoStore";

let ids = 0;
const newId = () => `id${++ids}`;
beforeEach(() => (ids = 0));

function entry(extra: Partial<Entry> = {}): Entry {
  return { id: newId(), name: "Section 1", ragams: "", regions: [], status: "draft", inserted: false, ...extra };
}

describe("addEntry", () => {
  test("numbers new entries after the ones already there", () => {
    const one = addEntry([], newId);
    const two = addEntry(one, newId);
    expect(two.map((e) => e.name)).toEqual(["Section 1", "Section 2"]);
    expect(two[1]).toMatchObject({ regions: [], status: "draft", inserted: false, ragams: "" });
  });
});

describe("moveEntry", () => {
  test("swaps with the neighbour and ignores moves off the ends", () => {
    const list = [entry({ name: "A" }), entry({ name: "B" }), entry({ name: "C" })];
    expect(moveEntry(list, 1, -1).map((e) => e.name)).toEqual(["B", "A", "C"]);
    expect(moveEntry(list, 2, 1).map((e) => e.name)).toEqual(["A", "B", "C"]);
    expect(list.map((e) => e.name)).toEqual(["A", "B", "C"]);
  });
});

describe("dropPage", () => {
  test("removes the page's regions from every entry", () => {
    const list = [
      entry({
        regions: [
          { pageId: "p1", crop: null },
          { pageId: "p2", crop: null },
        ],
      }),
      entry({ regions: [{ pageId: "p1", crop: { x: 0, y: 0, w: 1, h: 0.5 } }] }),
    ];
    const after = dropPage(list, "p1");
    expect(after[0].regions).toEqual([{ pageId: "p2", crop: null }]);
    expect(after[1].regions).toEqual([]);
  });
});

describe("entryFacts", () => {
  const song = { ragams: "Kedaram, Shankarabharanam", cycle: "|4|2|2|", notesPerBeat: 4 };

  test("an entry's ragam replaces the song's", () => {
    expect(entryFacts(song, entry({ ragams: "Kedaram" }))).toEqual({ ...song, ragams: "Kedaram" });
  });

  test("an entry without a ragam uses the song's facts", () => {
    expect(entryFacts(song, entry({ ragams: "  " }))).toEqual(song);
  });
});

describe("onlyPart", () => {
  test("a name the user gave tells the model which part to read", () => {
    expect(onlyPart(entry({ name: "Pallavi - Kedaram" }))).toBe("Pallavi - Kedaram");
  });

  test("a default name does not", () => {
    expect(onlyPart(entry({ name: "Section 3" }))).toBeUndefined();
    expect(onlyPart(entry({ name: "  " }))).toBeUndefined();
  });
});

describe("whyNotReady", () => {
  const pages = new Set(["p1"]);

  test("an entry with a region on a known page is ready", () => {
    expect(whyNotReady(entry({ regions: [{ pageId: "p1", crop: null }] }), pages)).toBeNull();
  });

  test("an entry needs a region", () => {
    expect(whyNotReady(entry(), pages)).toMatch(/region/);
  });

  test("a region whose page is gone blocks the run", () => {
    expect(whyNotReady(entry({ regions: [{ pageId: "p9", crop: null }] }), pages)).toMatch(/page/);
  });
});

describe("autoInserts", () => {
  const result = { transcription: {} as any, notation: "", costUsd: null, problems: 0 };

  test("the first result goes into the editor", () => {
    expect(autoInserts(entry())).toBe(true);
  });

  test("a re-run waits for Insert, whether or not the earlier result went in", () => {
    expect(autoInserts(entry({ result, inserted: true }))).toBe(false);
    expect(autoInserts(entry({ result, inserted: false }))).toBe(false);
  });
});

describe("fromLegacyPhotos", () => {
  function photo(fileId: string, page: number | null, extra: Partial<StoredPhoto> = {}): StoredPhoto {
    return { fileId, page, name: `${fileId}-${page}`, rotation: 0, crop: null, regionSet: true, ...extra };
  }

  test("one page per file page, and one entry with every picked region in order", () => {
    const crop = { x: 0, y: 0.1, w: 1, h: 0.3 };
    const { pages, entries } = fromLegacyPhotos(
      [photo("f1", 1, { crop, rotation: 1 }), photo("f1", 1), photo("f1", 2, { regionSet: false })],
      newId,
    );
    expect(pages).toEqual([
      { id: "id1", fileId: "f1", page: 1, name: "f1-1", rotation: 1 },
      { id: "id2", fileId: "f1", page: 2, name: "f1-2", rotation: 0 },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].regions).toEqual([
      { pageId: "id1", crop },
      { pageId: "id1", crop: null },
    ]);
  });

  test("no picked regions means no entry", () => {
    const { pages, entries } = fromLegacyPhotos([photo("f2", null, { regionSet: false })], newId);
    expect(pages).toHaveLength(1);
    expect(entries).toEqual([]);
  });
});
