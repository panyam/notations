import * as TSU from "@panyam/tsutils";
import { Atom, Space, Group, Syllable } from "./core";
import { Cycle, Bar } from "./cycle";
const ONE = TSU.Num.Fraction.ONE;

/**
 * Converts a cycle string into an array of bar strings.
 *
 * A cycle is specified by a "|" delimited string in the format:
 * <bar1>|<bar2>|<bar3>....|<barN>
 *
 * Empty bars are ignored.
 *
 * @param cycleStr The cycle string to convert
 * @returns An array of bar strings
 */
export function cycleStrToBarsStrs(cycleStr: string): string[] {
  return cycleStr
    .replace(/\|+/g, "|")
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Parses a tala pattern string into a Cycle object.
 *
 * @param cycleStr The cycle string to parse
 * @returns A new Cycle object
 */
export function parseCycle(cycleStr: string): Cycle {
  return new Cycle({
    bars: cycleStrToBarsStrs(cycleStr).map(parseBar),
  });
}

/**
 * Parses a bar string into a Bar object.
 *
 * A bar string is a space delimited string in the following format:
 * "<beat1> <spaces> <beat2> .... <beatN>"
 *
 * beatX substring cannot contain "|" or spaces.
 *
 * Each Beat string is in the following format:
 * "<length>(:<count>)?"  or "<length>?:<count>"
 *
 * Both length and count are optional but at least one of them must be specified.
 * When not specified the other defaults to 1.
 * Length can also be a fraction of the form <num>"/"<den> (without spaces).
 *
 * @param barStr The bar string to parse
 * @returns A new Bar object
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

/**
 * Parses a compact syllable string, such as "Sa,,ri,_,ga", into atoms.
 *
 * It follows the DSL's rules. A comma is one unit of a held (non-silent) space. An underscore
 * standing alone between commas, or as the whole string, is one unit of silence. An underscore
 * next to another underscore or to a letter is part of the syllable, so "S_N_D" and "___" are
 * single syllables, as they are single literals in the DSL.
 *
 * @param value The string to parse
 * @returns The one atom for a single part, or a Group of the parts in order
 */
export function parseSyllable(value: string): Atom {
  const notes = [] as Atom[];
  const parts = value.split(",");
  parts.forEach((part, i) => {
    if (part === "_") notes.push(new Space(ONE, true));
    else if (part.length > 0) notes.push(new Syllable(part));
    if (i < parts.length - 1) notes.push(new Space(ONE, false));
  });
  if (notes.length == 1) return notes[0];
  return new Group(...notes);
}

/**
 * Parses a property string in the format "key = value".
 *
 * @param line The property string to parse
 * @returns A tuple containing the key and value
 * @throws Error if the property string is invalid
 */
export function parseProperty(line: string): [string, string] {
  const bars = line.split("=").map((x) => x.trim());
  if (bars.length < 2) {
    throw new Error("Properties must be of type <key> = <value>");
  }
  const key = bars[0];
  const value = bars[1];
  return [key, value];
}

/**
 * NOT YET IMPLEMENTED
 * A sparse array type which is optimized for "holes" while not penalizing
 * runs of values.
 */
export class SparseArray<T> {
  runs: [number, T[]][] = [];

  /**
   * Gets the total length of this sparse array.
   */
  get length(): number {
    let out = 0;
    for (const [, vals] of this.runs) {
      out += vals.length;
    }
    return out;
  }

  /**
   * Returns the value at a given index.
   * If the value does not exist an optional creator method can be passed
   * to ensure that this value is also created and set at the given index.
   *
   * @param index The index to get the value at
   * @param creator Optional function to create a value if none exists
   * @returns The value at the index
   */
  valueAt(index: number, creator?: () => any): any {
    let out = null;
    if (out == null && creator) {
      // wasnt found
      out = creator();
      this.setAt(index, out);
    }
    return out;
  }

  /**
   * Sets values at a specific index.
   *
   * @param index The index to set values at
   * @param values The values to set
   * @returns This array instance for method chaining
   */
  setAt(index: number, ...values: (T | null)[]): this {
    return this.splice(index, values.length, ...values);
  }

  /**
   * Removes values at a specific index.
   *
   * @param index The index to remove values at
   * @param count The number of values to remove, defaults to 1
   * @returns This array instance for method chaining
   */
  removeAt(index: number, count = 1): this {
    return this.splice(index, count);
  }

  /**
   * Splices values at a specific index.
   *
   * @param index The index to splice at
   * @param numToDelete The number of values to delete
   * @param valuesToInsert The values to insert
   * @returns This array instance for method chaining
   */
  splice(index: number, numToDelete: number, ...valuesToInsert: (T | null)[]) {
    //
    return this;
  }
}
