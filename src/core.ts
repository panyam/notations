import * as TSU from "@panyam/tsutils";
import { Entity, TimedEntity } from "./entity";

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
}

/**
 * Atoms are the base class of timed entities that can appear in a Notation.
 */
export abstract class Atom extends TimedEntity {
  protected _duration: Fraction;
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

  debugValue(): any {
    const out = super.debugValue();
    if (!this.duration.isOne) {
      out.duration = this.duration.factorized.toString();
    }
    if (this.isContinuation) {
      out.isContinuation = true;
    }
    return out;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.duration = new TSU.Num.Fraction(this.duration.num, this.duration.den);
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
   * Splits this atom "before" a certain duration.  If this atom's duration is
   * longer than the given duration then it is truncated to the given duration
   * and a continuation space is returned.
   */
  splitBefore(duration: Fraction): TSU.Nullable<Atom> {
    if (this.duration.cmp(duration) > 0) {
      const spillOver = this.createSpilloverSpace(this.duration.minus(duration));
      spillOver.isContinuation = true;
      this.duration = duration;
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

  constructor(duration = ONE, ...atoms: Atom[]) {
    super(duration);
    this.addAtoms(...atoms);
  }

  get duration(): Fraction {
    if (this.durationIsMultiplier) {
      return this.totalChildDuration.divby(this._duration);
    } else {
      return this._duration;
    }
  }

  set duration(d: Fraction) {
    this._duration = d;
  }

  debugValue(): any {
    const out = { ...super.debugValue(), atoms: Array.from(this.atoms.values(), (a) => a.debugValue()) };
    if (this.durationIsMultiplier) out.durationIsMultiplier = true;
    return out;
  }

  /**
   * Splits this group into two parts such that first part (this group) fits within
   * the given duration and everything else
   * longer than the given duration then it is truncated to the given duration
   * and a continuation space is returned.
   */
  splitAfter(requiredDuration: Fraction, targetGroup: TSU.Nullable<Group> = null): TSU.Nullable<Group> {
    if (this.duration.isLTE(requiredDuration) || requiredDuration.isLTE(ZERO)) {
      return targetGroup;
    }
    if (!targetGroup) {
      targetGroup = new Group();
      targetGroup.durationIsMultiplier = this.durationIsMultiplier;
    }
    // few options here
    // delta = ourDuration - lastDuration
    // if delta >= requiredDuration
    // then just add last as is into the new group
    //    Additionally if delta == requiredDuration we can stop and return here
    // if delta < requiredDuration
    // then it means we have removed "too much", so the moved entry needs to be
    // "split" and only the second half is to be added into the out group
    // but first half's duration will be truncated
    while (true) {
      const last = this.atoms.popBack();
      const durWithoutLast = this.duration.minus(last.duration, true);
      if (durWithoutLast.isGTE(requiredDuration)) {
        targetGroup.insertAtomsAt(targetGroup.atoms.first, last);
        if (durWithoutLast.equals(requiredDuration)) break;
      } else {
        // needs further splitting as "too much" was removed from the end
        const minDur = requiredDuration.minus(durWithoutLast, true);
        const spillOver =
          last.type == AtomType.GROUP ? (last as Group).splitAfter(minDur) : (last as LeafAtom).splitBefore(minDur);
        if (spillOver == null) {
          throw new Error("Spill over cannot be null here");
        }
        spillOver.isContinuation = true;
        // Add spill over to the target
        targetGroup.insertAtomsAt(targetGroup.atoms.first, spillOver);

        // and Add the removed item back
        this.atoms.push(last);
      }
    }
    return targetGroup;
  }

  get totalChildDuration(): Fraction {
    let out = ZERO;
    this.atoms.forEach((atom) => (out = out.plus(atom.duration)));
    return out;
  }

  /** Entities can have children and thus siblings and parents. */
  equals(another: this, expect = false): boolean {
    if (!super.equals(another)) return false;
    return this.atoms.equals(another.atoms, (a1, a2) => a1.equals(a2));
  }

  copyTo(another: this): void {
    super.copyTo(another);
    this.atoms.forEach((atom) => another.atoms.add(atom.clone()));
  }

  /**
   * Inserts atom before a given cursor atom.  If the cursor atom is null
   * then the atoms are appended at the end.
   */
  insertAtomsAt(beforeAtom: TSU.Nullable<Atom>, ...atoms: Atom[]): this {
    if (beforeAtom == null) return this.addAtoms(...atoms);
    throw new Error("Not implemented");
    return this;
  }

  addAtoms(...atoms: Atom[]): this {
    for (const atom of atoms) {
      if (atom.type == AtomType.REST) {
        const last = this.atoms.last;
        if (last && last.type != AtomType.GROUP && last.type != AtomType.LABEL) {
          (last as LeafAtom).beforeRest = true;
        }
      } else {
        if (atom.parentGroup != null) {
          throw new Error("Atom already added to another group - implement auto 'move'");
        }
        atom.parentGroup = this;
        this.atoms.add(atom);
      }
    }
    return this;
  }
}

export class Line extends Entity {
  // Line can have atoms starting "before" the cycle.  The offset tells how many notes
  // before or after the cycle this line's atoms start at.
  offset: Fraction = ZERO;
  roles: Role[] = [];

  // This is a very hacky solution to doing left side pre-margin text typically found
  // in notations - eg line X of a pallavi has this.  This makes vertical space less
  // wasteful
  // A better solution is inter-beat annotation but it is very complex for now
  marginText = "";

  get isEmpty(): boolean {
    for (const r of this.roles) if (!r.isEmpty) return false;
    return true;
  }

  debugValue(): any {
    const out = {
      ...super.debugValue(),
      roles: this.roles.map((r) => r.debugValue()),
      // layoutParams: this.layoutParams?.uuid,
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
