import * as TSU from "@panyam/tsutils";
import { Entity, TimedEntity } from "./entity";

/**
 * Alias to TSU.Num.Fraction in tsutils.
 */
type Fraction = TSU.Num.Fraction;
export type CyclePosition = [number, number, number];
export type CycleIterator = Generator<[CyclePosition, Fraction]>;

const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

/**
 * A cursor that traverses through a Cycle's beats in a controlled manner.
 * Allows forward and backward navigation through the cycle.
 */
export class CycleCursor {
  /**
   * Creates a new CycleCursor.
   * @param cycle The Cycle to traverse
   * @param barIndex The starting bar index, defaults to 0
   * @param beatIndex The starting beat index within the bar, defaults to 0
   * @param instance The starting instance index within the beat, defaults to 0
   */
  constructor(
    public readonly cycle: Cycle,
    public barIndex = 0,
    public beatIndex = 0,
    public instance = 0,
  ) {}

  /**
   * Advances the cursor to the next beat and returns the current position and beat length.
   * @returns A tuple containing the current position and beat length
   */
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

  /**
   * Moves the cursor to the previous beat and returns the current position and beat length.
   * @returns A tuple containing the current position and beat length
   */
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

/**
 * Represents a bar in a musical cycle.
 * A bar consists of beats with specific lengths and counts.
 */
export class Bar extends TimedEntity {
  readonly TYPE: string = "Bar";

  /** Name of the bar (e.g., "Laghu", "Dhrutam") */
  name: string;

  /** Length/Duration of each beat in the bar */
  beatLengths: Fraction[] = [];

  /** How many times each beat should be repeated (the Kalai) */
  beatCounts: number[] = [];

  /**
   * Creates a new Bar.
   * @param config Configuration object containing name, beatLengths, and beatCounts
   */
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

  /**
   * Returns a debug-friendly representation of this Bar.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { ...super.debugValue(), name: name, beatLengths: this.beatLengths };
  }

  /**
   * Checks if this Bar is equal to another Bar.
   * @param another The Bar to compare with
   * @returns True if the Bars are equal, false otherwise
   */
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

  /**
   * Copies the properties of this Bar to another Bar.
   * @param another The target Bar to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.beatLengths = [...this.beatLengths];
    another.beatCounts = [...this.beatCounts];
  }

  /**
   * Gets the instance count for a specific beat in the bar.
   * @param beatIndex The index of the beat
   * @returns The number of instances for the specified beat
   */
  instanceCount(beatIndex: number): number {
    if (beatIndex > this.beatCounts.length) {
      // by default each beat has 1 instance?
      return 1;
    } else {
      return this.beatCounts[beatIndex];
    }
  }

  /**
   * Gets the number of unique beats in this bar (irrespective of instances).
   */
  get beatCount(): number {
    return this.beatLengths.length;
  }

  /**
   * Gets the total number of beat instances in this bar.
   */
  get totalBeatCount(): number {
    let out = 0;
    for (let i = 0; i < this.beatLengths.length; i++) {
      out += this.beatCounts[i] || 1;
    }
    return out;
  }

  /**
   * Gets the total duration of time across all beats in this bar.
   */
  get duration(): Fraction {
    let total = ZERO;
    for (let i = 0; i < this.beatLengths.length; i++) {
      total = total.plus(this.beatLengths[i].timesNum(this.beatCounts[i] || 1));
    }
    return total;
  }
}

/**
 * Represents a complete rhythmic cycle pattern composed of bars.
 * In carnatic music, this typically represents a tala.
 */
export class Cycle extends TimedEntity {
  readonly TYPE: string = "Cycle";

  /** Name of the cycle (e.g., "Adi Thalam") */
  name: string;

  /** The bars that make up this cycle */
  bars: Bar[];

  /**
   * Default cycle representing Adi Thalam (4+2+2 structure).
   */
  static readonly DEFAULT = new Cycle({
    name: "Adi Thalam",
    bars: [
      new Bar({ name: "Laghu", beatLengths: [1, 1, 1, 1] }),
      new Bar({ name: "Dhrutam", beatLengths: [1, 1] }),
      new Bar({ name: "Dhrutam", beatLengths: [1, 1] }),
    ],
  });

  /**
   * Creates a new Cycle.
   * @param config Configuration object containing name and bars
   */
  constructor(config: null | { name?: string; bars?: Bar[] } = null) {
    super((config = config || {}));
    this.name = config.name || "";
    this.bars = config.bars || [];
  }

  /**
   * Returns a debug-friendly representation of this Cycle.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { ...super.debugValue(), name: name, bars: this.bars.map((p) => p.debugValue()) };
  }

  /**
   * Gets all child entities of this Cycle.
   * @returns An array of child entities (bars)
   */
  children(): Entity[] {
    return this.bars;
  }

  /**
   * Checks if this Cycle is equal to another Cycle.
   * @param another The Cycle to compare with
   * @returns True if the Cycles are equal, false otherwise
   */
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
   * Given a global beat index, returns the position within the cycle.
   *
   * @param globalIndex The global beat index
   * @returns A tuple containing [cycle number, position, start offset]
   *         - cycle: The nth cycle in which the beat lies
   *         - position: [barIndex, beatIndex, instance] within the cycle
   *         - startOffset: Offset of the beat at this global index
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
   * Given a global offset, returns the position within the cycle.
   *
   * @param globalOffset The global time offset
   * @returns A tuple containing [cycle number, position, note offset, global index]
   *         - cycle: The nth cycle in which the offset lies
   *         - position: [barIndex, beatIndex, instance] within the cycle
   *         - startOffset: The note offset within the beat
   *         - globalIndex: The beat index within the entire cycle
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

  /**
   * Creates an iterator that yields beats in sequence from a starting position.
   *
   * @param startBar The starting bar index, defaults to 0
   * @param startBeat The starting beat index, defaults to 0
   * @param startInstance The starting instance index, defaults to 0
   * @returns A generator that yields [position, beat length] pairs
   */
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

  /**
   * Copies the properties of this Cycle to another Cycle.
   * @param another The target Cycle to copy properties to
   */
  copyTo(another: this): void {
    super.copyTo(another);
    another.name = this.name;
    another.bars = this.bars.map((x) => x.clone());
  }

  /**
   * Gets the number of unique beats in this cycle (irrespective of instances).
   */
  get beatCount(): number {
    let out = 0;
    for (const bar of this.bars) out += bar.beatCount;
    return out;
  }

  /**
   * Gets the total number of beat instances in this cycle.
   */
  get totalBeatCount(): number {
    let out = 0;
    for (const bar of this.bars) out += bar.totalBeatCount;
    return out;
  }

  /**
   * Gets the total duration of time across all bars in this cycle.
   */
  get duration(): Fraction {
    return this.bars.reduce((x, y) => x.plus(y.duration), ZERO);
  }
}
