import * as TSU from "@panyam/tsutils";
import { Literal, Atom, AtomType, Note, Syllable } from "../models";
import { Command, RawBlock, Notation } from "./models";
import { parseCycle } from "../loaders/utils";
import { LayoutParams } from "../rendering/Core";
const MarkdownIt = require("markdown-it");

export class RawEmbedding extends Command {
  applyToNotation(notation: Notation): void {
    notation.add(new RawBlock(this.rawContents));
  }

  get rawContents(): string {
    return this.getParamAt(0);
  }
}

export class ActivateRole extends Command {
  // Called when running in execution mode
  applyToNotation(notation: Notation): void {
    // Create the role - ensure that we have a role
    notation.setCurrRole(this.roleName);
    // const line = notation.ensureLine();
  }

  get roleName(): string {
    return this.getParamAt(0);
  }
}

export class AddAtoms extends Command {
  index: number;
  atoms: Atom[];

  constructor(...atoms: Atom[]) {
    super();
    this.atoms = atoms;
    this.index = 0;
  }

  debugValue(): any {
    return { name: this.name, index: this.index, atoms: this.atoms.map((a) => a.debugValue()) };
  }

  applyToNotation(notation: Notation): void {
    const roleDef = notation.currRole;
    if (roleDef == null) {
      throw new Error("Current role is invalid");
    }
    // Ensure a line exists
    const finalised = this.atoms.map((a) => {
      if (a.type == AtomType.LITERAL) {
        if (roleDef.notesOnly) {
          a = new Note((a as Literal).value, a.duration);
        } else {
          a = new Syllable((a as Literal).value, a.duration);
        }
      }
      return a;
    });
    notation.currentLine.addAtoms(roleDef.name, ...finalised);
  }
}

export class SetProperty extends Command {
  properties: TSU.StringMap<any> = {};

  debugValue(): any {
    return { ...super.debugValue(), ...this.properties };
  }

  applyToNotation(notation: Notation): void {
    // Validate parameters to set
    for (const param of this.params) {
      if (param.key == null) {
        throw new Error("Property must have a valid key");
      }
      const name = param.key;
      let value = param.value;
      if (typeof value === "string") {
        if (name == "cycle") {
          value = parseCycle(value);
        } else if (name == "aksharasPerBeat") {
          if (typeof value !== "number") {
            throw new Error("aksharasPerBeat must be an integer");
          }
        } else if (name == "renderTitles") {
          value = value === "true" || value === "yes";
        } else if (name == "layout") {
          value = TSU.Misc.trimmedSplit(value, " ")
            .map((x) => parseInt(x, 10))
            .filter((x) => !isNaN(x));
        }
      }
      notation.properties.setone(name.toLowerCase(), value);
      this.properties[name] = value;
    }
  }
}

export class CreateLine extends Command {
  applyToNotation(notation: Notation): void {
    notation.newLine();
  }
}

export class CreateRole extends Command {
  applyToNotation(notation: Notation): void {
    // Create the role
    const name = this.getParamAt(0);
    notation.newRole(name, this.notesOnly);
  }

  get notesOnly(): boolean {
    const notesOnly = this.getParam("notes");
    return notesOnly == "true" || notesOnly == "yes" || notesOnly == true;
  }
}
