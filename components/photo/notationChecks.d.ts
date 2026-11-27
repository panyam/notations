export interface NotationCheck {
    errors: string[];
    warnings: string[];
    lineCount: number;
}
export declare function checkNotation(source: string): NotationCheck;
