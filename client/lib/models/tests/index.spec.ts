import * as TSU from "@panyam/tsutils";
import { AtomType, Entity, Line, Cycle, Bar, Syllable, Space, Group, Note } from "../";
import "../../../common/jest/matchers";

const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);

describe("Entity Tests", () => {
  test("Creation", () => {
    const parent = new Entity();
    expect(parent.getMetadata("hello")).toBeNull();
    parent.setMetadata("hello", "world");
    expect(parent.getMetadata("hello")).toBe("world");
  });

  test("Metadata", () => {
    const parent = new Entity();
    parent.metadata["hello"] = 5;
    const child = new Entity();
    child.parent = parent;
    expect(parent.getMetadata("hello")).toBe(5);
    expect(child.getMetadata("hello", false)).toBe(null);
    expect(child.getMetadata("hello")).toBe(5);
  });
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

  test("Creation", () => {
    const cycle = new Cycle({
      bars: [
        new Bar({ beatLengths: [1, 2, 3, 4] }),
        new Bar({ beatLengths: [5] }),
        new Bar({ beatLengths: [TSU.Num.Frac(6), 7] }),
      ],
    });
    expect(cycle.barCount).toEqual(7);
    expect(cycle.duration).toEqual(TSU.Num.Frac(28));
  });

  test("Iteration", () => {
    const cycle = new Cycle({
      bars: [new Bar({ beatLengths: [1, 2, 3, 4] }), new Bar({ beatLengths: [5] }), new Bar({ beatLengths: [6, 7] })],
    });
    const values = [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7];
    const iter = cycle.iterateBeats();
    for (let i = 0; i < values.length; i++) {
      expect(iter.next().value[0]).toEntityEqual(TSU.Num.Frac(values[i]));
    }
  });
});

describe("Line tests", () => {
  test("copy", () => {
    const l = new Line();
    expect(l.parent).toBe(null);
    expect(l.type).toBe("Line");
    const l2 = l.clone();
    expect(l.equals(l2)).toBe(true);
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
  });

  test("Group Creation", () => {
    const notes = [new Syllable("aaa"), new Space(THREE, true), new Note("ga", THREE)];
    const g = new Group(FIVE, ...notes);
    expect(g.type).toBe(AtomType.GROUP);

    let child = g.atoms.first;
    for (let i = 0; i < 3; i++, child = child!.next) {
      expect(child?.value.parent).toBe(g);
      if (i > 0) expect(child?.prev?.value).toBe(notes[i - 1]);
      if (i < 3) expect(child?.next?.value).toBe(notes[i + 1]);
    }

    expect(g.atoms.first?.value).toBe(notes[0]);
    expect(g.atoms.last?.value).toBe(notes[2]);
    expect(g.atoms.size).toBe(3);
  });
});

describe("Atom tests", () => {
  test("Note Copy", () => {
    const n = new Note("a", TSU.Num.Frac(3, 5), 4, 6);
    expect(n.parent).toBe(null);
    const n2 = n.clone();
    expect(n.value).toBe(n2.value);
    expect(n.duration).toEntityEqual(n2.duration);
    expect(n.octave).toBe(n2.octave);
    expect(n.shift).toBe(n2.shift);

    n.duration = TSU.Num.Frac(1, 3);
    expect(n.duration).toEntityEqual(TSU.Num.Frac(1, 3));
    expect(n.duration).not.toEntityEqual(n2.duration);
  });

  test("Space Copy", () => {
    const n = new Space(TSU.Num.Frac(3, 4), true);
    const n2 = n.clone();
    expect(n.duration).toEntityEqual(n2.duration);
    expect(n.isSilent).toBe(n2.isSilent);
  });

  test("Syllable Copy", () => {
    const n = new Syllable("a", TSU.Num.Frac(3, 5));
    expect(n.parent).toBe(null);
    const n2 = n.clone();
    expect(n.value).toBe(n2.value);
    expect(n.duration).toEntityEqual(n2.duration);

    n.duration = TSU.Num.Frac(1, 3);
    expect(n.duration).toEntityEqual(TSU.Num.Frac(1, 3));
    expect(n.duration).not.toEntityEqual(n2.duration);
  });

  test("Group", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(ONE, ...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEntityEqual(TSU.Num.Frac(4));
  });

  test("Group 2", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(ONE, ...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEntityEqual(TSU.Num.Frac(4));

    const atoms2 = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g2 = new Group(TWO, ...atoms2);

    const p = new Group(THREE, g, g2);
    expect(g2.totalChildDuration).toEntityEqual(TSU.Num.Frac(4));
  });

  test("Group Cloning", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(TWO, ...atoms);
    const g2 = g.clone();
    expect(g2.duration).toEntityEqual(g.duration);
    expect(g2.atoms.size).toBe(g.atoms.size);
    expect(g2.atoms.first?.value).toEntityEqual(atoms[0]);
    expect(g2.atoms.first?.next?.value).toEntityEqual(atoms[1]);
    expect(g2.atoms.first?.next?.next?.value).toEntityEqual(atoms[2]);
  });
});
