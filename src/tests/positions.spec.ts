import { load } from "../loader";
import { atomAt, sourceAtom, walkAtoms } from "../positions";
import { Atom, Group, Literal, Note, Syllable } from "../core";

const parseAtoms = (src: string): Atom[] => {
  const [notation, , errors] = load(src);
  expect(errors).toEqual([]);
  return [...walkAtoms(notation)];
};

const textOf = (src: string, a: Atom) => src.substring(a.sourceRange![0], a.sourceRange![1]);

describe("atom source ranges (#102)", () => {
  test("each note, space and group covers its own text in the source", () => {
    const src = 'Sw: S R [G M] ,\nSh: "sa" ri ga ma ,';
    const atoms = parseAtoms(src);
    const texts = atoms.map((a) => textOf(src, a));
    expect(texts).toEqual(["S", "R", "[G M]", "G", "M", ",", '"sa"', "ri", "ga", "ma", ","]);
  });

  test("ranges count from the start of the whole source, front matter included", () => {
    const src = "---\nragam: Mohanam\n---\nSw: S R";
    const [s, r] = parseAtoms(src);
    expect(s.sourceRange![0]).toBe(src.indexOf("S R"));
    expect(textOf(src, r)).toBe("R");
  });

  test("octave dots and a gamaka are part of the note they mark", () => {
    const src = '\\cycle("|4|")\nSw: .S S. ~/ g';
    expect(parseAtoms(src).map((a) => textOf(src, a))).toEqual([".S", "S.", "~/ g"]);
  });

  test("a note derived from a parsed one points back to it and keeps its range", () => {
    const lit = new Literal("S");
    lit.sourceRange = [4, 5];
    for (const derived of [Note.fromLit(lit), Syllable.fromLit(lit), lit.clone()]) {
      expect(sourceAtom(derived)).toBe(lit);
      expect(derived.sourceRange).toEqual([4, 5]);
    }
  });

  test("the rest of a note split across a beat points back to the note", () => {
    const note = new Note("S");
    note.sourceRange = [4, 5];
    note.duration = note.duration.timesNum(2);
    const spill = note.splitAt(note.duration.divbyNum(2))!;
    expect(sourceAtom(spill)).toBe(note);
    expect(spill.sourceRange).toEqual([4, 5]);
  });
});

describe("atomAt (#102)", () => {
  const src = "Sw: S R [G M] ,";
  const [notation] = load(src);

  test("finds the note under a caret, including just after its last character", () => {
    expect((atomAt(notation, src.indexOf("R")) as Literal).value).toBe("R");
    expect((atomAt(notation, src.indexOf("R") + 1) as Literal).value).toBe("R");
  });

  test("prefers the note inside a group over the group", () => {
    expect((atomAt(notation, src.indexOf("G")) as Literal).value).toBe("G");
    expect(atomAt(notation, src.indexOf("[")) instanceof Group).toBe(true);
  });

  test("finds nothing in the role name or in a gap between notes", () => {
    expect(atomAt(notation, 1)).toBeNull();
    const [spaced] = load("Sw: S  R");
    expect(atomAt(spaced, "Sw: S ".length)).toBeNull();
  });
});

describe("tokenizer error lengths", () => {
  // tlex's Token.end is exclusive, so a token is end - start characters long.
  test("an invalid gamaka's error covers exactly its text", () => {
    const [, , errors] = load('\\cycle("|4|")\nSw: ~zzz g');
    const err = errors.find((e: any) => e.type == "InvalidEmbelishment") as any;
    expect(err.length).toBe("~zzz".length);
  });
});
