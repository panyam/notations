/**
 * positions.ts - From the model back to the source.
 *
 * The parser records each atom's place in the source (`Atom.sourceRange`). These helpers walk a
 * notation's atoms, follow a derived atom back to the one the parser made, and find the atom under
 * a caret. An editor uses them to move between its text and the rendered notation, and a player
 * uses the same ranges to show which note is sounding (#102, #75).
 */

import { Atom, Group, Line } from "./core";
import { Block, isBlock, isLine } from "./block";

/**
 * Every atom in `block`, in source order, once each. A group comes before the atoms inside it.
 * A `\repeat` block's lines are visited once, since a repeat plays the same atoms again rather
 * than holding copies.
 */
export function* walkAtoms(block: Block): Generator<Atom> {
  for (const item of block.blockItems) {
    if (isLine(item)) {
      for (const role of (item as Line).roles) yield* walkList(role.atoms);
    } else if (isBlock(item)) {
      yield* walkAtoms(item as Block);
    }
  }
}

function* walkList(atoms: Iterable<Atom>): Generator<Atom> {
  for (const atom of atoms) {
    yield atom;
    if (atom instanceof Group) yield* walkList(atom.atoms.values());
  }
}

/** The atom the parser made that `atom` was derived from, or `atom` itself if it is one. */
export function sourceAtom(atom: Atom): Atom {
  return atom.origin ?? atom;
}

/**
 * The atom whose source covers `offset`, for a caret at that character offset. A caret just after
 * an atom's last character still counts as on it, as editors place a caret after the text it
 * follows. A note inside a group wins over the group. Null when no atom covers the offset, as in a
 * role name, a command or the space between notes.
 */
export function atomAt(block: Block, offset: number): Atom | null {
  let best: Atom | null = null;
  let bestScore: [number, number] | null = null;
  for (const atom of walkAtoms(block)) {
    const r = atom.sourceRange;
    if (!r || offset < r[0] || offset > r[1]) continue;
    // Inside beats touching the end, so "S," with the caret between them picks the comma. Then
    // the shorter range wins, so a note beats the group around it.
    const score: [number, number] = [offset < r[1] ? 0 : 1, r[1] - r[0]];
    if (!bestScore || score[0] < bestScore[0] || (score[0] == bestScore[0] && score[1] < bestScore[1])) {
      best = atom;
      bestScore = score;
    }
  }
  return best;
}
