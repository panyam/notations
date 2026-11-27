# Photo Transcribe: handoff notes

Shipped in #39 and live on the docs site. Read this before working on the photo transcriber;
it records what was built, why, and what is next.

## What it is

A docs-site demo (`/demos/playgrounds/photo-transcribe/`) and a CLI that turn photos of
Carnatic notation (printed books, handwritten notebooks) into Notations DSL using Claude.

It has run against the real API on the Kedaram rows of the Valachi Vachi notebook. Every swara
went in the right beat, in about 50 s and $0.10 to $0.13 per run. The unit tests use a mocked API.

## Files

| File | Role |
|---|---|
| `prompt.ts` | System prompt (frozen, prompt-cached), user prompt with known facts and snippet requests, repair prompt |
| `grid.ts` | The beat-grid JSON schema the model fills, `validateTranscription` (located errors), `toNotation` (DSL generation), `mergeNotation` (append a snippet) |
| `transcriber.ts` | Claude call (streaming, structured output, adaptive thinking, server-side fallback) and the repair loop |
| `notationChecks.ts` | Runs the real parser on generated DSL; alignment warnings |
| `pdfPages.ts` | Renders each page of an uploaded PDF to a PNG with pdf.js, loaded on demand. Each page then works like a photo |
| `entries.ts` | The transcription list: each entry's name, ragam, regions and last result, and the rules for when a result goes into the editor |
| `photoStore.ts` | IndexedDB store for the page: uploaded files (a PDF as the PDF), pages with rotation, transcription entries, and the editor text |
| `imageUtils.ts` | Browser image prep: rotate, crop (from full resolution), downscale to 2400 px, optional enhancement (flat-field + contrast) |
| `../playground/PhotoTranscribePlayground.ts` | The page: pages, song facts, API key, transcription entries with their region picker, editor/preview |
| `../../content/demos/playgrounds/photo-transcribe/index.html` | Page markup and styles |
| `../../scripts/transcribe-photos.ts` | CLI (`pnpm run transcribe:photos`) |
| `../../tests/photo/*.spec.ts` | Tests (run under the normal `pnpm test`) |

## Pipeline

1. Uploaded pages are sources. Each transcription entry names one part of the song, such as
   "Pallavi - Kedaram", and picks one or more regions from any pages ("Use whole photo" is an
   explicit choice). A part that runs onto the next page gets a region on each. Crops are cut
   from the full-resolution page before downscaling, so they keep detail. Each entry sets its own
   ragam, talam and swaras per beat, since a ragamalika or a later section can change all three;
   a new entry copies the talam and speed of the one above. Letter case and free-text hints are
   notebook-wide. A name other than "Section N" goes to the model as "only this part".
2. The model gets the image(s), known facts (ragam, talam, swaras per beat, letter case),
   free-text hints, optionally "only this part", and optionally the notation already in the
   editor as context.
3. It answers with a **beat grid**, not DSL: sections, then lines, then roles (Sw/Sh/...), then
   beats, where each beat must hold exactly `beatDuration` slots. Slots it supplied rather than
   read are marked with `*` (`*,` = unwritten karvai).
4. `validateTranscription` reports problems with locations ("Pallavi, line 2, Sw, beat 6 has 3
   slots, needs 4"); a user-given talam is enforced. Errors go back to the model, up to 2 rounds.
5. `toNotation` writes the DSL, drawing `|`/`||` from the tala, so roles and avartanams line up
   by construction. Filled-in beats and doubtful readings become `//` comments.
6. On the page, an entry's first result goes after the editor's content. `mergeNotation` adds the
   snippet and merges its metadata into the single front-matter block, because front matter may
   only open a document. An empty editor just takes the notation. A re-run keeps its result in
   the entry until you press Insert, since the editor may already hold the first result with
   hand fixes. Clear empties the editor for a new song.

## Decisions and why

- **Work survives a reload.** The page keeps uploads, the photo list and the editor text in
  IndexedDB (`photoStore.ts`). A PDF is stored once, as the PDF, and rendered again on load.
  "Forget files" removes the photos and keeps the editor text; Clear empties the editor. If a
  restore fails, the page stops saving for that visit, so a partial list never replaces the
  stored one.
- **Bring your own key, in the browser.** The docs site is static (GitHub Pages), so there is no
  server to hold a key. The key goes only to api.anthropic.com and is stored only if the user
  ticks "Remember". A proxy could be added later without touching `transcriber.ts` (it takes a client).
- **Grid instead of DSL from the model.** Real pages omit karvais and align sahitya by position.
  Making the model fill fixed-size beats forces it to place every unit, and lets code check it.
- **Letter case is swarasthana by default** (m = suddha, M = prati madhyamam; g/G; n/N). Learned
  from a real Navaragamalika varnam notebook (Kalyani `M`, Begada `m`, Shri `g`/`n`). "Capital =
  long note" is only used when the user says so.
- **Notebook layout:** a row can span both columns (laghu left, drutams right); letter clusters
  are phrasing, not beats; underline = faster run (a `[ ]` group); writer's marks above swaras
  take no time.
- **Region-first.** Whole pages are a lot of counting and give each swara few pixels.
- **No swara-level segmentation (for now).** Considered a TensorFlow.js detector like the weemaps
  scanner. Rejected for now: image tokens are under ~10% of cost (a section crop is about 1k
  tokens, about $0.004 on Opus 5.5; the reasoning and output cost about $0.05 to $0.30 per section),
  so pre-extracting boxes saves little, and a box list as text can cost more tokens than the image.
  Handwriting (touching letters, few-pixel octave dots, case that carries meaning, many scripts)
  needs labelled data we do not have, and beat assignment still needs the model.
  **Row-level** layout detection (classical: ink projection profiles, column divider) is worth
  doing; see next steps. Proofread sections (crop + verified DSL) are the future training set if a
  swara-level model is ever wanted.

## Running it

```bash
pnpm install
pnpm test docs/tests/photo          # photo tests only; `pnpm test` runs everything

# Docs site with the page
pnpm run build:docs
cd docs && NOTATIONS_DOCS_ENV=dev NOTATIONS_DOCS_PORT=:8085 go run .
# open http://localhost:8085/notations/demos/playgrounds/photo-transcribe/

# CLI (needs ANTHROPIC_API_KEY; PDFs need pdftoppm and pdfinfo from poppler)
pnpm run transcribe:photos notebook.pdf --page 1 --crop 0,0.048,0.96,0.183 \
  --only "Pallavi - Kedaram" --talam "|4|2|2|" --npb 4 --case swarasthana \
  --append song.sng --out out/
```

`--crop x,y,w,h` takes fractions of the page from the top left and cuts the region at 300 dpi,
the way the page's region picker does. Crop to a section rather than sending a whole page. A
whole page gets downscaled, and marks a few pixels wide, like octave dots, disappear.

The CLI writes `<name>.sng`, `<name>.grid.json` and `<name>.report.txt` (rounds, tokens,
filled-in units, lines to check). With `--append`, the file is sent as context and the new part is
added to it.

## Next steps

1. **Finish the Valachi Vachi notebook.** Navaragamalika varnam by Patnam Subramanya Iyer, Adi.
   It is the user's two-page handwritten PDF, not in the repo; ask for it. Go section by section with
   `--talam "|4|2|2|" --npb 4 --case swarasthana`, cropping both columns of a raga's rows.
   Add each failure as a test where a grid rule can express it. Ragas in order: Kedaram (done),
   Shankarabharanam, Kalyani, Begada, Kambhoji, Yadukula Kambhoji, Bilahari, Mohanam, Shri.
2. **Row and section suggestions in the region picker:** detect text rows by horizontal ink
   density, the column divider, and Sw/Sh row pairs; offer boxes to accept with one click.
3. **Side-by-side proofreading:** the crop next to the rendered beats, with filled-in slots
   highlighted (the grid already knows which slots were inferred).
4. **Cost controls:** the page and CLI show the estimated cost per run. Next, try Sonnet 5.5 and
   lower effort on clean sections, and the Batch API (50% off) for CLI bulk runs.

## Gotchas

- Do not run Prettier over all of `docs/components`; it reformats unrelated files. Format the
  photo files by path.
- Keep tests in `docs/tests/`, not beside components: the docs webpack build emits `.d.ts` files
  for `docs/components/**` into `docs/dist/`, and jest picks those up.
- `docs/templates/gen.*.html` are generated by `pnpm run build:docs` and committed; their hashes
  change on every build.
- `docs/tsconfig.json` uses `"module": "es2020"` so the on-demand `import("@anthropic-ai/sdk")`
  compiles.
- New dependencies go through the supply-chain checks in `pnpm-workspace.yaml`. The root
  `CLAUDE.md` says how to handle a failure.
- A `-` in the DSL takes no time (phrase separator); `_` is one unit of silence.

## Known misses

- **Octave dots the page doesn't show.** The notebook dots only some lower-octave notes. The
  model writes a dot it can see, and flags the doubtful ones in the report. At normal effort it
  sometimes adds a dot from the phrase shape and says so. Check the flagged beats.

## Effort: normal against careful

Two runs on the same Kedaram crop, after #52:

| Effort | Read the dot under `SNSR` | Time | Output tokens | Cost |
|---|---|---|---|---|
| high (normal) | yes | 79 s | 7,798 | $0.19 |
| xhigh (Careful reading) | yes | 212 s | 21,143 | $0.46 |

Careful reading cost 2.4 times as much and found nothing the normal run missed. Keep it for
pages where normal effort leaves grid errors after its repair rounds.
