# [Accents and Embelishments](https://github.com/panyam/notation/issues/129)

## Background 

There are many cases where decorating one or more atoms is important.  For example:

1. Showing octave dots on or below a note
2. Showing a "anu swara" indicator ("*") on a note or showing a note's number (eg g1, g2 etc) - after a note
3. Showing Carnatic gamakams:
    Deflections/Oscillations:
      * Kampitam  (~):
        - The oscilation between 2 notes - eg p , S..n S..n S..n
        - Starts below the note, goes above the note and oscillates to the note.
        - Written as "on top" of the note.
      * Nokku (w) 
        - Written on top of the note being "hit"
      * Orikai (Looks like a gamma - γ - but more symmetrical - like a cusp)
        - eg S~~ RN N~~S.D  D~~~NP 
        - Written on top of the note being "bumped"
    * Janta Gamakams:
      * Spuritham (∴ - "therefore" mathematical symbol - u+2234)
        - The gamakam of "hitting" between jantai swarams.
        - Written on top of the note being "hit"
      * Pratyaghata (∵ - "because" mathematical symbol - u+2235)
        - Similar to spuritham but the hitting of second note in the avaronam (eg S N - N D - D P - P M).
        - Written on top of the note being "hit"
      * Aahata:
        * Raavi (^) 
          - Written on top of the note being "hit"
        * Kandippu (✓) 
          - Shankarabharanam's S. ,,, n , P ,,,  - where the n is almost silent
          - Written on top of the note being "hit"
    * Vali (⌒ - U+2312) 
      - Written on top of the note being "hit"
    * Odukkal (x)
      - A veena gamakam where the note itself is stretched more to get the next
        note effect (instead of plucking the next note itself).
      - Not possible where plucking of strings is not possible.  On voice etc it just will sound like
        an Eetra Jaaru.
      - Written on top of the note being pushed to
    * Jaaru:
      * Eetra Jaaru (/)
        - Ascending from one note to another - eg S / P
      * Irakka Jaaru (\)
        - Descending from one note to another - eg P \ S
      - Written inbetween the two notes where ascention occurs.
      - Alternatively can be written "before" the note being slid to or "after" note being slid from
      - Another variation is also to specify a "source" note.  In case the start note is not the previous
        note.
        TODO - can this have more than 1 note - ie instead of source note we consider "path" notes?
4. Indicator for groupings (eg higher speed indicators)

In all of the above we have seen a need to decorate a note or a group of notes or even arbitrary notes and
have these dynamically change position or work well with other decorators.

## Ideas

Based on the above motivation, let us consider the idea of Embelishments or Decorators.  These are views
that depend on target atoms.   As atoms change or their properties change the embelishment/decorators may
also need a re-layout.

Key questions:

* What is the limit of the kind of info we want - single note, two notes, X notes?
* Who is the owner of the lifecycle of Decorators?
* When are layouts triggered and by which entity?
* What should be a general mechanism to specify decorators in the syntax.
* What should the entity model be for representing decorators?
* How can this be made extensible so we are not coming to a halt by syntax limitations?
* How should multiple decorators work with each other (eg octave + nokku + pre/post jaaru)?

### Syntactic Considerations

What is the syntactic structure of Embelishments?  Embelishments are "like" commands but with
simpler syntax.  Proposal is to use tilde - "~" - to start an embelishment.

An embelishment is one of:

```
~             -   Basic Embelishment
~[^<space>]+  -   Everything after "~" forms the content of the embelishment - upto the rule handler in the lexer to decide this.
~<string>     -   eg ~"abc" - This is reserved for now and will not be implemented.  Idea here is we may need embelishments with data, 
                  things like "drop from P", "curve from 3 notes below curr note to a note above and then to N" etc
~{            -   To start an embelishment across a group to be terminated by }~.  Also not implemented for now as we dont have enough
                  good examples of this and can revisit later.  Also related is the idea of "markers" which we arent quite sure where
                  they fit in.  ie markers are a set of artifacts "marking/pointing" to X (possibly non sequential) notes.  This could
                  be served by named embelishments?  TBD.
```

Using this notation some examples are given below:

#### Spurithams:

Janta are a little bit tricker and can be done in two ways:

1. Using unicode characters directly:

```
Sa Sa ~∴ Ri Ri ~∴ Ga Ga ~∴

or 

S N ~∵ N D ~∵ D P ~∵ P M ~∵ ...
```

2. Using similar chars:

```
Sa Sa ~:> Ri Ri ~<: Ga Ga ~<:

or 

S N ~-: N D ~-: D P ~-: P M ~-: ...
```

#### Aahata:

```
S ~^ R G
```

or 

```
S R ~^ G
```

#### Nokku:

```
S R ~w G M
```

#### Orikai:

```
S R ~γ G M

or 

S R ~Y G M
```

#### Khandippu:

```
S. n ~✓ G

or 

S. n ~./ G
```

#### Vali:

```
S. n ~⌒ P

or 

S. n ~~ P
```

#### Jaaru:

```
S ~/ R ~/ G ~/

or 

S ~\ N ~\ D ~\ P ~\ ...
```

#### Odukkal:

```
S R ~x M P
```

Few things to note from the above examples:

1. Gamakams can apply to either previous or the next note and that depends on the gamakam itself.
2. So gamakams need a pre or post operator status and will be determined at parse time.  It is upto
   the lexer to parse this ~[^<space>]* and return the Embelishment object and whether it affects
   the next or the previous note (eg pre/post Embelishment).   We could then have the Parser treat
   PRE and POST tokens as part of rules directly
3. The rule handler for embelishments can be a place to "inject" custom embelishment types later on.

### Modelling/Interface Implications

Starting with defining the interface:

```
interface Atom {
  // The actual embelishment objects for this atom.
  // The atom may not know anything about these and they could just
  // be opaque objects that parser returns - allows for extensions
  embelishments: Embelishment[];
}

interface Embelishment {
  type: EmbelishmentType;

  // An other embelishment data needed
  // ...
}

/**
 * Takes care of rendering all views for an Atom.  This would include
 * creating the view elements for the Atom, for the Embelishment
 * and layout methods to coordinate layout of all the embelishments
 */
interface AtomView {
  // return a list of embelishments
  // For this atom the AtomView will create a bunch of embelishments
  // based on how?
  embelishmentViews: EmbelishmentView[];

  // REfresh layout of either the atom's view(s) or embelishemnt views
  // or both
  refreshLayout(): void;
}

// Two options:
// 1. Have a single embelishmentview for all embelishments for an atom
// 2. Strictly have one view per embelishment - this would make each
//    EV layout independantly of other views and simplify the logic
interface EmbelishmentView {
  // Embelishment this view is for
  embelishment: Embelishment;

  // Will adjust itself when called (based on atom's propertis)
  layout(): void;
}
```

#### Multi Role Decorators/Embelishments

There are a second form of decorators - or multi-role decorators.  In the above case
we can ensure decorators apply to entities in a role - eg accent on a note, slide between
two notes.

What if we want to show embelishments on a different role all together?  Is this even a concern?
Technically our model is that Roles contain a list of Atoms.   Atoms strictly dont need to link/refer
to atoms in other roles.   Even if atoms linked to atoms in other roles, any linkage will cause an
embelishment to be rendered "between" roles instead of being in a dedicated role.  So for now
multi role decorators may not even be needed.

So we will not consider these for now.

### Orchestrating Layout

In the above model we have Embelishments that are the actual "multi-edges" between one or more
atoms (in one or more roles).  When an AV is created (say by a BeatView in the BeatLayout or
by a manual AtomLayout), EVs are kicked off.  EVs are the view representation
of a given Embelishment.  EV will need access to the AVs of the Atoms it is referring
for layout purposes.  It can have this either directly by keeping track of AVs for each of the
target atoms or by some kind of delegate that returns AVs for Atoms.

The layout method in the EV kicks off its re-arrangement based on the size and location
of the AVs of the atoms its Embelishment targets.  Given an atom can have multiple Embelishments
(octave indicator, jaaru indicator, jaaru between its adjacent note, etc) how should the ordering
and placement of these EVs be coordinated?  For example before a Kampitha or Spuritha gamakam
indicator is shown, the upper octave indicator will have to be laid out.  Or before a "grouping"
line is rendered the lower octave indicator will need to be laid out.

Second problem is of bounding boxes.  It may be desirable to calculate the bounding box of an AV
that is the union of bounding boxes of its EVs - eg if we want to do highlight/selection etc.

For now a simple solution is to have the AV (for individual embelishments) create EVs in an opaque
way where it is aware of all characteristics and decide how they need to be rendered.  Infact
order is important.  Since the user is typing Es serially the order can match this (if it matters)
It is possible that the user may type in multiple Embelishments and a lot of them could be invalid.

Later on we will revisit how to do better layout management (if possible).
