/**
 * SideBySidePlayground.ts - Interactive side-by-side notation editor
 *
 * This is a thin wrapper around DockViewPlayground that adds:
 * - Sample notation selector
 * - Toolbar with render/reset buttons
 * - Keyboard shortcuts
 */

import { DockViewPlayground, DockViewPlaygroundConfig } from "../../../src/web/dockview";
import "dockview/dist/styles/dockview.css";

import * as N from "../../../src";
import { createMarkdownParser } from "../NotationViewer";
import { decodeSource, initialSource, shareUrl } from "../share";

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

const DRAFT_KEY = "notations-side-by-side-draft";

/** The site's root URL, such as https://panyam.github.io/notations, with no trailing slash. */
function siteBase(): string {
  return location.origin + (/^.*?\/notations(?=\/)/.exec(location.pathname)?.[0] ?? "");
}

export class SideBySidePlayground {
  private playground: DockViewPlayground;
  private sampleSelect: HTMLSelectElement | null = null;
  /** The library song the editor was opened with, so Share can give its page while it's unchanged. */
  private song: { path: string; source: string } | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

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
      onSourceChange: (source) => this.saveDraft(source),
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

    this.start(playground);
    return playground;
  }

  /** Opens a #s= link, a ?song= library song, the last draft, or a sample, in that order (#77). */
  private async start(playground: DockViewPlayground): Promise<void> {
    let draft: string | null = null;
    try {
      draft = localStorage.getItem(DRAFT_KEY);
    } catch {
      // Storage can be off, as in some private windows. Start without a draft.
    }
    const first = initialSource({ hash: location.hash, search: location.search, draft });
    if (first.kind == "link") {
      const source = await decodeSource(first.link);
      if (source != null) return this.open(playground, source, "Opened a shared link");
      playground.log("This share link is damaged or from a newer version, so a sample opened instead.", "error");
    } else if (first.kind == "song") {
      const source = await this.fetchSong(first.song);
      if (source != null) {
        this.song = { path: first.song, source };
        return this.open(playground, source, `Opened library/${first.song}`);
      }
      playground.log(`Couldn't load library/${first.song}, so a sample opened instead.`, "error");
    } else if (first.kind == "draft") {
      return this.open(playground, first.source, "Opened your draft from last time");
    }
    const selected = sampleNotations.find((s) => s.selected) || sampleNotations[0];
    this.loadSample(playground, selected);
  }

  private open(playground: DockViewPlayground, source: string, message: string): void {
    playground.source = source;
    playground.log(message, "info");
  }

  /** A library song's source, read from its page's <notation id="song">. */
  private async fetchSong(path: string): Promise<string | null> {
    try {
      const res = await fetch(`${siteBase()}/library/${path}/`);
      if (!res.ok) return null;
      const page = new DOMParser().parseFromString(await res.text(), "text/html");
      return page.querySelector("notation#song")?.textContent?.trim() ?? null;
    } catch {
      return null;
    }
  }

  private saveDraft(source: string): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, source);
      } catch {
        // Storage full or off. The draft is a convenience, so carry on without it.
      }
    }, 500);
  }

  /** Copies a link to what's in the editor, and shows it beside the button (#77). */
  async share(): Promise<string> {
    const url = await shareUrl({ source: this.playground.source, song: this.song, base: siteBase() });
    const field = document.getElementById("share-link") as HTMLInputElement | null;
    if (field) {
      field.value = url;
      field.hidden = false;
      field.select();
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // The browser can refuse the clipboard. The link is still in the field to copy by hand.
    }
    this.playground.log(copied ? "Share link copied" : "Share link ready: copy it from the toolbar", "info");
    return url;
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
    document.getElementById("share-btn")?.addEventListener("click", () => this.share());

    const renderBtn = document.getElementById("render-btn");
    renderBtn?.addEventListener("click", () => this.render());

    document.getElementById("print-btn")?.addEventListener("click", () => this.playground.print());
    document.getElementById("export-svg")?.addEventListener("click", () => this.playground.downloadSVG());
    document.getElementById("export-png")?.addEventListener("click", () => this.playground.downloadPNG());

    // Setup reset layout button
    const resetLayoutBtn = document.getElementById("reset-layout-btn");
    resetLayoutBtn?.addEventListener("click", () => this.resetLayout());
  }

  private loadSample(playground: DockViewPlayground, sample: SampleNotation): void {
    this.song = null;
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
