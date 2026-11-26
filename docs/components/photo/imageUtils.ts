/**
 * imageUtils.ts - Prepares phone photos for the vision API, in the browser.
 *
 * Phone cameras produce 12-50 MP images that are several MB each, more than the API accepts per
 * image and far more detail than it uses. We redraw each photo on a canvas, capped on its long
 * edge, and re-encode it as JPEG. Drawing an <img> applies the EXIF orientation in current
 * browsers, so a portrait photo arrives upright.
 */

import type { TranscribeImage } from "./transcriber";

/** Long edge cap. Large enough that small printed swaras and octave dots stay legible. */
export const MAX_EDGE = 2400;
/** The API's per-image limit is 5 MB of base64; stay well under it. */
const MAX_BASE64_BYTES = 4_500_000;

export interface PreparedImage extends TranscribeImage {
  /** Object URL for showing a thumbnail; revoke when the image is removed. */
  previewUrl: string;
  width: number;
  height: number;
  name: string;
}

/**
 * Makes a phone photo of a notation page look like a scan: dark ink on an evenly white page.
 *
 * Works in place on RGBA pixels. Colour carries no meaning in notation, so the result is
 * grayscale. Three steps:
 *
 * 1. Estimate the paper's brightness around every pixel (the brightest value in a coarse grid
 *    of blocks, interpolated), and divide by it. This removes shadows, a lighting gradient and
 *    yellowed paper, which a single global stretch cannot: on a page in half shadow the shaded
 *    paper is darker than the ink in the light.
 * 2. Stretch so the darkest ink goes to black and near-paper goes to white. The black point comes from the darkest 0.5% of
 *    pixels, since notation is sparse: often well under 2% of a page is ink.
 * 3. A gamma curve darkens faint strokes (pencil, faded print) more than it darkens paper.
 */
export function enhancePixels(data: Uint8ClampedArray, width: number, height: number): void {
  const n = width * height;
  if (n === 0 || data.length < n * 4) return;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    lum[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  // 1. Background: max per block, then bilinear interpolation between block centres.
  const block = Math.max(8, Math.round(Math.min(width, height) / 24));
  const bw = Math.ceil(width / block);
  const bh = Math.ceil(height / block);
  const bg = new Float32Array(bw * bh);
  for (let y = 0; y < height; y++) {
    const by = Math.floor(y / block) * bw;
    for (let x = 0; x < width; x++) {
      const k = by + Math.floor(x / block);
      const v = lum[y * width + x];
      if (v > bg[k]) bg[k] = v;
    }
  }
  const at = (bx: number, by: number) => bg[Math.min(bh - 1, Math.max(0, by)) * bw + Math.min(bw - 1, Math.max(0, bx))];
  const norm = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / block - 0.5;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / block - 0.5;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const b =
        (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
        (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
      const v = Math.min(255, (lum[y * width + x] / Math.max(b, 1)) * 255);
      norm[y * width + x] = v;
      hist[Math.round(v)]++;
    }
  }

  // 2. Black point from the darkest 0.5%, never so high that it would erase real contrast.
  let acc = 0;
  let lo = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * 0.005) {
      lo = v;
      break;
    }
  }
  // White point a little below the paper level: interpolating block maxima overshoots a few
  // percent where the light changes, and anything that close to the paper is paper.
  const hi = 232;
  lo = Math.min(lo, hi - 48);
  const range = hi - lo;

  // 3. Stretch plus gamma; near-white stays white, faint grey moves well toward black.
  for (let i = 0; i < n; i++) {
    const t = Math.max(0, Math.min(1, (norm[i] - lo) / range));
    const v = Math.round(255 * Math.pow(t, 2));
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = v;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file could not be read as an image."));
    img.src = url;
  });
}

/**
 * Downscales and re-encodes one image file.
 *
 * @param rotateQuarterTurns extra clockwise rotation, for photos taken sideways
 * @param enhance convert to high-contrast grayscale (see enhancePixels)
 */
export async function prepareImage(
  file: Blob,
  name = "photo",
  rotateQuarterTurns = 0,
  enhance = false,
): Promise<PreparedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const turns = ((rotateQuarterTurns % 4) + 4) % 4;
    const swap = turns % 2 === 1;

    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot process images (no canvas support).");
    ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    if (enhance) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      enhancePixels(pixels.data, canvas.width, canvas.height);
      ctx.putImageData(pixels, 0, 0);
    }

    let quality = 0.9;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_BASE64_BYTES && quality > 0.5) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return {
      data: dataUrl.slice(dataUrl.indexOf(",") + 1),
      mediaType: "image/jpeg",
      previewUrl: URL.createObjectURL(blob || file),
      width: canvas.width,
      height: canvas.height,
      name,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
