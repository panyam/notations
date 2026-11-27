import * as fs from "fs";
import * as path from "path";

const DOCS = path.resolve(__dirname, "..");
const CONTENT = path.join(DOCS, "content");

function files(dir: string, ext: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p, ext) : e.name.endsWith(ext) ? [p] : [];
  });
}

/** The source file a site path is built from, or null when no page or static file serves it. */
function sourceFor(sitePath: string): string | null {
  const clean = sitePath.replace(/^\/+/, "").replace(/\/+$/, "");
  const candidates = clean.startsWith("static/")
    ? [path.join(DOCS, clean)]
    : clean === ""
      ? [path.join(CONTENT, "index.html")]
      : [path.join(CONTENT, clean, "index.html"), path.join(CONTENT, clean + ".html"), path.join(CONTENT, clean)];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** Every internal link written in the site's sources, with where it was written. */
function links(): Array<{ from: string; target: string }> {
  const out: Array<{ from: string; target: string }> = [];
  const sources = [...files(CONTENT, ".html"), ...files(path.join(DOCS, "templates"), ".html")];
  for (const file of sources) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(/\{\{\s*\$?\.Site\.PathPrefix\s*\}\}(\/[^"'\s<>{}]*)/g)) {
      out.push({ from: path.relative(DOCS, file), target: m[1] });
    }
  }
  const walk = (items: any[]) =>
    items.forEach((i) => {
      out.push({ from: "content/HeaderNavLinks.json", target: "/" + i.url });
      walk(i.children ?? []);
    });
  walk(JSON.parse(fs.readFileSync(path.join(CONTENT, "HeaderNavLinks.json"), "utf8")));
  return out;
}

describe("internal links on the docs site", () => {
  const all = links();

  test("there are links to check", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  test("every link points at a page that exists, and every #anchor at an id on it", () => {
    const broken: string[] = [];
    for (const { from, target } of all) {
      if (target.startsWith("/pagefind/")) continue; // written by `make render`, not a source page
      const [p, anchor] = target.split("#");
      const src = sourceFor(p.split("?")[0]);
      if (!src) broken.push(`${from}: ${target} (no such page)`);
      else if (anchor && !new RegExp(`id="${anchor}"`).test(fs.readFileSync(src, "utf8"))) {
        broken.push(`${from}: ${target} (no id="${anchor}")`);
      }
    }
    expect([...new Set(broken)].sort()).toEqual([]);
  });
});
