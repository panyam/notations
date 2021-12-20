import * as TSU from "@panyam/tsutils";
import { Cycle, Bar } from "../cycle";
import { AtomType, Syllable, Space, Group, Note } from "../core";
import { LayoutParams } from "../layouts";

const Frac = TSU.Num.Frac;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FOUR = ONE.timesNum(4);
const FIVE = ONE.timesNum(5);
const SIX = ONE.timesNum(6);

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
    const g = new Group(...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEqual(TSU.Num.Frac(4));
  });

  test("Group 2", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(...atoms);
    expect(g.atoms.size).toBe(3);
    expect(g.totalChildDuration).toEqual(TSU.Num.Frac(4));

    const atoms2 = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g2 = new Group(...atoms2);

    const p = new Group(g, g2).setDuration(THREE);
    expect(g2.totalChildDuration).toEqual(TSU.Num.Frac(4));
  });

  test("Group Cloning", () => {
    const atoms = [new Space(TWO), new Syllable("Ga"), new Note("a")];
    const g = new Group(...atoms).setDuration(TWO);
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

describe("Atom Splitting Tests", () => {
  test("Leaf Splitting", () => {
    const l1 = new Space(TWO);
    expect(l1.isContinuation).toBe(false);
    expect(l1.isContinuation).toBe(false);
    expect(l1.splitAt(TWO.times(Frac(3, 2)))).toBe(null); // split at 3 - no spill over
    expect(l1.splitAt(TWO)).toBe(null); // split at exactly 2 - no spill over
    const l3 = l1.splitAt(TWO.times(Frac(3, 4), true)); // split at 1.5
    expect(l3?.type).toBe(AtomType.SPACE);
    expect(l3?.isContinuation).toBe(true);
    expect(l3?.duration).toEqual(Frac(1, 2));
  });
});

describe("Group Tests", () => {
  test("Group Creation", () => {
    const notes = [new Syllable("aaa"), new Space(THREE, true), new Note("ga", THREE)];
    const g = new Group(...notes).setDuration(FIVE);
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

  test("Group addAtoms and insertAtomsAt", () => {
    const a1 = new Space(ONE);
    const a2 = new Space(TWO);
    const a3 = new Space(THREE);
    const a4 = new Space(FOUR);
    expect(a1.parentGroup).toBe(null);
    expect(a2.parentGroup).toBe(null);
    expect(a3.parentGroup).toBe(null);
    expect(a4.parentGroup).toBe(null);
    const g = new Group().setDuration(ONE, true);
    g.insertAtomsAt(null, a2, a4);
    expect(a2.parentGroup).toBe(g);
    expect(a4.parentGroup).toBe(g);
    expect(g.atoms.size).toBe(2);
    g.insertAtomsAt(a2, a1);
    expect(g.atoms.size).toBe(3);
    expect(a1.parentGroup).toBe(g);
  });

  test("Group Splitting with just atoms at atom boundary", () => {
    const atoms = [new Space(ONE), new Space(TWO), new Space(THREE), new Space(FOUR)];
    const g = new Group(...atoms).setDuration(ONE, true);
    expect(g.splitAt(FOUR.timesNum(5))).toBe(null);

    // split at 6 - last 4 length space should be split out
    const g2 = g.splitAt(THREE.timesNum(2));
    expect(g.atoms.size).toBe(3);
    expect(g.atoms.last).toBe(atoms[2]);
    expect(g2?.atoms.size).toBe(1);
    expect(g2?.atoms.first).toBe(atoms[3]);
  });

  test("Group Splitting with just atoms at atom boundary", () => {
    const atoms = [new Space(ONE), new Space(TWO), new Space(THREE), new Space(TWO), new Space(TWO)];
    const g = new Group(...atoms).setDuration(ONE, true);
    expect(g.splitAt(FOUR.timesNum(5))).toBe(null);

    // split at 6 - last 2 2-length spaces should be split out
    const g2 = g.splitAt(THREE.timesNum(2));
    expect(g2?.atoms.size).toBe(2);
    expect(g2?.atoms.first).toBe(atoms[3]);
    expect(g2?.atoms.last).toBe(atoms[4]);
  });

  test("Group Splitting with leaf atom being split", () => {
    const atoms = [new Space(ONE), new Space(TWO), new Space(THREE), new Space(FOUR)];
    const g = new Group(...atoms).setDuration(ONE, true);
    expect(g.splitAt(FOUR.timesNum(5))).toBe(null);

    // split at 6 - last 4 length space should be split out
    const g2 = g.splitAt(FIVE);
    expect(g.atoms.size).toBe(3);
    expect(g.atoms.last).toBe(atoms[2]);
    expect(atoms[2].duration).toEqual(TWO);
    expect(g2?.atoms.size).toBe(2);
    expect(g2?.atoms.first?.type).toBe(AtomType.SPACE);
    expect(g2?.atoms.first?.duration).toEqual(ONE);
    expect(g2?.atoms.last).toBe(atoms[3]);
  });

  test("Group Splitting with sub group being split", () => {
    const a3 = [new Space(ONE), new Space(ONE), new Space(ONE)];
    const g3 = new Group(...a3).setDuration(THREE);
    const a2 = [new Space(ONE), new Space(TWO), g3];
    const g2 = new Group(...a2).setDuration(TWO, true);
    const atoms = [new Space(TWO), new Space(TWO), g2, new Space(TWO), new Space(TWO)];
    const g = new Group(...atoms).setDuration(ONE, true);
    expect(g2.duration.factorized).toEqual(Frac(3));
    expect(g.duration.factorized).toEqual(Frac(11));

    const g4 = g.splitAt(SIX);
    expect(g.atoms.size).toBe(3);
    expect(g4?.atoms.size).toBe(3);
  });
});
