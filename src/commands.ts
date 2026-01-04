import * as TSU from "@panyam/tsutils";
import { Atom } from "./core";
import { parseCycle } from "./utils";
import { Command, RawBlock, Notation, MetaData as Meta, BlockItem, Block } from "./notation";

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
   * Applies this command to a block.
   * Adds a raw block to the container.
   */
  applyToBlock(container: Block): void {
    const raw = new RawBlock(this.rawContents);
    container.addBlockItem(raw);
  }
}

/**
 * Command for adding metadata to the notation.
 */
export class MetaData extends Command {
  /**
   * Applies this command to a block.
   * Only works on Notation (metadata is a Notation-specific feature).
   */
  applyToBlock(container: Block): void {
    if (container instanceof Notation) {
      container.addMetaData(this.meta);
    }
    // No-op for non-Notation blocks
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
   * Applies this command to a block.
   * Sets the current role in the container.
   */
  applyToBlock(container: Block): void {
    container.setCurrRole(this.roleName);
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
   * Applies this command to a block.
   * Adds atoms to the current line in the container.
   */
  applyToBlock(container: Block): void {
    let roleDef = container.currRoleDef;
    if (roleDef == null) {
      // By default create a role for swaras
      roleDef = container.newRoleDef("Sw", true);
    }
    // Get or create the current line
    const line = container.currentLine;
    // For Notation, also handle layoutParams
    if (container instanceof Notation) {
      const lpForLine = line.layoutParams;
      if (lpForLine == null) {
        line.layoutParams = container.layoutParams;
      } else {
        TSU.assert(
          lpForLine == container.layoutParams,
          "Layout parameters have changed so a new line should have been started",
        );
      }
    }
    // Add atoms to the line
    line.addAtoms(roleDef.name, roleDef.notesOnly, ...this.atoms);
  }
}

/**
 * Command for creating a new line in the notation.
 */
export class CreateLine extends Command {
  /**
   * Applies this command to a block.
   * Creates a new line in the container.
   */
  applyToBlock(container: Block): void {
    const line = container.newLine();
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
   * Applies this command to a block.
   * Creates a role definition local to the container.
   */
  applyToBlock(container: Block): void {
    const name = this.getParamAt(0);
    container.newRoleDef(name, this.notesOnly);
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
   * Applies this command to a block.
   * Named layouts are Notation-specific; no-op for other blocks.
   */
  applyToBlock(container: Block): void {
    if (container instanceof Notation) {
      const value = this.params[0].value;
      container.ensureNamedLayoutParams(value);
    }
    // No-op for non-Notation blocks (named layouts are Notation-specific)
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
   * Applies this command to a block.
   * Sets the local breaks on the container.
   */
  applyToBlock(container: Block): void {
    container.localBreaks = this.pattern;
    if (container instanceof Notation) {
      container.resetLayoutParams();
    }
  }
}

/**
 * Command for setting the cycle pattern in the layout.
 */
export class SetCycle extends LayoutParamCommand {
  /**
   * Applies this command to a block.
   * Sets the local cycle on the container.
   */
  applyToBlock(container: Block): void {
    const value = this.params[0].value;
    // TODO - move the parsing to validation
    const cycle = parseCycle(value);
    container.localCycle = cycle;
    if (container instanceof Notation) {
      container.resetLayoutParams();
    }
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
   * Applies this command to a block.
   * Sets the local atoms per beat on the container.
   */
  applyToBlock(container: Block): void {
    container.localAtomsPerBeat = this.beatDuration;
    if (container instanceof Notation) {
      container.resetLayoutParams();
    }
  }
}

/**
 * Command for creating a named section in the notation.
 * Sections are organizational blocks with a name that can be displayed as headers.
 *
 * Usage: \section("Pallavi") { ... }
 */
export class Section extends Command {
  /**
   * Gets the name of the section.
   */
  get sectionName(): string {
    return this.getParamAt(0) || "";
  }

  /**
   * Validates the parameters for this command.
   * @throws Error if parameters are invalid
   */
  validateParams(): void {
    if (this.params.length < 1 || typeof this.params[0].value !== "string") {
      throw new Error("section command must contain a string name");
    }
  }

  /**
   * Applies this command to a block.
   * No-op: SectionBlock handles the section behavior.
   */
  applyToBlock(_container: Block): void {
    // SectionBlock handles section semantics
  }
}

/**
 * Command for creating a grouping/scope block without specific semantics.
 * Groups are useful for visually organizing notation or applying shared properties.
 *
 * Usage: \group("optional-name") { ... }
 */
export class ScopedGroup extends Command {
  /**
   * Gets the optional name of the group.
   */
  get groupName(): string {
    return this.getParamAt(0) || "";
  }

  /**
   * Applies this command to a block.
   * No additional properties to set for basic groups.
   */
  applyToBlock(_container: Block): void {
    // No additional properties
  }
}

/**
 * Command for creating a repeated section in the notation.
 * Repeats can specify a count for how many times the content should repeat.
 *
 * Usage: \repeat(2) { ... } or \repeat() { ... } for visual repeat markers
 */
export class Repeat extends Command {
  /**
   * Gets the number of times to repeat.
   * Returns 0 if not specified (meaning visual repeat markers only).
   */
  get count(): number {
    const count = this.getParamAt(0);
    if (typeof count === "number") {
      return count;
    }
    return 0;
  }

  /**
   * Validates the parameters for this command.
   * @throws Error if parameters are invalid
   */
  validateParams(): void {
    if (this.params.length > 0) {
      const count = this.params[0].value;
      if (typeof count !== "number" || count < 0) {
        throw new Error("repeat command count must be a non-negative number");
      }
    }
  }

  /**
   * Applies this command to a block.
   * No-op: RepeatBlock handles the repeat behavior.
   */
  applyToBlock(_container: Block): void {
    // RepeatBlock handles repeat semantics
  }
}
