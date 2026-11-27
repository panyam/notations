/**
 * Turns an uploaded PDF into one PNG per page, so each page goes through the same
 * rotate, crop and prepare steps as a photo.
 *
 * pdf.js is about 1 MB with its worker, so it loads only when someone picks a PDF.
 */

/** Long edge of a rendered page in pixels. Crops come from this, then prepareImage downscales. */
export const PDF_PAGE_EDGE = 3200;

/** More pages than this is probably the wrong file; the caller asks before rendering them. */
export const PDF_PAGE_WARN = 20;

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** The scale that makes a page of this size (PDF points) render with its long edge at `edge` px. */
export function pdfRenderScale(width: number, height: number, edge = PDF_PAGE_EDGE): number {
  const longest = Math.max(width, height);
  return longest > 0 ? edge / longest : 1;
}

/** "notebook.pdf", page 2 of 12 → "notebook-p02.png". */
export function pdfPageName(pdfName: string, page: number, pageCount: number): string {
  const base = pdfName.replace(/\.pdf$/i, "");
  const digits = String(pageCount).length;
  return `${base}-p${String(page).padStart(digits, "0")}.png`;
}

export interface PdfPagesOptions {
  /** Called before each page renders, for progress. */
  onPage?: (page: number, pageCount: number) => void;
  /** Called once with the page count. Return false to stop before rendering anything. */
  confirmPages?: (pageCount: number) => boolean;
}

/** Renders every page of `file` to a PNG File, in page order. */
export async function pdfToImages(file: File, options: PdfPagesOptions = {}): Promise<File[]> {
  const pdfjs = await import(/* webpackChunkName: "pdfjs" */ "pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // webpack emits the worker as a separate file and gives back its URL.
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    if (options.confirmPages && !options.confirmPages(doc.numPages)) return [];
    const pages: File[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      options.onPage?.(n, doc.numPages);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pdfRenderScale(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // A white background, so scans with transparency do not come out black.
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error(`could not render page ${n}`);
      pages.push(new File([blob], pdfPageName(file.name, n, doc.numPages), { type: "image/png" }));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
