import { Parser } from "../parser";
import { AddAtoms, RawEmbedding } from "../commands";

function parseSource(input: string) {
  const parser = new Parser();
  parser.parse(input);
  const notes = parser.commands
    .filter((c): c is AddAtoms => c instanceof AddAtoms)
    .flatMap((c) => c.atoms.map((a: any) => a.value ?? a.TYPE));
  const embeds = parser.commands.filter((c) => c instanceof RawEmbedding).length;
  return { notes, embeds, errors: parser.errors.map((e) => e.message) };
}

describe("Old marker syntax", () => {
  test('"x">> keeps the notes after it and reports an error naming \\@label', () => {
    const { notes, embeds, errors } = parseSource('"1.">> s r g m');
    expect(notes).toEqual(["s", "r", "g", "m"]);
    expect(embeds).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('\\@label("1.")');
  });

  test('<<"x" keeps the notes before it and reports an error naming \\@label', () => {
    const { notes, errors } = parseSource('s r g m <<"g r"\np d n s');
    expect(notes).toEqual(["s", "r", "g", "m", "p", "d", "n", "s"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('\\@label("g r", position="after")');
  });

  test("a > after notes on the same line is an error, not an embed", () => {
    const { notes, embeds, errors } = parseSource("s r > g m");
    expect(embeds).toBe(0);
    expect(errors).toHaveLength(1);
    expect(notes).toEqual(["s", "r", "g", "m"]);
  });

  test("a > at the start of a line is still an embed", () => {
    const { notes, embeds, errors } = parseSource("s r\n> ## Pallavi\n  > ### Indented\ng m");
    expect(errors).toEqual([]);
    expect(embeds).toBe(2);
    expect(notes).toEqual(["s", "r", "g", "m"]);
  });
});
