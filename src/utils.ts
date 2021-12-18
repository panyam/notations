import * as TSU from "@panyam/tsutils";
import { Atom, Space, Group, Syllable } from "./core";
import { Cycle, Bar } from "./cycle";
const ONE = TSU.Num.Fraction.ONE;

/**
 * Convert a cycle given as a string into the bars representing
 * each of its cycle bars.
 *
 * Essentially a list of bars can be specified by the "|" delimited string:
 *
 * <bar1>|<bar2>|<bar3>....|<barN>
 *
 * Empty bars are ignored.
 */
export function cycleStrToBarsStrs(cycleStr: string): string[] {
  return cycleStr
    .replace(/\|+/g, "|")
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Parse a tala pattern string.
 */
export function parseCycle(cycleStr: string): Cycle {
  return new Cycle({
    bars: cycleStrToBarsStrs(cycleStr).map(parseBar),
  });
}

/**
 * Parse a cycle part string into beat lengths.
 *
 * A bar string is a space delimited string in the following format:
 *
 *  "<beat1> <spaces> <beat2> .... <beatN>"
 *
 * beatX substring cannot contain "|" or spaces.
 *
 * Each Beat string is in the following format:
 *
 * "<length>(:<count>)?"  or "<length>?:<count>"
 *
 * Both length and count are optional but atleast one of them must be specified.
 * When not specified the other defaults to 1.
 * Lenght can also be a fraction of the form <num>"/"<den> (without spaces).
 */
export function parseBar(barStr: string): Bar {
  const bars = barStr.replace(/\s+/g, " ").split(" ");
  const cp = new Bar();
  if (bars.length == 1) {
    for (let i = 0; i < barStr.length; i++) {
      let count = 0;
      const ch = barStr[i];
      if (ch == ",") {
        count = 1;
      } else {
        const num = parseInt(ch);
        if (num) {
          count = num;
        }
      }
      while (count > 0) {
        cp.beatLengths.push(ONE);
        count--;
      }
    }
  } else {
    for (let i = 0; i < bars.length; i++) {
      const comps = bars[i].split(":");
      const length = comps[0];
      const count = comps[1] || "";
      if (length.length == 0) {
        cp.beatLengths.push(TSU.Num.Frac(1));
      } else if (/^,+$/.test(length)) {
        cp.beatLengths.push(TSU.Num.Frac(length.length));
      } else {
        // parse length as a number or as a fraction
        cp.beatLengths.push(TSU.Num.Fraction.parse(length));
      }

      // Now the count
      const beatCount = parseInt(count);
      if (isNaN(beatCount)) {
        cp.beatCounts.push(1);
      } else {
        cp.beatCounts.push(beatCount);
      }
    }
  }
  return cp;
}

export function parseSyllable(value: string): Atom {
  const notes = [] as Atom[];
  // Only "_" make a difference here
  for (let i = 0; i < value.length; ) {
    let ch = value[i];
    if (ch == "_") {
      notes.push(new Space(ONE, true));
      i++;
    } else if (ch == ",") {
      notes.push(new Space(ONE, false));
      i++;
    } else {
      let syll = "";
      while (i < value.length && ch != "," && ch != "_") {
        syll += ch;
        i++;
        ch = value[i];
      }
      notes.push(new Syllable(syll));
    }
  }
  if (notes.length == 1) return notes[0];
  return new Group(ONE, ...notes);
}

export function parseProperty(line: string): [string, string] {
  const bars = line.split("=").map((x) => x.trim());
  if (bars.length < 2) {
    throw new Error("Properties must be of type <key> = <value>");
  }
  const key = bars[0];
  const value = bars[1];
  return [key, value];
}
