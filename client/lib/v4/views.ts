import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { LayoutParams, Line, Role, Atom } from "../models";
import { FlatAtom, Beat } from "../models/iterators";
import { Notation, Command } from "../../lib/v4/models";
import {
  RawEmbedding,
  AddAtoms,
  CreateLine,
  ActivateRole,
  CreateRole,
  SetAPB,
  SetCycle,
  SetBreaks,
  ApplyLayout,
} from "../../lib/v4/commands";
import { AtomView } from "../rendering/Core";
import { BarLayout } from "../rendering/Layouts";
import { LineView } from "../rendering/LineView";
const MarkdownIt = require("markdown-it");

export class NotationView extends TSV.EntityView<Notation> {
  lineViews: LineView[] = [];
  atomLayouts = new Map<number, BarLayout>();

  get notation(): Notation {
    return this.entity!;
  }

  addElement(elem: Element): void {
    this.rootElement.appendChild(elem);
  }

  ensureLineView(line: Line): LineView {
    const layoutParams: LayoutParams = this.notation.layoutParams;
    let lineView = this.getLineView(line);
    if (lineView == null) {
      if (this.lineViews.length > 0) {
        this.rootElement.appendChild(TSU.DOM.createNode("br"));
      }
      let atomLayout = this.atomLayouts.get(layoutParams.uuid) || null;
      if (atomLayout == null) {
        atomLayout = new BarLayout(layoutParams, this);
        this.atomLayouts.set(layoutParams.uuid, atomLayout);
      }
      lineView = new LineView(LineView.newRoot(this.rootElement), line, {
        layoutParams: layoutParams,
        atomLayout: atomLayout,
      } as any);
      this.lineViews.push(lineView);
    }
    return lineView;
  }

  addAtoms(role: Role, ...atoms: Atom[]): void {
    // Ensure lineView exists
    const lineView = this.getLineView(role.line);
    if (lineView == null) {
      throw new Error("Line view not yet created");
    }
    lineView.atomLayout.addAtoms(role, ...atoms);
  }

  getLineView(line: Line): TSU.Nullable<LineView> {
    return this.lineViews.find((l) => l.entity == line) || null;
  }

  get currentLineView(): LineView {
    return this.lineViews[this.lineViews.length - 1];
  }

  createAtomView(beat: Beat, flatAtom: FlatAtom, beforeAtom: null | FlatAtom): AtomView {
    const lineView = this.getLineView(beat.role.line)!;
    return lineView.createAtomView(beat, flatAtom, beforeAtom);
  }

  rootElementForBeat(beat: Beat): SVGGraphicsElement {
    const lineView = this.getLineView(beat.role.line)!;
    return lineView.rootElementForBeat(beat);
  }

  renderCommands(commands: Command[], reset = false): void {
    const handlers: TSU.StringMap<(command: any) => void> = {};
    handlers["AddAtoms"] = this.renderAddAtoms.bind(this);
    handlers["RawEmbedding"] = this.renderRawEmbedding.bind(this);
    for (const cmd of commands) {
      cmd.applyToNotation(this.notation);
      if (cmd.name in handlers) handlers[cmd.name](cmd);
    }
  }

  renderAddAtoms(command: AddAtoms): void {
    const lineView = this.ensureLineView(this.notation.currentLine);
  }

  renderRawEmbedding(command: RawEmbedding): void {
    // Add the markdown here
    const md = new MarkdownIt({
      html: true,
    });
    const tokens = md.parse(command.rawContents.trim(), {});
    const html = md.renderer.render(tokens, { langPrefix: "v4_" });
    const div = this.rootElement.appendChild(TSU.DOM.createNode("div"));
    div.innerHTML = html;
  }
}
