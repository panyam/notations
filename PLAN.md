# Block-Based DSL Redesign Plan

This document outlines the comprehensive plan for transitioning the notations DSL from a linear/imperative model to a block-based/hierarchical model.

## Goals

1. **Block-based scoping** - Commands with braces create scoped blocks; without braces apply at parent level
2. **Property inheritance** - Lazy resolution by walking up the tree (not eager copying)
3. **Backward compatibility** - Existing notation files continue to work
4. **Notebook/cell UI support** - Enable independent editing of blocks
5. **New primitives** - Support `\repeat()`, `\practice()`, `\section()` and future block constructs
6. **Block-scoped roles** - Roles visible only within their defining block

---

## Phase 1: DSL Syntax Changes

### 1.1 Universal Brace Syntax

All commands support optional braces for scoping:

```
# Without braces - applies statelessly at parent level
\cycle("|4|2|2|")
\role("Sw", "Swaram")

# With braces - creates scoped block
\cycle("|4|2|2|") {
  Sw: S R G M | P D N S.
}
```

### 1.2 Implicit Root Block

Documents have an implicit root block - no wrapper required for simple notation:

```
# Simple doc (implicit root)
\cycle("|8|")
Sw: S R G M P D N S.

# Explicit sections
\section("Pallavi") {
  \cycle("|4|4|")
  Sw: S R G M | P D N S.
}
```

### 1.3 New Block Constructs

```
\section("name") { ... }    # Named section (renders heading)
\repeat(count) { ... }      # Repeat content N times
\practice() { ... }         # Practice block (special rendering)
\group() { ... }            # Anonymous grouping
```

### 1.4 Block-Scoped Roles

Roles defined in a block are visible only within that block:

```
\section("Pallavi") {
  \role("Sw", "Swaram")     # Only visible in this section
  \role("Ta", "Talam")
  Sw: S R G M
  Ta: | . . . |
}

\section("Charanam") {
  \role("Sw", "Swaram")     # Different role instance
  \role("Sa", "Sahityam")   # New role for this section
  Sw: P D N S.
  Sa: pa da ni sa
}
```

### 1.5 Backward Compatibility Rules

| Syntax | Behavior |
|--------|----------|
| `\cycle("|8|")` (no braces) | Sets cycle at current block level (stateful) |
| `\cycle("|8|") { ... }` | Creates nested block with cycle scope |
| `\role("X", "Y")` (no braces) | Defines role at current block level |
| Lines without explicit block | Belong to implicit root block |

---

## Phase 2: Parser Modifications

### 2.1 Grammar Changes (`parser.ts`)

Current state: `OPEN_BRACE` and `CLOSE_BRACE` tokens exist (lines 45-46) but are unused.

**Required grammar additions:**

```
command_with_block:
  | command OPEN_BRACE block_contents CLOSE_BRACE
  | command  // existing behavior
  ;

block_contents:
  | block_item*
  ;

block_item:
  | command_with_block
  | line
  | raw_block
  ;
```

### 2.2 AST Node Types

Add new AST node for blocks:

```typescript
interface BlockNode {
  type: 'block';
  command: Command;           // The command creating this block
  children: BlockItem[];      // Lines, raw blocks, nested blocks
  parent?: BlockNode;         // For tree navigation
}

type BlockItem = BlockNode | Line | RawBlock;
```

### 2.3 Command Interface Changes

```typescript
abstract class Command {
  // Existing
  abstract applyToNotation(notation: Notation, ctx: ApplyContext): void;

  // New: indicate if command creates a block
  get createsBlock(): boolean { return false; }

  // New: apply to a specific block context
  abstract applyToBlock(block: BlockContainer, ctx: ApplyContext): void;
}
```

### 2.4 Files to Modify

| File | Changes |
|------|---------|
| `src/parser.ts` | Add grammar rules for blocks, update `createCommand()` |
| `src/commands.ts` | Add `applyToBlock()` to all commands, add block-creating commands |
| `src/lexer.ts` (if separate) | Verify OPEN_BRACE/CLOSE_BRACE token handling |

---

## Phase 3: Data Model Changes

### 3.1 BlockContainer Interface

```typescript
interface BlockContainer {
  readonly parent?: BlockContainer;
  readonly children: BlockItem[];

  // Local properties (only what's set directly on this block)
  readonly localCycle?: Cycle;
  readonly localAtomsPerBeat?: number;
  readonly localBreaks?: number[];
  readonly localRoles: Map<string, Role>;

  // Resolved properties (walks up tree)
  get cycle(): Cycle | undefined;
  get atomsPerBeat(): number;
  get breaks(): number[];
  getRole(id: string): Role | undefined;
}
```

### 3.2 Notation Class Updates (`notation.ts`)

```typescript
class Notation implements BlockContainer {
  // Change from flat array to tree
  readonly children: BlockItem[] = [];

  // Remove global state - use inheritance instead
  // DELETE: currentAPB, currentCycle, currentBreaks

  // Local properties
  localCycle?: Cycle;
  localAtomsPerBeat?: number;
  localBreaks?: number[];
  readonly localRoles = new Map<string, Role>();

  // Lazy resolution
  get cycle(): Cycle | undefined {
    return this.localCycle ?? this.parent?.cycle;
  }

  get atomsPerBeat(): number {
    return this.localAtomsPerBeat ?? this.parent?.atomsPerBeat ?? 1;
  }

  getRole(id: string): Role | undefined {
    return this.localRoles.get(id) ?? this.parent?.getRole(id);
  }
}
```

### 3.3 Entity Parent References (`core.ts`)

```typescript
abstract class Entity {
  protected _parent?: Entity;

  get parent(): Entity | undefined {
    return this._parent;
  }

  setParent(parent: Entity): void {
    this._parent = parent;
  }

  // Walk up to find containing block
  get containingBlock(): BlockContainer | undefined {
    let current: Entity | undefined = this;
    while (current) {
      if (isBlockContainer(current)) return current;
      current = current.parent;
    }
    return undefined;
  }
}
```

### 3.4 New Block Class

```typescript
class Block extends Entity implements BlockContainer {
  readonly command: Command;
  readonly children: BlockItem[] = [];
  readonly parent: BlockContainer;

  // Local properties
  localCycle?: Cycle;
  localAtomsPerBeat?: number;
  localBreaks?: number[];
  readonly localRoles = new Map<string, Role>();

  constructor(command: Command, parent: BlockContainer) {
    super();
    this.command = command;
    this.parent = parent;
  }

  // Inherited resolution
  get cycle(): Cycle | undefined {
    return this.localCycle ?? this.parent.cycle;
  }

  // ... other inherited properties
}
```

### 3.5 Files to Modify

| File | Changes |
|------|---------|
| `src/notation.ts` | Add BlockContainer implementation, remove global state |
| `src/core.ts` | Add parent references to Entity, add Block class |
| `src/entity.ts` | Update if Entity base is defined here |

---

## Phase 4: Layout Engine Updates

### 4.1 Recursive Block Processing (`beats.ts`)

```typescript
class GlobalBeatLayout {
  // Change from flat line processing to recursive block processing
  processBlock(block: BlockContainer): void {
    for (const item of block.children) {
      if (isBlock(item)) {
        this.processBlock(item);  // Recurse into nested blocks
      } else if (isLine(item)) {
        // Use block's resolved properties
        const cycle = item.containingBlock?.cycle;
        const apb = item.containingBlock?.atomsPerBeat ?? 1;
        this.addLine(item, cycle, apb);
      }
    }
  }
}
```

### 4.2 BeatColDAG Updates

The DAG should handle beats from nested blocks. Key consideration:
- Beats at the same depth level should align
- Nested blocks may have different cycles

```typescript
class BeatColDAG {
  // Add block context tracking
  addBeatsFromBlock(block: BlockContainer, beats: Beat[]): void {
    // Track which block each beat column belongs to
    // This enables block-level beat alignment
  }
}
```

### 4.3 LayoutParams Scope (`layouts.ts`)

```typescript
class LayoutParams {
  // Change from flat storage to block-aware lookup
  getForBlock(block: BlockContainer): ResolvedLayoutParams {
    return {
      cycle: block.cycle,
      beatDuration: block.atomsPerBeat,
      lineBreaks: block.breaks,
    };
  }
}
```

### 4.4 Files to Modify

| File | Changes |
|------|---------|
| `src/beats.ts` | Add recursive block processing |
| `src/grids.ts` | Update grid building for nested blocks |
| `src/layouts.ts` | Add block-aware parameter resolution |

---

## Phase 5: Rendering Updates

### 5.1 NotationView Changes

```typescript
class NotationView {
  renderNotation(notation: Notation, beatLayout: GlobalBeatLayout): void {
    this.renderBlock(notation, beatLayout);
  }

  private renderBlock(block: BlockContainer, beatLayout: GlobalBeatLayout): void {
    // Render block header if applicable (section name, etc.)
    if (block instanceof Block && block.command.type === 'section') {
      this.renderSectionHeader(block.command.name);
    }

    for (const item of block.children) {
      if (isBlock(item)) {
        this.renderBlock(item, beatLayout);
      } else if (isLine(item)) {
        this.renderLine(item, beatLayout);
      } else if (isRawBlock(item)) {
        this.renderRawBlock(item);
      }
    }
  }
}
```

### 5.2 Files to Modify

| File | Changes |
|------|---------|
| `src/Carnatic/NotationView.ts` | Add recursive block rendering |
| `src/Carnatic/LineView.ts` | Use block context for resolved properties |

---

## Phase 6: notation/web Project Updates

### 6.1 NotationViewer Component

Location: `/notation/web/views/components/NotationViewer.ts`

Minimal changes needed since it uses the high-level `N.load()` API:

```typescript
// Current (remains mostly unchanged)
const [notation, beatLayout, errors] = N.load(contents);
const view = new N.Carnatic.NotationView(container);
view.renderNotation(notation, beatLayout);
```

### 6.2 ComposerPage Component

Location: `/notation/web/views/components/ComposerPage.ts`

Updates for block-aware editing:

```typescript
class ComposerPage {
  // Add block-level error display
  displayErrors(errors: ParseError[]): void {
    for (const error of errors) {
      // Errors now include block path for context
      const blockPath = error.blockPath?.join(' > ') ?? 'root';
      this.showError(`${blockPath}: ${error.message}`);
    }
  }

  // Future: Block-level editing support
  // This enables notebook-style cell editing
}
```

### 6.3 Future: Notebook-Style Editor

Once blocks are implemented, notation/web can add:

```typescript
class NotebookEditor {
  blocks: EditableBlock[] = [];

  // Each block is independently editable
  editBlock(index: number, newSource: string): void {
    const block = this.blocks[index];
    block.updateSource(newSource);
    this.reparse();  // Incremental parse possible
  }

  // Add new block
  addBlock(type: 'section' | 'practice' | 'group'): void {
    // Insert new block template
  }
}
```

### 6.4 Files to Modify

| File | Changes |
|------|---------|
| `web/views/components/NotationViewer.ts` | Minor: handle new block structure |
| `web/views/components/ComposerPage.ts` | Add block-aware error display |
| `web/views/components/NotebookEditor.ts` | New: block-based editing (future) |

---

## Phase 7: Documentation Updates

### 7.1 Syntax Reference

Update `docs/content/tutorials/` with:
- Block syntax examples
- Scoping rules explanation
- New command reference (`\section`, `\repeat`, etc.)

### 7.2 Migration Guide

Create `docs/content/migration/` with:
- Upgrade path for existing notations
- Before/after examples
- Breaking changes (if any)

### 7.3 API Documentation

Update `docs/content/api/` with:
- New BlockContainer interface
- Changed Notation class API
- Rendering changes

---

## Phase 8: Migration Strategy

### 8.1 Backward Compatibility Verification

**Test matrix:**

| Pattern | Expected Behavior | Status |
|---------|-------------------|--------|
| `\cycle("|8|")` then lines | Cycle applies to following lines | Must work |
| Multiple `\cycle()` commands | Each applies to subsequent lines | Must work |
| `\role()` then use role | Role available for following lines | Must work |
| Mixed commands and lines | Commands apply at parent level | Must work |

### 8.2 Deprecation Path

1. **v2.0** - Add block syntax support (fully backward compatible)
2. **v2.1** - Add deprecation warnings for patterns that should use blocks
3. **v3.0** - (Optional) Remove deprecated patterns

### 8.3 Testing Strategy

1. **Unit tests** - Each command with/without braces
2. **Integration tests** - Complex nested blocks
3. **Regression tests** - All existing notation files must parse and render identically
4. **notation/web tests** - Viewer and composer work with new structure

---

## Implementation Order

### Sprint 1: Foundation
- [x] Add Block class to core.ts (moved to block.ts)
- [x] Add parent references to Entity
- [x] Implement BlockContainer interface

### Sprint 2: Parser
- [x] Update grammar with block rules
- [x] Modify createCommand() for block creation
- [x] Update Command interface with applyToBlock()

### Sprint 3: Commands
- [x] Update all existing commands for block support
- [x] Add \section() command
- [x] Add \group() command
- [x] Add \repeat() command

### Sprint 4: Layout Engine
- [x] Update GlobalBeatLayout for recursive processing
- [x] Modify BeatColDAG for block context
- [x] Update LayoutParams resolution (moved to Block class with proper scoping)

### Sprint 5: Rendering
- [x] Update NotationView for block rendering
- [x] Add section header rendering
- [x] Update LineView for block context

### Sprint 6: notation/web
- [ ] Update NotationViewer for new structure
- [ ] Update ComposerPage error handling
- [ ] Add basic block visualization

### Sprint 7: Documentation & Testing
- [ ] Update syntax documentation
- [ ] Write migration guide
- [ ] Create comprehensive test suite
- [ ] Verify all existing examples work

---

## Design Decisions (Clarified)

1. **Multi-cell embedding** - Cells (blocks) can be embedded in a page interspersed with HTML content (text, diagrams, tables, divs). Consecutive cells should be linkable for layout alignment continuity even when separated by non-notation content.

2. **Cross-block beat alignment** - Beats align based on settings at the siblings' parent level (current behavior). This means sibling blocks share their parent's layout context.

3. **Error recovery for braces** - Be strict: missing/unclosed braces should be flagged as errors. Users must fix them explicitly. No auto-correction or synthetic insertion.

## Design Decisions (Clarified) - Part 2

4. **Context-sensitive repeat** - The `\repeat` command behaves differently based on context:
   - **Inside a Line** → Flat-maps to atoms (produces music elements)
   - **At Block level** → Produces multiple lines/blocks

   Example:
   ```
   # Block-level repeat: produces 3 lines
   \repeat(3) {
     Sw: S R G M
   }

   # Line-level repeat: produces atoms within one line
   Sw: \repeat(3) { S R G M }  # expands to: S R G M S R G M S R G M
   ```

5. **Line as music-only container** - Lines can contain constructs that produce music (like inline \repeat), but not organizational blocks. Lines flat-map their children to produce the actual musical atoms.

## Resolved Questions

1. **Repeat rendering** - `\repeat(N) { ... }` produces literal repetition:
   ```
   \repeat(3) { Sw: A B C }
   # becomes: Sw: A B C Sw: A B C Sw: A B C
   ```

---

## Success Criteria

1. All existing notation files parse and render identically
2. New block syntax works as documented
3. Property inheritance resolves correctly via tree walk
4. notation/web displays blocks correctly
5. Documentation is complete and accurate
6. Test coverage > 90% for new code
