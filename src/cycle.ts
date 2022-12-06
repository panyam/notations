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
  readonly TYPE: string = "Bar";

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

  instanceCount(beatIndex: number): number {
    if (beatIndex > this.beatCounts.length) {
      // by default each beat has 1 instance?
      return 1;
    } else {
      return this.beatCounts[beatIndex];
    }
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
  readonly TYPE: string = "Cycle";

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
