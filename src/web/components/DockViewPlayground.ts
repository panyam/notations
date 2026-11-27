/**
 * DockViewPlayground - A complete notation playground in a dock.
 *
 * Provides a ready-to-use playground experience with:
 * - Resizable editor panel
 * - Resizable notation output panel
 * - Optional console panel for logs/errors
 * - Layout persistence to localStorage
 * - Dark mode support
 *
 * The dock is `@panyam/tsappkit-dock`'s `createDock` over dockview-core. The editor and output
 * come from one SideBySideEditor, built before the dock, so closing and reopening a panel keeps
 * its content.
 */

import { createDock, type Dock, type PanelDef } from "@panyam/tsappkit-dock";
import type { DockviewApi } from "dockview-core";
import SideBySideEditor, { SideBySideEditorConfig } from "./SideBySideEditor";
import { Notation } from "../../notation";
import { GlobalBeatLayout } from "../../beats";

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
   * The console's height in the default layout, and when `showConsole()` opens it, as a share of
   * the container's height. A layout the reader saved keeps its own size.
   * @default 0.1
   */
  consoleHeight?: number;

  /**
   * Whether to persist layout to localStorage.
   * @default true
   */
  persistLayout?: boolean;

  /**
   * Storage key for layout persistence. The layout is saved under `${storageKey}-v${layoutVersion}`,
   * so a save from before the move to tsappkit-dock, which used `storageKey` alone, is ignored.
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
  onNotationParsed?: (notation: Notation, beatLayout: GlobalBeatLayout) => void;

  /**
   * Callback when parsing fails.
   */
  onParseError?: (errors: any[]) => void;

  /**
   * Function to detect dark mode. If not provided, checks for "dark" class on documentElement.
   * The dock reads it again whenever `<html>`'s `class` or `data-theme` changes, or the OS colour
   * scheme does. Call `dock.applyTheme()` after a change the dock can't see.
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
  consoleHeight: 0.1,
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

const MONO = '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace';

/**
 * DockViewPlayground creates a complete notation playground in a dock.
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
 *
 * // A Panels button with a toggle per panel and Reset layout
 * playground.dock.panelsMenu(toolbar);
 * ```
 */
export default class DockViewPlayground {
  /** The container element */
  readonly container: HTMLElement;

  /** Configuration */
  readonly config: DockViewPlaygroundConfig;

  /**
   * The dock holding the editor, output and console panels, with the ids "editor", "output" and
   * "console". Use it for a Panels menu (`dock.panelsMenu(host)`), to move a panel into a drawer
   * (`dock.place`), or reach dockview itself through `dock.api`.
   */
  readonly dock: Dock;

  private readonly sideBySideEditor: SideBySideEditor;
  private readonly hosts: Record<"editor" | "output" | "console", HTMLElement>;
  private readonly consoleOutput: HTMLElement;
  private consoleEntries: ConsoleEntry[] = [];

  /**
   * Creates a new DockViewPlayground.
   *
   * @param container The container element for the playground. It needs a height, as the dock
   *   fills it; one without an explicit or laid-out height gets `height: 100%`.
   * @param config Configuration options
   */
  constructor(container: HTMLElement, config: DockViewPlaygroundConfig = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!container.style.height && !container.offsetHeight) container.style.height = "100%";
    container.style.width = container.style.width || "100%";

    this.consoleOutput = this.buildConsoleOutput();
    this.sideBySideEditor = new SideBySideEditor(this.editorConfig());
    this.hosts = {
      editor: this.buildEditorHost(),
      output: this.buildOutputHost(),
      console: this.buildConsoleHost(),
    };

    const isDark = this.config.isDarkMode ?? (() => document.documentElement.classList.contains("dark"));
    const panels: PanelDef[] = [
      { id: "editor", title: "Editor" },
      { id: "output", title: "Notation Output", position: { direction: "right", referencePanel: "editor" } },
      {
        id: "console",
        title: "Console",
        position: { direction: "below", referencePanel: "editor" },
        defaultOpen: this.config.showConsole !== false,
      },
    ];
    this.dock = createDock({
      container,
      panels,
      defaultLayout: (api) => this.defaultLayout(api),
      hostFor: (id) => this.hosts[id as keyof typeof this.hosts],
      storage: this.config.persistLayout ? localStorage : null,
      key: `${this.config.storageKey}-v${this.config.layoutVersion}`,
      theme: () => (isDark() ? "dark" : "light"),
      moveMenu: false,
    });

    // The SideBySideEditor renders in its constructor, before its output element is in the
    // page, so render again once the dock has placed it.
    requestAnimationFrame(() => this.render());
    this.log("Playground initialized", "info");
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
    return this.sideBySideEditor.source || "";
  }

  /**
   * Sets the source and re-renders.
   */
  set source(value: string) {
    this.sideBySideEditor.source = value;
  }

  /**
   * Logs a message to the console panel. Lines are kept while the console is closed.
   */
  log(message: string, level: "info" | "error" | "warning" = "info"): void {
    const entry: ConsoleEntry = { timestamp: new Date(), level, message };
    this.consoleEntries.push(entry);
    this.renderConsoleEntry(entry);
  }

  /**
   * Clears the console.
   */
  clearConsole(): void {
    this.consoleEntries = [];
    this.consoleOutput.innerHTML = "";
  }

  /**
   * Renders the notation manually.
   */
  render(): boolean {
    return this.sideBySideEditor.render() || false;
  }

  /**
   * Destroys the playground. The layout is saved first when `persistLayout` is on.
   */
  destroy(): void {
    this.sideBySideEditor.destroy();
    this.dock.dispose();
    this.container.innerHTML = "";
  }

  /**
   * Resets the layout to defaults, forgetting the saved one. With `showConsole: false` the console
   * ends up closed.
   */
  resetLayout(): void {
    this.dock.reset();
  }

  /**
   * Returns whether the console panel is open, in the grid or anywhere else the dock put it.
   */
  isConsoleVisible(): boolean {
    return this.dock.where("console") !== null;
  }

  /**
   * Shows the console panel, below the editor if it was closed.
   */
  showConsole(): void {
    if (this.isConsoleVisible()) return;
    this.dock.show("console");
    this.sizeConsole(this.dock.api);
  }

  /**
   * Hides the console panel.
   */
  hideConsole(): void {
    if (this.isConsoleVisible()) this.dock.toggle("console");
  }

  /**
   * Toggles the console panel visibility.
   * @returns The new visibility state.
   */
  toggleConsole(): boolean {
    if (this.isConsoleVisible()) this.hideConsole();
    else this.showConsole();
    return this.isConsoleVisible();
  }

  /**
   * Editor and output side by side, half the width each, with the console spanning the bottom
   * at `consoleHeight` of the height.
   */
  private defaultLayout(api: DockviewApi): void {
    const width = this.container.clientWidth || 800;
    api.addPanel({ id: "editor", component: "editor", title: "Editor" });
    if (this.config.showConsole !== false) {
      api.addPanel({
        id: "console",
        component: "console",
        title: "Console",
        position: { direction: "below", referencePanel: "editor" },
      });
    }
    api.addPanel({
      id: "output",
      component: "output",
      title: "Notation Output",
      position: { direction: "right", referencePanel: "editor" },
    });
    api.getPanel("editor")?.group?.api.setSize({ width: Math.floor(width * 0.5) });
    api.getPanel("output")?.group?.api.setSize({ width: Math.floor(width * 0.5) });
    this.sizeConsole(api);
  }

  private sizeConsole(api: DockviewApi): void {
    const height = this.container.clientHeight || 600;
    api.getPanel("console")?.group?.api.setSize({ height: Math.floor(height * (this.config.consoleHeight ?? 0.1)) });
  }

  private editorConfig(): SideBySideEditorConfig {
    const c = this.config;
    return {
      initialSource: c.initialSource,
      debounceDelay: 300,
      syncScroll: c.syncScroll,
      markdownParser: c.markdownParser,
      ...c.editorConfig,
      onSourceChange: (source) => {
        this.log(`Source changed (${source.length} chars)`, "info");
        c.onSourceChange?.(source);
        c.editorConfig?.onSourceChange?.(source);
      },
      onNotationParsed: (notation, beatLayout) => {
        const lineCount = beatLayout.gridModelsForLine.size;
        this.log(`Parsed: ${lineCount} line${lineCount !== 1 ? "s" : ""}`, "info");
        c.onNotationParsed?.(notation, beatLayout);
        c.editorConfig?.onNotationParsed?.(notation, beatLayout);
      },
      onParseError: (errors) => {
        errors.forEach((e) => this.log(`Parse error: ${e.message || e}`, "error"));
        c.onParseError?.(errors);
        c.editorConfig?.onParseError?.(errors);
      },
      editorClass: c.editorClass,
      outputClass: c.outputClass,
    };
  }

  private buildEditorHost(): HTMLElement {
    const element = document.createElement("div");
    element.className = "dvp-panel dvp-editor-panel";
    element.style.cssText = "display: flex; flex-direction: column; height: 100%; padding: 0.5rem;";
    const editorEl = this.sideBySideEditor.editorElement;
    editorEl.style.cssText = `
      width: 100%;
      height: 100%;
      resize: none;
      font-family: ${MONO};
      font-size: 14px;
      padding: 0.5rem;
      border: 1px solid var(--dv-separator-border, #ddd);
      border-radius: 4px;
      outline: none;
    `;
    element.appendChild(editorEl);
    return element;
  }

  private buildOutputHost(): HTMLElement {
    const element = document.createElement("div");
    element.className = "dvp-panel dvp-output-panel";
    element.style.cssText = "display: flex; flex-direction: column; height: 100%;";
    const outputEl = this.sideBySideEditor.outputElement;
    outputEl.style.cssText = "width: 100%; height: 100%; overflow: auto; padding: 1rem;";
    element.appendChild(outputEl);
    return element;
  }

  private buildConsoleOutput(): HTMLElement {
    const out = document.createElement("div");
    out.className = "dvp-console-output";
    // Focusable so a keyboard can scroll it; a log, so screen readers announce new lines.
    out.setAttribute("tabindex", "0");
    out.setAttribute("role", "log");
    out.setAttribute("aria-label", "Console");
    out.style.cssText = `flex: 1; overflow: auto; padding: 0.5rem; font-family: ${MONO}; font-size: 0.75rem;`;
    return out;
  }

  private buildConsoleHost(): HTMLElement {
    const element = document.createElement("div");
    element.className = "dvp-panel dvp-console-panel";
    element.style.cssText = "display: flex; flex-direction: column; height: 100%;";

    const header = document.createElement("div");
    header.className = "dvp-console-header";
    header.style.cssText =
      "display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; font-size: 0.75rem;";
    const clearBtn = document.createElement("button");
    clearBtn.className = "dvp-console-clear-btn";
    clearBtn.textContent = "Clear";
    clearBtn.style.cssText = "padding: 0.125rem 0.5rem; font-size: 0.75rem; border-radius: 3px; cursor: pointer;";
    clearBtn.onclick = () => this.clearConsole();
    header.appendChild(clearBtn);

    element.appendChild(header);
    element.appendChild(this.consoleOutput);
    return element;
  }

  private renderConsoleEntry(entry: ConsoleEntry): void {
    const line = document.createElement("div");
    line.style.cssText = "padding: 0.125rem 0; border-bottom: 1px solid var(--dv-separator-border, rgba(0,0,0,0.1));";
    if (entry.level === "error") line.style.color = "#f44336";
    else if (entry.level === "warning") line.style.color = "#ff9800";
    line.textContent = `[${entry.timestamp.toLocaleTimeString()}] ${entry.message}`;
    this.consoleOutput.appendChild(line);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }
}
