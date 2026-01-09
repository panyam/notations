# Notation Layout Algorithm Analysis

## Overview

This document analyzes the layout algorithm in the notations library and identifies gaps, particularly around inter-beat alignment when embellishments are present.

## Layout System Architecture

The layout system is hierarchical and grid-based with the following key components:

```
Notation (Block)
└── Lines
    └── Roles (multiple voices/parts)
        └── Beats (time-based containers)
            └── Atoms (Notes, Spaces, Groups)
                └── Embellishments (decorations)
```

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

## Identified Gaps

### 1. Inter-Beat Alignment with Embellishments (HIGH PRIORITY)

**Problem**: When atoms have left-side embellishments (like Jaaru - ascending/descending slides), the note glyphs can become misaligned with notes in other beats at the same time position.

**Current Behavior**:

```
shapes.ts:656-660:
const glyphX = totalDur.isZero ? 0 : currTime.timesNum(groupWidth).divby(totalDur).floor;
// Subtract glyphOffset so left embellishments don't push the glyph past its time position
const xPos = Math.max(0, glyphX - av.glyphOffset);
av.setBounds(xPos, currY, null, null, true);
```

The system calculates `glyphOffset` (width of left embellishments) and subtracts it from the atom's origin position. However, this only works **within a single beat/group**.

**The Gap**: There is no mechanism to communicate embellishment widths **across beats in the same column**.

**Example Scenario**:
```
Beat 1 (Role 1): [Jaaru + S]  R   G
Beat 1 (Role 2): [S]          R   G
```

In Role 1, the Jaaru embellishment takes up space before "S". The current algorithm:
1. Calculates S's glyph should be at x=0 based on time
2. Subtracts glyphOffset, moving the atom origin to negative space
3. Uses `Math.max(0, xPos)` to clamp it back to 0

Result: The "S" in Role 1 may not align with the "S" in Role 2 because:
- Role 1's atom takes more horizontal space due to Jaaru
- Column width is calculated as `max(all cells' minSize.width)`
- But atoms within each beat are positioned independently

**Potential Solutions**:

1. **Sub-column alignment**: Create sub-column alignments within beat columns for glyph positions, not just atom positions
2. **Embellishment-aware width calculation**: Pass max `glyphOffset` from all cells in a column to each cell
3. **Two-pass layout**: First pass to collect embellishment widths, second pass to position glyphs

---

### 2. Missing Cross-Beat Embellishment Coordination

**Problem**: The `ColAlign` system only tracks cell widths, not internal structure like glyph positions.

**Current Code** (`grids.ts:662-671`):
```typescript
evalMaxLength(changedCells: GridCell[] = []): number {
  this._maxLength = 0;
  for (const cell of this.cells) {
    if (cell.value) {
      const cellView = this.getCellView(cell);
      this._maxLength = Math.max(cellView.minSize.width, this._maxLength);
    }
  }
  return this._maxLength;
}
```

This calculates the maximum **total width** but doesn't consider:
- Where the glyph starts within that width
- Alignment of glyphs at the same time position across cells

**Gap**: No mechanism exists to align internal elements (glyphs) across cells.

---

### 3. GroupView Duration-Based Layout Ignores Column Constraints

**Problem**: When `GroupView.refreshLayout()` positions atoms by duration ratio, it uses either `minSize.width` or the column width set via `setBounds()`. However, the column width doesn't account for different embellishment requirements across cells.

**Current Code** (`shapes.ts:646-661`):
```typescript
// Width source priority: column width (for global alignment) > minSize
const unscaledMinWidth = this.minSize.width / this.scaleFactor;
const groupWidth = this.hasWidth ? this.width / this.scaleFactor : unscaledMinWidth;

// Position each atom based on its time offset
let currTime = ZERO;
this.atomViews.forEach((av, index) => {
  const glyphX = totalDur.isZero ? 0 : currTime.timesNum(groupWidth).divby(totalDur).floor;
  const xPos = Math.max(0, glyphX - av.glyphOffset);
  av.setBounds(xPos, currY, null, null, true);
  // ...
});
```

**Gap**: The column width is a single value that gets distributed. If one cell has atoms with large embellishments and another doesn't, the atoms won't align by glyph position.

---

### 4. BeatView Doesn't Propagate Embellishment Information

**Problem**: `BeatView.refreshLayout()` propagates column width to `atomView` but doesn't communicate embellishment alignment requirements.

**Current Code** (`beatviews.ts:91-106`):
```typescript
refreshLayout(): void {
  // ...
  if (this.hasWidth && this.atomView) {
    this.atomView.setBounds(0, 0, this.width, null, false);
    this.atomView.refreshLayout();
  }
  // ...
}
```

**Gap**: No information about glyph alignment points is passed down.

---

### 5. Marker Columns Not Aligned with Beat Content

**Problem**: Pre-markers and post-markers have their own columns (`markerType: -1` and `markerType: 1`), but there's no coordination between marker width and beat content positioning.

**Current Code** (`beats.ts:549-597`):
```typescript
// pre marker goes on realCol - 1, post marker goes on realCol + 1
const realCol = 1 + layoutColumn * 3;
// Pre-markers added at realCol - 1
// Beat content at realCol
// Post-markers at realCol + 1
```

**Gap**: If a pre-marker in one role is very wide and another role has no marker, the beat content columns align, but the visual relationship between markers and beats may be inconsistent.

---

### 6. Left Embellishments Can Cause Negative Positioning

**Problem**: The `Math.max(0, glyphX - av.glyphOffset)` clamping can cause visual issues.

**Current Code** (`shapes.ts:660`):
```typescript
const xPos = Math.max(0, glyphX - av.glyphOffset);
```

**Gap**: If `glyphOffset` is large (many left embellishments), the atom gets pushed to x=0, but the expected time-based positioning is lost. The embellishment may overlap with the previous atom or extend outside the cell bounds.

---

### 7. No Vertical Alignment for Multi-Row Embellishments

**Problem**: Embellishments in top/bottom slots affect row height, but there's no coordination for vertical alignment of glyphs across roles.

**Current Code** (`atomviews.ts:117-133`):
```typescript
// top embelishments
const glyphX = textX + this.glyph.x;
const glyphY = this.glyph.y;
currY = glyphY - this.glyph.minSize.height + 5;
for (const emb of this.topSlot) {
  const bb = emb.minSize;
  emb.setBounds(glyphX + (gminSize.width - bb.width) / 2, currY - bb.height, null, null, true);
  currY = emb.y;
}
```

**Gap**: Each atom positions its embellishments independently. If Role 1 has octave indicators and Role 2 doesn't, the note glyphs may not be at the same Y position.

---

### 8. Jaaru Path Calculation Uses Atom Position, Not Column Position

**Problem**: The Jaaru embellishment draws a path based on the atom's position, but this doesn't account for column-level alignment.

**Current Code** (`embelishments.ts:316-330`):
```typescript
pathAttribute(x = 0): string {
  const avbbox = this.atomView.glyph.minSize;
  let y2 = 0;
  const h2 = avbbox.height / 2;
  const x2 = x + h2;
  let y = this.atomView.y;
  // ... path calculation
}
```

**Gap**: The path is calculated relative to the atom, but if atoms in different cells have different starting positions, the Jaaru visuals won't align.

---

## Recommendations

### Short-term Fixes

1. **Add `maxGlyphOffset` to ColAlign**: Track the maximum `glyphOffset` across all cells in a column and use it to offset all atoms uniformly.

2. **Two-pass atom positioning**: First pass computes desired glyph positions, second pass adjusts for column-wide alignment.

3. **Propagate glyph offset through BeatView**: Add a property to BeatView that communicates required glyph offset to atomView.

### Medium-term Improvements

1. **Sub-column structure**: Extend `BeatColumn` to track not just total width but also:
   - Left embellishment zone width
   - Glyph zone width
   - Right embellishment zone width

2. **Alignment points**: Add a concept of "alignment points" within atoms that can be coordinated across cells.

3. **Vertical baseline alignment**: Implement proper baseline alignment for glyphs across roles.

### Long-term Architecture

1. **Constraint-based layout**: The codebase has commented-out references to Kiwi (constraint solver). Implementing a constraint-based system would naturally handle cross-cell alignment:
   ```typescript
   constraint: cell1.glyphX == cell2.glyphX
   ```

2. **Layout zones**: Formalize the concept of zones within beats:
   ```
   [Pre-Zone | Left-Emb-Zone | Glyph-Zone | Right-Emb-Zone | Post-Zone]
   ```
   Each zone would have its own alignment tracking.

---

## Test Cases to Add

1. **Cross-role alignment with Jaaru**: Two roles where one has Jaaru embellishment on first note
2. **Multiple left embellishments**: Note with multiple left-side decorations
3. **Mixed embellishment scenarios**: One role with top embellishments, another with left embellishments
4. **Continuation markers with embellishments**: Extended duration notes that have embellishments

---

## Current Workaround Limitations

The current `glyphOffset` mechanism in `shapes.ts` is a partial solution but:
- Only works within a single GroupView
- Doesn't coordinate across BeatViews in the same column
- Uses clamping (`Math.max(0, ...)`) which loses precision
- Doesn't handle vertical alignment

---

## Related Code References

- `src/shapes.ts:368-376` - glyphOffset property definition
- `src/shapes.ts:656-660` - glyphOffset usage in positioning
- `src/carnatic/atomviews.ts:71-75` - glyphOffset calculation
- `src/carnatic/embelishments.ts:295-352` - Jaaru implementation
- `src/grids.ts:662-671` - Column width evaluation
- `src/beats.ts:549-597` - Beat to grid cell mapping
