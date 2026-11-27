import YAML from "yaml";
import * as fs from "fs";
import * as path from "path";
import { parseFrontMatter } from "../frontmatter";
import { Parser } from "../parser";

// yaml is a devDependency only, to check that the subset reads values the way YAML does (#87).
const SAME_AS_YAML = [
  "",
  "# only a comment",
  'Composer: "Thyagaraja"\nRagam: "Goulai"\nThalam: "Adi"',
  "ragam: Kedaram",
  "Ragam: Nāttai Kuranji",
  "Ragam: Mūlai Veedu Rangan  # a comment",
  "      a: 1\n      b: 2",
  'cycle: "|3|"\nbeatDuration: 2\nbreaks: 6',
  "breaks: [4, 4, 2]",
  'breaks: [1, "two", three, 4.5, true, null]',
  "breaks: []",
  "a: 1.5\nb: -3\nc: 1e3\nd: .5\ne: 0x1F\nf: 0o17\ng: +7",
  "a: true\nb: False\nc: TRUE\nd: null\ne: ~\nf:\ng: Null",
  "a: .inf\nb: -.Inf\nc: .NaN",
  "a: 'it''s'\nb: \"tab\\tquote\\\" \\u00e9 \\x41\"\nc: 'no \\n escape'",
  'a: "x" # trailing\nb: [1, 2] # trailing',
  "\"quoted key\": 1\n'single key': two",
  "url: http://example.com/a#b",
  "time: 12:30",
  "a: yes\nb: on\nc: 010",
];

describe("parseFrontMatter", () => {
  test.each(SAME_AS_YAML)("reads %j the way yaml does", (text) => {
    const { data, errors } = parseFrontMatter(text);
    expect(errors).toEqual([]);
    expect(data).toEqual(YAML.parse(text) ?? {});
  });

  test.each([
    ["a:\n  b: 1", 2, "nested"],
    ["a:\n  - 1", 2, "nested"],
    ["- 1", 1, "block lists"],
    ["a: [1, [2]]", 1, "nested"],
    ["a: {b: 1}", 1, "needs quotes"],
    ["a: &anchor 1", 1, "needs quotes"],
    ["a: |", 1, "needs quotes"],
    ['a: "open', 1, "unclosed quote"],
    ["a: [1, 2", 1, "unclosed ["],
    ['a: "x" y', 1, "unexpected"],
    ["a: b: c", 1, "needs quotes"],
    ['a: "\\q"', 1, "unknown escape"],
    ["a: 1\na: 2", 2, "duplicate"],
    ["just words", 1, "key: value"],
  ])("reports %j on line %i", (text, line, message) => {
    const { errors } = parseFrontMatter(text);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(line);
    expect(errors[0].message).toContain(message);
  });

  test("keeps the good lines when one line has an error", () => {
    const { data, errors } = parseFrontMatter("ragam: Kedaram\nbad: {x: 1}\ntalam: Adi");
    expect(data).toEqual({ ragam: "Kedaram", talam: "Adi" });
    expect(errors.map((e) => e.line)).toEqual([2]);
  });

  test("reads every front matter in the docs the way yaml does", () => {
    const root = path.join(__dirname, "../../docs/content");
    const files: string[] = [];
    const walk = (dir: string) =>
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(html|md|sng)$/.test(e.name)) files.push(p);
      });
    walk(root);
    let seen = 0;
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:<notation[^>]*>|<code>)\s*---\n([\s\S]*?)\n\s*---/g)) {
        seen++;
        expect({ f, ...parseFrontMatter(m[1]) }).toEqual({ f, data: YAML.parse(m[1]) ?? {}, errors: [] });
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("Parser front matter errors", () => {
  test("a nested value is a parse error, and the other keys still apply", () => {
    const parser = new Parser();
    const notation = parser.parse('---\nragam: Kedaram\nbad:\n  x: 1\ncycle: "|4|"\n---\nSw: s r g m\n');
    expect(parser.metadata).toEqual({ ragam: "Kedaram", bad: null, cycle: "|4|" });
    expect(parser.errors).toHaveLength(1);
    expect(String(parser.errors[0].message)).toMatch(/front matter line 4: nested/);
    expect(notation).toBeTruthy();
  });
});
