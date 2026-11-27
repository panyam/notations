/**
 * `notations/core`: the runtime model, with no parser and no renderer.
 *
 * Atoms and groups, cycles, notations with their blocks and lines, iterators over atoms with
 * exact durations, and the beat layout. Build a notation in code, or take one from
 * `notations/parser`, and walk it. Nothing here touches the DOM, and nothing pulls in the DSL's
 * grammar libraries.
 */
export * from "./entity";
export * from "./events";
export * from "./cycle";
export * from "./core";
export * from "./iterators";
export * from "./layouts";
export * from "./grids";
export * from "./beats";
export * from "./notation";
export * as Utils from "./utils";
