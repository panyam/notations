/**
 * transcribe-photos.ts - The photo transcriber from the command line.
 *
 * Same pipeline as the Photo Transcribe page (prompt, beat grid, validation, correction
 * rounds, DSL generation), for running on files: handy for batches, and for tuning the prompt
 * against real pages.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx docs/scripts/transcribe-photos.ts \
 *     page-1.jpg page-2.jpg --talam "|4|2|2|" --npb 4 --case swarasthana \
 *     --ragams "Kedaram, Shankarabharanam, ..." --out out/
 *
 * Inputs are JPEG, PNG or WebP images in reading order, or a PDF (needs pdftoppm from
 * poppler on the PATH). Writes <out>/<name>.sng, <name>.grid.json and <name>.report.txt.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { mergeNotation, parseCycle } from "../components/photo/grid";
import type { KnownFacts } from "../components/photo/prompt";
import { formatCost } from "../components/photo/pricing";
import { transcribe, TranscribeImage } from "../components/photo/transcriber";

const USAGE = `usage: transcribe-photos.ts FILE... [options]

  FILE                 images (jpg, png, webp) in reading order, or a PDF
  --ragams TEXT        raga, or ragamalika ragas in order
  --talam CYCLE        e.g. "|4|2|2|" (Adi); enforced
  --npb N              swaras per beat in the normally written sections
  --case swarasthana|length
                       what letter case means (m vs M, or S = s ,)
  --hints TEXT         anything else about the page
  --only TEXT          transcribe only this part, e.g. "Charanam swaram 3"
  --append FILE.sng    follow on from this file: it is sent as context, and the
                       result is written back to it with the new part added
  --model ID           default claude-opus-5-5
  --careful            effort xhigh instead of high
  --repairs N          correction rounds (default 2)
  --out DIR            output directory (default .)
  --name NAME          output file name (default: first input's name)
`;

const MEDIA: Record<string, TranscribeImage["mediaType"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
/** The API's per-image limit is 5 MB of base64, about 3.7 MB of file. */
const MAX_FILE_BYTES = 3_600_000;

function parseArgs(argv: string[]) {
  const files: string[] = [];
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--careful") opts.careful = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a.startsWith("--")) {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      opts[a.slice(2)] = argv[++i];
    } else files.push(a);
  }
  return { files, opts };
}

/** Expands PDFs into page images and loads everything as base64. */
function loadImages(files: string[]): TranscribeImage[] {
  const images: TranscribeImage[] = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === ".pdf") {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transcribe-"));
      try {
        execFileSync("pdftoppm", ["-r", "200", "-jpeg", file, path.join(dir, "page")]);
      } catch {
        throw new Error(`Could not convert ${file}: install poppler (pdftoppm), or export the pages as images.`);
      }
      const pages = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".jpg"))
        .sort();
      images.push(...loadImages(pages.map((p) => path.join(dir, p))));
      continue;
    }
    const mediaType = MEDIA[ext];
    if (!mediaType) throw new Error(`${file}: use a JPEG, PNG, WebP or PDF file.`);
    const data = fs.readFileSync(file);
    if (data.length > MAX_FILE_BYTES) {
      throw new Error(
        `${file} is ${(data.length / 1e6).toFixed(1)} MB; shrink it below 3.6 MB (e.g. 2400 px on the long edge).`,
      );
    }
    images.push({ data: data.toString("base64"), mediaType });
  }
  return images;
}

async function main(): Promise<number> {
  const { files, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || files.length === 0) {
    process.stdout.write(USAGE);
    return opts.help ? 0 : 2;
  }
  const known: KnownFacts = {};
  if (opts.ragams) known.ragams = String(opts.ragams);
  if (opts.talam) {
    if (!parseCycle(String(opts.talam))) throw new Error(`--talam "${opts.talam}" should look like "|4|2|2|"`);
    known.cycle = String(opts.talam);
  }
  if (opts.npb) known.notesPerBeat = Number(opts.npb);
  if (opts.case) {
    if (opts.case !== "swarasthana" && opts.case !== "length") throw new Error("--case is swarasthana or length");
    known.letterCase = opts.case;
  }

  const images = loadImages(files);
  const appendTo = opts.append ? String(opts.append) : null;
  const existing = appendTo && fs.existsSync(appendTo) ? fs.readFileSync(appendTo, "utf8") : "";
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)
  const started = Date.now();
  process.stderr.write(`Transcribing ${images.length} page(s)...\n`);
  const result = await transcribe(client, {
    images,
    known,
    hints: opts.hints ? String(opts.hints) : "",
    snippet: { only: opts.only ? String(opts.only) : undefined, context: existing || undefined },
    model: opts.model ? String(opts.model) : undefined,
    effort: opts.careful ? "xhigh" : "high",
    maxRepairs: opts.repairs != null ? Number(opts.repairs) : 2,
    onStatus: (m) => process.stderr.write(`  ${m}\n`),
    // Thinking streams to stderr as it arrives, dimmed, so a long run is not silent.
    onThinking: (delta) => process.stderr.write(`\x1b[2m${delta}\x1b[0m`),
    onProgress: (p) => {
      if (p.kind === "started") {
        process.stderr.write(`  request: ${p.inputTokens} input tokens (${p.cacheReadTokens} from cache)\n`);
      } else if (p.kind === "finished") {
        process.stderr.write(
          `\n  reply: ${p.outputTokens} output tokens, estimated ${formatCost(p.costUsd)}, stop: ${p.stopReason}\n`,
        );
      }
    },
  });

  const outDir = String(opts.out || ".");
  const name = String(opts.name || path.basename(files[0], path.extname(files[0])));
  fs.mkdirSync(outDir, { recursive: true });
  const report = [
    `model: ${result.model}`,
    `rounds: ${result.attempts.length} (errors per round: ${result.attempts.map((a) => a.report.errors.length).join(", ")})`,
    `time: ${((Date.now() - started) / 1000).toFixed(0)} s`,
    `tokens: ${result.usage.inputTokens} in (${result.usage.cacheReadTokens} cached, ${result.usage.cacheWriteTokens} written to cache), ${result.usage.outputTokens} out`,
    `estimated cost: ${formatCost(result.costUsd)} (the Anthropic Console has the actual bill)`,
    `timing: ${result.transcription.timing}`,
    `filled-in units: ${result.report.inferredSlots}`,
    "",
    "still wrong:",
    ...[...result.report.errors, ...result.check.errors].map((e) => `  - ${e}`),
    "",
    "check against the photo:",
    ...result.report.checks.map((c) => `  - ${c}`),
    "",
    "model notes:",
    ...result.transcription.notes.map((n) => `  - ${n}`),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${name}.sng`), result.notation);
  if (appendTo) fs.writeFileSync(appendTo, mergeNotation(existing, result.transcription));
  fs.writeFileSync(path.join(outDir, `${name}.grid.json`), JSON.stringify(result.transcription, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, `${name}.report.txt`), report + "\n");
  process.stdout.write(report + "\n\n" + `Wrote ${path.join(outDir, name)}.{sng,grid.json,report.txt}\n`);
  if (appendTo) process.stdout.write(`Added this part to ${appendTo}\n`);
  return result.report.errors.length + result.check.errors.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${err?.message || err}\n`);
    process.exit(2);
  },
);
