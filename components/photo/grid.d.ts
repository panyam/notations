export interface MetadataEntry {
    key: string;
    value: string;
}
export interface GridRole {
    role: string;
    beats: string[];
}
export interface GridLine {
    label: string;
    partial: boolean;
    roles: GridRole[];
    uncertain: string;
}
export interface GridSection {
    heading: string;
    text: string;
    cycle: string;
    beatDuration: number;
    lines: GridLine[];
}
export interface Transcription {
    metadata: MetadataEntry[];
    cycle: string;
    timing: string;
    sections: GridSection[];
    notes: string[];
}
export declare const TRANSCRIPTION_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["metadata", "cycle", "timing", "sections", "notes"];
    readonly properties: {
        readonly metadata: {
            readonly type: "array";
            readonly description: "Printed metadata: title, composer, ragam, talam, arohanam, avarohanam, language, source...";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["key", "value"];
                readonly properties: {
                    readonly key: {
                        type: string;
                        description: string;
                    };
                    readonly value: {
                        type: string;
                        description: string;
                    };
                };
            };
        };
        readonly cycle: {
            type: string;
            description: string;
        };
        readonly timing: {
            type: string;
            description: string;
        };
        readonly sections: {
            readonly type: "array";
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly required: readonly ["heading", "text", "cycle", "beatDuration", "lines"];
                readonly properties: {
                    readonly heading: {
                        type: string;
                        description: string;
                    };
                    readonly text: {
                        type: string;
                        description: string;
                    };
                    readonly cycle: {
                        type: string;
                        description: string;
                    };
                    readonly beatDuration: {
                        readonly type: "integer";
                        readonly description: "Slots per beat in this section";
                    };
                    readonly lines: {
                        readonly type: "array";
                        readonly items: {
                            readonly type: "object";
                            readonly additionalProperties: false;
                            readonly required: readonly ["label", "partial", "roles", "uncertain"];
                            readonly properties: {
                                readonly label: {
                                    type: string;
                                    description: string;
                                };
                                readonly partial: {
                                    readonly type: "boolean";
                                    readonly description: "True only if the printed line really is not a whole number of avartanams";
                                };
                                readonly roles: {
                                    readonly type: "array";
                                    readonly items: {
                                        readonly type: "object";
                                        readonly additionalProperties: false;
                                        readonly required: readonly ["role", "beats"];
                                        readonly properties: {
                                            readonly role: {
                                                type: string;
                                                description: string;
                                            };
                                            readonly beats: {
                                                readonly type: "array";
                                                readonly description: "One string per beat: exactly beatDuration slots separated by spaces";
                                                readonly items: {
                                                    readonly type: "string";
                                                };
                                            };
                                        };
                                    };
                                };
                                readonly uncertain: {
                                    type: string;
                                    description: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        readonly notes: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly description: "Notes for the proofreader";
        };
    };
};
export interface ParsedSlot {
    text: string;
    inferred: boolean;
}
export interface ParsedBeat {
    slots: ParsedSlot[];
    error: string | null;
}
export declare function parseBeat(beat: string): ParsedBeat;
export declare function parseCycle(cycle: string): number[] | null;
export declare function normalizeRole(role: string): string;
export interface GridReport {
    errors: string[];
    inferredSlots: number;
    checks: string[];
}
export declare function validateTranscription(t: Transcription): GridReport;
export declare function isBlankNotation(source: string): boolean;
export declare function mergeNotation(existing: string, t: Transcription): string;
export declare function toNotation(t: Transcription, options?: {
    metadata?: boolean;
}): string;
