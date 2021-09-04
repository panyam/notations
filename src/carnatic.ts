import { Note } from "./core";

export enum GamakaType {
  // Kampitam (~)
  // The oscilation between 2 notes - eg p , S..n S..n S..n
  Kampitham,

  // Nokku (w)
  Nokku,

  // Spuritham (∴ / u+2234) - Stress on the second note of a jantai
  Spuritham,

  // Prathyagatham (∵ / u+2235) - Similar to reverse of Spuritham (in descending order)
  Prathyagatham,

  // Raavi (^)
  Aahaatam_Ravi,

  // Kandippu (✓)
  // eg - Shankarabharanam's S. ,,, n , P ,,,  - where the n is subtle
  Aahaatam_Kandippu,

  // Vali (⌒ - U+2312)
  Vali,

  // Odukkal (x):
  // A veena gamakam where the note itself is stretched more to get the next
  // note effect (instead of plucking the next note itself).
  // Not possible where plucking of strings is not possible.
  // On voice etc it just will sound like an Eetra Jaaru.
  Odukkal,

  // (/) Ascension from one note to another - eg S / P
  Jaaru_Eetra,

  // (\) Descending from one note to another - eg P \ S
  Jaaru_Irakka,

  // Orikkai (γ)
  // eg S~~ RN N~~S.D  D~~~NP
  Orikkai,
}

export class Gamaka {
  constructor(public readonly type: GamakaType) {}
}

export class Jaaru extends Gamaka {
  constructor(public readonly ascending = true, public readonly startingNote: null | Note = null) {
    super(ascending ? GamakaType.Jaaru_Eetra : GamakaType.Jaaru_Irakka);
  }
}
