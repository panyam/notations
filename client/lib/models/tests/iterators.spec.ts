import * as TSU from "@panyam/tsutils";
import { LeafAtom, Space, Syllable, Group, Note } from "../";
import { FlatAtom, AtomIterator, DurationIterator } from "../iterators";
import "../../../common/jest/matchers";

const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);

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
