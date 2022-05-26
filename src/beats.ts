import * as TSU from "@panyam/tsutils";
import { Group, Line, Atom, Space, Role } from "./";
import { CycleIterator, CyclePosition } from "./cycle";
import { WindowIterator } from "./iterators";
import { LayoutParams } from "./layouts";
import { GridView, GridCell, GridCellView, AlignedCol } from "./grids";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

export type BeatView = GridCellView;

export class Beat {
  private static idCounter = 0;
  readonly uuid = Beat.idCounter++;
  layoutLine = -1;
  layoutColumn = -1;
  // Should this be as flat Atoms or should we keep it as atoms and breakdown
  // later?
  atom: Atom;
  protected atomIsPlaceholder = false;
  constructor(
    public readonly index: number,
    public readonly role: Role,
    public readonly offset: Fraction,
    public readonly duration: Fraction,
    public readonly barIndex: number,
    public readonly beatIndex: number,
    public readonly instance: number,
    public readonly prevBeat: null | Beat,
    public nextBeat: null | Beat,
  ) {}

  debugValue(): any {
    return {
      index: this.index,
      role: this.role.name,
      offset: this.offset.toString(),
      duration: this.duration.toString(),
      barIndex: this.barIndex,
      beatIndex: this.beatIndex,
      instance: this.instance,
      atom: this.atom.debugValue(),
    };
  }

  get endOffset(): Fraction {
    return this.offset.plus(this.duration);
  }

  get filled(): boolean {
    return this.remaining.isZero;
  }

  get remaining(): Fraction {
    return this.atom ? this.duration.minus(this.atom.duration, true) : this.duration;
  }

  add(atom: Atom): boolean {
    if (this.remaining.cmp(atom.duration) < 0) {
      return false;
    }
    if (!this.atom) {
      this.atom = atom;
    } else {
      if (!this.atomIsPlaceholder) {
        this.atomIsPlaceholder = true;
        this.atom = new Group(this.atom).setDuration(ONE, true);
      }
      (this.atom as Group).addAtoms(true, atom);
    }
    return true;
  }
}

export class BeatsBuilder {
  // All atoms divided into beats
  readonly beats: Beat[] = [];
  readonly startIndex: number;
  readonly beatOffset: Fraction;
  cycleIter: CycleIterator;
  windowIter: WindowIterator;

  // Callback for when an atom is added to this role.
  onAtomAdded: (atom: Atom, beat: Beat) => void;

  // Callback for when a new beat is added
  onBeatAdded: (beat: Beat) => void;
  // Callback for when a beat has been filled
  onBeatFilled: (beat: Beat) => void;

  constructor(
    public readonly role: Role,
    public readonly layoutParams: LayoutParams,
    public readonly startOffset: Fraction = ZERO,
    ...atoms: Atom[]
  ) {
    const [, [bar, beat, instance], beatOffset, index] = layoutParams.cycle.getPosition(startOffset);
    this.cycleIter = layoutParams.cycle.iterateBeats(bar, beat, instance);
    this.windowIter = new WindowIterator();
    this.beatOffset = beatOffset;

    // evaluate the start beatindex - typically it would be 0 if things start
    // at beginning of a cycle.  But if the start offset is < 0 then the
    // startIndex should also shift accordingly
    this.startIndex = index;
    this.addAtoms(...atoms);
  }

  addAtoms(...atoms: Atom[]): void {
    // First add all atoms to the atom Iterator so we can
    // fetch them as FlatAtoms.  This is needed because atoms
    // passed here could be unflatted (via groups) or much larger
    // than what can fit in the given role/bar etc.  So this
    // flattening and windowing is needed before we add them
    // to the views - and this is done by the durationIterators.
    this.windowIter.push(...atoms);
    while (this.windowIter.hasMore) {
      // get the last/current row and add a new one if it is full
      let currBeat = this.beats[this.beats.length - 1];

      // First add a row if last row is filled
      if (this.beats.length == 0 || currBeat.filled) {
        // what should be the beatlengths be here?
        currBeat = this.addBeat();
      }

      // For this beat get symbols in all roles
      const [remAtoms, filled] = this.windowIter.get(currBeat.remaining);
      TSU.assert(remAtoms.length > 0, "Atleast one element should have been available here");
      // render the atoms now
      for (const atom of remAtoms) {
        // console.log("Adding FA: ", flatAtom.debugValue(), flatAtom.atom);
        TSU.assert(currBeat.add(atom), "Should return true as we are already using a duration iterator here");
        if (this.onAtomAdded) this.onAtomAdded(atom, currBeat);
      }
      if (currBeat.filled) {
        if (this.onBeatFilled) this.onBeatFilled(currBeat);
      }
    }
  }

  protected addBeat(): Beat {
    const numBeats = this.beats.length;
    const lastBeat = numBeats == 0 ? null : this.beats[numBeats - 1];
    const nextCP: [CyclePosition, Fraction] = this.cycleIter.next().value;
    const apb = this.layoutParams.beatDuration;
    const newBeat = new Beat(
      lastBeat == null ? this.startIndex : lastBeat.index + 1,
      this.role,
      lastBeat == null ? this.startOffset.minus(this.beatOffset).timesNum(apb, true) : lastBeat.endOffset,
      nextCP[1].timesNum(apb),
      nextCP[0][0],
      nextCP[0][1],
      nextCP[0][2],
      lastBeat,
      null,
    );
    if (lastBeat == null && this.beatOffset.isGT(ZERO)) {
      // Add spaces to fill up empty beats
      newBeat.add(new Space(this.beatOffset.timesNum(apb)));
    }
    if (lastBeat) lastBeat.nextBeat = newBeat;
    this.beats.push(newBeat);
    if (this.onBeatAdded) this.onBeatAdded(newBeat);
    return newBeat;
  }
}

/**
 * Grouping of beats by their column based on the layout params.
 * The confusion is we have beats broken up and saved in columns
 * but we are loosing how a line is supposed to access it in its own way
 * we have beatsByRole for getting all beats for a role (in a line)
 * sequentially we have beatColumns for getting all beats in a particular
 * column across all lines and roles globally.
 *
 * What we want here is for a given line get all roles, their beats
 * in zipped way.  eg for a Line with 3 roles and say 10 beats each
 * (with the breaks of 4, 1) we need:
 *
 * R1 B1 R1 B2 R1 B3 R1 B4
 * R2 B1 R2 B2 R2 B3 R2 B4
 * R3 B1 R3 B2 R3 B3 R3 B4
 *
 * R1 B5
 * R2 B5
 * R3 B5
 *
 * R1 B6 R1 B7 R1 B8 R1 B9
 * R2 B6 R2 B7 R2 B8 R2 B9
 * R3 B6 R3 B7 R3 B8 R3 B9
 *
 * R1 B10
 * R2 B10
 * R3 B10
 *
 *
 * Here we have 5 distinct beat columns:
 *
 * 1: R1B1, R2B1, R3B1, R1B6, R2B6, R3B6,
 * 2: R1B2, R2B2, R3B2, R1B7, R2B7, R3B7,
 * 3: R1B3, R2B3, R3B3, R1B8, R2B8, R3B8,
 * 4: R1B4, R2B4, R3B4, R1B9, R2B9, R3B9,
 * 5: R1B5, R2B5, R3B5, R1B10, R2B10, R3B10,
 *
 */
export class BeatColDAG {
  beatColumns = new Map<string, BeatColumn>();
  ensureBeatColumn(offset: Fraction, endOffset: Fraction, markerType = 0): [BeatColumn, boolean] {
    const key = BeatColumn.keyFor(offset, endOffset, markerType);
    let bcol = this.beatColumns.get(key) || null;
    const newcreated = bcol == null;
    if (!bcol) {
      bcol = new BeatColumn(offset, endOffset, markerType);
      this.beatColumns.set(key, bcol);
    }
    return [bcol, newcreated];
  }

  /**
   * Gets the beat column of a given duration at the given offset.
   */
  getBeatColumn(offset: Fraction, endOffset: Fraction, markerType = 0): BeatColumn {
    const [bcol, newcreated] = this.ensureBeatColumn(offset, endOffset, markerType);
    if (newcreated) {
      if (markerType == 0) {
        const [prevcol] = this.ensureBeatColumn(offset, endOffset, -1);
        const [nextcol] = this.ensureBeatColumn(offset, endOffset, 1);
        prevcol.gridCol.addSuccessor(bcol.gridCol);
        bcol.gridCol.addSuccessor(nextcol.gridCol);
        for (const other of this.beatColumns.values()) {
          // only join the "marker" columns
          if (other.markerType == -1 && endOffset.equals(other.offset)) {
            // our next col is a preecessor of other
            nextcol.gridCol.addSuccessor(other.gridCol);
          } else if (other.markerType == 1 && other.endOffset.equals(offset)) {
            // our prev col is a predecessor of other
            other.gridCol.addSuccessor(prevcol.gridCol);
          }
        }
      }
    }
    return bcol;
  }
}

/**
 * Manages the beat layouts for *all* lines in a notation.
 */
type LineId = number;
type LPID = number;
export class GlobalBeatLayout {
  gridViewsForLine = new Map<LineId, GridView>();
  layoutParamsForLine = new Map<LineId, LayoutParams>();
  roleBeatsForLine = new Map<LineId, Beat[][]>();
  beatColDAGsByLP = new Map<LPID, BeatColDAG>();

  /**
   * First lines are added to the BeatLayout object.
   * This ensures that a line is broken down into beats and added
   * into a dedicated GridView per line.
   *
   * A line must also be given the layout params by which the beat
   * break down will happen.  This LayoutParams object does not have
   * to be unique per line (this non-constraint allows to align
   * beats across lines!).
   */
  addLine(line: Line, layoutParams: LayoutParams): GridView {
    const gridView = this.getGridViewForLine(line.uuid);
    this.layoutParamsForLine.set(line.uuid, layoutParams);
    /*const roleBeats = */ this.lineToRoleBeats(line, layoutParams);
    return gridView;
  }

  /**
   * Get the GridView associated with a particular line.
   */
  getGridViewForLine(lineid: LineId): GridView {
    let out = this.gridViewsForLine.get(lineid) || null;
    if (!out) {
      out = new GridView();
      this.gridViewsForLine.set(lineid, out);
    }
    return out;
  }

  protected beatColDAGForLP(lpid: LPID): BeatColDAG {
    let out = this.beatColDAGsByLP.get(lpid) || null;
    if (!out) {
      out = new BeatColDAG();
      this.beatColDAGsByLP.set(lpid, out);
    }
    return out;
  }

  protected lineToRoleBeats(line: Line, lp: LayoutParams): Beat[][] {
    const roleBeats = [] as Beat[][];
    this.roleBeatsForLine.set(line.uuid, roleBeats);
    const lineOffset = line.offset.divbyNum(lp.beatDuration);
    for (const role of line.roles) {
      const bb = new BeatsBuilder(role, lp, lineOffset, ...role.atoms);
      roleBeats.push(bb.beats);

      // Add these to the beat layout too
      for (const beat of bb.beats) {
        // beat.ensureUniformSpaces(layoutParams.beatDuration);
        this.addBeat(beat);
      }
    }
    return roleBeats;
  }

  /**
   * Adds the beat to this layout and returns the BeatColumn to which
   * this beat was added.
   */
  protected addBeat(beat: Beat): GridCell {
    // Get the beat column at this index (and line) and add to it.
    const line = beat.role.line;
    const lp = this.layoutParamsForLine.get(line.uuid) as LayoutParams;
    const beatColDAG = this.beatColDAGForLP(lp.uuid);
    const gridView = this.getGridViewForLine(line.uuid) as GridView;
    const [layoutLine, layoutColumn, rowOffset] = lp.getBeatLocation(beat);
    const bcol = beatColDAG.getBeatColumn(rowOffset, beat.endOffset, 0);

    // Since a beat's column has a "pre" and "post" col to, each
    // beat has 3 columns for it
    const roleIndex = beat.role.line.indexOfRole(beat.role.name);
    const realRow = line.roles.length * (layoutLine + Math.floor(beat.index / lp.totalBeats)) + roleIndex;
    const realCol = layoutColumn * 3;
    return gridView.setValue(realRow, realCol, beat, () => {
      const cell = new GridCell(gridView.getRow(realRow), realCol);
      cell.alignCol = bcol.gridCol;
      return cell;
    });
  }
}

export class BeatColumn {
  atomSpacing = 5;
  gridCol: AlignedCol;
  readonly key: string;
  constructor(
    public readonly offset: Fraction,
    public readonly endOffset: Fraction,
    public readonly markerType: number,
  ) {
    offset = offset.factorized;
    endOffset = endOffset.factorized;
    this.key = BeatColumn.keyFor(offset, endOffset, markerType);
  }

  static keyFor(offset: Fraction, endOffset: Fraction, markerType = 0): string {
    offset = offset.factorized;
    endOffset = endOffset.factorized;
    if (markerType < 0) {
      // return the column for the marker "before" this col
      // int his case only the "start offset" is needed and length doesnt matter
      return ":" + offset.toString();
    } else if (markerType > 0) {
      // return the column for the marker "after" this col
      // in this case only thd end offset matters
      return endOffset.toString() + ":";
    } else {
      return offset.toString() + ":" + endOffset.toString();
    }
  }
}
