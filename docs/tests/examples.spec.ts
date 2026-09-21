import * as fs from "fs";
import * as path from "path";
import { load } from "../../src/loader";

const CONTENT_ROOT = path.resolve(__dirname, "..", "content");

type Example = { file: string; id: string; body: string };

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Drops commented-out regions, which never reach the browser and so are not examples. A single
// regex replace leaves a dangling `<!--` behind when a comment is unterminated, so this walks the
// string the way a browser does: a comment runs to the next `-->`, and one that never closes
// swallows the rest of the document.
export function stripComments(html: string): string {
  let out = "";
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<!--", cursor);
    if (start < 0) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, start);
    const end = html.indexOf("-->", start + "<!--".length);
    if (end < 0) break;
    cursor = end + "-->".length;
  }
  return out;
}

function collect(): Example[] {
  const out: Example[] = [];
  for (const file of htmlFiles(CONTENT_ROOT)) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of src.matchAll(/<notation\s([^>]*)>([\s\S]*?)<\/notation>/g)) {
      const body = decode(m[2]).trim();
      // The visual-tests page builds its <notation> elements from a Go range, so its body is a
      // template rather than notation.
      if (body.includes("{{")) continue;
      const id = /id="([^"]*)"/.exec(m[1])?.[1] ?? path.basename(path.dirname(file));
      out.push({ file: path.relative(CONTENT_ROOT, file), id, body });
    }
  }
  return out;
}

const examples = collect();

describe("stripComments", () => {
  test("removes a comment and keeps what surrounds it", () => {
    expect(stripComments("a<!-- b -->c")).toBe("ac");
  });

  test("removes every comment in the string", () => {
    expect(stripComments("a<!--x-->b<!--y-->c")).toBe("abc");
  });

  test("drops the rest of the document when a comment never closes", () => {
    expect(stripComments("a<!-- b")).toBe("a");
  });

  test("leaves no comment opener behind", () => {
    expect(stripComments("<!--<!-- -->tail")).toBe("tail");
    expect(stripComments("a<!--b-->c<!--d")).not.toContain("<!--");
  });
});

describe("Docs site examples", () => {
  test("the page set is non-empty", () => {
    expect(examples.length).toBeGreaterThan(100);
  });

  // NotationBlock.updatePreview renders nothing when load() reports errors, so an example that
  // does not parse is a blank box on the published site with the reason only in the console.
  describe.each(examples.map((e) => [`${e.file} #${e.id}`, e] as const))("%s", (_label, example) => {
    test("parses with no errors", () => {
      const [, , errors] = load(example.body + "\n");
      expect(errors.map((e: any) => e.message)).toEqual([]);
    });

    // Underscores lex as ordinary identifier characters, so a silent space renders as visible
    // text rather than failing. Guards against that reappearing while issue 17 is open.
    test("has no underscore literal standing in for a silent space", () => {
      const [notation] = load(example.body + "\n");
      const literals = JSON.stringify(notation.debugValue()).match(/"value":"(_+)"/g) ?? [];
      expect(literals).toEqual([]);
    });
  });
});
