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

### Path Configuration
- PathPrefix: `/notations` for GitHub Pages subdomain hosting
- Static assets copied manually (s3gen limitation workaround)
- Webpack configured to match path prefix for JS bundles

### Build Pipeline
1. Webpack builds TypeScript components → static/js/gen/
2. s3gen generates static HTML from content/ + templates/
3. Static folder manually copied to dist/docs/
4. Deployment script pushes to gh-pages branch

## Patterns and Conventions

### Notation Syntax
- `\cycle()` for tala structure
- `\beatDuration()` for tempo
- `Sw:` for swaras, `Sh:` for sahitya, `Pe:` for percussion
- `\line()` for section labels
- Gamakas: `(note kampitam)`, `(note jaru note)`, `(note~note)`

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
- Branch: gh-pages (auto-deployed)
- URL: https://panyam.github.io/notations/
- `.nojekyll` file prevents Jekyll processing

### Deployment Command
```bash
make gh-pages
```

This command:
1. Rebuilds TypeScript components
2. Rebuilds static site
3. Copies static assets
4. Force-pushes to gh-pages branch

## Recent Updates

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
