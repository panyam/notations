import * as TSU from "@panyam/tsutils";
import { Cycle, CyclePosition, CycleCursor } from "./cycle";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

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
  getBeatLocation(beat: {
    index: number;
    barIndex: number;
    beatIndex: number;
    instance: number;
  }): [number, number, Fraction] {
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
