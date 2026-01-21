# Markers

## Background

Currently our layouts ensure that notes/atoms are laid out in a grid like layout. Each grid cell contains a particular duration worth of notes. This is great because it follows what the user intended (eg adi talam with laghu in one line and 2 dhrutams in the second line and repeat).

There are times however when we may need to have text "beyond" the grid or "in between" grid cells. For example:

1. We might want to prefix a sangathi by its "number" - ie first sangathi, second sangathi etc. The only way now is a bit cumbersome - ie using a new \line for each sangathi with a title and that is used by the renderer to add a new cell before the line's svg. It is first of all heavy weight and also breaks the flow too much for the user. Another disadvantage of this is that this line's label applies to all roles in a line instead of a particular role.
2. Postfix comments - At the end of the last sangathi of say a charanam, we might want to have a little comment denoting that Pallavi's first line needs to be sung by just "rolling" off at the end of the table - instead of starting a whole new row or line. ie we want "adhoc/one-off" grid columns that show up after a particular row only. This is also useful say for a swaram line to show the "starting bit" of a next line - eg in Brova Bharama to show the "first 6 notes" instead of starting a whole new row.
3. In-between notes - Sometimes say between cells in the same row we might want a simple marker say "*" to break things up. These dont have any time values but are just breakers of sorts.

## Requirements

1. Markers must be per role and not per line.
2. Markers can be specified anywhere (where they are rendered depends).
3. They be (for now) rendered before the current beat, or after the current beat (in the same row).
4. Markers *may* have formatting syntax (align, style, etc.)
5. Markers should be independent of the notes they appear near - they're conceptually "annotations at a point in time"

## Design Principles

Markers are **standalone atoms** that exist at a point in the timeline but do not participate in timing calculations. This means:

- Markers have a position in the atom stream (like notes)
- Markers have zero musical duration by default (though they can have a "span" for visual purposes)
- Markers do NOT advance the time cursor - the next note starts at the same offset
- Markers are renderer-agnostic - different renderers can interpret them differently

This model is cleaner than the old approach of "attaching" markers to atoms because:
1. The data model doesn't dictate HOW markers are displayed
2. Different renderers (beat layout, western notation, etc.) can handle markers differently
3. Markers can exist independently without needing an atom to attach to

## Syntax

The new marker syntax uses the `\@markerName(params)` pattern:

```
\@markerName(params...)
```

### Basic Examples

```
\@label("Variation 1") S R G M P D N S.
```

This creates a marker named "label" with the text "Variation 1" that appears before the note S.

### Marker Parameters

Markers support the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| (first positional) | string | - | The text/label of the marker |
| position | "before" \| "after" | "before" | Where to render relative to the beat |
| align | "left" \| "center" \| "right" | "left" | Text alignment within the column |
| style | "normal" \| "bold" \| "italic" | "normal" | Text style |

### Position Parameter

```
// Before the beat (default)
\@label("V1") S R G M

// After the beat
S R G M \@label("End", position="after")
```

### Multiple Markers

Markers can be chained:

```
\@label("A") \@label("B") S R G M
```

This renders as: `[A][B] S R G M`

### With Roles

Markers are per-role, not per-line:

```
Sw: \@label("Variation 1") S R G M P D N S.
Sh: S R G M P D N S.
Ta: S R G M P D N S.
```

Only the Sw role will have the "Variation 1" label; the other roles will have empty space in that column but will be properly aligned.

### Different Marker Types

While `@label` is the primary marker type for annotations, the system supports different marker names for different purposes:

```
\@label("V1")           // Text annotation
\@slide(duration=2)     // Slide marking spanning 2 beats (future)
\@crescendo(span=4)     // Dynamic marking (future)
```

The beat layout currently recognizes markers for rendering in pre/post columns. Future renderers may interpret different marker types differently.

## Rendering

### Beat Layout Rendering

In the beat layout, markers are rendered in dedicated columns:

```
[pre-marker column] | [beat column] | [post-marker column]
```

- Markers with `position="before"` appear in the pre-marker column
- Markers with `position="after"` appear in the post-marker column
- The column width is determined by the widest marker across all rows
- Rows without markers have empty space (but properly aligned)

### Example Layout

```
Input:
Sw: \@label("V1") S R G M
Sh: S R G M

Renders as:
      [V1]  | S | R | G | M |
            | S | R | G | M |
      ↑
      Pre-marker column (width determined by "V1")
      Sh row has empty space but aligned
```

## Migration from Old Syntax

The old marker syntax using `"text">>` and `<<"text"` has been **deprecated and removed**.

### Old Syntax (No longer supported)
```
"1.">> S R G M       // Pre-marker
S R G M <<"end"      // Post-marker
```

### New Syntax
```
\@label("1.") S R G M                    // Pre-marker
S R G M \@label("end", position="after") // Post-marker
```

## Implementation Notes

### Data Model

```typescript
class Marker extends LeafAtom {
  name: string;           // "label", "slide", etc.
  params: MarkerParam[];  // Same structure as command params

  // Markers don't participate in timing
  get participatesInTiming(): boolean { return false; }

  // Convenience accessors
  get text(): string;     // First positional param
  get position(): "before" | "after";
}
```

### Beat Processing

When building beats:
1. Markers are added to beats like any other atom
2. They don't consume duration (don't advance the time cursor)
3. Multiple atoms at the same offset are grouped together
4. Beat.preMarkers/postMarkers extract markers from the beat's content

### Future Considerations

- **Braces/Children**: Markers could support children in the future for things like sections:
  ```
  \@section("Pallavi") {
    S R G M P D N S.
  }
  ```
- **More marker types**: Different marker names for different rendering behaviors
- **Span/Duration**: Markers with non-zero duration for visual spans (e.g., slide lines)
