/**
 * @jest-environment jsdom
 */
import NotationBlock from "../web/components/NotationBlock";

/** A stand-in for NotationView: jsdom cannot lay out SVG, and these tests are about the block. */
function fakeViewer() {
  return { tableElement: document.createElement("table"), renderNotation: jest.fn() } as any;
}

/** Mounts a <notation> element the way DocsPage does, and waits for the first render. */
async function mount(source: string, attrs: Record<string, string> = {}) {
  document.body.innerHTML = "";
  const parent = document.createElement("div");
  const container = document.createElement("notation");
  container.textContent = source;
  for (const [k, v] of Object.entries({ id: "n1", showSource: "true", ...attrs })) container.setAttribute(k, v);
  parent.appendChild(container);
  document.body.appendChild(parent);
  let viewer: any;
  const block = new NotationBlock(container, {
    createViewer: () => (viewer = fakeViewer()),
  });
  await block.rendering;
  return { block, root: block.newRoot, viewer };
}

function key(target: Element, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

const GOOD = "Sw: S R G M";
const PAYLOAD = `Sw: S R <img src=x onerror="window.__pwned = 1">`;

describe("NotationBlock markup", () => {
  test("shows notation source as text, never as HTML", async () => {
    const { root } = await mount(PAYLOAD);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("code")!.textContent).toContain("<img src=x");
  });

  test("an id with quotes and tags stays an attribute", async () => {
    const { root } = await mount(GOOD, { id: `n1"><b id="pwn` });
    expect(root.querySelector("b")).toBeNull();
    expect(root.querySelectorAll("button")).toHaveLength(4);
  });

  test("the caption is text", async () => {
    const { root } = await mount(GOOD, { caption: "<i>Mohanam</i>" });
    expect(root.querySelector("i")).toBeNull();
    expect(root.querySelector("figcaption")!.textContent).toBe("<i>Mohanam</i>");
  });

  test("applying an edit shows the new source as text", async () => {
    const { block, root } = await mount(GOOD);
    block.enterEditMode();
    block.editTextarea!.value = PAYLOAD;
    await block.applyEdit();
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("code")!.textContent).toContain("<img src=x");
  });
});

describe("NotationBlock parse errors", () => {
  test("shows returned parse errors in the output", async () => {
    const { root, viewer } = await mount(`\\cycle("|4|`);
    const alert = root.querySelector('[role="alert"]')!;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain("Unexpected");
    expect(viewer.renderNotation).not.toHaveBeenCalled();
  });

  test("shows an error that load() throws", async () => {
    const { root } = await mount(`\\beatDuration("x")`);
    expect(root.querySelector('[role="alert"]')!.textContent).toContain("beatDuration command must contain one number");
  });

  test("clears the error once the source parses", async () => {
    const { block, root, viewer } = await mount(`\\cycle("|4|`);
    block.enterEditMode();
    block.editTextarea!.value = GOOD;
    await block.applyEdit();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(viewer.renderNotation).toHaveBeenCalledTimes(1);
  });

  test("error text is never parsed as HTML", async () => {
    const { root } = await mount(`\\unknown<img src=x>Cmd(1)`);
    expect(root.querySelector("img")).toBeNull();
  });
});

describe("NotationBlock rendering state", () => {
  test("marks the output busy until the render finishes", async () => {
    const { block, root } = await mount(GOOD);
    const output = root.querySelector(".notation-view")!;
    const done = block.updatePreview();
    expect(output.getAttribute("aria-busy")).toBe("true");
    await done;
    expect(output.getAttribute("aria-busy")).toBe("false");
  });

  test("when renders overlap, only the latest one renders and clears busy", async () => {
    const { block, root, viewer } = await mount(GOOD);
    const output = root.querySelector(".notation-view")!;
    viewer.renderNotation.mockClear();
    const first = block.updatePreview();
    const second = block.updatePreview();
    await first;
    expect(output.getAttribute("aria-busy")).toBe("true");
    await second;
    expect(output.getAttribute("aria-busy")).toBe("false");
    expect(viewer.renderNotation).toHaveBeenCalledTimes(1);
  });
});

describe("NotationBlock keyboard shortcuts", () => {
  test("Ctrl+Enter applies the edit", async () => {
    const { block } = await mount(GOOD);
    block.enterEditMode();
    block.editTextarea!.value = "Sw: P D S";
    key(block.editTextarea!, { key: "Enter", ctrlKey: true });
    await block.rendering;
    expect(block.source).toBe("Sw: P D S");
    expect(block.isEditing).toBe(false);
  });

  test("Cmd+Enter applies the edit", async () => {
    const { block } = await mount(GOOD);
    block.enterEditMode();
    block.editTextarea!.value = "Sw: P D S";
    key(block.editTextarea!, { key: "Enter", metaKey: true });
    await block.rendering;
    expect(block.source).toBe("Sw: P D S");
  });

  test("Escape cancels and keeps the old source", async () => {
    const { block } = await mount(GOOD);
    block.enterEditMode();
    block.editTextarea!.value = "Sw: P D S";
    key(block.editTextarea!, { key: "Escape" });
    expect(block.source).toBe(GOOD);
    expect(block.isEditing).toBe(false);
    expect(block.editTextarea!.style.display).toBe("none");
  });

  test("plain Enter still types a newline", async () => {
    const { block } = await mount(GOOD);
    block.enterEditMode();
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    block.editTextarea!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(block.isEditing).toBe(true);
  });
});

describe("NotationBlock keyboard access", () => {
  test("the source and the output can take focus, so a keyboard can scroll them", async () => {
    const { root } = await mount("S R G M", { caption: "Basic Swaras" });
    const pre = root.querySelector("pre.notation-source-pre")!;
    const view = root.querySelector(".notation-view")!;
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(view.getAttribute("tabindex")).toBe("0");
    expect(view.getAttribute("role")).toBe("group");
    expect(pre.getAttribute("aria-label")).toBe("Notation source: Basic Swaras");
    expect(view.getAttribute("aria-label")).toBe("Rendered notation: Basic Swaras");
  });

  test("without a caption the labels still say what each box is", async () => {
    const { root } = await mount("S R G M");
    expect(root.querySelector("pre.notation-source-pre")!.getAttribute("aria-label")).toBe("Notation source");
    expect(root.querySelector(".notation-view")!.getAttribute("aria-label")).toBe("Rendered notation");
  });
});
