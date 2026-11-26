/**
 * PhotoTranscribePlayground.ts - Photo to Notations DSL, in the browser.
 *
 * The left panel collects photos, optional hints and the visitor's own Anthropic API key; the
 * right side is the usual DockViewPlayground (editor, preview, console), so the transcription
 * can be proofread and fixed in place.
 *
 * The API key goes from the browser straight to api.anthropic.com. It is kept in localStorage
 * only when the visitor ticks "Remember", and never sent anywhere else. The docs site is static,
 * so there is no server of ours in the path.
 */

import { DockViewPlayground } from "../../../src/web/dockview";
import "dockview-core/dist/styles/dockview.css";
import "../../../styles/NotationView.scss";

import { createMarkdownParser } from "../NotationViewer";
import { isBlankNotation, mergeNotation, parseCycle } from "../photo/grid";
import type { KnownFacts } from "../photo/prompt";
import { CropRect, normalizeCrop, prepareImage, PreparedImage } from "../photo/imageUtils";
import { DEFAULT_MODEL, TranscribeResult, transcribe, TranscriptionRefusedError } from "../photo/transcriber";

const KEY_STORAGE = "notations-photo-anthropic-key";
const MODEL_STORAGE = "notations-photo-model";
const LAYOUT_STORAGE_KEY = "notations-photo-layout";
const LAYOUT_VERSION = 1;

const PLACEHOLDER_SOURCE = `// Your transcription will appear here.
// Add a photo on the left and press Transcribe.
// You can edit the result; the preview updates as you type.
`;

interface PhotoItem {
  file: Blob;
  name: string;
  rotation: number;
  /** Region to keep, on the rotated photo; null for the whole photo. */
  crop: CropRect | null;
  /**
   * Whether the user has chosen what to send from this photo: a region, or the whole photo on
   * purpose. Transcription waits until every photo has one. A whole page is a lot of counting
   * in one go and gives each swara few pixels; a section at a time reads better and costs less.
   */
  regionSet: boolean;
  prepared: PreparedImage;
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
  private photos: PhotoItem[] = [];
  private abort: AbortController | null = null;

  private keyInput = $("pt-api-key") as HTMLInputElement;
  private rememberBox = $("pt-remember") as HTMLInputElement;
  private modelSelect = $("pt-model") as HTMLSelectElement;
  private enhanceBox = $("pt-enhance") as HTMLInputElement;
  private carefulBox = $("pt-careful") as HTMLInputElement;
  private hintsInput = $("pt-hints") as HTMLTextAreaElement;
  private ragamsInput = $("pt-ragams") as HTMLInputElement;
  private talamSelect = $("pt-talam") as HTMLSelectElement;
  private cycleInput = $("pt-cycle") as HTMLInputElement;
  private npbSelect = $("pt-npb") as HTMLSelectElement;
  private caseSelect = $("pt-case") as HTMLSelectElement;
  private transcribeBtn = $("pt-transcribe") as HTMLButtonElement;
  private cancelBtn = $("pt-cancel") as HTMLButtonElement;
  private statusEl = $("pt-status");
  private rawEl = $("pt-raw");
  private rawDetails = $("pt-raw-details") as HTMLDetailsElement;
  private reportEl = $("pt-report");
  private thumbsEl = $("pt-thumbs");
  private onlyInput = $("pt-only") as HTMLInputElement;
  private modeSelect = $("pt-mode") as HTMLSelectElement;
  private cropDialog = $("pt-crop-dialog") as HTMLDialogElement;
  private cropImg = $("pt-crop-img") as HTMLImageElement;
  private cropBox = $("pt-crop-box");
  private cropIndex = -1;
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
      onParseError: (errors) => errors.forEach((e) => this.playground?.log(`Parse error: ${e.message || e}`, "error")),
    });
    this.playground.source = PLACEHOLDER_SOURCE;
    this.setupControls();
    this.updateButtons();
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
      this.updateButtons();
    });
    this.rememberBox.addEventListener("change", () => {
      safeSet(KEY_STORAGE, this.rememberBox.checked ? this.keyInput.value.trim() || null : null);
    });
    this.modelSelect.addEventListener("change", () => safeSet(MODEL_STORAGE, this.modelSelect.value));
    this.enhanceBox.addEventListener("change", () => this.reprepareAll());
    this.talamSelect.addEventListener("change", () => {
      $("pt-cycle-field").hidden = this.talamSelect.value !== "custom";
    });

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
      if (files.some((f) => f.type.startsWith("image/"))) this.addFiles(files);
    });

    this.thumbsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button[data-action]") as HTMLButtonElement | null;
      if (!btn) return;
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;
      if (action === "remove") this.removePhoto(index);
      else if (action === "rotate") this.rotatePhoto(index);
      else if (action === "left") this.movePhoto(index, -1);
      else if (action === "right") this.movePhoto(index, 1);
      else if (action === "crop") this.openCrop(index);
      else if (action === "duplicate") this.duplicatePhoto(index);
    });
    this.setupCropDialog();

    this.transcribeBtn.addEventListener("click", () => this.run());
    this.cancelBtn.addEventListener("click", () => this.abort?.abort());
    $("pt-copy").addEventListener("click", () => this.copySource());
    $("pt-download").addEventListener("click", () => this.downloadSource());
    $("pt-reset-layout").addEventListener("click", () => this.playground.resetLayout());
  }

  // ---- Photos ---------------------------------------------------------------------------

  private async addFiles(files: File[]): Promise<void> {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (images.length === 0) {
      this.setStatus("Those files are not images.", "error");
      return;
    }
    this.setStatus(`Preparing ${images.length} photo(s)...`);
    for (const file of images) {
      try {
        const item: PhotoItem = {
          file,
          name: file.name,
          rotation: 0,
          crop: null,
          regionSet: false,
          prepared: null as any,
        };
        item.prepared = await this.prep(item);
        this.photos.push(item);
      } catch (e: any) {
        const hint = /\.(heic|heif)$/i.test(file.name)
          ? " This browser cannot open HEIC photos; export the photo as JPEG, or take it from this page's camera button."
          : "";
        this.setStatus(`${file.name}: ${e.message || e}${hint}`, "error");
        return;
      }
    }
    this.renderThumbs();
    this.updateButtons();
    this.pickNextRegion();
  }

  /** Opens the region picker on the first photo still without a region, if any. */
  private pickNextRegion(): void {
    const next = this.photos.findIndex((p) => !p.regionSet);
    if (next >= 0) {
      this.openCrop(next);
    } else if (this.photos.length > 0) {
      this.setStatus("Ready. Transcribe, or crop (\u2702) to change a region.");
    }
  }

  private removePhoto(index: number): void {
    const [gone] = this.photos.splice(index, 1);
    if (gone) URL.revokeObjectURL(gone.prepared.previewUrl);
    this.renderThumbs();
    this.updateButtons();
  }

  private async rotatePhoto(index: number): Promise<void> {
    const item = this.photos[index];
    if (!item) return;
    item.rotation = (item.rotation + 1) % 4;
    item.crop = null; // a crop measured on the old orientation no longer means anything
    item.regionSet = false;
    const old = item.prepared.previewUrl;
    item.prepared = await this.prep(item);
    URL.revokeObjectURL(old);
    this.renderThumbs();
  }

  /** Re-encodes every photo after the enhance setting changes, so the thumbnails show what is sent. */
  private async reprepareAll(): Promise<void> {
    this.setStatus(this.enhanceBox.checked ? "Enhancing photos..." : "Restoring original photos...");
    for (const item of this.photos) {
      const old = item.prepared.previewUrl;
      item.prepared = await this.prep(item);
      URL.revokeObjectURL(old);
    }
    this.renderThumbs();
    this.setStatus(this.photos.length ? `${this.photos.length} photo(s) ready.` : "");
  }

  private prep(item: PhotoItem): Promise<PreparedImage> {
    return prepareImage(item.file, {
      name: item.name,
      rotation: item.rotation,
      enhance: this.enhanceBox.checked,
      crop: item.crop,
    });
  }

  /** A second copy of a photo, so two regions of one page can be cropped and sent in order. */
  private async duplicatePhoto(index: number): Promise<void> {
    const src = this.photos[index];
    if (!src) return;
    const copy: PhotoItem = { ...src, crop: null, regionSet: false, prepared: null as any };
    copy.prepared = await this.prep(copy);
    this.photos.splice(index + 1, 0, copy);
    this.renderThumbs();
    this.updateButtons();
    this.openCrop(index + 1);
  }

  // ---- Cropping -------------------------------------------------------------------------

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

    $("pt-crop-apply").addEventListener("click", () => {
      const crop = normalizeCrop(this.cropRect);
      if (!crop) {
        $("pt-crop-help").textContent = "Drag a box around a section first, or choose Use whole photo.";
        return;
      }
      this.applyCrop(crop);
    });
    $("pt-crop-clear").addEventListener("click", () => this.applyCrop(null));
    $("pt-crop-cancel").addEventListener("click", () => this.closeCrop());
    this.cropDialog.addEventListener("close", () => {
      if (this.cropImg.src) URL.revokeObjectURL(this.cropImg.src);
      this.cropImg.removeAttribute("src");
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

  private async openCrop(index: number): Promise<void> {
    const item = this.photos[index];
    if (!item) return;
    this.cropIndex = index;
    // Show the whole photo, rotated and enhanced as it will be sent, so the box lands where meant.
    const whole = await prepareImage(item.file, {
      name: item.name,
      rotation: item.rotation,
      enhance: this.enhanceBox.checked,
      maxEdge: 1600,
    });
    this.cropImg.src = whole.previewUrl;
    this.setCropRect(item.crop);
    const which = this.photos.length > 1 ? ` (photo ${index + 1} of ${this.photos.length})` : "";
    $("pt-crop-help").textContent =
      `Drag a box around the part to transcribe${which}: one section, or a few rows. ` +
      "Include its heading if it has one.";
    if (!this.cropDialog.open) this.cropDialog.showModal();
  }

  private closeCrop(): void {
    this.cropIndex = -1;
    if (this.cropDialog.open) this.cropDialog.close();
  }

  private async applyCrop(crop: CropRect | null): Promise<void> {
    const item = this.photos[this.cropIndex];
    this.closeCrop();
    if (!item) return;
    item.crop = crop;
    item.regionSet = true;
    const old = item.prepared.previewUrl;
    item.prepared = await this.prep(item);
    URL.revokeObjectURL(old);
    this.renderThumbs();
    this.updateButtons();
    this.pickNextRegion();
  }

  private movePhoto(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= this.photos.length) return;
    [this.photos[index], this.photos[to]] = [this.photos[to], this.photos[index]];
    this.renderThumbs();
  }

  private renderThumbs(): void {
    const many = this.photos.length > 1;
    this.thumbsEl.innerHTML = this.photos
      .map(
        (p, i) => `
      <figure class="pt-thumb">
        <a href="${p.prepared.previewUrl}" target="_blank" rel="noopener" title="Open full size to proofread">
          <img src="${p.prepared.previewUrl}" alt="Page ${i + 1}: ${escapeHtml(p.name)}">
        </a>
        <figcaption>
          <span>${many ? `Page ${i + 1}` : escapeHtml(p.name)}${
            !p.regionSet
              ? ' <em class="pt-badge pt-badge-todo">pick a region</em>'
              : p.crop
                ? ' <em class="pt-badge">cropped</em>'
                : ' <em class="pt-badge">whole photo</em>'
          }</span>
          <span class="pt-thumb-actions">
            ${many ? `<button type="button" data-action="left" data-index="${i}" title="Earlier page" ${i === 0 ? "disabled" : ""}>&larr;</button>` : ""}
            ${many ? `<button type="button" data-action="right" data-index="${i}" title="Later page" ${i === this.photos.length - 1 ? "disabled" : ""}>&rarr;</button>` : ""}
            <button type="button" data-action="crop" data-index="${i}" title="Crop to one section">&#9986;</button>
            <button type="button" data-action="duplicate" data-index="${i}" title="Duplicate, to crop another region">&#10697;</button>
            <button type="button" data-action="rotate" data-index="${i}" title="Rotate 90&deg; clockwise">&#8635;</button>
            <button type="button" data-action="remove" data-index="${i}" title="Remove">&times;</button>
          </span>
        </figcaption>
      </figure>`,
      )
      .join("");
  }

  // ---- Transcription --------------------------------------------------------------------

  private updateButtons(): void {
    const busy = this.abort != null;
    const unpicked = this.photos.filter((p) => !p.regionSet).length;
    this.transcribeBtn.disabled = busy || this.photos.length === 0 || unpicked > 0 || this.keyInput.value.trim() === "";
    this.transcribeBtn.title =
      this.photos.length === 0
        ? "Add a photo first"
        : unpicked > 0
          ? "Pick the region to transcribe on each photo (\u2702)"
          : this.keyInput.value.trim() === ""
            ? "Enter your API key"
            : "";
    this.cancelBtn.hidden = !busy;
  }

  private setStatus(message: string, level: "info" | "error" | "ok" = "info"): void {
    this.statusEl.textContent = message;
    this.statusEl.className = `pt-status pt-status-${level}`;
  }

  private async run(): Promise<void> {
    const apiKey = this.keyInput.value.trim();
    if (!apiKey || this.photos.length === 0) return;
    if (this.talamSelect.value === "custom" && !parseCycle(this.cycleInput.value)) {
      this.setStatus('Write the cycle as beats per anga, e.g. "|4|2|2|".', "error");
      return;
    }

    // Load the SDK only when someone actually transcribes, to keep the page light.
    const { default: Anthropic } = await import(/* webpackChunkName: "anthropic-sdk" */ "@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    this.abort = new AbortController();
    this.updateButtons();
    this.reportEl.innerHTML = "";
    this.rawEl.textContent = "";
    this.rawDetails.open = true;
    this.playground.log(`Transcribing ${this.photos.length} photo(s) with ${this.modelSelect.value}`, "info");
    const existing = this.playground.source;
    const append = this.modeSelect.value === "append" && !isBlankNotation(existing);

    try {
      const result = await transcribe(client, {
        images: this.photos.map((p) => ({ data: p.prepared.data, mediaType: p.prepared.mediaType })),
        hints: this.hintsInput.value,
        model: this.modelSelect.value || DEFAULT_MODEL,
        effort: this.carefulBox.checked ? "xhigh" : "high",
        known: this.knownFacts(),
        snippet: { only: this.onlyInput.value.trim() || undefined, context: append ? existing : undefined },
        signal: this.abort.signal,
        onStatus: (m) => {
          this.setStatus(m);
          this.playground.log(m, "info");
        },
        onAttemptStart: (attempt) => {
          if (attempt > 0) this.rawEl.textContent += `\n\n----- correction round ${attempt} -----\n\n`;
        },
        onText: (delta) => {
          this.rawEl.textContent += delta;
          this.rawEl.scrollTop = this.rawEl.scrollHeight;
        },
      });

      this.playground.source = append ? mergeNotation(existing, result.transcription) : result.notation;
      // After the first section, the natural next step is the next section: add, don't replace.
      this.modeSelect.value = "append";
      this.playground.render();
      this.rawDetails.open = false;
      this.showReport(result);
      const u = result.usage;
      this.playground.log(
        `Done in ${result.attempts.length} round(s) on ${result.model}: ${u.inputTokens} input tokens ` +
          `(${u.cacheReadTokens} from cache), ${u.outputTokens} output tokens.`,
        "info",
      );
      const gridErrors = result.report.errors.length;
      if (result.check.errors.length > 0 || gridErrors > 0) {
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
      this.handleError(e, Anthropic);
    } finally {
      this.abort = null;
      this.updateButtons();
    }
  }

  private knownFacts(): KnownFacts {
    const talam = this.talamSelect.value;
    const cycle = talam === "custom" ? this.cycleInput.value.trim() : talam;
    return {
      ragams: this.ragamsInput.value.trim() || undefined,
      cycle: cycle && parseCycle(cycle) ? cycle : undefined,
      notesPerBeat: Number(this.npbSelect.value) || undefined,
      letterCase: (this.caseSelect.value || undefined) as KnownFacts["letterCase"],
    };
  }

  private handleError(e: any, Anthropic: any): void {
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
    this.reportEl.innerHTML = parts.join("");
  }

  // ---- Output ---------------------------------------------------------------------------

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

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("photo-transcribe-container")) {
    (window as any).photoTranscribePlayground = new PhotoTranscribePlayground();
  }
});
