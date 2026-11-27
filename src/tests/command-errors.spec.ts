import { load } from "../loader";

const notesIn = (notation: any): string[] => {
  const out: string[] = [];
  const walk = (item: any) => {
    if (item.TYPE == "Line") {
      for (const role of item.roles) for (const atom of role.atoms) out.push(atom.value);
    }
    for (const child of item.blockItems ?? []) walk(child);
  };
  walk(notation);
  return out;
};

describe("A bad command is a parse error, not an exception", () => {
  test.each([
    ["cycle", '\\cycle("|4x|")'],
    ["cycle", '\\cycle("|_|")'],
    ["cycle", '\\cycle("|4x|") { p d }'],
    ["cycle", "\\cycle()"],
    ["cycle", "\\cycle(4)"],
    ["beatDuration", '\\beatDuration("x")'],
    ["breaks", '\\breaks("x")'],
    ["repeat", '\\repeat("x") { p d }'],
    ["role", "\\role()"],
  ])("\\%s: %s", (name, command) => {
    const [notation, , errors] = load(`s r\n${command}\ng m`);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(`\\${name}`);
    expect(notesIn(notation)).toEqual(["s", "r", "g", "m"]);
  });

  test("a bad cycle in front matter names the key", () => {
    const [, , errors] = load('---\ncycle: "|4x|"\n---\ns r g m');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("front matter cycle");
  });

  test("a good cycle still applies, in the body and in a block", () => {
    const [notation, , errors] = load('\\cycle("|10|4|")\ns r\n\\cycle("|3|") { g m }');
    expect(errors).toEqual([]);
    expect(String((notation as any).localCycle)).toBe("|10|4|");
    const block = notation.blockItems.find((b: any) => b.blockType == "cycle") as any;
    expect(String(block.localCycle)).toBe("|3|");
  });
});
