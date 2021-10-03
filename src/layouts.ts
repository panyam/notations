import * as TSU from "@panyam/tsutils";
import { Line, Atom, CycleIterator, Space, Role, Cycle, CyclePosition, CycleCursor } from "./";
import { AtomIterator, DurationIterator, FlatAtom } from "./iterators";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

// export interface Embelishment { refreshLayout(): void; }

interface BeatViewDelegate {
  // A way to create all beats for an entire Line in one go (instead of one by one)
  viewForBeat(beat: Beat): BeatView;
}

export interface BeatView {
  readonly beat: Beat;
  readonly needsLayout: boolean;
  readonly minSize: TSU.Geom.Size;
  x: number;
  y: number;
  width: number;
  height: number;
  refreshLayout(): void;
  setStyles(config: any): void;
  // readonly embelishments: Embelishment[];
}

export class Beat {
  private static idCounter = 0;
  layoutLine = -1;
  layoutColumn = -1;
  readonly uuid = Beat.idCounter++;
  // Should this be as flat Atoms or should we keep it as atoms and breakdown
  // later?
  readonly atoms: FlatAtom[] = [];
  constructor(
    public readonly index: number,
    public readonly role: Role,
    public readonly offset: Fraction,
    public readonly duration: Fraction,
    public readonly barIndex: number,
    public readonly beatIndex: number,
    public readonly instance: number,
    public readonly prevBeat: null | Beat,
    public nextBeat: null | Beat,
  ) {}

  debugValue(): any {
    return {
      index: this.index,
      role: this.role.name,
      offset: this.offset.toString(),
      duration: this.duration.toString(),
      barIndex: this.barIndex,
      beatIndex: this.beatIndex,
      instance: this.instance,
      atoms: this.atoms.map((a) => a.debugValue()),
    };
  }

  get endOffset(): Fraction {
    return this.offset.plus(this.duration);
  }

  get filled(): boolean {
    return this.remaining.isZero;
  }

  get remaining(): Fraction {
    return this.duration.minus(this.atoms.reduce((a, b) => a.plus(b.duration), ZERO));
  }

  add(atom: FlatAtom): boolean {
    if (this.remaining.cmp(atom.duration) < 0) {
      return false;
    }
    this.atoms.push(atom);
    return true;
  }

  ensureUniformSpaces(slotsPerBeat = 1): void {
    let lcm = 1;
    let gcd = 0;
    this.atoms.forEach((a, index) => {
      a.duration = a.duration.factorized;
      const currDen = a.duration.den;
      if (currDen != 1) {
        lcm *= currDen;
        if (gcd == 0) {
          gcd = a.duration.den;
        } else {
          gcd = TSU.Num.gcdof(gcd, currDen);
          lcm /= gcd;
        }
      }
    });

    // Easiest option is (without worrying about depths)
    // just adding this N number 1 / LCM sized spaces for
    // each note where N = (LCM / note.frac.den) - 1

    // eg in the case of something like (a beat with) the notes
    // A: 1/2, B: 1/4, C: 1/6
    // LCM (of dens) = 24
    // 12 (1/24) spaces, 6 (1/24)
    // A = (24 / 2) - 1 = 11 spaces after A
    // B = (24 / 4) - 1 = 5 spaces after B
    // C = (24 / 6) - 1 = 3 spaces after C
    // Total = 11 + 5 + 3 + 3 (for A + B + C) = 22 notes in the beat

    const baseDur = new TSU.Num.Fraction(1, lcm);
    let currOffset = this.offset;
    for (let i = 0; i < this.atoms.length; ) {
      const fa = this.atoms[i];
      const numSpaces = lcm == 1 ? fa.duration.num - 1 : lcm / fa.duration.den - 1;
      // reset its duration to 1 / LCM so we can add numSpaces after it
      fa.duration = baseDur;
      currOffset = currOffset.plus(baseDur);
      i++;
      for (let j = 0; j < numSpaces; j++, i++) {
        this.atoms.splice(
          i,
          0,
          new FlatAtom(new Space(), {
            isContinuation: true,
            offset: currOffset.factorized,
            duration: baseDur,
            depth: fa.depth,
          }),
        );
        currOffset = currOffset.plus(baseDur);
      }
    }
  }
}

/**
 * Grouping of beats by their column based on the layout params.
 * The confusion is we have beats broken up and saved in columns
 * but we are loosing how a line is supposed to access it in its own way
 * we have beatsByRole for getting all beats for a role (in a line)
 * sequentially we have beatColumns for getting all beats in a particular
 * column across all lines and roles globally.
 *
 * What we want here is for a given line get all roles, their beats
 * in zipped way.  eg for a Line with 3 roles and say 10 beats each
 * (with the breaks of 4, 1) we need:
 *
 * R1 B1 R1 B2 R1 B3 R1 B4
 * R2 B1 R2 B2 R2 B3 R2 B4
 * R3 B1 R3 B2 R3 B3 R3 B4
 *
 * R1 B5
 * R2 B5
 * R3 B5
 *
 * R1 B6 R1 B7 R1 B8 R1 B9
 * R2 B6 R2 B7 R2 B8 R2 B9
 * R3 B6 R3 B7 R3 B8 R3 B9
 *
 * R1 B10
 * R2 B10
 * R3 B10
 *
 *
 * Here we have 5 distinct beat columns:
 *
 * 1: R1B1, R2B1, R3B1, R1B6, R2B6, R3B6,
 * 2: R1B2, R2B2, R3B2, R1B7, R2B7, R3B7,
 * 3: R1B3, R2B3, R3B3, R1B8, R2B8, R3B8,
 * 4: R1B4, R2B4, R3B4, R1B9, R2B9, R3B9,
 * 5: R1B5, R2B5, R3B5, R1B10, R2B10, R3B10,
 *
 */
export class BeatLayout {
  // beatColumns[i][j] returns all beats in a particular layoutLine and
  // layoutColumn the purpose of beatColumns is to ensure horizontal alignment
  // of beats in a single column
  bcolNextList = new Map<string, Set<string>>();
  beatColumns = new Map<string, BeatColumn>();
  // bcolsStartingAt = new Map<string, BeatColumn[]>();
  // bcolsEndingAt = new Map<string, BeatColumn[]>();
  startingColumns: BeatColumn[] = [];

  // Mapping from beat -> BeatColumn where it resides
  columnForBeat = new Map<number, BeatColumn>();

  constructor(public readonly layoutParams: LayoutParams) {}

  /**
   * Gets the beat column of a given duration at the given offset.
   */
  getBeatColumn(offset: Fraction, duration: Fraction): BeatColumn {
    const key = BeatLayout.keyFor(offset, duration);
    let bcol = this.beatColumns.get(key) || null;
    if (!bcol) {
      bcol = new BeatColumn(offset, duration);
      this.beatColumns.set(key, bcol);
      if (bcol.offset.isZero) {
        // this is a "starting" column
        this.startingColumns.push(bcol);
      } else {
        const endOffset = offset.plus(duration);
        // Find all columns "before" this and add this as a neighbour to those
        // columsn before are such that their prev.offset + prev.duration == bcol.offset
        for (const other of this.beatColumns.values()) {
          if (other.offset.plus(other.duration).equals(offset)) {
            // mark us as a successor of other
            this.addSuccessor(other, bcol);
          } else if (other.offset.equals(endOffset)) {
            // mark other as a successor of us
            this.addSuccessor(bcol, other);
          }
        }

        // Similary find all columns who could "next" sets and add us to them
      }
    }
    return bcol;
  }

  protected static keyFor(offset: Fraction, duration: Fraction): string {
    return offset.factorized.toString() + ":" + duration.factorized.toString();
  }

  protected addSuccessor(prev: BeatColumn, next: BeatColumn): void {
    TSU.assert(prev.offset.plus(prev.duration).equals(next.offset), "BeatColumns are not adjacent to each other");
    const prevKey = BeatLayout.keyFor(prev.offset, prev.duration);
    const nextKey = BeatLayout.keyFor(next.offset, next.duration);
    let nextset = this.bcolNextList.get(prevKey) || null;
    if (!nextset) {
      nextset = new Set<string>();
      this.bcolNextList.set(prevKey, nextset);
    }
    nextset.add(nextKey);
  }

  /**
   * Adds the beat to this layout and returns the BeatColumn to which this beat was added.
   */
  addBeat(beat: Beat): BeatColumn {
    // Get the beat column at this index (and line) and add to it.
    const lp = this.layoutParams;
    const [layoutLine, layoutColumn, rowOffset] = lp.getBeatLocation(beat);
    const bcol = this.getBeatColumn(rowOffset, beat.duration);

    bcol.add(beat);

    // TODO: see if beat exists in another column
    this.columnForBeat.set(beat.uuid, bcol);
    beat.layoutLine = layoutLine;
    beat.layoutColumn = layoutColumn;
    return bcol;
  }

  /**
   * Return all beat columns that start immediately after the given beat column.
   */
  neighborsOf(beatColumn: BeatColumn): BeatColumn[] {
    const out: BeatColumn[] = [];
    const endOffset = beatColumn.offset.plus(beatColumn.duration);
    for (const other of this.beatColumns.values()) {
      if (endOffset.equals(other.offset)) {
        out.push(other);
      }
    }
    return out;
  }

  readonly DEBUG = false;
  evalColumnSizes(beatViewDelegate: BeatViewDelegate): void {
    // Do a bread first traversal of the beat columns so those with earlier offsets will be
    // laidout and nudged so that later ones' offsets can be set only once.
    // TODO - should this be a priority queue - ie is there a need to sort these by
    // "larger" widths first?
    let queue: BeatColumn[] = [...this.startingColumns];
    const xForOffsets: TSU.StringMap<number> = {};
    while (queue.length > 0) {
      const nextQueue: BeatColumn[] = [];
      for (const bcol of queue) {
        const offset = bcol.offset.factorized;
        const colWidth = bcol.evalMaxWidth(beatViewDelegate);
        let currX = 0;
        if (!bcol.offset.isZero) {
          // this *must* be in xForOffsets as it would have been calculated by a previous bcol
          TSU.assert(offset.toString() in xForOffsets, "Cannot find x for given offset");
          currX = xForOffsets[offset.toString()];
        }
        bcol.setX(currX, beatViewDelegate);
        const endOffset = offset.plus(bcol.duration).factorized;
        xForOffsets[endOffset.toString()] = Math.max(
          xForOffsets[endOffset.toString()] || 0,
          currX + colWidth + bcol.paddingLeft + bcol.paddingRight,
        );
        // add all neighbours here
        // TODO - Use better lists of going through all beat cols
        // Also ensure we are adding in sorted order and avoiding duplicates
        for (const other of this.beatColumns.values()) {
          if (endOffset.equals(other.offset)) {
            nextQueue.push(other);
          }
        }
      }
      queue = nextQueue;
    }
  }

  // Spacing between each role in a single row
  roleSpacing = 10;

  // Spacing between each row (a row can consist of multiple roles).
  rowSpacing = 15;
  layoutBeatsForLine(line: Line, allRoleBeats: Beat[][], beatViewDelegate: BeatViewDelegate): void {
    // Instead of starting currLayoutLine at 0 - it should start at the line of the
    // first beat being rendered
    const lp = this.layoutParams;
    const currBeats = line.roles.map((l, index) => allRoleBeats[index][0]) as (Beat | null)[];
    let currY = this.roleSpacing;
    let numDone = 0;
    do {
      numDone = 0;
      // Lay one role at a time upto numBeatsInLine number of beats
      for (let currRole = 0; currRole < currBeats.length; currRole++) {
        let currBeat: Beat | null = currBeats[currRole];
        if (currBeat) {
          const temp = currBeat;
          const numBeatsInRow = lp.lineBreaks[currBeat.layoutLine];
          let maxHeight = 0;
          let currX = 0;
          for (
            let i = currBeat.layoutColumn;
            i < numBeatsInRow && currBeat;
            i++, currBeat = currBeat.nextBeat, numDone++
          ) {
            const beatView = beatViewDelegate.viewForBeat(currBeat);
            beatView.y = currY;
            if (this.DEBUG) {
              beatView.x = currX;
              beatView.refreshLayout();
              currX += beatView.width;
            }
            maxHeight = Math.max(maxHeight, beatView.minSize.height);
          }

          currBeat = temp;
          for (
            let i = currBeat.layoutColumn;
            i < numBeatsInRow && currBeat;
            i++, currBeat = currBeat.nextBeat, numDone++
          ) {
            const beatView = beatViewDelegate.viewForBeat(currBeat);
            beatView.height = maxHeight;
          }
          // Should line heights be "fixed"?
          // Set height of all views in this row to same height and Y
          currY += maxHeight;
          currY += this.roleSpacing;
        }
        currBeats[currRole] = currBeat;
      }

      // currLayoutLine = (currLayoutLine + 1) % lp.lineBreaks.length;
      currY += this.rowSpacing;
    } while (numDone > 0);
  }
}

export class BeatRow {
  protected _y = 0;
  protected _maxHeight = 0;
  needsLayout = false;
  rowSpacing = 5;
  beats: Beat[] = [];
  constructor(public readonly layoutLine: number, public rowIndex: number) {}

  get y(): number {
    return this._y;
  }

  set y(val: number) {
    this._y = val;
    this.needsLayout = true;
  }

  add(beat: Beat): void {
    // Find line this view should be added to.
    // TODO - Should we check if this beat was already added to either this row or another row?
    this.beats.push(beat);
    this.needsLayout = true;
  }
}

export class BeatColumn {
  protected _x = 0;
  protected _maxWidth = 0;
  needsLayout = false;
  atomSpacing = 5;
  paddingLeft = 15;
  paddingRight = 15;
  beats: Beat[] = [];
  constructor(public readonly offset: Fraction, public readonly duration: Fraction) {
    offset = offset.factorized;
    duration = duration.factorized;
  }

  get x(): number {
    return this._x;
  }

  setX(val: number, beatViewDelegate: BeatViewDelegate): void {
    this._x = val;
    for (const beat of this.beats) {
      const beatView = beatViewDelegate.viewForBeat(beat);
      beatView.x = val + this.paddingLeft;
      beatView.width = this._maxWidth;
      // console.log("ID, Setting x, width: ", beatView.beat.index, (beatView as any).x, (beatView as any).width);
    }
  }

  get maxWidth(): number {
    return this._maxWidth + this.paddingLeft + this.paddingRight;
  }

  setPadding(left: number, right: number): void {
    if (left >= 0) {
      this.paddingLeft = left;
    }
    if (right >= 0) {
      this.paddingRight = right;
    }
  }

  evalMaxWidth(beatViewDelegate: BeatViewDelegate): number {
    this._maxWidth = 0;
    for (const beat of this.beats) {
      const beatView = beatViewDelegate.viewForBeat(beat);
      // console.log( "index, _minSize, refreshMinSize = ", beatView.beat.index, (beatView as any)._minSize, (beatView as any).refreshMinSize(),);
      const minSize = beatView.minSize;
      if (minSize.width > this._maxWidth) {
        this._maxWidth = minSize.width;
      }
    }
    return this._maxWidth;
  }

  /**
   * Adds a new beat to this column.
   * Returns true if the column's width has increased.  This is an indicator
   * to the caller that a layout of all other views in this column is needed
   * so the refresh can be scheduled at some time.
   */
  add(beat: Beat): void {
    // Find line this view should be added to.
    // TODO - Should we check if this beat was already added?
    this.beats.push(beat);
    this.needsLayout = true;
    /*
    const beatView = this.viewForBeat(beat);
    beatView.add(atomView);

    const lineWidth = beatView.requiredWidth;
    if (lineWidth > this._maxWidth) {
      this._maxWidth = lineWidth;
      return beatView;
      // return true;
    } else {
      // Our width is already less than max width so apply layout
      // on this line only - ie the "entire" beat column does not need
      // an update.
      beatView.layout();
    }
    return null;
    */
  }
}

export class BeatsBuilder {
  // All atoms divided into beats
  readonly beats: Beat[] = [];
  readonly startIndex: number;
  readonly beatOffset: Fraction;
  cycleIter: CycleIterator;
  atomIter: AtomIterator;
  durIter: DurationIterator;

  // Callback for when an atom is added to this role.
  onAtomAdded: (flatAtom: FlatAtom, beat: Beat) => void;

  // Callback for when a new beat is added
  onBeatAdded: (beat: Beat) => void;
  // Callback for when a beat has been filled
  onBeatFilled: (beat: Beat) => void;

  constructor(
    public readonly role: Role,
    public readonly layoutParams: LayoutParams,
    public readonly startOffset: Fraction = ZERO,
  ) {
    const [, [bar, beat, instance], beatOffset, index] = layoutParams.cycle.getPosition(startOffset);
    this.cycleIter = layoutParams.cycle.iterateBeats(bar, beat, instance);
    this.atomIter = new AtomIterator();
    this.durIter = new DurationIterator(this.atomIter);
    this.beatOffset = beatOffset;

    // evaluate the start beatindex - typically it would be 0 if things start at beginning
    // of a cycle.  Butif the start offset is < 0 then the startIndex should also shift
    // accordingly
    this.startIndex = index;
  }

  protected addBeat(): Beat {
    const numBeats = this.beats.length;
    const lastBeat = numBeats == 0 ? null : this.beats[numBeats - 1];
    const nextCP: [CyclePosition, Fraction] = this.cycleIter.next().value;
    const apb = this.layoutParams.beatDuration;
    const newBeat = new Beat(
      lastBeat == null ? this.startIndex : lastBeat.index + 1,
      this.role,
      lastBeat == null ? this.startOffset.minus(this.beatOffset).timesNum(apb).factorized : lastBeat.endOffset,
      nextCP[1].timesNum(apb),
      nextCP[0][0],
      nextCP[0][1],
      nextCP[0][2],
      lastBeat,
      null,
    );
    if (lastBeat == null && this.beatOffset.isGT(ZERO)) {
      // Add spaces to fill up empty beats
      newBeat.add(new FlatAtom(new Space(this.beatOffset.timesNum(apb))));
    }
    if (lastBeat) lastBeat.nextBeat = newBeat;
    this.beats.push(newBeat);
    if (this.onBeatAdded) this.onBeatAdded(newBeat);
    return newBeat;
  }

  addAtoms(...atoms: Atom[]): void {
    // First add all atoms to the atom Iterator so we can
    // fetch them as FlatAtoms.  This is needed because atoms
    // passed here could be unflatted (via groups) or much larger
    // than what can fit in the given role/bar etc.  So this
    // flattening and windowing is needed before we add them
    // to the views - and this is done by the durationIterators.
    this.atomIter.push(...atoms);
    while (this.durIter.hasMore) {
      // get the last/current row and add a new one if it is full
      let currBeat = this.beats[this.beats.length - 1];

      // First add a row if last row is filled
      if (this.beats.length == 0 || currBeat.filled) {
        // what should be the beatlengths be here?
        currBeat = this.addBeat();
      }

      // For this beat get symbols in all roles
      const [flatAtoms, filled] = this.durIter.get(currBeat.remaining);
      TSU.assert(flatAtoms.length > 0, "Atleast one element should have been available here");
      // render the atoms now
      for (const flatAtom of flatAtoms) {
        TSU.assert(currBeat.add(flatAtom), "Should return true as we are already using a duration iterator here");
        if (this.onAtomAdded) this.onAtomAdded(flatAtom, currBeat);
      }
      if (currBeat.filled) {
        if (this.onBeatFilled) this.onBeatFilled(currBeat);
      }
    }
  }
}

export class LayoutParams {
  private static counter = 0;
  readonly uuid = LayoutParams.counter++;
  beatDuration: number;
  cycle: Cycle;
  protected _lineBreaks: number[];
  private _rowStartOffsets: Fraction[];
  private _rowEndOffsets: Fraction[];
  private _rowDurations: Fraction[];
  private _totalLayoutDuration;
  private _beatLayouts: [CyclePosition, Fraction][][];
  private _totalBeats: number;

  constructor(config?: any) {
    config = config || {};
    this.beatDuration = config.beatDuration || 1;
    if ("cycle" in config) this.cycle = config.cycle;
    if (!this.cycle || this.cycle.duration.isZero) {
      this.cycle = Cycle.DEFAULT;
    }

    this._rowStartOffsets = [];
    this._rowEndOffsets = [];
    this._rowDurations = [];
    this._totalLayoutDuration = ZERO;
    this._totalBeats = 0;
    this._beatLayouts = [];
    this.lineBreaks = config.lineBreaks || config.layout || [];
  }

  equals(another: this): boolean {
    return (
      // super.equals(another) &&
      this.beatDuration == another.beatDuration &&
      this.cycle.equals(another.cycle) &&
      this.lineBreaksEqual(another._lineBreaks)
    );
  }

  lineBreaksEqual(another: number[]): boolean {
    return this._lineBreaks.length == another.length && this._lineBreaks.every((x, i) => x == another[i]);
  }

  debugValue(): any {
    return {
      // ...super.debugValue(),
      cycle: this.cycle?.debugValue(),
      beatDuration: this.beatDuration,
      lineBreaks: this._lineBreaks,
    };
  }

  /**
   * Returns the "location" of a beat within a layout.
   *
   * Lines are broken into beats of notes (which can be changed) and those beats
   * are aligned as per the specs in the LayoutParams (breaks).
   *
   * This methods returns the triple: [layoutLine, layoutColumn, rowOffset]
   * where
   *
   *  layoutLine: The particular line in the layout break spec this index falls in.  Note
   *              that since lines can start with negative offsets, we can even return a
   *              layoutLine that is towards the end and then go back to 0, eg 4, 0, 1, 2, 3, 4 ...
   *  layoutColumn: The column within the layoutLine line where this beat falls.
   *  rowOffset: The note offset of the beat from the start of the row/line
   *             (not from the start of the cycle).
   *
   * Note the beatIndex can also be negative so we can return a beat starting from before
   * the cycle starting point.
   *
   *  To calculate the "real" line globally simply do:
   *
   *    realLine = [Math.floor(beatIndex / this.totalBeats) + layoutLine;
   */
  getBeatLocation(beat: Beat): [number, number, Fraction] {
    const modIndex = beat.index % this.totalBeats;
    let total = 0;
    for (let i = 0; i < this._lineBreaks.length; i++) {
      if (modIndex < total + this._lineBreaks[i]) {
        // TODO: What is the right offset here?
        let offset = ZERO;
        const startBeat = beat;
        if (modIndex > total) {
          const cursor = new CycleCursor(this.cycle, beat.barIndex, beat.beatIndex, beat.instance);
          let [pos, duration] = cursor.prev;
          for (let i = total; i < modIndex; i++) {
            [pos, duration] = cursor.prev;
            offset = offset.plus(duration.timesNum(this.beatDuration));
          }
        }
        return [i, modIndex - total, offset];
      }
      total += this._lineBreaks[i];
    }
    throw new Error("Invalid beat index: " + beat.index);
    return [-1, -1, ZERO];
  }

  /**
   * Return the line layout - ie number of beats in each line - as a
   * repeating pattern.
   *
   * For example 4,2,4 indicates that the notes in our song should be
   * laid out 4 beats in line 1, 2 beats in line 2, 4 beats in line 3 and
   * 4 beats in line 4 and so on as long as there are more notes available
   * in this line.
   */
  get lineBreaks(): number[] {
    if (!this._lineBreaks || this._lineBreaks.length == 0) {
      // trigger a refresh
      this.lineBreaks = [this.cycle.beatCount];
    }
    return this._lineBreaks;
  }

  /**
   * Sets the line layout pattern.
   */
  set lineBreaks(val: number[]) {
    this._lineBreaks = val;
    this.refreshLayout();
  }

  refreshLayout(): void {
    const cycleIter = this.cycle.iterateBeats();
    const akb = this.beatDuration;
    this._beatLayouts = this.lineBreaks.map((numBeats, index) => {
      const beats: [CyclePosition, Fraction][] = [];
      // see what the beat lengths are here
      for (let i = 0; i < numBeats; i++) {
        const nextCP = cycleIter.next().value;
        nextCP[1] = nextCP[1].timesNum(akb);
        beats.push(nextCP);
      }
      return beats;
    });
    this._totalBeats = this.lineBreaks.reduce((a, b) => a + b, 0);
    this._rowDurations = this._beatLayouts.map((beats) => beats.reduce((x, y) => x.plus(y[1]), ZERO));
    this._rowDurations.forEach((rd, index) => {
      this._rowStartOffsets[index] = index == 0 ? ZERO : this._rowStartOffsets[index - 1].plus(rd);
    });
    this._rowEndOffsets = this._rowDurations.map((rd, index) => {
      return this._rowStartOffsets[index].plus(rd);
    });
    this._totalLayoutDuration = this._rowDurations.reduce((x, y) => x.plus(y), ZERO);
  }

  /**
   * Returns the number of beats in each line based on the line layout
   * after taking beatDuration into account.
   */
  get beatLayouts(): ReadonlyArray<ReadonlyArray<[CyclePosition, Fraction]>> {
    if (!this._beatLayouts || this._beatLayouts.length < this.lineBreaks.length) {
      this.refreshLayout();
    }
    return this._beatLayouts;
  }

  /**
   * Total duration of all beats across all lines in our line layout.
   */
  get totalBeats(): number {
    this.beatLayouts;
    return this._totalBeats;
  }

  /**
   * Total duration of all beats across all lines in our line layout.
   */
  get totalLayoutDuration(): Fraction {
    this.beatLayouts;
    return this._totalLayoutDuration;
  }

  /*
  layoutOffsetsFor(offset: Fraction, layoutLine = -1): [number, Fraction] {
    const m1 = offset.mod(this.totalLayoutDuration);

    // layoutLine = L such that layout[L].startOffset <= atom.offset % totalLayoutDuration < layout[L].endOffset
    // calculate layoutLine if not provided
    if (layoutLine < 0) {
      // this.beatLayouts should kick off eval of all row offsets, durations etc
      for (let i = 0; i < this.beatLayouts.length; i++) {
        let cmp = this._rowStartOffsets[i].cmp(m1);
        if (cmp >= 0) {
          cmp = m1.cmp(this._rowEndOffsets[i]);
          if (cmp < 0) {
            layoutLine = i;
            break;
          }
        }
      }
    }
    if (layoutLine < 0) {
      throw new Error("Atom offset falls outside beat layout range: " + offset.toString());
    }

    // offset = atom.offset % totalLayoutDuration - rowOffset[layoutLine]
    const layoutOffset = m1.minus(this._rowStartOffsets[layoutLine]);
    return [layoutLine, layoutOffset];
  }
 */
}
