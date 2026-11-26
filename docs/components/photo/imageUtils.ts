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
 */
export async function prepareImage(file: Blob, name = "photo", rotateQuarterTurns = 0): Promise<PreparedImage> {
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
