import * as TSU from "@panyam/tsutils";
import { TimedEntity } from "./entity";
import { Atom, LeafAtom, Space, Group, AtomType } from "./core";

type Fraction = TSU.Num.Fraction;
// type FlatAtom2 = [atom: Atom, duration: TSU.Num.Fraction, offset: TSU.Num.Fraction];

/**
 * Represents a flattened atom with timing information.
 * FlatAtom is used to process nested atom structures in a flat, sequential manner
 * with proper timing information.
 */
export class FlatAtom extends TimedEntity {
  readonly TYPE = "FlatAtom";

  /** Nesting depth of this atom in the original structure */
  depth: number;

  /** Duration of this atom */
  duration: TSU.Num.Fraction;

  /** Time offset of this atom */
  offset: TSU.Num.Fraction;

  /** Whether this atom is a continuation of a previous atom */
  private isContinuation: boolean;

  /**
   * Creates a new FlatAtom.
   * @param atom The leaf atom this flat atom represents
   * @param config Optional configuration with depth, duration, offset, and continuation info
   */
  constructor(
    public atom: LeafAtom,
    config: any = null,
  ) {
    super((config = config || {}));
    this.depth = config.depth || 0;
    this.duration = config.duration || atom.duration;
    this.offset = config.offset || TSU.Num.Fraction.ZERO;
    this.isContinuation = "isContinuation" in config ? config.isContinuation : false;
  }

  /**
   * Gets the end offset of this atom (offset + duration).
   */
  get endOffset(): TSU.Num.Fraction {
    return this.offset.plus(this.duration);
  }

  /**
   * Returns a debug-friendly representation of this FlatAtom.
   * @returns An object containing debug information
   */
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
 * in an in-order traversal, thus ensuring time order of atoms.
 */
export class AtomIterator {
  private atomQueue = new TSU.Lists.List<[Atom, number, Fraction]>();
  private currOffset = TSU.Num.Fraction.ZERO;
  private peeked: TSU.Nullable<FlatAtom> = null;

  /**
   * Creates a new AtomIterator with optional initial atoms.
   * @param atoms Initial atoms to iterate through
   */
  constructor(...atoms: Atom[]) {
    this.push(...atoms);
  }

  /**
   * Push atoms to be flattened and served by this iterator.
   * @param atoms The atoms to add to the queue
   * @returns This iterator instance for method chaining
   */
  push(...atoms: Atom[]): this {
    for (const atom of atoms) {
      this.atomQueue.add([atom, 0, atom.duration]);
    }
    return this;
  }

  /**
   * Gets the next atom in the sequence and advances the iterator.
   * @returns The next FlatAtom, or null if no more atoms are available
   */
  next(): TSU.Nullable<FlatAtom> {
    const out = this.peek();
    this.peeked = null;
    if (out != null) {
      this.currOffset = this.currOffset.plus(out.duration).factorized;
    }
    return out;
  }

  /**
   * Peeks at the next atom without advancing the iterator.
   * @returns The next FlatAtom, or null if no more atoms are available
   */
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

  /**
   * Checks if more atoms are available in this iterator.
   * This may process group atoms to find the next leaf atom.
   */
  get hasNext(): boolean {
    while (this.atomQueue.first != null) {
      // Get from front of queue
      const [nextAtom, nextDepth, nextDuration] = this.atomQueue.first.value;
      if (nextAtom.TYPE != AtomType.GROUP) {
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

  /**
   * Gets the atom with the minimum offset from multiple iterators.
   * @param iterators An array of AtomIterators to compare
   * @returns A tuple containing the index of the selected iterator and its next atom
   */
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

/**
 * An iterator that provides atoms within specified time windows.
 * WindowIterator allows fetching atoms to cover a specific duration,
 * handling the splitting of atoms if necessary.
 */
export class WindowIterator {
  private atomQueue = new TSU.Lists.List<Atom>();
  private currOffset = TSU.Num.Fraction.ZERO;
  private peeked: TSU.Nullable<Atom> = null;

  /**
   * Creates a new WindowIterator with optional initial atoms.
   * @param atoms Initial atoms to iterate through
   */
  constructor(...atoms: Atom[]) {
    this.push(...atoms);
  }

  /**
   * Push atoms to be served by this iterator.
   * @param atoms The atoms to add to the queue
   * @returns This iterator instance for method chaining
   */
  push(...atoms: Atom[]): this {
    for (const atom of atoms) {
      this.atomQueue.add(atom);
    }
    return this;
  }

  /**
   * Gets the next atom in the sequence and advances the iterator.
   * For atoms with participatesInTiming=false, the offset is not advanced.
   * @returns The next Atom, or null if no more atoms are available
   */
  next(): TSU.Nullable<Atom> {
    const out = this.peek();
    this.peeked = null;
    if (out != null && out.participatesInTiming) {
      this.currOffset = this.currOffset.plus(out.duration, true);
    }
    return out;
  }

  /**
   * Peeks at the next atom without advancing the iterator.
   * @returns The next Atom, or null if no more atoms are available
   */
  peek(): TSU.Nullable<Atom> {
    if (this.peeked == null && this.hasMore) {
      this.peeked = this.atomQueue.popFront();
    }
    return this.peeked;
  }

  /**
   * Checks if more atoms are available in this iterator.
   */
  get hasMore(): boolean {
    return !this.atomQueue.isEmpty;
  }

  /**
   * Gets atoms to cover the specified duration.
   *
   * If the number of atoms left in the iterator is 0, an empty list
   * is returned. Otherwise, the duration of atoms returned will cover
   * the given duration even if padding with Space atoms is necessary.
   *
   * Atoms with participatesInTiming=false (like Markers) are returned
   * but don't consume any of the requested duration.
   *
   * @param duration The duration to cover
   * @returns A tuple containing the array of atoms and whether the full duration was filled
   */
  get(duration: TSU.Num.Fraction): [Atom[], boolean] {
    const out: Atom[] = [];
    let remaining = duration;
    while (remaining.isGTNum(0) && this.hasMore) {
      const next = this.next();
      TSU.assert(next != null, "Next cannot be null here");
      out.push(next);

      // Only process timing for atoms that participate in timing
      // Markers and other non-timing atoms are returned without consuming duration
      if (next.participatesInTiming) {
        const spillOver = next.splitAt(remaining);
        remaining = remaining.minus(next.duration);
        if (spillOver != null) {
          // push the spill over to the front of the queue to be
          // picked up on the next "get" call
          this.atomQueue.pushFront(spillOver);
        }
      }
    }
    return [out, remaining.isZero];
  }
}

/**
 * An iterator that provides atoms with specific durations.
 * DurationIterator ensures that atoms fit within specified duration windows,
 * splitting atoms if necessary to fit.
 */
export class DurationIterator {
  private atomIterator: AtomIterator;
  private spillOver: TSU.Nullable<FlatAtom> = null;

  /**
   * Creates a new DurationIterator.
   * @param atomIterator The AtomIterator to use as a source of atoms
   */
  constructor(atomIterator: AtomIterator) {
    this.atomIterator = atomIterator;
  }

  /**
   * Checks if more atoms are available in this iterator.
   */
  get hasMore(): boolean {
    if (this.spillOver != null) {
      return true;
    }
    return this.atomIterator.hasNext;
  }

  /**
   * Gets atoms to cover the specified duration.
   *
   * If the number of atoms left in the iterator is 0, an empty list
   * is returned. Otherwise, the duration of atoms returned will cover
   * the given duration even if padding with Space atoms is necessary.
   *
   * @param duration The duration to cover
   * @returns A tuple containing the array of FlatAtoms and whether the full duration was filled
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
          // Next leaf atom is > duration
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
