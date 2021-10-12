import { Note } from "../core";

export enum GamakaType {
  // Kampitam (~)
  // The oscilation between 2 notes - eg p , S..n S..n S..n
  Kampitham = "Kampitham",

  // Nokku (w)
  Nokku = "Nokku",

  // Spuritham (∴ / u+2234) - Stress on the second note of a jantai
  Spuritham = "Spuritham",

  // Prathyagatham (∵ / u+2235) - Similar to reverse of Spuritham (in descending order)
  Prathyagatham = "Prathyagatham",

  // Raavi (^)
  Aahaatam_Raavi = "Raavi",

  // Kandippu (✓)
  // eg - Shankarabharanam's S. ,,, n , P ,,,  - where the n is subtle
  Aahaatam_Kandippu = "Kandippu",

  // Vali (⌒ - U+2312)
  Vaali = "Vaali",

  // Odukkal (x):
  // A veena gamakam where the note itself is stretched more to get the next
  // note effect (instead of plucking the next note itself).
  // Not possible where plucking of strings is not possible.
  // On voice etc it just will sound like an Eetra Jaaru.
  Odukkal = "Odukkal",

  // (/) Ascension from one note to another - eg S / P
  Jaaru_Eetra = "EetraJaaru",

  // (\) Descending from one note to another - eg P \ S
  Jaaru_Irakka = "IrakkaJaaru",

  // Orikkai (γ)
  // eg S~~ RN N~~S.D  D~~~NP
  Orikkai = "Orikkai",
}

export class Gamaka {
  constructor(public readonly type: GamakaType) {}
  debugValue(): any {
    return { type: this.type };
  }
}

export class JaaruGamaka extends Gamaka {
  constructor(public readonly ascending = true, public readonly startingNote: null | Note = null) {
    super(ascending ? GamakaType.Jaaru_Eetra : GamakaType.Jaaru_Irakka);
  }

  debugValue(): any {
    const out = { ...super.debugValue(), ascending: this.ascending };
    if (this.startingNote) out["startingNote"] = this.startingNote.debugValue();
    return out;
  }
}

export function parseEmbelishment(value: string): [any, boolean] {
  value = value.substring(1);
  if (value == "") {
    return [new Gamaka(GamakaType.Kampitham), true];
  } else if (value == "^") {
    return [new Gamaka(GamakaType.Aahaatam_Raavi), true];
  } else if (value == "~") {
    return [new Gamaka(GamakaType.Vaali), true];
  } else if (value == "w" || value == "W") {
    return [new Gamaka(GamakaType.Nokku), true];
  } else if (value == "∴" || value == ":-") {
    return [new Gamaka(GamakaType.Spuritham), true];
  } else if (value == "∵" || value == "-:") {
    return [new Gamaka(GamakaType.Prathyagatham), true];
  } else if (value == "✓" || value == "./" || value == ".\\") {
    return [new Gamaka(GamakaType.Aahaatam_Kandippu), true];
  } else if (value.endsWith("/")) {
    value = value.substring(0, value.length - 1).trim();
    return [new JaaruGamaka(true, value.length > 0 ? new Note(value) : null), true];
  } else if (value.endsWith("\\")) {
    value = value.substring(0, value.length - 1);
    return [new JaaruGamaka(false, value.length > 0 ? new Note(value) : null), true];
  } else if (value == "x") {
    return [new Gamaka(GamakaType.Odukkal), true];
  } else if (value == "γ" || value == "Y") {
    return [new Gamaka(GamakaType.Orikkai), true];
  }
  // throw new Error("Invalid carnatic embelishment: " + value);
  return [null, false];
}
