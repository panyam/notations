/**
 * @jest-environment jsdom
 */
import { V4Parser } from "../v4";
import { Notebook } from "../../models/notebook";
import "../../../common/jest/matchers";

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: any, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

function testV4(input: string, debug = false, expected: any = null): void {
  const notebook = new Notebook();
  const snippet = notebook.newSnippet();
  const parser = new V4Parser(snippet);
  const root = parser.parse(input);
  const cmds = parser.commands.map((c: any) => c.debugValue());
  if (debug || expected == null) {
    console.log("Result Parse Tree: \n", JSON.stringify(root.debugValue(), getCircularReplacer(), 2));
    console.log("Result Snippet: \n", JSON.stringify(cmds, getCircularReplacer(), 2));
  }
  expect(cmds).toEqual(expected);
}

describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    testV4(`\\line( "world" , "a", "b", x = 1, c = 'hello', ab = "cd")`, false, [
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
            value: 1,
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
    ]);
  });

  test("Test Parser", () => {
    testV4(
      `\\line("world")
       \\role("sw", notes = true, x = 3, d = 4 / 5)
       Sw: S R G M`,
      false,
      [
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
              value: 3,
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
              type: 1,
              value: "S",
            },
            {
              type: 1,
              value: "R",
            },
            {
              type: 1,
              value: "G",
            },
            {
              type: 1,
              value: "M",
            },
          ],
        },
      ],
    );
  });

  test("Test Groups", () => {
    testV4(`\\role("sw", notes = true) Sw: [ a b c d ] 3 / 5 [ e f g h ] `, false, [
      {
        name: "CreateRole",
        index: 0,
        params: [
          {
            key: null,
            value: "sw",
          },
          {
            key: "notes",
            value: true,
          },
        ],
      },
      {
        name: "ActivateRole",
        index: 1,
        params: [
          {
            key: null,
            value: "sw",
          },
        ],
      },
      {
        name: "AddAtoms",
        index: 2,
        atoms: [
          {
            type: 4,
            atoms: [
              {
                type: 1,
                value: "a",
              },
              {
                type: 1,
                value: "b",
              },
              {
                type: 1,
                value: "c",
              },
              {
                type: 1,
                value: "d",
              },
            ],
          },
          {
            type: 4,
            duration: "20/3",
            durationIsMultiplier: true,
            atoms: [
              {
                type: 1,
                value: "e",
              },
              {
                type: 1,
                value: "f",
              },
              {
                type: 1,
                value: "g",
              },
              {
                type: 1,
                value: "h",
              },
            ],
          },
        ],
      },
    ]);
  });

  test("Test Duplicate Roles", () => {
    testV4(
      `
        \\set(aksharasPerBeat = 4)
        \\role("sw", notes = true)
        \\role("sh")

        Sw:
        s g g r r m , , m n p n m p , , n S. , S. P , n p n m p m , m g r 
        s g r .n r s .p , , .n s g r m p n m p n , , s. , n p m , g r s , .n

        Sh:
        Ni , , , , ve , , ga , ti , , ya  , , ni , , , , , ni , , ra , ta , mu , ,
        Ni , , pa , , da , , mu , , , , le , , , , , , nam , , , mi , , , ti , ,
        `,
      false,

      [
        {
          name: "SetProperty",
          index: 0,
          params: [
            {
              key: "aksharasPerBeat",
              value: 4,
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
          ],
        },
        {
          name: "CreateRole",
          index: 2,
          params: [{ key: null, value: "sh" }],
        },
        {
          name: "ActivateRole",
          index: 3,
          params: [{ key: null, value: "sw" }],
        },
        {
          name: "AddAtoms",
          index: 4,
          atoms: [
            { type: 1, value: "s" },
            { type: 1, value: "g" },
            { type: 1, value: "g" },
            { type: 1, value: "r" },
            { type: 1, value: "r" },
            { type: 1, value: "m" },
            { type: 3, isSilent: false },
            { type: 3, isSilent: false },
            { type: 1, value: "m" },
            { type: 1, value: "n" },
            { type: 1, value: "p" },
            { type: 1, value: "n" },
            { type: 1, value: "m" },
            { type: 1, value: "p" },
            { type: 3, isSilent: false },
            { type: 3, isSilent: false },
            { type: 1, value: "n" },
            { type: 0, value: "S", octave: 1 },
            { type: 3, isSilent: false },
            { type: 0, value: "S", octave: 1 },
            { type: 1, value: "P" },
            { type: 3, isSilent: false },
            { type: 1, value: "n" },
            { type: 1, value: "p" },
            { type: 1, value: "n" },
            { type: 1, value: "m" },
            { type: 1, value: "p" },
            { type: 1, value: "m" },
            { type: 3, isSilent: false },
            { type: 1, value: "m" },
            { type: 1, value: "g" },
            { type: 1, value: "r" },
            { type: 1, value: "s" },
            { type: 1, value: "g" },
            { type: 1, value: "r" },
            { type: 0, value: "n", octave: -1 },
            { type: 1, value: "r" },
            { type: 1, value: "s" },
            { type: 0, value: "p", octave: -1 },
            { type: 3, isSilent: false },
            { type: 3, isSilent: false },
            { type: 0, value: "n", octave: -1 },
            { type: 1, value: "s" },
            { type: 1, value: "g" },
            { type: 1, value: "r" },
            { type: 1, value: "m" },
            { type: 1, value: "p" },
            { type: 1, value: "n" },
            { type: 1, value: "m" },
            { type: 1, value: "p" },
            { type: 1, value: "n" },
            { type: 3, isSilent: false },
            { type: 3, isSilent: false },
            { type: 0, value: "s", octave: 1 },
            { type: 3, isSilent: false },
            { type: 1, value: "n" },
            { type: 1, value: "p" },
            { type: 1, value: "m" },
            { type: 3, isSilent: false },
            { type: 1, value: "g" },
            {
              type: 1,
              value: "r",
            },
            {
              type: 1,
              value: "s",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 0,
              value: "n",
              octave: -1,
            },
          ],
        },
        {
          name: "ActivateRole",
          index: 5,
          params: [
            {
              key: null,
              value: "sh",
            },
          ],
        },
        {
          name: "AddAtoms",
          index: 6,
          atoms: [
            {
              type: 1,
              value: "Ni",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ve",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ga",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ti",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ya",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ni",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ni",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ra",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ta",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "mu",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "Ni",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "pa",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "da",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "mu",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "le",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "nam",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "mi",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 1,
              value: "ti",
            },
            {
              type: 3,
              isSilent: false,
            },
            {
              type: 3,
              isSilent: false,
            },
          ],
        },
      ],
    );
  });

  /*
  test("Test Atoms", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V4Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw, notes = true)");
    parser.parse("\\role(sh)");
    parser.parse("Sw: S R [ G. .M ]");
    parser.parse("Sh: S R G 2/3 M");
  });
  */
});
