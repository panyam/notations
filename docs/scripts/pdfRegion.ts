/**
 * Picks a page, or a region of a page, out of a PDF for the transcriber CLI.
 *
 * A region is cut by pdftoppm at 300 dpi, before any downscaling, so a section keeps the
 * detail a whole page loses. On the Valachi Vachi notebook, a faint octave dot that a
 * whole-page run missed came through on a crop of the same rows (#52).
 */

import type { CropRect } from "../components/photo/imageUtils";

/** Resolution for a cropped region. A whole page renders at WHOLE_PAGE_DPI. */
export const CROP_DPI = 300;
export const WHOLE_PAGE_DPI = 200;

/** "x,y,w,h" as fractions of the page, from the top left: "0,0.05,1,0.2" is the top fifth. */
export function parseCrop(text: string): CropRect {
  const parts = text.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--crop "${text}" should be x,y,w,h as fractions of the page, e.g. 0,0.05,1,0.2`);
  }
  const [x, y, w, h] = parts;
  const eps = 1e-9;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 + eps || y + h > 1 + eps) {
    throw new Error(
      `--crop "${text}" must lie inside the page: x and y from 0, w and h above 0, x+w and y+h at most 1`,
    );
  }
  return { x, y, w, h };
}

/** A page's size in points, from `pdfinfo -f N -l N` output. */
export function pdfPageSize(pdfinfoOutput: string, page: number): { width: number; height: number } {
  const re = new RegExp(`^Page\\s+${page}\\s+size:\\s+([\\d.]+)\\s+x\\s+([\\d.]+)\\s+pts`, "m");
  const m = pdfinfoOutput.match(re);
  if (!m) throw new Error(`pdfinfo did not report a size for page ${page}`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

export interface PageSelection {
  /** 1-based page. Without it, every page renders. */
  page?: number;
  /** Region of that page. Needs `page` and `pageSize`. */
  crop?: CropRect;
  /** The page's size in points, from pdfPageSize. */
  pageSize?: { width: number; height: number };
}

/** Arguments for pdftoppm that render `selection` of `pdf` as JPEGs named `outPrefix`-N.jpg. */
export function pdftoppmArgs(pdf: string, outPrefix: string, selection: PageSelection): string[] {
  const { page, crop, pageSize } = selection;
  const dpi = crop ? CROP_DPI : WHOLE_PAGE_DPI;
  const args = ["-r", String(dpi)];
  if (page) args.push("-f", String(page), "-l", String(page));
  if (crop) {
    if (!pageSize) throw new Error("a crop needs the page size");
    const px = (pts: number) => (pts * dpi) / 72;
    const width = px(pageSize.width);
    const height = px(pageSize.height);
    args.push(
      "-x",
      String(Math.round(crop.x * width)),
      "-y",
      String(Math.round(crop.y * height)),
      "-W",
      String(Math.round(crop.w * width)),
      "-H",
      String(Math.round(crop.h * height)),
    );
  }
  args.push("-jpeg", pdf, outPrefix);
  return args;
}
