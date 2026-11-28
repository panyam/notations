# Notations

A TypeScript library for parsing, modeling, and rendering Carnatic music notation.

**[Live Demo](https://notations.us)** | **[Documentation](https://panyam.github.io/notations/)**

## Features

- **DSL Parser** - Intuitive text-based notation format
- **Flexible Rendering** - SVG-based output with CSS theming
- **Framework Agnostic** - Works with React, Vue, vanilla JS, or any framework
- **Light/Dark Mode** - Built-in theme support via CSS variables

## Quick Start

### Via CDN (no build tools required)

```html
<link rel="stylesheet" href="https://unpkg.com/notations/dist/NotationView.min.css">
<script src="https://unpkg.com/notations/dist/notations.umd.min.js"></script>

<script>
  const source = `
\\cycle("|4|2|2|")
Sw: S R G M P D N S.
  `;

  const container = document.getElementById('notation');
  const [notation, beatLayout, errors] = Notations.load(source);

  if (errors.length === 0) {
    const view = new Notations.Carnatic.NotationView(container);
    view.renderNotation(notation, beatLayout);
  }
</script>
```

### Via npm/pnpm

```bash
npm install notations
```

```typescript
import * as N from 'notations';
import 'notations/dist/NotationView.css';

const source = `
\\cycle("|4|2|2|")
Sw: S R G M P D N S.
`;

const [notation, beatLayout, errors] = N.load(source);

if (errors.length === 0) {
  const container = document.getElementById('notation');
  const view = new N.Carnatic.NotationView(container);
  view.renderNotation(notation, beatLayout);
}
```

### Parsing without the renderer

`notations/core` is the runtime model alone (atoms, cycles, notations, `AtomIterator`, the beat
layout), about 8 KB gzipped. `notations/parser` adds the DSL parser and `load()`. Neither includes
the SVG renderer.

```typescript
import { load } from 'notations/parser';
import { AtomIterator } from 'notations/core';
```

To use `Parser` directly, give it the gamakas to read: `new Parser({ embellishments: carnaticGamakas })`.
`load()` and `parse()` do that for you.

### Printing and export

`notations/export` prints a notation on its own, sized to the page. It renders the source again
into a print-only copy, so the rest of the page stays out of the printout. "Save as PDF" in the
print dialog gives a PDF. It needs a browser, and it doesn't pull in the editor or the playground.

```typescript
import { printNotation } from 'notations/export';

printNotation(source, { markdownParser: (md) => marked.parse(md) });
```

`exportSVG(source)` returns the notation as one standalone SVG, in the light theme on white.
Headings and front matter become SVG text, keeping bold and italic. `exportPNG(source)` draws
that SVG at twice its size. `downloadSVG` and `downloadPNG` save either as a file.

```typescript
import { downloadPNG, exportSVG } from 'notations/export';

const svg = exportSVG(source);              // a string, ready to save or embed
await downloadPNG(source, 'kriti.png');
```

## Documentation

- **[Getting Started](https://panyam.github.io/notations/getting-started/)** - Installation and setup
- **[Tutorials](https://panyam.github.io/notations/tutorials/)** - Learn the notation syntax
- **[Demos](https://panyam.github.io/notations/demos/playgrounds/)** - Demos
- **[API Reference](https://panyam.github.io/notations/api/)** - Full API documentation
- **[Integration Guide](https://panyam.github.io/notations/api/integration-guide/)** - React, Vue, Node.js integration
- **[Styling & Theming](https://panyam.github.io/notations/api/styling/)** - Customize appearance with CSS variables
- **[Visual Tests](https://panyam.github.io/notations/demos/visual-tests/)** - Visual sanity tests for notation rendering

## License

MIT
