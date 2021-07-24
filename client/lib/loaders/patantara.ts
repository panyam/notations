import * as TSU from "@panyam/tsutils";
import { parseSyllable, parseProperty, parseCycle } from "./utils";

import { Label, AtomBase, Cycle, AtomType, Atom, Line, Space, Note, Group } from "../models/index";
import { Snippet } from "../models/notebook";

const ZERO = TSU.Num.Fraction.ZERO;

function groupAtoms(atoms: Atom[], groupSize = 1, offset = 0, length = -1): Group[] {
  // Group groupSize atoms at a time and add as a group
  // For the last group add spaces
  const groups = [] as Group[];
  let currGroup: TSU.Nullable<Group> = null;
  if (offset < 0) offset = 0;
  if (length < 0) length = atoms.length - offset;
  for (let i = 0; i < length; i++) {
    if (currGroup == null) {
      currGroup = new Group();
    }

    const atom = atoms[offset + i];
    currGroup.addAtoms(atom);
    if (currGroup.atoms.size % groupSize == 0) {
      groups.push(currGroup);
      currGroup = null;
    }
  }
  if (currGroup != null) {
    groups.push(currGroup);
  }
  return groups;
}

/**
 * Patantara syntax is something as follows:
 *
 * snippet := line +
 *
 * line = PropertyLine | ScoreLine | EmptyLine | TextLine
 *
 * EmptyLine = "\s*\n$"
 * TextLine = ">.*\n$"
 * PropertyLine = "[^=]+=[^=]+\n"
 * ScoreLine = Atom ( " " Atom ) * \n
 * Atom = [^\s]+
 *
 * EmptyLine and PropertyLine with "tala pattern" begin a new Section.
 * Only way to differentiate btw different roles in a line is via
 * checking whether a line is made of "only" swara notes or not.
 *
 * SwaraNote := "[SrRgGmMPdDnN][\+\-]*" | "," | "_"
 */
export class PatantaraParser {
  commentPrefix = "#";
  currCycle: TSU.Nullable<Cycle> = null;
  currLine: TSU.Nullable<Line> = null;
  currLayout: number[] = [];
  debugLines = false;

  // We can only form a line after *all* the roles for a line have been read.
  currSectionAtoms: Atom[][] = [];
  cycleDuration = ZERO;
  aksharasPerLine = -1;
  aksharasForLastLine = -1;
  readonly snippet: Snippet;

  constructor(snippet: Snippet, config?: any) {
    config = config || {};
    this.snippet = snippet;
    this.debugLines = config.debugLines || false;
  }

  get numRoles(): number {
    return this.currSectionAtoms.length;
  }

  get numAksharasInCurrLine(): number {
    if (this.aksharasForLastLine >= 0) return this.aksharasForLastLine;
    else if (this.aksharasPerLine > 0) return this.aksharasPerLine;
    else if (this.aksharasPerLine < 0 && this.currCycle != null) return this.currCycle.beatCount;
    return -1;
  }

  parse(input: string): void {
    // this.currCycle = null;
    // this.currLine = null;
    const inLines = input.split("\n").map((line) => line.trim());
    inLines.forEach((line, index) => this.processLine(line, index));
    // Finish any unfinished sections
    this.processEmptyLine();
  }

  processLine(line: string, lineNum = -1): void {
    line = line.trim();
    if (this.debugLines) {
      console.log("Parsing Line: ", line);
    }
    if (line == "") {
      this.processEmptyLine();
    } else if (line.startsWith(this.commentPrefix)) {
      // Ignore it - it is a comment
    } else if (line.startsWith(">")) {
      const textLine = line.substring(1).trim();
      this.processTextLine(textLine);
    } else if (line.indexOf("=") >= 0) {
      // Handle a property line
      const [key, value] = parseProperty(line);
      this.processProperty(key, value);
    } else if (this.currLine != null && this.currCycle != null) {
      // Treat the rest as roles in the current line
      const numGroups = this.numAksharasInCurrLine;
      const atoms = parseLine(line, numGroups)[0];
      if (numGroups > 0 && atoms.length != numGroups) {
        console.log(`Line ${lineNum}: Expected ${numGroups} atoms.  Found ${atoms.length}`);
        this.currSectionAtoms.push([]);
      } else {
        this.currSectionAtoms.push(atoms);
      }
    } else {
      throw new Error("Row starting without a cycle, Line: " + lineNum);
    }
  }

  private processTextLine(textLine: string): void {
    // TODO - Ignore normal lines for now
    // A "normal" line to be added as text
    // We need to think of how to add these.
    // This is only for
    this.currSectionAtoms.push([new Label(textLine.trim())]);
  }

  private processProperty(key: string, value: string): void {
    key = key.trim().toLowerCase().replace(/\s+/g, " ");
    if (key == "cycle" || key == "tala pattern") {
      this.currCycle = parseCycle(value);
      this.cycleDuration = this.currCycle.duration;
      this.snippet.properties.setone("cycle", this.currCycle);
      this.addNewLine();
    } else if (key == "layout") {
      this.currLayout = value
        .split(" ")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .map(parseInt)
        .filter((x) => !isNaN(x));
      this.snippet.properties.setone("layout", this.currLayout);
      this.addNewLine();
    } else if (key == "aksharas per line") {
      // Not sure why this is needed but this seems to somethign like:
      // cycle.length / aksharas_per_line = number of avartams per real cycle
      this.aksharasPerLine = parseInt(value);
    } else if (key == "aksharas") {
      this.aksharasForLastLine = parseInt(value);
    } else {
      this.snippet.properties.setone(key, value);
      console.log(`TODO Key: '${key}', Value: '${value}'`);
    }
  }

  /**
   * Empty line is a way to "accumlate" the last few lines of notes
   * into the current line and start new lines in the process if
   * necessary.
   */
  private processEmptyLine(): void {
    // empty line starts a new "line" so close off previous line.
    /*
    if (this.currSectionAtoms.length > 0) {
      if (this.currLine == null) {
        throw new Error("Current Line does not exist");
      }
      if (this.currCycle == null) {
        throw new Error("Current Cycle does not exist");
      }

      // Ensure this line has this many roles
      this.currLine.ensureRoles(this.numRoles, this.currLine.duration);

      const roleOffsets = ArrayTimesN(this.numRoles, 0);
      let needAnotherLine = true;
      while (needAnotherLine) {
        needAnotherLine = false;
        for (let i = 0; i < this.numRoles; i++) {
          const atoms = this.currSectionAtoms[i];
          const currRole = this.currLine.roles[i];
          while (roleOffsets[i] < atoms.length) {
            // for (let j = ZERO; j.cmp(remainingDuration) <= 0 && roleOffsets[i] < atoms.length; j = j.plus(ONE)) {
            const nextAtom = atoms[roleOffsets[i]++];
            currRole.atoms.push(nextAtom);
            // Break out when the role completes a cycle
            if (currRole.duration.divby(this.cycleDuration).isWhole) {
              break;
            }
          }
          if (roleOffsets[i] < atoms.length) {
            // then another line needed
            needAnotherLine = true;
          }
        }
        if (needAnotherLine) {
          // create a new line
          this.addNewLine();
          this.currLine.ensureRoles(this.numRoles, ZERO);
        }
      }
      this.currSectionAtoms = [];
    }
   */

    // Reset this
    this.aksharasForLastLine = -1;
  }

  /**
   * Adds a new line with the current cycle.
   */
  addNewLine(): void {
    /** TODO - COnvert to Snippets
    if (this.currLine == null || this.currLine.duration.cmp(ZERO) > 0) {
      this.currLine = this.notebook.newLine();
      this.currLine.cycle = this.currCycle;
    }
    this.currLine.setMetadata("layout", this.currLayout);
    */
  }
}

/**
 * Tells if a line is only composed of swarams.
 */
export function isSwaramLine(line: string | string[]): [string[], boolean] {
  let values: string[];
  if (typeof line === "string") {
    values = line.replace(/\s+/g, " ").trim().split(" ");
  } else {
    values = line;
  }
  // Courtesy of patantara.
  const kSvarasthanaREStr = "([SrRgGmMPdDnN][\\+\\-]*)|[,_]";
  const kSvarasthanaTokenREStr = "(" + kSvarasthanaREStr + ")+";
  const kSvarasthanaLineTokenRE = new RegExp("^" + kSvarasthanaTokenREStr + "$");
  for (const v of values) {
    if (!kSvarasthanaLineTokenRE.test(v)) {
      return [values, false];
    }
  }
  return [values, true];
}

/**
 * Parses a line into atoms.
 */
export function parseLine(line: string, numGroups = -1): [Atom[], boolean] {
  const [values, allSwarams] = isSwaramLine(line);
  const atomParser = allSwarams ? parseNote : parseSyllable;
  const atoms = values.map(atomParser);
  const length = atoms.length;
  if (numGroups <= 0 || length == numGroups) {
    return [atoms, allSwarams];
  }

  let out: Atom[];
  if (length > numGroups) {
    let groupSize = Math.floor(length / numGroups);
    if (length % numGroups != 0) groupSize++;
    out = groupAtoms(atoms, groupSize, 0, length);
  } else {
    // length < numGroups
    // Here we need to "expand" each atom to be a certain size
    out = AtomBase.expandAtoms(atoms, 0, length, numGroups);
  }
  return [out, allSwarams];
}

export function parseNote(value: string): Atom {
  const notes = [] as Atom[];
  // notes
  for (let i = 0; i < value.length; ) {
    let ch = value[i];
    if (ch == "_") {
      notes.push(new Space(TSU.Num.Fraction.ONE, true));
      i++;
    } else if (ch == ",") {
      notes.push(new Space(TSU.Num.Fraction.ONE, false));
      i++;
    } else {
      while (i < value.length && ch != "," && ch != "_") {
        if (ch == "+" || ch == "-") {
          let note: TSU.Nullable<Note> = null;
          if (notes.length == 0 || notes[notes.length - 1].type != AtomType.NOTE) {
            throw new Error("+/- can only appear a note");
          }
          note = notes[notes.length - 1] as Note;
          if (ch == "+") note.octave++;
          else note.octave--;
        } else {
          notes.push(new Note(ch));
        }
        i++;
        ch = value[i];
      }
    }
  }
  if (notes.length == 1) return notes[0];
  return new Group(TSU.Num.Fraction.ONE, ...notes);
}
