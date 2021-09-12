# Slot based Layout

A concern in the Accents design was how should multiple accents/embellishments on a Single atom be laid out.  The conclusion was to let the AtomView instance take care of this (abstract factories?).

Leaf atoms have embelisihments/accents (via the ~.. syntax or ^ operators).  Currently these are pretty opaque and some kind of tagging/type fields may need to be used by AtomViews (AVs) to make sense of both thier meaning as well as layout semantics.  Focussing on one kind of AVs an idea is to enable AVs to have "slots" around them.  This is very similar to "Slot" in BorderLayout.  Other more complex schemes may exist (using layout constraints but those could be too complex so are avoided for now).

## Possibilities

While completely generic AVs allowing all kinds of AVs is pretty complicated, with Slot we can envision something like the follow.

Traditional AVs are shown as:

```
      ... [ S ] [ R ] [ G ] [ M ] ...
```

Where each "[ ... ]" is a single view for a single atom.  Here AVs contained a single element - the root element that displayed the label.

It would be desirable to consider something a bit more like:


```
                [ Ts ]
      ...  [Ls] [ S  ] [Rs]
                [ Bs ] 
```

Where Ls, Ts, Bs and Rs represent left slot, top slot, bottom slot and right slot.   The idea is that in each of these slots more view elements (corresponding to each embelishment) would be rendered.

eg, Consider something like G in the second octave with a Kandippu (gamakam) along with an Anu swaram.  It would be rendered as:

```
                  [ .. ]
      ...  [ \ ]  [ G  ] [ 2 ]
                  [    ] 
```

The Kandippu ("\") is placed in the left slot.  Octave indicators on the top and the Anu swaram (Ga 2) on the right slot (possibly as a subscript but not shown here.

We could also "stack" multiple in each slot (along the Slot's "direction") allowing multiple embelishments to play with each other.  Only dependence here is for the AV to place the embelishment in the right slot.  The AV can also create its own custom embelishments as needed (eg for octaves) and just place in the right Slot (at the right order).

The layout engine can simply start from the first embelishment in each slot and incrementally work its way "away" from the main element.

At a later stage we will have to start thinking about the concept of "baselines" so the main element can be rendered similarly to how text is laid out.

This updates AV interface to be:

```
interface Layoutable {
  x: number
  y: number
  readonly width: number
  readonly height: number

  // Called to reflect/reposition based on the latest x/y coords
  refreshLayout(): void;
}

interface AtomView extends Layoutable {
  leftSlot: Slot
  toptSlot: Slot
  rightSlot: Slot
  bottomSlot: Slot

  // Given an atom's embelishemnts order it along the 4 directional slots
  // At this point no subviews are created
  orderEmbelishments(): void
}

interface Slot extends Layoutable {
  // Direction of the slot - controls the leading axis and coordinate that is incremented/decremented
  direction: enum { Left, Top, Right, Bottom }

  // All embelishments that belong to this Slot (in order of rendering)
  embelishments: Embelishemnts[];

  // Returns the EmbelishmentView for embelishments[index]
  viewForEmbelishment(index: number): EmbelishmentView;
}

interface EmbelishmentView extends Layoutable {
  // Teh embelishment for which this view is being drawn
  readonly embelishment: Embelishment;
}
```

Our layout for each AV (in each role in each line) would like something like:

```
  AtomView.allSlots = [leftSlot, rightSlot, topSlot, bottomSlot]

  AtomView.constructor() {
    // for just atom view this may also create new embelishments
    // eg octave indicator, rest indicators etc
    createViewElements();

    orderEmbelishments()    // into slots
    for slot in allSlots {
      for each (emb, index) in slot.embelishments {
        // Ensure view for embelishment is created
        // This gives us preferred widht/height but no layouts
        // TODO - This may be done in orderEmbelishments as an element
        // is added into the slot
        slot.viewForEmbelishment(index)
      }
    }
  }

  AtomView.refreshLlayout() {
    for slot in allSlots {
      slot.refreshLayout();
    }
  }

  AtomView.bbox = union(slot.bbox for slot in AtomView.allSlots);

  Slot.refreshLayout() {
    offset = <starting value of coordinate in "leading" direction
    for each (emb, index) in slot.embelishments {
      viewForEmbelishment(index).refreshLayout()
      // along the leading direction:   
      //  Top => dx = 0, dy = -ve
      //  Left => dx = -ve, dy = 0
      //  Bottom => dx = 0, dy = +ve
      //  Right => dx = +ve, dy = 0
      offset += delta
    }

    Slot.bbox = union(emb.bbox for emb in slot.embelishments);

    // Note that the embelishment doesnot have to be aligned in its leading direction
    // It just has to be "stackable"
  }
```
