/**
 * `notations/export`: gets rendered notation out of the page.
 *
 * It works on any page that renders notation with `NotationView`, and doesn't pull in the editor,
 * the notebook or the dock playground from `notations/web`. Everything here needs a browser,
 * since the renderer measures text in the DOM.
 */
export { preparePrint, printNotation, PrintOptions } from "./export/print";
