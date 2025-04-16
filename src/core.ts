import * as TSU from "@panyam/tsutils";
import { Entity, TimedEntity } from "./entity";
import { LayoutParams } from "./layouts";

/**
 * Alias to TSU.Num.Fraction in tsutils.
 */
type Fraction = TSU.Num.Fraction;
export const ZERO = TSU.Num.Fraction.ZERO;
export const ONE = TSU.Num.Fraction.ONE;

/**
 * AtomType enums are used to denote specific Atoms
 * Each type represents a specific musical or notational element.
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
 * Atoms are the base class for all timed entities that can appear in a Notation.
 * An Atom represents the fundamental building block of the notation system.
 */
export abstract class Atom extends TimedEntity {
  readonly TYPE: string = "Atom";

  protected _duration: Fraction;
  /** Markers to be displayed before this atom */
  markersBefore: Marker[];
  /** Markers to be displayed after this atom */
  markersAfter: Marker[];
  /** Next atom in the sequence */
  nextSibling: TSU.Nullable<Atom> = null;
  /** Previous atom in the sequence */
  prevSibling: TSU.Nullable<Atom> = null;
  /** The Group this Atom belongs to, if any */
  parentGroup: TSU.Nullable<Group> = null;

  /** Indicates if this Atom is a continuation from a previous atom */
  isContinuation = false;

  /**
   * Creates a new Atom with the specified duration.
   * @param duration The duration of the atom, defaults to ONE (1/1)
   */
  constructor(duration = ONE) {
    super();
    this._duration = duration || ONE;
  }

  /**
   * Splits this atom at the specified duration.
   * @param requiredDuration The duration at which to split the atom
   * @returns A new atom representing the portion beyond the split point, or null if no split is needed
   */
  abstract splitAt(requiredDuration: Fraction): TSU.Nullable<Atom>;

  /**
   * Returns a debug-friendly representation of this Atom.
   * @returns An object containing debug information
   */
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

  /**
   * Copies the properties of this atom to another atom.
   * @param another The target atom to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another._duration = new TSU.Num.Fraction(this.duration.num, this.duration.den);
  }

  /**
   * Gets the duration of this atom.
   */
  get duration(): Fraction {
    return this._duration;
  }

  /**
   * Sets the duration of this atom.
   */
  set duration(d: Fraction) {
    this._duration = d;
  }
}

/**
 * Base class for atoms that cannot contain other atoms.
 * LeafAtom represents atomic elements that can't be further subdivided.
 */
export abstract class LeafAtom extends Atom {
  readonly TYPE: string = "LeafAtom";

  /** Indicates if this atom is followed by a rest */
  beforeRest = false;

  /**
   * Splits this atom at a certain duration.
   * If this atom's duration is longer than the given duration, it's truncated
   * to the given duration and a continuation space is returned.
   * 
   * @param duration The duration at which to split the atom
   * @returns A new Space atom representing the spillover if needed, otherwise null
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

  /**
   * Creates a Space atom to represent spillover duration when splitting.
   * @param duration The duration of the spillover
   * @returns A new Space atom
   */
  protected createSpilloverSpace(duration: Fraction): Space {
    return new Space(duration);
  }

  /**
   * Returns a debug-friendly representation of this LeafAtom.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return this.beforeRest ? { ...super.debugValue(), beforeRest: true } : super.debugValue();
  }
}

/**
 * Represents a marker or annotation in the notation.
 * Markers can be placed before or after atoms to provide additional context.
 */
export class Marker extends Entity {
  readonly TYPE = "Marker";

  /**
   * Creates a new Marker with the specified text.
   * @param text The text content of the marker
   * @param isBefore Whether the marker should appear before (true) or after (false) its associated atom
   */
  constructor(public text: string, public isBefore = true) {
    super();
  }

  /**
   * Returns a debug-friendly representation of this Marker.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { ...super.debugValue(), text: this.text, before: this.isBefore };
  }

  /**
   * Returns a string representation of this Marker.
   * @returns A string representation
   */
  toString(): string {
    return `Marker(${this.text}-${this.isBefore})`;
  }
}

/**
 * Represents a rest (silence) in the notation.
 * Rests are zero-length atoms that indicate a pause.
 */
export class Rest extends LeafAtom {
  readonly TYPE = "Rest";

  /**
   * Creates a new Rest.
   * Rests are zero length by default.
   */
  constructor() {
    super(ZERO);
  }
}

/**
 * Represents a space or silence in the notation.
 * Spaces can be used to denote either silence or continuations of previous notes.
 */
export class Space extends LeafAtom {
  readonly TYPE = "Space";
  
  /**
   * Indicates whether this is a silent space or a continuation of the previous note.
   */
  isSilent = false;

  /**
   * Creates a new Space with the specified duration and silence property.
   * @param duration The duration of the space, defaults to ONE (1/1)
   * @param isSilent Whether the space represents silence (true) or a continuation (false)
   */
  constructor(duration = ONE, isSilent = false) {
    super(duration);
    this.isSilent = isSilent;
  }

  /**
   * Returns a debug-friendly representation of this Space.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { ...super.debugValue(), isSilent: this.isSilent };
  }

  /**
   * Returns a string representation of this Space.
   * @returns A string representation
   */
  toString(): string {
    return `Space(${this.duration}-${this.isSilent})`;
  }

  /**
   * Copies the properties of this Space to another Space.
   * @param another The target Space to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.isSilent = this.isSilent;
  }

  /**
   * Checks if this Space is equal to another Space.
   * @param another The Space to compare with
   * @returns True if the Spaces are equal, false otherwise
   */
  equals(another: this): boolean {
    return super.equals(another) && this.isSilent == another.isSilent;
  }

  /**
   * Creates a Space atom to represent spillover duration when splitting.
   * @param duration The duration of the spillover
   * @returns A new Space atom with the same silence property as this Space
   */
  protected createSpilloverSpace(duration: Fraction): Space {
    const out = super.createSpilloverSpace(duration);
    out.isSilent = this.isSilent;
    return out;
  }
}

/**
 * Represents a literal value in the notation.
 * Literals are the basic building blocks for notes and syllables.
 */
export class Literal extends LeafAtom {
  readonly TYPE: string = "Literal";
  
  /**
   * The embellishments applied to this Literal.
   */
  embelishments: any[] = [];

  /**
   * Creates a new Literal with the specified value and duration.
   * @param value The string value of the literal
   * @param duration The duration of the literal, defaults to ONE (1/1)
   */
  constructor(public value: string, duration = ONE) {
    super(duration);
  }

  /**
   * Returns a debug-friendly representation of this Literal.
   * @returns An object containing debug information
   */
  debugValue(): any {
    const out = { ...super.debugValue(), value: this.value };
    if (this.embelishments.length > 0) {
      out.embs = this.embelishments.map((e) => ("debugValue" in e ? e.debugValue() : e));
    }
    return out;
  }

  /**
   * Returns a string representation of this Literal.
   * @returns A string representation
   */
  toString(): string {
    return `Lit(${this.duration}-${this.value})`;
  }

  /**
   * Checks if this Literal is equal to another Literal.
   * @param another The Literal to compare with
   * @returns True if the Literals are equal, false otherwise
   */
  equals(another: this): boolean {
    return super.equals(another) && this.value == another.value;
  }

  /**
   * Copies the properties of this Literal to another Literal.
   * @param another The target Literal to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.value = this.value;
  }
}

/**
 * Represents a syllable in lyrics or text to be sung.
 * Extends Literal to provide specialized handling for sung text.
 */
export class Syllable extends Literal {
  readonly TYPE = "Syllable";

  /**
   * Creates a Syllable from a Literal.
   * @param lit The Literal to convert to a Syllable
   * @returns A new Syllable with the properties of the Literal
   */
  static fromLit(lit: Literal): Syllable {
    if (lit.TYPE == AtomType.SYLLABLE) return lit as Syllable;
    const out = new Syllable(lit.value, lit.duration);
    out.embelishments = lit.embelishments;
    out.beforeRest = lit.beforeRest;
    return out;
  }

  /**
   * Returns a string representation of this Syllable.
   * @returns A string representation
   */
  toString(): string {
    return `Syll(${this.duration}-${this.value})`;
  }
}

/**
 * Represents a musical note in the notation.
 * Extends Literal to add properties specific to musical notes.
 */
export class Note extends Literal {
  readonly TYPE = "Note";

  /**
   * Which octave the note is in. Can be positive or negative to indicate higher or lower octaves.
   */
  octave = 0;

  /**
   * How the note is shifted - i.e., shifted towards major or minor by # of semi-tones.
   */
  shift: number | boolean = 0;

  /**
   * Creates a new Note with the specified properties.
   * @param value The string value of the note
   * @param duration The duration of the note, defaults to ONE (1/1)
   * @param octave The octave of the note, defaults to 0
   * @param shift The shift of the note, defaults to 0
   */
  constructor(value: string, duration = ONE, octave = 0, shift = 0) {
    super(value, duration);
    this.octave = octave;
    this.shift = shift;
  }

  /**
   * Creates a Note from a Literal.
   * @param lit The Literal to convert to a Note
   * @returns A new Note with the properties of the Literal
   */
  static fromLit(lit: Literal): Note {
    if (lit.TYPE == AtomType.NOTE) return lit as Note;
    const out = new Note(lit.value, lit.duration);
    out.embelishments = lit.embelishments;
    out.beforeRest = lit.beforeRest;
    return out;
  }

  /**
   * Returns a debug-friendly representation of this Note.
   * @returns An object containing debug information
   */
  debugValue(): any {
    const out = { ...super.debugValue() };
    if (this.octave != 0) out.octave = this.octave;
    if (this.shift != 0) out.shift = this.shift;
    return out;
  }

  /**
   * Returns a string representation of this Note.
   * @returns A string representation
   */
  toString(): string {
    return `Note(${this.duration}-${this.value}-${this.octave})`;
  }

  /**
   * Checks if this Note is equal to another Note.
   * @param another The Note to compare with
   * @returns True if the Notes are equal, false otherwise
   */
  equals(another: this): boolean {
    return super.equals(another) && this.octave == another.octave && this.shift == another.shift;
  }

  /**
   * Copies the properties of this Note to another Note.
   * @param another The target Note to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.octave = this.octave;
    another.shift = this.shift;
  }
}

/**
 * Represents a group of atoms that are treated as a single unit.
 * Groups can contain any number of atoms, including other groups.
 */
export class Group extends Atom {
  readonly TYPE = "Group";

  /**
   * Indicates whether the duration is static or linear to the number of atoms in this group.
   * When true, the duration is used as a multiplier for the total child duration.
   * When false, the duration is absolute.
   */
  durationIsMultiplier = false;
  
  /**
   * The list of atoms in this group.
   */
  readonly atoms = new TSU.Lists.ValueList<Atom>();

  /**
   * Creates a new Group containing the specified atoms.
   * @param atoms The atoms to include in this group
   */
  constructor(...atoms: Atom[]) {
    super(atoms.length == 0 ? ZERO : ONE);
    this.addAtoms(false, ...atoms);
  }

  /**
   * Checks if this Group is equal to another Group.
   * @param another The Group to compare with
   * @param expect Optional parameter
   * @returns True if the Groups are equal, false otherwise
   */
  equals(another: this, expect = false): boolean {
    if (!super.equals(another)) return false;
    return this.atoms.equals(another.atoms, (a1, a2) => a1.equals(a2));
  }

  /**
   * Copies the properties of this Group to another Group.
   * @param another The target Group to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.durationIsMultiplier = this.durationIsMultiplier;
    this.atoms.forEach((atom) => another.atoms.add(atom.clone()));
  }

  /**
   * Gets the duration of this group.
   * If durationIsMultiplier is true, returns the total child duration divided by the multiplier.
   * Otherwise, returns the absolute duration.
   */
  get duration(): Fraction {
    if (this.durationIsMultiplier) {
      return this.totalChildDuration.divby(this._duration);
    } else {
      return this._duration;
    }
  }

  /**
   * Sets this group to use a multiplier for duration calculations.
   * @param asMultiplier Whether to use the duration as a multiplier
   * @returns This Group instance for method chaining
   */
  setDurationAsMultiplier(asMultiplier = true): this {
    this.durationIsMultiplier = asMultiplier;
    return this;
  }

  /**
   * Sets the duration of this group.
   * @param d The new duration
   * @param asMultiplier Whether to use the duration as a multiplier
   * @returns This Group instance for method chaining
   */
  setDuration(d: Fraction, asMultiplier = false): this {
    this._duration = d;
    this.durationIsMultiplier = asMultiplier;
    return this;
  }

  /**
   * Returns a debug-friendly representation of this Group.
   * @returns An object containing debug information
   */
  debugValue(): any {
    const out = { ...super.debugValue(), atoms: Array.from(this.atoms.values(), (a) => a.debugValue()) };
    if (this.durationIsMultiplier) out.durationIsMultiplier = true;
    return out;
  }

  /**
   * Splits this group into two parts.
   * The first part (this group) fits within the given duration and everything else
   * longer than the given duration is returned as a new Group.
   * 
   * @param requiredDuration The duration at which to split the group
   * @returns A new Group containing the atoms beyond the split point, or null if no split is needed
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

  /**
   * Gets the total duration of all child atoms.
   * @returns The sum of durations of all atoms in this group
   */
  get totalChildDuration(): Fraction {
    let out = ZERO;
    this.atoms.forEach((atom) => (out = out.plus(atom.duration)));
    return out;
  }

  /**
   * Inserts atoms before a given cursor atom.
   * If the cursor atom is null, the atoms are appended at the end.
   * 
   * @param beforeAtom The atom before which to insert the new atoms, or null to append
   * @param adjustDuration Whether to adjust this group's duration based on the new atoms
   * @param atoms The atoms to insert
   * @returns This Group instance for method chaining
   */
  insertAtomsAt(beforeAtom: TSU.Nullable<Atom>, adjustDuration = false, ...atoms: Atom[]): this {
    adjustDuration = adjustDuration && !this.durationIsMultiplier;
    const oldChildDuration = adjustDuration ? this.totalChildDuration : ONE;
    // First form a chain of the given atoms
    for (const atom of atoms) {
      if (atom.parentGroup != null) {
        if (atom.parentGroup != this) {
          throw new Error("Atom belongs to another parent. Remove it first");
        }
        atom.parentGroup.removeAtoms(false, atom);
      }
      if (atom.TYPE == AtomType.REST) {
        const last = this.atoms.last;
        if (last && last.TYPE != AtomType.GROUP && last.TYPE != AtomType.LABEL) {
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
   * Adds atoms to the end of this group's atom list.
   * 
   * @param adjustDuration Whether to adjust this group's duration based on the new atoms
   * @param atoms The atoms to add
   * @returns This Group instance for method chaining
   */
  addAtoms(adjustDuration = false, ...atoms: Atom[]): this {
    return this.insertAtomsAt(null, adjustDuration, ...atoms);
  }

  /**
   * Removes atoms from this group's child list.
   * 
   * @param adjustDuration Whether to adjust this group's duration after removing atoms
   * @param atoms The atoms to remove
   * @returns This Group instance for method chaining
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

/**
 * Represents a line of notation containing multiple roles.
 * A line can have atoms starting before or after the cycle.
 */
export class Line extends Entity {
  readonly TYPE: string = "Line";

  /**
   * Offset tells how many notes before or after the cycle this line's atoms start at.
   */
  offset: Fraction = ZERO;
  
  /**
   * The roles contained in this line.
   */
  roles: Role[] = [];

  /**
   * Text to be displayed in the margin of the line.
   * This is a hacky solution to doing left side pre-margin text typically
   * found in notations - e.g., line X of a pallavi has this. This makes vertical
   * space less wasteful.
   *
   * A better solution is inter-beat annotation but it is very complex for now.
   */
  marginText = "";

  /**
   * The LayoutParams associated with this line.
   */
  layoutParams: LayoutParams;

  /**
   * Finds the index of a role with the given name.
   * @param name The name of the role to find
   * @returns The index of the role, or -1 if not found
   */
  indexOfRole(name: string): number {
    for (let i = 0; i < this.roles.length; i++) {
      if (this.roles[i].name == name) return i;
    }
    return -1;
  }

  /**
   * Checks if this line is empty (has no content in any role).
   */
  get isEmpty(): boolean {
    for (const r of this.roles) if (!r.isEmpty) return false;
    return true;
  }

  /**
   * Returns a debug-friendly representation of this Line.
   * @returns An object containing debug information
   */
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

  /**
   * Copies the properties of this Line to another Line.
   * @param another The target Line to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.roles = this.roles.map((r) => r.clone());
  }

  /**
   * Adds atoms to a role in this line.
   * @param roleName The name of the role to add atoms to
   * @param defaultToNotes Whether to default to notes for this role
   * @param atoms The atoms to add
   * @returns This Line instance for method chaining
   */
  addAtoms(roleName: string, defaultToNotes: boolean, ...atoms: Atom[]): this {
    const role = this.ensureRole(roleName, defaultToNotes);
    role.addAtoms(...atoms);
    return this;
  }

  /**
   * Ensures a role with the given name exists in this line, creating it if needed.
   * @param roleName The name of the role to ensure
   * @param defaultToNotes Whether to default to notes for this role
   * @returns The role with the specified name
   */
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
   * Gets the maximum duration across all roles in this line.
   */
  get duration(): Fraction {
    let max = ZERO;
    for (const role of this.roles) {
      max = TSU.Num.Fraction.max(role.duration, max);
    }
    return max;
  }
}

/**
 * Represents a specific role or voice in a line of notation.
 * Each role contains a sequence of atoms.
 */
export class Role extends Entity {
  readonly TYPE = "Role";

  /**
   * Whether this role represents notes by default.
   */
  defaultToNotes = true;
  
  /**
   * The atoms in this role.
   */
  atoms: Atom[] = [];

  /**
   * Creates a new Role with the specified line and name.
   * @param line The line this role belongs to
   * @param name The name of the role
   */
  constructor(public readonly line: Line, public readonly name: string) {
    super();
  }

  /**
   * Checks if this role is empty (has no atoms).
   */
  get isEmpty(): boolean {
    return this.atoms.length == 0;
  }

  /**
   * Returns a debug-friendly representation of this Role.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { name: this.name, atoms: this.atoms.map((a) => a.debugValue()) };
  }

  /**
   * Adds atoms to this role.
   * @param atoms The atoms to add
   */
  addAtoms(...atoms: Atom[]): void {
    let last: null | Atom = null;
    for (const atom of atoms) {
      if (atom.TYPE == AtomType.REST) {
        if (last && last.TYPE != AtomType.GROUP && last.TYPE != AtomType.LABEL) {
          (last as LeafAtom).beforeRest = true;
        }
      } else {
        this.atoms.push(atom);
      }
      last = atom;
    }
  }

  /**
   * Copies the properties of this Role to another Role.
   * @param another The target Role to copy properties to
   */
  copyTo(another: Role): void {
    another.addAtoms(...this.atoms);
  }

  /**
   * Gets the total duration of all atoms in this role.
   */
  get duration(): Fraction {
    return this.atoms.reduce((a, b) => a.plus(b.duration), ZERO);
  }
}
