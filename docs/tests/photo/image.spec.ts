import { enhancePixels } from "../../components/photo/imageUtils";

/** A width x height page: paper whose brightness falls off left to right, with faint ink strokes. */
function page(width: number, height: number, ink: (x: number, y: number) => boolean) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const light = 1 - 0.55 * (x / width); // right side in shadow
      const paper = [230 * light, 220 * light, 175 * light]; // yellowed
      const c = ink(x, y) ? paper.map((v) => v * 0.6) : paper; // faint: ink only 40% darker than paper
      px.set([c[0], c[1], c[2], 255], (y * width + x) * 4);
    }
  }
  return px;
}

const W = 200;
const H = 100;
const lum = (px: Uint8ClampedArray, x: number, y: number) => px[(y * W + x) * 4];
// Sparse ink: a few short strokes, well under 2% of the page, as on a real notation page.
const isInk = (x: number, y: number) => y >= 48 && y <= 51 && x % 40 >= 10 && x % 40 <= 13;

describe("enhancePixels", () => {
  test("sparse faint ink on a shadowed, yellowed page comes out dark on white", () => {
    const px = page(W, H, isInk);
    // Before: the shaded paper on the right is darker than the ink on the left.
    expect(lum(px, 190, 10)).toBeLessThan(lum(px, 11, 49));
    enhancePixels(px, W, H);
    for (const x of [11, 91, 171]) expect(lum(px, x, 49)).toBeLessThan(110); // ink, light or shade
    for (const x of [5, 100, 195]) expect(lum(px, x, 10)).toBeGreaterThan(235); // paper, light or shade
    expect(px[(10 * W + 100) * 4]).toBe(px[(10 * W + 100) * 4 + 2]); // grayscale
    expect(px[3]).toBe(255); // alpha untouched
  });

  test("a blank page stays white instead of amplifying noise", () => {
    const px = page(W, H, () => false);
    enhancePixels(px, W, H);
    for (let i = 0; i < W * H; i += 97) expect(px[i * 4]).toBeGreaterThan(235);
  });
});
