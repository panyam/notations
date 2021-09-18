
## Background

Users can type atoms (notes, spaces and spaces) with full freedom without having to align note durations with how lay out is done.  For example, the following explicit layout:

```
S , , ,   R , , ,   G , , ,  , , , , |
```

can also be achieved by any of the following:

```
S , ; R , ; G , ; ; ; 
```

or 

```
4 S 4 R 8 G
```

We want to provide some expectation that users dont have to think about how their notations will be laid out (atleast for reasonable inputs).

This only gets more complicated when a user mixes speeds, eg:

```
S [ R G ]   G [ M [ P D  ] ] 
```

to be rendered as:

```
              ___
    ___     _____
| S R G   G M P D
```


Here:
* S = 1/2
* R, G = 1/4 + 1/4
* G = 1/2
* M = 1/4
* P,D = 1/8 + 1/8

Same with rendered as double the number of slots per beat:

```
                _______
| S , R G   G , M , P D
```


Here:
* S = 1/4
* , = 1/4
* R, G = 1/4 + 1/4
* G = 1/4
* , = 1/4
* M = 1/8
* , = 1/8
* P,D = 1/8 + 1/8

Though the layout has changed (by changing beat layout param) the notation source is the same.   A buggy and naive representation would have been:

```
S R G G M P D
```

because all spaces have been omitted from the layout and hence all notes are treated with equal duration.

Similarly a correct but "unappealing/undesirable" rendering of the same could be:

```
S , , , R , G ,         G , , , , , , , M , , , P , D , 
```

where we make each note be appended by spaces so that each the duration of note (+ its spaces) is the lowest common multiple of all durations in the beat.  Currently we do this.

## Goals

Our intra-beat layout ignores two factors:

1. Need to minimize the number of spaces in a beat
2. To take advantage of number of "slots" a beat can have and thus the "grouping" bars over a group of notes.

In this proposal we will address both of these.
