import * as TSU from "@panyam/tsutils";
import { Atom } from "../../models";
import { Command, RawBlock, Notation } from "./models";
import { parseCycle } from "../utils";
import { LayoutParams } from "../../rendering/Core";
const MarkdownIt = require("markdown-it");

function getLayoutParams(notation: Notation): LayoutParams {
  // See if the snippet already has one then return it
  let layoutParams = null; // snippet.properties.get("layoutParams") || null;
  if (!layoutParams) {
    const ALL_LAYOUT_PARAMS = ["cycle", "layout", "aksharasPerBeat"];
    const params = {} as any;
    for (const param of ALL_LAYOUT_PARAMS) {
      params[param] = notation.properties.get(param.toLowerCase()) || null;
    }
    layoutParams = new LayoutParams(params);
    notation.properties.setone("layoutParams", layoutParams);
  }
  return layoutParams;
}

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
    notation.currentLine.addAtoms(roleDef.name, ...this.atoms);
  }
}

export class SetProperty<V = string> extends Command {
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

// Layouts let us control how lines are rendered going forward
// By default a line when rendered is wrapped at the boundaries
// of a cycle
// Layouts specs are similar to line-dash pattern specification
// in SVG but much simpler.  layout specs (for now) are defined
// as number of bars to show in each line.  Eg a pattern that defines
// [ 3, 4, 5 ]
//
// Would indicate taht a line would be rendered as 3 bars in first line
// 4 bars in the second and 5 bars in the 3 rd line and repeating with
// 3 bars in the fourth line and so on
// An empty array (or value) indicates falling back to the "default"
// layout
//
// Note that this command automatically creates a new line so that
// if the previous line has empty slots in the current cycle then
// it is automatically "closed"

export class CreateLine extends Command {
  applyToNotation(notation: Notation): void {
    notation.newLine();
  }
}

export class CreateRole extends Command {
  applyToNotation(notation: Notation): void {
    // Create the role
    const name = this.getParamAt(0);
    const notesOnly = this.getParam("notes");
    notation.newRole(name, notesOnly == "true" || notesOnly == "yes" || notesOnly == true);
  }
}
