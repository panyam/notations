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
- `BlockContainer.blockItems` for blocks/lines/raw blocks
- `Line.roles` for roles
- `Group.atoms` for atoms

### Block System (`block.ts`)
Block-based scoping for hierarchical notation structure:

```
BlockContainer (interface)
├── Notation (root implementation)
└── Block (nested block implementation)
    ├── blockItems: BlockItem[] (Block | Line | RawBlock)
    ├── localCycle, localAtomsPerBeat, localBreaks, localRoles
    └── Property inheritance via parentBlock walking
```

Key types:
- `BlockContainer` - Interface for containers with scoped properties
- `Block` - Scoped block created by commands with braces
- `RoleDef` - Role definition (name, notesOnly, index)
- `RawBlock` - Non-music content (markdown, metadata)
- `BlockItem` - Union type: Block | Line | RawBlock

### Notation Model (`notation.ts`)
Root container implementing BlockContainer:
- `blockItems` - Child blocks, lines, raw blocks
- `localRoles` - Role definitions
- `localCycle`, `localAtomsPerBeat`, `localBreaks` - Layout properties
- `metadata` - Key-value metadata
- Backward compatible: `blocks`, `currentCycle`, `currentAPB`, `currentBreaks`

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

### Commands (`commands.ts`)
Commands that modify the notation:
- `SetCycle`, `SetBeatDuration`, `SetBreaks` - Layout commands
- `CreateLine`, `CreateRole` - Structure commands
- `AddAtoms` - Content commands
- Each has `applyToNotation()` and `applyToBlock()` methods

### Layout Engine
- `beats.ts` - Beat, BeatColumn, BeatColDAG, GlobalBeatLayout
- `grids.ts` - GridModel, GridCell for visual layout
- `layouts.ts` - LayoutParams for cycle/beat configuration

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

1. **BlockContainer uses `blockItems`/`parentBlock`** instead of `children`/`parent` to avoid conflicts with Entity's generic parent reference.

2. **Property inheritance is lazy** - Properties resolve at access time by walking up the tree, not eagerly copied at parse time.

3. **Commands have dual apply methods** - `applyToNotation()` for backward compatibility, `applyToBlock()` for block-scoped behavior.

4. **RoleDef and RawBlock moved to block.ts** - Centralizes block-related types and avoids circular dependencies.
