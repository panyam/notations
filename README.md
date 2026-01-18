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

## Documentation

- **[Getting Started](https://panyam.github.io/notations/getting-started/)** - Installation and setup
- **[Tutorials](https://panyam.github.io/notations/tutorials/)** - Learn the notation syntax
- **[Demos](https://panyam.github.io/notations/demos/playgrounds/)** - Demos
- **[API Reference](https://panyam.github.io/notations/api/)** - Full API documentation
- **[Integration Guide](https://panyam.github.io/notations/api/integration-guide/)** - React, Vue, Node.js integration
- **[Styling & Theming](https://panyam.github.io/notations/api/styling/)** - Customize appearance with CSS variables
- **[Visual Tests](https://panyam.github.io/notations/demos/visual-tests/)** - Visual sanity tests for notation rendering

## License

ISC
