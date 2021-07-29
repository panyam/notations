import * as TSU from "@panyam/tsutils";
import { Cycle, Line, LeafAtom, Role, Space, Syllable, Group, Note } from "../";
import { Beat, BeatsBuilder, FlatAtom, AtomIterator, DurationIterator } from "../iterators";
import "../../../common/jest/matchers";

const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);
const HALF = ONE.divbyNum(2);

describe("AtomIterator Tests", () => {
  test("Plain Atoms", () => {
    const ai = new AtomIterator(new Space(TWO), new Syllable("Ga"), new Note("a"));
    let peeked = ai.peek();
    expect(peeked?.atom).toEntityEqual(new Space(TWO));
    expect(peeked?.offset).toEntityEqual(ZERO);
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Space(TWO));
    expect(peeked?.offset).toEntityEqual(ZERO);
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Syllable("Ga"));
    expect(peeked?.offset).toEntityEqual(TWO);
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Note("a"));
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked).toBeNull();
  });

  test("With Groups", () => {
    const atoms = [new Note("a"), new Group(ONE, new Note("b"), new Space(TWO)), new Note("c")];
    const ai = new AtomIterator(...atoms);
    let peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Note("a"));
    expect(peeked?.offset).toEntityEqual(ZERO);
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Note("b"));
    expect(peeked?.offset).toEntityEqual(ONE);
    expect(peeked?.depth).toEqual(1);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Space(TWO));
    expect(peeked?.offset).toEntityEqual(TSU.Num.Frac(4, 3));
    expect(peeked?.depth).toEqual(1);

    peeked = ai.next();
    expect(peeked?.atom).toEntityEqual(new Note("c"));
    expect(peeked?.offset).toEntityEqual(TWO);
    expect(peeked?.depth).toEqual(0);

    peeked = ai.next();
    expect(peeked).toBeNull();
  });

  test("getMin", () => {
    const atoms1 = [
      // offset = 0
      new Note("a"),
      // Offset = 1
      new Group(
        FIVE,
        // Offset = 1
        new Note("b"),
        // Offset = 8 / 3
        new Space(TWO),
      ),
      // Offset = 6
      new Note("c"),
    ];
    const atoms2 = [
      // Offset = 0
      new Note("d", THREE),
      // Offset = 3
      new Group(
        ONE,
        // Offset = 3
        new Note("e"),
        // Offset = 5 / 3
        new Space(TWO),
      ),
      // Offset = 4
      new Note("f"),
    ];
    const atoms3 = [
      // Offset = 0
      new Space(ONE),
      // Offset = 1
      new Space(ONE),
      // Offset = 2
      new Syllable("Y"),
    ];
    const ai1 = new AtomIterator(...atoms1);
    const ai2 = new AtomIterator(...atoms2);
    const ai3 = new AtomIterator(...atoms3);

    const iters = [ai1, ai2, ai3];
    const expected: [number, number, LeafAtom][] = [
      // offset = 0
      [0, 0, new Note("a")],
      [1, 0, new Note("d", THREE)],
      [2, 0, new Space(ONE)],
      [0, 1, new Note("b", ONE)],
      [2, 0, new Space(ONE)],
      [2, 0, new Syllable("Y")],
      [0, 1, new Space(TWO)],
      [1, 1, new Note("e")],
      [1, 1, new Space(TWO)],
      [1, 0, new Note("f")],
      [0, 0, new Note("c")],
    ];
    const got: [number, FlatAtom][] = [];
    let [role, flatAtom] = AtomIterator.getMin(iters);
    while (role >= 0) {
      got.push([role, flatAtom]);
      [role, flatAtom] = AtomIterator.getMin(iters);
    }

    expect(got.length).toBe(expected.length);
    for (let i = 0; i < got.length; i++) {
      const [role, flatAtom] = got[i];
      // console.log("I, Got: ", i, flatAtom.offset, flatAtom.atom.toString()); // got[i]);
      expect(role).toBe(expected[i][0]);
      expect(flatAtom.atom).toEntityEqual(expected[i][2]);
      expect(flatAtom.depth).toEqual(expected[i][1]);
    }
  });
});

describe("DurationIterator Tests", () => {
  test("Plain Atoms", () => {
    const ai = new AtomIterator(new Space(TWO), new Syllable("Ga"), new Note("a"));
    const dIter = new DurationIterator(ai);
    let [d1, filled] = dIter.get(ONE);
    expect(d1[0].atom).toEntityEqual(new Space(TWO));
    expect(d1[0].duration).toBe(ONE);
    expect(filled).toBe(true);

    [d1, filled] = dIter.get(THREE);
    expect(d1.length).toBe(3);
    expect(filled).toBe(true);
    expect(d1[0].atom).toEntityEqual(new Space(ONE));
    expect(d1[0].duration).toEntityEqual(ONE);
    expect(d1[1].atom).toEntityEqual(new Syllable("Ga"));
    expect(d1[1].duration).toEntityEqual(ONE);
    expect(d1[2].atom).toEntityEqual(new Note("a"));
    expect(d1[2].duration).toEntityEqual(ONE);

    [d1, filled] = dIter.get(ONE);
    expect(d1.length).toBe(0);
    expect(filled).toBe(false);
  });
});

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: any, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

describe("BeatsBuilder", () => {
  test("Create beats from BeatsBuilder", () => {
    const l = new Line();
    const g1 = new Group(ONE, new Note("1", ONE), new Note("2", TWO), new Note("3", THREE));
    g1.durationIsMultiplier = true;
    const atoms = [new Note("a", ONE), new Note("b", TWO), new Note("c", THREE), new Note("d", FIVE), g1];
    l.addAtoms("test", ...atoms);
    const c = Cycle.DEFAULT;
    const bb = new BeatsBuilder(l.ensureRole("test"), c, 2);
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "a",
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "2/1",
              value: "b",
            },
            duration: "1/1",
            offset: "1/1",
            depth: 0,
          },
        ],
      },
      {
        index: 1,
        role: "test",
        offset: "2/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "3/1",
              value: "c",
            },
            duration: "1/1",
            offset: "3/1",
            depth: 0,
          },
        ],
      },
      {
        index: 2,
        role: "test",
        offset: "4/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 2,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              duration: "2/1",
              isSilent: false,
            },
            duration: "2/1",
            offset: "0/1",
            depth: 0,
          },
        ],
      },
      {
        index: 3,
        role: "test",
        offset: "6/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 3,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "5/1",
              value: "d",
            },
            duration: "2/1",
            offset: "6/1",
            depth: 0,
          },
        ],
      },
      {
        index: 4,
        role: "test",
        offset: "8/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              duration: "3/1",
              isSilent: false,
            },
            duration: "2/1",
            offset: "0/1",
            depth: 0,
          },
        ],
      },
      {
        index: 5,
        role: "test",
        offset: "10/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 1,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "1",
            },
            duration: "6/6",
            offset: "11/1",
            depth: 1,
          },
        ],
      },
      {
        index: 6,
        role: "test",
        offset: "12/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "2/1",
              value: "2",
            },
            duration: "12/6",
            offset: "72/6",
            depth: 1,
          },
        ],
      },
      {
        index: 7,
        role: "test",
        offset: "14/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 1,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "3/1",
              value: "3",
            },
            duration: "2/1",
            offset: "504/36",
            depth: 1,
          },
        ],
      },
      {
        index: 8,
        role: "test",
        offset: "16/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "6/6",
            offset: "0/1",
            depth: 0,
          },
        ],
      },
    ]);
  });

  test("Create beats from groups", () => {
    const l = new Line();
    const g1 = new Group(TWO, new Note("Pa", ONE), new Note("Ma", ONE));
    g1.durationIsMultiplier = true;
    const atoms = [new Note("P", ONE), g1];
    l.addAtoms("test", ...atoms);
    const c = Cycle.DEFAULT;
    const bb = new BeatsBuilder(l.ensureRole("test"), c, 2);
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "P",
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "Pa",
            },
            duration: "2/4",
            offset: "1/1",
            depth: 1,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "Ma",
            },
            duration: "2/4",
            offset: "6/4",
            depth: 1,
          },
        ],
      },
    ]);
  });

  test("Test uniform spacing", () => {
    const l = new Line();
    const g1 = new Group(TWO, new Note("Pa", ONE), new Note("Ma", ONE));
    g1.durationIsMultiplier = true;
    const atoms = [new Note("P", ONE), g1];
    l.addAtoms("test", ...atoms);
    const c = Cycle.DEFAULT;
    const APB = 2;
    const bb = new BeatsBuilder(l.ensureRole("test"), c, APB);
    bb.onBeatFilled = (beat: Beat) => {
      beat.ensureUniformSpaces(APB);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "P",
            },
            duration: "1/2",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/2",
            offset: "1/2",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "Pa",
            },
            duration: "1/2",
            offset: "1/1",
            depth: 1,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "Ma",
            },
            duration: "1/2",
            offset: "6/4",
            depth: 1,
          },
        ],
      },
    ]);
  });

  test("Test uniform spacing with all half beats", () => {
    const l = new Line();
    const atoms = [new Note("P", HALF), new Note("M", HALF), new Note("G", HALF), new Note("R", HALF)];
    l.addAtoms("test", ...atoms);
    const c = Cycle.DEFAULT;
    const APB = 2;
    const bb = new BeatsBuilder(l.ensureRole("test"), c, APB);
    bb.onBeatFilled = (beat: Beat) => {
      beat.ensureUniformSpaces(APB);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "1/2",
              value: "P",
            },
            duration: "1/2",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "1/2",
              value: "M",
            },
            duration: "1/2",
            offset: "1/2",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "1/2",
              value: "G",
            },
            duration: "1/2",
            offset: "4/4",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "1/2",
              value: "R",
            },
            duration: "1/2",
            offset: "12/8",
            depth: 0,
          },
        ],
      },
    ]);
  });

  test("Test uniform spacing with whole bun uneven size beats", () => {
    const l = new Line();
    const atoms = [new Note("S", ONE), new Note("R", TWO), new Note("G", THREE)];
    l.addAtoms("test", ...atoms);
    const c = Cycle.DEFAULT;
    const APB = 6;
    const bb = new BeatsBuilder(l.ensureRole("test"), c, APB);
    bb.onBeatFilled = (beat: Beat) => {
      beat.ensureUniformSpaces(APB);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "6/1",
        barIndex: 0,
        beatIndex: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              value: "S",
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "2/1",
              value: "R",
            },
            duration: "1/1",
            offset: "1/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/1",
            offset: "2/1",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 0,
              duration: "3/1",
              value: "G",
            },
            duration: "1/1",
            offset: "3/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/1",
            offset: "4/1",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: 3,
              isSilent: false,
            },
            duration: "1/1",
            offset: "5/1",
            depth: 0,
            isContinuation: true,
          },
        ],
      },
    ]);
  });
});
