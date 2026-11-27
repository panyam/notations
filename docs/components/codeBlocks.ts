/**
 * codeBlocks.ts - Keyboard access to code blocks that scroll sideways.
 *
 * A <pre> wider than the page scrolls on its own. Keyboard users can only scroll it if it can take
 * focus (WCAG 2.1.1), but a tab stop on every short block would be noise. So a block gets one only
 * while it actually overflows, and the check runs again when the window resizes.
 */

const MARK = "data-scroll-focus";

/** Gives each overflowing block a tab stop and a label, and takes them off blocks that now fit. */
export function focusableWhenScrolling(blocks: Iterable<HTMLElement>): void {
  for (const el of blocks) {
    const overflowing = el.scrollWidth > el.clientWidth;
    if (overflowing && !el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "region");
      el.setAttribute("aria-label", "Code");
      el.setAttribute(MARK, "");
    } else if (!overflowing && el.hasAttribute(MARK)) {
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
      el.removeAttribute(MARK);
    }
  }
}

/** Runs focusableWhenScrolling on the page's content code blocks now and after each resize. */
export function initCodeBlocks(doc: Document = document): void {
  const run = () => focusableWhenScrolling(doc.querySelectorAll<HTMLElement>(".content pre:not(.notation-source-pre)"));
  run();
  let pending = 0;
  doc.defaultView?.addEventListener("resize", () => {
    clearTimeout(pending);
    pending = window.setTimeout(run, 150);
  });
}
