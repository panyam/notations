import { V3Parser } from "../v3";
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
                type: 0,
                value: "S",
              },
              {
                type: 0,
                value: "R",
              },
              {
                type: 0,
                value: "G",
              },
              {
                type: 0,
                value: "M",
              },
            ],
          },
        ],
      },
    );
  });

  test("Test Duplicate Roles", () => {
    testV3(
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
      {
        instrs: [
          {
            name: "SetProperty",
            index: 0,
            params: [
              {
                key: "aksharasPerBeat",
                value: {
                  num: 4,
                  den: 1,
                },
              },
            ],
            aksharasPerBeat: {
              num: 4,
              den: 1,
            },
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
              { type: 2, value: "s" },
              { type: 2, value: "g" },
              { type: 2, value: "g" },
              { type: 2, value: "r" },
              { type: 2, value: "r" },
              { type: 2, value: "m" },
              { type: 3, isSilent: false },
              { type: 3, isSilent: false },
              { type: 2, value: "m" },
              { type: 2, value: "n" },
              { type: 2, value: "p" },
              { type: 2, value: "n" },
              { type: 2, value: "m" },
              { type: 2, value: "p" },
              { type: 3, isSilent: false },
              { type: 3, isSilent: false },
              { type: 2, value: "n" },
              { type: 0, value: "S", octave: 1 },
              { type: 3, isSilent: false },
              { type: 0, value: "S", octave: 1 },
              { type: 2, value: "P" },
              { type: 3, isSilent: false },
              { type: 2, value: "n" },
              { type: 2, value: "p" },
              { type: 2, value: "n" },
              { type: 2, value: "m" },
              { type: 2, value: "p" },
              { type: 2, value: "m" },
              { type: 3, isSilent: false },
              { type: 2, value: "m" },
              { type: 2, value: "g" },
              { type: 2, value: "r" },
              { type: 2, value: "s" },
              { type: 2, value: "g" },
              { type: 2, value: "r" },
              { type: 0, value: "n", octave: -1 },
              { type: 2, value: "r" },
              { type: 2, value: "s" },
              { type: 0, value: "p", octave: -1 },
              { type: 3, isSilent: false },
              { type: 3, isSilent: false },
              { type: 0, value: "n", octave: -1 },
              { type: 2, value: "s" },
              { type: 2, value: "g" },
              { type: 2, value: "r" },
              { type: 2, value: "m" },
              { type: 2, value: "p" },
              { type: 2, value: "n" },
              { type: 2, value: "m" },
              { type: 2, value: "p" },
              { type: 2, value: "n" },
              { type: 3, isSilent: false },
              { type: 3, isSilent: false },
              { type: 0, value: "s", octave: 1 },
              { type: 3, isSilent: false },
              { type: 2, value: "n" },
              { type: 2, value: "p" },
              { type: 2, value: "m" },
              { type: 3, isSilent: false },
              { type: 2, value: "g" },
              {
                type: 2,
                value: "r",
              },
              {
                type: 2,
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
                type: 0,
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
                type: 0,
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
                type: 0,
                value: "ga",
              },
              {
                type: 3,
                isSilent: false,
              },
              {
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
                value: "ra",
              },
              {
                type: 3,
                isSilent: false,
              },
              {
                type: 0,
                value: "ta",
              },
              {
                type: 3,
                isSilent: false,
              },
              {
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
                type: 0,
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
      },
    );
  });

  /*
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
