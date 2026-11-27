# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 1.1.0 were tagged without notes and are not back-filled here.

## [Unreleased]

### Added

- Photo Transcribe demo on the docs site (`demos/playgrounds/photo-transcribe/`):
  take or upload photos of Carnatic notation and get editable Notations source
  back. Claude reads the photos with the visitor's own Anthropic API key, sent
  straight from the browser. Built for real, imperfect pages: the model fills a
  beat grid (every beat exactly `beatDuration` slots) instead of writing DSL,
  placing karvais the author left out from spacing and from how the sahitya
  sits under the swaras, and marking each one it supplied. The grid is checked
  beat by beat, located errors go back to the model for correction, and the DSL
  is generated from the grid with bars drawn from the tala, so roles and
  avartanams line up by construction. Filled-in beats and doubtful readings are
  left as comments for the proofreader. An optional enhancement flattens
  shadows and yellowed paper before upload. Optional fields for ragam(s),
  talam (enforced), swaras per beat and what letter case means. The prompt
  reads letter case as swarasthana (m / M) by default, reads two-column
  notebook rows across, and treats letter clusters as phrasing rather than
  beats. Long pages can be done a section at a time: crop a photo to one
  section (cropping keeps full-resolution detail), name the part to
  transcribe, and add each result after what is already in the editor, which
  goes to the model as context so later parts match earlier ones.
  `pnpm run transcribe:photos` runs the same pipeline on image or PDF files
  from the command line, with `--only` and `--append`. Docs site only; the published package is
  unchanged.
- Photo Transcribe shows an estimated cost for each reply and for the whole run, on the page
  and in the CLI's report. Each round is priced at the rates of the model that served it.
- `NotationBlock`: parse errors show in the output, in a `.notation-error` box with
  `role="alert"`, instead of only in the console. In edit mode, Ctrl+Enter (Cmd+Enter on a
  Mac) applies and Escape cancels.

### Changed

- `NotationBlock.updatePreview()` and `applyEdit()` return a Promise. The output carries
  `aria-busy="true"` while a render is pending, and `block.rendering` is the latest render.
- `NotationBlock` no longer logs to the console on every render.

### Fixed

- `NotationBlock` built its markup from strings, so a notation source, `id` or `caption`
  containing HTML was parsed as HTML. It now builds the DOM directly and inserts those values
  as text (#30).

## [1.1.0] - 2026-09-21

Full notes: [docs/releases/v1.1.0.md](docs/releases/v1.1.0.md)

### Added

- CI workflow running install, build, ESM check, lint and tests on Node 20, 22
  and 24, on every push to master and every pull request (issue 25, PR 24).
- `npm run check:esm`, which imports the built ESM entry from a real Node
  context and parses through it (PR 24).

### Fixed

- A failed `load()` no longer reports its error against every later `load()` in
  the same process (issue 22, PR 23).
- `//` line comments are skipped instead of lexing as a division slash
  (issue 21, PR 23).
- The ESM build resolves in Node. Emitted relative specifiers carry `.js` and
  both halves of `lib/` carry their own `type` marker, so `import "notations"`
  works without a bundler (issue 20, PR 24).

### Changed

- Dependency updates from dependabot (PR 15, PR 16).

[1.1.0]: https://github.com/panyam/notations/releases/tag/v1.1.0
