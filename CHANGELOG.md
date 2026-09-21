# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 1.1.0 were tagged without notes and are not back-filled here.

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
