/**
 * @jest-environment jsdom
 */
import * as TSU from "@panyam/tsutils";
import { Parser } from "../../parser";

function testV4(input: string, debug = false, expected: any = null): void {
  const parser = new Parser();
  const root = parser.parse(input);
  const cmds = parser.commands.map((c: any) => c.debugValue());
  if (debug || expected == null) {
    console.log("Result Parse Tree: \n", JSON.stringify(root.debugValue(), TSU.Misc.getCircularReplacer(), 2));
    console.log("Result Snippet: \n", JSON.stringify(cmds, TSU.Misc.getCircularReplacer(), 2));
  }
  expect(cmds).toEqual(expected);
}

describe("Parser Tests", () => {
  test("Test Embelishments - Only PRE Embelishments get added to atoms proceeding it.", () => {
    testV4(
      String.raw`
           ~^ ~W S ~ ~x ~w R ~~ ~∵ ~-: G ~x ~w ~∴ ~:- M ~\ ~/
           P ~✓ ~./ ~.\  D ~γ ~Y N ^ 3 ~n/ S. ^ -3 ~r.\ S. ^ *
    `,
      false,
      [
        {
          name: "AddAtoms",
          index: 0,
          atoms: [
            {
              type: "Literal",
              value: "S",
              embs: [
                {
                  type: "Raavi",
                },
                {
                  type: "Nokku",
                },
              ],
            },
            {
              type: "Literal",
              value: "R",
              embs: [
                {
                  type: "Kampitham",
                },
                {
                  type: "Odukkal",
                },
                {
                  type: "Nokku",
                },
              ],
            },
            {
              type: "Literal",
              value: "G",
              embs: [
                {
                  type: "Vaali",
                },
                {
                  type: "Prathyagatham",
                },
                {
                  type: "Prathyagatham",
                },
              ],
            },
            {
              type: "Literal",
              value: "M",
              embs: [
                {
                  type: "Odukkal",
                },
                {
                  type: "Nokku",
                },
                {
                  type: "Spuritham",
                },
                {
                  type: "Spuritham",
                },
              ],
            },
            {
              type: "Literal",
              value: "P",
              embs: [
                {
                  type: "IrakkaJaaru",
                  ascending: false,
                },
                {
                  type: "EetraJaaru",
                  ascending: true,
                },
              ],
            },
            {
              type: "Literal",
              value: "D",
              embs: [
                {
                  type: "Kandippu",
                },
                {
                  type: "Kandippu",
                },
                {
                  type: "Kandippu",
                },
              ],
            },
            {
              shift: 3,
              type: "Note",
              value: "N",
              embs: [
                {
                  type: "Orikkai",
                },
                {
                  type: "Orikkai",
                },
              ],
            },
            {
              embs: [
                {
                  ascending: true,
                  startingNote: {
                    type: "Note",
                    value: "n",
                  },
                  type: "EetraJaaru",
                },
              ],
              octave: 1,
              type: "Note",
              value: "S",
              shift: -3,
            },
            {
              embs: [
                {
                  ascending: false,
                  startingNote: {
                    type: "Note",
                    value: "r.",
                  },
                  type: "IrakkaJaaru",
                },
              ],
              octave: 1,
              type: "Note",
              shift: true,
              value: "S",
            },
          ],
        },
      ],
    );
  });

  test("POST Embelishments - Should throw error for now.", () => {
    expect(() => testV4(String.raw` ~^ ~W S ~ `)).toThrowError();
  });
});
