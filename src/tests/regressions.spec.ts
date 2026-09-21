/**
 * @jest-environment jsdom
 */
import { Parser } from "../parser";
import { load } from "../loader";

const GOOD = `\\cycle("|4|2|2|")\nmrid: tham , thi ,\n`;
const BAD = `\\cycle("|4|")\nmrid: tham ]\n`;

describe("Parser State Isolation", () => {
  test("Bad input reports an error", () => {
    expect(load(BAD)[2].map((e: any) => e.message)).toEqual(["Unexpected Token: 'CLOSE_SQ'"]);
  });

  test("A failed load does not poison later loads", () => {
    expect(load(GOOD)[2]).toEqual([]);
    expect(load(BAD)[2].length).toBeGreaterThan(0);
    expect(load(GOOD)[2]).toEqual([]);
    expect(load(GOOD)[2]).toEqual([]);
  });

  test("Interleaved good and bad loads each report their own input", () => {
    expect(load(BAD)[2].length).toBeGreaterThan(0);
    expect(load(GOOD)[2]).toEqual([]);
    expect(load(BAD)[2].length).toBeGreaterThan(0);
    expect(load(GOOD)[2]).toEqual([]);
  });

  test("A fresh Parser after a failed parse sees a clean token stream", () => {
    new Parser().parse(BAD);
    const parser = new Parser();
    parser.parse(GOOD);
    expect(parser.errors).toEqual([]);
  });

  test("A failed parse inside a block does not break the next block parse", () => {
    new Parser().parse(`\\cycle("|2|") {\n mrid: tham ]\n`);
    const parser = new Parser();
    parser.parse(`\\cycle("|2|") {\n mrid: tham , thi ,\n}`);
    expect(parser.errors).toEqual([]);
    expect(parser.commands.map((c: any) => c.debugValue())).toEqual([
      {
        name: "Block(SetCycle)",
        index: 0,
        innerCommand: {
          name: "SetCycle",
          index: 0,
          params: [{ key: null, value: "|2|" }],
        },
        blockCommands: [
          {
            name: "ActivateRole",
            index: 0,
            params: [{ key: null, value: "mrid" }],
          },
          {
            name: "AddAtoms",
            index: 1,
            atoms: [
              { type: "Literal", value: "tham" },
              { type: "Space", isSilent: false },
              { type: "Literal", value: "thi" },
              { type: "Space", isSilent: false },
            ],
          },
        ],
      },
    ]);
  });
});
