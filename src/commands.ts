import * as TSU from "@panyam/tsutils";
import { Atom } from "./core";
import { parseCycle } from "./utils";
import { Command, RawBlock, Notation, MetaData as Meta } from "./notation";

export class RawEmbedding extends Command {
  get rawContents(): string {
    return this.getParamAt(0);
  }

  applyToNotation(notation: Notation): void {
    const raw = new RawBlock(this.rawContents);
    notation.addRawBlock(raw);
  }
}

export class MetaData extends Command {
  // Called when running in execution mode
  applyToNotation(notation: Notation): void {
    // Create the role - ensure that we have a role
    notation.addMetaData(this.key, this.meta);
  }

  get meta(): Meta {
    const out = new Meta(this.key, this.value);
    return out;
  }

  get key(): string {
    return this.getParamAt(0);
  }

  get value(): string {
    return this.getParamAt(1);
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
    return {
      name: this.name,
      index: this.index,
      atoms: this.atoms.map((a) => a.debugValue()),
    };
  }

  applyToNotation(notation: Notation): void {
    const roleDef = notation.currRoleDef;
    if (roleDef == null) {
      throw new Error("Current role is invalid");
    }
    // Ensure a line exists
    const lpForLine = notation.layoutParamsForLine(notation.currentLine);
    if (lpForLine == null) {
      notation.setLayoutParamsForLine(notation.currentLine, notation.layoutParams);
    } else {
      TSU.assert(
        lpForLine == notation.layoutParams,
        "Layout parameters have changed so a new line should have been started",
      );
    }
    const finalised = this.atoms;
    notation.currentLine.addAtoms(roleDef.name, roleDef.notesOnly, ...finalised);
  }
}

export class CreateLine extends Command {
  applyToNotation(notation: Notation): void {
    // We are not calling a newLine here just to avoid
    // a series of \line commands creating wasteful empty lines
    // TODO - how do we consider offsets in line create
    const line = notation.newLine();
    line.offset = this.offset;
  }

  get offset(): TSU.Num.Fraction {
    let offset = this.getParam("offset") || TSU.Num.Fraction.ZERO;
    if (typeof offset === "number") offset = new TSU.Num.Fraction(offset);
    return offset;
  }
}

export class CreateRole extends Command {
  applyToNotation(notation: Notation): void {
    // Create the role
    const name = this.getParamAt(0);
    notation.newRoleDef(name, this.notesOnly);
  }

  get notesOnly(): boolean {
    const notesOnly = this.getParam("notes");
    return notesOnly == "true" || notesOnly == "yes" || notesOnly == true;
  }
}

export abstract class LayoutParamCommand extends Command {}

/**
 * Saves the current layout with the given name.
 * Typically users can change layout params (currently cycle, APB and line layout)
 * with the \cycle, \layout and \aksharasPerBeat commands.  Each time these are
 * changed, the current layout params is set to null.   So the next time layout
 * params are needed we look at saved layout params and search by by the unique
 * combination of cycle, apb and line layout.  This prevetns users from creating
 * too many layouts with the same config.   Each layout is associated with an
 * AtomLayout instance.
 *
 * For example consider this:
 *
 * \apb(4)
 * \breaks(4)
 * \cycle("|4|2|2|")
 * \apb(5)
 * \breaks(3)
 *
 * In all these cases LayoutParams are *not* created.  Instead they are reset to null.
 *
 *
 * When we do an AddAtoms command, this is where a LineView is created and along with this
 * a layoutParams is created taking the latest state of the layout params resulting an
 * LP (instance id = 1) of (layout = 3, cycle = "4|2|2", apb = 5)
 *
 * Now after this say we had the following commands:
 *
 * \cycle(x)
 * \cycle(|4|2|2)
 * \apb(10)
 * \apb(5)
 *
 * Sw: a b c
 *
 * Here again since the LP was set to null, "creating" layout params results in returning
 * the LP created previously (at the end of these commands the cycle, apb and layout params
 * are the same).
 *
 * eg doing
 *
 * \layout("layout1")
 *
 * This ensures that a *new* LP instance is created (even if another one exists with the same
 * apb, cycle, layout combo).  This allows us to group different sectiosn that are identical
 * in layout but to be processed by different atom layouts.
 *
 * To use a saved layout simply do:
 *
 * \layout("layout")
 *
 * Note the use and saving commands are same - as we cannot override existing
 * layouts so referring to it the first time creates and saves it too
 */
export class ApplyLayout extends Command {
  validateParams(): void {
    if (this.params.length != 1 || typeof this.params[0].value !== "string") {
      throw new Error("layout command must contain one string argument");
    }
  }

  applyToNotation(notation: Notation): void {
    const value = this.params[0].value;
    notation.ensureNamedLayoutParams(value);
  }
}

/**
 * Allows use (and creation) of layouts.
 */
export class SetBreaks extends LayoutParamCommand {
  get pattern(): number[] {
    return this.params.map((cmd) => cmd.value as number);
  }

  /**
   * called to validate parameters.
   */
  validateParams(): void {
    for (const param of this.params) {
      if (param.key != null) {
        throw new Error("Breaks command cannot have keyword params");
      }
      if (typeof param.value !== "number") {
        throw new Error("Breaks command must be a list of integers");
      }
    }
  }

  applyToNotation(notation: Notation): void {
    notation.currentBreaks = this.pattern;
    notation.resetLayoutParams();
  }
}

export class SetCycle extends LayoutParamCommand {
  applyToNotation(notation: Notation): void {
    const value = this.params[0].value;
    // TODO - move the parsing to validation
    const cycle = parseCycle(value);
    notation.currentCycle = cycle;
    notation.resetLayoutParams();
  }
}

export class SetAPB extends LayoutParamCommand {
  validateParams(): void {
    if (this.params.length != 1 || typeof this.params[0].value !== "number") {
      throw new Error("aksharasPerBeat command must contain one number");
    }
  }

  get aksharasPerBeat(): number {
    return this.params[0].value;
  }

  applyToNotation(notation: Notation): void {
    notation.currentAPB = this.aksharasPerBeat;
    notation.resetLayoutParams();
  }
}
