import { IDBFactory } from "fake-indexeddb";
import type { Entry } from "../../components/photo/entries";
import { PhotoStore, StoredFile, StoredPage, StoredPhoto } from "../../components/photo/photoStore";

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

const PDF: StoredFile = { id: "f1", name: "varnam.pdf", type: "application/pdf", bytes: bytes(37, 80, 68, 70) };
const JPEG: StoredFile = { id: "f2", name: "page.jpg", type: "image/jpeg", bytes: bytes(255, 216, 255) };

function page(id: string, fileId: string, n: number | null, extra: Partial<StoredPage> = {}): StoredPage {
  return { id, fileId, page: n, name: `${fileId}-${n}`, rotation: 0, ...extra };
}

const ENTRY: Entry = {
  id: "e1",
  name: "Pallavi - Kedaram",
  ragams: "Kedaram",
  cycle: "|4|2|2|",
  notesPerBeat: 4,
  regions: [{ pageId: "p1", crop: { x: 0, y: 0.05, w: 1, h: 0.2 } }],
  status: "done",
  inserted: true,
};

describe("PhotoStore", () => {
  let factory: IDBFactory;
  beforeEach(() => (factory = new IDBFactory()));

  test("a fresh store is empty", async () => {
    const store = (await PhotoStore.open(factory))!;
    expect(await store.files()).toEqual([]);
    expect(await store.pages()).toBeNull();
    expect(await store.entries()).toEqual([]);
    expect(await store.photos()).toEqual([]);
    expect(await store.notation()).toBeNull();
  });

  test("files, pages, entries and notation come back after reopening", async () => {
    const first = (await PhotoStore.open(factory))!;
    await first.putFile(PDF);
    const pages = [page("p1", "f1", 1, { rotation: 1 }), page("p2", "f1", 2)];
    await first.savePages(pages);
    await first.saveEntries([ENTRY]);
    await first.saveNotation("Sw: s r g m");
    first.close();

    const second = (await PhotoStore.open(factory))!;
    const files = await second.files();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("varnam.pdf");
    expect(Array.from(new Uint8Array(files[0].bytes))).toEqual([37, 80, 68, 70]);
    expect(await second.pages()).toEqual(pages);
    expect(await second.entries()).toEqual([ENTRY]);
    expect(await second.notation()).toBe("Sw: s r g m");
  });

  test("a PDF is stored once, however many of its pages are kept", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(PDF);
    await store.savePages([page("p1", "f1", 1), page("p2", "f1", 2)]);
    expect(await store.files()).toHaveLength(1);
  });

  test("saving pages drops files no page uses any more", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(PDF);
    await store.putFile(JPEG);
    await store.savePages([page("p1", "f1", 1), page("p2", "f2", null)]);
    await store.savePages([page("p2", "f2", null)]);
    expect((await store.files()).map((f) => f.id)).toEqual(["f2"]);
  });

  test("an empty page list is a saved list, not a missing one", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.savePages([]);
    expect(await store.pages()).toEqual([]);
  });

  test("the legacy photo list reads back until pages are saved", async () => {
    const store = (await PhotoStore.open(factory))!;
    const legacy: StoredPhoto[] = [
      { fileId: "f1", page: 1, name: "varnam.pdf", rotation: 0, crop: null, regionSet: true },
    ];
    await store.saveLegacyPhotos(legacy);
    expect(await store.photos()).toEqual(legacy);
    await store.savePages([page("p1", "f1", 1)]);
    expect(await store.photos()).toEqual([]);
  });

  test("forgetting files clears pages and entries and keeps the notation", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(JPEG);
    await store.savePages([page("p2", "f2", null)]);
    await store.saveEntries([ENTRY]);
    await store.saveNotation("Sw: s r g m");
    await store.forgetFiles();
    expect(await store.files()).toEqual([]);
    expect(await store.pages()).toBeNull();
    expect(await store.entries()).toEqual([]);
    expect(await store.notation()).toBe("Sw: s r g m");
  });

  test("open gives null when IndexedDB is missing", async () => {
    expect(await PhotoStore.open(undefined)).toBeNull();
  });
});
