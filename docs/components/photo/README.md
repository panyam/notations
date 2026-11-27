# Photo Transcribe: handoff notes

Status as of the `ccr-ac4b95f8-gu595q` branch. Read this before working on the photo
transcriber; it records what was built, why, and what is next.

## What it is

A docs-site demo (`/demos/playgrounds/photo-transcribe/`) and a CLI that turn photos of
Carnatic notation (printed books, handwritten notebooks) into Notations DSL using Claude.

**It has never been run against the real API.** Everything below is tested with a mocked
API (unit tests plus Playwright runs against the docs server). The first job is a real run;
see "Next steps".

## Files

| File | Role |
|---|---|
| `prompt.ts` | System prompt (frozen, prompt-cached), user prompt with known facts and snippet requests, repair prompt |
| `grid.ts` | The beat-grid JSON schema the model fills, `validateTranscription` (located errors), `toNotation` (DSL generation), `mergeNotation` (append a snippet) |
| `transcriber.ts` | Claude call (streaming, structured output, adaptive thinking, server-side fallback) and the repair loop |
| `notationChecks.ts` | Runs the real parser on generated DSL; alignment warnings |
| `pdfPages.ts` | Renders each page of an uploaded PDF to a PNG with pdf.js, loaded on demand. Each page then works like a photo |
| `imageUtils.ts` | Browser image prep: rotate, crop (from full resolution), downscale to 2400 px, optional enhancement (flat-field + contrast) |
| `../playground/PhotoTranscribePlayground.ts` | The page: photos, region picker, known-facts fields, API key, editor/preview |
| `../../content/demos/playgrounds/photo-transcribe/index.html` | Page markup and styles |
| `../../scripts/transcribe-photos.ts` | CLI (`pnpm run transcribe:photos`) |
| `../../tests/photo/*.spec.ts` | Tests (run under the normal `pnpm test`) |

## Pipeline

1. The user picks a region on every photo (required; "Use whole photo" is an explicit choice).
   Crops are cut from the full-resolution photo before downscaling, so they keep detail.
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
6. On the page, every result goes after the editor's content. `mergeNotation` adds the snippet and
   merges its metadata into the single front-matter block, because front matter may only open a
   document. An empty editor just takes the notation. Clear empties the editor for a new song.

## Decisions and why

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

# CLI (needs ANTHROPIC_API_KEY; PDFs need pdftoppm from poppler)
pnpm run transcribe:photos page-1.jpg --only "Pallavi - Kedaram" \
  --talam "|4|2|2|" --npb 4 --case swarasthana --append song.sng --out out/
```

The CLI writes `<name>.sng`, `<name>.grid.json` and `<name>.report.txt` (rounds, tokens,
filled-in units, lines to check). With `--append`, the file is sent as context and the new part is
added to it.

## Next steps

1. **First real run.** Navaragamalika varnam "Valachi Vachi" (Patnam Subramanya Iyer, Adi), the
   user's two-page handwritten notebook PDF (not in the repo; ask for it). Start with just the
   Kedaram rows (top of page 1, both columns): `--talam "|4|2|2|" --npb 4 --case swarasthana`.
   Compare the `.sng` with the page; check the report's token counts. Tune `prompt.ts` from
   what goes wrong, and add each failure as a test where it can be expressed as a grid rule.
   Ragas in order: Kedaram, Shankarabharanam, Kalyani, Begada, Kambhoji, Yadukula Kambhoji,
   Bilahari, Mohanam, Shri.
2. **Row and section suggestions in the region picker:** detect text rows by horizontal ink
   density, the column divider, and Sw/Sh row pairs; offer boxes to accept with one click.
3. **Side-by-side proofreading:** the crop next to the rendered beats, with filled-in slots
   highlighted (the grid already knows which slots were inferred).
4. **Cost controls:** show cost per run on the page; try Sonnet 5.5 and lower effort on clean
   sections; Batch API (50% off) for CLI bulk runs.
5. Deploy the docs site once a real run looks good (`cd docs && make gh-pages`).

## Gotchas

- Do not run Prettier over all of `docs/components`; it reformats unrelated files. Format the
  photo files by path.
- Keep tests in `docs/tests/`, not beside components: the docs webpack build emits `.d.ts` files
  for `docs/components/**` into `docs/dist/`, and jest picks those up.
- `docs/templates/gen.*.html` are generated by `pnpm run build:docs` and committed; their hashes
  change on every build.
- `docs/tsconfig.json` uses `"module": "es2020"` so the on-demand `import("@anthropic-ai/sdk")`
  compiles.
- CI installs with pnpm 12 (`--frozen-lockfile`, minimum release age); check new dependencies
  with `npx pnpm@12 install --frozen-lockfile`.
- A `-` in the DSL takes no time (phrase separator); `_` is one unit of silence.

## Found along the way (not fixed)

- `\meta(...)` is not a parser command (it is commented out in `src/parser.ts`), yet 90 of the
  122 `.sng` files in `notation_demos` use it, so most of those files do not load as they are.
  Front matter is the supported way.
- The Playgrounds index and some API pages link to `/api/playgrounds/...` instead of
  `/demos/playgrounds/...`.
- The site header overflows horizontally at phone width on every page.
