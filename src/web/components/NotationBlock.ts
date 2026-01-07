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

    const parent = container.parentNode as HTMLDivElement;
    const newRoot = document.createElement("div");
    newRoot.classList.add("notationBlockRoot");
    if (config.cssClasses?.root) {
      newRoot.className += " " + config.cssClasses.root;
    }
    this.newRoot = newRoot;

    // Build HTML structure
    let html = "";

    // Add source code section if showSource is true
    if (this.showSource) {
      const sourceLines = this.source.split("\n");
      const sourceClass = config.cssClasses?.sourceContainer || "";
      const captionClass = config.cssClasses?.sourceCaption || "";
      const codeClass = config.cssClasses?.sourceCode || "";

      html += `
        <figure class="notation-source-block ${sourceClass}">
          <div class="notation-source-header">
            <figcaption class="notation-caption ${captionClass}">${this.caption}</figcaption>
            <div class="notation-source-actions">
              <button class="notation-btn notation-copy-btn" id="copyBtn_${this.id}" title="Copy to clipboard">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>
                </svg>
                <span class="notation-btn-text">Copy</span>
              </button>
              <button class="notation-btn notation-edit-btn" id="editBtn_${this.id}" title="Edit notation">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
                <span class="notation-btn-text">Edit</span>
              </button>
            </div>
          </div>
          <div class="notation-source" id="notationSource_${this.id}">
            <pre class="notation-source-pre">
              <code class="${codeClass}" id="sourceCode_${this.id}">${sourceLines.map((x) => `<span>${x}</span>`).join("\n")}</code>
            </pre>
            <textarea class="notation-edit-textarea" id="editTextarea_${this.id}" style="display: none;"></textarea>
          </div>
          <div class="notation-edit-actions" id="editActions_${this.id}" style="display: none;">
            <button class="notation-btn notation-apply-btn" id="applyBtn_${this.id}">Apply</button>
            <button class="notation-btn notation-cancel-btn" id="cancelBtn_${this.id}">Cancel</button>
          </div>
        </figure>`;
    }

    // Add output section
    const outputLabelClass = config.cssClasses?.outputLabel || "";
    const outputClass = config.cssClasses?.outputContainer || "";

    html += `
      <div class="notation-output">
        <span class="notation-output-label ${outputLabelClass}"><strong>Output:</strong></span>
        <div id="notationViewer_${this.id}" class="notation-view ${outputClass}">
        </div>
      </div>`;

    newRoot.innerHTML = html;
    parent.insertBefore(newRoot, container);
    parent.removeChild(container);

    const notationViewerBlock = newRoot.querySelector(".notation-view") as HTMLDivElement;
    this.notationView = config.createViewer(notationViewerBlock);

    // Set up event handlers
    if (this.showSource) {
      this.sourceCodeElement = newRoot.querySelector(`#sourceCode_${this.id}`);
      this.editTextarea = newRoot.querySelector(`#editTextarea_${this.id}`);

      // Copy button
      const copyBtn = newRoot.querySelector(`#copyBtn_${this.id}`);
      if (copyBtn) {
        copyBtn.addEventListener("click", () => this.copyToClipboard());
      }

      // Edit button
      const editBtn = newRoot.querySelector(`#editBtn_${this.id}`);
      if (editBtn) {
        editBtn.addEventListener("click", () => this.toggleEditMode());
      }

      // Apply button
      const applyBtn = newRoot.querySelector(`#applyBtn_${this.id}`);
      if (applyBtn) {
        applyBtn.addEventListener("click", () => this.applyEdit());
      }

      // Cancel button
      const cancelBtn = newRoot.querySelector(`#cancelBtn_${this.id}`);
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => this.cancelEdit());
      }
    }

    this.updatePreview();
    console.log("Done Rendering... Adjusting height");
  }

  updatePreview(): void {
    const fullContents = this.source;
    // Clear previous render to avoid appending multiple times
    this.notationView.tableElement.innerHTML = "";

    const [notation, beatLayout, errors, timings] = load(fullContents, { log: true });

    if (errors.length > 0) {
      console.log("Errors: ", errors);
    } else {
      console.log("Rendering notation...");
      this.notationView.renderNotation(notation, beatLayout);
    }

    const msg = `Document parsed (${Math.trunc(timings.parseTime * 100) / 100} ms) and built (${
      Math.trunc(timings.buildTime * 100) / 100
    } ms)`;
    console.log(msg);
  }

  get captionId(): string {
    return "notationCaption_" + this.id;
  }

  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.source);
      const copyBtn = this.newRoot.querySelector(`#copyBtn_${this.id}`);
      if (copyBtn) {
        const btnText = copyBtn.querySelector(".notation-btn-text");
        const originalText = btnText?.textContent;
        if (btnText) {
          btnText.textContent = "Copied!";
          setTimeout(() => {
            if (btnText) btnText.textContent = originalText || "Copy";
          }, 2000);
        }
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
    if (!this.editTextarea || !this.sourceCodeElement) return;

    // Populate textarea with current source
    this.editTextarea.value = this.source;

    // Hide source code, show textarea
    if (this.sourceCodeElement.parentElement) {
      this.sourceCodeElement.parentElement.style.display = "none";
    }
    this.editTextarea.style.display = "block";

    // Auto-resize textarea to fit content
    this.editTextarea.style.height = "auto";
    this.editTextarea.style.height = this.editTextarea.scrollHeight + "px";

    // Show edit actions
    const editActions = this.newRoot.querySelector(`#editActions_${this.id}`) as HTMLElement;
    if (editActions) {
      editActions.style.display = "flex";
    }

    // Update edit button text
    const editBtn = this.newRoot.querySelector(`#editBtn_${this.id}`);
    const btnText = editBtn?.querySelector(".notation-btn-text");
    if (btnText) {
      btnText.textContent = "Editing...";
    }

    this.editTextarea.focus();
  }

  exitEditMode(): void {
    if (!this.editTextarea || !this.sourceCodeElement) return;

    // Hide textarea, show source code
    this.editTextarea.style.display = "none";
    if (this.sourceCodeElement.parentElement) {
      this.sourceCodeElement.parentElement.style.display = "block";
    }

    // Hide edit actions
    const editActions = this.newRoot.querySelector(`#editActions_${this.id}`) as HTMLElement;
    if (editActions) {
      editActions.style.display = "none";
    }

    // Update edit button text
    const editBtn = this.newRoot.querySelector(`#editBtn_${this.id}`);
    const btnText = editBtn?.querySelector(".notation-btn-text");
    if (btnText) {
      btnText.textContent = "Edit";
    }
  }

  applyEdit(): void {
    if (!this.editTextarea) return;

    // Update source
    this.source = this.editTextarea.value;

    // Update source code display
    if (this.sourceCodeElement) {
      const sourceLines = this.source.split("\n");
      this.sourceCodeElement.innerHTML = sourceLines.map((x) => `<span>${x}</span>`).join("\n");
    }

    // Re-render notation
    this.updatePreview();

    // Exit edit mode
    this.isEditing = false;
    this.exitEditMode();
  }

  cancelEdit(): void {
    // Simply exit edit mode without applying changes
    this.isEditing = false;
    this.exitEditMode();
  }
}
