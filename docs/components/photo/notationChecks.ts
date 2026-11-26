/**
 * notationChecks.ts - Parser-backed checks for a machine transcription.
 *
 * A transcription can parse cleanly and still be wrong in a way the parser cannot see: a missed
 * karvai shifts every following swara by one slot. The two checks here catch most of that from
 * the parsed model alone, without the photo:
 *
 * - every role in a line should last as long as the others (Sw and Sh line up), and
 * - a line should fill a whole number of avartanams.
 *
 * Both are reported as warnings, not errors, because both have legitimate exceptions (a
 * composition that ends mid-cycle, an eduppu offset). The transcriber shows them to the model
 * once and to the user always.
 */

import { load } from "../../../src/loader";
import { isBlock, isLine } from "../../../src/block";
import type { Block, BlockItem } from "../../../src/block";
import { Group, Literal, Note, Rest, Space } from "../../../src/core";
import type { Atom, Line } from "../../../src/core";

export interface NotationCheck {
  /** Parse errors. A non-empty list means the source did not load. */
  errors: string[];
  /** Alignment problems in a source that did load. */
  warnings: string[];
  /** Number of notation lines found, for status messages. */
  lineCount: number;
}

/** Formats a beat count compactly: 8, 7.5, or 22/3 for thirds and the like. */
function fmtBeats(num: number, den: number): string {
  if (den === 1) return String(num);
  const asDecimal = num / den;
  if (Number.isInteger(asDecimal * 4)) return String(asDecimal);
  return `${num}/${den}`;
}

/** Writes an atom back in DSL form, near enough for a human to find it in the source. */
function atomText(atom: Atom): string {
  if (atom instanceof Note) {
    const dots = ".".repeat(Math.abs(atom.octave));
    return atom.octave < 0 ? dots + atom.value : atom.value + dots;
  }
  if (atom instanceof Literal) return atom.value;
  if (atom instanceof Space) return atom.isSilent ? "_" : ",";
  if (atom instanceof Rest) return "-";
  if (atom instanceof Group) return "[" + Array.from(atom.atoms.values()).map(atomText).join(" ") + "]";
  return "?";
}

/** First few atoms of a role, so a warning can say which line it means. */
function preview(line: Line): string {
  const role = line.roles.find((r) => r.atoms.length > 0);
  if (!role) return "";
  const text = role.atoms.slice(0, 6).map(atomText).join(" ");
  return `${roleLabel(role.name)}: ${text}${role.atoms.length > 6 ? " ..." : ""}`;
}

/** Role names are stored lower case; show them the way they are written in the DSL. */
function roleLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function collectLines(block: Block, out: Line[]): void {
  for (const child of block.children() as BlockItem[]) {
    if (isLine(child)) {
      out.push(child);
    } else if (isBlock(child)) {
      collectLines(child, out);
    }
  }
}

function describeError(e: any): string {
  if (e == null) return "Unknown error";
  const msg = e.message || String(e);
  // tlex/galore errors carry a position; surface it when present so the model can find the spot.
  const line = e.line ?? e.token?.line;
  const col = e.col ?? e.token?.col;
  if (typeof line === "number" && !msg.includes(`line ${line}`)) {
    return `${msg} (line ${line + 1}${typeof col === "number" ? `, column ${col + 1}` : ""})`;
  }
  return msg;
}

/**
 * Parses `source` and runs the alignment checks.
 */
export function checkNotation(source: string): NotationCheck {
  let notation: any;
  let errors: any[];
  try {
    [notation, , errors] = load(source);
  } catch (e: any) {
    return { errors: [describeError(e)], warnings: [], lineCount: 0 };
  }
  if (errors.length > 0) {
    return { errors: errors.map(describeError), warnings: [], lineCount: 0 };
  }

  const lines: Line[] = [];
  collectLines(notation, lines);
  const warnings: string[] = [];
  let lineNumber = 0;
  for (const line of lines) {
    if (line.isEmpty) continue;
    lineNumber++;
    const lp = line.layoutParams;
    if (!lp) continue;
    const label = `Line ${lineNumber} (${preview(line)})`;

    const roles = line.roles.filter((r) => r.atoms.length > 0);
    const beatsByRole = roles.map((r) => ({ name: r.name, beats: r.duration.divbyNum(lp.beatDuration) }));

    // Roles in one line should end together.
    if (beatsByRole.length > 1) {
      const distinct = new Set(beatsByRole.map((r) => r.beats.toString()));
      if (distinct.size > 1) {
        const desc = beatsByRole
          .map((r) => `${roleLabel(r.name)} ${fmtBeats(r.beats.num, r.beats.den)} beats`)
          .join(", ");
        warnings.push(`${label}: roles have different lengths: ${desc}.`);
      }
    }

    // The longest role should fill whole avartanams, counting any offset the line starts at.
    const cycleBeats = lp.cycle.duration;
    if (cycleBeats.isZero || beatsByRole.length === 0) continue;
    let longest = beatsByRole[0].beats;
    for (const r of beatsByRole) {
      if (r.beats.cmp(longest) > 0) longest = r.beats;
    }
    const total = longest.plus(line.offset.divbyNum(lp.beatDuration));
    const rem = total.mod(cycleBeats);
    if (!rem.isZero) {
      const cycles = total.divby(cycleBeats);
      warnings.push(
        `${label}: lasts ${fmtBeats(total.num, total.den)} beats, which is not a whole number of ` +
          `${fmtBeats(cycleBeats.num, cycleBeats.den)}-beat avartanams (${cycles.floor} full ` +
          `plus ${fmtBeats(rem.num, rem.den)} beats) at beatDuration ${lp.beatDuration}.`,
      );
    }
  }
  return { errors: [], warnings, lineCount: lineNumber };
}
