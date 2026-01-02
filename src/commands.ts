import * as TSU from "@panyam/tsutils";
import { Atom } from "./core";
import { parseCycle } from "./utils";
import { Command, RawBlock, Notation, MetaData as Meta } from "./notation";

/**
 * Command for embedding raw content in the notation.
 * This allows including arbitrary raw text blocks (like markdown or HTML) within the notation.
 */
export class RawEmbedding extends Command {
  /**
   * Gets the raw content of this embedding.
   */
  get rawContents(): string {
    return this.getParamAt(0);
  }

  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    const raw = new RawBlock(this.rawContents);
    notation.addRawBlock(raw);
  }
}

/**
 * Command for adding metadata to the notation.
 */
export class MetaData extends Command {
  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    // Create the role - ensure that we have a role
    notation.addMetaData(this.meta);
  }

  /**
   * Gets the metadata object for this command.
   */
  get meta(): Meta {
    const out = new Meta(this.key, this.value);
    return out;
  }

  /**
   * Gets the key for this metadata.
   */
  get key(): string {
    return this.getParamAt(0);
  }

  /**
   * Gets the value for this metadata.
   */
  get value(): string {
    return this.getParamAt(1);
  }
}

/**
 * Command for activating (selecting) a specific role.
 */
export class ActivateRole extends Command {
  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    // Create the role - ensure that we have a role
    notation.setCurrRole(this.roleName);
    // const line = notation.ensureLine();
  }

  /**
   * Gets the name of the role to activate.
   */
  get roleName(): string {
    return this.getParamAt(0);
  }
}

/**
 * Command for adding atoms to the current role.
 */
export class AddAtoms extends Command {
  /** Index of this command in the sequence */
  index: number;
  /** Atoms to add */
  atoms: Atom[];

  /**
   * Creates a new AddAtoms command.
   * @param atoms Atoms to add
   */
  constructor(...atoms: Atom[]) {
    super();
    this.atoms = atoms;
    this.index = 0;
  }

  /**
   * Returns a debug-friendly representation of this command.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return {
      name: this.name,
      index: this.index,
      atoms: this.atoms.map((a) => a.debugValue()),
    };
  }

  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    let roleDef = notation.currRoleDef;
    if (roleDef == null) {
      // By default create a role for swaras
      roleDef = notation.newRoleDef("Sw", true);
      // throw new Error("Current role is invalid");
    }
    // Ensure a line exists
    const lpForLine = notation.currentLine.layoutParams;
    if (lpForLine == null) {
      notation.currentLine.layoutParams = notation.layoutParams;
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

/**
 * Command for creating a new line in the notation.
 */
export class CreateLine extends Command {
  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    // We are not calling a newLine here just to avoid
    // a series of \line commands creating wasteful empty lines
    // TODO - how do we consider offsets in line create
    const line = notation.newLine();
    line.offset = this.offset;
    line.marginText = this.marginText;
  }

  /**
   * Gets the offset for the new line.
   */
  get offset(): TSU.Num.Fraction {
    let offset = this.getParam("offset") || TSU.Num.Fraction.ZERO;
    if (typeof offset === "number") offset = new TSU.Num.Fraction(offset);
    return offset;
  }

  /**
   * Gets the margin text for the new line.
   */
  get marginText(): string {
    if (this.params.length > 0) {
      if (this.params[0].key == null && typeof this.params[0].value === "string") {
        return this.params[0].value.trim();
      }
    }
    return this.getParam("marginText") || "";
  }
}

/**
 * Command for creating a new role in the notation.
 */
export class CreateRole extends Command {
  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    // Create the role
    const name = this.getParamAt(0);
    notation.newRoleDef(name, this.notesOnly);
  }

  /**
   * Gets whether this role should contain only notes (true) or also syllables/text (false).
   */
  get notesOnly(): boolean {
    const notesOnly = this.getParam("notes");
    return notesOnly == "true" || notesOnly == "yes" || notesOnly == true;
  }
}

/**
 * Base class for commands that modify layout parameters.
 */
export abstract class LayoutParamCommand extends Command {}

/**
 * Command for applying a named layout to the notation.
 *
 * Saves the current layout with the given name.
 * Typically users can change layout params (currently cycle, APB and line layout)
 * with the \cycle, \layout and \beatDuration commands. Each time these are
 * changed, the current layout params is set to null. So the next time layout
 * params are needed we look at saved layout params and search by the unique
 * combination of cycle, apb and line layout. This prevents users from creating
 * too many layouts with the same config. Each layout is associated with an
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
  /**
   * Validates the parameters for this command.
   * @throws Error if parameters are invalid
   */
  validateParams(): void {
    if (this.params.length != 1 || typeof this.params[0].value !== "string") {
      throw new Error("layout command must contain one string argument");
    }
  }

  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    const value = this.params[0].value;
    notation.ensureNamedLayoutParams(value);
  }
}

/**
 * Command for setting line breaks in the layout.
 */
export class SetBreaks extends LayoutParamCommand {
  /**
   * Gets the line breaks pattern.
   */
  get pattern(): number[] {
    return this.params.map((cmd) => cmd.value as number);
  }

  /**
   * Validates the parameters for this command.
   * @throws Error if parameters are invalid
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

  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    notation.currentBreaks = this.pattern;
    notation.resetLayoutParams();
  }
}

/**
 * Command for setting the cycle pattern in the layout.
 */
export class SetCycle extends LayoutParamCommand {
  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    const value = this.params[0].value;
    // TODO - move the parsing to validation
    const cycle = parseCycle(value);
    notation.currentCycle = cycle;
    notation.resetLayoutParams();
  }
}

/**
 * Command for setting the beat duration in the layout.
 */
export class SetBeatDuration extends LayoutParamCommand {
  /**
   * Validates the parameters for this command.
   * @throws Error if parameters are invalid
   */
  validateParams(): void {
    if (this.params.length != 1 || typeof this.params[0].value !== "number") {
      throw new Error("beatDuration command must contain one number");
    }
  }

  /**
   * Gets the beat duration value.
   */
  get beatDuration(): number {
    return this.params[0].value;
  }

  /**
   * Applies this command to a notation.
   * @param notation The notation to apply this command to
   */
  applyToNotation(notation: Notation): void {
    notation.currentAPB = this.beatDuration;
    notation.resetLayoutParams();
  }
}
