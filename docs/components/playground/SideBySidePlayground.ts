/**
 * SideBySidePlayground.ts - Interactive side-by-side notation editor with DockView layout
 */

import { DockviewComponent, DockviewApi, IContentRenderer, Parameters } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";

import * as N from "notations";
import { SideBySideEditor, SideBySideEditorConfig } from "notations-web";
import { createMarkdownParser } from "../NotationViewer";

// Import core notation styles
import "../../../styles/NotationView.scss";

// Expose notations library globally
(window as any).N = N;

const LAYOUT_STORAGE_KEY = "notations-playground-layout";
const LAYOUT_VERSION = 3; // Increment to force layout reset on structure changes

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
  private dockview: DockviewApi | null = null;
  private sideBySideEditor: SideBySideEditor | null = null;

  // DOM refs
  private sampleSelect: HTMLSelectElement | null = null;
  private consoleOutput: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private isDarkMode(): boolean {
    return document.documentElement.classList.contains("dark");
  }

  private init(): void {
    const container = document.getElementById("dockview-container");
    if (!container) {
      console.error("Dockview container not found");
      return;
    }

    // Apply theme
    container.className = this.isDarkMode() ? "dockview-theme-dark" : "dockview-theme-light";

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const isDark = this.isDarkMode();
      container.className = isDark ? "dockview-theme-dark" : "dockview-theme-light";
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Create DockView
    const dockviewComponent = new DockviewComponent(container, {
      createComponent: (options) => this.createComponent(options),
    });

    this.dockview = dockviewComponent.api;

    // Try to restore saved layout, otherwise create default
    if (!this.loadLayout()) {
      this.createDefaultLayout();
    }

    // Listen for layout changes to persist them
    this.dockview.onDidLayoutChange(() => {
      this.saveLayout();
    });

    // Load initial sample
    const selected = sampleNotations.find((s) => s.selected) || sampleNotations[0];
    this.loadSample(selected);
  }

  private saveLayout(): void {
    if (!this.dockview) return;
    try {
      const layout = this.dockview.toJSON();
      const data = { version: LAYOUT_VERSION, layout };
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save layout:", e);
    }
  }

  private loadLayout(): boolean {
    if (!this.dockview) return false;
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // Check version - if outdated, reset to defaults
        if (data.version !== LAYOUT_VERSION) {
          localStorage.removeItem(LAYOUT_STORAGE_KEY);
          return false;
        }
        this.dockview.fromJSON(data.layout);
        return true;
      }
    } catch (e) {
      console.warn("Failed to load layout:", e);
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
    return false;
  }

  private resetLayout(): void {
    // Clear saved layout
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    // Reload the page to reinitialize with default layout
    window.location.reload();
  }

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

  private createDefaultLayout(): void {
    if (!this.dockview) return;

    // Get container dimensions for proportional sizing
    const container = document.getElementById("dockview-container");
    const containerHeight = container?.clientHeight || 600;
    const containerWidth = container?.clientWidth || 800;

    // Editor panel (top left)
    this.dockview.addPanel({
      id: "editor",
      component: "editor",
      title: "Editor",
    });

    // Console panel (bottom, full width) - add BEFORE output
    // so it creates a vertical split at the root level
    this.dockview.addPanel({
      id: "console",
      component: "console",
      title: "Console",
      position: { direction: "below", referencePanel: "editor" },
    });

    // Output panel (top right) - splits the top row
    this.dockview.addPanel({
      id: "output",
      component: "output",
      title: "Notation Output",
      position: { direction: "right", referencePanel: "editor" },
    });

    // Set sizes using the group API
    // Console should be 20% height, so editor row gets 80%
    const editorPanel = this.dockview.getPanel("editor");
    const consolePanel = this.dockview.getPanel("console");
    const outputPanel = this.dockview.getPanel("output");

    // Set console height to 20% of container
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

  private createEditorPanel(): IContentRenderer {
    const template = document.getElementById("editor-panel-template");
    const element = template?.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";
    element.id = ""; // Clear cloned ID

    return {
      element,
      init: (params: Parameters) => {
        // Setup sample select
        this.sampleSelect = element.querySelector("#sample-select") as HTMLSelectElement;
        if (this.sampleSelect) {
          this.sampleSelect.innerHTML = sampleNotations
            .map((s) => `<option value="${s.name}" ${s.selected ? "selected" : ""}>${s.label}</option>`)
            .join("");
          this.sampleSelect.addEventListener("change", () => {
            const sample = sampleNotations.find((s) => s.name === this.sampleSelect!.value);
            if (sample) this.loadSample(sample);
          });
        }

        // Setup render button
        const renderBtn = element.querySelector("#render-btn");
        renderBtn?.addEventListener("click", () => this.render());

        // Setup reset layout button
        const resetLayoutBtn = element.querySelector("#reset-layout-btn");
        resetLayoutBtn?.addEventListener("click", () => this.resetLayout());

        // Create SideBySideEditor config
        const config: SideBySideEditorConfig = {
          debounceDelay: 0, // Manual render via button
          syncScroll: false, // We manage scroll separately in dockview
          markdownParser: createMarkdownParser(), // Use markdown-it for raw block rendering
          onSourceChange: (source) => {
            this.log(`Source changed (${source.length} chars)`, "info");
          },
          onNotationParsed: (notation, beatLayout) => {
            this.log(`Parsed: ${beatLayout.gridModelsForLine.size} lines`, "info");
          },
          onParseError: (errors) => {
            errors.forEach((e) => {
              this.log(`Parse error: ${e.message || e}`, "error");
            });
          },
          editorClass: "playground-editor",
        };

        // Get the editor container
        const editorContainer = element.querySelector("#editor-container") as HTMLElement;
        if (editorContainer) {
          this.sideBySideEditor = new SideBySideEditor(config);

          // Style the editor element
          this.sideBySideEditor.editorElement.style.width = "100%";
          this.sideBySideEditor.editorElement.style.height = "100%";
          this.sideBySideEditor.editorElement.style.resize = "none";
          this.sideBySideEditor.editorElement.style.fontFamily =
            '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace';
          this.sideBySideEditor.editorElement.style.fontSize = "14px";
          this.sideBySideEditor.editorElement.style.padding = "0.5rem";
          this.sideBySideEditor.editorElement.style.border = "none";
          this.sideBySideEditor.editorElement.style.outline = "none";

          // Add keyboard shortcut: Ctrl/Cmd/Alt + Enter to render
          this.sideBySideEditor.editorElement.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey || e.altKey)) {
              e.preventDefault();
              this.render();
            }
          });

          editorContainer.appendChild(this.sideBySideEditor.editorElement);
        }
      },
    };
  }

  private createOutputPanel(): IContentRenderer {
    const template = document.getElementById("output-panel-template");
    const element = template?.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";
    element.id = ""; // Clear cloned ID

    return {
      element,
      init: (params: Parameters) => {
        // Get the output container
        const outputContainer = element.querySelector("#output-container") as HTMLElement;
        if (outputContainer && this.sideBySideEditor) {
          // Style the output element
          this.sideBySideEditor.outputElement.style.width = "100%";
          this.sideBySideEditor.outputElement.style.height = "100%";
          this.sideBySideEditor.outputElement.style.overflow = "auto";
          this.sideBySideEditor.outputElement.style.padding = "1rem";

          outputContainer.appendChild(this.sideBySideEditor.outputElement);
        }
      },
    };
  }

  private createConsolePanel(): IContentRenderer {
    const template = document.getElementById("console-panel-template");
    const element = template?.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";
    element.id = ""; // Clear cloned ID

    return {
      element,
      init: (params: Parameters) => {
        this.consoleOutput = element.querySelector("#console-output");

        // Setup clear button
        const clearBtn = element.querySelector("#clear-console-btn");
        clearBtn?.addEventListener("click", () => {
          if (this.consoleOutput) this.consoleOutput.innerHTML = "";
        });
      },
    };
  }

  private loadSample(sample: SampleNotation): void {
    if (this.sideBySideEditor) {
      this.sideBySideEditor.source = sample.source;
      this.log(`Loaded sample: ${sample.label}`, "info");
    }
  }

  private render(): void {
    if (!this.sideBySideEditor) return;

    const startTime = performance.now();
    const success = this.sideBySideEditor.render();
    const elapsed = (performance.now() - startTime).toFixed(2);

    if (success) {
      this.log(`Rendered in ${elapsed}ms`, "info");
    }
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
  if (document.getElementById("playground-container")) {
    (window as any).sideBySidePlayground = new SideBySidePlayground();
  }
});
