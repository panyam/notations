import { Command, V3Parser } from "../v3";
import { TokenType } from "../tokens";
import { Notebook } from "../../models/notebook";
import "../../../common/jest/matchers";

function testV3(input: string, debug = false, expected: any = null): void {
  const notebook = new Notebook();
  const snippet = notebook.newSnippet();
  const parser = new V3Parser(snippet);
  const root = parser.parse(input);
  if (debug || expected == null) {
    console.log("Result Parse Tree: \n", JSON.stringify(root?.debugValue(), null, 2));
    console.log("Result Snippet: \n", JSON.stringify(parser.snippet.debugValue(), null, 2));
  }
  expect(parser.snippet.debugValue()).toEqual(expected);
}
describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    testV3(`\\line( "world" , "a", "b", x = 1, c = 'hello', ab = "cd")`, false, {
      instrs: [
        {
          name: "CreateLine",
          index: 0,
          params: [
            {
              key: null,
              value: "world",
            },
            {
              key: null,
              value: "a",
            },
            {
              key: null,
              value: "b",
            },
            {
              key: "x",
              value: {
                num: 1,
                den: 1,
              },
            },
            {
              key: "c",
              value: "hello",
            },
            {
              key: "ab",
              value: "cd",
            },
          ],
        },
      ],
    });
  });

  test("Test Parser", () => {
    testV3(
      `\\line("world")
       \\role("sw", notes = true, x = 3, d = 4 / 5)
       Sw: S R G M`,
      false,
      {
        instrs: [
          {
            name: "CreateLine",
            index: 0,
            params: [
              {
                key: null,
                value: "world",
              },
            ],
          },
          {
            name: "CreateRole",
            index: 1,
            params: [
              {
                key: null,
                value: "sw",
              },
              {
                key: "notes",
                value: true,
              },
              {
                key: "x",
                value: {
                  num: 3,
                  den: 1,
                },
              },
              {
                key: "d",
                value: {
                  num: 4,
                  den: 5,
                },
              },
            ],
          },
          {
            name: "ActivateRole",
            index: 2,
            params: [
              {
                key: null,
                value: "sw",
              },
            ],
          },
          {
            name: "AddAtoms",
            index: 3,
            atoms: [
              {
                metadata: {},
                type: 0,
                duration: {
                  num: 1,
                  den: 1,
                },
                value: "S",
                octave: 0,
                shift: 0,
              },
              {
                metadata: {},
                type: 0,
                duration: {
                  num: 1,
                  den: 1,
                },
                value: "R",
                octave: 0,
                shift: 0,
              },
              {
                metadata: {},
                type: 0,
                duration: {
                  num: 1,
                  den: 1,
                },
                value: "G",
                octave: 0,
                shift: 0,
              },
              {
                metadata: {},
                type: 0,
                duration: {
                  num: 1,
                  den: 1,
                },
                value: "M",
                octave: 0,
                shift: 0,
              },
            ],
          },
        ],
      },
    );
  });

  /*
  test("Test Duplicate Roles", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw)");
    expect(() => parser.parse("\\role(sw, notes = true)")).not.toThrowError();
  });

  test("Test Atoms", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw, notes = true)");
    parser.parse("\\role(sh)");
    parser.parse("Sw: S R [ G. .M ]");
    parser.parse("Sh: S R G 2/3 M");
  });
  */
});
