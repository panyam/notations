import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { LayoutParams, Beat, FlatAtom, Line, Role, Atom } from "notations";
import { Snippet } from "../v3/models";
import { AtomLayout, AtomView } from "./Core";
import { createAtomView } from "./AtomViews";
import { BarLayout } from "./Layouts";

export class SnippetView extends TSV.EntityView<Snippet> {
  lineViews: LineView[] = [];
  atomLayout: BarLayout;

  addElement(elem: Element): void {
    this.rootElement.appendChild(elem);
  }

  addLine(line: Line, layoutParams: LayoutParams): LineView {
    let lineView = this.getLineView(line);
    if (lineView == null) {
      if (this.lineViews.length > 0) {
        this.rootElement.appendChild(TSU.DOM.createNode("br"));
      }
      if (!this.atomLayout) {
        this.atomLayout = new BarLayout(layoutParams, this);
      }
      lineView = new LineView(LineView.newRoot(this.rootElement), line, {
        layoutParams: layoutParams,
        atomLayout: this.atomLayout,
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
}

/**
 * Line views are responsible for rendering an entire line of
 * scores.
 * Key responsibility of lines are to manage the layout of
 * music both in time (horizontally) as well as in roles
 * (vertically).
 *
 * A line's rendering is controlled by the following ways:
 *
 * 1. Current cycle associated with the line
 * 2. Current "speed" - 1st speed, second speed, thisram etc
 * 3. Cycle layout pattern associated with the.  eg how many
 *    "bars" to show before a line break and starting a new line.
 * 4. Spacing between "bars" and atoms.
 *
 * For now we assume a line only has a single part.  Typically
 * each part would cover all notations until a line break
 * (however line breaks are decided).
 *
 * Each line row shows atoms for all roles grouped vertically
 * starting at the same time offset.
 *
 * Here we use the priority queue to show which atom in which
 * role needs to be rendered first (this way we dont need an
 * explicit bar stack).
 *
 * What is the best way to "represent" the final state of teh view?
 *
 */

/**
 * LineView as "everything" is painful.
 * On the one hand it just breaks atoms into rows and lets the AtomLayout
 * place it.  But then by doing so AtomLayout does not know which bar/beat
 * an atom belongs to and we cannot do embelishments based on this info.
 *
 * Problem here is layout is being done by two different entities - the
 * Lineview and the AtomLayout delegate.   And this is done because the LV
 * needs to "create" AtomView objects
 *
 * What is needed Atoms to be "fed" into an AtomLayout (model) which invokes
 * an AtomView creator/provider when atomviews for flat atoms are needed
 *
 * But note that a single AtomLayout can be used to layout atoms across
 * several roles across several lines.
 */

export class LineView extends TSV.EntityView<Line> {
  layoutParams: LayoutParams;
  roleStates: RoleState[];
  atomLayout: AtomLayout;

  public static newRoot(parent: Element): SVGSVGElement {
    return TSU.DOM.createSVGNode("svg", {
      parent: parent,
      attrs: {
        width: "100%",
        style: "margin-bottom: 20px",
      },
    }) as SVGSVGElement;
  }

  protected processConfigs(config: any): any {
    if (this.rootElement.tagName != "svg") {
      throw new Error("LineView root MUST be a svg node");
    }
    this.layoutManager = new TSV.BorderLayout();
    this.layoutParams = config.layoutParams;
    this.atomLayout = config.atomLayout || new BarLayout(this.layoutParams, this);
    this.reset();
    return config;
  }

  reset(): void {
    this.roleStates = [];
  }

  /**
   * Ensures that a role exists across all rows in this LineView.
   *
   * Our LineView is composed of several AtomRowView where each RAV
   * is just a list of AtomViews (that are laid out by the AtomLayout
   * delegate) that correspond to the atoms of a particular role (eg Sw, Sh,
   * etc).  Each Line has Roles running in parallel (eg Pallavi's Sw and Sh
   * run in parallel and need to be laid out next to each other).
   *
   * It is possible that when the user is inputing they could enter the
   * entire song's Sw role notes first followed Sh role's syllables.  This
   * should not...
   */
  ensureRole(name: string): RoleState {
    let curr = this.roleStates.findIndex((ri) => ri.name == name);
    if (curr < 0) {
      curr = this.roleStates.length;
      this.roleStates.push(new RoleState(name, this));
    }
    return this.roleStates[curr];
  }

  get prefSize(): TSV.Size {
    // TODO - we need a way to differentiate this as when
    // called *before* and *after* a layout.
    const bbox = (this.rootElement as SVGSVGElement).getBBox();
    return new TSV.Size(4 + bbox.width + bbox.x, 4 + bbox.y + bbox.height);
  }

  /**
   * Ensures that all atom views are created and laid in respective
   * line and role views.
   *
   * This LineView only creates child views necessary in the most base
   * form and ensures that atoms are added to these child views.  The
   * positioning of the atom views is performed by AtomLayout delegate.
   */
  layoutChildViews(): void {
    // Now layout all the AtomRows
    this.layoutRows();

    // Update all embelishments here before calculating preferred size
    this.atomLayout.refreshEmbelishments();

    const ps = this.prefSize;
    this.setSize(ps.width, ps.height);
  }

  rootElementForBeat(beat: Beat): SVGGraphicsElement {
    const [layoutLine, lineIndex] = this.layoutParams.getBeatLocation(beat);
    const role = beat.role;
    const roleState = this.ensureRole(role.name);
    const row = roleState.ensureRow(layoutLine);
    return row.rootElement.parentElement as any as SVGGraphicsElement;
  }

  /**
   * Create a new atom view for a given atom in a particular beat.
   * This ensures that all parent views are also created for the atom
   * as a prerequisite.
   */
  createAtomView(beat: Beat, atom: FlatAtom, beforeAtom: null | FlatAtom): AtomView {
    // See which role it is for
    // see which "row" it belongs to in the given role based on
    // the layout params.
    // For this row see if an AtomRow exists - create if it does not
    // in this AtomRow create the atomView
    const [layoutLine, lineIndex] = this.layoutParams.getBeatLocation(beat);
    const role = beat.role;
    const roleState = this.ensureRole(role.name);
    const row = roleState.ensureRow(layoutLine);
    return row.add(atom);
  }

  /**
   * Ensures all rows are laid out (without changing any aligning
   * within the rows).  This layout is simple - all rows are stacked
   * one after the other vertically based on their preferred sizes
   * (as calculated by the AtomLayout delegate.
   *
   * Note that absolutely no inter-row layout of atoms occurs here.
   */
  layoutRows(): void {
    // Now lay out the roles
    let currY = 0;
    // TODO - Instead of going through each Row
    // go through each roleState and "zip" the rows from them.
    // This is currently incorrect - just showing all the rows for role1
    // then role 2 etc.  But doing this so we can test layout first
    const rows = this.roleStates.map((x) => 0);
    let done = false;
    while (!done) {
      // get one row from each role
      done = true;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] < this.roleStates[i].rows.length) {
          done = false;
          const atomRow = this.roleStates[i].rows[rows[i]];
          currY += this.rowSpacing;
          const rootElem = atomRow.rootElement;
          const bbox = rootElem.getBBox();
          rootElem.setAttribute("y", "" + currY);
          rootElem.setAttribute("x", "" + 20);
          currY += bbox.height;
          rows[i]++;
        }
      }

      // All roles for a row have been set so add extra inter-row spacing
      currY += this.roleSpacing;
    }
  }

  // Space between two roles (within the same row)
  roleSpacing = 20;

  // Vertical space between two rows (of multiple roles)
  rowSpacing = 10;
}

class RoleState {
  rows: AtomsRow[] = [];
  constructor(public readonly name: string, public readonly lineView: LineView) {}

  ensureRow(count: number): AtomsRow {
    while (this.rows.length <= count) {
      const newRow = new AtomsRow(this.rows.length, this.name, this.lineView);
      if (this.rows.length > 0) {
        // place this new row (for now) below the previous row so we can see what is going on
        const prevRow = this.rows[this.rows.length - 1];
        const prevRootElem = prevRow.rootElement;
        const bbox = prevRootElem.getBBox();
        newRow.rootElement.setAttribute("y", "" + (bbox.y + bbox.height + 10));
        newRow.rootElement.setAttribute("x", "" + 20);

        const linebbox = (this.lineView.rootElement as SVGSVGElement).getBBox();
        const lineViewSize = new TSV.Size(
          4 + linebbox.width + linebbox.x,
          4 + linebbox.y + linebbox.height + bbox.height + 10,
        );
        this.lineView.setSize(lineViewSize.width, lineViewSize.height);
      }
      this.rows.push(newRow);
    }
    return this.rows[count];
  }
}

class AtomsRow {
  private static idCounter = 0;
  readonly rowId = AtomsRow.idCounter++;

  /**
   * All the atoms in this row
   */
  atomViews: AtomView[] = [];

  /**
   * Returns the root text element for this Role at a given row.
   */
  readonly rootElement: SVGTextElement;

  constructor(public rowIndex: number, public roleName: string, public lineView: LineView) {
    this.rootElement = TSU.DOM.createSVGNode("text", {
      parent: lineView.rootElement,
      attrs: {
        class: "roleAtomsText",
        y: "0%",
        style: "dominant-baseline: hanging",
        roleName: roleName,
        rowIndex: rowIndex,
      },
    }) as SVGTextElement;
  }

  add(flatAtom: FlatAtom): AtomView {
    const atomView = createAtomView(this.rootElement, flatAtom);
    atomView.depth = flatAtom.depth;
    this.atomViews.push(atomView);
    return atomView;
  }
}
