import * as TSU from "@panyam/tsutils";
import { Entity } from "../entity";
import { Cycle, Bar } from "../cycle";
import { AtomType, Line, Syllable, Space, Group, Note } from "../core";
import { LayoutParams } from "../layouts";

const Frac = TSU.Num.Frac;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);

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
    expect(l.type).toBe("Line");
    const l2 = l.clone();
    expect(l.equals(l2)).toBe(true);
    expect(l.duration.num).toBe(0);
  });
});

describe("Atom Iterator Tests", () => {
  test("Simple", () => {
    /*
    const atoms: Atom[] = [
      new Space(ONE),
      new Note("Sa", THREE),
      new Group(FOUR, new Space(TWO), new Note("Sa", FIVE), new Note("Pa", TWO)),
      new Note("Ra", TWO),
      new Group(ONE, new Space(TWO), new Note("Sa", FIVE), new Note("Pa", TWO)),
    ];
    const iter = new AtomIterator(atoms);
    let next = iter.get(TSU.Num.Frac(1));
    expect(next.length).toBe(1);
    expect(next[0].type).toBe(AtomType.SPACE);
    expect(next[0].duration).toBe(1);

    next = iter.get(TSU.Num.Frac(2));
    expect(next.length).toBe(1);
    expect(next[0].type).toBe(AtomType.NOTE);

    next = iter.get(TSU.Num.Frac(5));
    expect(next.length).toBe(2);
    expect(next[0].type).toBe(AtomType.GROUP);
    expect(next[0].duration).toBe(1);
    expect(next[1].duration).toBe(4);
    */
  });
});

describe("Atom tests", () => {
  test("Creation", () => {
    expect(new Syllable("aaa").value).toBe("aaa");
    expect(new Space(THREE, true).isSilent).toBe(true);
    expect(new Space(THREE, true).duration).toBe(THREE);
    expect(new Space(THREE, true).duration).toBe(THREE);
    expect(new Note("ga", THREE).duration).toBe(THREE);
    expect(new Note("ga", THREE).value).toBe("ga");
    expect(new Note("ga", THREE, 5).octave).toBe(5);
    expect(new Note("ga", THREE, 5).shift).toBe(0);
    expect(new Note("ga", THREE, 5, 2).shift).toBe(2);
    const s = new Syllable("aaa");
    expect(Syllable.fromLit(s)).toBe(s);

    const n = new Note("ga", THREE);
    expect(Note.fromLit(n)).toBe(n);
  });

  test("Group Creation", () => {
    const notes = [new Syllable("aaa"), new Space(THREE, true), new Note("ga", THREE)];
    const g = new Group(FIVE, ...notes);
    expect(g.type).toBe(AtomType.GROUP);

    let child = g.atoms.first;
    for (let i = 0; i < 3; i++, child = child!.nextSibling) {
      expect(child?.parentGroup).toBe(g);
      // if (i > 0)
      expect(child?.prevSibling).toBe(notes[i - 1] || null);
      // if (i < 2)
      expect(child?.nextSibling).toBe(notes[i + 1] || null);
    }

    expect(g.atoms.first).toBe(notes[0]);
    expect(g.atoms.last).toBe(notes[2]);
    expect(g.atoms.size).toBe(3);
  });
});

describe("Atom tests", () => {
  test("Note Copy", () => {
    const n = new Note("a", TSU.Num.Frac(3, 5), 4, 6);
    expect(n.parentGroup).toBe(null);
    const n2 = n.clone();
    expect(n.value).toBe(n2.value);
    expect(n.duration).toEqual(n2.duration);
    expect(n.octave).toBe(n2.octave);
    expect(n.shift).toBe(n2.shift);

    n.duration = TSU.Num.Frac(1, 3);
    expect(n.duration).toEqual(TSU.Num.Frac(1, 3));
    expect(n.duration).not.toEqual(n2.duration);
  });

  test("Space Copy", () => {
    const n = new Space(TSU.Num.Frac(3, 4), true);
    const n2 = n.clone();
    expect(n.duration).toEqual(n2.duration);
    expect(n.isSilent).toBe(n2.isSilent);
  });

  test("Syllable Copy", () => {
    const n = new Syllable("a", TSU.Num.Frac(3, 5));
    expect(n.parentGroup).toBe(null);
    const n2 = n.clone();
    expect(n.value).toBe(n2.value);
    expect(n.duration).toEqual(n2.duration);

    n.duration = TSU.Num.Frac(1, 3);
    expect(n.duration).toEqual(TSU.Num.Frac(1, 3));
    expect(n.duration).not.toEqual(n2.duration);
  });

  test("Group", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(ONE, ...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEqual(TSU.Num.Frac(4));
  });

  test("Group 2", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(ONE, ...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEqual(TSU.Num.Frac(4));

    const atoms2 = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g2 = new Group(TWO, ...atoms2);

    const p = new Group(THREE, g, g2);
    expect(g2.totalChildDuration).toEqual(TSU.Num.Frac(4));
  });

  test("Group Cloning", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(TWO, ...atoms);
    const g2 = g.clone();
    expect(g2.duration).toEqual(g.duration);
    expect(g2.atoms.size).toBe(g.atoms.size);
    expect(g2.atoms.first?.debugValue()).toEqual(atoms[0].debugValue());
    expect(g2.atoms.first?.nextSibling?.debugValue()).toEqual(atoms[1].debugValue());
    expect(g2.atoms.first?.nextSibling?.nextSibling?.debugValue()).toEqual(atoms[2].debugValue());
  });
});

describe("LayoutParam Tests", () => {
  test("Creation", () => {
    const lp = new LayoutParams();
    expect(lp.cycle).toEqual(Cycle.DEFAULT);
    expect(lp.beatDuration).toEqual(1);
    expect(lp.lineBreaks).toEqual([lp.cycle.beatCount]);
  });

  test("Creation with configs", () => {
    const lp = new LayoutParams({
      beatDuration: 4,
      lineBreaks: [3, 2, 1],
    });
    expect(lp.cycle).toEqual(Cycle.DEFAULT);
    expect(lp.beatDuration).toEqual(4);
    expect(lp.lineBreaks).toEqual([3, 2, 1]);
    expect(lp.totalLayoutDuration).toEqual(ONE.timesNum(24));
  });
});
