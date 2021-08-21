## Rests in notations (8/20)

Currently our notation does not support Rests in its rendering.  Rests (hyphens) are read but silently ignore.
In carnatic music rests denote points of "breathers" and can signify impact otherwise rendition would occur
in simple beat boundaries.

eg the thre lines below of the same 8 notes:

```
s r g - m    p d n s.
s r g m    p d n s.
s r g m    p - d n s.
```

can sound very different when the position of the rest is taken into account.

Rests were hard to implement mainly because they were 0 length characters.  But these characters would still take space.
And technically rests are neither notes nor syllables (they are leafs).  So how can we handle them?

### Option 1 - Treat Rests as Leafs (with 0 length)

Pros:

* Easy extension for representation.
* Easy to render as a standalone atom (RestView).
* Editing semantics are easy - just another atom to deal with

Cons:
* Duration iterators may run into issues - ie after the given "duration" has elapsed we may have to specifically look for rests.  Also we dont know if rests that end at a beat boundary should be rendered in the current beat or the next one
* Aligning two different notes on different roles at the same offset can be hard because the rest may "nudge" one of the notes on a different role line.

### Option 2 - Add a flag to preceding notes

Pros:
* Fairly easy to represent
* During parse time a flag can be set on the "previous" not if an hyphen is encountered.
* Really easy to render and wont have any problems aligning notes at an offset across other roles in the same beat column.

Cons:
* Editing semantics is a bit more hacky - if/when we implement backspace - and a note with this flag set is deleted we will have to carry this flag to its predecessor and so on.
* In general this seems messy - why should a note know if it is before a rest or not?  On the other hand - the rest can be thought off as hint to "trail off" the previous note in effect.

### Parsing Concerns

Currently hyphens are parsed and skipped like spaces.  Both of the above options allow the parsign to continue with extra rules to be added around treating hyphens as Rest atoms instead of skipped tokens.  One option could be to add rest as a suffix for a Leaf rule but this has the problem that continuous hyphens in a row will result in a parse error.  But this is not such a bad thing given we are at early stages and can always add this back if needed instead of providing this all the time.  This will also mean a hyphen can only follow space, syllable or a note and cannot exist freely or as more than one.

### Choice

Given both options are reversible and wont have any impact on the syntax itself for now Option 2 will be selected.  If this has issues we can revert this another approach.


