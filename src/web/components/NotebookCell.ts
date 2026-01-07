/**
 * NotebookCell - Individual cell component for notebook-style editing.
 *
 * A cell represents a single BlockItem (Block, Line, or RawBlock) with
 * preview/edit modes, controls, and optional nested children.
 */

import { isBlock, isLine, isRawBlock, Block, RawBlock } from "../../block";
import { CellModel, CellTypeBadge, getCellTypeBadge, NotebookCssClasses } from "../types/notebook";

/**
 * Configuration for NotebookCell.
 */
export interface NotebookCellConfig {
  /** CSS classes for cell elements */
  cssClasses?: NotebookCssClasses;

  /** Markdown parser for RawBlock content */
  markdownParser?: (content: string) => string;

  /** Whether to show delete button */
  showDeleteButton?: boolean;

  /** Whether to show move buttons (for reordering) */
  showMoveButtons?: boolean;

  /** Callback when edit is started */
  onStartEdit?: (cellId: string) => void;

  /** Callback when edit is applied */
  onApplyEdit?: (cellId: string, newSource: string) => void;

  /** Callback when edit is cancelled */
  onCancelEdit?: (cellId: string) => void;

  /** Callback when cell is deleted */
  onDelete?: (cellId: string) => void;

  /** Callback when cell is moved up */
  onMoveUp?: (cellId: string) => void;

  /** Callback when cell is moved down */
  onMoveDown?: (cellId: string) => void;

  /** Callback when expand/collapse is toggled */
  onToggleExpanded?: (cellId: string) => void;

  /** Factory to create child cells (for nesting) */
  createChildCell?: (cell: CellModel, parent: HTMLElement) => NotebookCell;
}

/**
 * NotebookCell renders a single cell with header, content, and controls.
 *
 * Features:
 * - Type badge showing block type
 * - Preview mode showing rendered content
 * - Edit mode with textarea
 * - Controls for edit, delete, move
 * - Support for nested children
 */
export default class NotebookCell {
  /** The root element for this cell */
  readonly element: HTMLDivElement;

  /** The cell model */
  readonly cell: CellModel;

  /** Configuration */
  readonly config: NotebookCellConfig;

  /** Child cell instances (for nested blocks) */
  private childCells: NotebookCell[] = [];

  /** Reference to textarea in edit mode */
  private editTextarea: HTMLTextAreaElement | null = null;

  /**
   * Creates a new NotebookCell.
   *
   * @param cell The cell model to render
   * @param config Configuration options
   */
  constructor(cell: CellModel, config: NotebookCellConfig = {}) {
    this.cell = cell;
    this.config = config;

    // Create root element
    this.element = document.createElement("div");
    this.element.className = this.buildRootClassName();
    this.element.dataset.cellId = cell.state.id;
    this.element.dataset.depth = String(cell.state.depth);

    // Render content
    this.render();
  }

  /**
   * Builds the root element class name.
   */
  private buildRootClassName(): string {
    const classes = [
      "notebook-cell",
      `notebook-cell-${this.cell.state.type}`,
      `notebook-cell-depth-${this.cell.state.depth}`,
    ];

    if (this.cell.state.isEditing) {
      classes.push("notebook-cell-editing");
    }
    if (this.cell.state.hasError) {
      classes.push("notebook-cell-error");
    }
    if (!this.cell.state.isExpanded && this.cell.children.length > 0) {
      classes.push("notebook-cell-collapsed");
    }

    if (this.config.cssClasses?.cell) {
      classes.push(this.config.cssClasses.cell);
    }

    return classes.join(" ");
  }

  /**
   * Renders the cell content.
   */
  private render(): void {
    this.element.innerHTML = "";

    // Render header
    this.renderHeader();

    // Render error message if any
    if (this.cell.state.hasError && this.cell.state.errorMessage) {
      this.renderError();
    }

    // Render content (preview or edit mode)
    this.renderContent();

    // Render children if expanded
    if (this.cell.state.isExpanded && this.cell.children.length > 0) {
      this.renderChildren();
    }
  }

  /**
   * Renders the cell header.
   */
  private renderHeader(): void {
    const header = document.createElement("div");
    header.className = "notebook-cell-header";
    if (this.config.cssClasses?.cellHeader) {
      header.className += " " + this.config.cssClasses.cellHeader;
    }

    // Left side: badge, name, expand/collapse
    const leftSide = document.createElement("div");
    leftSide.className = "notebook-cell-header-left";

    // Type badge
    const badge = this.createBadge();
    leftSide.appendChild(badge);

    // Name (if block has one)
    if (isBlock(this.cell.blockItem)) {
      const block = this.cell.blockItem as Block;
      if (block.name) {
        const nameSpan = document.createElement("span");
        nameSpan.className = "notebook-cell-name";
        nameSpan.textContent = block.name;
        leftSide.appendChild(nameSpan);
      }
    }

    // Expand/collapse toggle for cells with children
    if (this.cell.children.length > 0) {
      const expandBtn = document.createElement("button");
      expandBtn.className = "notebook-btn notebook-expand-btn";
      expandBtn.innerHTML = this.cell.state.isExpanded
        ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="currentColor" fill="none"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" stroke="currentColor" fill="none"/></svg>';
      expandBtn.title = this.cell.state.isExpanded ? "Collapse" : "Expand";
      expandBtn.addEventListener("click", () => this.handleToggleExpanded());
      leftSide.appendChild(expandBtn);

      // Child count
      const countSpan = document.createElement("span");
      countSpan.className = "notebook-cell-child-count";
      countSpan.textContent = `(${this.cell.children.length})`;
      leftSide.appendChild(countSpan);
    }

    header.appendChild(leftSide);

    // Right side: controls
    const controls = this.createControls();
    header.appendChild(controls);

    this.element.appendChild(header);
  }

  /**
   * Creates the type badge element.
   */
  private createBadge(): HTMLSpanElement {
    const badgeInfo = getCellTypeBadge(this.cell.state.type);
    const badge = document.createElement("span");
    badge.className = `notebook-cell-badge ${badgeInfo.cssClass}`;
    badge.textContent = badgeInfo.label;
    return badge;
  }

  /**
   * Creates the controls container.
   */
  private createControls(): HTMLDivElement {
    const controls = document.createElement("div");
    controls.className = "notebook-cell-controls";
    if (this.config.cssClasses?.cellControls) {
      controls.className += " " + this.config.cssClasses.cellControls;
    }

    // Move buttons (if enabled and not in edit mode)
    if (this.config.showMoveButtons && !this.cell.state.isEditing) {
      const moveUpBtn = document.createElement("button");
      moveUpBtn.className = "notebook-btn notebook-move-btn";
      moveUpBtn.innerHTML = "↑";
      moveUpBtn.title = "Move up";
      moveUpBtn.addEventListener("click", () => this.config.onMoveUp?.(this.cell.state.id));
      controls.appendChild(moveUpBtn);

      const moveDownBtn = document.createElement("button");
      moveDownBtn.className = "notebook-btn notebook-move-btn";
      moveDownBtn.innerHTML = "↓";
      moveDownBtn.title = "Move down";
      moveDownBtn.addEventListener("click", () => this.config.onMoveDown?.(this.cell.state.id));
      controls.appendChild(moveDownBtn);
    }

    // Edit/Cancel button
    const editBtn = document.createElement("button");
    editBtn.className = "notebook-btn notebook-edit-btn";
    if (this.cell.state.isEditing) {
      editBtn.textContent = "Cancel";
      editBtn.addEventListener("click", () => this.handleCancelEdit());
    } else {
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => this.handleStartEdit());
    }
    controls.appendChild(editBtn);

    // Delete button (if enabled and not in edit mode)
    if (this.config.showDeleteButton && !this.cell.state.isEditing) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "notebook-btn notebook-delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => this.handleDelete());
      controls.appendChild(deleteBtn);
    }

    return controls;
  }

  /**
   * Renders the error message.
   */
  private renderError(): void {
    const errorDiv = document.createElement("div");
    errorDiv.className = "notebook-cell-error-message";
    if (this.config.cssClasses?.errorMessage) {
      errorDiv.className += " " + this.config.cssClasses.errorMessage;
    }
    errorDiv.textContent = this.cell.state.errorMessage || "Error";
    this.element.appendChild(errorDiv);
  }

  /**
   * Renders the cell content (preview or edit mode).
   */
  private renderContent(): void {
    const content = document.createElement("div");
    content.className = "notebook-cell-content";
    if (this.config.cssClasses?.cellContent) {
      content.className += " " + this.config.cssClasses.cellContent;
    }

    if (this.cell.state.isEditing) {
      this.renderEditMode(content);
    } else {
      this.renderPreviewMode(content);
    }

    this.element.appendChild(content);
  }

  /**
   * Renders preview mode content.
   */
  private renderPreviewMode(container: HTMLElement): void {
    if (isRawBlock(this.cell.blockItem)) {
      const rawBlock = this.cell.blockItem as RawBlock;
      const contentDiv = document.createElement("div");
      contentDiv.className = "notebook-rawblock-content";

      if (this.config.markdownParser && rawBlock.contentType === "md") {
        contentDiv.innerHTML = this.config.markdownParser(rawBlock.content);
      } else {
        contentDiv.textContent = rawBlock.content;
      }
      container.appendChild(contentDiv);
    } else {
      // For Line and Block, show a placeholder or summary
      const preview = document.createElement("div");
      preview.className = "notebook-notation-preview";

      if (isLine(this.cell.blockItem)) {
        preview.textContent = "[Line content]";
      } else if (isBlock(this.cell.blockItem)) {
        const block = this.cell.blockItem as Block;
        const itemCount = block.blockItems.length;
        preview.textContent = `[${block.blockType}: ${itemCount} item${itemCount !== 1 ? "s" : ""}]`;
      }
      container.appendChild(preview);
    }
  }

  /**
   * Renders edit mode content.
   */
  private renderEditMode(container: HTMLElement): void {
    // Textarea for editing
    this.editTextarea = document.createElement("textarea");
    this.editTextarea.className = "notebook-edit-textarea";
    if (this.config.cssClasses?.editTextarea) {
      this.editTextarea.className += " " + this.config.cssClasses.editTextarea;
    }
    this.editTextarea.value = this.cell.source;
    this.editTextarea.rows = Math.max(3, this.cell.source.split("\n").length + 1);
    container.appendChild(this.editTextarea);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "notebook-edit-actions";

    const applyBtn = document.createElement("button");
    applyBtn.className = "notebook-btn notebook-apply-btn";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => this.handleApplyEdit());
    actions.appendChild(applyBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "notebook-btn notebook-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.handleCancelEdit());
    actions.appendChild(cancelBtn);

    container.appendChild(actions);

    // Focus textarea
    setTimeout(() => this.editTextarea?.focus(), 0);
  }

  /**
   * Renders child cells.
   */
  private renderChildren(): void {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "notebook-cell-children";
    this.element.appendChild(childrenContainer);

    // Clear existing child cells
    this.childCells = [];

    // Create child cells
    for (const childModel of this.cell.children) {
      if (this.config.createChildCell) {
        const childCell = this.config.createChildCell(childModel, childrenContainer);
        this.childCells.push(childCell);
      } else {
        // Default: create NotebookCell with same config
        const childCell = new NotebookCell(childModel, this.config);
        childrenContainer.appendChild(childCell.element);
        this.childCells.push(childCell);
      }
    }
  }

  // ============================================
  // Event handlers
  // ============================================

  private handleStartEdit(): void {
    this.config.onStartEdit?.(this.cell.state.id);
  }

  private handleApplyEdit(): void {
    const newSource = this.editTextarea?.value || "";
    this.config.onApplyEdit?.(this.cell.state.id, newSource);
  }

  private handleCancelEdit(): void {
    this.config.onCancelEdit?.(this.cell.state.id);
  }

  private handleDelete(): void {
    this.config.onDelete?.(this.cell.state.id);
  }

  private handleToggleExpanded(): void {
    this.config.onToggleExpanded?.(this.cell.state.id);
  }

  // ============================================
  // Public methods
  // ============================================

  /**
   * Gets the current source text from the edit textarea.
   */
  getEditSource(): string {
    return this.editTextarea?.value || this.cell.source;
  }

  /**
   * Updates the cell with a new model and re-renders.
   */
  update(newCell: CellModel): void {
    // Update reference (cast away readonly for internal update)
    (this as { cell: CellModel }).cell = newCell;

    // Update class name
    this.element.className = this.buildRootClassName();

    // Re-render
    this.render();
  }

  /**
   * Destroys the cell and cleans up resources.
   */
  destroy(): void {
    // Destroy child cells
    for (const child of this.childCells) {
      child.destroy();
    }
    this.childCells = [];

    // Remove element
    this.element.remove();
  }
}
