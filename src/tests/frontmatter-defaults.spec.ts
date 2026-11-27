import { load } from "../loader";

function beatsPerBar(source: string): number[] {
  const [notation] = load(source);
  return notation.localCycle!.bars.map((b) => b.beatCount);
}

describe("front matter defaults", () => {
  test("cycle sets the document's tala", () => {
    expect(beatsPerBar(`---\ncycle: "|4|2|2|"\n---\nSw: S R G M`)).toEqual([4, 2, 2]);
  });

  test("beatDuration and breaks set the document's speed and line breaks", () => {
    const [notation, , errors] = load(`---\nbeatDuration: 4\nbreaks: [4, 4]\n---\nSw: S R G M`);
    expect(errors).toEqual([]);
    expect(notation.localAtomsPerBeat).toBe(4);
    expect(notation.localBreaks).toEqual([4, 4]);
  });

  test("a single number works for breaks", () => {
    const [notation] = load(`---\nbreaks: 6\n---\nSw: S`);
    expect(notation.localBreaks).toEqual([6]);
  });

  test("keys match whatever their case", () => {
    const [notation] = load(`---\nBeatDuration: 2\nCycle: "|3|"\n---\nSw: S R G`);
    expect(notation.localAtomsPerBeat).toBe(2);
    expect(notation.localCycle!.bars.map((b) => b.beatCount)).toEqual([3]);
  });

  test("a command in the body overrides the front matter", () => {
    expect(beatsPerBar(`---\ncycle: "|4|2|2|"\n---\n\\cycle("|3|")\nSw: S R G`)).toEqual([3]);
  });

  test("the keys stay in the metadata too", () => {
    const [notation] = load(`---\ncycle: "|4|"\ntitle: "Alankaram 1"\n---\nSw: S R G M`);
    expect(notation.metadata.get("cycle")?.value).toBe("|4|");
    expect(notation.metadata.get("title")?.value).toBe("Alankaram 1");
  });

  test("a bad value is a parse error, not an exception", () => {
    const [, , errors] = load(`---\nbeatDuration: "fast"\n---\nSw: S`);
    expect(errors).toHaveLength(1);
    expect(String(errors[0].message)).toContain("beatDuration");
    expect(String(errors[0].message)).toContain("front matter");
  });

  test("without these keys nothing changes", () => {
    const [notation, , errors] = load(`---\nragam: "Mohanam"\n---\nSw: S R G M`);
    expect(errors).toEqual([]);
    expect(notation.localAtomsPerBeat).toBe(1);
  });
});
