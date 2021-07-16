import * as TSU from "@panyam/tsutils";
import { TimedEntity, Atom, LeafAtom, Space, Group, AtomType, Cycle } from "./";

type Fraction = TSU.Num.Fraction;

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
