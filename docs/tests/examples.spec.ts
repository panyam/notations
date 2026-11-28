import * as fs from "fs";
import * as path from "path";
import { load } from "../../src/loader";
import { buildTimeline } from "../../src/timeline";

const CONTENT_ROOT = path.resolve(__dirname, "..", "content");

type Example = { file: string; id: string; body: string; heading: string; caption: string };

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

/**
 * The text of an HTML fragment: entities decoded, then everything from a `<` to the next `>`
 * dropped, brackets included. A character loop rather than a regex replace, so no partial tag can
 * survive (CodeQL js/incomplete-multi-character-sanitization).
 */
function textOf(html: string): string {
  let out = "";
  let inTag = false;
  for (const ch of decode(html)) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out.trim();
}

/** The text of the last <h2> or <h3> before `index`, so a check can see what the example claims. */
function headingBefore(src: string, index: number): string {
  const headings = [...src.slice(0, index).matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)];
  return headings.length ? textOf(headings[headings.length - 1][1]) : "";
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
      const caption = decode(/caption="([^"]*)"/.exec(m[1])?.[1] ?? "");
      out.push({ file: path.relative(CONTENT_ROOT, file), id, body, heading: headingBefore(src, m.index!), caption });
    }
  }
  return out;
}

/**
 * Talas in the form the site teaches them: each in its standard jati, as the alankaram books give
 * them, so plain Triputa is tisra jati and Adi is chatusra jati triputa. Longer names come first.
 */
export const TALAS: Array<[RegExp, number[]]> = [
  [/tisra\s+(jati\s+)?triputa/i, [3, 2, 2]],
  [/misra\s+chapu/i, [3, 2, 2]],
  [/k?handa\s+chapu/i, [2, 3]],
  [/dhruva/i, [4, 2, 4, 4]],
  [/matya/i, [4, 2, 4]],
  [/jh[ao]mpa/i, [7, 1, 2]],
  [/\bata\b/i, [5, 5, 2, 2]],
  [/\beka\b/i, [4]],
  [/chatusra\s+(jati\s+)?triputa|\badi\b/i, [4, 2, 2]],
  [/triputa/i, [3, 2, 2]],
  [/rupaka/i, [2, 4]],
];

/** The tala a piece of text names, by its standard cycle, or null when it names none. */
export function talaNamed(text: string): number[] | null {
  for (const [name, cycle] of TALAS) if (name.test(text)) return cycle;
  return null;
}

/** The bars of a cycle string, so "|4|2|2|" and "4|2|2" compare equal. */
export function cycleBars(cycle: string): number[] {
  return (cycle.match(/\d+/g) ?? []).map(Number);
}

/** A literal made only of swara letters and octave dots, two or more of them: notes run together. */
export const GLUED_SWARAS = /^\.*([SRGMPDNsrgmpdn]\.*){2,}$/;

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

    // "SRG" is one note named SRG, drawn in a single slot, not three notes. Agent-written examples
    // made this mistake 89 times before this test existed.
    test("writes each swara as its own note", () => {
      const [notation] = load(example.body + "\n");
      const literals = [...JSON.stringify(notation.debugValue()).matchAll(/"type":"Literal","value":"([^"]*)"/g)];
      expect(literals.map((m) => m[1]).filter((v) => GLUED_SWARAS.test(v))).toEqual([]);
    });

    test("uses the cycle of the tala its heading or caption names", () => {
      const named = talaNamed(`${example.caption} ${example.heading}`);
      const cycle = /\\cycle\("([^"]*)"\)/.exec(example.body);
      if (named && cycle) expect(cycleBars(cycle[1])).toEqual(named);
    });

    // A player reads the timeline (#101), so every example must lay out on one: lines back to
    // back in whole cycles, and each event starting inside its line, or in the cycle before it
    // for a pickup.
    test("lays out on a timeline, each event inside its line", () => {
      const [notation] = load(example.body + "\n");
      const t = buildTimeline(notation);
      let end = t.lines.length ? t.lines[0].offset : t.duration;
      for (const l of t.lines) {
        expect(l.offset.toString()).toBe(end.toString());
        end = l.offset.plus(l.cycleDuration.timesNum(l.cycles));
      }
      expect(t.duration.toString()).toBe(end.toString());
      const stray: string[] = [];
      for (const e of t.events) {
        const l = t.lines.find((l) => l.line === e.line && l.offset.equals(e.offset.minus(e.lineOffset)))!;
        const span = l.cycleDuration.timesNum(l.cycles);
        const inside = e.lineOffset.isGTE(l.cycleDuration.timesNum(-1)) && e.lineOffset.isLT(span);
        if (!inside || !e.duration.isGTNum(0)) stray.push(`${e.value}@${e.offset}`);
      }
      expect(stray).toEqual([]);
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

describe("Tala tables on the site", () => {
  const rows = ["reference/cycles/index.html", "examples/common-talas.html"].flatMap((page) =>
    [...fs.readFileSync(path.join(CONTENT_ROOT, page), "utf8").matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((m) => [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1])))
      .filter((cells) => cells.length > 0)
      .map((cells) => ({ page, cells })),
  );

  test("there are rows to check", () => {
    expect(rows.length).toBeGreaterThan(5);
  });

  test.each(rows.map((r) => [`${r.page}: ${r.cells[0]}`, r] as const))("%s", (_label, row) => {
    const named = talaNamed(row.cells[0]);
    const cycleCell = row.cells.find((c) => /^"?\|?\d+(\|\d+)+\|?"?$/.test(c) || /^"\|\d+\|"$/.test(c));
    if (named && cycleCell) expect(cycleBars(cycleCell)).toEqual(named);
  });
});
