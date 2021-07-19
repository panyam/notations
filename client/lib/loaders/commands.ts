import * as TSU from "@panyam/tsutils";
import { Atom, Line } from "../models";
import { Snippet, Instruction, Command, Emitter } from "../models/notebook";
import { parseCycle } from "./utils";
import { SnippetView } from "../rendering/SnippetView";
import { LayoutParams } from "../rendering/Layout";

const ALL_LAYOUT_PARAMS = ["cycle", "layout", "aksharasPerBeat"];

export class ActivateRole extends Command {
  get name(): string {
    return "ActivateRole";
  }
  execute(snippet: Snippet): void {
    // Create the role
    const name = this.getParamAt(0);
    snippet.setCurrRole(name);

    const line = snippet.notebook.ensureLine(snippet.cursor);

    const snippetView = (snippet.locals.get("view") as SnippetView) || null;
    if (snippetView != null) {
      const params = {} as any;
      for (const param of ALL_LAYOUT_PARAMS) {
        params[param] = snippet.properties.get(param.toLowerCase()) || null;
      }
      const layoutParams = new LayoutParams(params);
      const lineView = snippetView.addLine(line, layoutParams);
      lineView.ensureRole(name);
    }
  }
}

export class AddAtoms implements Instruction {
  index: number;
  atoms: Atom[];

  constructor(...atoms: Atom[]) {
    this.atoms = atoms;
    this.index = 0;
  }

  debugValue(): any {
    return { name: this.name, index: this.index, atoms: this.atoms.map((a) => a.debugValue()) };
  }

  get name(): string {
    return "AddAtoms";
  }

  execute(snippet: Snippet): void {
    const roleDef = snippet.currRole;
    if (roleDef == null) {
      throw new Error("Current role is invalid");
    }
    // Ensure a line exists
    const line = snippet.notebook.ensureLine(snippet.cursor);
    line.addAtoms(roleDef.name, ...this.atoms);

    // Also add the atom to the line view (which *should* exist)
    const snippetView = (snippet.locals.get("view") as SnippetView) || null;
    if (snippetView != null) {
      const layoutParams = {} as any;
      for (const param of ALL_LAYOUT_PARAMS) {
        layoutParams[param] = snippet.properties.get(param.toLowerCase()) || null;
      }
      const lineView = snippetView.addLine(line, layoutParams);
      lineView.addAtoms(roleDef.name, ...this.atoms);
    }
  }
}

export class SetProperty<V = string> extends Command {
  properties: TSU.StringMap<any> = {};

  debugValue(): any {
    return { ...super.debugValue(), ...this.properties };
  }

  get name(): string {
    return "SetProperty";
  }

  execute(snippet: Snippet): void {
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
      snippet.properties.setone(name.toLowerCase(), value);
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
  get name(): string {
    return "CreateLine";
  }
  execute(snippet: Snippet): void {
    const notebook = snippet.notebook;
    const line = new Line();
    if (snippet.locals.get("lines") == null) {
      snippet.locals.setone("lines", []);
    }
    const lines = snippet.locals.get("lines") as [Line, Command][];
    // Add the line created along with the instruction that
    // created so it can be used when we need to know which
    // lines to render.  The render will also use the instruction
    // along with its offset to identify where to go "back" from
    // to find any required properties as needed
    lines.push([line, this]);
    // set the cycle if it exists
    notebook.insertLine(snippet.cursor, line);

    // ALso render if we have a render target
    // TODO - See if this would benefit from an event listener model
    // where SnippetView listens to model changes and applies diffs?
    // For now even doing a complete render isnt so bad so ok for now
    const snippetView = (snippet.locals.get("view") as SnippetView) || null;
    if (snippetView) {
      const layoutParams = {} as any;
      for (const param of ALL_LAYOUT_PARAMS) {
        layoutParams[param] = snippet.properties.get(param.toLowerCase()) || null;
      }
      snippetView.addLine(line, layoutParams);
    }
  }
}

export class CreateRole extends Command {
  get name(): string {
    return "CreateRole";
  }
  execute(snippet: Snippet): void {
    // Create the role
    const name = this.getParamAt(0);
    const notesOnly = this.getParam("notes");
    snippet.newRole(name, notesOnly == "true" || notesOnly == "yes" || notesOnly == true);
  }
}

/**
 * Invokes the layout for pieces of music.
 * \run(
 *    bit1,
 *    bit2,
 *    bit3,
 *    ...
 *    bitn,
 * )
 *
 * Each bit represents atoms for a list of roles
 *
 * Bitx is defined by:
 *   path_spec       - to denote entire lines with *all* roles or a single role
 *   path_spec_list  - to denote a list of roles - so we can parallelize these
 *                     roles as part of the run
 *
 *  path_spec_list = "(" <path_spec_string>(,<path_spec_string>)* ")"
 *
 *  path_spec = name|number (.name|number)*
 */
export class RunCommand extends Emitter {
  layoutParamNames = ["cycle", "layout", "aksharasPerBeat"];
  get name(): string {
    return "Run";
  }
}

export class RunAllCommand extends Emitter {
  layoutParamNames = ["cycle", "layout", "aksharasPerBeat"];
  get name(): string {
    return "RunAll";
  }

  // How should we render?
  // we could go through all instructions and
  //
  //
  // for line,instr in snippet.alllines:
  //    renderLine(line, layoutForRunCmd or layoutForLineBeforeInstr(instr))
  execute(snippet: Snippet): void {
    // Create the role
    // see if have some layout parameters before the run command
    // otherwise pick those before the line's instruction
    /*
    const lines = snippet.locals.get("lines") || [];
    if (lines.length > 0) {
      const instructions = snippet.instructions;
      let lastLine: Nullable<Line> = null;
      let lastInstr: Nullable<Instruction> = null;
      const defaultLayoutParams = {} as any;
      this.extractLayoutParams(snippet, lines[lines.length - 1], null, defaultLayoutParams);

      const lineLayoutParams = {} as any;
      // Start off layout params with defaults first and then
      // add more between lines.
      for (const param of this.layoutParamNames) {
        lineLayoutParams[param] = snippet.properties.get(param) || null;
      }
      for (const [line, lineInstr] of lines) {
        // In order to render the line, we need to find its
        // layout parameters like cycle, aksharasPerBeat and
        // layout (and any other).
        this.extractLayoutParams(snippet, lastInstr, lineInstr, lineLayoutParams);
        lastLine = line;
        lastInstr = lineInstr;
        this.renderLine(line, snippet, lineLayoutParams, defaultLayoutParams);
      }
    }
  }

  extractLayoutParams(
    snippet: Snippet,
    firstInstr: Nullable<Instruction>,
    lastInstr: Nullable<Instruction>,
    layoutParams: any,
  ): void {
    const instructions = snippet.instructions;
    const firstIndex = firstInstr == null ? 0 : firstInstr.index;
    const lastIndex = lastInstr == null ? instructions.length - 1 : lastInstr.index;
    for (let i = firstIndex; i <= lastIndex; i++) {
      const instr = instructions[i];
      if (instr.name == "SetProperty") {
        const setProp = instr as SetProperty;
        for (const param in this.layoutParamNames) {
          layoutParams[param] = setProp.properties[param] || layoutParams[param];
        }
      }
    }
  }

  static DEFAULT_CYCLE = new Cycle({ bars: new Bar({ beatLengths: [4] }) });

  renderLine(line: Line, snippet: Snippet, layoutParams: any, defaultLayoutParams: any): void {
    // go for it!
    const snippetView = (snippet.locals.get("view") as SnippetView) || null;
    if (snippetView != null) {
      const atomsView = new LineView(null, {
        parent: rendertarget as HTMLElement,
        layoutParams: {
          numRoles: line.roles.length,
          cycle: layoutParams["cycle"] || defaultLayoutParams["cycle"] || RunAllCommand.DEFAULT_CYCLE,
          layout: layoutParams["layout"] || defaultLayoutParams["layout"] || [],
          aksharasPerBeat: layoutParams["aksharasPerBeat"] || defaultLayoutParams["aksharasPerBeat"] || 1,
        },
      } as ViewParams);
    }
   */
  }
}
