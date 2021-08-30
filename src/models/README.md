
Option 1 - Render Entire Document on each edit
----------------------------------------------

Here we first compile the MD, add plugins to handle pre nodes 
and then render each MD component one by one with custom parsing
for code/fence blocks.

```
notebook = new Notebook();

for item in md.parsed():
  if item is fence or code block:
    targetElem = new Div();
    snippet = parse(item.value)
    snippet.render(targetElem)
  else:
    fallback_render(item)
```

Option 2 - Render only preNodes if only pre content changed
-----------------------------------------------------------

This option is similar to option 1 but we now have the ability to
know which pre tags in MD correspond to which pre nodes in the output
and only updates the corresponding html elements.

```
notebook = new Notebook();

for item in md.parsed():
  if item is fence or code block:
    targetElem = findDivOrCreate(item.index);     # Difference
    snippet = parse(item.value)
    snippet.render(targetElem)
  else if item.changed:         # Difference
    fallback_render(item)
```

Here we are "slightly" better in that we can do some form of diffing by a hash function to compare tags and render things as we go along (what if we had edits? edit distance to the rescue - at this point is it just easier
to render the whole doc?).

Option 3 - Render only selected fence/code blocks
-------------------------------------------------

Suppose we had a way to know that fence block number X was updated, 
inserted or deleted.  How could we go about doing optimized diff patching?

In all three of the above options we have a couple of problems.

Consider this scenario:

*Snippet1:*

```
\score()
\role(X)
\role(Y)

\line("1")
\Sw: .....
\Sh: .....

\Sw: .....
\Sh: .....
```

*Snippet2:*

```
\Sw: ...
\Sh: ...

\line("2")

\Sw: ....
\Sh: ....
------

Problems:
---------

Inter Snippet Dependence:
=========================

When snippet 1 and 2 are rendered what Snippet2 has a dependency on
Snippet1 as line 1's content is partly filled by Snippet 2.  If line 1 was now deleted (in snippet1) then Snippet2 would have an invalid reference and rendering will be screwed.

Lack of Idempotence
===================

Even in the absence of Snippet 2, after Snippet 1 is rendered once
a Notebook is created (with a score, two roles, a section and a line with a bunch of atoms in it).  But rendering the snippet again would result in creation of all these elements again.  How do we ensure that we dont duplicate this and preserve idempotence of rendering.

Solutions:
----------

We can attack this in a couple of ways:

1. Ensuring state is not carried over between State.

Looking at this problem we have commands that change state and those that modify the DOM.  Changing state on its own is fine (eg changing cycles, layouts etc) as we can always fall to a default.  The dependency problem only happens if we are adding atoms without starting a "line" on a new snippet as the snippet will try to pick the "last" line and add to it.  Similarly if a line is to be added it will be added tot he "last" section and so on.

When we add atoms to a role we ensure a line (and subsequently a section and score).   Currently the "currLine" and "currSection" are state variables at the Notebook level.  Instead these could be per snippet so a line cannot "across" snippets.  When we add a new row of atoms in a snippet at the start it will ensure a new line is created (and if the notebook happens to *not* have any lines - say due to a deletion by user) then a line (and section and score) will be "ensured".

This only solves the problem at the atom level.  But presents itself again in the line level.  If we were adding a line in each snippet (eg to explain the meaning for each line) then it will automatically add a new section (or even score) in each snippet which is wasteful.

2. Using pointers into the DOM tree.

