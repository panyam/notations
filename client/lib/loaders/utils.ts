import * as TSU from "@panyam/tsutils";
import { Cycle, CyclePart, Atom, Space, Group, Syllable } from "../models/index";
const ONE = TSU.Num.Fraction.ONE;

/**
 * Convert a cycle given as a string into the parts representing
 * each of its cycle parts.
 */
export function cycleStrToPartsStrs(cycleStr: string): string[] {
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
    parts: cycleStrToPartsStrs(cycleStr).map(parseCyclePart),
  });
}

/**
 * Parse a cycle part string into beat lengths.
 */
export function parseCyclePart(partStr: string): CyclePart {
  const parts = partStr.replace(/\s+/g, " ").split(" ");
  const cp = new CyclePart();
  if (parts.length == 1) {
    for (let i = 0; i < partStr.length; i++) {
      let count = 0;
      const ch = partStr[i];
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
    for (let i = 0; i < parts.length; i++) {
      if (/^,+$/.test(parts[i])) {
        cp.beatLengths.push(TSU.Num.Frac(parts[i].length));
      } else {
        const num = parseInt(parts[i]);
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
  const parts = line.split("=").map((x) => x.trim());
  if (parts.length < 2) {
    throw new Error("Properties must be of type <key> = <value>");
  }
  const key = parts[0];
  const value = parts[1];
  return [key, value];
}
