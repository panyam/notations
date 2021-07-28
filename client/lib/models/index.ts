import * as TSU from "@panyam/tsutils";

const ZERO = TSU.Num.Fraction.ZERO;

export class Entity {
  private static counter = 0;
  readonly uuid = Entity.counter++;
  metadata: TSU.StringMap<any>;
  parent: TSU.Nullable<Entity> = null;

  constructor(config: any = null) {
    config = config || {};
    this.metadata = config.metadata || {};
  }

  debugValue(): any {
    if (Object.keys(this.metadata).length > 0) return { metadata: this.metadata, type: this.type };
    else return { type: this.type };
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
  LITERAL,
  SYLLABLE,
  SPACE,
  GROUP,
  LABEL,
}

export type Atom = LeafAtom | Group | Label;

export abstract class AtomBase extends TimedEntity {
  protected _duration: TSU.Num.Fraction;

  constructor(duration = TSU.Num.Fraction.ONE) {
    super();
    this._duration = duration || TSU.Num.Fraction.ONE;
  }

  debugValue(): any {
    return this.duration.isOne ? super.debugValue() : { ...super.debugValue(), duration: this.duration.toString() };
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.duration = new TSU.Num.Fraction(this.duration.num, this.duration.den);
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

  debugValue(): any {
    return { ...super.debugValue(), content: this.content };
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
   * Tells if this is a silent space or a continuation of previous note.
   */
  isSilent = false;

  constructor(duration = TSU.Num.Fraction.ONE, isSilent = false) {
    super(duration);
    this.isSilent = isSilent;
  }

  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return AtomType.SPACE;
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
}

export class Literal extends LeafAtom {
  /**
   * The value of this Syllable.
   */
  value: string;

  constructor(value: string, duration = TSU.Num.Fraction.ONE) {
    super(duration);
    this.value = value;
  }

  debugValue(): any {
    return { ...super.debugValue(), value: this.value };
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

  get type(): unknown {
    return AtomType.LITERAL;
  }
}

export class Syllable extends Literal {
  toString(): string {
    return `Syll(${this.duration}-${this.value})`;
  }

  get type(): unknown {
    return AtomType.SYLLABLE;
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
  shift = 0;

  constructor(value: string, duration = TSU.Num.Fraction.ONE, octave = 0, shift = 0) {
    super(value, duration);
    this.octave = octave;
    this.shift = shift;
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

  get type(): unknown {
    return AtomType.NOTE;
  }
}

export class Group extends AtomBase {
  /**
   * This indicates whether our duration is static or linear to number of
   * atoms in this group.
   */
  durationIsMultiplier = false;
  readonly atoms: TSU.Lists.List<AtomBase> = new TSU.Lists.List<AtomBase>();

  constructor(duration = TSU.Num.Fraction.ONE, ...atoms: Atom[]) {
    super(duration);
    this.addAtoms(...atoms);
  }

  get duration(): TSU.Num.Fraction {
    if (this.durationIsMultiplier) {
      return this.totalChildDuration.divby(this._duration);
    } else {
      return this._duration;
    }
  }

  set duration(d: TSU.Num.Fraction) {
    this._duration = d;
  }

  debugValue(): any {
    const out = { ...super.debugValue(), atoms: Array.from(this.atoms.values(), (a) => a.debugValue()) };
    if (this.durationIsMultiplier) out.durationIsMultiplier = true;
    return out;
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

export class Bar extends TimedEntity {
  name: string;
  beatLengths: TSU.Num.Fraction[] = [];
  // TODO: also add "visuals" at some point

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

  debugValue(): any {
    return { ...super.debugValue(), name: name, beatLengths: this.beatLengths };
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

  get beatCount(): number {
    return this.beatLengths.length;
  }

  /**
   * Total duration (of time) across all beats in this bar.
   */
  get duration(): TSU.Num.Fraction {
    return this.beatLengths.reduce((x, y) => x.plus(y), ZERO);
  }
}

// Describes the cycle pattern
export class Cycle extends TimedEntity {
  name: string;
  bars: Bar[];

  static readonly DEFAULT = new Cycle({
    name: "Adi Thalam",
    bars: [
      new Bar({ name: "Laghu", beatLengths: [1, 1, 1, 1] }),
      new Bar({ name: "Dhrutam", beatLengths: [1, 1] }),
      new Bar({ name: "Dhrutam", beatLengths: [1, 1] }),
    ],
  });

  constructor(config: any = null) {
    super((config = config || {}));
    this.name = config.name || "";
    this.bars = config.bars || [];
  }

  debugValue(): any {
    return { ...super.debugValue(), name: name, bars: this.bars.map((p) => p.debugValue()) };
  }

  children(): Entity[] {
    return this.bars;
  }

  equals(another: this): boolean {
    if (!super.equals(another)) {
      return false;
    }
    if (this.bars.length != another.bars.length) return false;
    for (let i = 0; i < this.bars.length; i++) {
      if (!this.bars[i].equals(another.bars[i])) return false;
    }
    return true;
  }

  *iterateBeats(startBar = 0, startBeat = 0): CycleIterator {
    let currBar = startBar;
    let currBeat = startBeat;
    while (true) {
      yield [this.bars[currBar].beatLengths[currBeat], currBar, currBeat];
      currBeat++;
      if (currBeat >= this.bars[currBar].beatLengths.length) {
        currBeat = 0;
        currBar++;
        if (currBar >= this.bars.length) {
          currBar = 0;
        }
      }
    }
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.bars = this.bars.map((x) => x.clone());
  }

  get beatCount(): number {
    let out = 0;
    for (const bar of this.bars) out += bar.beatCount;
    return out;
  }

  /**
   * Total duration (of time) across all bars in this cycle.
   */
  get duration(): TSU.Num.Fraction {
    return this.bars.reduce((x, y) => x.plus(y.duration), ZERO);
  }
}

export class Role extends Entity {
  atoms: Atom[] = [];
  private layoutLine = -1;

  constructor(public readonly line: Line, public readonly name: string) {
    super();
  }
  debugValue(): any {
    return { name: this.name, atoms: this.atoms };
  }

  addAtoms(...atoms: Atom[]): void {
    for (const atom of atoms) this.atoms.push(atom);
  }

  copyTo(another: Role): void {
    another.addAtoms(...this.atoms);
  }

  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return "Role";
  }

  /**
   * Duration for this role.
   */
  get duration(): TSU.Num.Fraction {
    return this.atoms.reduce((a, b) => a.plus(b.duration), ZERO);
  }
}

export class Line extends Entity {
  cycle: TSU.Nullable<Cycle> = null;
  // atoms: TSU.StringMap<Atom[]> = {};
  roles: Role[] = [];

  constructor(config: any = null) {
    super((config = config || {}));
    this.cycle = config.cycle || null;
  }

  debugValue(): any {
    return { ...super.debugValue(), cycle: this.cycle?.debugValue(), roles: this.roles.map((r) => r.debugValue()) };
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
    another.roles = this.roles.map((r) => r.clone());
  }

  addAtoms(roleName: string, ...atoms: Atom[]): this {
    const role = this.ensureRole(roleName);
    role.addAtoms(...atoms);
    return this;
  }

  ensureRole(roleName: string): Role {
    // Ensure we have this many roles
    let ri = this.roles.findIndex((r) => r.name == roleName);
    if (ri < 0) {
      ri = this.roles.length;
      this.roles.push(new Role(this, roleName));
    }
    return this.roles[ri];
  }

  /**
   * Returns the maximum duration of all roles in this line.
   */
  get duration(): TSU.Num.Fraction {
    let max = ZERO;
    for (const role of this.roles) {
      max = TSU.Num.Fraction.max(role.duration, max);
    }
    return max;
  }
}
