
# [OneFile - Single Source of Truth](https://github.com/panyam/notation/issues/108)

## Background 

Currently our scores' source are all over the place.  We have the main content for the notes/lyrics of the score.
We have a special header section for hiding away role info and font/size info.  We also have a title that is a separate
attribute of a score.  We dont even keep track of composer, ragam, thalam etc.

This makes our UI unnecessarily complex.  We need a special handler for the "title" section to have its own edit area.
We need a select box to choose between header and main sections.   We need to create special forms in the create flow
to allow user to enter metadata in a clunky way - worse once they add this metadata there is no way to edit it.  And on 
an adminstrative side it is very hard to change this and we need to resort to creating special APIs and admin cli tools
for this.

## Goals

What would be great is a single file as a source of truth.  User edits a piece of content and that should contain everything.
Or atleast what ever the user saves the score in that is where all data/meta data should reside.  On the backend it is 
perfectly fine to load/parse this file to extract what we care about.  This also means we can get rid of hidden header sections
and have better ways to reduce the clutter instead of via fragmentation.

## Proposal - Commands to set and render metadata

Currently we create "metadata" as just markdown that is also rendered, eg:

```
r"
Composer: Saint Thyagaraja
Ragam: Mohana
Thalam: Adi
"
```

This is very static and worse very hard to extract on the backend.

Instead the followign is proposed:

```
\meta("Composer" = "Saint Thyagaraja")
\meta("Ragam" = "Mohana")
\meta("Thalam" = "Adi")
```

We also allow a quick rendering to get:

```
\meta("Composer" = "Saint Thyagaraja", "render")
\meta("Ragam" = "Mohana", "render")
\meta("Thalam" = "Adi", "render")
```

or

```
\meta("Composer", "Saint Thyagaraja", render = true)
\meta("Ragam", "Mohana", render = true)
\meta("Thalam", "Adi", render = true)
```

Rendering automatically generates something like (we dont have templating so this will for now be in built).

> {{meta.values[0]}}: {{meta.values[1]}}

How this is rendered can be controlled via either themes or via flags passed to the meta command
(eg fontsize = 14, bold = true, etc or even template = "{{meta.value[0]}} : {{meta.value[1]}}"
but this is an overkill for now);

## Implications

### Rendering implications

Metadata should not affect any rendering (except the first time where a block is created or if we ever allow templates to refer to metadata values).

### UI Implications

On UI we can simplify this by removing editability of the title section explicitly as well as needing select boxes to choose between headers.
Since meta is a command we could have better projectional editing (or hiding etc).   Even on incremental editing this would easily work.

### Backend implications

On the backend as we parse the score we could even see which metadata entries exist and automatically extract those out into the Score entity
directly so that at a later date we could do things like udpate full text search indexes or find linkages between scores etc.

### Admin implications

Admin tooling is a lot easier as the score content is the entry point for all things to do with a score instead of multiple blobs for different things.

## Alternatives

One set of alternatives is to have a \var command and introduce variables in notations.  This would allow us to keep anything as a variable (eg names, counts, entire roles, atom lists etc).  However this would then blur the line between what is notation content and what is metadata and keeping them seperate would make sense.

## Design

Model changes:

* A new command type is now added ("\meta").
* Notation would now also have "metadata objects" collection that would be
  built during the parse phase.
* The RawBlock could either be extended to have a custom source (metadata) or we could add a
  "metadata line" view.  For now we go with the latter.


Backend Changes:

* Score object to have a metadata dictionary object also saved to the DB
* On a create/update we will begin parsing the notation content to identify updated, removed, 
  newly added metadata variables and extract them into the metadata dict of the Score.
* Apply some kind of normalization - so we can treat different names/accents of same metadata in the same way.
* At a later date - we could start running batch and/or realtime flows to extract metadata and build interesting indexes.
* Merge header and main content going forward so it is returned as one.
