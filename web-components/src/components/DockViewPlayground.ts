/**
 * DockViewPlayground - A complete notation playground with DockView layout.
 *
 * Provides a ready-to-use playground experience with:
 * - Resizable editor panel
 * - Resizable notation output panel
 * - Optional console panel for logs/errors
 * - Layout persistence to localStorage
 * - Dark mode support
 *
 * Uses SideBySideEditor internally for editor/output management.
 */

import { DockviewComponent, DockviewApi, IContentRenderer, Parameters } from "dockview-core";
import SideBySideEditor, { SideBySideEditorConfig } from "./SideBySideEditor";
import * as N from "notations";

/**
 * Configuration for DockViewPlayground.
 */
export interface DockViewPlaygroundConfig {
  /**
   * Initial source text.
   */
  initialSource?: string;

  /**
   * Whether to show the console panel.
   * @default true
   */
  showConsole?: boolean;

  /**
   * Whether to persist layout to localStorage.
   * @default true
   */
  persistLayout?: boolean;

  /**
   * Storage key for layout persistence.
   * @default "notations-playground-layout"
   */
  storageKey?: string;

  /**
   * SideBySideEditor configuration options.
   */
  editorConfig?: Partial<SideBySideEditorConfig>;

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
   * Function to detect dark mode. If not provided, checks for "dark" class on documentElement.
   */
  isDarkMode?: () => boolean;

  /**
   * CSS class for the editor textarea.
   */
  editorClass?: string;

  /**
   * CSS class for the output container.
   */
  outputClass?: string;
}

const DEFAULT_CONFIG: DockViewPlaygroundConfig = {
  showConsole: true,
  persistLayout: true,
  storageKey: "notations-playground-layout",
};

/**
 * Console log entry.
 */
interface ConsoleEntry {
  timestamp: Date;
  level: "info" | "error" | "warning";
  message: string;
}

/**
 * DockViewPlayground creates a complete notation playground with DockView layout.
 *
 * Usage:
 * ```typescript
 * const playground = new DockViewPlayground(container, {
 *   initialSource: "s r g m p",
 *   onSourceChange: (source) => console.log("Source:", source),
 * });
 *
 * // Access the SideBySideEditor
 * playground.editor.source = "new source";
 *
 * // Log to console panel
 * playground.log("Hello!", "info");
 * ```
 */
export default class DockViewPlayground {
  /** The container element */
  readonly container: HTMLElement;

  /** Configuration */
  readonly config: DockViewPlaygroundConfig;

  /** DockView API */
  private dockview: DockviewApi | null = null;

  /** SideBySideEditor instance */
  private sideBySideEditor: SideBySideEditor | null = null;

  /** Console output element */
  private consoleOutput: HTMLElement | null = null;

  /** Console entries */
  private consoleEntries: ConsoleEntry[] = [];

  /**
   * Creates a new DockViewPlayground.
   *
   * @param container The container element for the playground
   * @param config Configuration options
   */
  constructor(container: HTMLElement, config: DockViewPlaygroundConfig = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.init();
  }

  /**
   * Gets the SideBySideEditor instance.
   */
  get editor(): SideBySideEditor | null {
    return this.sideBySideEditor;
  }

  /**
   * Gets the current source.
   */
  get source(): string {
    return this.sideBySideEditor?.source || "";
  }

  /**
   * Sets the source and re-renders.
   */
  set source(value: string) {
    if (this.sideBySideEditor) {
      this.sideBySideEditor.source = value;
    }
  }

  /**
   * Logs a message to the console panel.
   */
  log(message: string, level: "info" | "error" | "warning" = "info"): void {
    const entry: ConsoleEntry = {
      timestamp: new Date(),
      level,
      message,
    };
    this.consoleEntries.push(entry);
    this.renderConsoleEntry(entry);
  }

  /**
   * Clears the console.
   */
  clearConsole(): void {
    this.consoleEntries = [];
    if (this.consoleOutput) {
      this.consoleOutput.innerHTML = "";
    }
  }

  /**
   * Renders the notation manually.
   */
  render(): boolean {
    return this.sideBySideEditor?.render() || false;
  }

  /**
   * Destroys the playground and cleans up resources.
   */
  destroy(): void {
    this.sideBySideEditor?.destroy();
    this.dockview?.dispose();
    this.container.innerHTML = "";
  }

  /**
   * Initializes the playground.
   */
  private init(): void {
    // Apply theme class
    const isDark = this.isDarkMode();
    this.container.className = isDark ? "dockview-theme-dark" : "dockview-theme-light";

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const dark = this.isDarkMode();
      this.container.className = dark ? "dockview-theme-dark" : "dockview-theme-light";
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Create DockView
    const dockviewComponent = new DockviewComponent(this.container, {
      createComponent: (options) => this.createComponent(options),
    });

    this.dockview = dockviewComponent.api;

    // Try to restore saved layout, otherwise create default
    if (!this.config.persistLayout || !this.loadLayout()) {
      this.createDefaultLayout();
    }

    // Listen for layout changes to persist them
    if (this.config.persistLayout) {
      this.dockview.onDidLayoutChange(() => {
        this.saveLayout();
      });
    }

    this.log("Playground initialized", "info");
  }

  /**
   * Checks if dark mode is active.
   */
  private isDarkMode(): boolean {
    if (this.config.isDarkMode) {
      return this.config.isDarkMode();
    }
    return document.documentElement.classList.contains("dark");
  }

  /**
   * Saves the layout to localStorage.
   */
  private saveLayout(): void {
    if (!this.dockview || !this.config.storageKey) return;
    try {
      const layout = this.dockview.toJSON();
      localStorage.setItem(this.config.storageKey, JSON.stringify(layout));
    } catch (e) {
      console.warn("Failed to save layout:", e);
    }
  }

  /**
   * Loads the layout from localStorage.
   */
  private loadLayout(): boolean {
    if (!this.dockview || !this.config.storageKey) return false;
    try {
      const saved = localStorage.getItem(this.config.storageKey);
      if (saved) {
        const layout = JSON.parse(saved);
        this.dockview.fromJSON(layout);
        return true;
      }
    } catch (e) {
      console.warn("Failed to load layout:", e);
      if (this.config.storageKey) {
        localStorage.removeItem(this.config.storageKey);
      }
    }
    return false;
  }

  /**
   * Creates a component for DockView.
   */
  private createComponent(options: any): IContentRenderer {
    switch (options.name) {
      case "editor":
        return this.createEditorPanel();
      case "output":
        return this.createOutputPanel();
      case "console":
        return this.createConsolePanel();
      default:
        return {
          element: document.createElement("div"),
          init: () => {},
        };
    }
  }

  /**
   * Creates the default layout.
   */
  private createDefaultLayout(): void {
    if (!this.dockview) return;

    // Editor panel (left)
    this.dockview.addPanel({
      id: "editor",
      component: "editor",
      title: "Editor",
    });

    // Output panel (right)
    this.dockview.addPanel({
      id: "output",
      component: "output",
      title: "Notation Output",
      position: { direction: "right", referencePanel: "editor" },
    });

    // Console panel (bottom, optional)
    if (this.config.showConsole) {
      this.dockview.addPanel({
        id: "console",
        component: "console",
        title: "Console",
        position: { direction: "below", referencePanel: "output" },
      });
    }
  }

  /**
   * Creates the editor panel.
   */
  private createEditorPanel(): IContentRenderer {
    const element = document.createElement("div");
    element.style.cssText = "display: flex; flex-direction: column; height: 100%; padding: 0.5rem;";

    return {
      element,
      init: (_params: Parameters) => {
        // Create SideBySideEditor config
        const editorConfig: SideBySideEditorConfig = {
          initialSource: this.config.initialSource,
          debounceDelay: 300,
          syncScroll: false, // We manage scroll separately in dockview
          ...this.config.editorConfig,
          onSourceChange: (source) => {
            this.log(`Source changed (${source.length} chars)`, "info");
            this.config.onSourceChange?.(source);
            this.config.editorConfig?.onSourceChange?.(source);
          },
          onNotationParsed: (notation, beatLayout) => {
            const lineCount = beatLayout.gridModelsForLine.size;
            this.log(`Parsed: ${lineCount} line${lineCount !== 1 ? "s" : ""}`, "info");
            this.config.onNotationParsed?.(notation, beatLayout);
            this.config.editorConfig?.onNotationParsed?.(notation, beatLayout);
          },
          onParseError: (errors) => {
            errors.forEach((e) => {
              this.log(`Parse error: ${e.message || e}`, "error");
            });
            this.config.onParseError?.(errors);
            this.config.editorConfig?.onParseError?.(errors);
          },
          editorClass: this.config.editorClass,
        };

        // Create the editor
        this.sideBySideEditor = new SideBySideEditor(editorConfig);

        // Style the editor element
        const editorEl = this.sideBySideEditor.editorElement;
        editorEl.style.cssText = `
          width: 100%;
          height: 100%;
          resize: none;
          font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace;
          font-size: 14px;
          padding: 0.5rem;
          border: 1px solid var(--dv-separator-border, #ddd);
          border-radius: 4px;
          outline: none;
        `;

        element.appendChild(editorEl);
      },
    };
  }

  /**
   * Creates the output panel.
   */
  private createOutputPanel(): IContentRenderer {
    const element = document.createElement("div");
    element.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    return {
      element,
      init: (_params: Parameters) => {
        if (this.sideBySideEditor) {
          // Style the output element
          const outputEl = this.sideBySideEditor.outputElement;
          outputEl.style.cssText = `
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 1rem;
          `;

          element.appendChild(outputEl);
        }
      },
    };
  }

  /**
   * Creates the console panel.
   */
  private createConsolePanel(): IContentRenderer {
    const element = document.createElement("div");
    element.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    return {
      element,
      init: (_params: Parameters) => {
        // Console header
        const header = document.createElement("div");
        header.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.25rem 0.5rem;
          border-bottom: 1px solid var(--dv-separator-border, #ddd);
          font-size: 0.75rem;
        `;

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "Clear";
        clearBtn.style.cssText = `
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          border: 1px solid var(--dv-separator-border, #ddd);
          border-radius: 3px;
          background: transparent;
          cursor: pointer;
        `;
        clearBtn.addEventListener("click", () => this.clearConsole());
        header.appendChild(clearBtn);

        element.appendChild(header);

        // Console output
        this.consoleOutput = document.createElement("div");
        this.consoleOutput.style.cssText = `
          flex: 1;
          overflow: auto;
          padding: 0.5rem;
          font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
          font-size: 0.75rem;
        `;
        element.appendChild(this.consoleOutput);

        // Re-render existing entries
        this.consoleEntries.forEach((entry) => this.renderConsoleEntry(entry));
      },
    };
  }

  /**
   * Renders a console entry.
   */
  private renderConsoleEntry(entry: ConsoleEntry): void {
    if (!this.consoleOutput) return;

    const line = document.createElement("div");
    line.style.cssText = `
      padding: 0.125rem 0;
      border-bottom: 1px solid var(--dv-separator-border, rgba(0,0,0,0.1));
    `;

    if (entry.level === "error") {
      line.style.color = "#f44336";
    } else if (entry.level === "warning") {
      line.style.color = "#ff9800";
    }

    const time = entry.timestamp.toLocaleTimeString();
    line.textContent = `[${time}] ${entry.message}`;

    this.consoleOutput.appendChild(line);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }
}
