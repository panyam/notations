# Incremental Update Architecture

## Overview

This document outlines the architecture for incremental updates to the notation rendering pipeline. The goal is to enable efficient editing where changes to the model are reflected in the DOM with minimal re-rendering.

## Current State

### What Exists

1. **Model mutation methods**:
   - `Group.addAtoms()`, `Group.removeAtoms()`, `Group.insertAtomsAt()`
   - `Block.addBlockItem()`, `Block.removeBlockItem()`
   - `Role.addAtoms()`

2. **Grid-level events**:
   - `GridModel` extends `EventEmitter`
   - Emits `GridCellEvent.UPDATED`, `CLEARED`, `ADDED`
   - `GridLayoutGroup.applyModelEvents()` handles incremental layout

3. **Batch mode**:
   - `gridModel.eventHub?.startBatchMode()` / `commitBatch()`
   - Groups multiple cell changes into single layout pass

### What's Missing

1. **No change events on core model**: `Line`, `Role`, `Group`, `Atom` don't emit events
2. **No beat redistribution**: Adding atoms doesn't reflow across beat boundaries
3. **No view-model binding**: Views don't track which model elements they render
4. **Full re-render**: `NotationView.refreshLayout()` rebuilds entire DOM

## Proposed Architecture

### Layer 1: Model Change Events

Add change notification to core model entities:

```typescript
// core.ts
export class Group extends Atom {
  // Existing EventEmitter from TSU
  readonly changes = new TSU.Events.EventEmitter();

  addAtoms(adjustDuration = false, ...atoms: Atom[]): this {
    const oldAtoms = [...this.atoms.values()];
    // ... existing logic ...
    this.changes.emit('atomsChanged', {
      type: 'add',
      atoms: atoms,
      oldAtoms: oldAtoms,
      newAtoms: [...this.atoms.values()],
    });
    return this;
  }

  removeAtoms(adjustDuration = false, ...atoms: Atom[]): this {
    const oldAtoms = [...this.atoms.values()];
    // ... existing logic ...
    this.changes.emit('atomsChanged', {
      type: 'remove',
      atoms: atoms,
      oldAtoms: oldAtoms,
      newAtoms: [...this.atoms.values()],
    });
    return this;
  }
}

export class Role extends Entity {
  readonly changes = new TSU.Events.EventEmitter();

  addAtoms(...atoms: Atom[]): void {
    // ... existing logic ...
    this.changes.emit('atomsChanged', { type: 'add', atoms });
  }

  // New methods
  insertAtomsAt(index: number, ...atoms: Atom[]): void {
    // ... implementation ...
    this.changes.emit('atomsChanged', { type: 'insert', index, atoms });
  }

  removeAtoms(...atoms: Atom[]): void {
    // ... implementation ...
    this.changes.emit('atomsChanged', { type: 'remove', atoms });
  }
}

export class Line extends Entity {
  readonly changes = new TSU.Events.EventEmitter();

  // Emit when roles change
  ensureRole(roleName: string, defaultToNotes: boolean): Role {
    const existing = this.roles.find(r => r.name == roleName);
    if (existing) return existing;

    const role = new Role(this, roleName);
    // ... existing logic ...
    this.changes.emit('roleAdded', { role });
    return role;
  }
}
```

### Layer 2: Beat Redistribution (Tree Transformation)

When atoms are added/removed, beats may need to be recomputed:

```typescript
// beats.ts
export class IncrementalBeatsBuilder {
  private roleBeats: Beat[] = [];
  private beatsByOffset = new Map<string, Beat>();

  /**
   * Handle atoms being inserted into a role.
   * Returns the range of affected beats.
   */
  onAtomsInserted(
    role: Role,
    insertIndex: number,
    atoms: Atom[]
  ): AffectedRange {
    // 1. Find which beat contains the insertion point
    const [startBeat, offsetInBeat] = this.findBeatAt(insertIndex);

    // 2. Calculate total duration being inserted
    const insertedDuration = atoms.reduce((sum, a) => sum.plus(a.duration), ZERO);

    // 3. Determine affected beats
    //    - Current beat may overflow
    //    - Subsequent beats shift
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
  onAtomsRemoved(
    role: Role,
    removedAtoms: Atom[]
  ): AffectedRange {
    // 1. Find beats containing removed atoms
    const affectedBeatIndices = new Set<number>();
    for (const atom of removedAtoms) {
      const beat = this.findBeatContaining(atom);
      if (beat) affectedBeatIndices.add(beat.index);
    }

    // 2. Calculate duration removed
    const removedDuration = removedAtoms.reduce((sum, a) => sum.plus(a.duration), ZERO);

    // 3. Reflow: pull atoms from subsequent beats
    const startBeatIndex = Math.min(...affectedBeatIndices);
    const affectedBeats = this.reflowBeatsBackward(startBeatIndex, removedDuration);

    return {
      startBeatIndex,
      endBeatIndex: affectedBeats[affectedBeats.length - 1]?.index ?? startBeatIndex,
      beatsAdded: [],
      beatsModified: affectedBeats.filter(b => !b.isEmpty),
      beatsRemoved: affectedBeats.filter(b => b.isEmpty),
    };
  }

  /**
   * Reflow beats starting from a given beat.
   * Atoms overflow to next beats, potentially creating new beats.
   */
  private reflowBeats(startBeat: Beat, addedDuration: Fraction): Beat[] {
    const affected: Beat[] = [];
    let currentBeat = startBeat;
    let overflow = addedDuration;

    while (!overflow.isZero && currentBeat) {
      affected.push(currentBeat);

      // Check if current beat overflows
      const beatCapacity = currentBeat.duration.minus(currentBeat.atom?.duration ?? ZERO);
      if (overflow.isGT(beatCapacity)) {
        // Split atoms at beat boundary
        overflow = overflow.minus(beatCapacity);
        currentBeat = this.getOrCreateNextBeat(currentBeat);
      } else {
        overflow = ZERO;
      }
    }

    return affected;
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

### Layer 3: Grid Updates

Propagate beat changes to the grid:

```typescript
// beats.ts
export class GlobalBeatLayout {
  /**
   * Incrementally update the grid when beats change.
   */
  applyBeatChanges(
    line: Line,
    affectedRange: AffectedRange
  ): GridChangeSet {
    const gridModel = this.getGridModelForLine(line.uuid);
    const changes: GridChangeSet = {
      cellsAdded: [],
      cellsModified: [],
      cellsRemoved: [],
    };

    gridModel.eventHub?.startBatchMode();

    // Remove cells for removed beats
    for (const beat of affectedRange.beatsRemoved) {
      const cell = this.findCellForBeat(beat);
      if (cell) {
        gridModel.setValue(cell.rowIndex, cell.colIndex, null);
        changes.cellsRemoved.push(cell);
      }
    }

    // Update cells for modified beats
    for (const beat of affectedRange.beatsModified) {
      const cell = this.findCellForBeat(beat);
      if (cell) {
        // Cell value (beat) hasn't changed reference, but content has
        // Emit update event to trigger view refresh
        gridModel.eventHub?.emit(GridCellEvent.UPDATED, gridModel, {
          loc: cell.location,
          cell: cell,
          oldValue: beat,
        });
        changes.cellsModified.push(cell);
      }
    }

    // Add cells for new beats
    for (const beat of affectedRange.beatsAdded) {
      const cell = this.addBeat(beat, gridModel);
      changes.cellsAdded.push(cell);
    }

    gridModel.eventHub?.commitBatch();

    return changes;
  }
}

interface GridChangeSet {
  cellsAdded: GridCell[];
  cellsModified: GridCell[];
  cellsRemoved: GridCell[];
}
```

### Layer 4: View-Model Binding

Views track which model elements they render:

```typescript
// shapes.ts
export abstract class AtomView extends Shape {
  // Track which atom this view renders
  abstract readonly atom: Atom;

  // Listen for changes
  protected atomChangeHandler: () => void;

  bindToAtom(atom: Atom): void {
    if (this.atomChangeHandler) {
      // Unbind previous
      this.atom?.changes?.removeOn('changed', this.atomChangeHandler);
    }
    this.atomChangeHandler = () => this.onAtomChanged();
    atom.changes?.on('changed', this.atomChangeHandler);
  }

  protected onAtomChanged(): void {
    // Invalidate and refresh
    this.invalidateBounds();
    this.needsLayout = true;
  }

  dispose(): void {
    this.atom?.changes?.removeOn('changed', this.atomChangeHandler);
  }
}

// beatview.ts
export class BeatView extends ElementShape implements GridCellView {
  protected beatChangeHandler: () => void;

  constructor(cell: GridCell, beat: Beat, ...) {
    super(...);
    // Bind to beat's atom changes
    this.beatChangeHandler = () => this.onBeatContentChanged();
    beat.atom?.changes?.on('atomsChanged', this.beatChangeHandler);
  }

  protected onBeatContentChanged(): void {
    // Atom within beat changed - recreate atom view
    if (this.atomView) {
      this.atomView.dispose();
    }
    this.atomView = this.createAtomView();
    this.invalidateBounds();
  }
}
```

### Layer 5: DOM Reconciliation

Incremental DOM updates based on grid changes:

```typescript
// NotationView.ts
export class NotationView {
  private beatViews = new Map<number, BeatView>();

  constructor(...) {
    // Subscribe to layout changes
    this.layoutChangeUnsubscribe = this.beatLayout.gridLayoutGroup.onLayoutChange(
      (event) => this.onLayoutChange(event)
    );
  }

  /**
   * Handle incremental layout changes.
   */
  protected onLayoutChange(event: LayoutChangeEvent): void {
    // Only update affected regions
    if (event.affectedColRange) {
      this.updateColumns(event.affectedColRange.start, event.affectedColRange.end);
    }
    if (event.affectedRowRange) {
      this.updateRows(event.affectedRowRange.start, event.affectedRowRange.end);
    }
  }

  /**
   * Apply grid changes to the DOM.
   */
  applyGridChanges(changes: GridChangeSet): void {
    // Remove DOM elements for removed cells
    for (const cell of changes.cellsRemoved) {
      const beatView = this.beatViews.get(cell.value?.uuid);
      if (beatView) {
        beatView.element.remove();
        beatView.dispose();
        this.beatViews.delete(cell.value?.uuid);
      }
    }

    // Update existing views for modified cells
    for (const cell of changes.cellsModified) {
      const beatView = this.beatViews.get(cell.value?.uuid);
      if (beatView) {
        beatView.onBeatContentChanged();
        beatView.refreshLayout();
      }
    }

    // Create new views for added cells
    for (const cell of changes.cellsAdded) {
      const beatView = this.viewForBeat(cell);
      // DOM element already created by viewForBeat
    }
  }
}
```

### Layer 6: Coordination Layer

Tie everything together:

```typescript
// NotationController.ts (new file)
export class NotationController {
  private notation: Notation;
  private beatLayout: GlobalBeatLayout;
  private notationView: NotationView;
  private incrementalBuilder: IncrementalBeatsBuilder;

  constructor(
    notation: Notation,
    beatLayout: GlobalBeatLayout,
    notationView: NotationView
  ) {
    this.notation = notation;
    this.beatLayout = beatLayout;
    this.notationView = notationView;
    this.incrementalBuilder = new IncrementalBeatsBuilder(beatLayout);

    // Subscribe to model changes
    this.subscribeToChanges();
  }

  private subscribeToChanges(): void {
    // Walk the notation tree and subscribe to all change events
    this.subscribeToBlock(this.notation);
  }

  private subscribeToBlock(block: Block): void {
    for (const item of block.blockItems) {
      if (isLine(item)) {
        this.subscribeToLine(item as Line);
      } else if (isBlock(item)) {
        this.subscribeToBlock(item as Block);
      }
    }

    // Also subscribe to block's own changes (items added/removed)
    // block.changes.on('itemAdded', (item) => this.onBlockItemAdded(block, item));
  }

  private subscribeToLine(line: Line): void {
    for (const role of line.roles) {
      role.changes.on('atomsChanged', (event) => {
        this.onRoleAtomsChanged(line, role, event);
      });
    }

    line.changes.on('roleAdded', ({ role }) => {
      this.subscribeToRole(role);
    });
  }

  private onRoleAtomsChanged(
    line: Line,
    role: Role,
    event: AtomChangeEvent
  ): void {
    // 1. Compute affected beats
    let affectedRange: AffectedRange;
    if (event.type === 'add' || event.type === 'insert') {
      affectedRange = this.incrementalBuilder.onAtomsInserted(
        role,
        event.index ?? role.atoms.length,
        event.atoms
      );
    } else if (event.type === 'remove') {
      affectedRange = this.incrementalBuilder.onAtomsRemoved(role, event.atoms);
    }

    // 2. Update grid
    const gridChanges = this.beatLayout.applyBeatChanges(line, affectedRange);

    // 3. Update DOM
    this.notationView.applyGridChanges(gridChanges);
  }
}
```

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER ACTION                                   │
│                   (edit, add notes, etc.)                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MODEL MUTATION                                    │
│              Role.addAtoms(), Group.removeAtoms()                   │
│                           │                                          │
│                           ▼                                          │
│              changes.emit('atomsChanged', {...})                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 NOTATION CONTROLLER                                  │
│              (subscribes to model changes)                          │
│                           │                                          │
│                           ▼                                          │
│    ┌─────────────────────────────────────────────────┐              │
│    │        IncrementalBeatsBuilder                  │              │
│    │   - Compute affected beat range                 │              │
│    │   - Reflow atoms across beat boundaries         │              │
│    │   - Determine beats added/modified/removed      │              │
│    └──────────────────────┬──────────────────────────┘              │
│                           │                                          │
│                           ▼                                          │
│    ┌─────────────────────────────────────────────────┐              │
│    │        GlobalBeatLayout.applyBeatChanges()      │              │
│    │   - Update grid cells                           │              │
│    │   - Emit GridCellEvents                         │              │
│    └──────────────────────┬──────────────────────────┘              │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GRID LAYOUT GROUP                                 │
│              (receives GridCellEvents)                              │
│                           │                                          │
│                           ▼                                          │
│              applyModelEvents() → BFS layout                        │
│              → Only affected columns/rows                           │
│                           │                                          │
│                           ▼                                          │
│              onLayoutChange callback                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NOTATION VIEW                                     │
│              (receives layout change events)                        │
│                           │                                          │
│                           ▼                                          │
│    ┌─────────────────────────────────────────────────┐              │
│    │        applyGridChanges()                       │              │
│    │   - Remove DOM for removed cells                │              │
│    │   - Update DOM for modified cells               │              │
│    │   - Create DOM for added cells                  │              │
│    └──────────────────────┬──────────────────────────┘              │
│                           │                                          │
│                           ▼                                          │
│    ┌─────────────────────────────────────────────────┐              │
│    │        BeatView.refreshLayout()                 │              │
│    │   - Only for affected beats                     │              │
│    │   - SVG transform updates                       │              │
│    └─────────────────────────────────────────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Hierarchical Views Support

Multiple `NotationView` instances can share a `GridLayoutGroup`:

```typescript
const sharedLayout = new GridLayoutGroup();

// Verse section
const verseBeatLayout = new GlobalBeatLayout(sharedLayout);
const verseView = new NotationView(verseElement, {
  sharedGridLayoutGroup: sharedLayout
});
verseView.renderNotation(verseNotation, verseBeatLayout);

// Chorus section
const chorusBeatLayout = new GlobalBeatLayout(sharedLayout);
const chorusView = new NotationView(chorusElement, {
  sharedGridLayoutGroup: sharedLayout
});
chorusView.renderNotation(chorusNotation, chorusBeatLayout);

// Edit to verse only affects verseView's DOM
// But column widths stay coordinated via sharedLayout
```

This enables:
1. **Virtual scrolling**: Only render visible sections
2. **Incremental editing**: Only re-render affected section
3. **Coordinated alignment**: Shared column widths across views

## Constraint Solving Integration

For inter-beat alignment, constraints operate at the beat level:

```typescript
class GridLayoutGroup {
  private solver: kiwi.Solver;

  /**
   * Use constraints for beat positioning.
   * Atoms within beats use simple collision-based layout.
   */
  refreshLayout(): void {
    this.solver.reset();

    // Create variables for each beat column
    for (const col of this.startingCols) {
      const colStart = new kiwi.Variable();
      const colWidth = new kiwi.Variable();

      // Constraint: minimum width from cell requirements
      const minWidth = col.evalMaxLength();
      this.solver.addConstraint(gte(colWidth, minWidth, required));

      // Constraint: columns don't overlap
      if (col.prevLines.length > 0) {
        const prevCol = col.prevLines[0];
        this.solver.addConstraint(
          gte(colStart, prevCol.coordOffset + prevCol.maxLength, required)
        );
      }

      // Optimization: minimize total width
      this.solver.addConstraint(eq(colWidth, minWidth, weak));
    }

    this.solver.updateVariables();
    // Apply solved positions...
  }
}
```

## Implementation Priority

1. **Phase 1**: Model change events
   - Add EventEmitter to `Group`, `Role`, `Line`
   - Emit events from mutation methods

2. **Phase 2**: Beat redistribution
   - Create `IncrementalBeatsBuilder`
   - Implement reflow logic for add/remove

3. **Phase 3**: Grid updates
   - Add `GlobalBeatLayout.applyBeatChanges()`
   - Connect to existing GridCellEvent system

4. **Phase 4**: DOM reconciliation
   - Add `NotationView.applyGridChanges()`
   - Incremental DOM updates

5. **Phase 5**: Coordination
   - Create `NotationController`
   - Wire up the full pipeline

## Testing Strategy

1. **Unit tests**: Each layer independently
   - Model events emit correctly
   - Beat reflow calculates correct ranges
   - Grid updates produce correct changes

2. **Integration tests**: Full pipeline
   - Add 8 notes to beat 19 → verify correct DOM changes
   - Remove notes → verify beats collapse correctly

3. **Performance tests**:
   - Compare full re-render vs incremental
   - Measure with large notations (100+ beats)
