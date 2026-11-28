import { readFileSync } from "fs";
import { join } from "path";
import { decodeSource, encodeSource, initialSource, shareUrl } from "../components/share";

const SONG = readFileSync(join(__dirname, "fixtures/share-song.sng"), "utf8");

describe("share links (#77)", () => {
  test("a link decodes back to the exact source, accents included", async () => {
    const src = 'Sw: S , R G\nSh: "sā" ri gā ma\n> #### Pallavi';
    expect(await decodeSource(await encodeSource(src))).toBe(src);
  });

  test("a link starts with format 1 and is URL-safe base64 without padding", async () => {
    const link = await encodeSource("Sw: S R G M");
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/);
    const firstByte = Buffer.from(link.replace(/-/g, "+").replace(/_/g, "/"), "base64")[0];
    expect(firstByte).toBe(1);
  });

  test("a whole song makes a link a fraction of its size", async () => {
    const link = await encodeSource(SONG);
    expect(await decodeSource(link)).toBe(SONG);
    expect(link.length).toBeLessThan(SONG.length * 0.6);
  });

  test("a link that isn't one decodes to null instead of throwing", async () => {
    expect(await decodeSource("")).toBeNull();
    expect(await decodeSource("not a link!")).toBeNull();
    expect(await decodeSource("AQ")).toBeNull(); // format 1, no payload
    expect(await decodeSource("CQAAAA")).toBeNull(); // format 9
    const good = await encodeSource("Sw: S R G M");
    expect(await decodeSource(good.slice(0, good.length - 4))).toBeNull(); // cut short
  });
});

describe("what the playground opens with", () => {
  test("a #s= link wins over a library song and a draft", () => {
    expect(initialSource({ hash: "#s=abc", search: "?song=x/y", draft: "d" })).toEqual({ kind: "link", link: "abc" });
  });

  test("a ?song= path opens that library song", () => {
    expect(initialSource({ hash: "", search: "?song=thyagaraja/evvaru-ra", draft: "d" })).toEqual({
      kind: "song",
      song: "thyagaraja/evvaru-ra",
    });
  });

  test("a song path can't climb out of the library", () => {
    expect(initialSource({ hash: "", search: "?song=../../api", draft: null })).toEqual({ kind: "sample" });
  });

  test("otherwise the last draft, otherwise a sample", () => {
    expect(initialSource({ hash: "", search: "", draft: "Sw: S" })).toEqual({ kind: "draft", source: "Sw: S" });
    expect(initialSource({ hash: "", search: "", draft: null })).toEqual({ kind: "sample" });
  });
});

describe("which link Share gives", () => {
  const base = "https://panyam.github.io/notations";

  test("an unchanged library song shares its library page", async () => {
    const url = await shareUrl({ source: "Sw: S", song: { path: "thyagaraja/evvaru-ra", source: "Sw: S" }, base });
    expect(url).toBe(`${base}/library/thyagaraja/evvaru-ra/`);
  });

  test("an edited song or your own piece shares a view link that carries the source", async () => {
    const edited = await shareUrl({ source: "Sw: S R", song: { path: "thyagaraja/evvaru-ra", source: "Sw: S" }, base });
    const own = await shareUrl({ source: "Sw: S R", song: null, base });
    for (const url of [edited, own]) {
      expect(url.startsWith(`${base}/view/#s=`)).toBe(true);
      expect(await decodeSource(url.split("#s=")[1])).toBe("Sw: S R");
    }
  });
});
