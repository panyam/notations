import * as TSU from "@panyam/tsutils";
import { Cycle, Line, LeafAtom, Role, Space, Syllable, Group, Note, Bar } from "../";
import { BeatLayout, LayoutParams, BeatsBuilder, Beat, BeatView, BeatColumn } from "../layouts";
import { FlatAtom } from "../iterators";
import "../../../common/jest/matchers";
import { getCircularReplacer } from "../../../common/utils";

const Frac = TSU.Num.Frac;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);
const HALF = ONE.divbyNum(2);

const TEST_CYCLE1 = new Cycle({
  bars: [
    new Bar({
      beatLengths: [1],
    }),
    new Bar({
      beatLengths: [2, 2],
    }),
    new Bar({
      beatLengths: [3, 3, 3],
    }),
  ],
});

const TEST_CYCLE2 = new Cycle({
  bars: [
    new Bar({
      beatLengths: [1, 1, 1, 1],
    }),
  ],
});

function getBeatColumns(bl: BeatLayout): any {
  const out = {} as any;
  for (const bcol of bl.beatColumns.values()) {
    const key = bcol.offset.toString() + ":" + bcol.duration.toString();
    out[key] = {
      offset: bcol.offset.toString(),
      duration: bcol.duration.toString(),
      beats: bcol.beats.map((b: Beat) => b.debugValue()),
    };
  }
  return out;
}

function testLayouts(
  notes: string | string[],
  layoutParams: LayoutParams,
  lineOffset: TSU.Num.Fraction,
  debug: boolean,
  expected: any,
) {
  if (typeof notes === "string") notes = [...notes];
  const atoms = notes.map((a: string) => new Note(a));
  const beatLayout = new BeatLayout(layoutParams);
  const line = new Line().addAtoms("test", false, ...atoms);
  const role = line.ensureRole("test", false);
  const bb = new BeatsBuilder(role, layoutParams, lineOffset.divbyNum(layoutParams.aksharasPerBeat));
  bb.addAtoms(...role.atoms);
  for (const beat of bb.beats) {
    beat.ensureUniformSpaces(layoutParams.aksharasPerBeat);
    beatLayout.addBeat(beat);
  }

  const found = getBeatColumns(beatLayout);
  if (debug || expected == null) {
    console.log("Found BeatColumns: \n", JSON.stringify(found, getCircularReplacer(), 2));
    console.log("Expected BeatColumns: \n", JSON.stringify(expected, getCircularReplacer(), 2));
  }
  expect(found).toEqual(expected);
}

describe("Complex BeatLayout Tests", () => {
  test("Adding normally", () => {
    testLayouts(
      "abcdefghijklmnopqrstuvwxyz",
      new LayoutParams({
        cycle: TEST_CYCLE1,
        aksharasPerBeat: 4,
      }),
      ZERO,
      false,
      {
        "0/1:4/1": {
          offset: "0/1",
          duration: "4/1",
          beats: [
            {
              index: 0,
              role: "test",
              offset: "0/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 0,
              instance: 0,
              atoms: [
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "a",
                  },
                  duration: "1/1",
                  offset: "0/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "b",
                  },
                  duration: "1/1",
                  offset: "1/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "c",
                  },
                  duration: "1/1",
                  offset: "2/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "d",
                  },
                  duration: "1/1",
                  offset: "3/1",
                  depth: 0,
                },
              ],
            },
          ],
        },
        "4/1:8/1": {
          offset: "4/1",
          duration: "8/1",
          beats: [
            {
              index: 1,
              role: "test",
              offset: "4/1",
              duration: "8/1",
              barIndex: 1,
              beatIndex: 0,
              instance: 0,
              atoms: [
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "e",
                  },
                  duration: "1/1",
                  offset: "4/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "f",
                  },
                  duration: "1/1",
                  offset: "5/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "g",
                  },
                  duration: "1/1",
                  offset: "6/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "h",
                  },
                  duration: "1/1",
                  offset: "7/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "i",
                  },
                  duration: "1/1",
                  offset: "8/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "j",
                  },
                  duration: "1/1",
                  offset: "9/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "k",
                  },
                  duration: "1/1",
                  offset: "10/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "l",
                  },
                  duration: "1/1",
                  offset: "11/1",
                  depth: 0,
                },
              ],
            },
          ],
        },
        "12/1:8/1": {
          offset: "12/1",
          duration: "8/1",
          beats: [
            {
              index: 2,
              role: "test",
              offset: "12/1",
              duration: "8/1",
              barIndex: 1,
              beatIndex: 1,
              instance: 0,
              atoms: [
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "m",
                  },
                  duration: "1/1",
                  offset: "12/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "n",
                  },
                  duration: "1/1",
                  offset: "13/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "o",
                  },
                  duration: "1/1",
                  offset: "14/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "p",
                  },
                  duration: "1/1",
                  offset: "15/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "q",
                  },
                  duration: "1/1",
                  offset: "16/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "r",
                  },
                  duration: "1/1",
                  offset: "17/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "s",
                  },
                  duration: "1/1",
                  offset: "18/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "t",
                  },
                  duration: "1/1",
                  offset: "19/1",
                  depth: 0,
                },
              ],
            },
          ],
        },
        "20/1:12/1": {
          offset: "20/1",
          duration: "12/1",
          beats: [
            {
              index: 3,
              role: "test",
              offset: "20/1",
              duration: "12/1",
              barIndex: 2,
              beatIndex: 0,
              instance: 0,
              atoms: [
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "u",
                  },
                  duration: "1/1",
                  offset: "20/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "v",
                  },
                  duration: "1/1",
                  offset: "21/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "w",
                  },
                  duration: "1/1",
                  offset: "22/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "x",
                  },
                  duration: "1/1",
                  offset: "23/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "y",
                  },
                  duration: "1/1",
                  offset: "24/1",
                  depth: 0,
                },
                {
                  type: "FlatAtom",
                  atom: {
                    type: "Note",
                    value: "z",
                  },
                  duration: "1/1",
                  offset: "25/1",
                  depth: 0,
                },
              ],
            },
          ],
        },
      },
    );
  });

  test("Testing negative line offsets", () => {
    testLayouts(
      "abcdefghijklmnopqrstuvwxyz",
      new LayoutParams({
        cycle: TEST_CYCLE2,
        aksharasPerBeat: 4,
      }),
      Frac(-2),
      true,
      null,
    );
  });
});
