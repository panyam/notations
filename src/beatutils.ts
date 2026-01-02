import * as TSU from "@panyam/tsutils";
import { Space } from "./";
import { FlatAtom } from "./iterators";

/**
 * Ensures uniform spacing between atoms in a beat.
 * This utility function adjusts the spacing between atoms to create a consistent,
 * evenly spaced visualization based on the least common multiple (LCM) of their
 * duration denominators.
 *
 * @param currOffset Current time offset at which to start
 * @param atoms Array of flat atoms to process
 * @param slotsPerBeat Number of slots per beat, defaults to 1
 */
export function ensureUniformSpaces(currOffset: TSU.Num.Fraction, atoms: FlatAtom[], slotsPerBeat = 1): void {
  let lcm = 1;
  let gcd = 0;
  atoms.forEach((a, index) => {
    a.duration = a.duration.factorized;
    const currDen = a.duration.den;
    if (currDen != 1) {
      lcm *= currDen;
      if (gcd == 0) {
        gcd = a.duration.den;
      } else {
        gcd = TSU.Num.gcdof(gcd, currDen);
        lcm /= gcd;
      }
    }
  });

  // Easiest option is (without worrying about depths)
  // just adding this N number 1 / LCM sized spaces for
  // each note where N = (LCM / note.frac.den) - 1

  // eg in the case of something like (a beat with) the notes
  // A: 1/2, B: 1/4, C: 1/6
  // LCM (of dens) = 24
  // 12 (1/24) spaces, 6 (1/24)
  // A = (24 / 2) - 1 = 11 spaces after A
  // B = (24 / 4) - 1 = 5 spaces after B
  // C = (24 / 6) - 1 = 3 spaces after C
  // Total = 11 + 5 + 3 + 3 (for A + B + C) = 22 notes in the beat

  const baseDur = new TSU.Num.Fraction(1, lcm);
  for (let i = 0; i < atoms.length; ) {
    const fa = atoms[i];
    const numSpaces = lcm == 1 ? fa.duration.num - 1 : lcm / fa.duration.den - 1;
    // reset its duration to 1 / LCM so we can add numSpaces after it
    fa.duration = baseDur;
    currOffset = currOffset.plus(baseDur);
    i++;
    for (let j = 0; j < numSpaces; j++, i++) {
      const space = new Space(baseDur);
      space.isContinuation = true;
      atoms.splice(i, 0, new FlatAtom(space));
      atoms.splice(i, 0, new FlatAtom(space));
      currOffset = currOffset.plus(baseDur);
    }
  }
}
