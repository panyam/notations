import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { LayoutParams, Line, Role, Atom } from "../models";
import { FlatAtom, Beat } from "../models/iterators";
import { Notation, LineBeats, RawBlock } from "../../lib/v4/models";
import { AtomView } from "../rendering/Core";
import { BarLayout } from "../rendering/Layouts";
import { LineView } from "../rendering/LineView";
const MarkdownIt = require("markdown-it");

export class NotationView extends TSV.EntityView<Notation> {
  lineViews: LineView[] = [];
  lineBeats = new Map<number, LineBeats>();
  atomLayouts = new Map<number, BarLayout>();

  get notation(): Notation {
    return this.entity!;
  }

  addElement(elem: Element): void {
    this.rootElement.appendChild(elem);
  }

  ensureLineView(line: Line): LineView {
    const layoutParams: LayoutParams = line.layoutParams!;
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

  /**
   * Layout all the blocks in the Notation along with their corresponding blocks.
   * Key thing is here is an opportunity to perform any batch rendering as needed.
   */
  refreshLayout(): void {
    for (const block of this.notation.blocks) {
      if (block.type == "RawBlock") {
        // Add the markdown here
        const raw = block as RawBlock;
        const md = new MarkdownIt({
          html: true,
        });
        const tokens = md.parse(raw.content.trim(), {});
        const html = md.renderer.render(tokens, { langPrefix: "v4_" });
        const div = this.rootElement.appendChild(TSU.DOM.createNode("div"));
        div.innerHTML = html;
      } else {
        const line = block as Line;
        const lineView = this.ensureLineView(line);
        const atomLayout = this.atomLayouts.get(line.layoutParams!.uuid)!;
        for (const role of line.roles) {
          atomLayout.addAtoms(role, ...role.atoms);
        }
        lineView.layoutChildViews();
      }
    }
  }
}
