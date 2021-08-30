import * as TSU from "@panyam/tsutils";
import { Cycle, Bar, Atom, Space, Group, Syllable } from "./core";
const ONE = TSU.Num.Fraction.ONE;

/**
 * Convert a cycle given as a string into the bars representing
 * each of its cycle bars.
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
      if (/^,+$/.test(bars[i])) {
        cp.beatLengths.push(TSU.Num.Frac(bars[i].length));
      } else {
        const num = parseInt(bars[i]);
        if (num) cp.beatLengths.push(TSU.Num.Frac(num));
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
