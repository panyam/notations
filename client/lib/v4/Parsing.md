
Our v3 was predicated on a single pass for parsing and rendering.  This was ok but had a lot of interdepencies with parsing
and view creation etc.  This also means we are locking out any possibility of incremental rendering.

To enable incrementality, we are now considering different stages in the parsering -> rendering pipeline.

Idea is:

1. Parse the input - create a command list

This way on incremental parsing - only items in the command list must change.

2. Commands are added to the notation object, when doing so commands will be responsible for other commands they can be affected by.

For example if we had :

```
Sw: s r g m p
```

That results in 2 commands ActivateRole("Sw") and AddAtoms(s, r, g, m, p).

If the Sw was chagned to "Sh" - the AddAtoms command has no idea the atoms will have to be added to a different role.  Or if the Sw atom was removed etc.

Here the AddAtoms command has a dependency on the ActivateRole command.

What kind of info can the AA command keep track off so that when it "refreshes" it only needs to update the changed parts?


3. Need a run vs refresh mode.

To handle incremental changes (as in 2) the refresh mode is needed.

On first creation (or eg render only mode) we might need a fast path where batch changes can be allowed.



Phases of Parsing/Running:



[ Parse ] -- creates -> [ Command List ] --- applies to --> [ Notebook of Lines/Blocks ] --- renders to --> [ SnippetView (of divs) ]

