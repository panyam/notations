# notations-web

Web components for the [Notations](https://github.com/panyam/notations) library - interactive notation blocks, editors, and viewers for Carnatic music notation.

## Installation

```bash
npm install notations-web notations
```

Note: `notations` is a peer dependency and must be installed separately.

## Components

### NotationBlock

Interactive component for rendering `<notation>` tags with optional source code display.

#### Basic Usage

```typescript
import { NotationBlock, NotationBlockConfig } from "notations-web";
import * as N from "notations";

// Define your viewer factory
function createViewer(container: HTMLDivElement): N.Carnatic.NotationView {
  const tableElement = document.createElement("table");
  tableElement.classList.add("notation-table");
  container.appendChild(tableElement);
  return new N.Carnatic.NotationView(tableElement);
}

// Configure the component
const config: NotationBlockConfig = {
  createViewer,
  cssClasses: {
    sourceContainer: "bg-gray-100",
    sourceCaption: "font-bold",
    sourceCode: "text-sm",
    outputContainer: "p-4",
  }
};

// Find and process all <notation> tags
document.addEventListener("DOMContentLoaded", () => {
  const notations = document.querySelectorAll("notation");
  notations.forEach(container => {
    new NotationBlock(container as HTMLElement, config);
  });
});
```

#### HTML Usage

```html
<notation id="example1" showSource="true" caption="Basic Scale">
S R G M P D N S'
sa ri ga ma pa dha ni sa
</notation>
```

#### Attributes

- `id` (optional): Unique identifier, auto-generated if not provided
- `caption` (optional): Caption text for the source code block
- `showSource` (optional): Set to "true" to display source code (default: "false")
- `sourceFrom` (optional): ID of another element to read source from
- `height` (optional): Height constraint for the output

#### Configuration

```typescript
interface NotationBlockConfig {
  createViewer: (container: HTMLDivElement) => N.Carnatic.NotationView;
  cssClasses?: {
    root?: string;              // Applied to root container
    sourceContainer?: string;   // Applied to source code container
    sourceCaption?: string;     // Applied to caption
    sourceCode?: string;        // Applied to code element
    outputLabel?: string;       // Applied to "Output:" label
    outputContainer?: string;   // Applied to notation output container
  };
}
```

## Examples

### With Tailwind CSS

```typescript
const config: NotationBlockConfig = {
  createViewer,
  cssClasses: {
    sourceContainer: "bg-white dark:bg-gray-800 rounded-lg p-4",
    sourceCaption: "text-lg font-semibold text-gray-900 dark:text-gray-100",
    sourceCode: "text-sm font-mono text-gray-800 dark:text-gray-200",
    outputContainer: "overflow-auto bg-white dark:bg-gray-700",
  }
};
```

### With Custom CSS

```typescript
const config: NotationBlockConfig = {
  createViewer,
  cssClasses: {
    sourceContainer: "notation-source-custom",
    sourceCaption: "notation-caption-custom",
    outputContainer: "notation-output-custom",
  }
};
```

## Development

This package is part of the Notations monorepo.

```bash
# Build the package
npm run build

# Watch for changes
npm run watch
```

## Future Components

- `NotationEditor`: Interactive editor with live preview
- `NotationViewer`: Standalone viewer component
- More to come!

## License

ISC

## Repository

https://github.com/panyam/notations
