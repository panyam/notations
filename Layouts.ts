import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { Role, FlatAtom, LayoutParams, Beat, BeatsBuilder } from "notations";
import { TimedView, AtomLayout, AtomViewProvider, Embelishment } from "./Core";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

interface AtomView extends TimedView {
  flatAtom: FlatAtom;
  refreshLayout(): void;
}

class TimeSlot {
  protected _x = 0;
  protected paddingLeft = 0;
  protected paddingRight = 0;
  protected _maxWidth = 0;
  views: AtomView[] = [];
  constructor(public readonly offset: Fraction) {}

  get x(): number {
    return this._x;
  }

  set x(val: number) {
    this._x = val;
    const childX = val + this.paddingLeft;
    for (const view of this.views) view.x = childX;
  }

  get maxWidth(): number {
    return this._maxWidth + this.paddingLeft + this.paddingRight;
  }

  setPadding(left: number, right: number): void {
    if (left >= 0) {
      this.paddingLeft = left;
    }
    if (right >= 0) {
      this.paddingRight = right;
    }
  }

  add(atomView: AtomView): boolean {
    // TODO - Should we check if this atom was already added?
    this.views.push(atomView);

    // Calculate its x coord -
    // if (atomView.width > maxWidth)

    // here we need to do a couple of things
    // first set the X value of the atomview if it is not already set
    // second update the max width of this column based on the new
    // addition so all time slots "after" this can be adjusted
    if (atomView.x != this.x) atomView.x = this.x + this.paddingLeft;
    if (this._maxWidth < atomView.bbox.width) {
      this._maxWidth = atomView.bbox.width;
      return true;
    }
    return false;
  }
}

export class UniformAtomLayout extends AtomLayout {
  atomSpacing = 2;
  protected timeSlots: TimeSlot[] = [];

  addAtomView(atomView: AtomView, beat: Beat): void {
    // When we add atom what happens?  Couple of options:
    //
    // We can enforce the constraint that:
    //
    // atomView1.x >= atomView2.x if a1.time >= a2.time

    // An atom's offset alone (+ layout params) should be enough to tell us
    // a couple of things:
    // 1. Which "row" in the layout Line it falls into
    // 2. What is the offset into the timeSlots it falls into
    const [slot, index] = this.getTimeSlot(beat.offset);
    if (slot.add(atomView)) {
      // our gap between time slots is -
      // TSn.x = TS[n - 1].x + TS[n - 1].width + atomSpacing + beatSpacing (n == start of new beat)
      let prevTS = slot;
      for (let i = index + 1; i < this.timeSlots.length; i++) {
        const currTS = this.timeSlots[i];
        currTS.x = prevTS.x + prevTS.maxWidth + this.atomSpacing * 3;
        prevTS = currTS;
      }
    }
    // Add atom's embelishments
    atomView.refreshLayout();
    // embelishments.forEach((emb) => this.embelishments.push(emb));
  }

  /**
   * Find the slot in time of all AtomViews that are placed here.
   * If a slot is not found it is created and returned.
   */
  getTimeSlot(time: Fraction): [TimeSlot, number] {
    let l = 0,
      r = this.timeSlots.length - 1;

    // Special case if we are trying to append at the end instead of inserting
    const ts = this.timeSlots[r] || null;
    if (ts != null && ts.offset.equals(time)) return [ts, r];
    if (ts == null || ts.offset.isLT(time)) {
      // append new TS and return
      const newTS = new TimeSlot(time);
      if (ts != null) {
        newTS.x = ts.x + ts.maxWidth + this.atomSpacing;
      }
      this.timeSlots.push(newTS);
      return [newTS, r + 1];
    }

    while (l <= r) {
      const m = l + ((r - l) >> 1);
      const ts = this.timeSlots[m];
      if (ts.offset.equals(time)) {
        return [ts, m];
      }
      if (ts.offset.isLT(time)) {
        l = m + 1;
      } else {
        r = m - 1;
      }
    }
    // l is our point of insert?
    const newTS = new TimeSlot(time);
    const prevTS = this.timeSlots[l];
    newTS.x = prevTS.x + prevTS.maxWidth + this.atomSpacing;
    this.timeSlots.splice(l, 0, newTS);
    return [newTS, l];
  }
}

/**
 * Problem with the UniformAtomLayout above is that while we have global
 * alignment widths not being uniform could throw bar level alignment out of
 * whack.
 *
 * For example consider the following two roles:
 *
 * Sw: R , G ,
 * Sh: Evv , va, ,
 *
 * By aligning at the "time" level the "Evv" would push out the space after
 * the "R" in the Swaram role.   We could do things like change fonts etc but
 * that is too much fiddling, when all that is needed is for only bars to be
 * aligned, eg the following is a more aesthetically look too (with center
 * justification):
 *
 * |   R , G ,  |...
 * | Evv , va , |
 *
 * or as below (with full justification):
 *
 * | R  ,   G , |
 * | Evv , va , |
 */
export class BarLayout extends AtomLayout {
  beatSpacing = 20;
  beatSlots: BeatColumn[][] = [];

  constructor(public readonly layoutParams: LayoutParams, public readonly atomViewProvider: AtomViewProvider) {
    super(layoutParams, atomViewProvider);
    this.beatSlots = layoutParams.beatLayouts.map((beatLayout, layoutLine) => {
      const beatSlot: BeatColumn[] = [];
      let off = ZERO;
      beatLayout.forEach((beat) => {
        const dur = beat[1];
        beatSlot.push(new BeatColumn(off, dur));
        off = off.plus(dur);
      });
      return beatSlot;
    });
  }

  getBeatColumn(lineIndex: number, offset: Fraction): [BeatColumn, number] {
    offset = offset.mod(this.layoutParams.totalLayoutDuration);
    for (let i = 0; i < this.beatSlots[lineIndex].length; i++) {
      const curr = this.beatSlots[lineIndex][i];
      const endDur = curr.offset.plus(curr.duration);
      let cmp = offset.cmp(curr.offset);
      if (cmp >= 0) {
        cmp = offset.cmp(endDur);
        if (cmp < 0) return [curr, i];
      }
    }
    throw new Error("Beat offset falls outside beat layout range: " + offset.toString());
  }

  protected createBeatsBuilder(role: Role): BeatsBuilder {
    const builder = super.createBeatsBuilder(role);
    builder.onBeatAdded = (beat: Beat) => {
      // Create the bar start/end lines here
      const cycle = this.layoutParams.cycle;
      const bar = cycle.bars[beat.barIndex];
      /*
      if (beat.beatIndex == 0 && beat.barIndex == 0) {
        // first beat in bar - Do a BarStart
        const [lineIndex] = this.layoutParams.getBeatLocation(beat.index);
        const rootElement = this.atomViewProvider.rootElementForBeat(beat);
        const [beatCol] = this.getBeatColumn(lineIndex, beat.offset);
        const beatView = beatCol.viewForBeat(beat);
        const emb = new BeatStartLines(beatView, rootElement);
        this.embelishments.push(emb);
      } else if (beat.beatIndex == bar.beatCount - 1) {
        const [lineIndex] = this.layoutParams.getBeatLocation(beat.index);
        const [beatCol] = this.getBeatColumn(lineIndex, beat.offset);
        const beatView = beatCol.viewForBeat(beat);
        const rootElement = this.atomViewProvider.rootElementForBeat(beat);
        if (beat.barIndex == cycle.bars.length - 1) {
          // last beat in last bar so - do a thalam end (2 lines)
          const emb = new BeatEndLines(beatView, rootElement, 2);
          this.embelishments.push(emb);
        } else {
          // end of a bar so single line end
          const emb = new BeatEndLines(beatView, rootElement);
          this.embelishments.push(emb);
        }
      }
     */
    };
    builder.onBeatFilled = (beat: Beat) => {
      // We create atoms here instead of
      // Instead of creating atoms here we only create them when
      // a beat is filled.  This gives us a chance to do padding etc
      // by looking at all notes "globally"
      //
      // The filling would work is as follows:
      //
      // 1. Initially a beat only contains atoms carved out greedily
      // eg P (3 notes), ma (half note) ga (half note).
      //
      // If we render these 3 notes our bar on paper would look like:
      //
      // | Pa ma ga |
      //
      // as if each of these has even lengths.
      //
      // Instead what we really need is something that looks like:
      //
      // Pa , , , , ,  ma ga
      //
      // Or
      //
      //        _____
      // Pa , , ma ga
      //
      // How can we evaluate when lines are needed and when (and how many) filler spaces are
      // needed?
      //
      // Another case is:
      //
      //      ==== ====
      // Pa , d,nd p,sn
      //
      // The easiest thing here to do is just add as many spaces as required as the LCM of the
      // denominator of all notes.
      //
      // We want a few options:
      //
      // 1. User must be able to override this when makes sense.  For example if P , M G is what
      // the user wanted we dont want to do something like P , , , m , g , etc.
      //
      // 2. Ideally we want to minimize the number of atoms created but not to the point where P , M G
      //           ___
      // becomes P M G.
      //
      // 3. We shouldnt remove spaces that user has provided where possible
      //
      // The other factor we can use is the aksharasPerBeat.  The aksharas per beat can be used
      // to see if we can suppress certain spaces.  eg if aksharasPerBeat == 4 and we have P , M ,
      // all is fine.  But if APB is 2 then P , M , can be written as P M omitting the two spaces.
      // Start with option 1 - add paces based on LCM of all duration denominators
      beat.ensureUniformSpaces(this.layoutParams.aksharasPerBeat);
      for (const flatAtom of beat.atoms) {
        const atomView = this.atomViewProvider.createAtomView(beat, flatAtom, null);
        this.addAtomView(atomView, beat);
      }
    };
    /*
    builder.onAtomAdded = (flatAtom: FlatAtom, beat: Beat) => {
      // console.log("Adding Flat Atom: ", flatAtom);
      const atomView = this.atomViewProvider.createAtomView(beat, flatAtom, null);
      this.addAtomView(atomView, beat);
    };
   */
    return builder;
  }

  addAtomView(atomView: AtomView, beat: Beat): void {
    const [, lineIndex] = this.layoutParams.getBeatLocation(beat);
    const [beatCol, beatIndex] = this.getBeatColumn(lineIndex, beat.offset);

    const changedBeatView = beatCol.add(beat, atomView);
    if (changedBeatView) {
      // width changed so move those after this beat out
      // our gap between time slots is -
      // TSn.x = TS[n - 1].x + TS[n - 1].width + atomSpacing + beatSpacing (n == start of new beat)
      // But there is a problem here - addition of atoms usually happens left to
      // right but we want to layout columns at a time.  What we want is batching
      // the changes so we can kick off layout of an entire column in one go
      // instead instead of "pushing things" again and again.
      // Note that column size has changed so we can use this layout when the
      // next layout event happens.  This helps us batch view size changes
      // keep this beatView in the list of changed beatViews (in the laout refresh
      // we can calculate other dependant views from this).
      this.markBeatViewChanged(changedBeatView, beatIndex, lineIndex);
    }
    // Add atom's embelishments
    atomView.refreshLayout(); // embelishments.forEach((emb) => this.embelishments.push(emb));
  }

  // Instnat update ensures that layout happens every time any beat changes in size.
  // otherwise we ensure batching occurs
  instantUpdate = true;
  changedBeatViews = new Map<number, BeatView>();
  markBeatViewChanged(beatView: BeatView, beatIndex: number, lineIndex: number): void {
    if (this.instantUpdate) {
      for (let i = beatIndex; i < this.beatSlots[lineIndex].length; i++) {
        const currSlot = this.beatSlots[lineIndex][i];
        if (i == 0) {
          currSlot.x = 0;
        } else {
          const prevSlot = this.beatSlots[lineIndex][i - 1];
          currSlot.x = prevSlot.x + prevSlot.maxWidth + this.beatSpacing * 2;
        }
      }
    } else {
      this.changedBeatViews.set(beatView.uuid, beatView);
    }
  }
}

class BeatView {
  private static idCounter = 0;
  readonly uuid = BeatView.idCounter++;
  views: AtomView[] = [];
  protected minY = 0;
  protected maxHeight = 0;
  constructor(public readonly beatCol: BeatColumn, public readonly beat: Beat) {}

  get bbox(): TSV.BBox {
    return { x: this.beatCol.x, y: this.minY, width: this.beatCol.maxWidth, height: this.maxHeight };
  }

  add(atomView: AtomView): void {
    const bb = atomView.bbox;
    this.views.push(atomView);
    this.minY = Math.min(this.minY, bb.y);
    this.maxHeight = Math.max(this.maxHeight, bb.height);
  }

  layout(): void {
    const startX = this.beatCol.x + this.beatCol.paddingLeft;

    // All our atoms have to be laid out between startX and endX
    let currX = startX;
    this.views.forEach((av) => {
      av.x = currX;
      currX += av.bbox.width + this.beatCol.atomSpacing;
    });
  }

  get requiredWidth(): number {
    return (
      this.views.reduce((total, view) => total + view.bbox.width, 0) + this.beatCol.atomSpacing * this.views.length
    );
  }
}

class BeatColumn {
  protected _x = 0;
  protected _maxWidth = 0;
  atomSpacing = 5;
  paddingLeft = 20;
  paddingRight = 0;
  lines = new Map<string, BeatView>();
  constructor(public readonly offset: Fraction, public readonly duration: Fraction) {}

  get x(): number {
    return this._x;
  }

  set x(val: number) {
    this._x = val;
    this.layoutViews();
  }

  get maxWidth(): number {
    return this._maxWidth + this.paddingLeft + this.paddingRight;
  }

  /**
   * Re-lays out atom views in each line based on the beat's
   * latest X and Width values.
   */
  layoutViews(): void {
    this.lines.forEach((beat) => beat.layout());
  }

  setPadding(left: number, right: number): void {
    if (left >= 0) {
      this.paddingLeft = left;
    }
    if (right >= 0) {
      this.paddingRight = right;
    }
  }

  viewForBeat(beat: Beat): BeatView {
    const key = beat.role.uuid + ":" + beat.index;
    if (!this.lines.has(key)) {
      // how to get the bar and beat index for a given beat in a given row?
      const b = new BeatView(this, beat);
      // Check if this needs bar start/end lines?
      this.lines.set(key, b);
      return b;
    }
    return this.lines.get(key)!;
  }

  /**
   * Adds a new beat to this column.
   * Returns true if the column's width has increased.  This is an indicator
   * to the caller that a layout of all other views in this column is needed
   * so the refresh can be scheduled at some time.
   */
  add(beat: Beat, atomView: AtomView): BeatView | null {
    // Find line this view should be added to.
    // TODO - Should we check if this atom was already added?
    const beatView = this.viewForBeat(beat);
    beatView.add(atomView);

    const lineWidth = beatView.requiredWidth;
    if (lineWidth > this._maxWidth) {
      this._maxWidth = lineWidth;
      return beatView;
      // return true;
    } else {
      // Our width is already less than max width so apply layout
      // on this line only - ie the "entire" beat column does not need
      // an update.
      beatView.layout();
    }
    return null;
  }
}
