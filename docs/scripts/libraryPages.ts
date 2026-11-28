/**
 * libraryPages.ts - Turns notation_demos songs into docs site pages (#71).
 *
 * `library.ts` finds the songs and writes the files. This module does the rest without touching
 * the disk, so the tests can drive it with strings: the URL for each song, its front matter, its
 * page, and the index pages by composer and by ragam.
 */

import { load } from "../../src/loader";

/** Where the songs come from: the repo and the commit the site renders. */
export interface LibraryPin {
  repo: string;
  commit: string;
}

/** One song, read from its `.sng` file. */
export interface Song {
  /** Path inside notation_demos, with forward slashes, such as `Thyagaraja/EvvaruRa.sng`. */
  path: string;
  /** URL path under the site prefix, such as `library/thyagaraja/evvaru-ra/`. */
  url: string;
  title: string;
  ragam: string;
  talam: string;
  composer: string;
  source: string;
  /** Parse error messages. Empty when the song loads cleanly. */
  errors: string[];
}

/** A page to write: its path under `docs/content/` and its contents. */
export interface Page {
  file: string;
  html: string;
}

/** Top-level folders that aren't songs. */
const SKIPPED_DIRS = new Set(["v3", "tests"]);

/** Whether a path inside notation_demos is a song the library shows. */
export function isLibrarySong(path: string): boolean {
  return path.endsWith(".sng") && !path.split("/").some((part) => SKIPPED_DIRS.has(part));
}

/**
 * The words of a file or folder name in kebab case: `SamiNinneNammi_PanthuVarAli` gives
 * `sami-ninne-nammi-panthu-var-ali`, and `Ana Lekara` gives `ana-lekara`. Accents are dropped,
 * so `Rā` gives `ra`.
 */
export function kebab(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** The site URL for a song, from its path: `Thyagaraja/EvvaruRa.sng` gives `library/thyagaraja/evvaru-ra/`. */
export function songUrl(path: string): string {
  const parts = path
    .replace(/\.sng$/, "")
    .split("/")
    .map(kebab);
  return `library/${parts.join("/")}/`;
}

/** Front matter keys spelled several ways across the songs, mapped to one name. */
const KEY_ALIASES: Record<string, string> = {
  raga: "ragam",
  ragam: "ragam",
  thalam: "talam",
  talam: "talam",
  composer: "composer",
  author: "composer",
};

/** Reads one song: its URL, title, front matter and parse errors. */
export function readSong(path: string, source: string): Song {
  const [notation, , errors] = load(source);
  const fields: Record<string, string> = {};
  for (const [key, meta] of notation.metadata.entries()) {
    const value = String(meta.value ?? "").trim();
    if (!value) continue;
    const alias = KEY_ALIASES[key.toLowerCase()];
    if (alias && !fields[alias]) fields[alias] = value;
  }
  return {
    path,
    url: songUrl(path),
    title: titleOf(path, source),
    ragam: fields.ragam ?? "",
    talam: fields.talam ?? "",
    composer: fields.composer ?? "",
    source,
    errors: errors.map((e) => e.message),
  };
}

/**
 * A song's title: its first `># Heading` line, which keeps accents such as `Evvaru Rā`, or else
 * its file name split into words.
 */
function titleOf(path: string, source: string): string {
  const heading = /^>\s*#\s+(.+)$/m.exec(source);
  if (heading) return heading[1].trim();
  const name = path
    .split("/")
    .pop()!
    .replace(/\.sng$/, "");
  return kebab(name)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Escapes text for a content page. s3gen runs each page through Go templates, so braces become
 * entities as well as `&`, `<` and `>`. A `<notation>` block reads its `textContent`, which
 * decodes them back.
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/** Like `escapeText`, and also escapes `"` for use inside an attribute. */
export function escapeHtml(text: string): string {
  return escapeText(text).replace(/"/g, "&quot;");
}

/** Front matter for a content page. Values are JSON strings, which YAML reads as quoted strings. */
function pageFrontMatter(title: string, description: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

const link = (url: string, text: string) => `<a href="{{.Site.PathPrefix}}/${url}">${escapeHtml(text)}</a>`;

/**
 * The page for one song: a link to its file, then the notation. The notation draws its own front
 * matter and headings, so the page doesn't repeat them.
 */
export function songPage(song: Song, pin: LibraryPin): Page {
  const summary = [song.composer, song.ragam, song.talam].filter(Boolean).join(", ");
  const fileUrl = `https://github.com/${pin.repo}/blob/${pin.commit}/${song.path.split("/").map(encodeURIComponent).join("/")}`;
  const html =
    pageFrontMatter(song.title, summary || "A song from the notation library") +
    `\n<p>From <a href="${escapeHtml(fileUrl)}">${escapeHtml(song.path)}</a> in ${escapeHtml(pin.repo)}. ` +
    `${link("library/", "All songs")} · ${link("library/ragams/", "By ragam")}</p>\n\n` +
    `<notation id="song">\n${escapeText(song.source)}\n</notation>\n`;
  return { file: song.url + "index.html", html };
}

/**
 * The key two spellings of one name share when they differ only in case, accents or punctuation:
 * `Pallavi GopAlaiyer` and `Pallavi Gōpālaiyer` both give `pallavigopalaiyer`.
 */
export function groupKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Groups songs by a field, sorted by group name and then title. Songs missing it go last. A group
 * shows the first spelling it met.
 */
function groupBy(songs: Song[], field: (s: Song) => string, missing: string): Array<[string, Song[]]> {
  const groups = new Map<string, { name: string; songs: Song[] }>();
  for (const song of songs) {
    const name = field(song) || missing;
    const key = groupKey(name);
    if (!groups.has(key)) groups.set(key, { name, songs: [] });
    groups.get(key)!.songs.push(song);
  }
  return [...groups.values()]
    .sort((a, b) => (a.name == missing ? 1 : b.name == missing ? -1 : a.name.localeCompare(b.name)))
    .map((g) => [g.name, g.songs.sort((a, b) => a.title.localeCompare(b.title))]);
}

function groupList(groups: Array<[string, Song[]]>, detail: (s: Song) => string): string {
  return groups
    .map(([name, songs]) => {
      const items = songs.map((s) => {
        const extra = detail(s);
        return `  <li>${link(s.url, s.title)}${extra ? ` (${escapeHtml(extra)})` : ""}</li>`;
      });
      return `<h2>${escapeHtml(name)}</h2>\n\n<ul>\n${items.join("\n")}\n</ul>\n`;
    })
    .join("\n");
}

/** The library's landing page, by composer, and its page by ragam. */
export function indexPages(songs: Song[], pin: LibraryPin): Page[] {
  const from = `<p>${songs.length} songs from <a href="https://github.com/${pin.repo}">${escapeHtml(pin.repo)}</a>, rendered with this version of notations.`;
  const byComposer =
    pageFrontMatter("Library", "Songs from notation_demos, by composer") +
    `\n${from} ${link("library/ragams/", "Browse by ragam")}.</p>\n\n` +
    groupList(
      groupBy(songs, (s) => s.composer, "Composer not given"),
      (s) => [s.ragam, s.talam].filter(Boolean).join(", "),
    );
  const byRagam =
    pageFrontMatter("Library by ragam", "Songs from notation_demos, by ragam") +
    `\n${from} ${link("library/", "Browse by composer")}.</p>\n\n` +
    groupList(
      groupBy(songs, (s) => s.ragam, "Ragam not given"),
      (s) => [s.composer, s.talam].filter(Boolean).join(", "),
    );
  return [
    { file: "library/index.html", html: byComposer },
    { file: "library/ragams/index.html", html: byRagam },
  ];
}

/**
 * Every page for a set of songs. Throws when songs fail to parse or two songs map to one URL,
 * listing each, so the build stops instead of publishing a blank page.
 */
export function libraryPages(songs: Song[], pin: LibraryPin): Page[] {
  const problems: string[] = [];
  for (const s of songs) for (const e of s.errors) problems.push(`${s.path}: ${e}`);
  const byUrl = new Map<string, string>();
  for (const s of songs) {
    const other = byUrl.get(s.url);
    if (other) problems.push(`${s.path}: same URL as ${other} (${s.url})`);
    byUrl.set(s.url, s.path);
  }
  if (problems.length) throw new Error(`${problems.length} problem(s) in the library:\n${problems.join("\n")}`);
  return [...songs.map((s) => songPage(s, pin)), ...indexPages(songs, pin)];
}
