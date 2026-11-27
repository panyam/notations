/**
 * `notations/parser`: the DSL parser, and `load()` and `parse()` with the Carnatic gamakas wired in.
 *
 * It builds the runtime model from `notations/core` and doesn't reach the renderer. To parse with a
 * different set of gamakas, create a `Parser` with your own `EmbellishmentParser`.
 */
export * from "./parser";
export * from "./loader";
export { carnaticGamakas, Gamaka, GamakaType, JaaruGamaka } from "./carnatic/gamakas";
export type { ParseError } from "galore";
