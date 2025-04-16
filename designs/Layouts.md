# [Simpler Layouts](https://github.com/panyam/notation/issues/102)

## Background 

When creating a song there is no concept of layouts.  Only durations matter.  One entity responsible for controlling layouts are Cycles.

### Cycles: 

```
A grouping of bars of different durations over which atoms are split.   The Cycle on its own does not denote how lines
are to be split.  The cycle just tells what the groupings are.
```

For example Adi thalam can be described as:

```
\cycle("4", "2", "2")
```

This cycle contains 3 bars.  First bar contians 4 beats and the second and 3rd bar contains 2 beats each.  Given this one of the ways of laying out notes could be:

```
| , , , , | , , | , , ||
````

Another layout coud be:

```
| , , , , |
| , , | , , ||
```

or even:

```
| , , , , |
| , , |
| , , ||
```

If we have a song that is multiple cycles then we would need to have this configuration repeating like:


```
| , , , , |
| , , |
| , , ||
| , , , , |
| , , |
| , , ||
```

and so on.

## Requirements

1.  Given atoms in a song and cycles how can we ensure one of the above layouts are chosen deterministically.  Cycles do not control layout and layout do not affect the content in anyway.  Layouts are simply a way to organize a song visually.  For example a song in Rupaka thalam can also be rendered in thisra nadai eka thalam.  By not forcing a layout up front we can decopule the actual content with rendering and even allow features like changing layouts dynamically for the same song (very useful when demonstrating pallavis, varnams in multiple speeds etc).

2. Even if atoms are laid out with the right line breaks, how can we ensure alignment across lines.  For example if we have the following two lines of notes and syllables (note the differnet width of corresponding atoms in different lines):

```
Sw: A B C D E F G H I J K L M N O P Q R ST U V W X Y Z
Sh: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26
```

A naive layout of this would be:

```
| A B C D | E F | G H ||
| 1 2 3 4 | 5 6 | 7 8 ||

| I J K L | M N | O P ||
| 9 10 11 12 | 13 14 | 15 16 ||

| Q R S T | U V | W X ||
| 17 18 19 20 | 21 22 | 23 24 ||

| Y Z _ _ |
| 25 26 _ _ |
```

There are a few problems with the above layout.  What would be desirable is for each beat to align across all the lines, eg:


```
| A B C D     | E F     | G H ||
| 1 2 3 4     | 5 6     | 7 8 ||

| I J K L     | M N     | O P ||
| 9 10 11 12  | 13 14   | 15 16 ||

| Q R S T     | U V     | W X ||
| 17 18 19 20 | 21 22   | 23 24 ||

| Y Z _ _     |
| 25 26 _ _   |
```

3. We also want to be able to reset layouts so that we can force layouts to be applied to only a "some" lines.

Having alignment global means as the number of notes/lines increase layout can get slower.  Another problem is that fully global layouts means we can provide unnecessary alignments adjustment (say if one beat in one bar is too large.  

Here away to reset layouts (or saving and reloading) would be useful features.

4. Custom layout windows.

In the above layouts all lines begin at the start of a cycle.   It is useful to be able to start layout "before" the
begining of a cycle.  Examples of these are first and and second chittai swarams in the Bhairavi varnam `(m p g , r s .n
, ,)` and `(d , n n d d , n d d ...)`.

The Ata thala cycle would be:

```
\cycle(5,5,4)
```

With this feature our layout would look like (with aksharasPerBeat = 4):

```
| , , , ,       , , , ,     , , , ,     , , m p         ||  ( last bar in the cycle)

| g , , - r     , s - n ,   , .d , .p   .m , , - .p     .d , .n s |
| .n r , - .n   s r g m     g m , - n   n d d - n       n d d m   |
| m p m - m     , g r g     n n d d     , m - m ,       ||

| g r s - .n    s , r g     . . . .     . . . . 
````

## Proposal

There are changes required in a couple of areas:

### Declarations

#### Representing Cycles 

First is how are cycles defined.  Cycles are a list of bars and each bar is a list of beats with a beat length and repeat count (to represent kalais).  Cycles can be represented with:

```
\cycle(bar_value1, bar_value2, bar_value3 ...)
```

Each bar_valueN can be:

```
* N             - A bar with N beats (of duration and "current" count - taken from previous bars)
* "N"           - A SINGLE beat of duration N notes
* "N:m"         - A SINGLE beat of duration N notes and m count - this resets the duration to N and count to m for subsequent beats
* ":m"          - A single beat of "current" duration - set by previous entries
* ":" or ""     - Single beat with current duration and count

In all of the above examples - N can be a fraction!

Each beat entry can be preceeded by a "|" to denote the beat as being part of a new bar, eg:

* "|N"          - Starting of a new bear with with rest being same as above.
```

This way Adi thalam could be represented with:

```
\cycle(4, 2, 2)

or 

\cycle("|", "", "", "", "|", "", "|", "")

or 

\cyclest("|,,,|,|,")
```

For second kalai we could do (note kalai has to be set to 2 only once and it carries over):

```
\cycle("|:2", "", "", "", "|", "", "|", "")

or


\cyclest("|:2,,,|,|,")
```

How about Khanda mukhi?

```
\cycle("|5/4", "", "", "", "|", "", "|", "")

or

\cyclest("|5/4,,,|,|,")
```

How about Khanda mukhi Ata thalam but with 2,3,4th beats having a count of 2?

```
\cycle("|5/4", "1:2", "", "", "",
       "|5/4", "1:2", "", "", "",
       "|", "1:2", "|", "1:2")

\cyclest("|5/4,1:2,,|5/4,1:2,,|,1:2,1:2,|")
```

In all of the above cyclest is a "compact" version of the cycle command and bars are broken along pipe ("|") boundaries.   A bar with N beats would have N - 1 commas.

#### Representing Layouts

Cycles help define how many beats are required and how many notes are in each beat.  aksharasPerBeat is used to determine speed.  If a beat had N beats, then total number of notes in the beat is N * aksharasPerBeat.   This helps us pack more notes based on the speed.   The purpose of layout is define the boundaries where wrapping should occur.

By default a layout is same has the cycle - ie all beats in a cycle are laid out in a single line with each cycle appearing in a single line.

The breaks (line breaks) command allows us to change this, eg:

```
\breaks(12)
```

Layous out 12 beats in a row before starting a new row.  So for rupaka thalam with 6 beats we would be able to lay out 2 cycles in a single row.

To lay out Ata Thalam as 5, 5, 4 we could simply do:

```
\breaks(5, 5, 4)
```

#### Representing layout groups

The main things that define a layout are cycle, aksharasPerBeat and the breaks parameter.   Layouts can be saved or restored.  Any time we change one of the above parameters a new layout is started and future lines are created as part of the layout.  This allows us to also "restart" layouts like:

```
\breaks(3, 4, 5)
\aksharsPerBeat(5)
\cycle(1,2,3,4,5)
\aksharasPerBeat(4)

s r g m p ,

\layout()

p d n s n
```

Here 2 layouts are created - one for rendering the first set of notes "s r g m p ," (even though aksharasPerBeat were chagned twice layouts are only created when the first note is entered).

The second ```\layout()``` command ensures a new line with a new layout (with the same configs as first line).

Layouts can also be given names so we can reuse previous layouts.  If a named layout does not exist it is created.  eg:

```

\layout("l0")

<list of notes>

\layout("l1")

<more notes>

\layout("l0")

<and more notes>

```

#### Representing layout windows/offsets

Every time a layout is started (or set) we could perhaps do something like:

```
\layout(offset = Xlines)
```


offset could specify which line the layout should begin at - by default it begins at 0.  But is this really required?  Even if we say start at a line "before" the start of the cycle, where in the beat should this start and how should it be specified?

We have a couple of options here:

1. Use an offset command, eg:

```
\offset(-3) // (in notes)

s r g m p , 
```

This may be an overkill.   The layout engine can use the offset info to create a new line with the right offsets.  However this also looks over complicated.  

Firstly a custom command means this info is not captured until rendering time and has too much coupling between concerns.
Secondly how should a layout engine handle something like multiple offsets within a line?   It can be treated as "shift" the next note onwards by a certain offset.  But this is not required as we use spaces (silent or otherwise) to shift notes and really offsets are only realy required at a line level.

2. Put the offset in the line declaration, eg:

A new line will have to be started with:

```
\line(offset = -3)

s r g m p d n s.
```

Since this line begins 3 notes before the cycle's start, our layout (with breaks = 4) would look like (for adi tala):

| ,   s  |  r   g ||    // layout line beginign in previous line
| m   p     d   n |     // Start of layout line
| s. .   |  .   . ||

### Representation

Now that we have ways to represent the different features we are seeking, what are some of the implementation details to be considered?

The layout can simply start at the first line and keep filling beats as it finds them.  Layout engine uses a beat column to put all beats in a stack for a given offset.  Once all beats are added to a column the column is sized accordingly.  Initially each column in each line got their columns.  However the beat columns need to be created by offset and duration.


Consider the following cycle and layout:

```
// Adi thalam
\cycle(4, 2, 2)
\breaks(4)
```

This ensures that groups of 4 beats are shown in each line beats 1 and 5, 2 and 6, 3 and 7 and 4 and 8 are aligned (if line a contains more cycles then this alignment repeats).

For something a bit more complex say like ata thalam:

```
\cycle(5, 5, 2)
\breaks(5, 5, 4)
```

We are choosing to display 3 lines of 5, 5 and 4 beats respectively.  The problem is beats 1 to 5 (in first the laghu) and beats 6-10 (in the second laghu) wont be aligned as they are treated as two different beat lines.

So the alignment of a layout should be across a beat column as long as the column's offset (from the start of the row) and duration are equal.  This will ensure that not just beats 1/6, 2/7, 3/8, 4/9 and 5/10 are aligned but also 1/6/11, 2/7/12, 3/8/13, 4/9/14 ar also aligned.

What happens if we have an irregular beat duration in between that throws the alginemtn out of whack?  For examnple if we had khanda mukhi adi thalam:

```
\cycle("5/4,1,1,1|5/4,1|5/4,1")
\breaks(4)
```

Here though both layout rows have the same number of beats we are out of whack as third beat of first and second rows have different offsets.   So this row should be treated as part of a new beat column.

To allow this, we need to do the following when a new row is created:

1. Identify how many beats will be needed in the row along with their offsets and durations (from the start of the row)
2. If the offset+duration for this beat corresponds to an existing beat column add to it.
3. Otherwise create a new beat col for this offset+duration and use that.

The only complication here is instead of a list of beat columns, we might need a tree of them so that when the x/width of a single beat col is changed all the once after it must also be nudged/moved.

eg we had say the following:

```
\cycle("4,4,4,3|4,4,4,5|4,4,4,7|4,4,4,9")
\breaks(4)
```

What we want is the first 3 beats of each row to align - as they all have the same offset and duration.  Only the 4th column in each row will be independant (and have their own beat column) because they have different durations (3, 5, 7 and 9 respectively).

So here we have the following beat columns and their "next" column lists:

```
BC0 (1,5,9,13) -> BC1 (2,6,10,14) -> BC2 (3,7,11,15)  -> BC3 (4)
                                                     |-> BC4 (8)
                                                     |-> BC5 (12)
                                                     |-> BC6 (16)
```

Note that BC2 has 4 next column neighbors which would be affected when BC2's x or width changes.

Should this be a DAG instead of a tree?   Consider the following:

```
\cycle("4,3,9,4|4,5,7,4|4,7,5,4|4,9,3,4")
\breaks(4)
```

Here the first column would be aligned with 2nd and 3rd going out of whack.  But the 4th column in all rows have the same offset and duration.  If we dont have a DAG here then the risk here is that the we will create a lot more columns and also risk them not beign aligned.  So our DAG would look like:

```
BC0 (1,5,9,13) |-> BC1 (2)  --> BC5 (3)  ----> BC9 (4,8,12,16)
               |-> BC2 (6)  --> BC6 (7)  --|
               |-> BC3 (10) --> BC7 (11) --|
               |-> BC4 (14) --> BC8 (12) --|
```

A change in BC0's position would transitively affect all others after it.

TODO - Consider when a beat column is added to another beat column's next neighbour list?  This can be added as a beat is added and just in time?
