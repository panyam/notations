import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const CONTENT_ROOT = path.resolve(__dirname, "..", "content");
const LIBRARY_ENTRY = path.resolve(__dirname, "..", "..", "src", "index.ts");

function htmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith(".html") ? [p] : [];
  });
}

function unescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Every library name a code block on the site uses, through N.x or import { x } from "notations". */
function namesUsedInSnippets(): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  const note = (name: string, page: string) => {
    if (!used.has(name)) used.set(name, new Set());
    used.get(name)!.add(page);
  };
  for (const file of htmlFiles(CONTENT_ROOT)) {
    const page = path.relative(CONTENT_ROOT, file);
    for (const block of fs.readFileSync(file, "utf8").matchAll(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)) {
      const code = unescape(block[1]);
      for (const m of code.matchAll(/\bN\.([A-Za-z_$][\w$]*)/g)) note(m[1], page);
      for (const m of code.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']notations["']/g)) {
        for (const spec of m[1].split(",")) {
          const name = spec
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0];
          if (name) note(name, page);
        }
      }
    }
  }
  return used;
}

/** The library's exports as TypeScript sees them, so interfaces and types count too. */
function libraryExports(): Set<string> {
  const program = ts.createProgram([LIBRARY_ENTRY], { skipLibCheck: true, noEmit: true });
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(LIBRARY_ENTRY)!)!;
  return new Set(checker.getExportsOfModule(moduleSymbol).map((s) => s.name));
}

describe("API snippets on the docs site", () => {
  const used = namesUsedInSnippets();

  test("the snippets use some library names", () => {
    expect(used.size).toBeGreaterThan(10);
  });

  test("every name they use is still exported by the library", () => {
    const exported = libraryExports();
    const missing = [...used]
      .filter(([name]) => !exported.has(name))
      .map(([name, pages]) => `${name} (${[...pages].sort().join(", ")})`)
      .sort();
    expect(missing).toEqual([]);
  });
});
