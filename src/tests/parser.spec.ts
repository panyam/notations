/**
 * @jest-environment jsdom
 */
import * as TSU from "@panyam/tsutils";
import { Parser } from "../parser";

function testV4(input: string, debug = false, expected: any = null, fm?: any): void {
  const parser = new Parser();
  const root = parser.parse(input);
  const cmds = parser.commands.map((c: any) => c.debugValue());
  if (parser.errors.length > 0) {
    console.log("Parse Errors: ", parser.errors);
  }
  if (debug || expected == null) {
    console.log("Result Parse Tree: \n", JSON.stringify(root.debugValue(), TSU.Misc.getCircularReplacer(), 2));
    console.log("Result Snippet: \n", JSON.stringify(cmds, TSU.Misc.getCircularReplacer(), 2));
  }
  expect(cmds).toEqual(expected);
  if (fm) {
    expect(fm).toEqual(parser.metadata);
  }
}

describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    testV4(`\\line(-2, -2/-1, 2/-2, offset = -2)`, false, [
      {
        name: "CreateLine",
        index: 0,
        params: [
          {
            key: null,
            value: -2,
          },
          {
            key: null,
            value: { num: -2, den: -1 },
          },
          {
            key: null,
            value: { num: 2, den: -2 },
          },
          {
            key: "offset",
            value: -2,
          },
        ],
      },
    ]);
  });

  test("Test Command Parsing 2", () => {
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
              type: "Literal",
              value: "S",
            },
            {
              type: "Literal",
              value: "R",
            },
            {
              type: "Literal",
              value: "G",
            },
            {
              type: "Literal",
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
            type: "Group",
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
            ],
            duration: "2/1",
            durationIsMultiplier: true,
          },
          {
            type: "Group",
            duration: "20/3",
            durationIsMultiplier: true,
            atoms: [
              {
                type: "Literal",
                value: "e",
              },
              {
                type: "Literal",
                value: "f",
              },
              {
                type: "Literal",
                value: "g",
              },
              {
                type: "Literal",
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
        \\beatDuration(4)
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
          name: "SetBeatDuration",
          index: 0,
          params: [{ key: null, value: 4 }],
        },
        {
          name: "CreateRole",
          index: 1,
          params: [
            { key: null, value: "sw" },
            { key: "notes", value: true },
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
            { type: "Literal", value: "s" },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "m" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "p" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "n" },
            { type: "Note", value: "S", octave: 1 },
            { type: "Space", isSilent: false },
            { type: "Note", value: "S", octave: 1 },
            { type: "Literal", value: "P" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "m" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "s" },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "r" },
            { type: "Note", value: "n", octave: -1 },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "s" },
            { type: "Note", value: "p", octave: -1 },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Note", value: "n", octave: -1 },
            { type: "Literal", value: "s" },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "m" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "n" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Note", value: "s", octave: 1 },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "n" },
            { type: "Literal", value: "p" },
            { type: "Literal", value: "m" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "g" },
            { type: "Literal", value: "r" },
            { type: "Literal", value: "s" },
            { type: "Space", isSilent: false },
            { type: "Note", value: "n", octave: -1 },
          ],
        },
        {
          name: "ActivateRole",
          index: 5,
          params: [{ key: null, value: "sh" }],
        },
        {
          name: "AddAtoms",
          index: 6,
          atoms: [
            { type: "Literal", value: "Ni" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ve" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ga" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ti" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ya" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ni" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ni" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ra" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ta" },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "mu" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "Ni" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "pa" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "da" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "mu" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "le" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "nam" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "mi" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
            { type: "Literal", value: "ti" },
            { type: "Space", isSilent: false },
            { type: "Space", isSilent: false },
          ],
        },
      ],
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
      [
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
          name: "CreateRole",
          index: 1,
          params: [
            {
              key: null,
              value: "sh",
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
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Literal",
              value: "S",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Literal",
              value: "R",
            },
            {
              type: "Literal",
              value: "G",
            },
            {
              type: "Note",
              value: "M",
              octave: 1,
            },
            {
              type: "Rest",
              duration: "0/1",
            },
          ],
        },
        {
          name: "ActivateRole",
          index: 4,
          params: [
            {
              key: null,
              value: "sh",
            },
          ],
        },
        {
          name: "AddAtoms",
          index: 5,
          atoms: [
            {
              type: "Rest",
              duration: "0/1",
            },
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
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Literal",
              value: "d",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Literal",
              value: "e",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
            {
              type: "Rest",
              duration: "0/1",
            },
          ],
        },
      ],
    );
  });
});

describe("Marker Tests", () => {
  test("Test Marker Parsing", () => {
    testV4(`"Hello">> 'world'>>3/4 s r g m 2 p <<'world'<<"Hello"`, false, [
      {
        name: "AddAtoms",
        index: 0,
        atoms: [
          {
            type: "Literal",
            value: "s",
            duration: "3/4",
            mbef: [
              {
                type: "Marker",
                // duration: "0/1",
                text: "Hello",
                before: true,
              },
              {
                type: "Marker",
                // duration: "0/1",
                text: "world",
                before: true,
              },
            ],
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
            duration: "2/1",
            maft: [
              {
                type: "Marker",
                text: "world",
                before: false,
              },
              {
                type: "Marker",
                text: "Hello",
                before: false,
              },
            ],
          },
        ],
      },
    ]);
  });

  test("Marker with roles", () => {
    testV4(`Sw: "Hello">> A Sh: 'world'>> B <<"Hello"`, false, [
      {
        name: "ActivateRole",
        index: 0,
        params: [
          {
            key: null,
            value: "sw",
          },
        ],
      },
      {
        name: "AddAtoms",
        index: 1,
        atoms: [
          {
            type: "Literal",
            mbef: [
              {
                type: "Marker",
                text: "Hello",
                before: true,
              },
            ],
            value: "A",
          },
        ],
      },
      {
        name: "ActivateRole",
        index: 2,
        params: [
          {
            key: null,
            value: "sh",
          },
        ],
      },
      {
        name: "AddAtoms",
        index: 3,
        atoms: [
          {
            type: "Literal",
            mbef: [
              {
                type: "Marker",
                text: "world",
                before: true,
              },
            ],
            maft: [
              {
                type: "Marker",
                text: "Hello",
                before: false,
              },
            ],
            value: "B",
          },
        ],
      },
    ]);
  });

  test("Test Front Matter", () => {
    testV4(
      `
---
      a: 1
      b: 2
---

           s r g m p d n s.
    `,
      false,
      [
        {
          name: "AddAtoms",
          index: 0,
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
              type: "Literal",
              value: "d",
            },
            {
              type: "Literal",
              value: "n",
            },
            { type: "Note", value: "s", octave: 1 },
          ],
        },
      ],
      { a: 1, b: 2 },
    );
  });
});
