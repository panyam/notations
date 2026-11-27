#!/usr/bin/env node
// Guards the published ESM tree against the failure that motivated it: `import "notations"` from
// plain Node, no bundler in the way.  A bundler does its own resolution and will happily load a
// tree that Node refuses, so this has to run in a real Node ESM context to be worth anything.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ESM_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "lib", "esm");

function fail(message) {
  console.error(`check-esm: ${message}`);
  process.exit(1);
}

let marker;
try {
  marker = JSON.parse(readFileSync(join(ESM_DIR, "package.json"), "utf8"));
} catch {
  fail("lib/esm/package.json is missing, so Node classifies the tree by the root package.json");
}
if (marker.type !== "module") fail(`lib/esm/package.json declares type ${marker.type}, want module`);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

const bare = [];
for (const file of walk(ESM_DIR)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bfrom\s*["'](\.[^"']*)["']/g)) {
    if (!match[1].endsWith(".js")) bare.push(`${file}: ${match[1]}`);
  }
}
if (bare.length > 0) {
  console.error(`check-esm: ${bare.length} relative specifiers have no extension:`);
  for (const entry of bare) console.error(`  ${entry}`);
  process.exit(1);
}

const notations = await import(join(ESM_DIR, "index.js"));
const [notation, , errors] = notations.load(`\\cycle("|4|2|2|")\nmrid: tham , thi ,\n`);
if (errors.length > 0) fail(`load() reported ${errors.length} errors on valid input`);
if (notation == null) fail("load() returned no notation");

// The subpath entries: notations/parser parses on its own, gamakas included, and notations/core
// loads without the parser's grammar libraries.
const parserEntry = await import(join(ESM_DIR, "entry-parser.js"));
const [parsed, , parseErrors] = parserEntry.load(`\\cycle("|4|")\nSw: ~/ g m p d\n`);
if (parseErrors.length > 0) fail(`notations/parser load() reported ${parseErrors.length} errors on valid input`);
if (parsed == null) fail("notations/parser load() returned no notation");
const coreEntry = await import(join(ESM_DIR, "entry-core.js"));
if (typeof coreEntry.AtomIterator !== "function") fail("notations/core has no AtomIterator");
if ("Parser" in coreEntry) fail("notations/core exports Parser; the runtime shouldn't include the parser");
const exportEntry = await import(join(ESM_DIR, "entry-export.js"));
if (typeof exportEntry.printNotation !== "function") fail("notations/export has no printNotation");

console.log(`check-esm: ${ESM_DIR} imports and parses under Node ${process.version}`);
