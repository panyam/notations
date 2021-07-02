import * as TSU from "@panyam/tsutils";

const ZERO = TSU.Num.Fraction.ZERO;

export class Entity {
  private static counter = 0;
  readonly uuid: string = "" + Entity.counter++;
  metadata: TSU.StringMap<any>;
  parent: TSU.Nullable<Entity> = null;

  constructor(config: any = null) {
    config = config || {};
    this.metadata = config.metadata || {};
  }

  children(): Entity[] {
    return [];
  }

  get childCount(): number {
    return this.children().length;
  }

  addChild(child: Entity, index = -1): this {
    if (index < 0) {
      this.children().push(child);
    } else {
      this.children().splice(index, 0, child);
    }
    return this;
  }

  childAt(index: number): Entity {
    return this.children()[index];
  }

  indexOfChild(entity: Entity): number {
    let i = 0;
    for (const child of this.children()) {
      if (child == entity) return i;
      i++;
    }
    return -1;
  }

  removeChildAt(index: number): Entity {
    const children = this.children();
    const out = children[index];
    children.splice(index, 1);
    return out;
  }

  setChildAt(index: number, entity: Entity): this {
    this.children()[index] = entity;
    return this;
  }

  setMetadata(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  getMetadata(key: string, recurse = true): any {
    if (key in this.metadata) {
      return this.metadata[key];
    }
    if (recurse && this.parent) {
      return this.parent.getMetadata(key);
    }
    return null;
  }

  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return "Entity";
  }

  toString(): string {
    return `Entity(id = ${this.uuid})`;
  }

  equals(another: this, expect = false): boolean {
    if (this.type != another.type) return false;
    // check metadata too
    return true;
  }

  clone(): this {
    const out = this.newInstance();
    this.copyTo(out);
    return out;
  }

  copyTo(another: this): void {
    another.metadata = { ...this.metadata };
  }

  protected newInstance(): this {
    return new (this.constructor as any)();
  }
}

export abstract class TimedEntity extends Entity {
  // Duration of this entity in beats.
  // By default entities durations are readonly
  abstract get duration(): TSU.Num.Fraction;

  equals(another: this): boolean {
    return super.equals(another) && this.duration.equals(another.duration);
  }
}

export enum AtomType {
  NOTE,
  SYLLABLE,
  SPACE,
  GROUP,
  LABEL,
}

export type Atom = LeafAtom | Group | Label;

export abstract class AtomBase extends TimedEntity {
  protected _duration: TSU.Num.Fraction;

  copyTo(another: this): void {
    super.copyTo(another);
    another._duration = TSU.Num.Frac(this._duration.num, this._duration.den);
  }

  constructor(duration = TSU.Num.Fraction.ONE) {
    super();
    this._duration = duration || TSU.Num.Fraction.ONE;
  }

  get duration(): TSU.Num.Fraction {
    return this._duration;
  }

  set duration(d: TSU.Num.Fraction) {
    this._duration = d;
  }

  static expandAtoms(atoms: Atom[], offset = 0, length = -1, numGroups = -1): Atom[] {
    const out: Atom[] = [];

    if (length < 0) length = atoms.length;
    if (length > numGroups) {
      throw new Error("numGroups MUST be greater than length");
    }
    let remaining = numGroups - length;
    const spacePerAtom = Math.floor(remaining / length);
    for (let i = 0; i < length; i++) {
      const atom = atoms[offset++];
      out.push(atom);
      const numSpaces = i == length - 1 ? remaining : spacePerAtom;
      for (let j = 0; j < numSpaces; j++) {
        out.push(new Space());
      }
      remaining -= spacePerAtom;
    }
    return out;
  }
}

export class Label extends AtomBase {
  content: string;
  constructor(content: string, duration = TSU.Num.Fraction.ZERO) {
    super(duration);
    this.content = content;
  }

  get type(): unknown {
    return AtomType.LABEL;
  }

  toString(): string {
    return `Space(${this.duration}-${this.content})`;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.content = this.content;
  }

  equals(another: this): boolean {
    return super.equals(another) && this.content == another.content;
  }
}

export abstract class LeafAtom extends AtomBase {}

/**
 * Spaces are used to denote either silence or continuations of previous notes.
 */
export class Space extends LeafAtom {
  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return AtomType.SPACE;
  }

  /**
   * Tells if this is a silent space or a continuation of previous note.
   */
  isSilent = false;

  constructor(duration = TSU.Num.Fraction.ONE, isSilent = false) {
    super(duration);
    this.isSilent = isSilent;
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
}

export class Note extends LeafAtom {
  /**
   * Which octave is the note in.  Can be +ve or -ve to indicate higher or lower octaves.
   */
  octave = 0;

  /**
   * How is the note shifted - ie by shifted towards major or minore by # of semi-tones.
   */
  shift = 0;

  /**
   * The value of this note.
   * TODO - move to a normalize note value
   */
  value: string;

  constructor(value: string, duration = TSU.Num.Fraction.ONE, octave = 0, shift = 0) {
    super(duration);
    this.octave = octave;
    this.shift = shift;
    this.value = value;
  }

  toString(): string {
    return `Note(${this.duration}-${this.value}-${this.octave})`;
  }

  equals(another: this): boolean {
    return (
      super.equals(another) &&
      this.octave == another.octave &&
      this.shift == another.shift &&
      this.value == another.value
    );
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.value = this.value;
    another.octave = this.octave;
    another.shift = this.shift;
  }

  // readonly type: AtomType = AtomType.NOTE;
  get type(): unknown {
    return AtomType.NOTE;
  }
}

export class Syllable extends LeafAtom {
  /**
   * The value of this Syllable.
   */
  value: string;

  constructor(value: string, duration = TSU.Num.Fraction.ONE) {
    super(duration);
    this.value = value;
  }

  toString(): string {
    return `Syll(${this.duration}-${this.value})`;
  }

  equals(another: this): boolean {
    return super.equals(another) && this.value == another.value;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.value = this.value;
  }

  // readonly type: AtomType = AtomType.SYLLABLE;
  get type(): unknown {
    return AtomType.SYLLABLE;
  }
}

export class Group extends AtomBase {
  readonly atoms: TSU.Lists.List<AtomBase> = new TSU.Lists.List<AtomBase>();

  constructor(duration = TSU.Num.Fraction.ONE, ...atoms: Atom[]) {
    super(duration);
    this.addAtoms(...atoms);
  }

  get totalChildDuration(): TSU.Num.Fraction {
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

  static groupAtoms(atoms: Atom[], groupSize = 1, offset = 0, length = -1): Group[] {
    // Group groupSize atoms at a time and add as a group
    // For the last group add spaces
    const groups = [] as Group[];
    let currGroup: TSU.Nullable<Group> = null;
    if (offset < 0) offset = 0;
    if (length < 0) length = atoms.length - offset;
    for (let i = 0; i < length; i++) {
      if (currGroup == null) {
        currGroup = new Group();
      }

      const atom = atoms[offset + i];
      currGroup.addAtoms(atom);
      if (currGroup.atoms.size % groupSize == 0) {
        groups.push(currGroup);
        currGroup = null;
      }
    }
    if (currGroup != null) {
      groups.push(currGroup);
    }
    return groups;
  }

  // readonly type: AtomType = AtomType.GROUP;
  get type(): unknown {
    return AtomType.GROUP;
  }

  addAtoms(...atoms: Atom[]): this {
    for (const atom of atoms) {
      atom.parent = this;
      this.atoms.add(atom);
    }
    return this;
  }
}

export type CyclePosition = [TSU.Num.Fraction, number, number];
export type CycleIterator = Generator<CyclePosition>;

export class CyclePart extends TimedEntity {
  name: string;
  beatLengths: TSU.Num.Fraction[] = [];
  // todo - also add "visuals" at some point

  constructor(config: any = null) {
    super((config = config || {}));
    this.name = config.name || "";
    for (const bl of config.beatLengths || []) {
      if (typeof bl === "number") {
        this.beatLengths.push(TSU.Num.Frac(bl));
      } else {
        this.beatLengths.push(bl);
      }
    }
  }

  equals(another: this): boolean {
    if (!super.equals(another)) return false;
    if (this.beatLengths.length != another.beatLengths.length) return false;
    for (let i = 0; i < this.beatLengths.length; i++) {
      if (!this.beatLengths[i].equals(another.beatLengths[i])) return false;
    }
    return true;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.beatLengths = this.beatLengths.slice(0);
  }

  get barCount(): number {
    return this.beatLengths.length;
  }

  get duration(): TSU.Num.Fraction {
    let out = ZERO;
    for (const bl of this.beatLengths) {
      out = out.plus(bl);
    }
    return out;
  }
}

// Describes the cycle pattern
export class Cycle extends TimedEntity {
  name: string;
  parts: CyclePart[];

  static readonly DEFAULT = new Cycle({
    name: "Adi Thalam",
    parts: [
      new CyclePart({ name: "Laghu", beatLengths: [1, 1, 1, 1] }),
      new CyclePart({ name: "Dhrutam", beatLengths: [1, 1] }),
      new CyclePart({ name: "Dhrutam", beatLengths: [1, 1] }),
    ],
  });

  constructor(config: any = null) {
    super((config = config || {}));
    this.name = config.name || "";
    this.parts = config.parts || [];
  }

  children(): Entity[] {
    return this.parts;
  }

  equals(another: this): boolean {
    if (!super.equals(another)) {
      return false;
    }
    if (this.parts.length != another.parts.length) return false;
    for (let i = 0; i < this.parts.length; i++) {
      if (!this.parts[i].equals(another.parts[i])) return false;
    }
    return true;
  }

  *iterateBeats(startPart = 0, startBeat = 0): Generator<CyclePosition> {
    let currPart = startPart;
    let currBeat = startBeat;
    while (true) {
      yield [this.parts[currPart].beatLengths[currBeat], currPart, currBeat];
      currBeat++;
      if (currBeat >= this.parts[currPart].beatLengths.length) {
        currBeat = 0;
        currPart++;
        if (currPart >= this.parts.length) {
          currPart = 0;
        }
      }
    }
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.parts = this.parts.map((x) => x.clone());
  }

  get barCount(): number {
    let out = 0;
    for (const part of this.parts) out += part.barCount;
    return out;
  }

  get duration(): TSU.Num.Fraction {
    let out = ZERO;
    for (const p of this.parts) {
      out = out.plus(p.duration);
    }
    return out;
  }
}

export class Line extends Entity {
  cycle: TSU.Nullable<Cycle> = null;
  atoms: TSU.StringMap<Atom[]> = {};
  roles: string[] = [];

  constructor(config: any = null) {
    super((config = config || {}));
    this.cycle = config.cycle || null;
  }

  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return "Line";
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.cycle = this.cycle?.clone() || null;
    another.roles = [...this.roles];
    for (const role in this.atoms) {
      another.addAtoms(role, ...this.atoms[role]);
    }
  }

  addAtoms(role: string, ...atoms: Atom[]): this {
    this.ensureRole(role);
    const roleAtoms = this.atoms[role];
    for (const atom of atoms) roleAtoms.push(atom);
    return this;
  }

  ensureRole(role: string, roleDuration = ZERO): this {
    // Ensure we have this many roles
    if (!(role in this.atoms)) {
      this.atoms[role] = [];
      this.roles.push(role);
    }
    this.ensureRoleDuration(role, roleDuration);
    return this;
  }

  /**
   * Returns the maximum duration of all roles in this line.
   */
  get duration(): TSU.Num.Fraction {
    let max = ZERO;
    for (const role of this.roles) {
      max = TSU.Num.Fraction.max(this.roleDuration(role), max);
    }
    return max;
  }

  /**
   * Duration for a particular role in this line.
   */
  roleDuration(role: string): TSU.Num.Fraction {
    let total = ZERO;
    for (const atom of this.atoms[role]) {
      total = total.plus(atom.duration);
    }
    return total;
  }

  /**
   * Ensures this role has given length by padding with Spaces if necessary.
   * If duration is already greater than length then no trimming will
   * be done.
   */
  ensureRoleDuration(role: string, length: TSU.Num.Fraction): this {
    const diff = length.minus(this.duration);
    const atoms = this.atoms[role];
    if (diff.cmp(ZERO) > 0) {
      atoms.push(new Space(diff, true));
    }
    return this;
  }
}
