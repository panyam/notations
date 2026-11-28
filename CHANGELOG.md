# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 1.1.0 were tagged without notes and are not back-filled here.

## [Unreleased]

### Added

- Every parsed atom knows where it came from: `atom.sourceRange` is `[start, end)` in the whole
  source, front matter included. A converted literal, a clone or the rest of a note split across a
  beat points back to the parsed atom through `atom.origin`, and keeps its range. `atomAt(notation,
  offset)` finds the atom under a caret, and `walkAtoms` and `sourceAtom` go with it (#102).
- `NotationView.elementsFor(atom)` and `atomFor(element)` map between atoms and what's drawn, and
  `mark(atom, name)` / `unmark(name, atom?)` add a `mark-<name>` class for a host to show the note
  playing or under a caret. `mark-playing` and `mark-cursor` are styled, through
  `--notation-mark-playing-color` and `--notation-mark-cursor-color` (#102).
- `buildTimeline(notation)` in `notations/core` gives each note, syllable and rest its offset and
  duration in beats as exact fractions, with its role, line, tala position (cycle, bar, beat),
  octave and gamakas. Commas fold into the note they hold. Each line starts on a samam and takes
  whole cycles, as on the rendered page, and a pickup that overlaps sounding notes adds a warning.
  It runs no clock; a player such as thambura turns beats into seconds (#101).

### Changed

- Requires galore `^1.1.0`, for the source spans on parse tree nodes.

### Fixed

- A tokenizer error for an invalid gamaka or an old marker covered one character too many.
  tlex's `Token.end` is exclusive, and the length was computed as if it weren't (#102).

## [2.1.0] - 2026-11-27

Details and migration: [docs/releases/v2.1.0.md](docs/releases/v2.1.0.md).

### Added

- `notations/export`, a new entry point for getting rendered notation out of the page. It needs a
  browser and doesn't pull in `notations/web` (#74).
  - `printNotation(source)` opens the print dialog with the notation alone, and `preparePrint`
    sets up that print-only copy. Every line scales by one factor, so the widest line fills the
    page. "Save as PDF" in the dialog gives a PDF.
  - `exportSVG(source)` returns one standalone SVG in the light theme, with no `foreignObject`.
    Headings and front matter become SVG text, keeping bold and italic. `exportPNG` draws it at
    twice its size, and `downloadSVG` and `downloadPNG` save either as a file.
- `DockViewPlayground.print()`, `downloadSVG()` and `downloadPNG()`. A playground also prints the
  notation alone on Ctrl/Cmd+P. The side-by-side and photo playgrounds have Print / PDF, SVG and
  PNG buttons (#74).
- `NotationViewConfig.marginAlign`, and the `--notation-margin-align` CSS variable it sets, for
  margin labels: `left`, `center` or `right` (#97).

### Changed

- The margin column is only as wide as its longest label, and labels are right-aligned by
  default. It used to take a share of the table's spare width, so printed labels sat far from
  their notation (#97).
- Front matter is read by a small parser for flat `key: value` lines instead of the `yaml`
  package. Values can be quoted or plain strings, numbers, booleans, null, or a one-line list such
  as `[8, 8]`, and they read as YAML reads them. Nested values, `- item` lists and multi-line
  strings are now a parse error that names the line, where `yaml` used to accept them. A front
  matter error no longer throws out of the parser. `import { load }` from `notations/parser` drops
  from 247 KB to 151 KB minified, 71 KB to 42 KB gzipped (#87).
- The `@panyam/tsappkit-dock` peer range is now `^0.7.44`, up from `^0.7.40`. Older versions put a
  focusable close button inside each dock tab, and axe reports that as `nested-interactive`.
  0.7.44 renders the close icon with no role and no tabindex (#89, #90).

### Fixed

- One bad command no longer blanks the playground. `SideBySideEditor.render()` reports the errors
  through `onParseError`, then renders whatever parsed and calls `onNotationParsed`. It still
  returns false when there were errors (#94).

## [2.0.0] - 2026-11-27

Details and migration: [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md).

### Breaking

- `new Parser()` no longer knows any gamakas. The parser now depends on the runtime model only, and
  gamakas come in through `new Parser({ embellishments: carnaticGamakas })`. Without one, each `~`
  in the source is reported as a parse error that says to pass `embellishments` or use `load()`.
  `load()` and `parse()` pass `carnaticGamakas` and behave as before (#18).

### Added

- `notations/core` and `notations/parser` subpath exports (#18). `notations/core` is the runtime
  model with no parser and no renderer, about 8 KB gzipped. `notations/parser` is the DSL parser,
  `load()`, `parse()` and `carnaticGamakas`, without the renderer. `EmbellishmentParser` and
  `ParserOptions` describe how a Parser reads gamakas.

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
- Front matter can declare a document's defaults: `cycle`, `beatDuration` and `breaks` mean
  what the matching commands mean at the top of the body. A command in the body still
  overrides them, and a bad value is a parse error naming the key.
- Photo Transcribe CLI: `--page N` and `--crop x,y,w,h` cut one region of a PDF page at 300 dpi.
- Photo Transcribe page: uploaded pages are sources, and an ordered list of transcriptions
  picks regions from them. Each entry has its own name, ragam, talam, swaras per beat and
  Transcribe button, so one part can be Adi at 2 per beat and the next Misra Chapu at 3. A
  re-run waits for Insert instead of adding to the editor again.

- `DockViewPlayground`: a `consoleHeight` option sets the console's share of the default layout
  and of `showConsole()` (PR 63), and a `dock` property exposes the underlying dock (PR 58).
- `ParseError` is exported as a type, so callers can type what `parse()` and `load()` return
  (PR 67).

### Changed

- `DockViewPlayground` is built on `@panyam/tsappkit-dock` (PR 58). Its public API is unchanged.
  Peer dependencies are now `dockview-core >=4.13 <9` and `@panyam/tsappkit-dock ^0.7.40`, both
  optional. The layout saves under `${storageKey}-v${layoutVersion}`, so a layout saved by 1.x
  isn't restored. `isConsoleVisible()` asks the dock, so a console the reader closed stays closed
  after a reload.
- `NotationBlock`'s source and output boxes take keyboard focus and carry a label from the
  caption, so a keyboard can scroll them on a narrow screen. The `DockViewPlayground` console is a
  focusable `role="log"` (PR 67).
- `Utils.parseSyllable` follows the DSL's rule for underscores: a lone `_` is silence, and an
  underscore next to a letter or another underscore is part of the syllable, so `"S_N_D"` is one
  syllable (issue 33, PR 68).
- The parser no longer prints parsed front matter or skipped embellishments to the console
  (PR 54, PR 88).
- `NotationBlock.updatePreview()` and `applyEdit()` return a Promise. The output carries
  `aria-busy="true"` while a render is pending, and `block.rendering` is the latest render.
- `NotationBlock` no longer logs to the console on every render.
- A bar written without spaces reads whole numbers: `\cycle("10|4")` is bars of 10 and 4
  beats, not 1 and 4. A lone `"4:2"` or `"3/2"` in a bar is a beat spec, as in a spaced bar.
  Anything else in a bar, such as `"4x"`, is an error (#59).
- The old `"x">>` and `<<"x"` markers, and a `>` after other text on its line, are parse
  errors. The marker error names the `\@label(...)` replacement (#59).

### Fixed

- A lone `_` is one unit of silence instead of a visible literal, `|` and `||` in a line are
  accepted and ignored (the renderer draws bars from the cycle), and an unknown command is a
  ParseError instead of an exception (PR 32).
- `NotationBlock` built its markup from strings, so a notation source, `id` or `caption`
  containing HTML was parsed as HTML. It now builds the DOM directly and inserts those values
  as text (#30).
- `"1.">> s r g m` lost its notes without an error, because the `>` embed token matched
  mid-line (#59).
- A bad command param, such as `\cycle("|4x|")`, `\cycle()`, `\role()` or a bad front matter
  cycle, made `load()` throw. It is a ParseError naming the command, and `load()` no longer
  throws (#69).
- `Cycle` had no `toString`, so the source serializer wrote `\cycle("Entity(id = 19)")` (#59).

### Build

- npm publishing runs from release tags through GitHub Actions with trusted publishing, with no
  token (PR 35, PR 37). pnpm is 12, pinned by hash, with a minimum release age and trust checks
  for dependencies (PR 38).

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

[2.1.0]: https://github.com/panyam/notations/releases/tag/v2.1.0
[2.0.0]: https://github.com/panyam/notations/releases/tag/v2.0.0
[1.1.0]: https://github.com/panyam/notations/releases/tag/v1.1.0
