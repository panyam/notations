import * as TSU from "@panyam/tsutils";
import { Entity, TimedEntity } from "./entity";
import { LayoutParams } from "./layouts";

/**
 * Alias to TSU.Num.Fraction in tsutils.
 */
type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

/**
 * AtomType enums are used to denote specific Atoms
 * @enum
 */
export enum AtomType {
  NOTE = "Note",
  LITERAL = "Literal",
  SYLLABLE = "Syllable",
  SPACE = "Space",
  GROUP = "Group",
  LABEL = "Label",
  REST = "Rest",
  MARKER = "Marker",
}

/**
 * Atoms are the base class of timed entities that can appear in a Notation.
 */
export abstract class Atom extends TimedEntity {
  protected _duration: Fraction;
  markersBefore: Marker[];
  markersAfter: Marker[];
  nextSibling: TSU.Nullable<Atom> = null;
  prevSibling: TSU.Nullable<Atom> = null;
  // Which group does this Atom belong to
  parentGroup: TSU.Nullable<Group> = null;

  // Tells if this Atom is a "continuation" from a previous atom
  isContinuation = false;

  constructor(duration = ONE) {
    super();
    this._duration = duration || ONE;
  }

  abstract splitAt(requiredDuration: Fraction): TSU.Nullable<Atom>;

  debugValue(): any {
    const out = super.debugValue();
    if (!this.duration.isOne) {
      out.duration = this.duration.factorized.toString();
    }
    if (this.isContinuation) {
      out.isContinuation = true;
    }
    if ((this.markersBefore || []).length > 0) {
      out.mbef = this.markersBefore.map((m) => m.debugValue());
    }
    if ((this.markersAfter || []).length > 0) {
      out.maft = this.markersAfter.map((m) => m.debugValue());
    }
    return out;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another._duration = new TSU.Num.Fraction(this.duration.num, this.duration.den);
  }

  get duration(): Fraction {
    return this._duration;
  }

  set duration(d: Fraction) {
    this._duration = d;
  }
}

export abstract class LeafAtom extends Atom {
  // Tells if this atom is followed by a rest
  beforeRest = false;

  /**
   * Splits this atom at a certain duration.  If this atom's duration is
   * longer than the given duration then it is truncated to the given duration
   * and a continuation space is returned.
   */
  splitAt(duration: Fraction): TSU.Nullable<Atom> {
    if (this.duration.cmp(duration) > 0) {
      const spillOver = this.createSpilloverSpace(this.duration.minus(duration));
      spillOver.isContinuation = true;
      this.duration = duration;
      // TODO - Here we need to move the markersAfter to the spill-over as it doesnt belong to this any more
      return spillOver;
    }
    return null;
  }

  protected createSpilloverSpace(duration: Fraction): Space {
    return new Space(duration);
  }

  debugValue(): any {
    return this.beforeRest ? { ...super.debugValue(), beforeRest: true } : super.debugValue();
  }
}

export class Marker extends Entity {
  constructor(public text: string, public isBefore = true) {
    super();
  }

  debugValue(): any {
    return { ...super.debugValue(), text: this.text, before: this.isBefore };
  }

  toString(): string {
    return `Marker(${this.text}-${this.isBefore})`;
  }
}

export class Rest extends LeafAtom {
  // rests are zero length - why not just use 0 length silent spaces?
  constructor() {
    super(ZERO);
  }
}

/**
 * Spaces are used to denote either silence or continuations of previous notes.
 */
export class Space extends LeafAtom {
  /**
   * Tells if this is a silent space or a continuation of previous note.
   */
  isSilent = false;

  constructor(duration = ONE, isSilent = false) {
    super(duration);
    this.isSilent = isSilent;
  }

  debugValue(): any {
    return { ...super.debugValue(), isSilent: this.isSilent };
  }

  toString(): string {
    return `Space(${this.duration}-${this.isSilent})`;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.isSilent = this.isSilent;
  }

  equals(another: this): boolean {
    return super.equals(another) && this.isSilent == another.isSilent;
  }

  protected createSpilloverSpace(duration: Fraction): Space {
    const out = super.createSpilloverSpace(duration);
    out.isSilent = this.isSilent;
    return out;
  }
}

export class Literal extends LeafAtom {
  /**
   * The value of this Syllable.
   */
  embelishments: any[] = [];

  constructor(public value: string, duration = ONE) {
    super(duration);
  }

  debugValue(): any {
    const out = { ...super.debugValue(), value: this.value };
    if (this.embelishments.length > 0) {
      out.embs = this.embelishments.map((e) => ("debugValue" in e ? e.debugValue() : e));
    }
    return out;
  }

  toString(): string {
    return `Lit(${this.duration}-${this.value})`;
  }

  equals(another: this): boolean {
    return super.equals(another) && this.value == another.value;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.value = this.value;
  }
}

export class Syllable extends Literal {
  static fromLit(lit: Literal): Syllable {
    if (lit.type == AtomType.SYLLABLE) return lit as Syllable;
    const out = new Syllable(lit.value, lit.duration);
    out.embelishments = lit.embelishments;
    out.beforeRest = lit.beforeRest;
    return out;
  }

  toString(): string {
    return `Syll(${this.duration}-${this.value})`;
  }
}

export class Note extends Literal {
  /**
   * Which octave is the note in.  Can be +ve or -ve to indicate higher or lower octaves.
   */
  octave = 0;

  /**
   * How is the note shifted - ie by shifted towards major or minore by # of semi-tones.
   */
  shift: number | boolean = 0;

  constructor(value: string, duration = ONE, octave = 0, shift = 0) {
    super(value, duration);
    this.octave = octave;
    this.shift = shift;
  }

  static fromLit(lit: Literal): Note {
    if (lit.type == AtomType.NOTE) return lit as Note;
    const out = new Note(lit.value, lit.duration);
    out.embelishments = lit.embelishments;
    out.beforeRest = lit.beforeRest;
    return out;
  }

  debugValue(): any {
    const out = { ...super.debugValue() };
    if (this.octave != 0) out.octave = this.octave;
    if (this.shift != 0) out.shift = this.shift;
    return out;
  }

  toString(): string {
    return `Note(${this.duration}-${this.value}-${this.octave})`;
  }

  equals(another: this): boolean {
    return super.equals(another) && this.octave == another.octave && this.shift == another.shift;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.octave = this.octave;
    another.shift = this.shift;
  }
}

export class Group extends Atom {
  /**
   * This indicates whether our duration is static or linear to number of
   * atoms in this group.
   */
  durationIsMultiplier = false;
  readonly atoms = new TSU.Lists.ValueList<Atom>();

  constructor(...atoms: Atom[]) {
    super(atoms.length == 0 ? ZERO : ONE);
    this.addAtoms(false, ...atoms);
  }

  equals(another: this, expect = false): boolean {
    if (!super.equals(another)) return false;
    return this.atoms.equals(another.atoms, (a1, a2) => a1.equals(a2));
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.durationIsMultiplier = this.durationIsMultiplier;
    this.atoms.forEach((atom) => another.atoms.add(atom.clone()));
  }

  get duration(): Fraction {
    if (this.durationIsMultiplier) {
      return this.totalChildDuration.divby(this._duration);
    } else {
      return this._duration;
    }
  }

  setDurationAsMultiplier(asMultiplier = true): this {
    this.durationIsMultiplier = asMultiplier;
    return this;
  }

  setDuration(d: Fraction, asMultiplier = false): this {
    this._duration = d;
    this.durationIsMultiplier = asMultiplier;
    return this;
  }
  // set duration(d: Fraction) { this._duration = d; }

  debugValue(): any {
    const out = { ...super.debugValue(), atoms: Array.from(this.atoms.values(), (a) => a.debugValue()) };
    // out.duration = this._duration.factorized.toString();
    // out.realDuration = this.duration.factorized.toString();
    if (this.durationIsMultiplier) out.durationIsMultiplier = true;
    return out;
  }

  /**
   * Splits this group into two parts such that first part (this group)
   * fits within the given duration and everything else longer than the
   * given duration then it is truncated to the given duration and a
   * continuation space is returned.
   */
  splitAt(requiredDuration: Fraction): TSU.Nullable<Group> {
    if (this.duration.isLTE(requiredDuration) || requiredDuration.isLTE(ZERO)) {
      return null;
    }
    const targetGroup = new Group();
    if (this.durationIsMultiplier) {
      targetGroup.durationIsMultiplier = true;
      targetGroup._duration = this._duration;
    }

    let remainingDur = this.duration;
    const totalChildDuration = this.totalChildDuration;
    const durationFactor = this.durationIsMultiplier
      ? ONE.divby(this._duration)
      : this._duration.divby(totalChildDuration, true);
    while (remainingDur.isGT(requiredDuration) && this.atoms.last) {
      const lastChild = this.atoms.last;
      // Child's duration is absolute in its own "system"
      // Its duration within the parent (this) group's frame of reference depends
      // on whether the parent's duration is absolute or as a multiplier
      //
      // realChildDuration = case (group.durationIsMultiper) {
      //  | true  => child.duration / this._duration
      //  | false => child.duration * this._duration / total child duration
      //  }
      const childDuration = lastChild.duration.times(durationFactor);
      const newDuration = remainingDur.minus(childDuration);
      if (newDuration.isGTE(requiredDuration)) {
        // remove ourselves and add to target
        // in both cases duration will be adjusted if need be
        this.removeAtoms(true, lastChild);
        targetGroup.insertAtomsAt(targetGroup.atoms.first, true, lastChild);
        if (newDuration.equals(requiredDuration)) {
          // we have reached the end so return
          return targetGroup;
        }
      } else {
        // our scenario is now this:
        //
        // totalParentDuration = 10
        // required = 8
        // lastChildDuration (relative to parent) is 5
        //
        // durWithoutLast = 10 - 5
        // newRequired = requiredDur - durWithoutLast = 3
        //
        // However 3 is a duration in the parent's frame of reference
        // this has to be converted back to the child's FoR
        const newRequiredDur = requiredDuration.minus(newDuration, true).divby(durationFactor, true);
        // console.log( "newRequiredDur: ", newRequiredDur, "requiedDur: ", requiredDuration, "remainingDur: ", remainingDur,);
        // then the last item needs to be split, and by how much?
        const spillOver = lastChild.splitAt(newRequiredDur);
        if (spillOver == null) {
          throw new Error("Spill over cannot be null here");
        }
        if (!this.durationIsMultiplier) {
          // Our own duration has also now changed
          this._duration = requiredDuration;
        } else {
          if (this._duration.isZero) throw new Error("How can this be?");
        }
        spillOver.isContinuation = true;
        // Add spill over to the target
        targetGroup.insertAtomsAt(targetGroup.atoms.first, true, spillOver);
        return targetGroup;
      }
      remainingDur = newDuration;
    }
    return targetGroup;
  }

  get totalChildDuration(): Fraction {
    let out = ZERO;
    this.atoms.forEach((atom) => (out = out.plus(atom.duration)));
    return out;
  }

  /**
   * Inserts atom before a given cursor atom.  If the cursor atom is null
   * then the atoms are appended at the end.
   */
  insertAtomsAt(beforeAtom: TSU.Nullable<Atom>, adjustDuration = false, ...atoms: Atom[]): this {
    adjustDuration = adjustDuration && !this.durationIsMultiplier;
    const oldChildDuration = adjustDuration ? this.totalChildDuration : ONE;
    // First form a chain of the given atoms
    for (const atom of atoms) {
      if (atom.parentGroup != null) {
        if (atom.parentGroup != this) {
          throw new Error("Atom belongs to another parent.  Remove it first");
        }
        atom.parentGroup.removeAtoms(false, atom);
      }
      if (atom.type == AtomType.REST) {
        const last = this.atoms.last;
        if (last && last.type != AtomType.GROUP && last.type != AtomType.LABEL) {
          (last as LeafAtom).beforeRest = true;
        }
      } else {
        atom.parentGroup = this;
        this.atoms.add(atom, beforeAtom);
      }
    }
    if (adjustDuration) {
      if (this._duration.isZero) {
        if (this.durationIsMultiplier) throw new Error("How can this be?");
        this._duration = this.totalChildDuration;
      } else {
        const scaleFactor = this.totalChildDuration.divby(oldChildDuration);
        this._duration = this._duration.times(scaleFactor, true);
      }
    }
    return this;
  }

  /**
   * Adds atoms to the end of our atom list.
   */
  addAtoms(adjustDuration = false, ...atoms: Atom[]): this {
    return this.insertAtomsAt(null, adjustDuration, ...atoms);
  }

  /**
   * Removes atoms from our child list.
   *
   * @param   adjustDuration  If the duration is not a multiplier then it might
   *                          sometimes be useful to automatically adjust the duration
   *                          to accomodate the removal of the given atom.
   * @param   atoms           List of atoms to remove from this list.
   */
  removeAtoms(adjustDuration = false, ...atoms: Atom[]): this {
    adjustDuration = adjustDuration && !this.durationIsMultiplier;
    const oldChildDuration = adjustDuration ? this.totalChildDuration : ONE;
    for (const atom of atoms) {
      if (atom.parentGroup == this) {
        this.atoms.remove(atom);
        atom.parentGroup = null;
      } else if (atom.parentGroup != null) {
        throw new Error("Atom cannot be removed as it does not belong to this group");
      }
    }
    if (adjustDuration) {
      if (this._duration.isZero) {
        if (this.durationIsMultiplier) throw new Error("How can this be?");
        this._duration = this.totalChildDuration;
      } else {
        const scaleFactor = this.totalChildDuration.divby(oldChildDuration);
        this._duration = this._duration.times(scaleFactor, true);
      }
    }
    return this;
  }
}

export class Line extends Entity {
  // Line can have atoms starting "before" the cycle.  The offset tells how
  // many notes before or after the cycle this line's atoms start at.
  offset: Fraction = ZERO;
  roles: Role[] = [];

  // This is a very hacky solution to doing left side pre-margin text typically
  // found in notations - eg line X of a pallavi has this.  This makes vertical
  // space less wasteful
  // A better solution is inter-beat annotation but it is very complex for now
  marginText = "";

  // The LayoutParams associated with this line.
  layoutParams: LayoutParams;

  indexOfRole(name: string): number {
    for (let i = 0; i < this.roles.length; i++) {
      if (this.roles[i].name == name) return i;
    }
    return -1;
  }

  get isEmpty(): boolean {
    for (const r of this.roles) if (!r.isEmpty) return false;
    return true;
  }

  debugValue(): any {
    const out = {
      ...super.debugValue(),
      roles: this.roles.map((r) => r.debugValue()),
    };
    if (!this.offset.isZero) {
      out.offset = this.offset.toString();
    }
    return out;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.roles = this.roles.map((r) => r.clone());
  }

  addAtoms(roleName: string, defaultToNotes: boolean, ...atoms: Atom[]): this {
    const role = this.ensureRole(roleName, defaultToNotes);
    role.addAtoms(...atoms);
    return this;
  }

  ensureRole(roleName: string, defaultToNotes: boolean): Role {
    // Ensure we have this many roles
    let ri = this.roles.findIndex((r) => r.name == roleName);
    if (ri < 0) {
      ri = this.roles.length;
      const role = new Role(this, roleName);
      role.defaultToNotes = defaultToNotes;
      this.roles.push(role);
    }
    return this.roles[ri];
  }

  /**
   * Returns the maximum duration of all roles in this line.
   */
  get duration(): Fraction {
    let max = ZERO;
    for (const role of this.roles) {
      max = TSU.Num.Fraction.max(role.duration, max);
    }
    return max;
  }
}

export class Role extends Entity {
  defaultToNotes = true;
  atoms: Atom[] = [];

  constructor(public readonly line: Line, public readonly name: string) {
    super();
  }

  get isEmpty(): boolean {
    return this.atoms.length == 0;
  }

  debugValue(): any {
    return { name: this.name, atoms: this.atoms.map((a) => a.debugValue()) };
  }

  addAtoms(...atoms: Atom[]): void {
    let last: null | Atom = null;
    for (const atom of atoms) {
      if (atom.type == AtomType.REST) {
        if (last && last.type != AtomType.GROUP && last.type != AtomType.LABEL) {
          (last as LeafAtom).beforeRest = true;
        }
      } else {
        this.atoms.push(atom);
      }
      last = atom;
    }
  }

  copyTo(another: Role): void {
    another.addAtoms(...this.atoms);
  }

  /**
   * Duration for this role.
   */
  get duration(): Fraction {
    return this.atoms.reduce((a, b) => a.plus(b.duration), ZERO);
  }
}
