A concern in the Accents design was how should multiple accents/embellishments on a Single atom be laid out.  The conclusion was to let the AtomView instance take care of this (abstract factories?).

Here one example of laying out embellishments "around" an Atom is describes.   This is very similar to "Slots" in BorderLayout.  Other more complex schemes may exist (using layout constraints but those could be too complex so are avoided for now).
