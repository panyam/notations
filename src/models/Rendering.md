
How do we render?

Our Notebook model allows us to have a document spread out over multiple snippets
and by using cursors we can allow edits to be confined to ranges.  If an edit ever
"crosses over" then (once implemented) we have the ability to roll over cousin
nodes to other nodes at a cursor somewhere else.

This is a reasonably good edit model for now.  In the edit model we dont store
results but instead hold commands that affect the Notebook document tree (via cursors).
How do we handle rendering?  Yes every command updates the Notebook document context
or "some" context.  However how can somethign be actually played/rendered?

Ultimately what are played are "runs" of music.  For example consider the following snippets:

```
Snippet 1:

\section1

\line1

< atoms for line 1...>

\line2

< atoms for line 2...>

Snippet 2:

\line3

<atoms for line 3 (in section1) ...>

\section 2

\lineX

<atoms for line X (in section2) ...>
```


In all this our document is updated nicely but we dont have a way to 
show what to render and when?  We have the following options:

1. Render at "\line" commands:

If we use \line markers as points to render the line then we 
would render empty lines be cause atoms come *after* a line 
is created (with the \line command).  What we could do is
render the "previous line in the current snippet if any" 
automatically each time a new line or section (or end of snippet)
is encountered.

One downside is that every line will be automatically rendered
whether the use wants it or not.  Eg the user may just want to
write up a song but only render it later on (say by wanting 
to try out different gathis/nadais etc).

For this we would have a "render" option that passed to the \line
command that could control whether this line is eligible for rendering.
Default = true.

2. Usual Manual Runs

We want the user to be able to create runs and "practise" sheets so
they can layout score in anyway they want (practise nadais etc).  A run
command is something as follows:

```
\run( run parts ) or \[ run parts ]
```

Run parts are concatenations of things that can be rendered.  Eg:

```
\run(Sections["Pallavi"].Lines[1], Sections["Pallavi"].Lines[2], Sections["Pallavi"].Lines[2])
```

Describes a run for 3 lines (line 1 once and line 2 twice).

This will be rendered for as many cycles as needed and for all the roles.  For now this is 
manual and we can extend this syntax more in the future.

Proposal - 

For nwo we will stick with (2) as it captures "what" to layout rather than when and 
going the manual route we can always add (1) later on.

Player Contract
---------------

Our Notebook is a set of instructions (across Snippets for snapshotting).

It can be seen as:

```
targets = create_targets() // eg renderer, player, logger etc
notebook.reset_state();
for each snippet in notebook.snippets:
  for each instr in snippet.instructions:
    instr.update_notebook(snippet);
    for each target in targets:
      instr.execute_on(target)    // -----> X
```

What does "X" even mean?  We have a single kind of target - the renderer (or viewer) where lines (or runs) will be rendered.  This seems extremely abstract and does not need to be (for now).  If ever a music player is required so we can have snippets generate music to be played the "collector" is an easier interface than generic target.  Our collector interface could just be:

```
begin()
setvar() or emit()
setvar() or emit()
setvar() or emit()
setvar() or emit()
...
end()
```

But even this is too much - all your "data" is on the notebook, and only rendering is else where.  So why not a dedicated "render" command for everything?  This way instructions always update notebooks.  Renderers *never* do but only emit things By virtue of embedding our snippets in a larger "universe" (ie the DOM) we can do other state intializtions any time we want anyway.


Instead simple thing is just to collect all lines in a Snippet (along with the instructions that created them.  Then when we have to render X we just have to walk backwards from its instruction to find the required parameters.

So to do a Run command we would need something like:

```
defaultLayoutParams = this.properties.get(layoutparams)
for line in snippet.lines:
  layoutParams = this.findLayoutParamsForLine(line) or defaultLayoutParams;
  renderLine(line, layoutParams)

findLayoutParamsForCommand():
  
```


