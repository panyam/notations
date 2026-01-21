import { NotationView } from "../../src/carnatic";
export declare function createMarkdownParser(): (contents: string) => string;
export declare function createViewer(rootElement: HTMLElement): NotationView;
export declare function initViewerDiv(elemSelector: string, codeSelector: string): NotationView | null;
