
Can we represent the document -> rendering process as a tree transformation.  

Why?

* Easy to reason about
* A path towards incrementally updating a tree as we can map a change to the doc
  to the corresponding part in the view tree that needs an update
* Path towards visual editing - where a change to the view can now directly identify
  what the doc change should be


We want someting like:

```
render(line: Line, layoutParams) -> LineView
```

to representable in a declarative way.  Something like:

```
render(line: Line) -> 
  1. beatsForRoles = [breakIntoBeats(role.atoms) for role in line.roles]
  2. linesForBeats = map(beatsToLines, beatsForRoles)
  3. zippedLines = zip(linesForBeats)
  4. layoutBasedOn(breaks and beatLayout)
```

At (3) we have our atoms broken into beats, grouped into rows (based on breaks param) and then zipped by role

Note (4) is not required to do any forward/backward "referencing" between the line and all the views created.
The beatView additionally must have info about which line, which role and which "range" it is referring to.
Thankfully the offset and duration of the beat determine this and these can be used to "bisect" into the window
of atoms in the Line.

