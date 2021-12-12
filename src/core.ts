import * as TSU from "@panyam/tsutils";

/**
 * Alias to TSU.Num.Fraction in tsutils.
 */
type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

/**
 * A common Entity base class with support for unique IDs, copying, children and debug info.
 */
export class Entity {
  private static counter = 0;
  readonly uuid = Entity.counter++;
  metadata: TSU.StringMap<any>;
  parent: TSU.Nullable<Entity> = null;

  constructor(config: any = null) {
    config = config || {};
    this.metadata = config.metadata || {};
  }

  /**
   * debugValue returns information about this entity to be printed during a debug.
   * Usually overridden by children to add more debug info.
   */
  debugValue(): any {
    if (Object.keys(this.metadata).length > 0) return { metadata: this.metadata, type: this.type };
    else return { type: this.type };
  }

  /**
   * Children of this entity.
   */
  children(): Entity[] {
    return [];
  }

  /**
   * Property returning the count of child entities.
   */
  get childCount(): number {
    return this.children().length;
  }

  /**
   * Adds a child entity at a given index.
   * @param child   Child entity to be aded.
   * @param index   Index where the child is to be inserted.  -1 to append at the end.
   */
  addChild(child: Entity, index = -1): this {
    if (index < 0) {
      this.children().push(child);
    } else {
      this.children().splice(index, 0, child);
    }
    return this;
  }

  /**
   * Returns the child at a given index.
   */
  childAt(index: number): Entity {
    return this.children()[index];
  }

  /**
   * Returns the index of a given child entity.
   *
   * @return the index where child exists otherwise -1.
   */
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
   *
   * Type properties are used to identify the class type of Entities.
   */
  get type(): unknown {
    return this.constructor.name;
  }

  /**
   * Simple string representation of this Entity.
   */
  toString(): string {
    return `Entity(id = ${this.uuid})`;
  }

  equals(another: this, expect = false): boolean {
    if (this.type != another.type) return false;
    // check metadata too
    return true;
  }

  /**
   * All entities allow cloning in a way that is specific to the entity.
   * This allows application level "copy/pasting" of entities.  Cloning
   * is a two part process:
   *
   * * Creation of a new instance of the same type via this.newInstance()
   * * Copying of data into the new instance.
   *
   * Both of these can be overridden.
   */
  clone(): this {
    const out = this.newInstance();
    this.copyTo(out);
    return out;
  }

  /**
   * Copies information about this instance into another instance of the same type.
   */
  copyTo(another: this): void {
    another.metadata = { ...this.metadata };
  }

  /**
   * First part of the cloning process where the instance is created.
   */
  protected newInstance(): this {
    return new (this.constructor as any)();
  }
}

/**
 * Music is all about timing!   TimedEntities are base of all entities that
 * have a duration.
 */
export abstract class TimedEntity extends Entity {
  /**
   * Duration of this entity in beats.
   * By default entities durations are readonly
   */
  abstract get duration(): Fraction;

  equals(another: this): boolean {
    return super.equals(another) && this.duration.equals(another.duration);
  }
}

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

  constructor(duration = ONE) {
    super();
    this._duration = duration || ONE;
  }

  debugValue(): any {
    return this.duration.isOne
      ? super.debugValue()
      : { ...super.debugValue(), duration: this.duration.factorized.toString() };
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

export type CyclePosition = [number, number, number];
export type CycleIterator = Generator<[CyclePosition, Fraction]>;

export class CycleCursor {
  constructor(public readonly cycle: Cycle, public barIndex = 0, public beatIndex = 0, public instance = 0) {}

  get next(): [CyclePosition, Fraction] {
    const currBar = this.cycle.bars[this.barIndex];
    const result: [CyclePosition, Fraction] = [
      [this.barIndex, this.beatIndex, this.instance],
      currBar.beatLengths[this.beatIndex],
    ];
    this.instance++;
    if (!currBar.beatCounts[this.beatIndex] || this.instance >= currBar.beatCounts[this.beatIndex]) {
      this.instance = 0;
      this.beatIndex++;
      if (this.beatIndex >= currBar.beatLengths.length) {
        this.beatIndex = 0;
        this.barIndex++;
        if (this.barIndex >= this.cycle.bars.length) {
          this.barIndex = 0;
        }
      }
    }
    return result;
  }

  get prev(): [CyclePosition, Fraction] {
    const currBar = this.cycle.bars[this.barIndex];
    const result: [CyclePosition, Fraction] = [
      [this.barIndex, this.beatIndex, this.instance],
      currBar.beatLengths[this.beatIndex],
    ];
    // TODO - result should be set *after* decrementing if we had already
    // done a "next" before this otherwise user may have to do a prev twice
    this.instance--;
    if (this.instance < 0) {
      this.beatIndex--;
      if (this.beatIndex < 0) {
        this.barIndex--;
        if (this.barIndex < 0) {
          this.barIndex = this.cycle.bars.length - 1;
        }
        this.beatIndex = this.cycle.bars[this.barIndex].beatCount - 1;
      }
      this.instance = (this.cycle.bars[this.barIndex].beatCounts[this.beatIndex] || 1) - 1;
    }
    return result;
  }
}

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

  get totalBeatCount(): number {
    let out = 0;
    for (let i = 0; i < this.beatLengths.length; i++) {
      out += this.beatCounts[i] || 1;
    }
    return out;
  }

  /**
   * Total duration (of time) across all beats in this bar.
   */
  get duration(): Fraction {
    let total = ZERO;
    for (let i = 0; i < this.beatLengths.length; i++) {
      total = total.plus(this.beatLengths[i].timesNum(this.beatCounts[i] || 1));
    }
    return total;
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

  /**
   * Given a global beat index returns four values [cycle,bar,beat,instance] where:
   *
   * cycle        - The nth cycle in which the beat lies.  Since the global beat
   *                index can be greater the number of beats in this cycle this
   *                allows us to wrap around.  Similarly if beatindex is less than
   *                0 then we can also go behind a cycle.
   * bar          - The mth bar in the nth cycle which the offset exists
   * beat         - The beat within the mth bar in the nth cycle where the
   *                offset lies
   * instance     - The beat instance where the offset lies.
   * startOffset  - Offset of the beat at this global index.
   */
  getAtIndex(globalIndex: number): [number, CyclePosition, Fraction] {
    let cycle = 0;
    while (globalIndex < 0) {
      globalIndex += this.totalBeatCount;
      cycle--;
    }
    if (globalIndex >= this.totalBeatCount) {
      cycle = Math.floor(globalIndex / this.totalBeatCount);
    }
    globalIndex = globalIndex % this.totalBeatCount;
    let offset = ZERO;
    for (let barIndex = 0; barIndex < this.bars.length; barIndex++) {
      const bar = this.bars[barIndex];
      if (globalIndex >= bar.totalBeatCount) {
        globalIndex -= bar.totalBeatCount;
        offset = offset.plus(bar.duration);
      } else {
        // this is the bar!
        for (let beatIndex = 0; beatIndex < bar.beatCount; beatIndex++) {
          const beatLength = bar.beatLengths[beatIndex];
          const beatCount = bar.beatCounts[beatIndex] || 1;
          if (globalIndex >= beatCount) {
            globalIndex -= beatCount;
            offset = offset.plus(beatLength.timesNum(beatCount));
          } else {
            // this is it
            const instance = globalIndex;
            return [cycle, [barIndex, beatIndex, instance], offset.plus(beatLength.timesNum(instance))];
          }
        }
      }
    }
    throw new Error("Should not be here!");
  }

  /**
   * Given a global offset returns five values [cycle, bar,beat,instance,offset] where:
   *
   * cycle        - The nth cycle in which the beat lies.  Since the global offset can be
   *                greater the duration of the cycle this allows us to wrap around.
   *                Similarly if globalOffset is less than 0 then we can also go behind a cycle.
   * bar          - The mth bar in the nth cycle which the offset exists
   * beat         - The beat within the mth bar in the nth cycle where the offset lies
   * instance     - The beat instance where the offset lies.
   * startOffset  - The note offset within the beat where the global offset lies.
   * globalIndex  - The beat index within the entire cycle and not just within the bar.
   */
  getPosition(globalOffset: Fraction): [number, CyclePosition, Fraction, number] {
    const duration = this.duration;
    let cycleNum = 0;
    if (globalOffset.isLT(ZERO)) {
      while (globalOffset.isLT(ZERO)) {
        cycleNum--;
        globalOffset = globalOffset.plus(duration);
      }
    } else if (globalOffset.isGTE(duration)) {
      const realOffset = globalOffset.mod(duration);
      globalOffset = globalOffset.minus(realOffset).divby(duration);
      TSU.assert(globalOffset.isWhole);
      cycleNum = globalOffset.floor;
      globalOffset = realOffset;
    }

    // here globalOffset is positive and >= 0 and < this.duration
    let globalIndex = 0;
    for (let barIndex = 0; barIndex < this.bars.length; barIndex++) {
      const bar = this.bars[barIndex];
      const barDuration = bar.duration;
      if (globalOffset.isGTE(barDuration)) {
        globalOffset = globalOffset.minus(barDuration);
      } else {
        // this is the bar!
        for (let beatIndex = 0; beatIndex < bar.beatCount; beatIndex++) {
          const beatLength = bar.beatLengths[beatIndex];
          const beatCount = bar.beatCounts[beatIndex] || 1;
          for (let instance = 0; instance < beatCount; instance++, globalIndex++) {
            if (globalOffset.isGTE(beatLength)) {
              globalOffset = globalOffset.minus(beatLength);
            } else {
              // this is it
              return [cycleNum, [barIndex, beatIndex, instance], globalOffset, globalIndex];
            }
          }
        }
      }
      globalIndex += bar.totalBeatCount;
    }

    throw new Error("Should not be here!");
  }

  *iterateBeats(startBar = 0, startBeat = 0, startInstance = 0): CycleIterator {
    let barIndex = startBar;
    let beatIndex = startBeat;
    let instanceIndex = startInstance;
    while (true) {
      const currBar = this.bars[barIndex];
      yield [[barIndex, beatIndex, instanceIndex], currBar.beatLengths[beatIndex]];
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

  get totalBeatCount(): number {
    let out = 0;
    for (const bar of this.bars) out += bar.totalBeatCount;
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
  // Line can have atoms starting "before" the cycle.  The offset tells how many notes
  // before or after the cycle this line's atoms start at.
  offset: Fraction = ZERO;
  roles: Role[] = [];

  // This is a very hacky solution to doing left side pre-margin text typically found
  // in notations - eg line X of a pallavi has this.  This makes vertical space less wasteful
  // A better solution is inter-beat annotation but it is very complex and ambiguous for now
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
