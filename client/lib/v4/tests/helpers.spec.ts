/**
 * @jest-environment jsdom
 */
import { loadV4Notation } from "../helpers";
import "../../../../common/jest/matchers";
import { getCircularReplacer } from "../../../common/utils";

function testV4(input: string, debug = false, expected: any = null): void {
  const [notation] = loadV4Notation(input);
  if (debug || expected == null) {
    console.log("Result Notation: \n", JSON.stringify(notation.debugValue(), getCircularReplacer(), 2));
  }
  expect(notation.debugValue()).toEqual(expected);
}

describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    testV4(
      String.raw`
           \line( "line1" , "a", "b", x = 1, c = 'hello', ab = "cd")
           \line( "line2" , offset = 3/4)
           `,
      false,
      {
        // only 1 empty line in a row at most
        blocks: [
          {
            roles: [],
            offset: "3/4",
            type: "Line",
          },
        ],
        currentAPB: 1,
        currentBreaks: [],
        currentCycle: 3,
        roles: [],
      },
    );
  });

  test("Test Parser", () => {
    testV4(
      `\\line("world")
       \\role("sw", notes = true, x = 3, d = 4 / 5)
       Sw: S R G M`,
      false,
      {
        blocks: [
          {
            roles: [
              {
                atoms: [
                  { type: "Literal", value: "S" },
                  { type: "Literal", value: "R" },
                  { type: "Literal", value: "G" },
                  { type: "Literal", value: "M" },
                ],
                name: "sw",
              },
            ],
            type: "Line",
          },
        ],
        currentAPB: 1,
        currentBreaks: [],
        currentCycle: 3,
        roles: [{ index: 0, name: "sw", notesOnly: true }],
      },
    );
  });

  test("Test Groups", () => {
    testV4(`\\role("sw", notes = true) Sw: [ a b c d ] 3 / 5 [ e f g h ] `, false, {
      blocks: [
        {
          roles: [
            {
              atoms: [
                {
                  atoms: [
                    { type: "Literal", value: "a" },
                    { type: "Literal", value: "b" },
                    { type: "Literal", value: "c" },
                    { type: "Literal", value: "d" },
                  ],
                  type: "Group",
                },
                {
                  atoms: [
                    { type: "Literal", value: "e" },
                    { type: "Literal", value: "f" },
                    { type: "Literal", value: "g" },
                    { type: "Literal", value: "h" },
                  ],
                  duration: "20/3",
                  durationIsMultiplier: true,
                  type: "Group",
                },
              ],
              name: "sw",
            },
          ],
          type: "Line",
        },
      ],
      currentAPB: 1,
      currentBreaks: [],
      currentCycle: 3,
      roles: [{ index: 0, name: "sw", notesOnly: true }],
    });
  });

  test("Test Duplicate Roles", () => {
    testV4(
      `
        \\aksharasPerBeat(4)
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
        blocks: [
          {
            roles: [
              {
                atoms: [
                  { type: "Literal", value: "s" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "m" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "p" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "n" },
                  { octave: 1, type: "Note", value: "S" },
                  { isSilent: false, type: "Space" },
                  { octave: 1, type: "Note", value: "S" },
                  { type: "Literal", value: "P" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "m" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "s" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "r" },
                  { octave: -1, type: "Note", value: "n" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "s" },
                  { octave: -1, type: "Note", value: "p" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { octave: -1, type: "Note", value: "n" },
                  { type: "Literal", value: "s" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "m" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "n" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { octave: 1, type: "Note", value: "s" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "n" },
                  { type: "Literal", value: "p" },
                  { type: "Literal", value: "m" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "g" },
                  { type: "Literal", value: "r" },
                  { type: "Literal", value: "s" },
                  { isSilent: false, type: "Space" },
                  { octave: -1, type: "Note", value: "n" },
                ],
                name: "sw",
              },
              {
                atoms: [
                  { type: "Literal", value: "Ni" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ve" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ga" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ti" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ya" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ni" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ni" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ra" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ta" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "mu" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "Ni" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "pa" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "da" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "mu" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "le" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "nam" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "mi" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                  { type: "Literal", value: "ti" },
                  { isSilent: false, type: "Space" },
                  { isSilent: false, type: "Space" },
                ],
                name: "sh",
              },
            ],
            type: "Line",
          },
        ],
        currentAPB: 4,
        currentBreaks: [],
        currentCycle: 3,
        roles: [
          { index: 0, name: "sw", notesOnly: true },
          { index: 1, name: "sh", notesOnly: false },
        ],
      },
    );
  });

  test("Test Rests", () => {
    testV4(
      String.raw`
       \role("sw", notes = true)
       \role("sh")
       Sw: - S -- -- - R G M. -
       Sh: - a b c- d - e - - -
        `,
      false,
      {
        blocks: [
          {
            roles: [
              {
                atoms: [
                  { type: "Literal", value: "S", beforeRest: true },
                  { type: "Literal", value: "R" },
                  { type: "Literal", value: "G" },
                  { octave: 1, type: "Note", value: "M", beforeRest: true },
                ],
                name: "sw",
              },
              {
                atoms: [
                  { type: "Literal", value: "a" },
                  { type: "Literal", value: "b" },
                  { type: "Literal", value: "c", beforeRest: true },
                  { type: "Literal", value: "d", beforeRest: true },
                  { type: "Literal", value: "e", beforeRest: true },
                ],
                name: "sh",
              },
            ],
            type: "Line",
          },
        ],
        currentAPB: 1,
        currentBreaks: [],
        currentCycle: 3,
        roles: [
          { index: 0, name: "sw", notesOnly: true },
          { index: 1, name: "sh", notesOnly: false },
        ],
      },
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
