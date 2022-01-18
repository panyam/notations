import * as TSU from "@panyam/tsutils";
import { Cycle, Bar } from "../cycle";
import { Line, Group, Note } from "../core";
import { LayoutParams } from "../layouts";
import { BeatsBuilder, Beat } from "../beats";
import { FlatAtom } from "../iterators";

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
              duration: "2/1",
              value: "b",
            },
            duration: "1/1",
            offset: "1/1",
            depth: 0,
          },
        ],
      },
      {
        index: 1,
        role: "test",
        offset: "2/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "3/1",
              value: "c",
            },
            duration: "1/1",
            offset: "3/1",
            depth: 0,
          },
        ],
      },
      {
        index: 2,
        role: "test",
        offset: "4/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              duration: "2/1",
              isSilent: false,
            },
            duration: "2/1",
            offset: "0/1",
            depth: 0,
          },
        ],
      },
      {
        index: 3,
        role: "test",
        offset: "6/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 3,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "5/1",
              value: "d",
            },
            duration: "2/1",
            offset: "6/1",
            depth: 0,
          },
        ],
      },
      {
        index: 4,
        role: "test",
        offset: "8/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              duration: "3/1",
              isSilent: false,
            },
            duration: "2/1",
            offset: "0/1",
            depth: 0,
          },
        ],
      },
      {
        index: 5,
        role: "test",
        offset: "10/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 1,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "1",
            },
            duration: "1/1",
            offset: "11/1",
            depth: 1,
          },
        ],
      },
      {
        index: 6,
        role: "test",
        offset: "12/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 0,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "2/1",
              value: "2",
            },
            duration: "2/1",
            offset: "12/1",
            depth: 1,
          },
        ],
      },
      {
        index: 7,
        role: "test",
        offset: "14/1",
        duration: "2/1",
        barIndex: 2,
        beatIndex: 1,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "3/1",
              value: "3",
            },
            duration: "2/1",
            offset: "14/1",
            depth: 1,
          },
        ],
      },
      {
        index: 8,
        role: "test",
        offset: "16/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 0,
        instance: 0,
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
        ],
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
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "P",
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "Pa",
            },
            duration: "1/2",
            offset: "1/1",
            depth: 1,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "Ma",
            },
            duration: "1/2",
            offset: "3/2",
            depth: 1,
          },
        ],
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
      beat.ensureUniformSpaces([], lp.beatDuration);
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
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "P",
            },
            duration: "1/2",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/2",
            offset: "1/2",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "Pa",
            },
            duration: "1/2",
            offset: "1/1",
            depth: 1,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "Ma",
            },
            duration: "1/2",
            offset: "3/2",
            depth: 1,
          },
        ],
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
      beat.ensureUniformSpaces([], lp.beatDuration);
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
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "1/2",
              value: "P",
            },
            duration: "1/2",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "1/2",
              value: "M",
            },
            duration: "1/2",
            offset: "1/2",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "1/2",
              value: "G",
            },
            duration: "1/2",
            offset: "1/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "1/2",
              value: "R",
            },
            duration: "1/2",
            offset: "3/2",
            depth: 0,
          },
        ],
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
      beat.ensureUniformSpaces([], lp.beatDuration);
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
        atoms: [
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              value: "S",
            },
            duration: "1/1",
            offset: "0/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "2/1",
              value: "R",
            },
            duration: "1/1",
            offset: "1/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "2/1",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Note",
              duration: "3/1",
              value: "G",
            },
            duration: "1/1",
            offset: "3/1",
            depth: 0,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "4/1",
            depth: 0,
            isContinuation: true,
          },
          {
            type: "FlatAtom",
            atom: {
              type: "Space",
              isSilent: false,
            },
            duration: "1/1",
            offset: "5/1",
            depth: 0,
            isContinuation: true,
          },
        ],
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
        ],
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
        atoms: [
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
        ],
      },
      {
        index: 2,
        role: "test",
        offset: "3/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 1,
        atoms: [
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
        ],
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
        atoms: [
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
        ],
      },
      {
        index: 4,
        role: "test",
        offset: "8/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 1,
        atoms: [
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
        ],
      },
      {
        index: 5,
        role: "test",
        offset: "11/1",
        duration: "3/1",
        barIndex: 0,
        beatIndex: 2,
        instance: 2,
        atoms: [
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
        ],
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
        atoms: [
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
        ],
      },
      {
        index: 7,
        role: "test",
        offset: "16/1",
        duration: "2/1",
        barIndex: 1,
        beatIndex: 0,
        instance: 1,
        atoms: [
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
        ],
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
        atoms: [
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
        ],
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
        atoms: [
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
      // Go back to Bar 0, Beat 1
      {
        index: 10,
        role: "test",
        offset: "20/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
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
        ],
      },
      {
        index: 11,
        role: "test",
        offset: "22/1",
        duration: "2/1",
        barIndex: 0,
        beatIndex: 1,
        instance: 1,
        atoms: [
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
        ],
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
        atoms: [
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
