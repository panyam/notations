import * as TSU from "@panyam/tsutils";
import { TimedEntity } from "./entity";
import { Atom, LeafAtom, Space, Group, AtomType } from "./core";

type Fraction = TSU.Num.Fraction;

type FlatAtom2 = [atom: Atom, duration: TSU.Num.Fraction, offset: TSU.Num.Fraction];

export class FlatAtom extends TimedEntity {
  depth: number;
  duration: TSU.Num.Fraction;
  offset: TSU.Num.Fraction;
  private isContinuation: boolean;

  constructor(public atom: LeafAtom, config: any = null) {
    super((config = config || {}));
    this.depth = config.depth || 0;
    this.duration = config.duration || atom.duration;
    this.offset = config.offset || TSU.Num.Fraction.ZERO;
    this.isContinuation = "isContinuation" in config ? config.isContinuation : false;
  }

  /**
   * Returns the type of this Entity.
   */
  get type(): unknown {
    return "FlatAtom";
  }

  get endOffset(): TSU.Num.Fraction {
    return this.offset.plus(this.duration);
  }

  debugValue(): any {
    const out = {
      ...super.debugValue(),
      atom: this.atom.debugValue(),
      duration: this.duration.toString(),
      offset: this.offset.toString(),
      depth: this.depth,
    };
    if (this.isContinuation) out.isContinuation = true;
    return out;
  }
}

/**
 * A nested atom iterator that returns one atom at a time at the leaf-most level.
 * If we have a Group (or nested Groups) only the leaf atoms are returned as if
 * in an in order traversal thus ensuring time order of atoms.
 */
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
      this.currOffset = this.currOffset.plus(out.duration).factorized;
    }
    return out;
  }

  peek(): TSU.Nullable<FlatAtom> {
    if (this.peeked == null) {
      if (this.hasNext) {
        const [nextAtom, nextDepth, nextDuration] = this.atomQueue.popFront();
        this.peeked = new FlatAtom(nextAtom as LeafAtom, {
          depth: nextDepth,
          offset: this.currOffset,
          duration: nextDuration,
        });
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
            nextDuration.times(child.duration).divby(group.totalChildDuration).factorized,
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

export class WindowIterator {
  private atomQueue = new TSU.Lists.List<Atom>();
  private currOffset = TSU.Num.Fraction.ZERO;
  private peeked: TSU.Nullable<Atom> = null;

  constructor(...atoms: Atom[]) {
    this.push(...atoms);
  }

  /**
   * Push atoms to be flattened and served by this iterator.
   */
  push(...atoms: Atom[]): this {
    for (const atom of atoms) {
      this.atomQueue.add(atom);
    }
    return this;
  }

  next(): TSU.Nullable<Atom> {
    const out = this.peek();
    this.peeked = null;
    if (out != null) {
      this.currOffset = this.currOffset.plus(out.duration, true);
    }
    return out;
  }

  peek(): TSU.Nullable<Atom> {
    if (this.peeked == null && this.hasMore) {
      this.peeked = this.atomQueue.popFront();
    }
    return this.peeked;
  }

  get hasMore(): boolean {
    return !this.atomQueue.isEmpty;
  }

  /**
   * Gets the atoms to cover the given duration.
   *
   * If the number of atoms left in the iterator is 0 then an empty list
   * is returned.  Otherwise the duration of atoms returned will cover
   * the given duration even if padding with Space atoms is necessary.
   */
  get(duration: TSU.Num.Fraction): [Atom[], boolean] {
    const out: Atom[] = [];
    let remaining = duration;
    while (remaining.isGTNum(0) && this.hasMore) {
      const next = this.next();
      TSU.assert(next != null, "Next cannot be null here");
      out.push(next);
      const spillOver = next.splitAt(remaining);
      remaining = remaining.minus(next.duration);
      if (spillOver != null) {
        // push the spill over to the front of the queue to be
        // picked up on the next "get" call
        this.atomQueue.pushFront(spillOver);
      }
    }
    return [out, remaining.isZero];
  }
}

/**
 * Duration Iterators take a tree of Atoms and return atoms in given windowed
 * durations.  This also ensures that a leaf atom can be further split if it is
 * larger than the required duration.
 */
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
