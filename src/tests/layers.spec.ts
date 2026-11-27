import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");

/** The modules a source file imports: relative ones as resolved paths, packages by name. */
function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)) {
    if (/^\s*import\s+type\s/.test(m[0]) || /^\s*export\s+type\s/.test(m[0])) continue;
    const spec = m[1];
    if (!spec.startsWith(".")) {
      out.push(spec);
      continue;
    }
    const base = path.resolve(path.dirname(file), spec);
    const resolved = [base + ".ts", path.join(base, "index.ts")].find((p) => fs.existsSync(p));
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Every module reachable from `entry` through runtime imports (type-only imports don't count). */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const todo = [path.join(SRC, entry)];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (f.endsWith(".ts")) todo.push(...importsOf(f));
  }
  return seen;
}

const rel = (p: string) => (p.startsWith(SRC) ? path.relative(SRC, p) : p);
const RENDERER = ["shapes.ts", "beatview.ts", "carnatic/index.ts", "carnatic/atomviews.ts", "carnatic/beatviews.ts"];
const PARSING = ["parser.ts", "loader.ts", "galore", "tlex", "yaml"];

describe("layers", () => {
  test("the runtime (notations/core) reaches neither the parser nor the renderer", () => {
    const hits = [...reachable("entry-core.ts")].map(rel).filter((m) => [...PARSING, ...RENDERER].includes(m));
    expect(hits).toEqual([]);
  });

  test("the parser (notations/parser) doesn't reach the renderer", () => {
    const hits = [...reachable("entry-parser.ts")].map(rel).filter((m) => RENDERER.includes(m));
    expect(hits).toEqual([]);
  });

  // notations/export works on any page that renders notation, so it can't pull in the playground.
  test("export (notations/export) reaches the renderer but not the editor or the dock", () => {
    expect(fs.existsSync(path.join(SRC, "entry-export.ts"))).toBe(true);
    const mods = [...reachable("entry-export.ts")].map(rel);
    expect(mods).toContain("carnatic/NotationView.ts");
    expect(mods.filter((m) => m.startsWith("web/") || /dockview|tsappkit-dock/.test(m))).toEqual([]);
  });

  test("parser.ts doesn't import Carnatic code; load() wires the gamakas in", () => {
    const direct = importsOf(path.join(SRC, "parser.ts")).map(rel);
    expect(direct.filter((m) => m.startsWith("carnatic/"))).toEqual([]);
  });
});
