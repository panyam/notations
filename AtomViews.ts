import * as TSU from "@panyam/tsutils";
import { AtomType, Label, Note, Space, Syllable, FlatAtom, Embelishment } from "notations";
import { AtomView, TimedView } from "./Core";

class NoteView extends AtomView {
  octaveIndicator: null | OctaveIndicator = null;

  embRoot(): SVGGraphicsElement {
    let rootElem = this.element.parentElement as any as SVGGraphicsElement;
    while (rootElem && (rootElem.tagName == "tspan" || rootElem.tagName == "text")) {
      rootElem = rootElem.parentElement as any as SVGGraphicsElement;
    }
    return rootElem;
  }

  get note(): Note {
    return this.flatAtom.atom as Note;
  }

  createElements(parent: SVGGraphicsElement): void {
    const note = this.note;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: note.uuid,
        id: "atom" + note.uuid,
      },
      text: note.value + (note.beforeRest ? " - " : " "),
    });
    // create the embelishments if needed
    if (note.octave != 0) {
      this.octaveIndicator = new OctaveIndicator(this);
    }
  }

  get embelishments(): Embelishment[] {
    return this.octaveIndicator ? [this.octaveIndicator] : [];
  }
}

class OctaveIndicator implements Embelishment {
  dotRadius = 1.5;
  dotSpacing = 3;
  dotsElem: SVGGElement;

  constructor(public readonly noteView: NoteView) {
    const rootElem = this.noteView.embRoot();
    const note = this.noteView.note;
    const numDots = Math.abs(note.octave);
    this.dotsElem = TSU.DOM.createSVGNode("g", {
      doc: document,
      parent: rootElem,
      attrs: {
        width: this.dotRadius * 2 * numDots + (numDots - 1) * this.dotSpacing,
        height: this.dotRadius * 2,
        source: "atom" + this.noteView.flatAtom.atom.uuid,
      },
    });
    let cx = 0;
    for (let i = 0; i < numDots; i++) {
      TSU.DOM.createSVGNode("circle", {
        doc: document,
        parent: this.dotsElem,
        attrs: {
          cx: cx,
          cy: 0,
          r: this.dotRadius,
          stroke: "black",
          "stroke-width": "1",
        },
      });
      cx += this.dotRadius + this.dotRadius + this.dotSpacing;
    }
  }

  get dependencies(): TimedView[] {
    return [this.noteView];
  }

  refreshLayout(): void {
    const out = this.noteView.bbox;
    const emb = this.dotsElem;
    if (emb) {
      const bb2 = emb.getBBox();
      const gX = out.x + (out.width - bb2.width) / 2;
      const gY = this.noteView.note.octave > 0 ? out.y - bb2.height : out.y + out.height + this.dotRadius;
      emb.setAttribute("transform", "translate(" + gX + "," + gY + ")");
    }
  }
}

class SyllableView extends AtomView {
  createElements(parent: SVGGraphicsElement): void {
    const syllable = this.syllable;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: syllable.uuid,
        id: "atom" + syllable.uuid,
      },
      text: syllable.value + (syllable.beforeRest ? " - " : " "),
    });
  }

  get syllable(): Syllable {
    return this.flatAtom.atom as Syllable;
  }
}

class SpaceView extends AtomView {
  createElements(parent: SVGGraphicsElement): void {
    const space = this.space;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: space.uuid,
        id: "atom" + space.uuid,
      },
      text: (space.isSilent ? " " : ",") + (space.beforeRest ? " - " : " "),
    });
  }

  get space(): Space {
    return this.flatAtom.atom as Space;
  }
}

class LabelView extends AtomView {
  createElements(parent: SVGGraphicsElement): void {
    const label = this.label;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: { atomid: label.uuid, id: "atom" + label.uuid },
      text: label.content + " ",
    });
  }

  get label(): Label {
    return this.flatAtom.atom as unknown as Label;
  }
}

export function createAtomView(parent: SVGGraphicsElement, atom: FlatAtom): AtomView {
  let out: AtomView;
  switch (atom.atom.type) {
    // Dealing with leaf atoms
    case AtomType.SPACE:
      out = new SpaceView(atom);
      break;
    case AtomType.LABEL:
      out = new LabelView(atom);
      break;
    case AtomType.SYLLABLE:
      out = new SyllableView(atom);
      break;
    case AtomType.NOTE:
      out = new NoteView(atom);
      break;
    default:
      // We should never get a group as we are iterating
      // at leaf atom levels
      throw new Error("Invalid atom type: " + atom.atom.type);
  }
  out.createElements(parent);
  // out.bbox;
  return out;
}
