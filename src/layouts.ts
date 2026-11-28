import * as TSU from "@panyam/tsutils";
import { Cycle, CyclePosition, CycleCursor } from "./cycle";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

/**
 * Manages layout parameters for arranging beats and notes in the notation.
 * LayoutParams determines how beats are organized into lines and rows based on
 * cycle patterns and line breaks.
 */
export class LayoutParams {
  private static counter = 0;
  /** Unique identifier for this layout parameters instance */
  readonly uuid = LayoutParams.counter++;

  /** Duration of a single beat (multiplier for beat lengths) */
  beatDuration: number;

  /** The cycle pattern to use for this layout */
  cycle: Cycle;

  /** The pattern of line breaks to apply */
  protected _lineBreaks: number[];

  /** Cache of row start offsets */
  private _rowStartOffsets: Fraction[];

  /** Cache of row end offsets */
  private _rowEndOffsets: Fraction[];

  /** Cache of row durations */
  private _rowDurations: Fraction[];

  /** Total duration of the layout pattern */
  private _totalLayoutDuration;

  /** Cached beat layout information */
  private _beatLayouts: [CyclePosition, Fraction][][];

  /** Total number of beats across all layout lines */
  private _totalBeats: number;

  /**
   * Creates a new LayoutParams instance.
   * @param config Configuration object containing beatDuration, cycle, and lineBreaks
   */
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

  /**
   * Checks if this LayoutParams is equal to another LayoutParams.
   * @param another The LayoutParams to compare with
   * @returns True if the LayoutParams are equal, false otherwise
   */
  equals(another: this): boolean {
    return (
      // super.equals(another) &&
      this.beatDuration == another.beatDuration &&
      this.cycle.equals(another.cycle) &&
      this.lineBreaksEqual(another._lineBreaks)
    );
  }

  /**
   * Checks if the line breaks pattern is equal to another pattern.
   * @param another The line breaks pattern to compare with
   * @returns True if the patterns are equal, false otherwise
   */
  lineBreaksEqual(another: number[]): boolean {
    return this._lineBreaks.length == another.length && this._lineBreaks.every((x, i) => x == another[i]);
  }

  /**
   * Returns a debug-friendly representation of this LayoutParams.
   * @returns An object containing debug information
   */
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
   * Lines are broken into beats of notes and those beats are aligned as per
   * the specs in the LayoutParams (breaks). For example if the breaks param
   * stipulates [5, 5, 4] then we have 5 beats in the first 2 lines and 4 in
   * the last line.
   *
   * @param beat The beat to locate
   * @returns A tuple containing [layoutLine, layoutColumn, rowOffset]
   *         - layoutLine: The line in the layout break spec this beat falls in
   *         - layoutColumn: The column within the layoutLine
   *         - rowOffset: The offset of the beat from the start of the row/line
   */
  getBeatLocation(beat: {
    index: number;
    barIndex: number;
    beatIndex: number;
    instance: number;
  }): [number, number, Fraction] {
    //
    // If a line contains say 50 beats (B1 - B50), then it is laid out as:
    //
    //      C0  C1  C2  C3  C4
    //    ---------------------
    // L0 | B1  B2  B3  B4  B5
    // L1 | B6  B7  B8  B9  B10
    // L2 | B11 B12 B13 B14
    // L0 | B15 B16 B17 B18 B19
    // L1 | B20 B21 B22 B23 B24
    // L2 | B25 B26 B27 B28
    // L0 | B29 B30 B31 B32 B33
    // L1 | B34 B35 B36 B37 B38
    // L2 | B39 B40 B41 B42
    // L0 | B43 B44 B45 B46 B47
    // L1 | B48 B49 B50
    //
    // This methods returns the triple: [layoutLine, layoutColumn, rowOffset]
    // where
    //
    //  layoutLine: The particular line in the layout break spec this index falls in.
    //              *Note*: Since lines can start with negative offsets, we can
    //              even return a layoutLine that is towards the end and then go
    //              back to 0, eg 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4 ...
    //              (eg returns L0 or L1 ... Ln)
    //  layoutColumn: The column within the layoutLine line where this beat falls.
    //                (eg C0 - C4 above - or depending on how many columns exist
    //                in the particular layout line).
    //  rowOffset: The note offset of the beat from the start of the row/line
    //             (not from the start of the cycle).
    //
    // Note the beatIndex can also be negative so we can return a beat
    // starting from before the cycle starting point.
    //
    //  To calculate the "real" line globally simply do:
    //
    //    realLine = lineBreaks.length  // Math.floor(beatIndex / this.totalBeats) + layoutLine;
    //
    // Some examples here are (using B1-B50 above):
    const modIndex = beat.index % this.totalBeats;
    let total = 0;
    for (let i = 0; i < this._lineBreaks.length; i++) {
      if (modIndex < total + this._lineBreaks[i]) {
        // TODO: What is the right offset here?
        let offset = ZERO;
        if (modIndex > total) {
          const cursor = new CycleCursor(this.cycle, beat.barIndex, beat.beatIndex, beat.instance);
          // Step back once before accumulating.  prev returns the beat it was on, then moves.
          void cursor.prev;
          for (let i = total; i < modIndex; i++) {
            const [, duration] = cursor.prev;
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
   * Gets the line layout pattern - i.e., number of beats in each line - as a
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
   * Gets the total number of beats across all lines in the layout pattern.
   */
  get totalBeats(): number {
    this.beatLayouts;
    return this._totalBeats;
  }

  /**
   * Gets the total duration of all beats across all lines in the layout pattern.
   */
  get totalLayoutDuration(): Fraction {
    this.beatLayouts;
    return this._totalLayoutDuration;
  }

  /**
   * Refreshes the layout calculations based on the current cycle and line breaks.
   * This rebuilds the beat layouts, row durations, and offset information.
   */
  protected refreshLayout(): void {
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
}

/**
 * Picks `\breaks` for one cycle so that no row is wider than `maxWidth`, for a screen narrower
 * than the song's rows.
 *
 * `beatWidths` holds the drawn width of each beat of the cycle, in cycle order. `current` holds
 * the breaks the author wrote. They come back unchanged while every row they make fits, even when
 * a row holds more than one cycle. Otherwise the result covers one cycle, in the fewest rows that
 * fit, and among those the one whose widest row is narrowest. Rows break at bar lines. A bar too
 * wide for a row of its own splits into the fewest even pieces that fit, and those pieces never
 * share a row with another bar. A single beat wider than `maxWidth` gets a row of its own and
 * overflows it.
 */
export function breaksToFit(cycle: Cycle, beatWidths: number[], maxWidth: number, current?: number[]): number[] {
  const n = cycle.beatCount;
  const beatWidth = (i: number) => beatWidths[i % n] ?? 0;
  const span = (start: number, count: number) => {
    let total = 0;
    for (let i = 0; i < count; i++) total += beatWidth(start + i);
    return total;
  };
  if (current && current.length > 0) {
    let start = 0;
    const fits = current.every((count) => {
      const ok = span(start, count) <= maxWidth;
      start += count;
      return ok;
    });
    if (fits) return current;
  }
  if (span(0, n) <= maxWidth) return [n];

  const out: number[] = [];
  let run: Piece[] = [];
  let start = 0;
  for (const bar of cycle.bars) {
    const count = bar.beatCount;
    const width = span(start, count);
    if (width <= maxWidth) {
      run.push({ count, width });
    } else {
      out.push(...fewestRows(run, maxWidth));
      run = [];
      const beats = Array.from({ length: count }, (_, i) => ({ count: 1, width: beatWidth(start + i) }));
      out.push(...fewestRows(beats, maxWidth));
    }
    start += count;
  }
  out.push(...fewestRows(run, maxWidth));
  return out;
}

/** A run of beats that a row break may not split: a whole bar, or one beat of a split bar. */
interface Piece {
  count: number;
  width: number;
}

/**
 * Groups `pieces` in order into the fewest rows no wider than `maxWidth`, and among those picks
 * the grouping whose widest row is narrowest. Returns the beat count of each row. With a piece
 * wider than `maxWidth`, every piece gets its own row.
 */
function fewestRows(pieces: Piece[], maxWidth: number): number[] {
  const m = pieces.length;
  if (m == 0) return [];
  // best[k][j]: the narrowest widest row over groupings of the first j pieces into k rows.
  const prefix = [0];
  for (const p of pieces) prefix.push(prefix[prefix.length - 1] + p.width);
  let prev: number[] = prefix.map((w) => w);
  const choices: number[][] = [prefix.map(() => 0)];
  for (let k = 1; k <= m; k++) {
    if (prev[m] <= maxWidth) return rowCounts(pieces, choices, k, m);
    const next = prefix.map(() => Infinity);
    const choice = prefix.map(() => 0);
    for (let j = k + 1; j <= m; j++) {
      for (let i = k; i < j; i++) {
        const widest = Math.max(prev[i], prefix[j] - prefix[i]);
        if (widest < next[j]) {
          next[j] = widest;
          choice[j] = i;
        }
      }
    }
    choices.push(choice);
    prev = next;
  }
  return pieces.map((p) => p.count);
}

/** Walks the choices fewestRows recorded back from the last piece and returns each row's beat count. */
function rowCounts(pieces: Piece[], choices: number[][], rows: number, m: number): number[] {
  const out: number[] = [];
  let j = m;
  for (let k = rows - 1; k >= 0; k--) {
    const i = k == 0 ? 0 : choices[k][j];
    let count = 0;
    for (let p = i; p < j; p++) count += pieces[p].count;
    out.unshift(count);
    j = i;
  }
  return out;
}
