import * as TSU from "@panyam/tsutils";
import { parseSyllable, parseBar, cycleStrToBarsStrs } from "../utils";
import { Atom, Syllable, Space, Note, Group } from "../../models/index";

const ONE = TSU.Num.Fraction.ONE;

describe("Utils Tests", () => {
  test("Bar Parsing Tests", () => {
    let cp = parseBar(",,,,");
    expect(cp.beatLengths.length).toBe(4);

    cp = parseBar(",, ,,");
    expect(cp.beatLengths.length).toBe(2);

    cp = parseBar("5,, ,,");
    expect(cp.beatLengths.length).toBe(2);
    expect(cp.beatLengths[0]).toEqual(TSU.Num.Frac(5));
    expect(cp.beatLengths[1]).toEqual(TSU.Num.Frac(2));

    cp = parseBar("1 2 3");
    expect(cp.beatLengths.length).toBe(3);
    expect(cp.beatLengths[0]).toEqual(TSU.Num.Frac(1));
    expect(cp.beatLengths[1]).toEqual(TSU.Num.Frac(2));
    expect(cp.beatLengths[2]).toEqual(TSU.Num.Frac(3));

    cp = parseBar(",, ,,, , _ __ ,,,,");
    expect(cp.beatLengths.length).toBe(4);
    expect(cp.beatLengths[0]).toEqual(TSU.Num.Frac(2));
    expect(cp.beatLengths[1]).toEqual(TSU.Num.Frac(3));
    expect(cp.beatLengths[2]).toEqual(TSU.Num.Frac(1));
    expect(cp.beatLengths[3]).toEqual(TSU.Num.Frac(4));
  });

  test("Bar Parsing Tests", () => {
    let cp = parseBar(",,,,");
    expect(cp.beatLengths.length).toBe(4);

    cp = parseBar(",, ,,");
    expect(cp.beatLengths.length).toBe(2);

    cp = parseBar(",, ,,, , _ __ ,,,,");
    expect(cp.beatLengths.length).toBe(4);
    expect(cp.beatLengths[0]).toEqual(TSU.Num.Frac(2));
    expect(cp.beatLengths[1]).toEqual(TSU.Num.Frac(3));
    expect(cp.beatLengths[2]).toEqual(TSU.Num.Frac(1));
    expect(cp.beatLengths[3]).toEqual(TSU.Num.Frac(4));
  });

  test("Cycle Parsing Tests", () => {
    let ps = cycleStrToBarsStrs(",,,,");
    expect(ps).toEqual([",,,,"]);

    ps = cycleStrToBarsStrs("|||,,,,|");
    expect(ps).toEqual([",,,,"]);

    ps = cycleStrToBarsStrs("|,,    ,,|   |,,,,|");
    expect(ps).toEqual([",,    ,,", ",,,,"]);

    ps = cycleStrToBarsStrs("|,, ,,  ,,,,");
    expect(ps).toEqual([",, ,,  ,,,,"]);
  });

  test("Syllable Parsing Tests", () => {
    let atom = parseSyllable("SNDP") as Atom;
    expect(atom.equals(new Syllable("SNDP"))).toBe(true);

    atom = parseSyllable("S_N_D,P");
    expect(
      atom.equals(
        new Group(
          ONE,
          new Syllable("S"),
          new Space(ONE, true),
          new Syllable("N"),
          new Space(ONE, true),
          new Syllable("D"),
          new Space(ONE, false),
          new Syllable("P"),
        ),
      ),
    ).toBe(true);
  });
});
