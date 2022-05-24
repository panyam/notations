import * as TSU from "@panyam/tsutils";
import { Cycle, Bar } from "../cycle";
import { Line, Group, Note } from "../core";
import { LayoutParams } from "../layouts";
import { BeatsBuilder, Beat } from "../beats";
import { ensureUniformSpaces } from "../beatutils";

const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);
const HALF = ONE.divbyNum(2);

describe("Beat Tests", () => {
  test("Create Beats", () => {
    const l = new Line();
    const role = l.ensureRole("test", true);
    const b = new Beat(0, role, FIVE, TEN, 1, 1, 1, null, null);
    expect(b.endOffset).toEqual(FIVE.plus(TEN));
    expect(b.filled).toEqual(false);
    expect(b.remaining).toEqual(TEN);
    expect(b.add(new Note("1", ONE))).toEqual(true);
    expect(b.remaining).toEqual(TEN.minus(ONE));
    expect(b.filled).toEqual(false);
  });
});

describe("BeatsBuilder", () => {
  test("Create beats from BeatsBuilder", () => {
    const l = new Line();
    const g1 = new Group(new Note("1", ONE), new Note("2", TWO), new Note("3", THREE));
    g1.durationIsMultiplier = true;
    const atoms = [new Note("a", ONE), new Note("b", TWO), new Note("c", THREE), new Note("d", FIVE), g1];
    l.addAtoms("test", true, ...atoms);
    const c = Cycle.DEFAULT;
    const lp = new LayoutParams({ cycle: c, beatDuration: 2 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
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
        index: 1,
        role: "test",
        offset: "2/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              isContinuation: true,
              type: "Space",
              isSilent: false,
            },
            {
              type: "Note",
              value: "c",
            },
          ],
        },
      },
      {
        index: 2,
        role: "test",
        offset: "4/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 0,
        atom: {
          type: "Space",
          isContinuation: true,
          duration: "2/1",
          isSilent: false,
        },
      },
      {
        index: 3,
        role: "test",
        offset: "6/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 3,
        instance: 0,
        atom: {
          duration: "2/1",
          type: "Note",
          value: "d",
        },
      },
      {
        index: 4,
        role: "test",
        offset: "8/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Space",
          duration: "2/1",
          isContinuation: true,
          isSilent: false,
        },
      },
      {
        index: 5,
        role: "test",
        offset: "10/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Space",
              isContinuation: true,
              isSilent: false,
            },
            {
              type: "Group",
              durationIsMultiplier: true,
              atoms: [
                {
                  type: "Note",
                  value: "1",
                },
              ],
            },
          ],
        },
      },
      {
        index: 6,
        role: "test",
        offset: "12/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              duration: "2/1",
              value: "2",
            },
          ],
        },
      },
      {
        index: 7,
        role: "test",
        offset: "14/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              duration: "2/1",
              value: "3",
            },
          ],
        },
      },
      {
        index: 8,
        role: "test",
        offset: "16/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          atoms: [
            {
              isContinuation: true,
              type: "Space",
              isSilent: false,
            },
          ],
        },
      },
    ]);
  });

  test("Create beats from groups", () => {
    const l = new Line();
    const g1 = new Group(new Note("Pa", ONE), new Note("Ma", ONE)).setDuration(TWO, true);
    const atoms = [new Note("P", ONE), g1];
    l.addAtoms("test", true, ...atoms);
    const c = Cycle.DEFAULT;
    const lp = new LayoutParams({ cycle: c, beatDuration: 2 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          duration: "2/1",
          atoms: [
            {
              type: "Note",
              value: "P",
            },
            {
              type: "Group",
              durationIsMultiplier: true,
              atoms: [
                {
                  type: "Note",
                  value: "Pa",
                },
                {
                  type: "Note",
                  value: "Ma",
                },
              ],
            },
          ],
        },
      },
    ]);
  });

  test.skip("Test uniform spacing", () => {
    const l = new Line();
    const g1 = new Group(new Note("Pa", ONE), new Note("Ma", ONE)).setDuration(TWO, true);
    const atoms = [new Note("P", ONE), g1];
    l.addAtoms("test", true, ...atoms);
    const c = Cycle.DEFAULT;
    const lp = new LayoutParams({ cycle: c, beatDuration: 2 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.onBeatFilled = (beat: Beat) => {
      ensureUniformSpaces(beat.offset, [], lp.beatDuration);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          duration: "3/1",
          atoms: [
            {
              type: "Note",
              value: "P",
            },
            {
              type: "Space",
              isSilent: false,
              isContinuation: true,
            },
            {
              type: "Note",
              value: "Pa",
            },
            {
              type: "Note",
              value: "Ma",
            },
          ],
        },
      },
    ]);
  });

  test.skip("Test uniform spacing with all half beats", () => {
    const l = new Line();
    const atoms = [new Note("P", HALF), new Note("M", HALF), new Note("G", HALF), new Note("R", HALF)];
    l.addAtoms("test", true, ...atoms);
    const c = Cycle.DEFAULT;
    const lp = new LayoutParams({ cycle: c, beatDuration: 2 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.onBeatFilled = (beat: Beat) => {
      ensureUniformSpaces(beat.offset, [], lp.beatDuration);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              duration: "1/2",
              value: "P",
            },
            {
              type: "Note",
              duration: "1/2",
              value: "M",
            },
            {
              type: "Note",
              duration: "1/2",
              value: "G",
            },
            {
              type: "Note",
              duration: "1/2",
              value: "R",
            },
          ],
        },
      },
    ]);
  });

  test.skip("Test uniform spacing with whole bun uneven size beats", () => {
    const l = new Line();
    const atoms = [new Note("S", ONE), new Note("R", TWO), new Note("G", THREE)];
    l.addAtoms("test", true, ...atoms);
    const c = Cycle.DEFAULT;
    const lp = new LayoutParams({ cycle: c, beatDuration: 6 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.onBeatFilled = (beat: Beat) => {
      ensureUniformSpaces(beat.offset, [], lp.beatDuration);
    };
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "6/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              value: "S",
            },
            {
              type: "Note",
              duration: "2/1",
              value: "R",
            },
            {
              type: "Space",
              isSilent: false,
              isContinuation: true,
            },
            {
              type: "Note",
              duration: "3/1",
              value: "G",
            },
            {
              type: "Space",
              isSilent: false,
              isContinuation: true,
            },
            {
              type: "Space",
              isSilent: false,
              isContinuation: true,
            },
          ],
        },
      },
    ]);
  });

  test("Create beats from BeatsBuilder with kalai > 1", () => {
    const l = new Line();
    const atoms = [];
    for (const x of "abcdefghijklmnopqrstuvwxyz") {
      atoms.push(new Note(x));
    }
    l.addAtoms("test", true, ...atoms);
    const c = new Cycle({
      bars: [
        new Bar({
          beatLengths: [1, 2, 3],
          beatCounts: [1, 2, 3],
        }),
        new Bar({
          beatLengths: [2, 1],
          beatCounts: [2, 1],
        }),
      ],
    });
    const lp = new LayoutParams({ cycle: c, beatDuration: 1 });
    const bb = new BeatsBuilder(l.ensureRole("test", true), lp);
    bb.addAtoms(...atoms);
    const beats = bb.beats.map((b) => b.debugValue());
    // console.log("Beats: ", JSON.stringify(beats, getCircularReplacer(), 2));
    expect(beats).toEqual([
      // Bar 0, Beat 0
      {
        index: 0,
        role: "test",
        offset: "0/1",
        duration: "1/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Note",
          value: "a",
        },
      },
      // Bar 0, Beat 1
      {
        index: 1,
        role: "test",
        offset: "1/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              value: "b",
            },
            {
              type: "Note",
              value: "c",
            },
          ],
        },
      },
      {
        index: 2,
        role: "test",
        offset: "3/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 1,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
            {
              type: "Note",
              value: "d",
            },
            {
              type: "Note",
              value: "e",
            },
          ],
        },
      },
      // Bar 0, Beat 2
      {
        index: 3,
        role: "test",
        offset: "5/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 0,
        atom: {
          type: "Group",
          duration: "3/1",
          durationIsMultiplier: true,
          atoms: [
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
          ],
        },
      },
      {
        index: 4,
        role: "test",
        offset: "8/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 1,
        atom: {
          type: "Group",
          duration: "3/1",
          durationIsMultiplier: true,
          atoms: [
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
          ],
        },
      },
      {
        index: 5,
        role: "test",
        offset: "11/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 2,
        atom: {
          type: "Group",
          durationIsMultiplier: true,
          duration: "3/1",
          atoms: [
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
      // Bar 1, Beat 0
      {
        index: 6,
        role: "test",
        offset: "14/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
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
          ],
        },
      },
      {
        index: 7,
        role: "test",
        offset: "16/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        instance: 1,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
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
      // Bar 1, Beat 1
      {
        index: 8,
        role: "test",
        offset: "18/1",
        duration: "1/1",
        barIndex: 1,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Note",
          value: "s",
        },
      },
      // Go back to Bar 0, Beat 0
      {
        index: 9,
        role: "test",
        offset: "19/1",
        duration: "1/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atom: {
          type: "Note",
          value: "t",
        },
      },
      // Go back to Bar 0, Beat 1
      {
        index: 10,
        role: "test",
        offset: "20/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
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
          ],
        },
      },
      {
        index: 11,
        role: "test",
        offset: "22/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 1,
        atom: {
          type: "Group",
          duration: "2/1",
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
          ],
        },
      },
      // Go back to Bar 0, Beat 2
      {
        index: 12,
        role: "test",
        offset: "24/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 0,
        atom: {
          type: "Group",
          duration: "2/1",
          durationIsMultiplier: true,
          atoms: [
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
    ]);
  });
});

describe("Simple BeatLayout Tests", () => {
  test("Create Beats", () => {
    const l = new Line();
    const role = l.ensureRole("test", true);
    const b = new Beat(0, role, FIVE, TEN, 1, 1, 1, null, null);
    expect(b.endOffset).toEqual(FIVE.plus(TEN));
    expect(b.filled).toEqual(false);
    expect(b.remaining).toEqual(TEN);
    expect(b.add(new Note("1", ONE))).toEqual(true);
    expect(b.remaining).toEqual(TEN.minus(ONE));
    expect(b.filled).toEqual(false);
  });
});
