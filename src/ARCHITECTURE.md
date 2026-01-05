# Source Architecture

## Overview

The notations library provides a DSL parser, data model, and SVG renderer for Carnatic music notation.

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

### Commands (`commands.ts`)
Commands that modify the notation:
- `SetCycle`, `SetBeatDuration`, `SetBreaks` - Layout commands
- `CreateLine`, `CreateRole` - Structure commands
- `AddAtoms` - Content commands
- `Section`, `Repeat`, `ScopedGroup` - Block-only commands (configuration)
- All commands implement `applyToBlock(container: Block)` as the primary method
- `applyToNotation()` is deprecated and delegates to `applyToBlock()`

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
- `embelishments.ts`, `gamakas.ts` - Ornament rendering

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
- **galore** + **tlex** - Parser generator and lexer (~220 KB bundled)
- **@panyam/tsutils** - Utility library (~30 KB bundled)
- **yaml** - YAML front-matter parsing (~50 KB bundled, replaced heavier gray-matter)
- **@lume/kiwi** - Constraint solver for layouts

### Bundle Analysis
Run `webpack --mode=production --env analyze` to open interactive bundle visualization.

The UMD bundle (`dist/notations.umd.min.js`) is ~261 KB minified. Main contributors:
- Parser infrastructure (galore, tlex): ~220 KB
- yaml package: ~50 KB
- Library code: ~15-20 KB
