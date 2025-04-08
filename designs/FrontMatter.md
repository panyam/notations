# Using Frontmatter

## Background 
Today we have metadata fields that are pretty much arbitrary key/value pairs we store in our documents.  And as a side
effect they get rendered inline (the first time they are defined).   Eg if we have:

```
\meta("Hello", "World")
```

Our view would show:

```
Hello: World
```

(The "Hello" would be in bold but its a detail).

This just feels clunky and is not very useful:

1. It is very specific to our notation type.
2. It is limited to simple types - we can add json etc but it is just complicating the parser - the parser should be
   focussed on music and not other things.  Even though the Notation is the hero we are not aiming to be a general
   purpose document format.
3. There are already existing standards people are used to - via front matter etc that we can reuse.
4. Most painful is - keeping it in \meta tags means we have to parse the entire document to identify metadata.  This
   restricts extract metadata in the backend unless it is also written in typescript.

## Proposal

Move away from "\meta" tags and use front matter.   This allows us to:

1. Use various front-matter libraries to extract FM and Metadata for a Notation upfront.
2. Decouples document parsing with metadata parsing
3. Cleaner and simpler syntax - and also forces metadata to be at the top (meta tags could be placed anywhere - which
   was nice but not worth the hassle).

## Migrating existing Notations

Given we have a small number of notations (about 100 today) we can do a one sweep fix.  The strategy is:

1. Split lines
2. Filter out and collect all lines starting with "\meta"
3. Load front matter too and insert all found meta into front matter
4. save back front matter
5. Also add all items in front matter into document's contentMetadata

Today we seperated out user tags and content metadata because we could not parse outside of TS.  With this
this restruction no longer exists.  So we could just combine the two over time?  
