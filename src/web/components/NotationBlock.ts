import { load } from "../../loader";
import { NotationView } from "../../carnatic";

export interface NotationBlockConfig {
  /** Function to create a notation viewer - allows different implementations */
  createViewer: (container: HTMLDivElement) => NotationView;

  /** CSS classes to apply to various elements */
  cssClasses?: {
    root?: string;
    sourceContainer?: string;
    sourceCaption?: string;
    sourceCode?: string;
    outputLabel?: string;
    outputContainer?: string;
  };
}

const COPY_ICON =
  "M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z";
const EDIT_ICON =
  "M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z";

/**
 * Replaces a `<notation>` element with a rendered notation, and optionally its source with
 * Copy and Edit buttons.
 *
 * Every value from the page or the user (the source, the id, the caption, parse errors) goes
 * into the DOM as text or as an attribute value, never as HTML. So a block is safe to use
 * where the notation comes from a user.
 *
 * Attributes read from the element: `id`, `caption`, `showSource="true"`, `height`, and
 * `sourceFrom` (the id of another element whose text is the source).
 */
export default class NotationBlock {
  id: string;
  source: string;
  caption = "";
  height: string;
  newRoot: HTMLDivElement;
  notationView: NotationView;
  showSource: boolean;
  isEditing = false;
  editTextarea: HTMLTextAreaElement | null = null;
  sourceCodeElement: HTMLElement | null = null;
  /** The latest render. It resolves once the output shows the current source or its errors. */
  rendering: Promise<void> = Promise.resolve();

  private viewElement: HTMLDivElement;
  private errorElement: HTMLDivElement;
  private copyButton: HTMLButtonElement | null = null;
  private editButton: HTMLButtonElement | null = null;
  private editActions: HTMLDivElement | null = null;
  private sourcePre: HTMLPreElement | null = null;
  private renderCount = 0;

  constructor(
    public readonly container: HTMLElement,
    public readonly config: NotationBlockConfig,
  ) {
    this.id = (container.getAttribute("id") || "").trim();
    this.caption = (container.getAttribute("caption") || "").trim();
    const sourceFrom = (container.getAttribute("sourceFrom") || "").trim();
    this.source = container.textContent || "";

    if (sourceFrom.length > 0) {
      const sourceElem = document.getElementById(sourceFrom);
      if (sourceElem) {
        this.source = sourceElem.textContent || "";
      }
    }

    this.height = container.getAttribute("height") || "";
    this.showSource = (container.getAttribute("showSource") || "false") == "true";

    const classes = config.cssClasses || {};
    const newRoot = el("div", "notationBlockRoot " + (classes.root || ""));
    this.newRoot = newRoot;

    if (this.showSource) {
      newRoot.appendChild(this.buildSourceSection());
    }

    const output = el("div", "notation-output");
    const label = el("span", "notation-output-label " + (classes.outputLabel || ""));
    const strong = el("strong");
    strong.textContent = "Output:";
    label.appendChild(strong);
    this.errorElement = el("div", "notation-error");
    this.errorElement.setAttribute("role", "alert");
    this.viewElement = el("div", "notation-view " + (classes.outputContainer || ""));
    this.viewElement.id = `notationViewer_${this.id}`;
    output.append(label, this.viewElement);

    const parent = container.parentNode as HTMLElement;
    parent.insertBefore(newRoot, container);
    parent.removeChild(container);
    newRoot.appendChild(output);

    this.notationView = config.createViewer(this.viewElement);
    this.rendering = this.updatePreview();
  }

  /**
   * Parses the current source and renders it, or shows the parse errors in the output.
   *
   * The output is marked `aria-busy` until the render finishes, and the browser gets a frame
   * to paint that state first. So a slow render shows as busy rather than as a frozen page.
   */
  updatePreview(): Promise<void> {
    this.viewElement.setAttribute("aria-busy", "true");
    const thisRender = ++this.renderCount;
    this.rendering = nextFrame().then(() => {
      // A newer render started while this one waited; that one shows the current source.
      if (thisRender !== this.renderCount) return;
      this.notationView.tableElement.innerHTML = "";
      let errors: string[];
      try {
        const [notation, beatLayout, parseErrors] = load(this.source);
        errors = parseErrors.map((e: any) => String(e?.message ?? e));
        if (errors.length === 0) {
          this.notationView.renderNotation(notation, beatLayout);
        }
      } catch (e: any) {
        errors = [String(e?.message ?? e)];
      }
      this.showErrors(errors);
      this.viewElement.setAttribute("aria-busy", "false");
    });
    return this.rendering;
  }

  get captionId(): string {
    return "notationCaption_" + this.id;
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.source);
      const btnText = this.copyButton?.querySelector(".notation-btn-text");
      if (btnText) {
        const originalText = btnText.textContent;
        btnText.textContent = "Copied!";
        setTimeout(() => {
          btnText.textContent = originalText || "Copy";
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      alert("Failed to copy to clipboard");
    }
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;

    if (this.isEditing) {
      this.enterEditMode();
    } else {
      this.exitEditMode();
    }
  }

  enterEditMode(): void {
    if (!this.editTextarea || !this.sourcePre) return;
    this.isEditing = true;

    this.editTextarea.value = this.source;
    this.sourcePre.style.display = "none";
    this.editTextarea.style.display = "block";

    // Grow the textarea to fit the source.
    this.editTextarea.style.height = "auto";
    this.editTextarea.style.height = this.editTextarea.scrollHeight + "px";

    if (this.editActions) this.editActions.style.display = "flex";
    this.setEditButtonText("Editing...");
    this.editTextarea.focus();
  }

  exitEditMode(): void {
    if (!this.editTextarea || !this.sourcePre) return;

    this.editTextarea.style.display = "none";
    this.sourcePre.style.display = "block";
    if (this.editActions) this.editActions.style.display = "none";
    this.setEditButtonText("Edit");
  }

  /** Takes the textarea's text as the new source, leaves edit mode and re-renders. */
  applyEdit(): Promise<void> {
    if (!this.editTextarea) return this.rendering;

    this.source = this.editTextarea.value;
    this.fillSourceCode();
    this.isEditing = false;
    this.exitEditMode();
    return this.updatePreview();
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.exitEditMode();
  }

  private buildSourceSection(): HTMLElement {
    const classes = this.config.cssClasses || {};
    const figure = el("figure", "notation-source-block " + (classes.sourceContainer || ""));

    const header = el("div", "notation-source-header");
    const caption = el("figcaption", "notation-caption " + (classes.sourceCaption || ""));
    caption.textContent = this.caption;
    const actions = el("div", "notation-source-actions");
    this.copyButton = button("notation-copy-btn", `copyBtn_${this.id}`, "Copy to clipboard", COPY_ICON, "Copy");
    this.editButton = button("notation-edit-btn", `editBtn_${this.id}`, "Edit notation", EDIT_ICON, "Edit");
    this.copyButton.addEventListener("click", () => this.copyToClipboard());
    this.editButton.addEventListener("click", () => this.toggleEditMode());
    actions.append(this.copyButton, this.editButton);
    header.append(caption, actions);

    const sourceBox = el("div", "notation-source");
    sourceBox.id = `notationSource_${this.id}`;
    this.sourcePre = el("pre", "notation-source-pre");
    this.sourceCodeElement = el("code", classes.sourceCode || "");
    this.sourceCodeElement.id = `sourceCode_${this.id}`;
    this.sourcePre.appendChild(this.sourceCodeElement);
    this.fillSourceCode();

    this.editTextarea = el("textarea", "notation-edit-textarea");
    this.editTextarea.id = `editTextarea_${this.id}`;
    this.editTextarea.style.display = "none";
    this.editTextarea.setAttribute("aria-label", "Notation source. Ctrl+Enter applies, Escape cancels.");
    this.editTextarea.addEventListener("keydown", (e) => this.onEditKey(e));
    sourceBox.append(this.sourcePre, this.editTextarea);

    this.editActions = el("div", "notation-edit-actions");
    this.editActions.id = `editActions_${this.id}`;
    this.editActions.style.display = "none";
    const apply = el("button", "notation-btn notation-apply-btn");
    apply.id = `applyBtn_${this.id}`;
    apply.type = "button";
    apply.textContent = "Apply";
    apply.title = "Apply (Ctrl+Enter)";
    apply.addEventListener("click", () => this.applyEdit());
    const cancel = el("button", "notation-btn notation-cancel-btn");
    cancel.id = `cancelBtn_${this.id}`;
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.title = "Cancel (Escape)";
    cancel.addEventListener("click", () => this.cancelEdit());
    this.editActions.append(apply, cancel);

    figure.append(header, sourceBox, this.editActions);
    return figure;
  }

  /** One <span> per source line, as text. */
  private fillSourceCode(): void {
    const code = this.sourceCodeElement;
    if (!code) return;
    code.replaceChildren();
    this.source.split("\n").forEach((line, i) => {
      if (i > 0) code.append("\n");
      const span = document.createElement("span");
      span.textContent = line;
      code.appendChild(span);
    });
  }

  private onEditKey(e: KeyboardEvent): void {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.applyEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  private showErrors(errors: string[]): void {
    if (errors.length === 0) {
      this.errorElement.remove();
      return;
    }
    this.errorElement.replaceChildren();
    const title = el("strong");
    title.textContent = errors.length === 1 ? "This notation has an error:" : "This notation has errors:";
    const list = el("ul");
    for (const message of errors) {
      const item = el("li");
      item.textContent = message;
      list.appendChild(item);
    }
    this.errorElement.append(title, list);
    this.viewElement.before(this.errorElement);
  }

  private setEditButtonText(text: string): void {
    const label = this.editButton?.querySelector(".notation-btn-text");
    if (label) label.textContent = text;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const names = className.split(/\s+/).filter(Boolean);
  if (names.length) node.classList.add(...names);
  return node;
}

function button(kind: string, id: string, title: string, iconPath: string, text: string): HTMLButtonElement {
  const b = el("button", "notation-btn " + kind);
  b.id = id;
  b.type = "button";
  b.title = title;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPath);
  svg.appendChild(path);
  const label = el("span", "notation-btn-text");
  label.textContent = text;
  b.append(svg, label);
  return b;
}

/** Resolves after the browser has had a chance to paint, or right away outside a browser. */
function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
