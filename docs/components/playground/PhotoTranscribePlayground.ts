/**
 * PhotoTranscribePlayground.ts - Photo to Notations DSL, in the browser.
 *
 * The left panel collects pages (photos, or PDF pages), facts about the song, the visitor's own
 * Anthropic API key, and an ordered list of transcriptions. Each transcription names one part
 * of the song and picks the regions of the pages that hold it (entries.ts). The right side is
 * the usual DockViewPlayground (editor, preview, console), so results can be proofread and
 * fixed in place.
 *
 * The API key goes from the browser straight to api.anthropic.com. It is kept in localStorage
 * only when the visitor ticks "Remember", and never sent anywhere else. The docs site is static,
 * so there is no server of ours in the path.
 */

import { DockViewPlayground } from "../../../src/web/dockview";
import "dockview/dist/styles/dockview.css";
import "../../../styles/NotationView.scss";

import { createMarkdownParser } from "../NotationViewer";
import {
  addEntry,
  autoInserts,
  dropPage,
  Entry,
  entryFacts,
  fromLegacyPhotos,
  moveEntry,
  normalizeEntry,
  onlyPart,
  whyNotReady,
} from "../photo/entries";
import { isBlankNotation, mergeNotation, parseCycle } from "../photo/grid";
import type { KnownFacts } from "../photo/prompt";
import { CropRect, normalizeCrop, prepareImage, PreparedImage } from "../photo/imageUtils";
import { isPdf, PDF_PAGE_WARN, pdfToImages } from "../photo/pdfPages";
import { PhotoStore, StoredPage } from "../photo/photoStore";
import { formatCost } from "../photo/pricing";
import {
  DEFAULT_MODEL,
  StreamProgress,
  TranscribeResult,
  transcribe,
  TranscriptionRefusedError,
} from "../photo/transcriber";

const KEY_STORAGE = "notations-photo-anthropic-key";
const MODEL_STORAGE = "notations-photo-model";
const LAYOUT_STORAGE_KEY = "notations-photo-layout";
const LAYOUT_VERSION = 1;

const PLACEHOLDER_SOURCE = `// Your transcription will appear here.
// Add a page on the left, add a transcription, pick its region and press Transcribe.
// You can edit the result; the preview updates as you type.
`;

/** Talams a transcription can pick, as cycles. "Other..." takes a typed cycle. */
const TALAMS: Array<[string, string]> = [
  ["|4|2|2|", "Adi (4+2+2)"],
  ["|2|4|", "Rupakam (2+4)"],
  ["|4|2|", "Rupakam (4+2)"],
  ["|3|2|2|", "Misra Chapu (3+2+2)"],
  ["|2|3|", "Khanda Chapu (2+3)"],
  ["|4|2|4|4|", "Dhruva (4+2+4+4)"],
  ["|4|2|4|", "Matya (4+2+4)"],
  ["|7|1|2|", "Jhampa (7+1+2)"],
  ["|5|5|2|2|", "Ata (5+5+2+2)"],
  ["|4|", "Eka (4)"],
];
const KNOWN_CYCLES = new Set(TALAMS.map(([cycle]) => cycle));
const SWARAS_PER_BEAT = [1, 2, 3, 4, 6, 8];

/** One page on the page list: an image file, or one page of a PDF. */
interface PageItem {
  id: string;
  /** The page's image: the uploaded image, or a PDF page rendered to PNG. */
  file: Blob;
  /** The uploaded file this page came from, as kept in PhotoStore. */
  fileId: string;
  /** 1-based page when the upload was a PDF; null for an image. */
  page: number | null;
  name: string;
  /** Quarter turns clockwise. Regions are measured on the rotated page. */
  rotation: number;
  thumb: PreparedImage;
}

/** What the region dialog is editing: an existing region of an entry, or a new one. */
interface RegionTarget {
  entryId: string;
  /** Index into the entry's regions, or null to add a region. */
  regionIndex: number | null;
  pageId: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the key just won't be remembered.
  }
}

/** An id for a file, page or entry. randomUUID needs a secure context, which localhost and Pages are. */
function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export class PhotoTranscribePlayground {
  private playground: DockViewPlayground;
  private pages: PageItem[] = [];
  private entries: Entry[] = [];
  /** The entry being transcribed. One runs at a time. */
  private runningId: string | null = null;
  private abort: AbortController | null = null;
  /** Null when this browser has no usable IndexedDB; the page then forgets on reload. */
  private storeReady: Promise<PhotoStore | null> = PhotoStore.open();
  /** Writes run one after another, so a file is stored before the page list that names it. */
  private saving: Promise<void> = Promise.resolve();
  /** True until the last visit's work is back, so nothing overwrites it first. */
  private restoring = true;

  private keyInput = $("pt-api-key") as HTMLInputElement;
  private rememberBox = $("pt-remember") as HTMLInputElement;
  private modelSelect = $("pt-model") as HTMLSelectElement;
  private enhanceBox = $("pt-enhance") as HTMLInputElement;
  private carefulBox = $("pt-careful") as HTMLInputElement;
  private hintsInput = $("pt-hints") as HTMLTextAreaElement;
  /** Entries whose talam is set to "Other..." while the cycle is still being typed. Not saved. */
  private customCycle = new Set<string>();
  private caseSelect = $("pt-case") as HTMLSelectElement;
  private cancelBtn = $("pt-cancel") as HTMLButtonElement;
  private statusEl = $("pt-status");
  private rawEl = $("pt-raw");
  private rawDetails = $("pt-raw-details") as HTMLDetailsElement;
  private reportEl = $("pt-report");
  private thumbsEl = $("pt-thumbs");
  private entriesEl = $("pt-entries");
  private cropDialog = $("pt-crop-dialog") as HTMLDialogElement;
  private cropImg = $("pt-crop-img") as HTMLImageElement;
  private cropBox = $("pt-crop-box");
  private cropPage = $("pt-crop-page") as HTMLSelectElement;
  private cropTarget: RegionTarget | null = null;
  private cropRect: CropRect | null = null;

  constructor() {
    this.playground = new DockViewPlayground($("dockview-container"), {
      showConsole: true,
      persistLayout: true,
      storageKey: LAYOUT_STORAGE_KEY,
      layoutVersion: LAYOUT_VERSION,
      syncScroll: true,
      markdownParser: createMarkdownParser(),
      editorClass: "playground-editor",
      onSourceChange: (source) => this.saveNotation(source),
      onParseError: (errors) => errors.forEach((e) => this.playground?.log(`Parse error: ${e.message || e}`, "error")),
    });
    this.playground.source = PLACEHOLDER_SOURCE;
    this.setupControls();
    this.renderEntries();
    this.restore();
  }

  private setupControls(): void {
    const savedKey = safeGet(KEY_STORAGE);
    if (savedKey) {
      this.keyInput.value = savedKey;
      this.rememberBox.checked = true;
    }
    const savedModel = safeGet(MODEL_STORAGE);
    if (savedModel && Array.from(this.modelSelect.options).some((o) => o.value === savedModel)) {
      this.modelSelect.value = savedModel;
    }

    this.keyInput.addEventListener("input", () => {
      if (this.rememberBox.checked) safeSet(KEY_STORAGE, this.keyInput.value.trim() || null);
      this.renderEntries();
    });
    // The key stays masked unless asked, so screenshots and recordings do not show it.
    const keyToggle = $("pt-key-toggle") as HTMLButtonElement;
    keyToggle.addEventListener("click", () => {
      const show = this.keyInput.type === "password";
      this.keyInput.type = show ? "text" : "password";
      keyToggle.textContent = show ? "Hide" : "Show";
      keyToggle.setAttribute("aria-pressed", String(show));
    });
    this.rememberBox.addEventListener("change", () => {
      safeSet(KEY_STORAGE, this.rememberBox.checked ? this.keyInput.value.trim() || null : null);
    });
    this.modelSelect.addEventListener("change", () => safeSet(MODEL_STORAGE, this.modelSelect.value));
    this.enhanceBox.addEventListener("change", () => this.rethumbAll());

    const fileInputs = [$("pt-file") as HTMLInputElement, $("pt-camera") as HTMLInputElement];
    for (const input of fileInputs) {
      input.addEventListener("change", () => {
        if (input.files) this.addFiles(Array.from(input.files));
        input.value = ""; // allow picking the same file again
      });
    }

    const drop = $("pt-drop");
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("pt-drop-active");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("pt-drop-active"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("pt-drop-active");
      if (e.dataTransfer?.files) this.addFiles(Array.from(e.dataTransfer.files));
    });
    // Pasting a screenshot is the quickest path on desktop.
    document.addEventListener("paste", (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.some((f) => f.type.startsWith("image/") || isPdf(f))) this.addFiles(files);
    });

    this.thumbsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button[data-action]") as HTMLButtonElement | null;
      if (!btn) return;
      const index = Number(btn.dataset.index);
      if (btn.dataset.action === "remove") this.removePage(index);
      else if (btn.dataset.action === "rotate") this.rotatePage(index);
    });

    $("pt-add-entry").addEventListener("click", () => this.newEntry());
    this.entriesEl.addEventListener("click", (e) => this.onEntryClick(e));
    this.entriesEl.addEventListener("input", (e) => this.onEntryInput(e));
    this.entriesEl.addEventListener("change", (e) => this.onEntryChange(e));
    this.setupCropDialog();

    this.cancelBtn.addEventListener("click", () => this.abort?.abort());
    $("pt-copy").addEventListener("click", () => this.copySource());
    $("pt-clear").addEventListener("click", () => this.clearEditor());
    $("pt-forget").addEventListener("click", () => this.forgetFiles());
    $("pt-download").addEventListener("click", () => this.downloadSource());
    $("pt-reset-layout").addEventListener("click", () => this.playground.resetLayout());
    $("pt-print").addEventListener("click", () => this.playground.print());
    $("pt-export-svg").addEventListener("click", () => this.playground.downloadSVG());
    $("pt-export-png").addEventListener("click", () => this.playground.downloadPNG());
  }

  // ---- Pages ----------------------------------------------------------------------------

  private async addFiles(files: File[]): Promise<void> {
    const images: Array<{ image: File; fileId: string; page: number | null }> = [];
    const sources = new Map<string, File>();
    for (const file of files) {
      const fileId = newId();
      if (isPdf(file)) {
        try {
          const pages = await this.expandPdf(file);
          pages.forEach((image, i) => images.push({ image, fileId, page: i + 1 }));
          if (pages.length > 0) sources.set(fileId, file);
        } catch (e: any) {
          this.setStatus(`${file.name}: could not read this PDF (${e.message || e}).`, "error");
          return;
        }
      } else if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) {
        images.push({ image: file, fileId, page: null });
        sources.set(fileId, file);
      }
    }
    if (images.length === 0) {
      this.setStatus("Those files are not images or PDFs.", "error");
      return;
    }
    this.setStatus(`Preparing ${images.length} page(s)...`);
    for (const { image, fileId, page } of images) {
      try {
        const item: PageItem = {
          id: newId(),
          file: image,
          fileId,
          page,
          name: image.name,
          rotation: 0,
          thumb: null as any,
        };
        item.thumb = await this.thumbFor(item);
        this.pages.push(item);
      } catch (e: any) {
        const hint = /\.(heic|heif)$/i.test(image.name)
          ? " This browser cannot open HEIC photos; export the photo as JPEG, or take it from this page's camera button."
          : "";
        this.setStatus(`${image.name}: ${e.message || e}${hint}`, "error");
        break;
      }
    }
    for (const [id, file] of sources) {
      if (!this.pages.some((p) => p.fileId === id)) continue;
      this.queueSave(async (store) =>
        store.putFile({ id, name: file.name, type: file.type, bytes: await file.arrayBuffer() }),
      );
    }
    this.savePages();
    this.renderThumbs();
    if (this.entries.length === 0) this.newEntry();
    else this.renderEntries();
    this.setStatus(`${this.pages.length} page(s). Pick a region for each transcription in step 4.`, "ok");
  }

  /** One PNG per PDF page, in order. Each page then behaves like a photo. */
  private expandPdf(file: File): Promise<File[]> {
    this.setStatus(`Opening ${file.name}...`);
    return pdfToImages(file, {
      confirmPages: (count) => count <= PDF_PAGE_WARN || confirm(`${file.name} has ${count} pages. Add all of them?`),
      onPage: (n, count) => this.setStatus(`Rendering ${file.name}: page ${n} of ${count}...`),
    });
  }

  private thumbFor(page: PageItem): Promise<PreparedImage> {
    return prepareImage(page.file, {
      name: page.name,
      rotation: page.rotation,
      enhance: this.enhanceBox.checked,
      maxEdge: 600,
    });
  }

  /** The image a region sends: cut from the full-resolution page, then prepared for the API. */
  private regionImage(page: PageItem, crop: CropRect | null): Promise<PreparedImage> {
    return prepareImage(page.file, {
      name: page.name,
      rotation: page.rotation,
      enhance: this.enhanceBox.checked,
      crop,
    });
  }

  private pageLabel(pageId: string): string {
    const index = this.pages.findIndex((p) => p.id === pageId);
    return index < 0 ? "Missing page" : `Page ${index + 1}`;
  }

  private removePage(index: number): void {
    const [gone] = this.pages.splice(index, 1);
    if (!gone) return;
    URL.revokeObjectURL(gone.thumb.previewUrl);
    const before = this.entries.reduce((n, e) => n + e.regions.length, 0);
    this.entries = dropPage(this.entries, gone.id);
    const dropped = before - this.entries.reduce((n, e) => n + e.regions.length, 0);
    this.savePages();
    this.saveEntries();
    this.renderThumbs();
    this.renderEntries();
    if (dropped > 0) this.setStatus(`Removed the page and ${dropped} region(s) on it.`);
  }

  /** Rotates a page. Regions on it were measured on the old orientation, so they reset to the whole page. */
  private async rotatePage(index: number): Promise<void> {
    const page = this.pages[index];
    if (!page) return;
    page.rotation = (page.rotation + 1) % 4;
    const old = page.thumb.previewUrl;
    page.thumb = await this.thumbFor(page);
    URL.revokeObjectURL(old);
    let reset = 0;
    this.entries = this.entries.map((e) => ({
      ...e,
      regions: e.regions.map((r) => {
        if (r.pageId !== page.id || !r.crop) return r;
        reset++;
        return { ...r, crop: null };
      }),
    }));
    this.savePages();
    this.saveEntries();
    this.renderThumbs();
    this.renderEntries();
    if (reset > 0) this.setStatus(`${reset} region(s) on this page now use the whole page. Crop them again (✂).`);
  }

  /** Re-renders the thumbnails after the enhance setting changes, so they show what is sent. */
  private async rethumbAll(): Promise<void> {
    this.setStatus(this.enhanceBox.checked ? "Enhancing pages..." : "Restoring original pages...");
    for (const page of this.pages) {
      const old = page.thumb.previewUrl;
      page.thumb = await this.thumbFor(page);
      URL.revokeObjectURL(old);
    }
    this.renderThumbs();
    this.setStatus(this.pages.length ? `${this.pages.length} page(s) ready.` : "");
  }

  private renderThumbs(): void {
    this.thumbsEl.innerHTML = this.pages
      .map(
        (p, i) => `
      <figure class="pt-thumb">
        <a href="${p.thumb.previewUrl}" target="_blank" rel="noopener" title="Open to proofread">
          <img src="${p.thumb.previewUrl}" alt="Page ${i + 1}: ${escapeHtml(p.name)}">
        </a>
        <figcaption>
          <span title="${escapeHtml(p.name)}">Page ${i + 1}</span>
          <span class="pt-thumb-actions">
            <button type="button" data-action="rotate" data-index="${i}" title="Rotate 90&deg; clockwise">&#8635;</button>
            <button type="button" data-action="remove" data-index="${i}" title="Remove this page">&times;</button>
          </span>
        </figcaption>
      </figure>`,
      )
      .join("");
  }

  // ---- Regions --------------------------------------------------------------------------

  private setupCropDialog(): void {
    const stage = $("pt-crop-stage");
    let start: { x: number; y: number } | null = null;
    const at = (e: PointerEvent) => {
      const r = this.cropImg.getBoundingClientRect();
      return {
        x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
        y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
      };
    };
    stage.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      start = at(e);
      this.setCropRect({ x: start.x, y: start.y, w: 0, h: 0 });
    });
    stage.addEventListener("pointermove", (e) => {
      if (!start) return;
      const p = at(e);
      this.setCropRect({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
    });
    const end = () => (start = null);
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    this.cropPage.addEventListener("change", () => {
      if (!this.cropTarget) return;
      this.cropTarget.pageId = this.cropPage.value;
      this.showCropPage(null);
    });
    $("pt-crop-apply").addEventListener("click", () => {
      const crop = normalizeCrop(this.cropRect);
      if (!crop) {
        $("pt-crop-help").textContent = "Drag a box around a section first, or choose Use whole photo.";
        return;
      }
      this.applyRegion(crop);
    });
    $("pt-crop-clear").addEventListener("click", () => this.applyRegion(null));
    $("pt-crop-cancel").addEventListener("click", () => this.closeCrop());
    this.cropDialog.addEventListener("close", () => {
      if (this.cropImg.src) URL.revokeObjectURL(this.cropImg.src);
      this.cropImg.removeAttribute("src");
      this.cropTarget = null;
    });
  }

  private setCropRect(rect: CropRect | null): void {
    this.cropRect = rect;
    const box = this.cropBox.style;
    if (!rect) {
      box.display = "none";
      return;
    }
    box.display = "block";
    box.left = `${rect.x * 100}%`;
    box.top = `${rect.y * 100}%`;
    box.width = `${rect.w * 100}%`;
    box.height = `${rect.h * 100}%`;
  }

  /**
   * Opens the region dialog for an entry. A new region starts on the page the entry's last
   * region used, or the first page, and the dialog offers every page to choose from.
   */
  private openRegion(entryId: string, regionIndex: number | null): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return;
    if (this.pages.length === 0) {
      this.setStatus("Add a page in step 1 first.", "error");
      return;
    }
    const existing = regionIndex == null ? null : entry.regions[regionIndex];
    const lastPage = entry.regions[entry.regions.length - 1]?.pageId;
    const pageId = existing?.pageId ?? (this.pages.some((p) => p.id === lastPage) ? lastPage! : this.pages[0].id);
    this.cropTarget = { entryId, regionIndex, pageId };

    const field = $("pt-crop-page-field");
    field.hidden = regionIndex != null || this.pages.length < 2;
    this.cropPage.innerHTML = this.pages
      .map((p, i) => `<option value="${p.id}">Page ${i + 1}: ${escapeHtml(p.name)}</option>`)
      .join("");
    this.cropPage.value = pageId;
    this.showCropPage(existing?.crop ?? null);
    if (!this.cropDialog.open) this.cropDialog.showModal();
  }

  /** Shows the target page, rotated and enhanced as it will be sent, so the box lands where meant. */
  private async showCropPage(crop: CropRect | null): Promise<void> {
    const target = this.cropTarget;
    const page = this.pages.find((p) => p.id === target?.pageId);
    if (!target || !page) return;
    const entry = this.entries.find((e) => e.id === target.entryId);
    $("pt-crop-help").textContent =
      `Drag a box around the part of ${this.pageLabel(page.id).toLowerCase()} that holds ` +
      `"${entry?.name ?? "this part"}": one section, or a few rows. Include its heading if it has one.`;
    const whole = await prepareImage(page.file, {
      name: page.name,
      rotation: page.rotation,
      enhance: this.enhanceBox.checked,
      maxEdge: 1600,
    });
    if (this.cropImg.src) URL.revokeObjectURL(this.cropImg.src);
    this.cropImg.src = whole.previewUrl;
    this.setCropRect(crop);
  }

  private closeCrop(): void {
    if (this.cropDialog.open) this.cropDialog.close();
  }

  private applyRegion(crop: CropRect | null): void {
    const target = this.cropTarget;
    this.closeCrop();
    if (!target) return;
    this.entries = this.entries.map((e) => {
      if (e.id !== target.entryId) return e;
      const region = { pageId: target.pageId, crop };
      const regions = e.regions.slice();
      if (target.regionIndex == null) regions.push(region);
      else regions[target.regionIndex] = region;
      return { ...e, regions };
    });
    this.saveEntries();
    this.renderEntries();
  }

  // ---- Transcription entries -------------------------------------------------------------

  private newEntry(): void {
    this.entries = addEntry(this.entries, newId);
    this.saveEntries();
    this.renderEntries();
    const input = this.entriesEl.querySelector(`li:last-child input[data-field="name"]`) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }

  private onEntryInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const field = input.dataset.field;
    const id = input.closest("li")?.dataset.entry;
    if (!id || (field !== "name" && field !== "ragams" && field !== "cycle")) return;
    // Update in place without re-rendering, so the input keeps focus.
    this.entries = this.entries.map((x) => (x.id === id ? { ...x, [field]: input.value } : x));
    this.saveEntries();
  }

  /** The talam and swaras-per-beat selects. */
  private onEntryChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const id = select.closest("li")?.dataset.entry;
    if (!id || select.tagName !== "SELECT") return;
    if (select.dataset.field === "talam") {
      if (select.value === "custom") this.customCycle.add(id);
      else this.customCycle.delete(id);
      const cycle = select.value === "custom" ? "" : select.value;
      this.entries = this.entries.map((x) => (x.id === id ? { ...x, cycle } : x));
    } else if (select.dataset.field === "npb") {
      const npb = Number(select.value) || null;
      this.entries = this.entries.map((x) => (x.id === id ? { ...x, notesPerBeat: npb } : x));
    } else {
      return;
    }
    this.saveEntries();
    this.renderEntries();
    if (select.value === "custom") {
      (this.entriesEl.querySelector(`li[data-entry="${id}"] input[data-field="cycle"]`) as HTMLInputElement)?.focus();
    }
  }

  /** The talam select, swaras-per-beat select and ragam field of one entry. */
  private entryFactsHtml(e: Entry): string {
    const custom = this.customCycle.has(e.id) || (e.cycle !== "" && !KNOWN_CYCLES.has(e.cycle));
    const talamValue = custom ? "custom" : e.cycle;
    const talamOptions = [["", "Talam: read from the page"], ...TALAMS, ["custom", "Other..."]]
      .map(([v, label]) => `<option value="${v}" ${v === talamValue ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("");
    const npbOptions = [`<option value="" ${e.notesPerBeat ? "" : "selected"}>Swaras per beat: read</option>`]
      .concat(
        SWARAS_PER_BEAT.map(
          (n) => `<option value="${n}" ${n === e.notesPerBeat ? "selected" : ""}>${n} per beat</option>`,
        ),
      )
      .join("");
    return `<div class="pt-entry-facts">
      <input class="pt-input pt-entry-ragam" data-field="ragams" value="${escapeHtml(e.ragams)}" aria-label="Ragam of this part" placeholder="Ragam, e.g. Kedaram">
      <select class="pt-input" data-field="talam" aria-label="Talam of this part">${talamOptions}</select>
      <select class="pt-input" data-field="npb" aria-label="Swaras per beat in this part">${npbOptions}</select>
      ${
        custom
          ? `<input class="pt-input pt-entry-ragam" data-field="cycle" value="${escapeHtml(e.cycle)}" aria-label="Cycle" placeholder='Cycle, e.g. "|4|2|2|"'>`
          : ""
      }
    </div>`;
  }

  private onEntryClick(e: Event): void {
    const btn = (e.target as HTMLElement).closest("button[data-action]") as HTMLButtonElement | null;
    const id = btn?.closest("li")?.dataset.entry;
    if (!btn || !id) return;
    const index = this.entries.findIndex((x) => x.id === id);
    const region = btn.dataset.region == null ? null : Number(btn.dataset.region);
    switch (btn.dataset.action) {
      case "run":
        this.run(id);
        break;
      case "insert":
        this.insertResult(id);
        break;
      case "add-region":
        this.openRegion(id, null);
        break;
      case "edit-region":
        this.openRegion(id, region);
        break;
      case "remove-region":
        this.entries = this.entries.map((x) =>
          x.id === id ? { ...x, regions: x.regions.filter((_, i) => i !== region) } : x,
        );
        break;
      case "up":
        this.entries = moveEntry(this.entries, index, -1);
        break;
      case "down":
        this.entries = moveEntry(this.entries, index, 1);
        break;
      case "delete":
        if (this.entries[index]?.result && !confirm(`Delete "${this.entries[index].name}" and its result?`)) return;
        this.entries = this.entries.filter((x) => x.id !== id);
        break;
      default:
        return;
    }
    this.saveEntries();
    this.renderEntries();
  }

  private renderEntries(): void {
    const pageIds = new Set(this.pages.map((p) => p.id));
    const noKey = this.keyInput.value.trim() === "";
    const busy = this.runningId != null;
    this.cancelBtn.hidden = !busy;
    if (this.entries.length === 0) {
      this.entriesEl.innerHTML = `<li class="pt-muted">No transcriptions yet. Add a page, then press + New transcription.</li>`;
      return;
    }
    this.entriesEl.innerHTML = this.entries
      .map((e, i) => {
        const notReady = whyNotReady(e, pageIds);
        const runBlock = busy
          ? "Another transcription is running"
          : notReady || (noKey ? "Enter your API key in step 3" : "");
        const regions = e.regions
          .map((r, ri) => {
            const page = this.pages.find((p) => p.id === r.pageId);
            return `<span class="pt-region">
              ${page ? `<img src="${page.thumb.previewUrl}" alt="">` : ""}
              ${escapeHtml(this.pageLabel(r.pageId))}${r.crop ? ", cropped" : ", whole"}
              <button type="button" class="pt-icon-btn" data-action="edit-region" data-region="${ri}" title="Change this region" ${page ? "" : "disabled"}>&#9986;</button>
              <button type="button" class="pt-icon-btn" data-action="remove-region" data-region="${ri}" title="Remove this region">&times;</button>
            </span>`;
          })
          .join("");
        const status = this.entryStatus(e);
        return `<li class="pt-entry pt-entry-${e.status}" data-entry="${e.id}">
          <div class="pt-entry-head">
            <input class="pt-input" data-field="name" value="${escapeHtml(e.name)}" aria-label="Name of this part" placeholder="e.g. Pallavi - Kedaram">
            <button type="button" class="pt-icon-btn" data-action="up" title="Earlier" ${i === 0 ? "disabled" : ""}>&uarr;</button>
            <button type="button" class="pt-icon-btn" data-action="down" title="Later" ${i === this.entries.length - 1 ? "disabled" : ""}>&darr;</button>
            <button type="button" class="pt-icon-btn" data-action="delete" title="Delete this transcription">&#128465;</button>
          </div>
          ${this.entryFactsHtml(e)}
          <div class="pt-regions">${regions}
            <button type="button" class="btn btn-sm" data-action="add-region" ${this.pages.length ? "" : 'disabled title="Add a page first"'}>+ Region</button>
          </div>
          <div class="pt-entry-row">
            <button type="button" class="btn btn-sm btn-primary" data-action="run" ${runBlock ? `disabled title="${escapeHtml(runBlock)}"` : ""}>${e.result ? "Re-run" : "Transcribe"}</button>
            ${e.result && !e.inserted ? `<button type="button" class="btn btn-sm" data-action="insert" title="Add this result after the editor's notation">Insert</button>` : ""}
          </div>
          ${status ? `<div class="pt-entry-status ${e.status === "failed" ? "pt-entry-status-failed" : ""}">${escapeHtml(status)}</div>` : ""}
        </li>`;
      })
      .join("");
  }

  private entryStatus(e: Entry): string {
    if (e.status === "running") return "Transcribing...";
    if (e.status === "failed") return e.error || "Failed.";
    if (!e.result) return "";
    const cost = `estimated ${formatCost(e.result.costUsd)}`;
    const problems = e.result.problems > 0 ? `${e.result.problems} problem(s) left; ` : "";
    if (!e.inserted)
      return `New result ready (${problems}${cost}). Press Insert to add it after the editor's notation.`;
    return `Done (${problems}${cost}).`;
  }

  /** Appends an entry's last result after the editor's notation. */
  private insertResult(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry?.result) return;
    const existing = this.playground.source;
    this.playground.source = isBlankNotation(existing)
      ? entry.result.notation
      : mergeNotation(existing, entry.result.transcription);
    this.saveNotation(this.playground.source);
    this.playground.render();
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, inserted: true } : e));
    this.setStatus(`Added "${entry.name}" to the editor.`, "ok");
  }

  // ---- Transcription --------------------------------------------------------------------

  private setStatus(message: string, level: "info" | "error" | "ok" = "info"): void {
    this.statusEl.textContent = message;
    this.statusEl.className = `pt-status pt-status-${level}`;
  }

  private setEntry(id: string, change: Partial<Entry>): void {
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, ...change } : e));
    this.saveEntries();
    this.renderEntries();
  }

  private async run(id: string): Promise<void> {
    const apiKey = this.keyInput.value.trim();
    const entry = this.entries.find((e) => e.id === id);
    if (!apiKey || !entry || this.runningId) return;
    if (whyNotReady(entry, new Set(this.pages.map((p) => p.id)))) return;
    if (entry.cycle.trim() && !parseCycle(entry.cycle.trim())) {
      this.setStatus(`"${entry.name}": write the cycle as beats per anga, e.g. "|4|2|2|".`, "error");
      return;
    }

    // Load the SDK only when someone actually transcribes, to keep the page light.
    const { default: Anthropic } = await import(/* webpackChunkName: "anthropic-sdk" */ "@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    this.runningId = id;
    this.abort = new AbortController();
    this.setEntry(id, { status: "running", error: undefined });
    this.reportEl.innerHTML = "";
    this.rawEl.textContent = "";
    this.rawDetails.open = true;
    this.playground.log(
      `Transcribing "${entry.name}" (${entry.regions.length} region(s)) with ${this.modelSelect.value}`,
      "info",
    );
    const thinking = new ThinkingLog((line) => this.playground.log(`Thinking: ${line}`, "info"));
    const existing = this.playground.source;
    const append = !isBlankNotation(existing);
    const prepared: PreparedImage[] = [];

    try {
      this.setStatus(`Preparing ${entry.regions.length} region(s)...`);
      for (const r of entry.regions) {
        prepared.push(
          await this.regionImage(
            this.pages.find((p) => p.id === r.pageId)!,
            r.crop,
          ),
        );
      }
      const result = await transcribe(client, {
        images: prepared.map((p) => ({ data: p.data, mediaType: p.mediaType })),
        hints: this.hintsInput.value,
        model: this.modelSelect.value || DEFAULT_MODEL,
        effort: this.carefulBox.checked ? "xhigh" : "high",
        known: entryFacts(this.notebookFacts(), entry),
        snippet: { only: onlyPart(entry), context: append ? existing : undefined },
        signal: this.abort.signal,
        onStatus: (m) => {
          this.setStatus(m);
          this.playground.log(m, "info");
        },
        onAttemptStart: (attempt) => {
          if (attempt > 0) this.rawEl.textContent += `\n\n----- correction round ${attempt} -----\n\n`;
        },
        onText: (delta) => {
          thinking.flush();
          this.rawEl.textContent += delta;
          this.rawEl.scrollTop = this.rawEl.scrollHeight;
        },
        onThinking: (delta) => thinking.add(delta),
        onProgress: (p) => this.showProgress(p, thinking),
      });
      thinking.flush();

      const current = this.entries.find((e) => e.id === id) ?? entry;
      const insertNow = autoInserts(current);
      this.setEntry(id, {
        status: "done",
        inserted: false,
        result: {
          transcription: result.transcription,
          notation: result.notation,
          costUsd: result.costUsd,
          problems: result.report.errors.length + result.check.errors.length,
        },
      });
      if (insertNow) this.insertResult(id);
      this.rawDetails.open = false;
      this.showReport(result);
      const u = result.usage;
      const inputTotal = u.inputTokens + u.cacheWriteTokens + u.cacheReadTokens;
      this.playground.log(
        `Done in ${result.attempts.length} round(s) on ${result.model}: ` +
          `${inputTotal.toLocaleString()} input tokens (${u.cacheReadTokens.toLocaleString()} from cache), ` +
          `${u.outputTokens.toLocaleString()} output tokens, estimated cost ${formatCost(result.costUsd)}.`,
        "info",
      );
      const gridErrors = result.report.errors.length;
      if (!insertNow) {
        this.setStatus(`New result for "${entry.name}". Press Insert on it to add it to the editor.`, "ok");
      } else if (result.check.errors.length > 0 || gridErrors > 0) {
        this.setStatus(
          "Transcribed, but some lines still do not add up. See below and fix them in the editor.",
          "error",
        );
      } else if (result.report.checks.length > 0 || result.report.inferredSlots > 0) {
        this.setStatus("Transcribed. Check the marked spots against the photo; see below.", "ok");
      } else {
        this.setStatus(`Transcribed ${result.check.lineCount} line(s). Proofread it against the photo.`, "ok");
      }
    } catch (e: any) {
      const msg = this.handleError(e, Anthropic);
      this.setEntry(id, { status: "failed", error: msg });
    } finally {
      for (const p of prepared) URL.revokeObjectURL(p.previewUrl);
      this.runningId = null;
      this.abort = null;
      this.saveEntries();
      this.renderEntries();
    }
  }

  private lastProgressAt = 0;

  /** Token counts in the console at the start and end of each request; a running estimate in the status line. */
  private showProgress(p: StreamProgress, thinking: ThinkingLog): void {
    const round = p.attempt === 0 ? "" : ` (correction round ${p.attempt})`;
    if (p.kind === "started") {
      this.playground.log(
        `Request${round}: ${p.inputTokens.toLocaleString()} input tokens, ${p.cacheReadTokens.toLocaleString()} from cache.`,
        "info",
      );
    } else if (p.kind === "finished") {
      thinking.flush();
      this.playground.log(
        `Reply${round}: ${p.outputTokens.toLocaleString()} output tokens (thinking included), ` +
          `estimated cost ${formatCost(p.costUsd)}, stop: ${p.stopReason}.`,
        "info",
      );
    } else {
      const now = Date.now();
      if (now - this.lastProgressAt < 250) return;
      this.lastProgressAt = now;
      const what = p.phase === "thinking" ? "Thinking" : "Writing the grid";
      this.setStatus(`${what}${round}... about ${p.estimatedOutputTokens.toLocaleString()} tokens so far`);
    }
  }

  /** Facts that hold across the notebook. Each entry adds its own ragam, talam and speed. */
  private notebookFacts(): KnownFacts {
    return { letterCase: (this.caseSelect.value || undefined) as KnownFacts["letterCase"] };
  }

  /** Shows a failed run's reason in the status line and the console, and returns it. */
  private handleError(e: any, Anthropic: any): string {
    let msg: string;
    if (e instanceof Anthropic.APIUserAbortError) msg = "Cancelled.";
    else if (e instanceof Anthropic.AuthenticationError) msg = "The API key was rejected. Check it and try again.";
    else if (e instanceof Anthropic.PermissionDeniedError)
      msg = "This API key does not have access to that model. Try the other model, or check your account.";
    else if (e instanceof Anthropic.RateLimitError) msg = "Rate limited by the API. Wait a moment and try again.";
    else if (e instanceof Anthropic.BadRequestError) msg = `The API rejected the request: ${e.message}`;
    else if (e instanceof Anthropic.APIConnectionError)
      msg = "Could not reach api.anthropic.com. Check your connection (or an ad blocker).";
    else if (e instanceof Anthropic.APIError) msg = `API error ${e.status ?? ""}: ${e.message}`;
    else if (e instanceof TranscriptionRefusedError) msg = e.message;
    else msg = e?.message || String(e);
    this.setStatus(msg, "error");
    this.playground.log(msg, "error");
    return msg;
  }

  private showReport(result: TranscribeResult): void {
    const list = (items: string[]) => `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    const { report, transcription, check } = result;
    const parts: string[] = [];
    const problems = [...report.errors, ...check.errors];
    if (problems.length > 0) {
      parts.push(`<h4>Still wrong</h4>${list(problems)}`);
    }
    if (transcription.timing) {
      parts.push(`<h4>Timing</h4><p class="pt-notes">${escapeHtml(transcription.timing)}</p>`);
    }
    if (report.inferredSlots > 0) {
      parts.push(
        `<h4>Filled in</h4><p>${report.inferredSlots} unit(s) were not written on the page and were placed from ` +
          `spacing and alignment. Each line that has them carries a <code>// unwritten units filled in</code> ` +
          `comment naming the beats.</p>`,
      );
    }
    if (report.checks.length > 0) {
      parts.push(`<h4>Check against the photo</h4>${list(report.checks)}`);
    }
    if (transcription.notes?.length) {
      parts.push(`<h4>Notes from the model</h4>${list(transcription.notes)}`);
    }
    if (result.attempts.length > 1) {
      parts.push(
        `<p class="pt-muted">Took ${result.attempts.length} rounds: lines that did not add up were sent back for correction.</p>`,
      );
    }
    parts.push(
      `<p class="pt-muted">Estimated cost: ${escapeHtml(formatCost(result.costUsd))}. ` +
        `Your Anthropic Console has the actual bill.</p>`,
    );
    this.reportEl.innerHTML = parts.join("");
  }

  // ---- Keeping work across reloads -----------------------------------------------------

  private queueSave(write: (store: PhotoStore) => Promise<void>): void {
    this.saving = this.saving
      .then(async () => {
        const store = await this.storeReady;
        if (store) await write(store);
      })
      .catch((e: any) => this.playground.log(`Could not save to this browser: ${e?.message || e}`, "warning"));
  }

  /** Saves the page list. The store then drops any uploaded file no page uses. */
  private savePages(): void {
    if (this.restoring) return;
    const pages: StoredPage[] = this.pages.map((p) => ({
      id: p.id,
      fileId: p.fileId,
      page: p.page,
      name: p.name,
      rotation: p.rotation,
    }));
    this.queueSave((store) => store.savePages(pages));
  }

  private saveEntries(): void {
    if (this.restoring) return;
    const entries = this.entries;
    this.queueSave((store) => store.saveEntries(entries));
  }

  private saveNotation(source: string): void {
    if (this.restoring) return;
    const text = isBlankNotation(source) ? "" : source;
    this.queueSave((store) => store.saveNotation(text));
  }

  /**
   * Brings back the last visit's notation, pages and transcriptions. A PDF comes back as its
   * stored bytes and is rendered again, once, however many of its pages are in the list.
   *
   * A store from before transcription entries holds a photo list instead. That list becomes
   * pages and one entry here, and the next save replaces it.
   */
  private async restore(): Promise<void> {
    let failed = false;
    try {
      const store = await this.storeReady;
      if (!store) return;
      const notation = await store.notation();
      if (notation && !isBlankNotation(notation)) {
        this.playground.source = notation;
        this.playground.render();
      }
      let saved = await store.pages();
      let entries = await store.entries();
      if (saved === null) {
        const legacy = fromLegacyPhotos(await store.photos(), newId);
        saved = legacy.pages;
        entries = legacy.entries;
      }
      // A run cannot survive a reload.
      entries = entries
        .map(normalizeEntry)
        .map((e) => (e.status === "running" ? { ...e, status: e.result ? "done" : "draft", error: undefined } : e));
      if (saved.length > 0) this.setStatus(`Restoring ${saved.length} page(s) from your last visit...`);
      const files = new Map((await store.files()).map((f) => [f.id, f]));
      const rendered = new Map<string, File[]>();
      const restored: PageItem[] = [];
      for (const s of saved) {
        const stored = files.get(s.fileId);
        if (!stored) continue;
        const source = new File([stored.bytes], stored.name, { type: stored.type });
        let image: File | undefined = source;
        if (s.page != null) {
          if (!rendered.has(stored.id)) {
            rendered.set(
              stored.id,
              await pdfToImages(source, {
                onPage: (n, count) => this.setStatus(`Rendering ${stored.name}: page ${n} of ${count}...`),
              }),
            );
          }
          image = rendered.get(stored.id)![s.page - 1];
        }
        if (!image) continue;
        const item: PageItem = { ...s, file: image, thumb: null as any };
        item.thumb = await this.thumbFor(item);
        restored.push(item);
      }
      // Pages and entries added while this ran go after the restored ones.
      this.pages = [...restored, ...this.pages];
      this.entries = [...entries, ...this.entries];
      this.renderThumbs();
      this.renderEntries();
      if (restored.length > 0 || entries.length > 0) {
        this.setStatus(
          `Restored ${restored.length} page(s) and ${entries.length} transcription(s) from your last visit.`,
        );
      }
    } catch (e: any) {
      // Saving now would replace the stored lists with partial ones and delete their files.
      // Leave the store alone for this visit, so a reload can try again.
      this.storeReady = Promise.resolve(null);
      this.setStatus(
        `Could not restore your last visit (${e?.message || e}). Reload to try again; changes here won't be saved.`,
        "error",
      );
      failed = true;
    } finally {
      this.restoring = false;
      if (!failed) {
        this.savePages();
        this.saveEntries();
      }
    }
  }

  /** Removes every page and transcription from the page and from this browser. The editor keeps its notation. */
  private forgetFiles(): void {
    const any = this.pages.length > 0 || this.entries.length > 0;
    if (any && !confirm("Remove all pages and transcriptions from this page and from this browser?")) return;
    for (const p of this.pages) URL.revokeObjectURL(p.thumb.previewUrl);
    this.pages = [];
    this.entries = [];
    this.renderThumbs();
    this.renderEntries();
    this.queueSave((store) => store.forgetFiles());
    this.setStatus("Pages and transcriptions removed from this browser. The editor keeps its notation.");
  }

  // ---- Output ---------------------------------------------------------------------------

  /** Empties the editor, so the next transcription starts a new song. */
  private clearEditor(): void {
    if (!isBlankNotation(this.playground.source) && !confirm("Clear the editor? Copy or download first to keep it.")) {
      return;
    }
    this.playground.source = PLACEHOLDER_SOURCE;
    this.playground.render();
    this.saveNotation("");
    this.reportEl.innerHTML = "";
    this.setStatus("Editor cleared. The next transcription starts a new song.");
  }

  private async copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.playground.source);
      this.setStatus("Copied the notation to the clipboard.", "ok");
    } catch {
      this.setStatus("Could not copy; select the text in the editor instead.", "error");
    }
  }

  private downloadSource(): void {
    const source = this.playground.source;
    const title = /^title:\s*(.+)$/m.exec(source)?.[1]?.replace(/["']/g, "").trim();
    const fileName = (title || "transcription").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "") + ".sng";
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Collects streamed thinking and logs it a paragraph at a time, so the console gets
 * readable lines instead of one entry per token.
 */
class ThinkingLog {
  private buffer = "";

  constructor(private readonly emit: (line: string) => void) {}

  add(delta: string): void {
    this.buffer += delta;
    const parts = this.buffer.split(/\n\s*\n/);
    this.buffer = parts.pop() || "";
    parts.forEach((p) => this.emitParagraph(p));
  }

  flush(): void {
    this.emitParagraph(this.buffer);
    this.buffer = "";
  }

  private emitParagraph(text: string): void {
    const line = text.replace(/\s+/g, " ").trim();
    if (line) this.emit(line);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("photo-transcribe-container")) {
    (window as any).photoTranscribePlayground = new PhotoTranscribePlayground();
  }
});
