/**
 * timeline.ts - When each note starts and how long it lasts, in beats.
 *
 * A player reads a timeline instead of walking atoms, groups and `\beatDuration` itself. Times
 * stay in beats as exact fractions. Tempo, seconds and pitch belong to the player
 * (src/ARCHITECTURE.md, "Musical time, not clock time"; #101, #75).
 */

import * as TSU from "@panyam/tsutils";
import { Atom, AtomType, LeafAtom, Line, Literal, Note, Role, Space } from "./core";
import { Block, BlockItem, isBlock, isLine } from "./block";
import { AtomIterator } from "./iterators";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

/** What a timeline event holds: a swara, a syllable of sahitya, or silence. */
export type TimelineEventKind = "note" | "syllable" | "rest";

/** Where an event starts within its tala cycle. */
export interface TalaPosition {
  /** Which cycle, counted from the first line's first cycle. Negative for a first line's pickup. */
  cycle: number;
  /** Bar (anga) within the cycle, from 0. */
  bar: number;
  /** Beat within the bar, from 0. */
  beat: number;
  /** Which repeat of that beat, for a bar written as one beat counted several times. */
  instance: number;
  /** Beat within the whole cycle, from 0. A tala keeper counts this. */
  beatInCycle: number;
  /** How far into that beat the event starts, in beats. Zero when it starts on the beat. */
  offsetInBeat: Fraction;
}

/**
 * One note, syllable or rest. A note held with commas (`S , ,`) is one event lasting all of
 * them, so a player hears one sustained note. A zero-length rest (`-`) inside a hold doesn't
 * break it.
 */
export interface TimelineEvent {
  kind: TimelineEventKind;
  /** The atom that starts the event. A rest's atom is its first silent space. */
  atom: LeafAtom;
  role: Role;
  line: Line;
  /** Beats from the start of the piece: the samam of the first line's first cycle. */
  offset: Fraction;
  /** Beats from the samam of the line's first cycle. Negative for a pickup before samam. */
  lineOffset: Fraction;
  /** Beats, commas included. */
  duration: Fraction;
  tala: TalaPosition;
  /** The swara or syllable as written, such as "S" or "sa". Empty for a rest. */
  value: string;
  /** Octave of a note: 0 middle, 1 for `S.`, -1 for `.S`. Zero for syllables and rests. */
  octave: number;
  /** The gamakas on the note, as the model holds them. Empty when there are none. */
  gamakas: any[];
  /** True when a `-` follows the event, so a player can re-articulate before the next one. */
  breakAfter: boolean;
}

/** Where one line sits in the piece. */
export interface TimelineLine {
  line: Line;
  /** Beats from the start of the piece to the samam of this line's first cycle. */
  offset: Fraction;
  /** How many whole cycles the line takes. The next line starts after them. */
  cycles: number;
  /** Beats in one cycle of this line's tala. */
  cycleDuration: Fraction;
}

/** A notation's events in time order, with its lines and anything a player should know. */
export interface Timeline {
  /** Every event, sorted by offset. Events at the same offset keep their role order. */
  events: TimelineEvent[];
  /** Lines in play order. A `\repeat` block's lines appear once per pass. */
  lines: TimelineLine[];
  /** Beats from the start of the piece to the end of the last line's last cycle. */
  duration: Fraction;
  /** Problems a player may want to show, such as a pickup that overlaps the line before it. */
  warnings: string[];
}

/**
 * Lays out `block` (usually a whole `Notation`) in beats.
 *
 * Each line starts on a samam, shifted by its own `\line(offset=...)`. A line takes a whole
 * number of cycles, so a line ending at beat 6 of Adi leaves 2 silent beats before the next one.
 * That matches the rendered page, where each line starts a fresh row. A pickup (negative offset)
 * reaches back into the previous line's last cycle; if notes are already sounding there, the
 * timeline keeps both and adds a warning.
 */
export function buildTimeline(block: Block): Timeline {
  const builder = new TimelineBuilder();
  builder.addBlock(block);
  return builder.finish();
}

class TimelineBuilder {
  private events: TimelineEvent[] = [];
  private lines: TimelineLine[] = [];
  private warnings: string[] = [];
  private nextLineOffset = ZERO;
  private nextCycle = 0;
  /** Where the latest sounding event ends, to spot a pickup that overlaps it. */
  private soundingUntil: Fraction | null = null;
  /** The last event per role name, so commas can extend it across a line break. */
  private lastByRole = new Map<string, TimelineEvent>();

  addBlock(block: Block): void {
    for (const item of block.children()) this.addItem(item);
  }

  finish(): Timeline {
    // A stable sort keeps role order among events at the same offset.
    const events = this.events.map((e, i) => [e, i] as const);
    events.sort(([a, i], [b, j]) => a.offset.cmp(b.offset) || i - j);
    return {
      events: events.map(([e]) => e),
      lines: this.lines,
      duration: this.nextLineOffset,
      warnings: this.warnings,
    };
  }

  private addItem(item: BlockItem): void {
    if (isLine(item)) {
      const line = item as Line;
      if (!line.isEmpty && line.layoutParams != null) this.addLine(line);
    } else if (isBlock(item)) {
      this.addBlock(item as Block);
    }
  }

  private addLine(line: Line): void {
    const lp = line.layoutParams;
    const cycle = lp.cycle;
    const cycleDuration = cycle.duration;
    const lineStart = this.nextLineOffset;
    const startShift = line.offset.divbyNum(lp.beatDuration);

    let lineEnd = startShift;
    let earliest: Fraction | null = null;
    const lineEvents: TimelineEvent[] = [];
    for (const role of line.roles) {
      const iter = new AtomIterator(...role.atoms);
      let roleEnd = startShift;
      for (let flat = iter.next(); flat != null; flat = iter.next()) {
        const lineOffset = startShift.plus(flat.offset.divbyNum(lp.beatDuration), true);
        const duration = flat.duration.divbyNum(lp.beatDuration, true);
        roleEnd = lineOffset.plus(duration, true);
        const ev = this.addAtom(flat.atom, role, line, lineStart, lineOffset, duration);
        if (ev) {
          lineEvents.push(ev);
          if (ev.kind != "rest" && (earliest == null || ev.offset.isLT(earliest))) earliest = ev.offset;
        }
      }
      if (roleEnd.isGT(lineEnd)) lineEnd = roleEnd;
    }

    if (earliest != null && this.soundingUntil != null && earliest.isLT(this.soundingUntil)) {
      this.warnings.push(
        `Line ${this.lines.length + 1} starts at beat ${beats(earliest)} of the piece, ` +
          `but the line before it is still sounding until beat ${beats(this.soundingUntil)}.`,
      );
    }
    for (const ev of lineEvents) {
      if (ev.kind == "rest") continue;
      const end = ev.offset.plus(ev.duration);
      if (this.soundingUntil == null || end.isGT(this.soundingUntil)) this.soundingUntil = end;
    }

    const cycles = Math.max(1, lineEnd.divby(cycleDuration).ceil);
    this.lines.push({ line, offset: lineStart, cycles, cycleDuration });
    this.nextLineOffset = lineStart.plus(cycleDuration.timesNum(cycles), true);
    this.nextCycle += cycles;
  }

  /** Adds or extends an event for one leaf atom. Returns the event when it is a new one. */
  private addAtom(
    atom: LeafAtom,
    role: Role,
    line: Line,
    lineStart: Fraction,
    lineOffset: Fraction,
    duration: Fraction,
  ): TimelineEvent | null {
    if (duration.isZero) return null; // markers and labels take no time
    const offset = lineStart.plus(lineOffset, true);
    const prev = this.lastByRole.get(role.name) ?? null;
    const contiguous = prev != null && prev.offset.plus(prev.duration).equals(offset);

    const kind = kindOf(atom, role);
    if (kind == null) return null;
    const silent = atom.TYPE == AtomType.SPACE && (atom as Space).isSilent;
    const continuation = atom.TYPE == AtomType.SPACE && !silent;

    // A comma holds whatever came just before it. A silent space extends only a rest.
    if (contiguous && (continuation || (silent && prev.kind == "rest"))) {
      prev.duration = prev.duration.plus(duration, true);
      prev.breakAfter = atom.beforeRest;
      return null;
    }

    const isRest = silent || continuation;
    const lit = isRest ? null : (atom as Literal);
    const ev: TimelineEvent = {
      kind: isRest ? "rest" : kind,
      atom,
      role,
      line,
      offset,
      lineOffset,
      duration,
      tala: this.talaPosition(line, lineOffset),
      value: lit ? lit.value : "",
      octave: atom.TYPE == AtomType.NOTE ? (atom as Note).octave : 0,
      gamakas: lit ? lit.embelishments : [],
      breakAfter: atom.beforeRest,
    };
    this.events.push(ev);
    this.lastByRole.set(role.name, ev);
    return ev;
  }

  private talaPosition(line: Line, lineOffset: Fraction): TalaPosition {
    const [cycleNum, [bar, beat, instance], offsetInBeat, beatInCycle] =
      line.layoutParams.cycle.getPosition(lineOffset);
    return { cycle: this.nextCycle + cycleNum, bar, beat, instance, beatInCycle, offsetInBeat };
  }
}

/** Whether a leaf atom sounds as a note or a syllable, by its type and its role's default. */
function kindOf(atom: Atom, role: Role): TimelineEventKind | null {
  switch (atom.TYPE) {
    case AtomType.NOTE:
      return "note";
    case AtomType.SYLLABLE:
      return "syllable";
    case AtomType.LITERAL:
      return role.defaultToNotes ? "note" : "syllable";
    case AtomType.SPACE:
      return "rest";
    default:
      return null;
  }
}

/** A beat count as people write it: "6" rather than "6/1", "13/2" for six and a half. */
function beats(f: Fraction): string {
  return f.den == 1 ? `${f.num}` : f.toString();
}
