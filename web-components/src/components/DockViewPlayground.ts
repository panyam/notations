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
   * Whether to show the console panel initially.
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
   * Layout version number. Increment to force layout reset when structure changes.
   * @default 1
   */
  layoutVersion?: number;

  /**
   * Whether to enable scroll synchronization between editor and output.
   * @default true
   */
  syncScroll?: boolean;

  /**
   * Optional markdown parser for RawBlock content.
   */
  markdownParser?: (content: string) => string;

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
  layoutVersion: 1,
  syncScroll: true,
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
    this._consoleVisible = this.config.showConsole ?? true;

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
   * Resets the layout to defaults.
   * Clears persisted layout and recreates the default layout.
   */
  resetLayout(): void {
    if (this.config.storageKey) {
      localStorage.removeItem(this.config.storageKey);
    }
    if (this.dockview) {
      this.dockview.clear();
      this.createDefaultLayout();
    }
  }

  // Console visibility API

  /** Whether the console is currently visible */
  private _consoleVisible: boolean;

  /**
   * Returns whether the console panel is currently visible.
   */
  isConsoleVisible(): boolean {
    return this._consoleVisible;
  }

  /**
   * Shows the console panel.
   */
  showConsole(): void {
    if (this._consoleVisible || !this.dockview) return;

    // Add console below editor (spans full width at bottom)
    this.dockview.addPanel({
      id: "console",
      component: "console",
      title: "Console",
      position: { direction: "below", referencePanel: "editor" },
    });

    // Set console to ~10% height
    const consolePanel = this.dockview.getPanel("console");
    const containerHeight = this.container.clientHeight || 600;
    if (consolePanel?.group?.api) {
      consolePanel.group.api.setSize({ height: Math.floor(containerHeight * 0.1) });
    }

    this._consoleVisible = true;
  }

  /**
   * Hides the console panel.
   */
  hideConsole(): void {
    if (!this._consoleVisible || !this.dockview) return;

    const consolePanel = this.dockview.getPanel("console");
    if (consolePanel) {
      consolePanel.api.close();
    }
    this._consoleVisible = false;
  }

  /**
   * Toggles the console panel visibility.
   * @returns The new visibility state.
   */
  toggleConsole(): boolean {
    if (this._consoleVisible) {
      this.hideConsole();
    } else {
      this.showConsole();
    }
    return this._consoleVisible;
  }

  /**
   * Initializes the playground.
   */
  private init(): void {
    // Ensure container has proper sizing for DockView
    // DockView requires explicit height on its container
    if (!this.container.style.height && !this.container.offsetHeight) {
      this.container.style.height = "100%";
    }
    this.container.style.width = this.container.style.width || "100%";

    // Apply theme class (preserve existing classes)
    const isDark = this.isDarkMode();
    this.container.classList.add(isDark ? "dockview-theme-dark" : "dockview-theme-light");

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const dark = this.isDarkMode();
      this.container.classList.remove("dockview-theme-dark", "dockview-theme-light");
      this.container.classList.add(dark ? "dockview-theme-dark" : "dockview-theme-light");
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
      const data = {
        version: this.config.layoutVersion,
        layout,
      };
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
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
        const data = JSON.parse(saved);
        // Check version - if outdated or missing, reset to defaults
        if (data.version !== this.config.layoutVersion) {
          localStorage.removeItem(this.config.storageKey);
          return false;
        }
        this.dockview.fromJSON(data.layout);
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
   * Layout: Editor and Output side by side on top (80% height),
   * Console spanning full width on bottom (20% height).
   */
  private createDefaultLayout(): void {
    if (!this.dockview) return;

    // Get container dimensions for proportional sizing
    const containerHeight = this.container.clientHeight || 600;
    const containerWidth = this.container.clientWidth || 800;

    // Editor panel (top left)
    this.dockview.addPanel({
      id: "editor",
      component: "editor",
      title: "Editor",
    });

    // Console panel (bottom, full width) - add BEFORE output
    // so it creates a vertical split at the root level
    if (this._consoleVisible) {
      this.dockview.addPanel({
        id: "console",
        component: "console",
        title: "Console",
        position: { direction: "below", referencePanel: "editor" },
      });
    }

    // Output panel (top right) - splits the top row
    this.dockview.addPanel({
      id: "output",
      component: "output",
      title: "Notation Output",
      position: { direction: "right", referencePanel: "editor" },
    });

    // Set sizes using the group API
    const editorPanel = this.dockview.getPanel("editor");
    const consolePanel = this.dockview.getPanel("console");
    const outputPanel = this.dockview.getPanel("output");

    // Set console height to ~10% of container
    if (consolePanel?.group?.api) {
      consolePanel.group.api.setSize({ height: Math.floor(containerHeight * 0.1) });
    }

    // Set editor and output to 50% width each
    if (editorPanel?.group?.api) {
      editorPanel.group.api.setSize({ width: Math.floor(containerWidth * 0.5) });
    }
    if (outputPanel?.group?.api) {
      outputPanel.group.api.setSize({ width: Math.floor(containerWidth * 0.5) });
    }
  }

  /**
   * Creates the editor panel.
   */
  private createEditorPanel(): IContentRenderer {
    const element = document.createElement("div");
    element.className = "dvp-panel dvp-editor-panel";
    element.style.cssText = "display: flex; flex-direction: column; height: 100%; padding: 0.5rem;";

    return {
      element,
      init: (_params: Parameters) => {
        // Create SideBySideEditor config
        const editorConfig: SideBySideEditorConfig = {
          initialSource: this.config.initialSource,
          debounceDelay: 300,
          syncScroll: this.config.syncScroll,
          markdownParser: this.config.markdownParser,
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
    element.className = "dvp-panel dvp-output-panel";
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
    element.className = "dvp-panel dvp-console-panel";
    element.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    return {
      element,
      init: (_params: Parameters) => {
        // Console header
        const header = document.createElement("div");
        header.className = "dvp-console-header";
        header.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        `;

        const clearBtn = document.createElement("button");
        clearBtn.className = "dvp-console-clear-btn";
        clearBtn.textContent = "Clear";
        clearBtn.style.cssText = `
          padding: 0.125rem 0.5rem;
          font-size: 0.75rem;
          border-radius: 3px;
          cursor: pointer;
        `;
        clearBtn.onclick = () => this.clearConsole();
        header.appendChild(clearBtn);

        element.appendChild(header);

        // Console output
        this.consoleOutput = document.createElement("div");
        this.consoleOutput.className = "dvp-console-output";
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
