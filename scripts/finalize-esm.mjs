#!/usr/bin/env node
// tsc emits relative specifiers exactly as the sources write them, and the sources write them
// without extensions.  Node's ESM resolver needs the full specifier, so the emitted ESM tree is
// rewritten here rather than in src, which keeps the CJS build, jest and the two webpack configs
// on the resolution they already use.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIB = resolve(dirname(fileURLToPath(import.meta.url)), "..", "lib");
const ESM_DIR = join(LIB, "esm");
const CJS_DIR = join(LIB, "cjs");

const SPECIFIER_PATTERNS = [
  /(\bfrom\s*)(["'])(\.[^"']*)\2/g,
  /(\bimport\s*\(\s*)(["'])(\.[^"']*)\2/g,
  /(\bimport\s*)(["'])(\.[^"']*)\2/g,
];

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Only rewrite to something that was actually emitted.  A specifier that resolves to no file is
// reported rather than guessed at, since guessing would publish a tree that fails at import time.
function resolved(fromDir, specifier) {
  if (isFile(join(fromDir, specifier))) return specifier;
  const bare = specifier.replace(/\/+$/, "");
  if (isFile(join(fromDir, `${bare}.js`))) return `${bare}.js`;
  if (isFile(join(fromDir, bare, "index.js"))) return `${bare}/index.js`;
  return null;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

if (!existsSync(ESM_DIR)) {
  console.error(`finalize-esm: ${ESM_DIR} does not exist, run tsc first`);
  process.exit(1);
}

let rewritten = 0;
const unresolved = [];
for (const file of walk(ESM_DIR)) {
  const original = readFileSync(file, "utf8");
  let updated = original;
  for (const pattern of SPECIFIER_PATTERNS) {
    updated = updated.replace(pattern, (match, head, quote, specifier) => {
      const next = resolved(dirname(file), specifier);
      if (next === null) {
        unresolved.push(`${file}: ${specifier}`);
        return match;
      }
      if (next === specifier) return match;
      rewritten += 1;
      return `${head}${quote}${next}${quote}`;
    });
  }
  if (updated !== original) writeFileSync(file, updated);
}

// Without these markers Node classifies both trees by the root package.json, which declares no
// type.  The ESM half then loads only because Node 22 sniffs module syntax, and older runtimes
// fail on the first `export` instead.
writeFileSync(join(ESM_DIR, "package.json"), '{\n  "type": "module"\n}\n');
writeFileSync(join(CJS_DIR, "package.json"), '{\n  "type": "commonjs"\n}\n');

console.log(`finalize-esm: rewrote ${rewritten} relative specifiers in lib/esm`);
if (unresolved.length > 0) {
  console.error(`finalize-esm: ${unresolved.length} specifiers resolved to no emitted file:`);
  for (const entry of unresolved) console.error(`  ${entry}`);
  process.exit(1);
}
