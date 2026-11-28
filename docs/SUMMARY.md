# Notations Documentation - Summary

## Purpose
This folder contains the complete documentation site for the Notations library, built using s3gen (Go-based static site generator) with interactive TypeScript components.

## Key Components

### Content Structure
- **Getting Started**: Installation guides and quick start tutorials
- **Tutorials**: Progressive learning path (basics → commands → embellishments → advanced)
- **Reference**: Complete syntax documentation for DSL commands, cycles, and embellishments
- **Examples**: Real-world notation examples including:
  - Basic Varnam (Ninnu Kori in Mohanam)
  - Complex Gamakas and embellishments
  - Ragam Tanam Pallavi structure
  - Tisram notation (3 notes per beat)
  - Organizing long compositions
  - Percussion notation (mridangam/tabla)
- **Library**: every song in panyam/notation_demos on its own page, with indexes by composer and by ragam. `pnpm run library` generates `content/library/` (gitignored) from the commit `library.json` pins, and fails if a song doesn't parse (#71). `--bump` pins notation_demos master's latest commit. `make run` and `make render` run it first.
- **Sharing**: the side-by-side playground's Share gives a library song's page while it's unchanged, and otherwise a `/view/#s=<link>` URL that carries the source (`components/share.ts`, #77). The link is a format byte and the deflated source, as base64url, in the style of thambura's share links. `/view/` renders it on its own, readable on a phone, with Print / PDF, SVG, PNG and "Open in playground". The playground also keeps a draft in localStorage. A library page's "Open in playground" passes `?song=<path>`, and the playground reads the song from that page.
- **API Documentation**: Integration guides and API reference
- **Contributing**: Guidelines for contributors

### Technical Stack
- **Backend**: s3gen (Go) for static site generation
- **Frontend**: TypeScript with NotationBlock web components
- **Build Tools**: webpack for JS bundling, pnpm for package management
- **Hosting**: GitHub Pages at https://panyam.github.io/notations/

### Interactive Features
The documentation includes interactive notation examples with:
- **Copy Button**: Copy notation source to clipboard
- **Edit Mode**: Live editing with instant preview updates
- **Responsive Design**: Mobile-friendly with adaptive UI

### Visual Sanity Test Suite
The documentation includes a visual regression testing page:
- **Test Cases**: File-based in `docs/static/visual-tests/cases/`
- **Structure**: Each case has `input.txt` and optional `expected.html`
- **Categories**: Basic notation, embellishments, layout configurations
- **Copy Button**: Capture rendered output to update baselines
- **URL**: `/api/visual-tests/`

## Architecture Decisions

### Site Generation (s3gen)
- Chosen for templating flexibility and Go's performance
- Uses templar for template includes and advanced features
- Supports front matter (YAML) for page metadata
- Watch mode for development with auto-rebuild

### Web Components (notations-web)
- Separated into standalone package for reusability
- TypeScript-based for type safety
- Custom NotationBlock component handles:
  - Source code display with syntax highlighting
  - Interactive editing with live preview
  - Clipboard integration
  - Responsive behavior
- **DockViewPlayground**: Reusable playground with DockView-based resizable panels
  - Configurable: syncScroll, markdownParser, layoutVersion, showConsole
  - Layout persistence to localStorage with version tracking
  - Console visibility API: showConsole(), hideConsole(), toggleConsole()
  - CSS class-based theming via `.dvp-panel`, `.dvp-console-*` classes
- **SideBySideEditor**: Editor + output with synchronized scrolling

### Path Configuration
- PathPrefix: `/notations` for GitHub Pages subdomain hosting
- Static assets copied manually (s3gen limitation workaround)
- Webpack configured to match path prefix for JS bundles

### Build Pipeline
1. Webpack builds TypeScript components → static/js/gen/
1. `pnpm run library` writes the song pages into content/library/
2. s3gen generates static HTML from content/ + templates/
3. Static folder manually copied to dist/docs/
4. The Docs workflow publishes dist/docs to GitHub Pages after CI passes on master

## Patterns and Conventions

### Notation Syntax
- `\cycle()` for tala structure
- `\beatDuration()` for tempo
- `Sw:` for swaras, `Sh:` for sahitya, `Pe:` for percussion
- `\line()` for section labels
- Gamakas: `(note kampitam)`, `(note jaru note)`, `(note~note)`
- Duration prefixes: `2 R` makes R have duration 2 (twice as long)

### Rendering Architecture (Duration-Based Layout)

The rendering system uses a duration-based layout algorithm to ensure atoms with
extended durations are visually proportional to their musical time:

**Width Calculation** (`GroupView.refreshMinSize()`):
1. For each atom, calculate: `widthPerDuration = (visualWidth + spacing) / duration`
2. Take the maximum `widthPerDuration` across all atoms
3. Total group width = `maxWidthPerDuration × totalDuration`

**Positioning** (`GroupView.refreshLayout()`):
1. Use column width from grid layout (for global alignment) or fall back to minSize
2. Calculate glyph position: `glyphX = (timeOffset / totalDuration) × groupWidth`
3. Adjust for left embellishments: `atomX = glyphX - glyphOffset` (ensures note glyph aligns at time position)
4. Optionally render "," continuation markers for atoms with duration > 1

**Width Flow**:
```
ColAlign.evalMaxLength() → cellView.minSize.width (determines column width)
ColAlign.setOffset() → BeatView.setBounds(columnWidth) → GroupView.setBounds(columnWidth)
                     → GroupView.refreshLayout() uses columnWidth for positioning
```

### File Organization
- One folder per notation example
- Index.html for section landing pages
- Consistent front matter structure
- Cross-linking between related pages

### Styling
- CSS custom properties for theming
- Dark code blocks for better readability
- Responsive grid layouts
- Button icons from Bootstrap Icons (SVG inline)

## Deployment

### GitHub Pages Setup
- Repository: panyam/notations
- Source: GitHub Actions (`.github/workflows/docs.yml`), after CI passes on master
- URL: https://panyam.github.io/notations/
- `.nojekyll` file prevents Jekyll processing

### Deployment Commands
```bash
make deploy   # run the Docs workflow on master now
make site     # build the production site into dist/docs, without deploying
```

The workflow rebuilds the TypeScript components, renders the site with s3gen, copies the
static assets in, and publishes the result with actions/deploy-pages.

## Recent Updates

### January 2026
- **Visual Sanity Test Suite**: Added visual regression test page for notation rendering
  - File-based test cases with `input.txt` and `expected.html`
  - Custom s3gen template functions (`includeFile`, `includeFileText`)
  - Copy button for capturing rendered output to update baselines
  - 11 test cases covering basic, embellishments, and layout categories
- **UI Fix**: Dropdown menu hover gap fixed with invisible CSS bridge
- **Duration-Based Layout Algorithm**: Atoms within beats are now positioned proportionally
  to their musical duration, ensuring notes with extended durations (e.g., `2 R`) visually
  occupy the correct amount of horizontal space
- **Continuation Markers**: Notes with duration > 1 now display "," markers at each
  additional time slot (configurable via `showContinuationMarkers` flag)
- **Global Column Alignment**: BeatView propagates column width to GroupView, enabling
  atoms across different beats in the same column to align based on time offset
- **Glyph Offset for Embellishments**: Left embellishments (e.g., Jaaru `~G/`) no longer
  cause note overlap. The `glyphOffset` property accounts for embellishment width when
  positioning atoms, ensuring the note glyph aligns at its correct time position
- Refactored SideBySidePlayground to use DockViewPlayground as core
- Enhanced DockViewPlayground with layout versioning, console visibility API
- Added synchronized scrolling between editor and output panels
- Fixed light/dark mode theming for DockView panels
- Exported DockViewPlayground from notations-web package

### November 2025
- Added comprehensive notation examples (6 new pages)
- Implemented copy-to-clipboard feature
- Implemented live edit mode with preview
- Fixed static asset deployment issues
- Updated main README with documentation link
- Improved responsive design for mobile devices

## Known Issues
- Two directory warnings in s3gen logs (harmless, can be ignored)
- Large webpack bundle size (579 KB) - optimization opportunity
- Static folder requires manual copy (s3gen doesn't auto-copy)
- Button wrapping on narrow screens needs fix
