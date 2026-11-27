import { Parser } from "../parser";
import { load } from "../loader";
import { carnaticGamakas } from "../carnatic/gamakas";

const SRC = '\\cycle("|4|")\nSw: ~/ g m\n';

function embsOfG(notation: any): string[] {
  const s = JSON.stringify(notation.debugValue());
  const m = /"value":"g","embs":\[\{"type":"(\w+)"/.exec(s);
  return m ? [m[1]] : [];
}

describe("embellishment parsers", () => {
  test("a Parser with no embellishment parser reports ~ and says how to fix it", () => {
    const parser = new Parser();
    parser.parse(SRC);
    const messages = parser.errors.map((e: any) => String(e.message));
    expect(messages.some((m) => m.includes("embellishments"))).toBe(true);
  });

  test("a Parser given the Carnatic gamakas reads ~/ as an eetra jaaru", () => {
    const [notation, errors] = new Parser({ embellishments: carnaticGamakas }).parseAndBuild(SRC);
    expect(errors).toEqual([]);
    expect(embsOfG(notation)).toEqual(["EetraJaaru"]);
  });

  test("load() wires in the Carnatic gamakas, as before", () => {
    const [notation, , errors] = load(SRC);
    expect(errors).toEqual([]);
    expect(embsOfG(notation)).toEqual(["EetraJaaru"]);
  });
});
