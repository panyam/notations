/**
 * NotebookPlayground.ts - Interactive notebook-style notation editor
 *
 * Each "cell" is a \line() block that can be edited independently.
 * Cells can be reordered via drag and drop.
 */

import * as N from "notations";
import * as NV from "../NotationViewer";

// Import core notation styles
import "../../../styles/NotationView.scss";

// Expose notations library globally
(window as any).N = N;

// Cell represents an editable unit
interface Cell {
  id: string;
  source: string;
  name: string;
}

// Sample notations for the notebook demo
interface SampleNotation {
  name: string;
  label: string;
  preamble: string; // cycle, beatDuration etc
  cells: Cell[];
  selected?: boolean;
}

let cellIdCounter = 0;
function generateCellId(): string {
  return `cell-${++cellIdCounter}`;
}

const sampleNotations: SampleNotation[] = [
  {
    name: "varnam",
    label: "Varnam Structure",
    selected: true,
    preamble: `\\cycle("|4|2|2|")
\\beatDuration(4)`,
    cells: [
      {
        id: generateCellId(),
        name: "Pallavi - Line 1",
        source: `Sw: S R G M , P M G R , S _ _ _ , _ _ _ _
Sh: nin nu ko ri , va ra da nun , nu _ _ _ , _ _ _ _`,
      },
      {
        id: generateCellId(),
        name: "Pallavi - Line 2",
        source: `Sw: S R G M , P M G R , S R G M , P _ _ _
Sh: nin nu ko ri , va ra da nun , nu ko ri , va _ _ _`,
      },
      {
        id: generateCellId(),
        name: "Anupallavi - Line 1",
        source: `Sw: P D S. R. , S. D P M , G M P D , S. _ _ _
Sh: en na ju chi , te ne e , man dha ra , va _ _ _`,
      },
      {
        id: generateCellId(),
        name: "Anupallavi - Line 2",
        source: `Sw: P D S. R. , S. D P M , G R S _ , _ _ _ _
Sh: nin nu ko ri , va ra da , nun nu _ , _ _ _ _`,
      },
      {
        id: generateCellId(),
        name: "Muktayi - First Speed",
        source: `Sw: S R G M , P D S. R. , S. D P M , G M P D
Sw: S. R. S. D , P M G R , S _ _ _ , _ _ _ _`,
      },
    ],
  },
  {
    name: "sections",
    label: "Sections Demo",
    preamble: `\\cycle("|4|2|2|")
\\beatDuration(4)`,
    cells: [
      { id: generateCellId(), name: "Introduction", source: `Sw: S R G M  P D N S.` },
      { id: generateCellId(), name: "Main Theme - Phrase A", source: `Sw: S R G M , P M G R` },
      { id: generateCellId(), name: "Main Theme - Phrase B", source: `Sw: P D S. R. , S. D P M` },
      { id: generateCellId(), name: "Repeat Pattern", source: `Sw: G R S _ , _ _ _ _` },
      { id: generateCellId(), name: "Conclusion", source: `Sw: S _ _ _ , _ _ _ _` },
    ],
  },
  {
    name: "speeds",
    label: "Multiple Speeds",
    preamble: `\\cycle("|4|2|2|")`,
    cells: [
      {
        id: generateCellId(),
        name: "First Speed",
        source: `\\beatDuration(4)
Sw: S , R , G , M , P , D , N , S.`,
      },
      {
        id: generateCellId(),
        name: "Second Speed",
        source: `\\beatDuration(2)
Sw: SR , GM , PD , NS. , S.N , DP , MG , RS`,
      },
      {
        id: generateCellId(),
        name: "Third Speed",
        source: `\\beatDuration(1)
Sw: SRGM , PDNS. , S.NDP , MGRS`,
      },
    ],
  },
];

export class NotebookPlayground {
  private container: HTMLElement | null = null;
  private consoleOutput: HTMLElement | null = null;
  private sampleSelect: HTMLSelectElement | null = null;

  private currentSample: SampleNotation | null = null;
  private cells: Cell[] = [];
  private editingCellId: string | null = null;
  private draggedCellId: string | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Setup sample select
    this.sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;
    if (this.sampleSelect) {
      this.sampleSelect.innerHTML = sampleNotations
        .map((s) => `<option value="${s.name}" ${s.selected ? "selected" : ""}>${s.label}</option>`)
        .join("");
      this.sampleSelect.addEventListener("change", () => {
        const sample = sampleNotations.find((s) => s.name === this.sampleSelect!.value);
        if (sample) this.loadSample(sample);
      });
    }

    // Setup console
    this.consoleOutput = document.getElementById("console-output");

    // Setup clear console button
    const clearBtn = document.getElementById("clear-console-btn");
    clearBtn?.addEventListener("click", () => {
      if (this.consoleOutput) this.consoleOutput.innerHTML = "";
    });

    // Get container
    this.container = document.getElementById("notebook-container");
    if (this.container) {
      this.log("Notebook initialized", "info");

      // Load initial sample
      const selected = sampleNotations.find((s) => s.selected) || sampleNotations[0];
      this.loadSample(selected);
    }
  }

  private loadSample(sample: SampleNotation): void {
    this.currentSample = sample;
    // Deep copy cells so we can modify them
    this.cells = sample.cells.map((c) => ({ ...c, id: generateCellId() }));
    this.editingCellId = null;
    this.render();
    this.log(`Loaded sample: ${sample.label} (${this.cells.length} cells)`, "info");
  }

  private buildFullSource(): string {
    if (!this.currentSample) return "";

    const cellSources = this.cells.map((cell) => {
      return `\\line("${cell.name}")
${cell.source}`;
    });

    return `${this.currentSample.preamble}

${cellSources.join("\n\n")}`;
  }

  private render(): void {
    if (!this.container) return;
    this.container.innerHTML = "";

    // Render each cell - first create structure and append to DOM
    const cellElements: Array<{ cellEl: HTMLElement; cell: Cell; isEditing: boolean }> = [];

    this.cells.forEach((cell, index) => {
      const isEditing = this.editingCellId === cell.id;
      const cellEl = this.renderCellStructure(cell, index, isEditing);
      this.container!.appendChild(cellEl);
      cellElements.push({ cellEl, cell, isEditing });
    });

    // Add "Add Cell" button at the end
    const addBtn = document.createElement("button");
    addBtn.className = "notebook-add-cell-btn";
    addBtn.textContent = "+ Add Cell";
    addBtn.addEventListener("click", () => this.addCell());
    this.container.appendChild(addBtn);

    // Now render notation into cells that are in the DOM
    // Use requestAnimationFrame to ensure DOM is fully rendered before measuring
    requestAnimationFrame(() => {
      cellElements.forEach(({ cellEl, cell, isEditing }) => {
        if (!isEditing) {
          this.renderCellNotation(cellEl, cell);
        }
      });
    });
  }

  private renderCellStructure(cell: Cell, index: number, isEditing: boolean): HTMLElement {
    const cellEl = document.createElement("div");
    cellEl.className = `notebook-cell ${isEditing ? "notebook-cell-editing" : ""}`;
    cellEl.dataset.cellId = cell.id;
    cellEl.draggable = !isEditing;

    // Drag events
    cellEl.addEventListener("dragstart", (e) => this.onDragStart(e, cell.id));
    cellEl.addEventListener("dragover", (e) => this.onDragOver(e));
    cellEl.addEventListener("drop", (e) => this.onDrop(e, cell.id));
    cellEl.addEventListener("dragend", () => this.onDragEnd());

    // Header
    const header = document.createElement("div");
    header.className = "notebook-cell-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "notebook-cell-header-left";

    // Drag handle
    const dragHandle = document.createElement("span");
    dragHandle.className = "notebook-drag-handle";
    dragHandle.textContent = "⋮⋮";
    dragHandle.title = "Drag to reorder";
    headerLeft.appendChild(dragHandle);

    // Cell name
    const nameSpan = document.createElement("span");
    nameSpan.className = "notebook-cell-name";
    nameSpan.textContent = cell.name;
    headerLeft.appendChild(nameSpan);

    header.appendChild(headerLeft);

    // Controls
    const controls = document.createElement("div");
    controls.className = "notebook-cell-controls";

    if (isEditing) {
      // Apply button
      const applyBtn = document.createElement("button");
      applyBtn.className = "notebook-btn notebook-apply-btn";
      applyBtn.textContent = "Apply";
      applyBtn.addEventListener("click", () => this.applyEdit(cell.id));
      controls.appendChild(applyBtn);

      // Cancel button
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "notebook-btn notebook-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => this.cancelEdit());
      controls.appendChild(cancelBtn);
    } else {
      // Edit button
      const editBtn = document.createElement("button");
      editBtn.className = "notebook-btn notebook-edit-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => this.startEdit(cell.id));
      controls.appendChild(editBtn);

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "notebook-btn notebook-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => this.deleteCell(cell.id));
      controls.appendChild(deleteBtn);
    }

    header.appendChild(controls);
    cellEl.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "notebook-cell-content";

    if (isEditing) {
      // Edit mode - show textarea
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "notebook-name-input";
      nameInput.value = cell.name;
      nameInput.placeholder = "Cell name";
      nameInput.dataset.field = "name";
      content.appendChild(nameInput);

      const textarea = document.createElement("textarea");
      textarea.className = "notebook-edit-textarea";
      textarea.value = cell.source;
      textarea.rows = Math.max(3, cell.source.split("\n").length + 1);
      textarea.dataset.field = "source";
      content.appendChild(textarea);
    } else {
      // Preview mode - add placeholder for notation (rendered after DOM attachment)
      const preview = document.createElement("div");
      preview.className = "notebook-cell-preview";
      content.appendChild(preview);
    }

    cellEl.appendChild(content);
    return cellEl;
  }

  private renderCellNotation(cellEl: HTMLElement, cell: Cell): void {
    const preview = cellEl.querySelector(".notebook-cell-preview");
    if (!preview) return;

    // Build source for just this cell with preamble
    const cellSource = `${this.currentSample?.preamble || ""}
\\line("${cell.name}")
${cell.source}`;

    const [notation, beatLayout, errors] = N.load(cellSource, { log: true });

    if (errors.length > 0) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "notebook-cell-error";
      errorDiv.textContent = `Error: ${errors[0].message || errors[0]}`;
      preview.appendChild(errorDiv);
    } else {
      // NotationView creates its own table inside the container element
      const notationContainer = document.createElement("div");
      notationContainer.className = "notation-container";
      preview.appendChild(notationContainer);

      const notationView = NV.createViewer(notationContainer);
      notationView.renderNotation(notation, beatLayout);
    }
  }

  private startEdit(cellId: string): void {
    this.editingCellId = cellId;
    this.render();
    this.log(`Editing cell`, "info");
  }

  private applyEdit(cellId: string): void {
    const cellEl = this.container?.querySelector(`[data-cell-id="${cellId}"]`);
    if (!cellEl) return;

    const nameInput = cellEl.querySelector('input[data-field="name"]') as HTMLInputElement;
    const textarea = cellEl.querySelector('textarea[data-field="source"]') as HTMLTextAreaElement;

    if (!nameInput || !textarea) return;

    const cell = this.cells.find((c) => c.id === cellId);
    if (cell) {
      cell.name = nameInput.value;
      cell.source = textarea.value;
    }

    this.editingCellId = null;
    this.render();
    this.log(`Applied changes`, "info");
  }

  private cancelEdit(): void {
    this.editingCellId = null;
    this.render();
    this.log(`Cancelled edit`, "info");
  }

  private deleteCell(cellId: string): void {
    const index = this.cells.findIndex((c) => c.id === cellId);
    if (index >= 0) {
      const cell = this.cells[index];
      this.cells.splice(index, 1);
      this.render();
      this.log(`Deleted cell: ${cell.name}`, "info");
    }
  }

  private addCell(): void {
    const newCell: Cell = {
      id: generateCellId(),
      name: `New Cell ${this.cells.length + 1}`,
      source: `Sw: S R G M`,
    };
    this.cells.push(newCell);
    this.editingCellId = newCell.id;
    this.render();
    this.log(`Added new cell`, "info");
  }

  // Drag and drop handlers
  private onDragStart(e: DragEvent, cellId: string): void {
    this.draggedCellId = cellId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
    const target = e.target as HTMLElement;
    target.classList.add("dragging");
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  private onDrop(e: DragEvent, targetCellId: string): void {
    e.preventDefault();
    if (!this.draggedCellId || this.draggedCellId === targetCellId) return;

    const draggedIndex = this.cells.findIndex((c) => c.id === this.draggedCellId);
    const targetIndex = this.cells.findIndex((c) => c.id === targetCellId);

    if (draggedIndex >= 0 && targetIndex >= 0) {
      // Remove dragged cell and insert at target position
      const [draggedCell] = this.cells.splice(draggedIndex, 1);
      this.cells.splice(targetIndex, 0, draggedCell);
      this.render();
      this.log(`Moved cell to position ${targetIndex + 1}`, "info");
    }
  }

  private onDragEnd(): void {
    this.draggedCellId = null;
    document.querySelectorAll(".notebook-cell.dragging").forEach((el) => {
      el.classList.remove("dragging");
    });
  }

  private log(message: string, level: "info" | "error" = "info"): void {
    if (!this.consoleOutput) return;

    const line = document.createElement("div");
    line.className = `console-line console-${level}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.consoleOutput.appendChild(line);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("notebook-playground-container")) {
    (window as any).notebookPlayground = new NotebookPlayground();
  }
});
