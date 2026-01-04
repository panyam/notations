import * as TSU from "@panyam/tsutils";
import { AtomType, Marker, Group, Line, Atom, Space, Role } from "./";
import { CycleIterator, CyclePosition } from "./cycle";
import { WindowIterator } from "./iterators";
import { LayoutParams } from "./layouts";
import { GridModel, GridRow, GridCell, ColAlign, GridLayoutGroup } from "./grids";
import { Block, BlockItem, isLine, isBlock } from "./notation";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;
const ONE = TSU.Num.Fraction.ONE;

/**
 * Represents a single beat in the notation.
 * A beat contains one or more atoms and has a specific position in a bar.
 */
export class Beat {
  private static idCounter = 0;
  readonly uuid = Beat.idCounter++;
  // Should this be as flat Atoms or should we keep it as atoms and breakdown later?

  /** The atom contained in this beat */
  atom: Atom;
  protected atomIsPlaceholder = false;

  /**
   * Creates a new Beat.
   * @param index The index of this beat in the sequence
   * @param role The role this beat belongs to
   * @param offset The time offset of this beat from the start
   * @param duration The duration of this beat
   * @param barIndex The index of the bar containing this beat
   * @param beatIndex The index of this beat within its bar
   * @param instance The instance number of this beat
   * @param prevBeat The previous beat in the sequence, if any
   * @param nextBeat The next beat in the sequence, if any
   */
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

  /**
   * Returns a debug-friendly representation of this Beat.
   * @returns An object containing debug information
   */
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

  /**
   * Gets the end offset of this beat (offset + duration).
   */
  get endOffset(): Fraction {
    return this.offset.plus(this.duration);
  }

  /**
   * Checks if this beat is filled completely (no remaining space).
   */
  get filled(): boolean {
    return this.remaining.isZero;
  }

  /**
   * Gets the remaining duration available in this beat.
   */
  get remaining(): Fraction {
    return this.atom ? this.duration.minus(this.atom.duration, true) : this.duration;
  }

  /**
   * Adds an atom to this beat.
   * @param atom The atom to add
   * @returns True if the atom was added successfully, false if there's not enough space
   */
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

  /**
   * Gets all markers that should be displayed before this beat.
   * @returns An array of Marker objects
   */
  get preMarkers(): Marker[] {
    const out = [] as Marker[];
    let curr: Atom | null = this.atom;
    while (curr != null) {
      for (const marker of curr.markersBefore || []) {
        out.push(marker);
      }
      if (curr.TYPE == AtomType.GROUP) {
        curr = (curr as Group).atoms.first;
      } else {
        curr = null;
      }
    }
    return out;
  }

  /**
   * Gets all markers that should be displayed after this beat.
   * @returns An array of Marker objects
   */
  get postMarkers(): Marker[] {
    const out = [] as Marker[];
    let curr: Atom | null = this.atom;
    while (curr != null) {
      out.splice(0, 0, ...(curr.markersAfter || []));
      if (curr.TYPE == AtomType.GROUP) {
        curr = (curr as Group).atoms.last;
      } else {
        curr = null;
      }
    }
    return out;
  }
}

/**
 * Builds a sequence of beats from atoms according to layout parameters.
 * Used to convert a flat sequence of atoms into structured beats for display.
 */
export class BeatsBuilder {
  /** All atoms divided into beats */
  readonly beats: Beat[] = [];
  readonly startIndex: number;
  readonly beatOffset: Fraction;
  cycleIter: CycleIterator;
  windowIter: WindowIterator;

  /** Callback for when an atom is added to this role */
  onAtomAdded: (atom: Atom, beat: Beat) => void;

  /** Callback for when a new beat is added */
  onBeatAdded: (beat: Beat) => void;

  /** Callback for when a beat has been filled */
  onBeatFilled: (beat: Beat) => void;

  /**
   * Creates a new BeatsBuilder.
   * @param role The role containing the atoms
   * @param layoutParams Layout parameters for structuring beats
   * @param startOffset The starting offset for the first beat, defaults to ZERO
   * @param atoms Initial atoms to add to the beats
   */
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

  /**
   * Adds atoms to be processed into beats.
   * @param atoms The atoms to add
   */
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

  /**
   * Adds a new beat to the sequence.
   * @returns The newly created beat
   */
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
 * Represents a column of beats in a layout grid.
 * Used for aligning beats vertically in the notation.
 */
export class BeatColumn extends ColAlign {
  /** Spacing between atoms in this column */
  atomSpacing = 5;
  /** Unique key for this column */
  readonly key: string;

  /**
   * Creates a new BeatColumn.
   * @param offset The starting offset of this column
   * @param endOffset The ending offset of this column
   * @param markerType The type of marker for this column (negative: before, positive: after, zero: normal)
   */
  constructor(
    public readonly offset: Fraction,
    public readonly endOffset: Fraction,
    public readonly markerType: number,
  ) {
    super();
    offset = offset.factorized;
    endOffset = endOffset.factorized;
    this.key = BeatColumn.keyFor(offset, endOffset, markerType);
  }

  /**
   * Generates a key for identifying columns with the same offsets and marker type.
   * @param offset The starting offset
   * @param endOffset The ending offset
   * @param markerType The type of marker (negative: before, positive: after, zero: normal)
   * @returns A string key
   */
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

/**
 * Manages the organization of beats into columns based on their offsets.
 * Used to create a directed acyclic graph (DAG) of beat columns for layout purposes.
 *
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
  /** Map of column keys to BeatColumn objects */
  beatColumns = new Map<string, BeatColumn>();

  /**
   * Creates a new BeatColDAG.
   * @param layoutGroup The layout group to associate with this DAG
   */
  constructor(public readonly layoutGroup: GridLayoutGroup) {
    //
  }

  /**
   * Gets the beat column for a given duration at the specified offset.
   * Creates a new column if none exists.
   * @param offset The starting offset
   * @param endOffset The ending offset
   * @param markerType The type of marker
   * @returns The BeatColumn for the specified parameters
   */
  getBeatColumn(offset: Fraction, endOffset: Fraction, markerType = 0): BeatColumn {
    const [bcol, newcreated] = this.ensureBeatColumn(offset, endOffset, markerType);
    if (newcreated) {
      if (markerType == 0) {
        const [prevcol] = this.ensureBeatColumn(offset, endOffset, -1);
        const [nextcol] = this.ensureBeatColumn(offset, endOffset, 1);
        prevcol.addSuccessor(bcol);
        bcol.addSuccessor(nextcol);
        for (const other of this.beatColumns.values()) {
          // only join the "marker" columns
          if (other.markerType == -1 && endOffset.equals(other.offset)) {
            // our next col is a preecessor of other
            nextcol.addSuccessor(other);
          } else if (other.markerType == 1 && other.endOffset.equals(offset)) {
            // our prev col is a predecessor of other
            other.addSuccessor(prevcol);
          }
        }
      }
    }
    return bcol;
  }

  /**
   * Ensures a beat column exists for the given parameters.
   * @param offset The starting offset
   * @param endOffset The ending offset
   * @param markerType The type of marker
   * @returns A tuple containing the column and whether it was newly created
   */
  protected ensureBeatColumn(offset: Fraction, endOffset: Fraction, markerType = 0): [BeatColumn, boolean] {
    const key = BeatColumn.keyFor(offset, endOffset, markerType);
    let bcol = this.beatColumns.get(key) || null;
    const newcreated = bcol == null;
    if (!bcol) {
      bcol = new BeatColumn(offset, endOffset, markerType);
      this.beatColumns.set(key, bcol);
    }
    return [bcol, newcreated];
  }
}

/** Type alias for line IDs */
type LineId = number;
/** Type alias for layout parameter IDs */
type LPID = number;

/**
 * Manages the beat layouts for all lines in a notation.
 * Handles the creation of grid models, positioning of beats, and alignment of beats across lines.
 */
export class GlobalBeatLayout {
  /** Map of line IDs to grid models */
  gridModelsForLine = new Map<LineId, GridModel>();
  /** Map of line IDs to arrays of beats for each role */
  roleBeatsForLine = new Map<LineId, Beat[][]>();
  /** Map of layout parameter IDs to beat column DAGs */
  beatColDAGsByLP = new Map<LPID, BeatColDAG>();
  /** The global layout group for all grid models */
  readonly gridLayoutGroup = new GridLayoutGroup();

  /**
   * Gets the GridModel associated with a particular line, creating one if it doesn't exist.
   * @param lineid The ID of the line
   * @returns The GridModel for the line
   */
  getGridModelForLine(lineid: LineId): GridModel {
    let out = this.gridModelsForLine.get(lineid) || null;
    if (!out) {
      out = new GridModel();
      this.gridLayoutGroup.addGridModel(out);
      this.gridModelsForLine.set(lineid, out);
    }
    return out;
  }

  /**
   * Gets the BeatColDAG for a specific layout parameter ID, creating one if it doesn't exist.
   * @param lpid The layout parameter ID
   * @returns The BeatColDAG for the layout parameters
   */
  protected beatColDAGForLP(lpid: LPID): BeatColDAG {
    let out = this.beatColDAGsByLP.get(lpid) || null;
    if (!out) {
      out = new BeatColDAG(this.gridLayoutGroup);
      this.beatColDAGsByLP.set(lpid, out);
    }
    return out;
  }

  /**
   * Adds a line to the beat layout.
   * This ensures that a line is broken down into beats and added into a dedicated GridModel.
   *
   * A line must also be given the layout params by which the beat breakdown will happen.
   * This LayoutParams object does not have to be unique per line (this non-constraint allows
   * beats to be aligned across lines).
   *
   * @param line The line to add
   */
  addLine(line: Line): void {
    const gridModel = this.getGridModelForLine(line.uuid) as GridModel;
    gridModel.eventHub?.startBatchMode();
    this.lineToRoleBeats(line, gridModel);
    gridModel.eventHub?.commitBatch();
  }

  /**
   * Recursively processes a block and its children to build beat layouts.
   * Uses block.children() to get expanded children (e.g., RepeatBlock expands to N copies).
   *
   * @param block The block to process
   */
  processBlock(block: Block): void {
    for (const child of block.children()) {
      this.processBlockItem(child);
    }
  }

  /**
   * Processes a single block item (Block, Line, or RawBlock).
   *
   * @param item The item to process
   */
  protected processBlockItem(item: BlockItem): void {
    if (isLine(item)) {
      const line = item as Line;
      if (!line.isEmpty && line.layoutParams != null) {
        this.addLine(line);
      }
    } else if (isBlock(item)) {
      this.processBlock(item as Block);
    }
    // RawBlocks are ignored (no beat layout for raw content)
  }

  /**
   * Converts a line into a series of beats for each role.
   * @param line The line to convert
   * @param gridModel The grid model to use
   * @returns Arrays of beats for each role
   */
  protected lineToRoleBeats(line: Line, gridModel: GridModel): Beat[][] {
    const lp = line.layoutParams;
    const roleBeats = [] as Beat[][];
    this.roleBeatsForLine.set(line.uuid, roleBeats);
    const lineOffset = line.offset.divbyNum(lp.beatDuration);
    for (const role of line.roles) {
      const bb = new BeatsBuilder(role, lp, lineOffset, ...role.atoms);
      roleBeats.push(bb.beats);

      // Add these to the beat layout too
      for (const beat of bb.beats) {
        // beat.ensureUniformSpaces(layoutParams.beatDuration);
        this.addBeat(beat, gridModel);
      }
    }
    return roleBeats;
  }

  /**
   * Adds a beat to the layout.
   * @param beat The beat to add
   * @param gridModel The grid model to add the beat to
   * @returns The grid cell containing the beat
   */
  protected addBeat(beat: Beat, gridModel: GridModel): GridCell {
    // Get the beat column at this index (and line) and add to it.
    const line = beat.role.line;
    const lp = line.layoutParams;
    const beatColDAG = this.beatColDAGForLP(lp.uuid);
    const [layoutLine, layoutColumn, rowOffset] = lp.getBeatLocation(beat);
    const colEnd = rowOffset.plus(beat.duration, true);
    const bcol = beatColDAG.getBeatColumn(rowOffset, colEnd, 0);

    // Since a beat's column has a "pre" and "post" col to, each
    // beat has 3 columns for it
    const roleIndex = beat.role.line.indexOfRole(beat.role.name);
    const nthLine = Math.floor(beat.index / lp.totalBeats);
    const realLine = lp.lineBreaks.length * nthLine + layoutLine;
    const realRow = line.roles.length * realLine + roleIndex;
    // pre marker goes on realCol - 1, post marker goes on realCol + 1
    const realCol = 1 + layoutColumn * 3;
    const preMarkers = beat.preMarkers;
    if (preMarkers.length > 0) {
      const val = {
        beat: beat,
        markers: preMarkers,
      };
      const precol = beatColDAG.getBeatColumn(rowOffset, colEnd, -1);
      gridModel.setValue(realRow, realCol - 1, val, (gridRow: GridRow, col: number) => {
        const cell = new GridCell(gridRow, col);
        cell.colAlign = precol;
        return cell;
      });
    }
    const postMarkers = beat.postMarkers;
    if (postMarkers.length > 0) {
      const val = {
        beat: beat,
        markers: postMarkers,
      };
      const postcol = beatColDAG.getBeatColumn(rowOffset, colEnd, 1);
      gridModel.setValue(realRow, realCol + 1, val, (gridRow: GridRow, col: number) => {
        const cell = new GridCell(gridRow, col);
        cell.colAlign = postcol;
        return cell;
      });
    }
    return gridModel.setValue(realRow, realCol, beat, (gridRow: GridRow, col: number) => {
      const cell = new GridCell(gridRow, col);
      cell.colAlign = bcol;
      return cell;
    });
  }
}
