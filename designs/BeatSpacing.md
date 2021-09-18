
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
