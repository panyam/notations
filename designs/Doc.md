This is an proposal of the parser for the V4 format of the Notations document.
Why are we changing the document format?

V3 was built in a way that allowed blog writers to embed snippets of music.
This was done by choosing markdown as the document format with snippets
being embedded by inline blocks, eg:

~~~
```v3
S R G M P D N S
....
```
~~~

This had several advantages:

1. Dont need to worry about document formats and layouts.  You write a document
and embed sections where musical notation needed to fit.  This way the author
could take all advantages of the "container format"'s layout power etc.

2. Rendering of the container document was also taken care due to available
renderers.

However there were also several disadvantages:

1. For most authors music is the hero.   As such they would want
the act of writing music take first precedence over other things like
blog formatting.   If any thing there are very few non-musical elements
that are a must and are only added as an after thought (eg headings,
explanations of sections, meanings etc).  It seemed painful to have to
write those ``` sections each time an author had to break into song.
In essence:

      Authors should not have to "break into song"!!!

2. Having snippets only be embedable meant that state had to "flow"
from one snippet to another.   This is a problem in both formats. So
to not have to deal with this all state (eg via \set directives is
local).  Any global variables will have to be declared at the top for
all snippets to inherit from.  V3 will also be changed to do this.
Similarly any roles declared will also be local unless declared globally.

3. Another disadvantage with document embedding was that building an editor
required each "parent" document's grammar to be properly parseable and
updateable incrementally.  For someting like MD which is highly ambiguous
this is tricky.  And worse this would have to be repeated for every "container"
document format.

4. Incremental parsing and rendering is a huge issue.  Typical way of using
the container format was to as mentioned in (4) use a text editor (ACE, Toast etc)
to render text and then have the viewer update when necessary.  Different
editors had different semantics on how updates happened (incremental, all page)
etc.  This compounded view related issues along with parsing ones and resulted
in a very very slow (and janky) editing experience (scrolling not being smooth
as view offsets of different sections is not known), updating only changed sections etc.

In order to address the above the V4 version proposes a music-first format.

From the get-go author's write music that is the V3 syntax but unescaped by
fences.  This allows one to do things like:

```
Sw: g, g, r, ,, s, s, r, r, g, g, r, r,
Sh: nin, nu ko ,,, ri , , , , , , ,
```


Authors can still add non non musical content - but that requires "breaking
into a blog".   For this we now provide custom commands to allow this, eg:

\md{ ... for markdown content }
\html { ... for html }

or the fence equivalent:

```md
mark down content here
```

```html
html content here
```

Fences can be custom so they do not interfere with content (similar to rust raw strings).  ie:

```
n-backticks<contenttype>
content (without n-backticks)
n-backticks
```

## Headings

Just like in V3  styles can be expressed by escaped by \html commands (to include styles).
ALso like in V3 we allow multiple content parts in a top level document.
