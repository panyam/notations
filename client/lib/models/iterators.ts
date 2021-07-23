import * as TSU from "@panyam/tsutils";
import { CycleIterator, TimedEntity, Atom, Role, LeafAtom, Space, Group, AtomType, Cycle } from "./";

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

export class FlatAtom extends TimedEntity {
  depth: number;
  duration: TSU.Num.Fraction;
  offset: TSU.Num.Fraction;
  constructor(public readonly atom: LeafAtom, config: any = null) {
    super((config = config || {}));
    this.depth = config.depth || 0;
    this.duration = config.duration || atom.duration;
    this.offset = config.offset || TSU.Num.Fraction.ZERO;
  }

  get endOffset(): TSU.Num.Fraction {
    return this.offset.plus(this.duration);
  }
}

export class AtomIterator {
  private atomQueue = new TSU.Lists.List<[Atom, number, Fraction]>();
  private currOffset = TSU.Num.Fraction.ZERO;
  private peeked: TSU.Nullable<FlatAtom> = null;

  constructor(...atoms: Atom[]) {
    this.push(...atoms);
  }

  /**
   * Push atoms to be flattened and served by this iterator.
   */
  push(...atoms: Atom[]): this {
    for (const atom of atoms) {
      this.atomQueue.add([atom, 0, atom.duration]);
    }
    return this;
  }

  next(): TSU.Nullable<FlatAtom> {
    const out = this.peek();
    this.peeked = null;
    if (out != null) {
      this.currOffset = this.currOffset.plus(out.duration);
    }
    return out;
  }

  peek(): TSU.Nullable<FlatAtom> {
    if (this.peeked == null) {
      if (this.hasNext) {
        const [nextAtom, nextDepth, nextDuration] = this.atomQueue.popFront();
        this.peeked = new FlatAtom(nextAtom, { depth: nextDepth, offset: this.currOffset, duration: nextDuration });
      }
    }
    return this.peeked;
  }

  get hasNext(): boolean {
    while (this.atomQueue.first != null) {
      // Get from front of queue
      const [nextAtom, nextDepth, nextDuration] = this.atomQueue.first.value;
      if (nextAtom.type != AtomType.GROUP) {
        return true;
      } else {
        this.atomQueue.popFront();
        const group = nextAtom as Group;
        for (const child of group.atoms.reversedValues()) {
          this.atomQueue.pushFront([
            child,
            nextDepth + 1,
            nextDuration.times(child.duration).divby(group.totalChildDuration),
          ]);
        }
      }
    }
    return false;
  }

  static getMin(iterators: AtomIterator[]): [number, FlatAtom] {
    let currRole = -1;
    let currAtom: TSU.Nullable<FlatAtom> = null;
    for (let ri = 0; ri < iterators.length; ri++) {
      const flatAtom = iterators[ri].peek();
      if (flatAtom != null) {
        if (currAtom == null || flatAtom.offset.cmp(currAtom.offset) < 0) {
          currRole = ri;
          currAtom = flatAtom;
        }
      }
    }
    if (currRole >= 0) {
      iterators[currRole].next();
    }
    return [currRole, currAtom!];
  }
}

export class DurationIterator {
  private atomIterator: AtomIterator;
  private spillOver: TSU.Nullable<FlatAtom> = null;

  constructor(atomIterator: AtomIterator) {
    this.atomIterator = atomIterator;
  }

  get hasMore(): boolean {
    if (this.spillOver != null) {
      return true;
    }
    return this.atomIterator.hasNext;
  }

  /**
   * Gets the atoms to cover the given duration.
   *
   * If the number of atoms left in the iterator is 0 then an empty list
   * is returned.  Otherwise the duration of atoms returned will cover
   * the given duration even if padding with Space atoms is necessary.
   */
  get(duration: TSU.Num.Fraction): [FlatAtom[], boolean] {
    const iter = this.atomIterator;
    const out: FlatAtom[] = [];
    let remaining = duration;
    while (remaining.isGTNum(0)) {
      const next = this.spillOver == null ? iter.next() : this.spillOver;
      this.spillOver = null;
      if (next == null) {
        // stop here
        break;
      } else {
        out.push(next);
        if (next.duration.cmp(remaining) <= 0) {
          remaining = remaining.minus(next.duration);
        } else {
          // Next leaf atm is > duration
          // so split it into two
          this.spillOver = new FlatAtom(new Space(next.duration.minus(remaining)));
          next.duration = remaining;
          remaining = TSU.Num.Fraction.ZERO;
        }
      }
    }
    return [out, remaining.isZero];
  }
}

export class Beat {
  readonly atoms: FlatAtom[] = [];
  constructor(
    public readonly index: number,
    public readonly role: Role,
    public readonly offset: Fraction,
    public readonly duration: Fraction,
    public readonly barIndex: number,
    public readonly beatIndex: number,
  ) {}

  get endOffset(): Fraction {
    return this.offset.plus(this.duration);
  }

  get filled(): boolean {
    return this.remaining.isZero;
  }

  get remaining(): Fraction {
    return this.duration.minus(this.atoms.reduce((a, b) => a.plus(b.duration), ZERO));
  }

  add(atom: FlatAtom): boolean {
    if (this.remaining.cmp(atom.duration) < 0) {
      return false;
    }
    this.atoms.push(atom);
    return true;
  }
}

export class BeatsBuilder {
  // All atoms divided into beats
  readonly beats: Beat[] = [];
  cycleIter: CycleIterator;
  atomIter: AtomIterator;
  durIter: DurationIterator;

  // Callback for when an atom is added to this role.
  onAtomAdded: (flatAtom: FlatAtom, beat: Beat) => void;

  // Callback for when a new beat is added
  onBeatAdded: (beat: Beat) => void;

  constructor(public readonly role: Role, public readonly cycle: Cycle, public readonly aksharasPerBeat = 1) {
    this.cycleIter = cycle.iterateBeats();
    this.atomIter = new AtomIterator();
    this.durIter = new DurationIterator(this.atomIter);
  }

  protected addBeat(): Beat {
    const numBeats = this.beats.length;
    const lastBeat = numBeats == 0 ? null : this.beats[numBeats - 1];
    const nextCP = this.cycleIter.next().value;
    const newBeat = new Beat(
      numBeats,
      this.role,
      lastBeat == null ? ZERO : lastBeat.endOffset,
      nextCP[0].timesNum(this.aksharasPerBeat),
      nextCP[1],
      nextCP[2],
    );
    this.beats.push(newBeat);
    if (this.onBeatAdded) this.onBeatAdded(newBeat);
    return newBeat;
  }

  addAtoms(...atoms: Atom[]): void {
    // First add all atoms to the atom Iterator so we can
    // fetch them as FlatAtoms.  This is needed because atoms
    // passed here could be unflatted (via groups) or much larger
    // than what can fit in the given role/bar etc.  So this
    // flattening and windowing is needed before we add them
    // to the views - and this is done by the durationIterators.
    this.atomIter.push(...atoms);

    if (this.beats.length == 0) {
      this.addBeat();
    }

    let hasMore = true;
    while (hasMore) {
      // get the last/current row and add a new one if it is full
      let currBeat = this.beats[this.beats.length - 1];

      // First add a row if last row is filled
      if (currBeat.filled) {
        // what should be the beatlengths be here?
        currBeat = this.addBeat();
      }

      // For this beat get symbols in all roles
      const [flatAtoms, filled] = this.durIter.get(currBeat.remaining);
      hasMore = flatAtoms.length > 0; // && !filled;
      if (hasMore) {
        // render the atoms now
        for (const flatAtom of flatAtoms) {
          TSU.assert(currBeat.add(flatAtom), "Should return true as we are already using a duration iterator here");
          if (this.onAtomAdded) this.onAtomAdded(flatAtom, currBeat);
        }
      }
    }
  }
}
