import {
  escapeHtml,
  escapeText,
  groupKey,
  indexPages,
  isLibrarySong,
  kebab,
  libraryPages,
  readSong,
  songPage,
  songUrl,
} from "../scripts/libraryPages";

const PIN = { repo: "panyam/notation_demos", commit: "679d029cb2701c07eff87a4a726b68ec3fe74358" };

const MOHANAM = `---
Composer: "Saint Thyagaraja"
Ragam: "Mohanam"
Thalam: "Misra Chaapu"
---

># Evvaru Rā

\\cycle("3|2|2")
Sw: S R G P D S. R.
`;

describe("song library (#71)", () => {
  test("URLs come from the file path, in kebab case", () => {
    expect(songUrl("Thyagaraja/EvvaruRa.sng")).toBe("library/thyagaraja/evvaru-ra/");
    expect(songUrl("Varnams/SamiNinneNammi_PanthuVarAli.sng")).toBe("library/varnams/sami-ninne-nammi-panthu-var-ali/");
    expect(songUrl("Geethams/Ana Lekara.sng")).toBe("library/geethams/ana-lekara/");
    expect(songUrl("ShyamaShastri/1/SKDAmbaPahi.sng")).toBe("library/shyama-shastri/1/skd-amba-pahi/");
    expect(kebab("Rā")).toBe("ra");
  });

  test("v3 and tests folders, and files other than .sng, are left out", () => {
    expect(
      ["Varnams/v3/Sharana.sng", "tests/a.sng", "README.md", "Varnams/Viriboni.sng"].filter(isLibrarySong),
    ).toEqual(["Varnams/Viriboni.sng"]);
  });

  test("a song reads its front matter, merging Thalam into talam, and its title from its heading", () => {
    const s = readSong("Thyagaraja/EvvaruRa.sng", MOHANAM);
    expect([s.title, s.composer, s.ragam, s.talam, s.errors]).toEqual([
      "Evvaru Rā",
      "Saint Thyagaraja",
      "Mohanam",
      "Misra Chaapu",
      [],
    ]);
  });

  test("with no heading, the title comes from the file name, and Raga and Author count too", () => {
    const s = readSong(
      "Varnams/NinneKori_Vasantha.sng",
      '---\nRaga: "Vasantha"\nAuthor: "Ramnad Srinivasa Iyengar"\n---\nS R',
    );
    expect([s.title, s.ragam, s.composer]).toEqual(["Ninne Kori Vasantha", "Vasantha", "Ramnad Srinivasa Iyengar"]);
  });

  test("a song page holds the source escaped, so Go templates and HTML leave it alone", () => {
    const s = readSong("Thyagaraja/EvvaruRa.sng", MOHANAM + "\\repeat(2) { S R }\n");
    const page = songPage(s, PIN);
    expect(page.file).toBe("library/thyagaraja/evvaru-ra/index.html");
    expect(page.html).toMatch(
      /^---\ntitle: "Evvaru Rā"\ndescription: "Saint Thyagaraja, Mohanam, Misra Chaapu"\n---\n/,
    );
    expect(page.html).toContain("&gt;# Evvaru Rā");
    expect(page.html).toContain('Ragam: "Mohanam"');
    expect(page.html).toContain("\\repeat(2) &#123; S R &#125;");
    expect(page.html).toContain(`https://github.com/panyam/notation_demos/blob/${PIN.commit}/Thyagaraja/EvvaruRa.sng`);
    expect(page.html.replace(/\{\{\.Site\.PathPrefix\}\}/g, "")).not.toMatch(/[{}]/);
  });

  // The playground loads the song by this path, and Share gives the library page back while the
  // song is unchanged (#77).
  test("a song page links to the playground with the song's own path", () => {
    const page = songPage(readSong("Thyagaraja/EvvaruRa.sng", MOHANAM), PIN);
    expect(page.html).toContain('href="{{.Site.PathPrefix}}/demos/playgrounds/side-by-side/?song=thyagaraja/evvaru-ra"');
  });

  test("escaping round-trips through the entities a browser decodes", () => {
    const text = 'a < b && "c" {x} > d';
    expect(escapeText(text)).toContain('"c"');
    const decoded = escapeHtml(text)
      .replace(/&#123;/g, "{")
      .replace(/&#125;/g, "}")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    expect(decoded).toBe(text);
  });

  test("index pages group by composer and by ragam, with missing values last", () => {
    const songs = [
      readSong("Thyagaraja/EvvaruRa.sng", MOHANAM),
      readSong("Varnams/Vanajakshi.sng", '---\nRagam: "Kalyani"\nComposer: "Pallavi Gopala Iyer"\n---\nS'),
      readSong("Exercises/Sarali.sng", '---\nRagam: "mohanam"\n---\nS'),
    ];
    const [byComposer, byRagam] = indexPages(songs, PIN);
    expect([...byComposer.html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1])).toEqual([
      "Pallavi Gopala Iyer",
      "Saint Thyagaraja",
      "Composer not given",
    ]);
    expect([...byRagam.html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1])).toEqual(["Kalyani", "Mohanam"]);
    expect(byRagam.html).toContain('<a href="{{.Site.PathPrefix}}/library/exercises/sarali/">Sarali</a>');
  });

  test("spellings that differ only in case, accents or punctuation share a group", () => {
    expect(["Pallavi GopAlaiyer", "Pallavi Gōpālaiyer", "Pallavi Gopālaiyer"].map(groupKey)).toEqual(
      Array(3).fill("pallavigopalaiyer"),
    );
    expect(groupKey("V.R. Pallavi Gopāla Iyer")).not.toBe(groupKey("Pallavi Gopalaiyer"));
  });

  test("a song that doesn't parse stops the build and names the file", () => {
    const bad = readSong("Varnams/Broken.sng", '\\cycle("|4x|")\nS R');
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(() => libraryPages([bad], PIN)).toThrow(/Varnams\/Broken\.sng: /);
  });

  test("two songs with the same URL stop the build", () => {
    const a = readSong("Varnams/Sami_Ninne.sng", "S");
    const b = readSong("Varnams/SamiNinne.sng", "S");
    expect(() => libraryPages([a, b], PIN)).toThrow(/Varnams\/SamiNinne\.sng: same URL as Varnams\/Sami_Ninne\.sng/);
  });
});
