# Source Architecture

## Overview

The notations library provides a DSL parser, data model, and SVG renderer for Carnatic music notation.

## Layers

Each layer imports only the ones below it (#18):

1. **Runtime** (`notations/core`, `src/entry-core.ts`): the model, cycles, iterators, layouts and
   `GlobalBeatLayout`. No parser, no DOM, no grammar libraries.
2. **Parser** (`parser.ts`): builds the runtime model from the DSL. It declares
   `EmbellishmentParser` and takes one in `ParserOptions`; it imports nothing from `carnatic/`.
3. **Carnatic gamakas** (`carnatic/gamakas.ts`): the gamaka model and `carnaticGamakas`, which
   implements the parser's interface (a type-only import).
4. **Composition** (`loader.ts`): `load()` and `parse()` create a Parser with `carnaticGamakas`.
   `notations/parser` (`src/entry-parser.ts`) exports layers 2 to 4.
5. **Renderer** (`shapes.ts`, `beatview.ts`, the rest of `carnatic/`): the SVG views.
6. **Export** (`notations/export`, `src/entry-export.ts`, `export/`): printing, SVG and PNG. It uses the renderer and the browser, but not `web/`, so a page that renders notation can
   print it without the editor or the dock.

`src/tests/layers.spec.ts` walks the imports and fails if a lower layer reaches a higher one.

### Musical time, not clock time

notations is the compiler. It turns source into artifacts that hold still while a piece plays:
the model and its errors, the layout and its SVG, print and export. Planned are a timeline (each
note's offset and duration in beats, as exact fractions) and each atom's place in the source.
Times are in beats. Tempo in front matter is passed through as data and never used.

Anything on a clock lives in the apps that use notations. Thambura turns beats into seconds,
schedules the audio and plays the voices. The notation app drives a cursor that follows playback,
by calling the renderer's static mark API on each transport event. notations never imports them.
Thambura already imports notations to compile its patterns.

`layers.spec.ts` keeps `AudioContext`, `setTimeout`, `setInterval` and `requestAnimationFrame`
out of every module the runtime and the parser reach. The renderer and `web/` keep their UI timing
(the editor's debounce, the dock's first frame). Playback is tracked in #75.
Modules inside `src/` import from the module that defines a name, never from the package index.

## Core Modules

### Entity Hierarchy (`entity.ts`)
Base class for all notation entities with:
- Unique IDs (`uuid`)
- Parent references (`parent`, `setParent()`)
- Clone/copy support
- Debug value generation

Note: Child management is NOT in Entity. Each container type defines its own:
- `Block.blockItems` for blocks/lines/raw blocks
- `Line.roles` for roles
- `Group.atoms` for atoms

### Block System (`block.ts`)
Block-based scoping for hierarchical notation structure:

```
Block (base class)
├── blockItems: BlockItem[] (Block | Line | RawBlock)
├── localCycle, localAtomsPerBeat, localBreaks, localRoles
├── Property inheritance via parentBlock walking
└── children(): BlockItem[] (for layout iteration)

Block Subclasses:
├── SectionBlock - Prepends heading RawBlock to children
├── RepeatBlock - Returns children N times
├── CycleBlock - Sets localCycle
├── BeatDurationBlock - Sets localAtomsPerBeat
├── BreaksBlock - Sets localBreaks
├── RoleBlock - Creates local role definition
└── GroupBlock - Organizational grouping
```

Key types:
- `Block` - Base block class, subclassed for specific behaviors
- `RoleDef` - Role definition (name, notesOnly, index)
- `RawBlock` - Non-music content (markdown, metadata)
- `BlockItem` - Union type: Block | Line | RawBlock

**Block Subclasses Pattern**: Each block type is its own subclass that directly implements the behavior via `children()`. This eliminates indirection - Block subclasses ARE commands.

### Notation Model (`notation.ts`)
Root container that extends Block:
- Inherits `blockItems`, `localRoles`, `localCycle`, `localAtomsPerBeat`, `localBreaks` from Block
- Adds `metadata` - Key-value metadata for the notation
- Adds `layoutParams` management (named/unnamed layout params)
- Backward compatible aliases: `blocks`, `currentCycle`, `currentAPB`, `currentBreaks`

### Core Types (`core.ts`)
Musical elements:
- `Atom` - Base for timed entities (abstract)
- `LeafAtom` - Atoms that can't contain others
- `Note`, `Syllable`, `Literal`, `Space`, `Rest` - Leaf atoms
- `Group` - Container for atoms with duration control
- `Line` - Contains roles for one line of notation
- `Role` - Contains atoms for one voice/part
- `Marker` - Annotations before/after atoms

### Parser (`parser.ts`)
LALR parser using Galore parser generator:
- Tokenizes notation DSL
- Generates Command objects
- Applies commands to build Notation tree

Block syntax support:
- Grammar rules: `Command -> BSLASH_IDENT CommandParams ? OptBlock { newCommandWithBlock }`
- `OptBlock -> Block | { nullBlock }` - Optional block after command
- `Block -> BlockStart Elements CLOSE_BRACE { endBlock }` - Block with content
- `BlockStart -> OPEN_BRACE { beginBlock }` - Triggers block start

Key classes:
- `BlockCommand` - Creates appropriate Block subclass based on inner command type
- `BlockCommand.createBlock()` - Factory method that creates SectionBlock, RepeatBlock, etc.
- Semantic actions use `blockStartStack` to track nested block boundaries
- Commands inside blocks are collected and associated with the wrapping command

Errors: `parse()` and `load()` report every failure in the errors array and never throw (#69).
A rule handler must not throw, since anything but a `G.ParseError` escapes galore's loop.
`createCommand` returns null and records an error for an unknown command or rejected params.
Token handlers push a `TokenizerError` and return null to drop a token. They can also move
`tape.index`, as the `>` embed handler does to resume after a stray `>`.

Tokenizer gotcha: galore gives `%skip` rules priority 40 and `%token` rules 10, and priority
wins before match length. A token can't claim leading whitespace, so a `^`-anchored token never
matches an indented line. The `>` embed token checks its line start in its handler instead (#59).

### Commands (`commands.ts`)
Commands that modify the notation:
- `SetCycle`, `SetBeatDuration`, `SetBreaks` - Layout commands
- `CreateLine`, `CreateRole` - Structure commands
- `AddAtoms` - Content commands
- `Section`, `Repeat`, `ScopedGroup` - Block-only commands (configuration)
- All commands implement `applyToBlock(container: Block)` as the primary method
- `applyToNotation()` is deprecated and delegates to `applyToBlock()`
- Commands check their params in `validateParams()`, which the base `Command` constructor calls,
  and throw on bad ones. It runs before subclass field initializers, so it can't store results
  in fields. `SetCycle.cycle` parses the string again on each call for this reason.

### Layout Engine
- `beats.ts` - Beat, BeatColumn, BeatColDAG, GlobalBeatLayout
- `grids.ts` - GridModel, GridCell for visual layout
- `layouts.ts` - LayoutParams for cycle/beat configuration
- `GlobalBeatLayout.processBlock()` - Recursively processes blocks using `children()`

### Rendering (`carnatic/`)
SVG renderers for Carnatic notation:
- `NotationView.ts` - Main renderer
- `LineView.ts` - Line rendering
- `atomviews.ts` - Atom rendering
- `beatviews.ts` - Beat rendering
- `embelishments.ts` - Ornament rendering (`gamakas.ts` is the gamaka model, layer 3 above)

## Property Inheritance

Properties resolve by walking up the block tree:

```typescript
get cycle(): Cycle | null {
  return this.localCycle ?? this.parentBlock?.cycle ?? null;
}
```

This enables:
1. Block-scoped overrides
2. Lazy resolution (projectional editing friendly)
3. Backward compatibility with flat structure

## Design Decisions

1. **Notation extends Block** - Notation is the root Block of the hierarchy (`parent = null`). This unifies the model so the same methods work on any container.

2. **Block subclasses pattern** - Each block type (SectionBlock, RepeatBlock, etc.) is a subclass that directly implements behavior. No indirection through a `command` property.

3. **Property inheritance is lazy** - Properties resolve at access time by walking up the tree, not eagerly copied at parse time.

4. **Commands use applyToBlock** - All commands implement `applyToBlock(container: Block)` as the primary method. Since Notation extends Block, this works uniformly. Notation-specific behavior uses `instanceof` checks.

5. **RoleDef and RawBlock in block.ts** - Centralizes block-related types and avoids circular dependencies.

6. **Parser creates Block subclasses directly** - `BlockCommand.createBlock()` maps inner command types to appropriate Block subclasses.

7. **Layout engine uses processBlock** - `GlobalBeatLayout.processBlock()` recursively processes blocks using `children()`, enabling nested structures like `\repeat { }` to be properly expanded.

## Build & Bundle

### Dependencies
Minified sizes from webpack production bundles (#18):
- **galore** (92 KB) + **tlex** (56 KB) - Parser generator and lexer
- **@panyam/tsutils** (18 KB) - Utility library
- Front matter is read by `src/frontmatter.ts`, a flat `key: value` subset of YAML. The `yaml`
  package (102 KB) is a devDependency, kept only to check the subset against real YAML (#87).
- **@lume/kiwi** - Constraint solver for layouts

### Bundle Analysis
Run `webpack --mode=production --env analyze` to open interactive bundle visualization.

For `import { load }` from `notations/parser`, the bundle is 151 KB minified (42 KB gzipped), down
from 247 KB (71 KB) before #87. `notations/core` (runtime only) is 29 KB (8 KB). The grammar
libraries are most of the parse cost; the renderer is the smaller part.
