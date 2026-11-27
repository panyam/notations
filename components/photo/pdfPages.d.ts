export declare const PDF_PAGE_EDGE = 3200;
export declare const PDF_PAGE_WARN = 20;
export declare function isPdf(file: File): boolean;
export declare function pdfRenderScale(width: number, height: number, edge?: number): number;
export declare function pdfPageName(pdfName: string, page: number, pageCount: number): string;
export interface PdfPagesOptions {
    onPage?: (page: number, pageCount: number) => void;
    confirmPages?: (pageCount: number) => boolean;
}
export declare function pdfToImages(file: File, options?: PdfPagesOptions): Promise<File[]>;
