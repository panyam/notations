/**
 * @jest-environment jsdom
 */
import * as TSU from "@panyam/tsutils";
import { Line } from "../core";
import { Parser } from "../parser";
import { RawBlock, Command, Notation } from "../notation";

function fromCommands(cmds: Command[]): Notation {
  const out = new Notation();
  for (const cmd of cmds) cmd.applyToNotation(out);
  return out;
}

function testV4(input: string, debug = false): [Command[], Notation] {
  const parser = new Parser();
  const root = parser.parse(input);
  const cmds = parser.commands.map((c: any) => c.debugValue());
  const notation = fromCommands(parser.commands);
  if (debug) {
    // console.log("Parse Tree: \n", JSON.stringify(root.debugValue(), getCircularReplacer(), 2));
    console.log("Commands: \n", JSON.stringify(cmds, TSU.Misc.getCircularReplacer(), 2));
    console.log("Notation: \n", JSON.stringify(notation.debugValue(), TSU.Misc.getCircularReplacer(), 2));
  }
  // expect(notation.debugValue()).toEqual(expected);
  return [parser.commands, notation];
}

function expectNotation(notation: Notation, expected: any) {
  if ("roles" in expected) {
    expect(notation.roles).toEqual(expected.roles);
  }
  if ("blocks" in expected) {
    expect(notation.blocks.length).toBe(expected.blocks.length);
    for (let i = 0; i < expected.blocks.length; i++) {
      const block = expected.blocks[i];
      const found = notation.blocks[i];
      if (block.type === "Raw") {
        expect(found.type).toEqual("RawBlock");
        expect((found as RawBlock).content).toEqual(block.content);
      } else {
        const line = found as Line;
        expect(line.roles.map((r) => r.debugValue())).toEqual(block.roles);
        const lpForLine = notation.layoutParamsForLine(line);
        if (typeof block.layoutParams === "number") {
          expect(lpForLine).toBe(notation.unnamedLayoutParams[block.layoutParams]);
        } else {
          expect(lpForLine).toBe(notation.namedLayoutParams.get(block.layoutParams));
        }
      }
    }
  }
}

describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    const [cmds, notation] = testV4(
      String.raw`
        \role("Sw", notes = true)
        \role("Sh")
        Sw: s r g m p , 
      `,
    );
    expectNotation(notation, {
      roles: [
        {
          index: 0,
          name: "sw",
          notesOnly: true,
        },
        {
          index: 1,
          name: "sh",
          notesOnly: false,
        },
      ],
      blocks: [
        {
          type: "Line",
          layoutParams: 0,
          roles: [
            {
              name: "sw",
              atoms: [
                {
                  type: "Literal",
                  value: "s",
                },
                {
                  type: "Literal",
                  value: "r",
                },
                {
                  type: "Literal",
                  value: "g",
                },
                {
                  type: "Literal",
                  value: "m",
                },
                {
                  type: "Literal",
                  value: "p",
                },
                {
                  type: "Space",
                  isSilent: false,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("Test param validation", () => {
    expect(() =>
      testV4(
        String.raw`
        \aksharasPerBeat("hello")
        `,
      ),
    ).toThrowError("aksharasPerBeat command must contain one number");
    expect(() =>
      testV4(
        String.raw`
        \breaks(1, "b")
        `,
      ),
    ).toThrowError("Breaks command must be a list of integers");
    expect(() =>
      testV4(
        String.raw`
        \breaks(a = 1)
        `,
      ),
    ).toThrowError("Breaks command cannot have keyword params");
    expect(() =>
      testV4(
        String.raw`
        \layout(3)
        `,
      ),
    ).toThrowError("layout command must contain one string argument");
  });

  test("Test default currRole", () => {
    const [cmds, notation] = testV4(
      String.raw`
        \role("Sw", notes = true)
        \role("Sh")
        `,
    );
    expect(notation.currRoleDef.name).toEqual("sh");
  });

  test("Test duplicate role", () => {
    expect(() =>
      testV4(
        String.raw`
        \role("Sw", notes = true)
        \role("Sw");
        `,
      ),
    ).toThrowError("Role already exists");
  });

  test("Test Building more complex notation", () => {
    const [cmds, notation] = testV4(
      String.raw`
        \role("Sw", notes = true)
        \role("Sh")
        \cycle("|,,,,|,,|,,|")
        \breaks(4,2,2)
        \aksharasPerBeat(2)

        Sw: s r g m p , 

        \layout("test")
        Sh: a b c d e , 

        \aksharasPerBeat(2)
        Sw: s. n d p m ,

        r"Some Raw Content"
      `,
    );
    expectNotation(notation, {
      roles: [
        {
          index: 0,
          name: "sw",
          notesOnly: true,
        },
        {
          index: 1,
          name: "sh",
          notesOnly: false,
        },
      ],
      blocks: [
        {
          type: "Line",
          roles: [
            {
              name: "sw",
              atoms: [
                {
                  type: "Literal",
                  value: "s",
                },
                {
                  type: "Literal",
                  value: "r",
                },
                {
                  type: "Literal",
                  value: "g",
                },
                {
                  type: "Literal",
                  value: "m",
                },
                {
                  type: "Literal",
                  value: "p",
                },
                {
                  type: "Space",
                  isSilent: false,
                },
              ],
            },
          ],
          layoutParams: 0,
        },
        {
          type: "Line",
          roles: [
            {
              name: "sh",
              atoms: [
                {
                  type: "Literal",
                  value: "a",
                },
                {
                  type: "Literal",
                  value: "b",
                },
                {
                  type: "Literal",
                  value: "c",
                },
                {
                  type: "Literal",
                  value: "d",
                },
                {
                  type: "Literal",
                  value: "e",
                },
                {
                  type: "Space",
                  isSilent: false,
                },
              ],
            },
          ],
          layoutParams: "test",
        },
        {
          type: "Line",
          roles: [
            {
              name: "sw",
              atoms: [
                {
                  type: "Note",
                  value: "s",
                  octave: 1,
                },
                {
                  type: "Literal",
                  value: "n",
                },
                {
                  type: "Literal",
                  value: "d",
                },
                {
                  type: "Literal",
                  value: "p",
                },
                {
                  type: "Literal",
                  value: "m",
                },
                {
                  type: "Space",
                  isSilent: false,
                },
              ],
            },
          ],
          layoutParams: 0,
        },
        {
          type: "Raw",
          content: "Some Raw Content",
        },
      ],
    });
  });
});
