/**
 * Builds the docs site's song library from notation_demos (#71).
 *
 *   pnpm run library                  write docs/content/library/ from the pinned commit
 *   pnpm run library --demos <dir>    use your own notation_demos checkout as it is
 *   pnpm run library --bump           pin notation_demos master's latest commit, then build
 *
 * docs/library.json pins the commit. Without --demos, the songs come from .cache/notation_demos,
 * which this script clones and moves to the pinned commit. CI checks that commit out there first,
 * so it needs no network here. A song that doesn't parse fails the run.
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { isLibrarySong, libraryPages, LibraryPin, readSong } from "./libraryPages";

const ROOT = path.resolve(__dirname, "..", "..");
const PIN_FILE = path.join(ROOT, "docs", "library.json");
const CACHE = path.join(ROOT, ".cache", "notation_demos");
const OUT = path.join(ROOT, "docs", "content", "library");

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

function readPin(): LibraryPin {
  return JSON.parse(fs.readFileSync(PIN_FILE, "utf8"));
}

/** Clones notation_demos into the cache if needed, and moves it to the pinned commit. */
function ensureCache(pin: LibraryPin): string {
  if (!fs.existsSync(path.join(CACHE, ".git"))) {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    git(ROOT, "clone", "--quiet", `https://github.com/${pin.repo}.git`, CACHE);
  }
  if (git(CACHE, "rev-parse", "HEAD") != pin.commit) {
    git(CACHE, "fetch", "--quiet", "origin", pin.commit);
    git(CACHE, "checkout", "--quiet", "--detach", pin.commit);
  }
  return CACHE;
}

/** Every song under `dir`, as paths relative to it with forward slashes. */
function songPaths(dir: string, rel = ""): string[] {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.name.startsWith(".")) return [];
    return e.isDirectory() ? songPaths(dir, p) : isLibrarySong(p) ? [p] : [];
  });
}

function main(argv: string[]): void {
  const demosIdx = argv.indexOf("--demos");
  let pin = readPin();
  if (argv.includes("--bump")) {
    const latest = execFileSync("git", ["ls-remote", `https://github.com/${pin.repo}.git`, "HEAD"], {
      encoding: "utf8",
    }).split(/\s/)[0];
    pin = { ...pin, commit: latest };
    fs.writeFileSync(PIN_FILE, JSON.stringify(pin, null, 2) + "\n");
    console.log(`Pinned ${pin.repo} at ${latest}`);
  }

  let dir: string;
  if (demosIdx >= 0) {
    dir = path.resolve(argv[demosIdx + 1]);
    const head = git(dir, "rev-parse", "HEAD");
    if (head != pin.commit)
      console.warn(`Note: ${dir} is at ${head.slice(0, 7)}, the pin is ${pin.commit.slice(0, 7)}.`);
  } else {
    dir = ensureCache(pin);
  }

  const songs = songPaths(dir)
    .sort()
    .map((p) => readSong(p, fs.readFileSync(path.join(dir, p), "utf8")));
  const pages = libraryPages(songs, pin);

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const page of pages) {
    const file = path.join(ROOT, "docs", "content", page.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page.html);
  }
  console.log(`Library: ${songs.length} songs from ${pin.repo}@${pin.commit.slice(0, 7)} into docs/content/library/`);
}

try {
  main(process.argv.slice(2));
} catch (e: any) {
  console.error(e.message);
  process.exit(1);
}
