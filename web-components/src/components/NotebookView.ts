/**
 * NotebookView - Main container for notebook-style notation editing.
 *
 * The NotebookView owns a shared GridLayoutGroup and manages a collection
 * of cells, each representing a Block from the notation.
 */

import * as N from "notations";
import {
  NotebookConfig,
  CellModel,
  CellOperations,
  LayoutChangeEvent,
} from "../types/notebook";
import {
  createCellModels,
  findCellById,
  findCellIndex,
  flattenCells,
  getVisibleCells,
  updateCellState,
} from "../utils/cellFactory";

/**
 * Default configuration for NotebookView.
 */
const DEFAULT_CONFIG: NotebookConfig = {
  maxDepth: 1,
  enableReordering: false,
  enableAddCell: true,
  enableDeleteCell: true,
};

/**
 * NotebookView manages a notebook-style view of notation with editable cells.
 *
 * Features:
 * - Shared GridLayoutGroup for column alignment across all cells
 * - Cell-based editing with preview/edit modes
 * - Support for nested blocks up to configurable depth
 * - Optional cell reordering, adding, and deleting
 */
export default class NotebookView implements CellOperations {
  /** The root HTML element */
  readonly rootElement: HTMLDivElement;

  /** Configuration options */
  readonly config: NotebookConfig;

  /** Shared grid layout group for column alignment */
  readonly gridLayoutGroup: N.GridLayoutGroup;

  /** The current notation */
  private notation: N.Notation | null = null;

  /** The full notation source */
  private notationSource: string = "";

  /** Cell models representing the notebook structure */
  private cells: CellModel[] = [];

  /** Map of cell ID to its rendered container element */
  private cellElements = new Map<string, HTMLElement>();

  /** Map of cell ID to its NotationView (for notation cells) */
  private cellNotationViews = new Map<string, N.Carnatic.NotationView>();

  /** Unsubscribe function for layout change listener */
  private layoutChangeUnsubscribe: (() => void) | null = null;

  /**
   * Creates a new NotebookView.
   *
   * @param container The container element to render into
   * @param config Configuration options
   */
  constructor(container: HTMLElement, config: Partial<NotebookConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create root element
    this.rootElement = document.createElement("div");
    this.rootElement.className = "notebook-view";
    if (this.config.cssClasses?.root) {
      this.rootElement.className += " " + this.config.cssClasses.root;
    }
    container.appendChild(this.rootElement);

    // Create or use shared grid layout group
    this.gridLayoutGroup = this.config.sharedGridLayoutGroup ?? new N.GridLayoutGroup();

    // Subscribe to layout changes
    this.layoutChangeUnsubscribe = this.gridLayoutGroup.onLayoutChange((event) => {
      this.handleLayoutChange(event);
    });
  }

  /**
   * Loads notation from source text.
   *
   * @param source The notation source text
   */
  loadNotation(source: string): void {
    this.notationSource = source;

    // Parse the notation
    const [notation, beatLayout, errors] = N.load(source, { log: false });

    if (errors.length > 0) {
      console.error("Notation parse errors:", errors);
      // TODO: Show errors in UI
      return;
    }

    this.notation = notation;

    // Create cell models from the notation
    this.cells = createCellModels(notation, {
      maxDepth: this.config.maxDepth,
      notationSource: source,
      includeLines: true,
      includeRawBlocks: true,
    });

    // Render all cells
    this.render();
  }

  /**
   * Gets the current notation.
   */
  getNotation(): N.Notation | null {
    return this.notation;
  }

  /**
   * Gets all cell models.
   */
  getCells(): CellModel[] {
    return this.cells;
  }

  /**
   * Gets visible cells (respecting expanded state).
   */
  getVisibleCells(): CellModel[] {
    return getVisibleCells(this.cells);
  }

  /**
   * Gets a cell by ID.
   */
  getCell(cellId: string): CellModel | null {
    return findCellById(this.cells, cellId);
  }

  /**
   * Renders the notebook.
   */
  private render(): void {
    // Clear existing content
    this.rootElement.innerHTML = "";
    this.cellElements.clear();
    this.cellNotationViews.clear();

    // Render each top-level cell
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      this.renderCell(cell, this.rootElement);

      // Add "add cell" button between cells if enabled
      if (this.config.enableAddCell && i < this.cells.length - 1) {
        this.renderAddCellButton(this.rootElement, i + 1);
      }
    }

    // Add final "add cell" button if enabled
    if (this.config.enableAddCell) {
      this.renderAddCellButton(this.rootElement, this.cells.length);
    }
  }

  /**
   * Renders a single cell.
   */
  private renderCell(cell: CellModel, parent: HTMLElement): void {
    const cellClass = this.config.cssClasses?.cell || "";
    const container = document.createElement("div");
    container.className = `notebook-cell notebook-cell-${cell.state.type} ${cellClass}`;
    container.dataset.cellId = cell.state.id;
    container.dataset.depth = String(cell.state.depth);

    // Render cell header
    this.renderCellHeader(cell, container);

    // Render cell content
    const contentContainer = document.createElement("div");
    contentContainer.className = "notebook-cell-content";
    if (this.config.cssClasses?.cellContent) {
      contentContainer.className += " " + this.config.cssClasses.cellContent;
    }
    container.appendChild(contentContainer);

    if (cell.state.isEditing) {
      this.renderCellEditMode(cell, contentContainer);
    } else {
      this.renderCellPreviewMode(cell, contentContainer);
    }

    // Store reference
    this.cellElements.set(cell.state.id, container);
    parent.appendChild(container);

    // Render children if expanded
    if (cell.state.isExpanded && cell.children.length > 0) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "notebook-cell-children";
      container.appendChild(childrenContainer);

      for (const child of cell.children) {
        this.renderCell(child, childrenContainer);
      }
    }
  }

  /**
   * Renders the cell header with type badge, name, and controls.
   */
  private renderCellHeader(cell: CellModel, container: HTMLElement): void {
    const headerClass = this.config.cssClasses?.cellHeader || "";
    const header = document.createElement("div");
    header.className = `notebook-cell-header ${headerClass}`;

    // Type badge
    const badge = document.createElement("span");
    badge.className = `notebook-cell-badge badge-${cell.state.type}`;
    badge.textContent = cell.state.type;
    header.appendChild(badge);

    // Name (if block has a name)
    if (N.isBlock(cell.blockItem)) {
      const block = cell.blockItem as N.Block;
      if (block.name) {
        const name = document.createElement("span");
        name.className = "notebook-cell-name";
        name.textContent = block.name;
        header.appendChild(name);
      }
    }

    // Expand/collapse button for cells with children
    if (cell.children.length > 0) {
      const expandBtn = document.createElement("button");
      expandBtn.className = "notebook-btn notebook-expand-btn";
      expandBtn.textContent = cell.state.isExpanded ? "▼" : "▶";
      expandBtn.title = cell.state.isExpanded ? "Collapse" : "Expand";
      expandBtn.addEventListener("click", () => this.toggleExpanded(cell.state.id));
      header.appendChild(expandBtn);
    }

    // Controls container
    const controlsClass = this.config.cssClasses?.cellControls || "";
    const controls = document.createElement("div");
    controls.className = `notebook-cell-controls ${controlsClass}`;

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "notebook-btn notebook-edit-btn";
    editBtn.textContent = cell.state.isEditing ? "Cancel" : "Edit";
    editBtn.addEventListener("click", () => {
      if (cell.state.isEditing) {
        this.cancelEdit(cell.state.id);
      } else {
        this.startEdit(cell.state.id);
      }
    });
    controls.appendChild(editBtn);

    // Delete button (if enabled)
    if (this.config.enableDeleteCell) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "notebook-btn notebook-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => this.deleteCell(cell.state.id));
      controls.appendChild(deleteBtn);
    }

    header.appendChild(controls);
    container.appendChild(header);

    // Error message (if any)
    if (cell.state.hasError && cell.state.errorMessage) {
      const errorClass = this.config.cssClasses?.errorMessage || "";
      const errorDiv = document.createElement("div");
      errorDiv.className = `notebook-cell-error ${errorClass}`;
      errorDiv.textContent = cell.state.errorMessage;
      container.appendChild(errorDiv);
    }
  }

  /**
   * Renders cell content in preview mode.
   */
  private renderCellPreviewMode(cell: CellModel, container: HTMLElement): void {
    if (N.isRawBlock(cell.blockItem)) {
      // Render RawBlock content (markdown or plain text)
      const rawBlock = cell.blockItem as N.RawBlock;
      const content = document.createElement("div");
      content.className = "notebook-rawblock-content";

      if (this.config.markdownParser && rawBlock.contentType === "md") {
        content.innerHTML = this.config.markdownParser(rawBlock.content);
      } else {
        content.textContent = rawBlock.content;
      }
      container.appendChild(content);
    } else if (N.isLine(cell.blockItem) || N.isBlock(cell.blockItem)) {
      // Render notation content using NotationView
      const viewContainer = document.createElement("div");
      viewContainer.className = "notebook-notation-view";
      container.appendChild(viewContainer);

      // Create NotationView sharing the grid layout group
      const notationView = new N.Carnatic.NotationView(viewContainer, {
        sharedGridLayoutGroup: this.gridLayoutGroup,
        markdownParser: this.config.markdownParser,
      });

      this.cellNotationViews.set(cell.state.id, notationView);

      // For now, render placeholder - full implementation would need
      // to create a mini-notation from just this cell's content
      // This is a simplified version that shows the cell exists
      const placeholder = document.createElement("div");
      placeholder.className = "notebook-notation-placeholder";
      placeholder.textContent = `[${cell.state.type} notation content]`;
      viewContainer.appendChild(placeholder);
    }
  }

  /**
   * Renders cell content in edit mode.
   */
  private renderCellEditMode(cell: CellModel, container: HTMLElement): void {
    const textareaClass = this.config.cssClasses?.editTextarea || "";
    const textarea = document.createElement("textarea");
    textarea.className = `notebook-edit-textarea ${textareaClass}`;
    textarea.value = cell.source;
    textarea.rows = Math.max(3, cell.source.split("\n").length);
    container.appendChild(textarea);

    // Apply/Cancel buttons
    const actions = document.createElement("div");
    actions.className = "notebook-edit-actions";

    const applyBtn = document.createElement("button");
    applyBtn.className = "notebook-btn notebook-apply-btn";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => {
      this.applyEdit(cell.state.id, textarea.value);
    });
    actions.appendChild(applyBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "notebook-btn notebook-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.cancelEdit(cell.state.id));
    actions.appendChild(cancelBtn);

    container.appendChild(actions);
  }

  /**
   * Renders an "add cell" button.
   */
  private renderAddCellButton(parent: HTMLElement, insertIndex: number): void {
    const btnClass = this.config.cssClasses?.addCellButton || "";
    const btn = document.createElement("button");
    btn.className = `notebook-add-cell-btn ${btnClass}`;
    btn.textContent = "+ Add Cell";
    btn.addEventListener("click", () => {
      const newCell = this.insertCell(insertIndex, "");
      this.startEdit(newCell.state.id);
    });
    parent.appendChild(btn);
  }

  /**
   * Handles layout change events from the shared GridLayoutGroup.
   */
  private handleLayoutChange(event: LayoutChangeEvent): void {
    // Notify external listener if configured
    if (this.config.onLayoutChange) {
      this.config.onLayoutChange(event);
    }

    // If dimensions didn't change, no need to update views
    if (!event.columnWidthsChanged && !event.rowHeightsChanged) {
      return;
    }

    // TODO: Implement incremental re-render based on affected range
    // For now, this is a placeholder for future optimization
  }

  // ============================================
  // CellOperations implementation
  // ============================================

  /**
   * Enters edit mode for a cell.
   */
  startEdit(cellId: string): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    // Update cell state
    const updatedCell = updateCellState(cell, { isEditing: true });
    this.replaceCellInTree(cell, updatedCell);

    // Re-render the cell
    this.rerenderCell(updatedCell);
  }

  /**
   * Applies edit and exits edit mode.
   */
  applyEdit(cellId: string, newSource: string): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    // TODO: Parse newSource and update the block
    // For now, just update the source and exit edit mode
    const updatedCell: CellModel = {
      ...cell,
      source: newSource,
      state: {
        ...cell.state,
        isEditing: false,
        hasError: false,
        errorMessage: undefined,
      },
    };

    this.replaceCellInTree(cell, updatedCell);
    this.rerenderCell(updatedCell);

    // Notify change listener
    if (this.config.onNotationChange) {
      // TODO: Serialize cells back to source
      this.config.onNotationChange(this.notationSource, this.notation);
    }
  }

  /**
   * Cancels edit mode without applying changes.
   */
  cancelEdit(cellId: string): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    const updatedCell = updateCellState(cell, { isEditing: false });
    this.replaceCellInTree(cell, updatedCell);
    this.rerenderCell(updatedCell);
  }

  /**
   * Deletes a cell.
   */
  deleteCell(cellId: string): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    // Remove from parent's children or top-level cells
    if (cell.parent) {
      const index = cell.parent.children.indexOf(cell);
      if (index >= 0) {
        cell.parent.children.splice(index, 1);
      }
    } else {
      const index = this.cells.indexOf(cell);
      if (index >= 0) {
        this.cells.splice(index, 1);
      }
    }

    // Remove DOM element
    const element = this.cellElements.get(cellId);
    if (element) {
      element.remove();
      this.cellElements.delete(cellId);
    }

    // Clean up NotationView
    this.cellNotationViews.delete(cellId);
  }

  /**
   * Moves a cell to a new position.
   */
  moveCell(cellId: string, targetIndex: number): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    // For now, only support moving top-level cells
    if (cell.parent) {
      console.warn("Moving nested cells not yet supported");
      return;
    }

    const currentIndex = this.cells.indexOf(cell);
    if (currentIndex < 0 || currentIndex === targetIndex) return;

    // Remove and reinsert
    this.cells.splice(currentIndex, 1);
    this.cells.splice(targetIndex, 0, cell);

    // Re-render
    this.render();
  }

  /**
   * Inserts a new cell at the given index.
   */
  insertCell(index: number, source: string): CellModel {
    // Create a new RawBlock for the cell
    const rawBlock = new N.RawBlock(source, "notation");

    // Create cell model
    const cell: CellModel = {
      blockItem: rawBlock,
      state: {
        id: `cell-${Date.now()}`,
        type: "rawblock",
        depth: 0,
        isExpanded: true,
        isEditing: false,
        hasError: false,
      },
      source,
      children: [],
      parent: null,
    };

    // Insert at index
    this.cells.splice(index, 0, cell);

    // Re-render
    this.render();

    return cell;
  }

  /**
   * Toggles expanded state for a cell with children.
   */
  toggleExpanded(cellId: string): void {
    const cell = findCellById(this.cells, cellId);
    if (!cell) return;

    const updatedCell = updateCellState(cell, {
      isExpanded: !cell.state.isExpanded,
    });
    this.replaceCellInTree(cell, updatedCell);
    this.rerenderCell(updatedCell);
  }

  // ============================================
  // Helper methods
  // ============================================

  /**
   * Replaces a cell in the tree with an updated version.
   */
  private replaceCellInTree(oldCell: CellModel, newCell: CellModel): void {
    if (oldCell.parent) {
      const index = oldCell.parent.children.indexOf(oldCell);
      if (index >= 0) {
        oldCell.parent.children[index] = newCell;
        newCell.parent = oldCell.parent;
      }
    } else {
      const index = this.cells.indexOf(oldCell);
      if (index >= 0) {
        this.cells[index] = newCell;
      }
    }
  }

  /**
   * Re-renders a single cell (and its children).
   */
  private rerenderCell(cell: CellModel): void {
    const element = this.cellElements.get(cell.state.id);
    if (!element || !element.parentElement) return;

    const parent = element.parentElement;
    const nextSibling = element.nextSibling;

    // Remove old element
    element.remove();
    this.cellElements.delete(cell.state.id);
    this.cellNotationViews.delete(cell.state.id);

    // Create new element
    const tempContainer = document.createElement("div");
    this.renderCell(cell, tempContainer);

    // Insert at same position
    const newElement = tempContainer.firstChild as HTMLElement;
    if (nextSibling) {
      parent.insertBefore(newElement, nextSibling);
    } else {
      parent.appendChild(newElement);
    }
  }

  /**
   * Cleans up resources when the view is destroyed.
   */
  destroy(): void {
    // Unsubscribe from layout changes
    if (this.layoutChangeUnsubscribe) {
      this.layoutChangeUnsubscribe();
      this.layoutChangeUnsubscribe = null;
    }

    // Clear DOM
    this.rootElement.innerHTML = "";
    this.cellElements.clear();
    this.cellNotationViews.clear();
  }
}
