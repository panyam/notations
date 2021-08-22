import * as TSU from "@panyam/tsutils";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

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
    return this.constructor.name;
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
  abstract get duration(): Fraction;

  equals(another: this): boolean {
    return super.equals(another) && this.duration.equals(another.duration);
  }
}

export enum AtomType {
  NOTE = "Note",
  LITERAL = "Literal",
  SYLLABLE = "Syllable",
  SPACE = "Space",
  GROUP = "Group",
  LABEL = "Label",
  REST = "Rest",
}

export abstract class Atom extends TimedEntity {
  protected _duration: Fraction;
  nextSibling: TSU.Nullable<Atom> = null;
  prevSibling: TSU.Nullable<Atom> = null;

  constructor(duration = ONE) {
    super();
    this._duration = duration || ONE;
  }

  debugValue(): any {
    return this.duration.isOne ? super.debugValue() : { ...super.debugValue(), duration: this.duration.toString() };
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

export class Label extends Atom {
  content: string;
  constructor(content: string, duration = ZERO) {
    super(duration);
    this.content = content;
  }

  debugValue(): any {
    return { ...super.debugValue(), content: this.content };
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

export abstract class LeafAtom extends Atom {
  // Tells if this atom is followed by a rest
  beforeRest = false;

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
}

export class Literal extends LeafAtom {
  /**
   * The value of this Syllable.
   */
  value: string;

  constructor(value: string, duration = ONE) {
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
}

export class Syllable extends Literal {
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
  shift = 0;

  constructor(value: string, duration = ONE, octave = 0, shift = 0) {
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
}

export class Group extends Atom {
  /**
   * This indicates whether our duration is static or linear to number of
   * atoms in this group.
   */
  durationIsMultiplier = false;
  readonly atoms: TSU.Lists.ValueList<Atom> = new TSU.Lists.ValueList<Atom>();

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

  addAtoms(...atoms: Atom[]): this {
    for (const atom of atoms) {
      if (atom.type == AtomType.REST) {
        const last = this.atoms.last;
        if (last && last.type != AtomType.GROUP && last.type != AtomType.LABEL) {
          (last as LeafAtom).beforeRest = true;
        }
      } else {
        atom.parent = this;
        this.atoms.add(atom);
      }
    }
    return this;
  }
}

export type CyclePosition = [Fraction, number, number, number];
export type CycleIterator = Generator<CyclePosition>;

export class Bar extends TimedEntity {
  name: string;
  // Length/Duration of each beat.
  beatLengths: Fraction[] = [];

  // How many times should a beat be repeated - the Kalai!
  beatCounts: number[] = [];

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
    for (const bc of config.beatCounts || []) {
      this.beatCounts.push(bc);
    }
    while (this.beatCounts.length < this.beatLengths.length) {
      this.beatCounts.push(1);
    }
  }

  debugValue(): any {
    return { ...super.debugValue(), name: name, beatLengths: this.beatLengths };
  }

  equals(another: this): boolean {
    if (!super.equals(another)) return false;
    if (this.beatLengths.length != another.beatLengths.length) return false;
    if (this.beatCounts.length != another.beatCounts.length) return false;
    for (let i = 0; i < this.beatLengths.length; i++) {
      if (!this.beatLengths[i].equals(another.beatLengths[i])) return false;
    }
    for (let i = 0; i < this.beatCounts.length; i++) {
      if (this.beatCounts[i] != another.beatCounts[i]) return false;
    }
    return true;
  }

  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.beatLengths = [...this.beatLengths];
    another.beatCounts = [...this.beatCounts];
  }

  get beatCount(): number {
    return this.beatLengths.length;
  }

  /**
   * Total duration (of time) across all beats in this bar.
   */
  get duration(): Fraction {
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

  constructor(config: null | { name?: string; bars?: Bar[] } = null) {
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

  *iterateBeats(startBar = 0, startBeat = 0, startInstance = 0): CycleIterator {
    let barIndex = startBar;
    let beatIndex = startBeat;
    let instanceIndex = startInstance;
    while (true) {
      const currBar = this.bars[barIndex];
      yield [currBar.beatLengths[beatIndex], barIndex, beatIndex, instanceIndex];
      instanceIndex++;
      if (!currBar.beatCounts[beatIndex] || instanceIndex >= currBar.beatCounts[beatIndex]) {
        instanceIndex = 0;
        beatIndex++;
        if (beatIndex >= currBar.beatLengths.length) {
          beatIndex = 0;
          barIndex++;
          if (barIndex >= this.bars.length) {
            barIndex = 0;
          }
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
  get duration(): Fraction {
    return this.bars.reduce((x, y) => x.plus(y.duration), ZERO);
  }
}

export class Line extends Entity {
  roles: Role[] = [];
  // layoutParams: LayoutParams | null = null;

  debugValue(): any {
    return {
      ...super.debugValue(),
      roles: this.roles.map((r) => r.debugValue()),
      // layoutParams: this.layoutParams?.uuid,
    };
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
