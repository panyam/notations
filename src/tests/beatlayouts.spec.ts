import * as TSU from "@panyam/tsutils";
import { Cycle, Line, Note, Bar } from "../";
import { BeatsBuilder, Beat } from "../beats";
import { BeatLayout } from "../beats";
import { LayoutParams } from "../layouts";

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
  const bb = new BeatsBuilder(role, layoutParams, lineOffset.divbyNum(layoutParams.beatDuration));
  bb.addAtoms(...role.atoms);
  for (const beat of bb.beats) {
    beat.ensureUniformSpaces([], layoutParams.beatDuration);
    beatLayout.addBeat(beat);
  }

  const found = getBeatColumns(beatLayout);
  if (debug || expected == null) {
    console.log("Found BeatColumns: \n", JSON.stringify(found, TSU.Misc.getCircularReplacer(), 2));
    console.log("Expected BeatColumns: \n", JSON.stringify(expected, TSU.Misc.getCircularReplacer(), 2));
  }
  expect(found).toEqual(expected);
}

describe("Complex BeatLayout Tests", () => {
  test("Adding normally", () => {
    testLayouts(
      "abcdefghijklmnopqrstuvwxyz",
      new LayoutParams({
        cycle: TEST_CYCLE1,
        beatDuration: 4,
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
              atom: {
                duration: "4/1",
                durationIsMultiplier: true,
                type: "Group",
                atoms: [
                  {
                    type: "Note",
                    value: "a",
                  },
                  {
                    type: "Note",
                    value: "b",
                  },
                  {
                    type: "Note",
                    value: "c",
                  },
                  {
                    type: "Note",
                    value: "d",
                  },
                ],
              },
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
              atom: {
                duration: "8/1",
                durationIsMultiplier: true,
                type: "Group",
                atoms: [
                  {
                    type: "Note",
                    value: "e",
                  },
                  {
                    type: "Note",
                    value: "f",
                  },
                  {
                    type: "Note",
                    value: "g",
                  },
                  {
                    type: "Note",
                    value: "h",
                  },
                  {
                    type: "Note",
                    value: "i",
                  },
                  {
                    type: "Note",
                    value: "j",
                  },
                  {
                    type: "Note",
                    value: "k",
                  },
                  {
                    type: "Note",
                    value: "l",
                  },
                ],
              },
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
              atom: {
                type: "Group",
                duration: "8/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "m",
                  },
                  {
                    type: "Note",
                    value: "n",
                  },
                  {
                    type: "Note",
                    value: "o",
                  },
                  {
                    type: "Note",
                    value: "p",
                  },
                  {
                    type: "Note",
                    value: "q",
                  },
                  {
                    type: "Note",
                    value: "r",
                  },
                  {
                    type: "Note",
                    value: "s",
                  },
                  {
                    type: "Note",
                    value: "t",
                  },
                ],
              },
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
              atom: {
                type: "Group",
                duration: "6/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "u",
                  },
                  {
                    type: "Note",
                    value: "v",
                  },
                  {
                    type: "Note",
                    value: "w",
                  },
                  {
                    type: "Note",
                    value: "x",
                  },
                  {
                    type: "Note",
                    value: "y",
                  },
                  {
                    type: "Note",
                    value: "z",
                  },
                ],
              },
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
        beatDuration: 4,
      }),
      Frac(-2),
      false,
      {
        "12/1:4/1": {
          offset: "12/1",
          duration: "4/1",
          beats: [
            {
              index: 3,
              role: "test",
              offset: "-4/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 3,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Space",
                    duration: "2/1",
                    isSilent: false,
                  },
                  {
                    type: "Note",
                    value: "a",
                  },
                  {
                    type: "Note",
                    value: "b",
                  },
                ],
              },
            },
            {
              index: 7,
              role: "test",
              offset: "12/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 3,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "o",
                  },
                  {
                    type: "Note",
                    value: "p",
                  },
                  {
                    type: "Note",
                    value: "q",
                  },
                  {
                    type: "Note",
                    value: "r",
                  },
                ],
              },
            },
          ],
        },
        "0/1:4/1": {
          offset: "0/1",
          duration: "4/1",
          beats: [
            {
              index: 4,
              role: "test",
              offset: "0/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 0,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "c",
                  },
                  {
                    type: "Note",
                    value: "d",
                  },
                  {
                    type: "Note",
                    value: "e",
                  },
                  {
                    type: "Note",
                    value: "f",
                  },
                ],
              },
            },
            {
              index: 8,
              role: "test",
              offset: "16/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 0,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "s",
                  },
                  {
                    type: "Note",
                    value: "t",
                  },
                  {
                    type: "Note",
                    value: "u",
                  },
                  {
                    type: "Note",
                    value: "v",
                  },
                ],
              },
            },
          ],
        },
        "4/1:4/1": {
          offset: "4/1",
          duration: "4/1",
          beats: [
            {
              index: 5,
              role: "test",
              offset: "4/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 1,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "g",
                  },
                  {
                    type: "Note",
                    value: "h",
                  },
                  {
                    type: "Note",
                    value: "i",
                  },
                  {
                    type: "Note",
                    value: "j",
                  },
                ],
              },
            },
            {
              index: 9,
              role: "test",
              offset: "20/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 1,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "w",
                  },
                  {
                    type: "Note",
                    value: "x",
                  },
                  {
                    type: "Note",
                    value: "y",
                  },
                  {
                    type: "Note",
                    value: "z",
                  },
                ],
              },
            },
          ],
        },
        "8/1:4/1": {
          offset: "8/1",
          duration: "4/1",
          beats: [
            {
              index: 6,
              role: "test",
              offset: "8/1",
              duration: "4/1",
              barIndex: 0,
              beatIndex: 2,
              instance: 0,
              atom: {
                type: "Group",
                duration: "4/1",
                durationIsMultiplier: true,
                atoms: [
                  {
                    type: "Note",
                    value: "k",
                  },
                  {
                    type: "Note",
                    value: "l",
                  },
                  {
                    type: "Note",
                    value: "m",
                  },
                  {
                    type: "Note",
                    value: "n",
                  },
                ],
              },
            },
          ],
        },
      },
    );
  });
});
