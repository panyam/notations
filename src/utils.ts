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
 * A bar with no spaces made only of numbers and commas lists unit beats: a number adds that many
 * beats and each comma adds one, so "4", "4,," (6 beats) and "10" all work.
 *
 * Otherwise the bar is a space-separated list of beats, each in the form
 * "<length>(:<count>)?" or "<length>?:<count>".  Length is a whole number, a fraction like 3/2,
 * or a run of commas (its length is the number of commas).  Commas after a number are ignored,
 * so "5,," is a beat of length 5.  Count says how many times the beat
 * repeats.  Either may be left out and defaults to 1, so "6 4 4" is one bar of three beats with
 * lengths 6, 4 and 4, and "4:2" is two beats of length 4.
 *
 * @param barStr The bar string to parse
 * @returns A new Bar object
 * @throws Error naming the beat when a beat is not in one of these forms
 */
export function parseBar(barStr: string): Bar {
  const beats = barStr.trim().split(/\s+/);
  const cp = new Bar();
  if (beats.length == 1 && /^[\d,]*$/.test(beats[0])) {
    for (const run of beats[0].match(/\d+|,/g) ?? []) {
      const count = run == "," ? 1 : parseInt(run);
      for (let i = 0; i < count; i++) {
        cp.beatLengths.push(ONE);
        cp.beatCounts.push(1);
      }
    }
    return cp;
  }
  for (const beat of beats) {
    if (!/^(\d+(\/\d+)?,*|,+)?(:\d*)?$/.test(beat)) {
      throw new Error(`Invalid beat "${beat}" in bar "${barStr}"`);
    }
    const [length, count = ""] = beat.split(":");
    if (length.length == 0) {
      cp.beatLengths.push(ONE);
    } else if (/^,+$/.test(length)) {
      cp.beatLengths.push(TSU.Num.Frac(length.length));
    } else {
      cp.beatLengths.push(TSU.Num.Fraction.parse(length.replace(/,+$/, "")));
    }
    const beatCount = parseInt(count);
    cp.beatCounts.push(isNaN(beatCount) ? 1 : beatCount);
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
