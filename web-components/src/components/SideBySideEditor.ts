/**
 * SideBySideEditor - Manages editor and output components for side-by-side editing.
 *
 * This component handles:
 * - Creating editor textarea and NotationView output
 * - Scroll synchronization between editor and output
 * - Parsing and rendering on source changes
 *
 * Layout is NOT managed by this component - the client is responsible for
 * arranging the editor and output elements (e.g., using CSS grid, flexbox,
 * DockView, or any other layout system).
 */

import * as N from "notations";

/**
 * Configuration for SideBySideEditor.
 */
export interface SideBySideEditorConfig {
  /**
   * Initial source text.
   */
  initialSource?: string;

  /**
   * Debounce delay (ms) for auto-parsing on input.
   * Set to 0 to disable auto-parsing.
   * @default 300
   */
  debounceDelay?: number;

  /**
   * Whether to enable scroll synchronization.
   * @default true
   */
  syncScroll?: boolean;

  /**
   * Callback when source changes.
   */
  onSourceChange?: (source: string) => void;

  /**
   * Callback when notation is successfully parsed.
   */
  onNotationParsed?: (notation: N.Notation, beatLayout: N.GlobalBeatLayout) => void;

  /**
   * Callback when parsing fails.
   */
  onParseError?: (errors: any[]) => void;

  /**
   * Optional shared GridLayoutGroup for column alignment.
   */
  sharedGridLayoutGroup?: N.GridLayoutGroup;

  /**
   * Optional markdown parser for RawBlock content.
   */
  markdownParser?: (content: string) => string;

  /**
   * CSS class for the editor textarea.
   */
  editorClass?: string;

  /**
   * CSS class for the output container.
   */
  outputClass?: string;
}

const DEFAULT_CONFIG: SideBySideEditorConfig = {
  debounceDelay: 300,
  syncScroll: true,
};

/**
 * SideBySideEditor creates and manages editor and output components.
 *
 * Usage:
 * ```typescript
 * const editor = new SideBySideEditor({
 *   initialSource: "s r g m p",
 *   onSourceChange: (source) => console.log("Source:", source),
 * });
 *
 * // Get the elements to place in your layout
 * const editorElement = editor.editorElement;
 * const outputElement = editor.outputElement;
 *
 * // Place them in your layout (e.g., dockview, grid, etc.)
 * leftPanel.appendChild(editorElement);
 * rightPanel.appendChild(outputElement);
 * ```
 */
export default class SideBySideEditor {
  /** The editor textarea element */
  readonly editorElement: HTMLTextAreaElement;

  /** The output container element (contains NotationView) */
  readonly outputElement: HTMLDivElement;

  /** The NotationView instance */
  readonly notationView: N.Carnatic.NotationView;

  /** Configuration */
  readonly config: SideBySideEditorConfig;

  /** Current notation (after successful parse) */
  private notation: N.Notation | null = null;

  /** Current beat layout (after successful parse) */
  private beatLayout: N.GlobalBeatLayout | null = null;

  /** Debounce timer */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether scroll sync is active */
  private isScrollSyncing = false;

  /**
   * Creates a new SideBySideEditor.
   *
   * @param config Configuration options
   */
  constructor(config: SideBySideEditorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create editor textarea
    this.editorElement = document.createElement("textarea");
    this.editorElement.className = "side-by-side-editor";
    if (this.config.editorClass) {
      this.editorElement.className += " " + this.config.editorClass;
    }
    this.editorElement.spellcheck = false;
    this.editorElement.placeholder = "Enter notation source...";

    // Set initial source
    if (this.config.initialSource) {
      this.editorElement.value = this.config.initialSource;
    }

    // Create output container
    this.outputElement = document.createElement("div");
    this.outputElement.className = "side-by-side-output";
    if (this.config.outputClass) {
      this.outputElement.className += " " + this.config.outputClass;
    }

    // Create NotationView
    this.notationView = new N.Carnatic.NotationView(this.outputElement, {
      sharedGridLayoutGroup: this.config.sharedGridLayoutGroup,
      markdownParser: this.config.markdownParser,
    });

    // Set up event listeners
    this.setupEventListeners();

    // Initial render
    if (this.config.initialSource) {
      this.render();
    }
  }

  /**
   * Gets the current source text.
   */
  get source(): string {
    return this.editorElement.value;
  }

  /**
   * Sets the source text and re-renders.
   */
  set source(value: string) {
    this.editorElement.value = value;
    this.render();
  }

  /**
   * Gets the current notation (null if parse failed).
   */
  getNotation(): N.Notation | null {
    return this.notation;
  }

  /**
   * Gets the current beat layout (null if parse failed).
   */
  getBeatLayout(): N.GlobalBeatLayout | null {
    return this.beatLayout;
  }

  /**
   * Parses and renders the current source.
   * Returns true if successful, false if there were errors.
   */
  render(): boolean {
    const source = this.editorElement.value;

    // Clear previous render
    this.notationView.clear();

    // Parse
    const [notation, beatLayout, errors] = N.load(source, { log: false });

    if (errors.length > 0) {
      this.notation = null;
      this.beatLayout = null;
      this.config.onParseError?.(errors);
      return false;
    }

    // Store results
    this.notation = notation;
    this.beatLayout = beatLayout;

    // Render
    this.notationView.renderNotation(notation, beatLayout);

    // Notify callback
    this.config.onNotationParsed?.(notation, beatLayout);

    return true;
  }

  /**
   * Sets up event listeners for the editor.
   */
  private setupEventListeners(): void {
    // Input handler with debouncing
    this.editorElement.addEventListener("input", () => {
      this.config.onSourceChange?.(this.editorElement.value);

      if (this.config.debounceDelay && this.config.debounceDelay > 0) {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          this.render();
        }, this.config.debounceDelay);
      }
    });

    // Scroll synchronization
    if (this.config.syncScroll) {
      this.editorElement.addEventListener("scroll", () => {
        this.syncScrollToOutput();
      });

      this.outputElement.addEventListener("scroll", () => {
        this.syncScrollToEditor();
      });
    }
  }

  /**
   * Synchronizes scroll from editor to output.
   */
  private syncScrollToOutput(): void {
    if (this.isScrollSyncing) return;
    this.isScrollSyncing = true;

    const editor = this.editorElement;
    const output = this.outputElement;

    // Calculate scroll percentage
    const maxScrollTop = editor.scrollHeight - editor.clientHeight;
    if (maxScrollTop <= 0) {
      this.isScrollSyncing = false;
      return;
    }

    const scrollPercent = editor.scrollTop / maxScrollTop;

    // Apply to output
    const outputMaxScroll = output.scrollHeight - output.clientHeight;
    output.scrollTop = scrollPercent * outputMaxScroll;

    this.isScrollSyncing = false;
  }

  /**
   * Synchronizes scroll from output to editor.
   */
  private syncScrollToEditor(): void {
    if (this.isScrollSyncing) return;
    this.isScrollSyncing = true;

    const editor = this.editorElement;
    const output = this.outputElement;

    // Calculate scroll percentage
    const maxScrollTop = output.scrollHeight - output.clientHeight;
    if (maxScrollTop <= 0) {
      this.isScrollSyncing = false;
      return;
    }

    const scrollPercent = output.scrollTop / maxScrollTop;

    // Apply to editor
    const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
    editor.scrollTop = scrollPercent * editorMaxScroll;

    this.isScrollSyncing = false;
  }

  /**
   * Scrolls both editor and output to the top.
   */
  scrollToTop(): void {
    this.editorElement.scrollTop = 0;
    this.outputElement.scrollTop = 0;
  }

  /**
   * Scrolls both editor and output to the bottom.
   */
  scrollToBottom(): void {
    this.editorElement.scrollTop = this.editorElement.scrollHeight;
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  /**
   * Scrolls to a specific line number in the editor.
   */
  scrollToLine(lineNumber: number): void {
    const lines = this.editorElement.value.split("\n");
    const lineHeight = this.editorElement.scrollHeight / lines.length;
    this.editorElement.scrollTop = (lineNumber - 1) * lineHeight;
    this.syncScrollToOutput();
  }

  /**
   * Focuses the editor.
   */
  focus(): void {
    this.editorElement.focus();
  }

  /**
   * Inserts text at the current cursor position.
   */
  insertAtCursor(text: string): void {
    const start = this.editorElement.selectionStart;
    const end = this.editorElement.selectionEnd;
    const value = this.editorElement.value;

    this.editorElement.value =
      value.substring(0, start) + text + value.substring(end);

    // Move cursor after inserted text
    this.editorElement.selectionStart = start + text.length;
    this.editorElement.selectionEnd = start + text.length;

    // Trigger source change
    this.config.onSourceChange?.(this.editorElement.value);
  }

  /**
   * Gets the current selection range.
   */
  getSelection(): { start: number; end: number; text: string } {
    return {
      start: this.editorElement.selectionStart,
      end: this.editorElement.selectionEnd,
      text: this.editorElement.value.substring(
        this.editorElement.selectionStart,
        this.editorElement.selectionEnd
      ),
    };
  }

  /**
   * Sets the selection range.
   */
  setSelection(start: number, end: number): void {
    this.editorElement.selectionStart = start;
    this.editorElement.selectionEnd = end;
  }

  /**
   * Cleans up resources.
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.editorElement.remove();
    this.outputElement.remove();
  }
}
