import type { TranscribeImage } from "./transcriber";
export declare const MAX_EDGE = 2400;
export interface PreparedImage extends TranscribeImage {
    previewUrl: string;
    width: number;
    height: number;
    name: string;
}
export declare function enhancePixels(data: Uint8ClampedArray, width: number, height: number): void;
export interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface PrepareOptions {
    name?: string;
    rotation?: number;
    enhance?: boolean;
    crop?: CropRect | null;
    maxEdge?: number;
}
export declare function normalizeCrop(crop: CropRect | null | undefined): CropRect | null;
export declare function cropGeometry(naturalWidth: number, naturalHeight: number, rotation: number, crop: CropRect | null, maxEdge: number): {
    turns: number;
    rotatedW: number;
    rotatedH: number;
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scale: number;
    outW: number;
    outH: number;
};
export declare function prepareImage(file: Blob, options?: PrepareOptions): Promise<PreparedImage>;
