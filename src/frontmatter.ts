/**
 * frontmatter.ts - Reads the front matter at the top of a notation document.
 *
 * Front matter in notation is a handful of flat `key: value` lines (ragam, talam, cycle,
 * beatDuration, breaks), so this reads that subset of YAML instead of bundling a full YAML
 * parser (#87). It reads the values the way YAML 1.2 does, and reports anything outside the
 * subset as an error that names the line, rather than reading it some other way.
 */

/** A value front matter can hold: a scalar, or a flow list of scalars. */
export type FrontMatterScalar = string | number | boolean | null;
export type FrontMatterValue = FrontMatterScalar | FrontMatterScalar[];

/** A problem in the front matter, with the 1-based line it is on. */
export interface FrontMatterError {
  line: number;
  message: string;
}

/**
 * Parses front matter text, everything between the `---` markers. Line numbers count from 1 at
 * the start of the text, so text that starts right after the opening `---` numbers the `---`
 * line as line 1, which matches the document when it opens with front matter.
 *
 * Supported: one `key: value` per line, where the value is a double- or single-quoted string, a
 * plain string, a number, `true`/`false`, `null` (or nothing), or a flow list such as
 * `[1, "two", 3]`. Blank lines and `#` comments are skipped. Every line may share one indent.
 *
 * Nested maps, block lists (`- item`), multi-line strings, anchors, tags and duplicate keys are
 * errors. A line with an error is left out of `data`, and the other lines are still read, so a
 * caller gets every key it can use. It never throws.
 */
export function parseFrontMatter(text: string): { data: Record<string, FrontMatterValue>; errors: FrontMatterError[] } {
  const data: Record<string, FrontMatterValue> = {};
  const errors: FrontMatterError[] = [];
  const lines = text.split(/\r?\n/);
  const indentOf = (l: string) => l.length - l.replace(/^\s+/, "").length;
  const isContent = (l: string) => l.trim() !== "" && !l.trim().startsWith("#");
  const content = lines.filter(isContent);
  const baseIndent = content.length ? Math.min(...content.map(indentOf)) : 0;

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!isContent(raw)) return;
    const fail = (message: string) => errors.push({ line, message });
    if (indentOf(raw) > baseIndent) return fail("nested values are not supported in front matter");
    const text = raw.trim();
    if (text.startsWith("- ") || text === "-") return fail("block lists are not supported; use [a, b]");

    const [key, rest] = splitKey(text);
    if (key === null) return fail(`expected "key: value", got "${text}"`);
    if (key in data) return fail(`duplicate key "${key}"`);
    try {
      data[key] = parseValue(rest);
    } catch (e: any) {
      fail(`${key}: ${e.message}`);
    }
  });
  return { data, errors };
}

/** Splits `key: rest`. The key may be quoted. Returns a null key if there is no `:`. */
function splitKey(text: string): [string | null, string] {
  if (text[0] === '"' || text[0] === "'") {
    const [key, end] = readQuoted(text, 0);
    const after = text.slice(end).replace(/^\s+/, "");
    if (!after.startsWith(":")) return [null, ""];
    return [key, after.slice(1)];
  }
  const m = /^([^:#]+?)\s*:(?:\s|$)/.exec(text);
  if (!m) return [null, ""];
  return [m[1], text.slice(m[0].length)];
}

/** Reads a value: a flow list, a quoted string or a plain scalar, then an optional comment. */
function parseValue(rest: string): FrontMatterValue {
  const text = rest.trim();
  if (text.startsWith("[")) {
    const close = findListEnd(text);
    expectOnlyComment(text.slice(close + 1));
    return splitList(text.slice(1, close)).map((item) => parseScalar(item, true));
  }
  return parseScalar(text, false);
}

function parseScalar(text: string, inList: boolean): FrontMatterScalar {
  const t = text.trim();
  if (t[0] === '"' || t[0] === "'") {
    const [value, end] = readQuoted(t, 0);
    expectOnlyComment(t.slice(end));
    return value;
  }
  const plain = stripComment(t);
  if (/^[[\]{}&*!|>%@`]/.test(plain)) {
    throw new Error(`"${plain}" needs quotes; nested lists, maps, anchors and tags are not supported`);
  }
  if (/:(\s|$)/.test(plain) || (inList && /[[\]{}]/.test(plain))) {
    throw new Error(`"${plain}" needs quotes; nested values are not supported`);
  }
  return plainScalar(plain);
}

/** Resolves a plain scalar the way the YAML 1.2 core schema does. */
function plainScalar(s: string): FrontMatterScalar {
  if (s === "" || s === "~" || /^(null|Null|NULL)$/.test(s)) return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?[0-9]+$/.test(s)) return parseInt(s, 10);
  if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s.slice(2), 16);
  if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return parseFloat(s);
  if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return s[0] === "-" ? -Infinity : Infinity;
  if (/^\.(nan|NaN|NAN)$/.test(s)) return NaN;
  return s;
}

const ESCAPES: Record<string, string> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\x85",
  _: "\xa0",
  L: " ",
  P: " ",
};

/** Reads a quoted string starting at `start`. Returns the value and the index after the quote. */
function readQuoted(text: string, start: number): [string, number] {
  const quote = text[start];
  let out = "";
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (quote === "'" && c === "'") {
      if (text[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return [out, i + 1];
    }
    if (quote === '"' && c === '"') return [out, i + 1];
    if (quote === '"' && c === "\\") {
      const e = text[i + 1];
      const hexLen = e === "x" ? 2 : e === "u" ? 4 : e === "U" ? 8 : 0;
      if (hexLen) {
        const hex = text.slice(i + 2, i + 2 + hexLen);
        if (!new RegExp(`^[0-9a-fA-F]{${hexLen}}$`).test(hex)) throw new Error(`bad escape "\\${e}${hex}"`);
        out += String.fromCodePoint(parseInt(hex, 16));
        i += 2 + hexLen;
        continue;
      }
      if (!(e in ESCAPES)) throw new Error(`unknown escape "\\${e ?? ""}"`);
      out += ESCAPES[e];
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  throw new Error("unclosed quote; multi-line strings are not supported");
}

/** Finds the `]` that closes the list opening at index 0, skipping quoted strings. */
function findListEnd(text: string): number {
  for (let i = 1; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") i = readQuoted(text, i)[1] - 1;
    else if (c === "[" || c === "{") throw new Error("nested lists and maps are not supported");
    else if (c === "]") return i;
  }
  throw new Error("unclosed [; a list must be on one line");
}

/** Splits list items on commas outside quotes. A trailing comma adds no item. */
function splitList(body: string): string[] {
  const items: string[] = [];
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") i = readQuoted(body, i)[1] - 1;
    else if (c === ",") {
      items.push(body.slice(start, i));
      start = i + 1;
    }
  }
  const last = body.slice(start);
  if (last.trim() !== "" || items.length === 0) items.push(last);
  if (items.length === 1 && items[0].trim() === "") return [];
  for (const item of items) if (item.trim() === "") throw new Error("empty list item");
  return items;
}

/** A plain scalar ends at ` #`, which starts a comment. */
function stripComment(s: string): string {
  const m = /(^|\s)#/.exec(s);
  return (m ? s.slice(0, m.index) : s).trim();
}

function expectOnlyComment(after: string): void {
  const t = after.trim();
  if (t !== "" && !t.startsWith("#")) throw new Error(`unexpected "${t}" after the value`);
}
