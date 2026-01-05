/**
 * DockView-based components for notations-web.
 *
 * Import from "notations-web/dockview" to use these components.
 * This keeps DockView out of the main bundle for users who don't need it.
 *
 * Usage:
 * ```typescript
 * import { DockViewPlayground } from "notations-web/dockview";
 *
 * const playground = new DockViewPlayground(container, {
 *   initialSource: "s r g m p",
 * });
 * ```
 */

export { default as DockViewPlayground, DockViewPlaygroundConfig } from "./components/DockViewPlayground";

// Re-export SideBySideEditor for convenience
export { default as SideBySideEditor, SideBySideEditorConfig } from "./components/SideBySideEditor";
