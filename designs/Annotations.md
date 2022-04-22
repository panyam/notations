# [Annotations](https://github.com/panyam/notation/issues/xxx)

## Background 

Currently our layouts ensure that notes/atoms are laid out in a grid like layout.  Each grid cell contains a particular duration worth of notes.   This is great because it follows what the user intended (eg adi talam with laghu in one line and 2 dhrutams in the second line and repeat).

There are times however when we may need to have text "beyond" the grid or "in between" grid cells.  For example:

1. We might want to prefix a sangathi by its "number" - ie first sangathi, second sangathi etc.   The only way now is a bit cumbersome - ie using a new \line for each sangathi with a title and that is used by the renderer to add a new cell before the line's svg.   It is first of all heavy weight and also breaks the flow too much for the user.  Another disadvantage of this is that this line's label applies to all roles in a line instead of a particular role.
2. Postfix comments - At the end of the last sangathi of say a charanam, we might want to have a little comment denoting that Pallavi's first line needs to be sung by just "rolling" off at the end of the table - instead of starting a whole new row or line.  ie we want "adhoc/one-off" grid columns that show up after a particular row only.   This is also useful say for a swaram line to show the "starting bit" of a next line - eg in Brova Bharama to show the "first 6 notes" instead of starting a whole new row.
3. In-between notes - Sometimes say between cells in the same row we might want a simple annotation say "*" to break things up.  These dont have any time values but are just breakers of sorts.

## Requirements

1. Annotations must be per role and not per line.
2. Annotations can be specified anywhere (where they are rendered depends).
3. They be (for now) rendered before the current beat, or after the current beat (in the same row).  (How they are rendered "in between" beats is hard and so these can be silently ignored for now.
4. Annotations *may* have formatting syntax?

## Syntax

```
Annotation := "{STRING}>>" | "<<{STRING}"
```

or 

```
Annotation := ">>{STRING}" | "{STRING}<<"
```

First option has a "cleaner" syntax to denote "a string attaches to next or before" meaning.

### Annotations before a note:

Here annotation is denoted by "<<" (or can we also consider ">>" for uniformity) the value is the (possibly multi-line or raw literal) string "1." (without quotes):

```
"1."<< S r g m p d n s.
```

this attaches the annotation to appear "before" "S".

This can be rendered in different ways:

1. At the start of the same cell that "S" is in (thus pushing S out):

```
| 1. S r g m | p d | n s.  ||
```

2. In a cell/column "before" the "S", eg:

```
1.  | S r g m | p d | n s. ||
```

Note the size of the cell containing "S r g m" in each conguration

Option 2 here is preferrable because annotations are really special case and should not affect the length/layout within a cell.  So having a dedicated cell for this is desirable.  Similarly if/when we support annotations within a cell (eg between r and g) it can be treated as a "callout bubble" rather than adjusting the space within the "S r g m" cell.

### Annotations after a note:

Here annotation is denoted by ">>" the value is the (possibly multi-line or raw literal) string "1." (without quotes):

```
s r g m p d n s. >>"s. n d p p m"
```

Similar to the previous case we can have the s. n d p p m either in the same cell after the "s." or in a cell after the cell containing p d n s., eg:

```
| s r g m | p d | n s. s. n n d p m   ||  
```

or 

```
| s r g m | p d | n s. ||  s. n n d p m
```

Again the second option seems more desirable from a clean separation of concerns.

## Options

1. Can treat these as annotations which can be another type of Leaf (with 0 length) just like Rests.
2. Can have special annotation cells that are rendered just like beats (in special annotation BeatColumns) but these beat columns cannot contribute to time length (only visual widths)
