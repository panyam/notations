
# BeatViews

See Layouts first to understand Beats and how beats are laid out in a "transposed" fashion.  Layout can be summarized as:

```
Line = Role[]
Role = Atom[]
```

Each Line is assigned one svg view for simplicity.   A Line can be thought of as a "run" of atoms and this can include multiple sangathis or variations.

Layout works as follows:

Each Atom list in a Role is grouped into Beats.  A Beat is window of a particular duration.  Lines also have LayoutParams that determine (among other things) how many beats are to be laid out in a single "row".  For example in Ata thalam one layout could be "5, 5, 4" indicating 3 rows with the first two rows containing 5 beats and the last containing 4 beats.

So if a Line contained 3 Roles (eg Swaram, Sahithyam, Descriptive Swaram), then  we would have the following model:

```
Line = Role1.Atoms, Role2.Atoms, Role3.Atoms
```

This is converted to beats:

```
Line = Role1.Beats, Role2.Beats, Role3.Beats
```

and our layout would "transpose" the beats in each role to look like:

```
R1B1 R1B2 R1B3 R1B4 R1B5
R2B1 R2B2 R2B3 R2B4 R2B5
R3B1 R3B2 R3B3 R3B4 R3B5

R1B6 R1B7 R1B8 R1B9 R1B10
R2B6 R2B7 R2B8 R2B9 R2B10
R3B6 R3B7 R3B8 R3B9 R3B10

R1B11 R1B12 R1B13 R1B14
R2B11 R2B12 R2B13 R2B14
R3B11 R3B12 R3B13 R3B14
```

This works for the most part.   This even has the advantage that we can align "cells" across lines so that the "4" beat row in two different rows can be aligned even if they are across in differnet LineViews.


There are a couple of challenges:

1. Beats are placed in columns in the assumption they cannot be moved (a full relayout is needed if a beat is added or moved etc).
2. The columns can only contain beats (eg R1B1).   We cannot have columns in between beat columns

## Proposal

Instead of a layout algorithm currently assigning beats to batch in a single pass (needing a full compilation every time an edit occurs), it is highly desirable to have an editable BeatGridView of sorts where layouts can be incrementally updated.   

We can gain a few benefits:

1. Beats can be added with a single API instead of requiring a "batch layout" calculation which is too fixed and is hard to keep track of.
2. We are separating the BeatCOlumn abstraction away from the Beats and making the idea of a column invisible to Beats (as it should be).
3. This would make way for the scenario of letter by letter incremental editing!

## API

class GridView {
  // Add another row of a given number of columns
  // Note that this does not create actual cell objects until a value is assigned (this ensures we can have sparse rows)
  addRow(numCols, insertAtIndex = -1): Row

  // Removes the row at a given index
  removeRow(r): void

  // Make the cth column in rth row be under the width constraint of the given column manager.
  setColumnManager(r, c, colManager): void

  // Sets N (values.length) number of values starting from cell r,c to r,c+N
  // nulls are allowed - which remove values from cells
  setValues(r, c, ...values): void

  // Deletes numToDelete values at r, c and inserts N (valuesToInsert.length) at r, c
  // nudging values (after deletion) to the right
  // nulls are also allowed which would clear values but still previous push values out to the right
  spliceValues(r, c, numToDelete, ...valuesToInsert): void
}

## Updates to LineView

With this our LineView could use GridView in the following way:

1. Create beats for roles
```
Line = Role1.Beats, Role2.Beats, Role3.Beats
```

2. Assign beats to specific cells

```
for r,role in line.roles:
  for b, beat in role.beats:  
    // how to find row and col here?
    // it is based on beat.beatIndex and r (above)
    grid.setBeat(row, col, beat)

```

This is all that should be needed.  Instead of our current layoutsBeatForLine does tings like height and width calculations and mixes too many concerns.
Instead a row and col manager should take careof the x/y/height/width the cells.  Instead we want grid.setBeat to kick off a relayout (or perhaps a batch relayout when needed).
