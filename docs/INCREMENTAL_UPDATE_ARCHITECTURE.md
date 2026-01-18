# Incremental Update Architecture

## Overview

This document outlines the architecture for incremental updates to the notation rendering pipeline. The goal is to enable efficient editing where changes to the model are reflected in the DOM with minimal re-rendering.

**Key capabilities:**
1. **Pipeline Phases** - The tree transformations from Model to View
2. **Cross-Phase Linking** - How nodes reference each other across phases
3. **Forward Propagation** - How changes flow Model → View
4. **Cursor System** - Single and multi-cursor management for user interaction

---

## Part 1: Pipeline Phases

The rendering pipeline has 4 main phases after parsing/AST building:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: MODEL                                                          │
│  Notation → Block → Line → Role → Atom (Group/LeafAtom)                 │
│                                                                          │
│  Input: Parsed AST                                                       │
│  Output: Hierarchical model with parent/sibling references               │
│  Key files: src/core.ts, src/block.ts                                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: BEAT SPLITTING                                                 │
│  Role atoms → WindowIterator → CycleIterator → Beats                    │
│                                                                          │
│  Input: Role.atoms + LayoutParams (cycle definition)                     │
│  Output: Beat[] with atoms split at beat boundaries                      │
│  Key files: src/beats.ts (BeatsBuilder, Beat, WindowIterator)            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: GRID LAYOUT                                                    │
│  Beats → GridModel → GridCell at (row, col)                             │
│                                                                          │
│  Input: Beats from all lines/roles                                       │
│  Output: 2D grid with beats positioned in cells                          │
│  Key files: src/grids.ts, src/beats.ts (GlobalBeatLayout, BeatColumn)    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: VIEW RENDERING                                                 │
│  GridCell → BeatView → AtomView → SVG elements                          │
│                                                                          │
│  Input: GridModel with positioned cells                                  │
│  Output: SVG DOM tree                                                    │
│  Key files: src/beatview.ts, src/shapes.ts, src/carnatic/NotationView.ts │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase Details

#### Phase 1: Model

The model hierarchy represents the musical content:

- **Notation** (extends Block) - Root container
- **Block** - Generic scoped container with children (Lines, nested Blocks)
- **Line** - Contains multiple roles, has offset and layoutParams
- **Role** - Contains atoms array, belongs to a Line
- **Atom** - Base class for all timed entities
  - **LeafAtom** - Space, Rest, Literal, Note, Syllable
  - **Group** - Container of atoms with duration multiplier

#### Phase 2: Beat Splitting

Atoms are split into beats based on the cycle (tala):

- **BeatsBuilder** - Orchestrates atom-to-beat conversion
- **WindowIterator** - Flattens nested atoms from Groups
- **CycleIterator** - Tracks position in the rhythmic cycle
- **Beat** - Represents one beat with duration, offset, and content

#### Phase 3: Grid Layout

Beats are organized into a 2D grid:

- **GlobalBeatLayout** - Orchestrator for entire layout
- **GridModel** - 2D grid of cells
- **GridCell** - Individual grid position
- **BeatColumn** - Column alignment for beats with same offset range
- **BeatColDAG** - Directed acyclic graph of beat columns

#### Phase 4: View Rendering

Grid cells are rendered as SVG:

- **NotationView** - Root view controller
- **LineView** - Container for one line's SVG
- **BeatView** - Visual beat representation
- **AtomView** / **GroupView** / **LeafAtomView** - Atom-specific views
- **Embelishment** - Visual decorations

---

## Part 2: Cross-Phase Linking

### Current State (One-Way Back References)

```
Model ←──── Beat ←──── GridCell ←──── View
  │           │           │            │
  │           │           │            └─ BeatView.beat → Beat
  │           │           │            └─ BeatView.cell → GridCell
  │           │           │            └─ AtomView references leafAtom
  │           │           │
  │           │           └─ GridCell.value → Beat
  │           │
  │           └─ Beat.atom → Atom
  │           └─ Beat.role → Role
  │
  └─ Atom.parentGroup → Group
  └─ Role.line → Line
```

**Current gaps:**
1. **Atom → Beat**: Atoms don't know which Beat(s) contain them
2. **Beat → GridCell**: Beats don't know which GridCell they're in
3. **Model → View**: No direct path from Atom to its rendered AtomView

### Proposed: Bidirectional Index Maps

To enable efficient navigation in both directions, we add index maps:

```typescript
// src/indexes.ts

/**
 * Maps atoms to beats containing them.
 * An atom may appear in multiple beats if split at beat boundary.
 */
class AtomBeatIndex {
  private atomToBeats = new Map<Atom, Beat[]>();
  private beatToAtoms = new Map<Beat, Atom[]>();

  // Maintained by BeatsBuilder during beat creation
  index(beat: Beat, atoms: Atom[]): void { ... }
  unindex(beat: Beat): void { ... }

  // Queries
  getBeatsForAtom(atom: Atom): Beat[] { ... }
  getAtomsInBeat(beat: Beat): Atom[] { ... }
}

/**
 * Maps beats to grid cells.
 */
class BeatGridIndex {
  private beatToCell = new Map<Beat, GridCell>();

  // Maintained by GlobalBeatLayout during grid construction
  index(beat: Beat, cell: GridCell): void { ... }
  unindex(beat: Beat): void { ... }

  getCellForBeat(beat: Beat): GridCell | undefined { ... }
}

/**
 * Maps model elements to their views.
 */
class ViewIndex {
  private cellToView = new Map<GridCell, BeatView>();
  private atomToView = new Map<Atom, AtomView>();

  // Maintained by NotationView during view creation
  index(cell: GridCell, view: BeatView): void { ... }
  indexAtomView(atom: Atom, view: AtomView): void { ... }
  unindex(cell: GridCell): void { ... }

  getViewForAtom(atom: Atom): AtomView | undefined { ... }
  getViewForCell(cell: GridCell): BeatView | undefined { ... }
}
```

### Combined Pipeline Index

```typescript
/**
 * Central registry for all pipeline indices.
 * Provides full bidirectional traversal.
 */
class PipelineIndex {
  readonly atomBeat = new AtomBeatIndex();
  readonly beatGrid = new BeatGridIndex();
  readonly view = new ViewIndex();

  // Full traversal: Atom → View
  getViewForAtom(atom: Atom): AtomView | undefined {
    const beats = this.atomBeat.getBeatsForAtom(atom);
    if (beats.length === 0) return undefined;
    const cell = this.beatGrid.getCellForBeat(beats[0]);
    if (!cell) return undefined;
    return this.view.getViewForAtom(atom);
  }

  // Full traversal: View → Atom
  getAtomFromView(view: AtomView): Atom | undefined {
    return (view as LeafAtomView).leafAtom;
  }
}
```

---

## Part 3: Cursor System

### 3.1 Single Cursor

```typescript
/**
 * Represents an editable position in the notation.
 */
interface NotationCursor {
  readonly id: string;  // Unique cursor ID

  // Position
  readonly atom: Atom;
  readonly container: Role | Group;
  readonly indexInContainer: number;

  // Navigation
  moveNext(): boolean;
  movePrev(): boolean;
  moveUp(): boolean;      // To parent group/role
  moveDown(): boolean;    // Into child group

  // Editing (triggers change events → incremental update)
  insertBefore(...atoms: Atom[]): void;
  insertAfter(...atoms: Atom[]): void;
  delete(): boolean;
  replace(newAtom: Atom): void;
}
```

### 3.2 Multi-Cursor Support

For advanced editing scenarios (like VS Code's multi-cursor):

```typescript
/**
 * Manages multiple cursors for multi-selection editing.
 */
class CursorManager {
  private cursors = new Map<string, NotationCursor>();
  private primaryCursorId: string | null = null;

  // Cursor creation
  createCursor(atom: Atom): NotationCursor { ... }
  createCursorAt(role: Role, index: number): NotationCursor { ... }

  // Multi-cursor operations
  addCursor(atom: Atom): NotationCursor {
    const cursor = this.createCursor(atom);
    this.cursors.set(cursor.id, cursor);
    return cursor;
  }

  removeCursor(cursorId: string): void {
    this.cursors.delete(cursorId);
  }

  // Primary cursor (for single-cursor operations)
  get primaryCursor(): NotationCursor | null { ... }
  setPrimaryCursor(cursorId: string): void { ... }

  // Iterate all cursors
  allCursors(): IterableIterator<NotationCursor> {
    return this.cursors.values();
  }

  // Batch operations on all cursors
  insertAtAll(...atoms: Atom[]): void {
    // Insert at each cursor position
    // Process in reverse document order to handle position shifts
    const sortedCursors = this.sortCursorsByPosition();
    for (const cursor of sortedCursors.reverse()) {
      cursor.insertAfter(...atoms.map(a => a.clone()));
    }
  }

  deleteAll(): void {
    const sortedCursors = this.sortCursorsByPosition();
    for (const cursor of sortedCursors.reverse()) {
      cursor.delete();
    }
  }
}
```

### 3.3 Selection (Range Cursor)

```typescript
/**
 * Represents a selection range (anchor + focus).
 */
interface NotationSelection {
  readonly anchor: NotationCursor;  // Where selection started
  readonly focus: NotationCursor;   // Where selection ends

  // Query
  isCollapsed(): boolean;  // anchor === focus
  getSelectedAtoms(): Atom[];
  getSelectedRange(): { start: NotationCursor; end: NotationCursor };

  // Expand/contract
  extendTo(atom: Atom): void;
  collapse(toAnchor?: boolean): void;

  // Operations on selection
  deleteSelection(): void;
  replaceSelection(...atoms: Atom[]): void;
  wrapSelection(groupType: 'Group'): void;  // Wrap in a group
}
```

### 3.4 Hit Testing (Click → Cursor)

```typescript
/**
 * Converts mouse events to cursors.
 */
class HitTester {
  constructor(
    private pipelineIndex: PipelineIndex,
    private cursorManager: CursorManager
  ) {}

  /**
   * Handle click to create/move cursor.
   */
  onClick(event: MouseEvent): NotationCursor | null {
    const atom = this.findAtomAtPoint(event);
    if (!atom) return null;

    if (event.metaKey || event.ctrlKey) {
      // Multi-cursor: add new cursor
      return this.cursorManager.addCursor(atom);
    } else {
      // Single cursor: move primary cursor
      const cursor = this.cursorManager.primaryCursor;
      if (cursor) {
        return this.cursorManager.moveCursorTo(cursor.id, atom);
      } else {
        const newCursor = this.cursorManager.addCursor(atom);
        this.cursorManager.setPrimaryCursor(newCursor.id);
        return newCursor;
      }
    }
  }

  /**
   * Handle drag to create selection.
   */
  onDrag(startEvent: MouseEvent, endEvent: MouseEvent): NotationSelection | null {
    const startAtom = this.findAtomAtPoint(startEvent);
    const endAtom = this.findAtomAtPoint(endEvent);
    if (!startAtom || !endAtom) return null;
    return this.cursorManager.createSelectionFromRange(startAtom, endAtom);
  }

  private findAtomAtPoint(event: MouseEvent): Atom | null {
    const target = event.target as SVGElement;
    // Walk up to find element with data-atom-uuid
    let current: Element | null = target;
    while (current) {
      const uuid = current.getAttribute('data-atom-uuid');
      if (uuid) {
        return this.findAtomByUuid(uuid);
      }
      current = current.parentElement;
    }
    return null;
  }
}
```

### 3.5 Cursor Visual Rendering

```typescript
/**
 * Renders cursor indicators in the SVG.
 */
class CursorView {
  private cursorElements = new Map<string, SVGElement>();

  showCursor(cursor: NotationCursor): void {
    const atomView = this.pipelineIndex.getViewForAtom(cursor.atom);
    if (!atomView) return;

    let element = this.cursorElements.get(cursor.id);
    if (!element) {
      element = this.createCursorElement(cursor.id);
      this.cursorElements.set(cursor.id, element);
    }

    // Position at atom
    const bbox = atomView.bbox;
    element.setAttribute('transform',
      `translate(${atomView.x + bbox.x + bbox.width}, ${atomView.y + bbox.y})`);
    element.style.display = 'block';
  }

  hideCursor(cursorId: string): void {
    const element = this.cursorElements.get(cursorId);
    if (element) element.style.display = 'none';
  }

  showSelection(selection: NotationSelection): void {
    for (const atom of selection.getSelectedAtoms()) {
      const view = this.pipelineIndex.getViewForAtom(atom);
      if (view) {
        view.element.classList.add('selected');
      }
    }
  }
}
```

---

## Part 4: Change Propagation

### Forward Flow (Edit → View Update)

```
cursor.insertAfter(note)
         │
         ▼
┌─────────────────────────────────────────┐
│ Role.insertAtomsAt() or                 │
│ Group.insertAtomsAt()                   │
│         │                               │
│         ▼                               │
│ Observer notification:                   │
│ onAtomsInserted(container, atoms, idx)  │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ NotationController.onModelChange()      │
│         │                               │
│         ▼                               │
│ IncrementalBeatsBuilder.reflow()        │
│  - Find affected beats                  │
│  - Split atoms at beat boundaries       │
│  - Create/modify/remove beats           │
│         │                               │
│         ▼                               │
│ Update AtomBeatIndex                    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ GlobalBeatLayout.applyBeatChanges()     │
│  - Update grid cells                    │
│  - Update BeatGridIndex                 │
│         │                               │
│         ▼                               │
│ Emit GridCellEvents                     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ NotationView.applyGridChanges()         │
│  - Remove views for removed cells       │
│  - Update views for modified cells      │
│  - Create views for new cells           │
│  - Update ViewIndex                     │
│         │                               │
│         ▼                               │
│ CursorView.updateCursorPositions()      │
└─────────────────────────────────────────┘
```

### Existing Event Infrastructure

The codebase already has observer interfaces in `src/events.ts`:

- **GroupObserver** - `onAtomsAdded`, `onAtomsInserted`, `onAtomsRemoved`
- **RoleObserver** - Same methods for Role
- **LineObserver** - `onRoleAdded`, `onRoleRemoved`
- **BlockObserver** - `onItemAdded`, `onItemRemoved`

These are implemented in `Group`, `Role`, `Line`, and `Block` classes with:
- `addObserver()` / `removeObserver()` methods
- `enableEvents()` / `disableEvents()` for performance control

### Incremental Beat Reflow

```typescript
class IncrementalBeatsBuilder {
  /**
   * Handle atoms being inserted into a role.
   */
  onAtomsInserted(role: Role, insertIndex: number, atoms: Atom[]): AffectedRange {
    // 1. Find which beat contains the insertion point
    const [startBeat, offsetInBeat] = this.findBeatAt(insertIndex);

    // 2. Calculate total duration being inserted
    const insertedDuration = atoms.reduce((sum, a) => sum.plus(a.duration), ZERO);

    // 3. Reflow: atoms overflow to subsequent beats
    const affectedBeats = this.reflowBeats(startBeat, insertedDuration);

    return {
      startBeatIndex: startBeat.index,
      endBeatIndex: affectedBeats[affectedBeats.length - 1].index,
      beatsAdded: affectedBeats.filter(b => b.isNew),
      beatsModified: affectedBeats.filter(b => !b.isNew),
      beatsRemoved: [],
    };
  }

  /**
   * Handle atoms being removed from a role.
   */
  onAtomsRemoved(role: Role, removedAtoms: Atom[]): AffectedRange {
    // 1. Find beats containing removed atoms
    // 2. Calculate duration removed
    // 3. Reflow backward: pull atoms from subsequent beats
    ...
  }
}

interface AffectedRange {
  startBeatIndex: number;
  endBeatIndex: number;
  beatsAdded: Beat[];
  beatsModified: Beat[];
  beatsRemoved: Beat[];
}
```

---

## Part 5: Implementation Phases

### Phase 1: Index Infrastructure
**New file**: `src/indexes.ts`
- `AtomBeatIndex` class
- `BeatGridIndex` class
- `ViewIndex` class
- `PipelineIndex` facade

### Phase 2: Cursor Core
**New file**: `src/cursor.ts`
- `NotationCursor` interface + implementation
- `CursorManager` class
- `NotationSelection` interface + implementation

### Phase 3: Hit Testing & Visual
**New file**: `src/cursor-view.ts`
- `HitTester` class
- `CursorView` class
- Add `data-atom-uuid` attributes to AtomViews

### Phase 4: Controller Integration
**New file**: `src/NotationController.ts`
- Subscribe to model observers
- Coordinate incremental updates
- Manage cursor lifecycle

### Phase 5: Incremental Beat Reflow
**Modify**: `src/beats.ts`
- `IncrementalBeatsBuilder` class
- `onAtomsInserted()`, `onAtomsRemoved()` methods
- Integration with `AtomBeatIndex`

### Phase 6: Incremental View Updates
**Modify**: `src/carnatic/NotationView.ts`
- `applyGridChanges()` method
- Integration with `ViewIndex`

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/indexes.ts` | Create | AtomBeatIndex, BeatGridIndex, ViewIndex, PipelineIndex |
| `src/cursor.ts` | Create | NotationCursor, CursorManager, NotationSelection |
| `src/cursor-view.ts` | Create | HitTester, CursorView |
| `src/NotationController.ts` | Create | Pipeline orchestration |
| `src/beats.ts` | Modify | IncrementalBeatsBuilder |
| `src/carnatic/NotationView.ts` | Modify | applyGridChanges, index integration |
| `src/carnatic/atomviews.ts` | Modify | Add data-atom-uuid attributes |
| `src/shapes.ts` | Modify | Ensure atom reference accessible |
| `styles/NotationView.scss` | Modify | Cursor and selection styles |

---

## Testing Strategy

### Unit Tests
- `indexes.spec.ts` - Index CRUD and queries
- `cursor.spec.ts` - Single cursor operations
- `cursor-multi.spec.ts` - Multi-cursor scenarios
- `selection.spec.ts` - Selection range operations
- `incremental-beats.spec.ts` - Beat reflow

### Integration Tests
- Click → cursor → insert → verify incremental update
- Multi-cursor insert → verify all positions updated
- Selection → delete → verify proper removal
- Nested group editing

### Visual Tests
- Add "cursor-editing" visual test case
- Test cursor positioning accuracy
- Test selection highlighting

---

## Verification

1. **Build**: `npm run build`
2. **Tests**: `npm test`
3. **Manual in playground**:
   - Click on note → cursor appears
   - Cmd/Ctrl+click → add additional cursors
   - Drag to select range
   - Type/keyboard → edits at all cursor positions
   - Verify incremental DOM updates (no full re-render)
