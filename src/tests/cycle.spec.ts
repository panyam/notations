import * as TSU from "@panyam/tsutils";
import { Entity } from "../entity";
import { Cycle, Bar } from "../cycle";
import { Line } from "../core";

const Frac = TSU.Num.Frac;
const ZERO = TSU.Num.Fraction.ZERO;

// This cycle is something like:
// | , , ,    ,, ,,   ,,,  |  ,, ,,   ,,, ,,,   |   ,,, ,,, ,,,   ,,,, ,,,, ,,,, ||
// |        10             |      10            |       9                 12     ||
// Total beats: 41 beats
const TEST_CYCLE1 = new Cycle({
  bars: [
    new Bar({
      beatLengths: [1, 2, 3],
      beatCounts: [3, 2, 1],
    }),
    new Bar({
      beatLengths: [2, 3],
      beatCounts: [2, 2],
    }),
    new Bar({
      beatLengths: [3, 4],
      beatCounts: [3, 3],
    }),
  ],
});

describe("Entity Tests", () => {
  test("Children", () => {
    class Ent extends Entity {
      _children: Entity[] = [];
      children(): Entity[] {
        return this._children;
      }
    }
    const parent = new Ent();
    const child = new Entity();
    parent.setChildAt(0, child);
    expect(parent.indexOfChild(child)).toBe(0);
  });

  /*
  test("Metadata", () => {
    let parent = new Entity();
    expect(parent.getMetadata("hello")).toBeNull();
    parent.setMetadata("hello", "world");
    expect(parent.getMetadata("hello")).toBe("world");

    parent = new Entity();
    parent.metadata["hello"] = 5;
    const child = new Entity();
    child.parent = parent;
    expect(parent.getMetadata("hello")).toBe(5);
    expect(child.getMetadata("hello", false)).toBe(null);
    expect(child.getMetadata("hello")).toBe(5);
  });
  */
});

describe("Cycle tests", () => {
  test("Clone", () => {
    const cycle = new Cycle({
      bars: [new Bar({ beatLengths: [1, 2, 3, 4] }), new Bar({ beatLengths: [5] }), new Bar({ beatLengths: [6, 7] })],
    });
    const c2 = cycle.clone();
    expect(cycle.equals(c2)).toBe(true);

    const c3 = new Cycle({
      bars: [new Bar({ beatLengths: [1, 2, 3, 4] }), new Bar({ beatLengths: [5] }), new Bar({ beatLengths: [6, 8] })],
    });
    expect(cycle.equals(c3)).toBe(false);
  });

  test("Cycle with beat instances", () => {
    const cycle = TEST_CYCLE1;
    expect(cycle.duration).toEqual(Frac(41));
    expect(cycle.totalBeatCount).toEqual(16);
    expect(cycle.bars[0].beatCount).toEqual(3);
    expect(cycle.bars[0].totalBeatCount).toEqual(6);
    expect(cycle.bars[0].duration).toEqual(Frac(10));
    expect(cycle.bars[1].beatCount).toEqual(2);
    expect(cycle.bars[1].totalBeatCount).toEqual(4);
    expect(cycle.bars[1].duration).toEqual(Frac(10));
    expect(cycle.bars[2].beatCount).toEqual(2);
    expect(cycle.bars[2].totalBeatCount).toEqual(6);
    expect(cycle.bars[2].duration).toEqual(Frac(21));
  });

  test("Creation", () => {
    const cycle = new Cycle({
      bars: [
        new Bar({ beatLengths: [1, 2, 3, 4] }),
        new Bar({ beatLengths: [5] }),
        new Bar({ beatLengths: [TSU.Num.Frac(6), 7] }),
      ],
    });
    expect(cycle.beatCount).toEqual(7);
    expect(cycle.duration).toEqual(TSU.Num.Frac(28));
  });

  test("Iteration", () => {
    const cycle = new Cycle({
      bars: [new Bar({ beatLengths: [1, 2, 3, 4] }), new Bar({ beatLengths: [5] }), new Bar({ beatLengths: [6, 7] })],
    });
    const values = [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7];
    const iter = cycle.iterateBeats();
    for (let i = 0; i < values.length; i++) {
      expect(iter.next().value[1]).toEqual(TSU.Num.Frac(values[i]));
    }
  });

  test("getAtIndex Tests", () => {
    const cycle = TEST_CYCLE1;
    let bi = 0;
    for (let c = 0; c <= 5; c++) {
      let offset = ZERO;
      for (let barIndex = 0; barIndex < cycle.bars.length; barIndex++) {
        const bar = cycle.bars[barIndex];
        for (let beatIndex = 0; beatIndex < bar.beatCount; beatIndex++) {
          const beatLength = bar.beatLengths[beatIndex];
          const beatCount = bar.beatCounts[beatIndex] || 1;
          for (let instance = 0; instance < beatCount; instance++) {
            // console.log( `Testing globalIndex: ${bi}, bar: ${barIndex}, beat: ${beatIndex}, instance: ${instance}, offset: ${offset.toString()}`,);
            const found = cycle.getAtIndex(bi++);
            expect(found).toEqual([c, [barIndex, beatIndex, instance], offset]);
            offset = offset.plus(beatLength);
          }
        }
      }
    }
  });

  // Now test backwards
  test("getAtIndex Tests Backwards", () => {
    const cycle = TEST_CYCLE1;
    let bi = -1;
    for (let c = 0; c <= 5; c++) {
      let offset = cycle.duration;
      for (let barIndex = cycle.bars.length - 1; barIndex >= 0; barIndex--) {
        const bar = cycle.bars[barIndex];
        for (let beatIndex = bar.beatCount - 1; beatIndex >= 0; beatIndex--) {
          const beatLength = bar.beatLengths[beatIndex];
          const beatCount = bar.beatCounts[beatIndex] || 1;
          for (let instance = beatCount - 1; instance >= 0; instance--) {
            offset = offset.minus(beatLength);
            // console.log( `Testing globalIndex: ${bi}, bar: ${barIndex}, beat: ${beatIndex}, instance: ${instance}, offset: ${offset.toString()}`,);
            const found = cycle.getAtIndex(bi--);
            expect(found).toEqual([-(c + 1), [barIndex, beatIndex, instance], offset]);
          }
        }
      }
    }
  });

  test("getPosition Tests", () => {
    const cycle = TEST_CYCLE1;

    // quick test
    const qt = (x: number, y = 1) => cycle.getPosition(Frac(x, y));

    for (let c = 0, pos = 0; c <= 2; c++) {
      expect(qt(pos++)).toEqual([c, [0, 0, 0], Frac(0), 0]);
      expect(qt(pos++)).toEqual([c, [0, 0, 1], Frac(0), 1]);
      expect(qt(pos++)).toEqual([c, [0, 0, 2], Frac(0), 2]);

      expect(qt(pos++)).toEqual([c, [0, 1, 0], Frac(0), 3]);
      expect(qt(pos++)).toEqual([c, [0, 1, 0], Frac(1), 3]);
      expect(qt(pos++)).toEqual([c, [0, 1, 1], Frac(0), 4]);
      expect(qt(pos++)).toEqual([c, [0, 1, 1], Frac(1), 4]);

      expect(qt(pos++)).toEqual([c, [0, 2, 0], Frac(0), 5]);
      expect(qt(pos++)).toEqual([c, [0, 2, 0], Frac(1), 5]);
      expect(qt(pos++)).toEqual([c, [0, 2, 0], Frac(2), 5]);

      expect(qt(pos++)).toEqual([c, [1, 0, 0], Frac(0), 6]);
      expect(qt(pos++)).toEqual([c, [1, 0, 0], Frac(1), 6]);
      expect(qt(pos++)).toEqual([c, [1, 0, 1], Frac(0), 7]);
      expect(qt(pos++)).toEqual([c, [1, 0, 1], Frac(1), 7]);

      expect(qt(pos++)).toEqual([c, [1, 1, 0], Frac(0), 8]);
      expect(qt(pos++)).toEqual([c, [1, 1, 0], Frac(1), 8]);
      expect(qt(pos++)).toEqual([c, [1, 1, 0], Frac(2), 8]);
      expect(qt(pos++)).toEqual([c, [1, 1, 1], Frac(0), 9]);
      expect(qt(pos++)).toEqual([c, [1, 1, 1], Frac(1), 9]);
      expect(qt(pos++)).toEqual([c, [1, 1, 1], Frac(2), 9]);

      expect(qt(pos++)).toEqual([c, [2, 0, 0], Frac(0), 10]);
      expect(qt(pos++)).toEqual([c, [2, 0, 0], Frac(1), 10]);
      expect(qt(pos++)).toEqual([c, [2, 0, 0], Frac(2), 10]);
      expect(qt(pos++)).toEqual([c, [2, 0, 1], Frac(0), 11]);
      expect(qt(pos++)).toEqual([c, [2, 0, 1], Frac(1), 11]);
      expect(qt(pos++)).toEqual([c, [2, 0, 1], Frac(2), 11]);
      expect(qt(pos++)).toEqual([c, [2, 0, 2], Frac(0), 12]);
      expect(qt(pos++)).toEqual([c, [2, 0, 2], Frac(1), 12]);
      expect(qt(pos++)).toEqual([c, [2, 0, 2], Frac(2), 12]);

      expect(qt(pos++)).toEqual([c, [2, 1, 0], Frac(0), 13]);
      expect(qt(pos++)).toEqual([c, [2, 1, 0], Frac(1), 13]);
      expect(qt(pos++)).toEqual([c, [2, 1, 0], Frac(2), 13]);
      expect(qt(pos++)).toEqual([c, [2, 1, 0], Frac(3), 13]);
      expect(qt(pos++)).toEqual([c, [2, 1, 1], Frac(0), 14]);
      expect(qt(pos++)).toEqual([c, [2, 1, 1], Frac(1), 14]);
      expect(qt(pos++)).toEqual([c, [2, 1, 1], Frac(2), 14]);
      expect(qt(pos++)).toEqual([c, [2, 1, 1], Frac(3), 14]);
      expect(qt(pos++)).toEqual([c, [2, 1, 2], Frac(0), 15]);
      expect(qt(pos++)).toEqual([c, [2, 1, 2], Frac(1), 15]);
      expect(qt(pos++)).toEqual([c, [2, 1, 2], Frac(2), 15]);
      expect(qt(pos++)).toEqual([c, [2, 1, 2], Frac(3), 15]);
    }

    // Some +ve fractional offsets
    expect(qt(2, 4)).toEqual([0, [0, 0, 0], Frac(2, 4), 0]);
  });

  test("getPosition Tests Going Backwards", () => {
    const cycle = TEST_CYCLE1;

    // quick test
    const qt = (x: number, y = 1) => cycle.getPosition(Frac(x, y));
    // Go backwards
    for (let c = -1, pos = -1; c >= -5; c--) {
      expect(qt(pos--)).toEqual([c, [2, 1, 2], Frac(3), 15]);
      expect(qt(pos--)).toEqual([c, [2, 1, 2], Frac(2), 15]);
      expect(qt(pos--)).toEqual([c, [2, 1, 2], Frac(1), 15]);
      expect(qt(pos--)).toEqual([c, [2, 1, 2], Frac(0), 15]);
      expect(qt(pos--)).toEqual([c, [2, 1, 1], Frac(3), 14]);
      expect(qt(pos--)).toEqual([c, [2, 1, 1], Frac(2), 14]);
      expect(qt(pos--)).toEqual([c, [2, 1, 1], Frac(1), 14]);
      expect(qt(pos--)).toEqual([c, [2, 1, 1], Frac(0), 14]);
      expect(qt(pos--)).toEqual([c, [2, 1, 0], Frac(3), 13]);
      expect(qt(pos--)).toEqual([c, [2, 1, 0], Frac(2), 13]);
      expect(qt(pos--)).toEqual([c, [2, 1, 0], Frac(1), 13]);
      expect(qt(pos--)).toEqual([c, [2, 1, 0], Frac(0), 13]);

      expect(qt(pos--)).toEqual([c, [2, 0, 2], Frac(2), 12]);
      expect(qt(pos--)).toEqual([c, [2, 0, 2], Frac(1), 12]);
      expect(qt(pos--)).toEqual([c, [2, 0, 2], Frac(0), 12]);
      expect(qt(pos--)).toEqual([c, [2, 0, 1], Frac(2), 11]);
      expect(qt(pos--)).toEqual([c, [2, 0, 1], Frac(1), 11]);
      expect(qt(pos--)).toEqual([c, [2, 0, 1], Frac(0), 11]);
      expect(qt(pos--)).toEqual([c, [2, 0, 0], Frac(2), 10]);
      expect(qt(pos--)).toEqual([c, [2, 0, 0], Frac(1), 10]);
      expect(qt(pos--)).toEqual([c, [2, 0, 0], Frac(0), 10]);

      expect(qt(pos--)).toEqual([c, [1, 1, 1], Frac(2), 9]);
      expect(qt(pos--)).toEqual([c, [1, 1, 1], Frac(1), 9]);
      expect(qt(pos--)).toEqual([c, [1, 1, 1], Frac(0), 9]);
      expect(qt(pos--)).toEqual([c, [1, 1, 0], Frac(2), 8]);
      expect(qt(pos--)).toEqual([c, [1, 1, 0], Frac(1), 8]);
      expect(qt(pos--)).toEqual([c, [1, 1, 0], Frac(0), 8]);

      expect(qt(pos--)).toEqual([c, [1, 0, 1], Frac(1), 7]);
      expect(qt(pos--)).toEqual([c, [1, 0, 1], Frac(0), 7]);
      expect(qt(pos--)).toEqual([c, [1, 0, 0], Frac(1), 6]);
      expect(qt(pos--)).toEqual([c, [1, 0, 0], Frac(0), 6]);

      expect(qt(pos--)).toEqual([c, [0, 2, 0], Frac(2), 5]);
      expect(qt(pos--)).toEqual([c, [0, 2, 0], Frac(1), 5]);
      expect(qt(pos--)).toEqual([c, [0, 2, 0], Frac(0), 5]);

      expect(qt(pos--)).toEqual([c, [0, 1, 1], Frac(1), 4]);
      expect(qt(pos--)).toEqual([c, [0, 1, 1], Frac(0), 4]);
      expect(qt(pos--)).toEqual([c, [0, 1, 0], Frac(1), 3]);
      expect(qt(pos--)).toEqual([c, [0, 1, 0], Frac(0), 3]);

      expect(qt(pos--)).toEqual([c, [0, 0, 2], Frac(0), 2]);
      expect(qt(pos--)).toEqual([c, [0, 0, 1], Frac(0), 1]);
      expect(qt(pos--)).toEqual([c, [0, 0, 0], Frac(0), 0]);
    }

    // Some -ve fractional offsets
    expect(qt(-10, 4)).toEqual([-1, [2, 1, 2], Frac(6, 4), 15]);
    expect(qt(-40, 3)).toEqual([-1, [2, 0, 2], Frac(5, 3), 12]);
    expect(qt(-400, 7)).toEqual([-2, [2, 0, 1], Frac(13, 7), 11]);
  });
});

describe("Line tests", () => {
  test("copy", () => {
    const l = new Line();
    // expect(l.parent).toBe(null);
    expect(l.TYPE).toBe("Line");
    const l2 = l.clone();
    expect(l.equals(l2)).toBe(true);
    expect(l.duration.num).toBe(0);
  });
});
