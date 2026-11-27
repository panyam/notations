import { IDBFactory } from "fake-indexeddb";
import { PhotoStore, StoredFile, StoredPhoto } from "../../components/photo/photoStore";

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

const PDF: StoredFile = { id: "f1", name: "varnam.pdf", type: "application/pdf", bytes: bytes(37, 80, 68, 70) };
const JPEG: StoredFile = { id: "f2", name: "page.jpg", type: "image/jpeg", bytes: bytes(255, 216, 255) };

function photo(fileId: string, page: number | null, extra: Partial<StoredPhoto> = {}): StoredPhoto {
  return { fileId, page, name: `${fileId}-${page}`, rotation: 0, crop: null, regionSet: false, ...extra };
}

describe("PhotoStore", () => {
  let factory: IDBFactory;
  beforeEach(() => (factory = new IDBFactory()));

  test("a fresh store is empty", async () => {
    const store = (await PhotoStore.open(factory))!;
    expect(await store.files()).toEqual([]);
    expect(await store.photos()).toEqual([]);
    expect(await store.notation()).toBeNull();
  });

  test("files, photos and notation come back after reopening", async () => {
    const first = (await PhotoStore.open(factory))!;
    await first.putFile(PDF);
    const photos = [
      photo("f1", 1, { rotation: 1, crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }, regionSet: true }),
      photo("f1", 2),
    ];
    await first.savePhotos(photos);
    await first.saveNotation("Sw: s r g m");
    first.close();

    const second = (await PhotoStore.open(factory))!;
    const files = await second.files();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("varnam.pdf");
    expect(Array.from(new Uint8Array(files[0].bytes))).toEqual([37, 80, 68, 70]);
    expect(await second.photos()).toEqual(photos);
    expect(await second.notation()).toBe("Sw: s r g m");
  });

  test("a PDF is stored once, however many of its pages are photos", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(PDF);
    await store.savePhotos([photo("f1", 1), photo("f1", 2), photo("f1", 2, { regionSet: true })]);
    expect(await store.files()).toHaveLength(1);
  });

  test("saving photos drops files no photo uses any more", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(PDF);
    await store.putFile(JPEG);
    await store.savePhotos([photo("f1", 1), photo("f2", null)]);
    await store.savePhotos([photo("f2", null)]);
    expect((await store.files()).map((f) => f.id)).toEqual(["f2"]);
  });

  test("forgetting files keeps the notation", async () => {
    const store = (await PhotoStore.open(factory))!;
    await store.putFile(JPEG);
    await store.savePhotos([photo("f2", null)]);
    await store.saveNotation("Sw: s r g m");
    await store.forgetFiles();
    expect(await store.files()).toEqual([]);
    expect(await store.photos()).toEqual([]);
    expect(await store.notation()).toBe("Sw: s r g m");
  });

  test("open gives null when IndexedDB is missing", async () => {
    expect(await PhotoStore.open(undefined)).toBeNull();
  });
});
