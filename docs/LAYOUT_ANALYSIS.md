# Notation Layout Algorithm Analysis

## Overview

This document describes the layout algorithm for the notations library, focusing on collision-based intra-beat layout with embellishment support.

## Layout System Architecture

The layout system is hierarchical with two distinct layout levels:

```
┌─────────────────────────────────────────────────────────────────┐
│  INTER-BEAT LAYOUT (GridLayoutGroup / Constraint Solver)        │
│  - Beats are atomic units for alignment                         │
│  - BFS or constraint-based positioning of beat columns          │
│  - Multiple NotationViews can share a GridLayoutGroup           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INTRA-BEAT LAYOUT (Collision-based)                            │
│  - Time-based positioning with collision avoidance              │
│  - Pre-embellishments extend left from note position            │
│  - Notes pushed right if they would overlap previous note       │
│  - Beat minWidth includes all embellishment space               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decision

**We do NOT require same-timed notes in different beats (different rows, same column) to align.**

This simplification means:
- No cross-beat glyph coordination needed
- Each beat handles its own internal layout independently
- Beats are the atomic units for column alignment
- 90%+ of notation has no embellishments, so this handles the common case well

### Key Files

| File | Purpose |
|------|---------|
| `src/layouts.ts` | LayoutParams - beat organization, cycle, breaks |
| `src/beats.ts` | Beat, BeatsBuilder, BeatColumn, GlobalBeatLayout |
| `src/grids.ts` | GridModel, GridCell, ColAlign, RowAlign, GridLayoutGroup |
| `src/shapes.ts` | Shape, AtomView, GroupView, Embelishment bases |
| `src/carnatic/atomviews.ts` | LeafAtomView with embellishment slots |
| `src/carnatic/beatviews.ts` | BeatView with bar/tala lines |
| `src/carnatic/embelishments.ts` | Jaaru, Kampitham, OctaveIndicator, etc. |

---

## Intra-Beat Layout Algorithm

### Current Behavior (Time-Based with Clamping)

```typescript
// shapes.ts - GroupView.refreshLayout()
const glyphX = totalDur.isZero ? 0 : currTime.timesNum(groupWidth).divby(totalDur).floor;
const xPos = Math.max(0, glyphX - av.glyphOffset);
av.setBounds(xPos, currY, null, null, true);
```

**Problem**: The `Math.max(0, ...)` clamping loses precision when pre-embellishments are large. Notes get pushed to x=0 regardless of their intended time position.

### New Behavior (Collision-Based)

```typescript
// Pseudocode for collision-based layout
let prevNoteEndX = 0;

for each atom in beat:
    // 1. Calculate ideal position based on time
    noteX = (currTime / totalDuration) * beatWidth

    // 2. Pre-embellishments extend left from note position
    realX = noteX - preEmbellishmentWidth

    // 3. Collision check: push right if overlapping previous note
    if (realX < prevNoteEndX):
        realX = prevNoteEndX

    // 4. Position the atom
    atom.setBounds(realX, y, ...)

    // 5. Track end position for next collision check
    prevNoteEndX = realX + atom.totalWidth

    currTime += atom.duration
```

### Beat MinWidth Calculation

The beat's minimum width must account for all content:

```typescript
beatMinWidth = sum of all atoms' total widths
             = sum of (preEmbellishment.width + glyph.width + postEmbellishment.width)
```

This ensures the beat column is wide enough to contain all content without clipping.

---

## Inter-Beat Layout

Inter-beat layout uses the existing GridLayoutGroup / BFS system:

- **Beats are atomic units** - no internal structure exposed to grid
- **Column width** = max(all cells' minWidth in column)
- **Constraint solving** (optional) for beat positions/dimensions
- **Hierarchical views** - multiple NotationViews can share a GridLayoutGroup

This enables:
1. Virtual scrolling (only render visible sections)
2. Incremental editing (only re-render affected sections)
3. Coordinated alignment across views

---

## Implementation Plan

### Phase 1: Beat MinWidth with Embellishments

**Goal**: Ensure beat minWidth includes pre/post embellishment sizes.

**Files to modify**:
- `src/shapes.ts` - GroupView.minSize calculation
- `src/carnatic/atomviews.ts` - LeafAtomView.minSize calculation

**Changes**:
1. `LeafAtomView.minSize.width` should include `leftSlotWidth + glyphWidth + rightSlotWidth`
2. `GroupView.minSize.width` should sum all atomView widths (already does this via `evalMinSize`)
3. Verify `glyphOffset` is calculated correctly as `leftSlotWidth`

### Phase 2: Collision-Based Intra-Beat Layout

**Goal**: Replace clamping with collision-based positioning.

**Files to modify**:
- `src/shapes.ts` - GroupView.refreshLayout()

**Changes**:
1. Track `prevNoteEndX` as we iterate through atoms
2. Calculate `realX = glyphX - av.glyphOffset`
3. Collision check: `if (realX < prevNoteEndX) realX = prevNoteEndX`
4. Update `prevNoteEndX = realX + av.minSize.width` (or actual rendered width)

### Phase 3: Verify End-to-End

**Goal**: Ensure the full pipeline works correctly.

1. Beat minWidth flows up to GridCell
2. GridCell width flows to BeatView
3. BeatView width flows to GroupView (atomView)
4. GroupView positions atoms with collision avoidance

---

## Test Plan

### Unit Tests (`src/tests/layouts.spec.ts`)

#### 1. Beat MinWidth Calculation

```typescript
describe('Beat minWidth with embellishments', () => {
  it('should include pre-embellishment width in atom minSize', () => {
    // Create atom with left-side embellishment (e.g., Jaaru)
    // Verify atom.minSize.width = leftEmb.width + glyph.width
  });

  it('should include post-embellishment width in atom minSize', () => {
    // Create atom with right-side embellishment
    // Verify atom.minSize.width includes rightEmb.width
  });

  it('should sum all atom widths for group minSize', () => {
    // Create group with multiple atoms
    // Verify group.minSize.width = sum of atom minSizes
  });
});
```

#### 2. Collision-Based Positioning

```typescript
describe('Collision-based intra-beat layout', () => {
  it('should position notes by time when no collisions', () => {
    // Create beat with notes: S R G M (equal duration, no embellishments)
    // Verify each note at expected time-based position
    // noteX = (index / 4) * beatWidth
  });

  it('should push note right when pre-embellishment would overlap', () => {
    // Create beat: [Jaaru+S] R
    // S has large pre-embellishment
    // R's ideal position overlaps with S's actual end
    // Verify R is pushed right to avoid overlap
  });

  it('should handle multiple collisions cascading', () => {
    // Create beat: [Jaaru+S] [Jaaru+R] [Jaaru+G]
    // Each note has pre-embellishment causing cascade
    // Verify each note positioned after previous note's end
  });

  it('should not push notes when no collision', () => {
    // Create beat with wide spacing, small embellishments
    // Verify notes remain at time-based positions
  });
});
```

#### 3. Edge Cases

```typescript
describe('Edge cases', () => {
  it('should handle first note with pre-embellishment', () => {
    // First note has Jaaru - should start at x=0
    // Pre-embellishment extends into negative space (clipped or handled)
  });

  it('should handle notes with zero duration', () => {
    // Grace notes or ornaments with zero duration
    // Should not affect time-based positioning of subsequent notes
  });

  it('should handle single note in beat', () => {
    // Beat with only one note
    // Should be positioned at x=0
  });

  it('should handle empty beat', () => {
    // Beat with no notes (rest or space)
    // Should have appropriate minWidth
  });
});
```

### Integration Tests

#### 4. Full Rendering Tests

```typescript
describe('Full notation rendering with embellishments', () => {
  it('should render Jaaru without overlapping previous note', () => {
    // Parse: "S /ja R G M"
    // Render and verify S's Jaaru doesn't overlap with R
  });

  it('should render multiple embellished notes correctly', () => {
    // Parse: "/ja S /ja R /ja G"
    // Verify all notes visible, no overlapping
  });

  it('should maintain correct beat width with embellishments', () => {
    // Compare beat width with/without embellishments
    // Verify embellished beat is wider
  });
});
```

### Visual Regression Tests (Optional)

For complex layout scenarios, consider screenshot-based tests:
1. Capture baseline SVG output
2. Compare against known-good renderings
3. Flag visual differences for review

---

## Known Limitations

### Pathological Cases (User Error)

1. **Arbitrarily long notes**: Notes with extreme durations may cause unexpected layout. We treat this as user error.

2. **Too many embellishments**: Excessive embellishments on every note will cause beats to become very wide. This is acceptable behavior.

3. **Cross-beat glyph alignment**: Same-timed notes in different beats/rows won't align. This is a deliberate simplification.

### Future Enhancements

1. **Constraint-based inter-beat layout**: Use Kiwi solver for more sophisticated beat positioning.

2. **Vertical baseline alignment**: Coordinate glyph Y positions across roles.

3. **Sub-beat alignment zones**: For cases where cross-beat alignment is desired.

---

## Code References

- `src/shapes.ts:368-376` - glyphOffset property definition
- `src/shapes.ts:654-680` - GroupView.refreshLayout() (to be modified)
- `src/carnatic/atomviews.ts:71-75` - glyphOffset calculation
- `src/carnatic/atomviews.ts` - LeafAtomView.evalMinSize()
- `src/carnatic/embelishments.ts:295-352` - Jaaru implementation
- `src/grids.ts:662-671` - Column width evaluation
- `src/beats.ts:549-597` - Beat to grid cell mapping
