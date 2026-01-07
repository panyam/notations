/**
 * SideBySidePlayground.ts - Interactive side-by-side notation editor
 *
 * This is a thin wrapper around DockViewPlayground that adds:
 * - Sample notation selector
 * - Toolbar with render/reset buttons
 * - Keyboard shortcuts
 */

import { DockViewPlayground, DockViewPlaygroundConfig } from "../../../src/web/dockview";
import "dockview-core/dist/styles/dockview.css";

import * as N from "../../../src";
import { createMarkdownParser } from "../NotationViewer";

// Import core notation styles
import "../../../styles/NotationView.scss";

// Expose notations library globally
(window as any).N = N;

const LAYOUT_STORAGE_KEY = "notations-playground-layout";
const LAYOUT_VERSION = 4; // Increment to force layout reset on structure changes

// Sample notations for the dropdown
interface SampleNotation {
  name: string;
  label: string;
  source: string;
  selected?: boolean;
}

const sampleNotations: SampleNotation[] = [
  {
    name: "basic-scale",
    label: "Basic Scale",
    selected: true,
    source: `\\cycle("|4|2|2|")
\\beatDuration(4)

\\line("Arohanam")
Sw: S R G M , P D N S.

\\line("Avarohanam")
Sw: S. N D P , M G R S `,
  },
  {
    name: "pallavi",
    label: "Pallavi with Sahitya",
    source: `\\cycle("|4|2|2|")
\\beatDuration(4)

\\line("Pallavi")
Sw: S R G M , P M G R , S _ _ _ , _ _ _ _
Sh: nin nu ko ri , va ra da nun , nu _ _ _ , _ _ _ _

Sw: S R G M , P M G R , S R G M , P _ _ _
Sh: nin nu ko ri , va ra da nun , nu ko ri , va _ _ _ `,
  },
  {
    name: "second-speed",
    label: "Second Speed",
    source: `\\cycle("|4|2|2|")
\\beatDuration(4)

\\line("First Speed")
Sw: S R G M , P D N S.

\\line("Second Speed")
Sw: SR GM PD NS. , S.N DP MG RS `,
  },
  {
    name: "gamakas",
    label: "Gamakas",
    source: `\\cycle("|4|2|2|")
\\beatDuration(4)

\\line("Embellishments")
Sw: S ~R G /M\\ , P ~D N S.
Sw: S. \\N/ D ~P , M /G\\ R S `,
  },
];

export class SideBySidePlayground {
  private playground: DockViewPlayground;
  private sampleSelect: HTMLSelectElement | null = null;

  constructor() {
    this.playground = this.init();
  }

  private init(): DockViewPlayground {
    const container = document.getElementById("dockview-container");
    if (!container) {
      throw new Error("Dockview container not found");
    }

    // Setup toolbar first
    this.setupToolbar();

    // Create DockViewPlayground config
    const config: DockViewPlaygroundConfig = {
      showConsole: true,
      persistLayout: true,
      storageKey: LAYOUT_STORAGE_KEY,
      layoutVersion: LAYOUT_VERSION,
      syncScroll: true,
      markdownParser: createMarkdownParser(),
      editorConfig: {
        debounceDelay: 0, // Manual render via button
      },
      onSourceChange: (source) => {
        this.playground?.log(`Source changed (${source.length} chars)`, "info");
      },
      onNotationParsed: (notation, beatLayout) => {
        this.playground?.log(`Parsed: ${beatLayout.gridModelsForLine.size} lines`, "info");
      },
      onParseError: (errors) => {
        errors.forEach((e) => {
          this.playground?.log(`Parse error: ${e.message || e}`, "error");
        });
      },
      editorClass: "playground-editor",
    };

    // Create the playground
    const playground = new DockViewPlayground(container, config);

    // Setup keyboard shortcut on editor
    if (playground.editor) {
      playground.editor.editorElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey || e.altKey)) {
          e.preventDefault();
          this.render();
        }
      });

      // Apply custom editor styles
      const editorEl = playground.editor.editorElement;
      editorEl.style.fontFamily = '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace';
      editorEl.style.fontSize = "14px";
    }

    // Load initial sample
    const selected = sampleNotations.find((s) => s.selected) || sampleNotations[0];
    this.loadSample(playground, selected);

    return playground;
  }

  private setupToolbar(): void {
    // Setup sample select
    this.sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;
    if (this.sampleSelect) {
      this.sampleSelect.innerHTML = sampleNotations
        .map((s) => `<option value="${s.name}" ${s.selected ? "selected" : ""}>${s.label}</option>`)
        .join("");
      this.sampleSelect.addEventListener("change", () => {
        const sample = sampleNotations.find((s) => s.name === this.sampleSelect!.value);
        if (sample) this.loadSample(this.playground, sample);
      });
    }

    // Setup render button
    const renderBtn = document.getElementById("render-btn");
    renderBtn?.addEventListener("click", () => this.render());

    // Setup reset layout button
    const resetLayoutBtn = document.getElementById("reset-layout-btn");
    resetLayoutBtn?.addEventListener("click", () => this.resetLayout());
  }

  private loadSample(playground: DockViewPlayground, sample: SampleNotation): void {
    playground.source = sample.source;
    playground.log(`Loaded sample: ${sample.label}`, "info");
  }

  // Public API - delegates to DockViewPlayground

  /**
   * Renders the notation manually.
   */
  render(): boolean {
    return this.playground.render();
  }

  /**
   * Resets the layout to defaults.
   */
  resetLayout(): void {
    this.playground.resetLayout();
  }

  /**
   * Gets or sets the source.
   */
  get source(): string {
    return this.playground.source;
  }

  set source(value: string) {
    this.playground.source = value;
  }

  /**
   * Logs a message to the console.
   */
  log(message: string, level: "info" | "error" | "warning" = "info"): void {
    this.playground.log(message, level);
  }

  /**
   * Clears the console.
   */
  clearConsole(): void {
    this.playground.clearConsole();
  }

  /**
   * Shows the console panel.
   */
  showConsole(): void {
    this.playground.showConsole();
  }

  /**
   * Hides the console panel.
   */
  hideConsole(): void {
    this.playground.hideConsole();
  }

  /**
   * Toggles console visibility.
   */
  toggleConsole(): boolean {
    return this.playground.toggleConsole();
  }

  /**
   * Returns whether the console is visible.
   */
  isConsoleVisible(): boolean {
    return this.playground.isConsoleVisible();
  }

  /**
   * Gets the underlying DockViewPlayground instance.
   */
  getPlayground(): DockViewPlayground {
    return this.playground;
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("playground-container")) {
    (window as any).sideBySidePlayground = new SideBySidePlayground();
  }
});
