# Notations Library Documentation

This directory contains the complete documentation for the Notations library, built using **s3gen** (Go-based static site generator).

## Directory Structure

```
docs/
├── main.go                  # s3gen site configuration
├── go.mod                   # Go module definition
├── Makefile                 # Build automation & symlink management
├── content/                 # Source content (Markdown/HTML)
│   ├── index.html          # Documentation homepage
│   ├── SiteMetadata.json   # Global site configuration
│   ├── HeaderNavLinks.json # Navigation structure
│   ├── getting-started/    # Installation & quick start
│   ├── tutorials/          # Progressive tutorials
│   │   ├── 01-basics/      # Fundamentals
│   │   ├── 02-commands/    # Commands & control
│   │   ├── 03-embelishments/ # Gamakas & ornaments
│   │   └── 04-advanced/    # Advanced topics
│   ├── reference/          # Complete syntax reference
│   ├── cookbook/           # Real-world examples
│   ├── api/               # Developer API documentation
│   └── contributing/       # Contributor guides
├── templates/              # Go template files
│   ├── BasePage.html      # Main page template
│   ├── Header.html        # Site header
│   ├── Sidebar.html       # Sidebar with navigation
│   ├── Footer.html        # Site footer
│   ├── Content.html       # Default content template
│   └── nav/              # Section-specific navigation
├── components/            # TypeScript interactive components
│   ├── DocsPage.ts       # Main page controller
│   └── NotationBlock.ts  # Interactive notation renderer
├── static/               # Static assets
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript
│   │   └── gen/        # Webpack-generated bundles
│   └── images/          # Images and icons
└── sites/               # Build output
    └── docs/           # Generated static site
```

## Content Organization

### Front Matter Format

All content files use YAML front matter:

```html
---
title: "Page Title"
description: "Page description for meta tags"
date: 2025-01-10
author: "Author Name"
tags: ["tag1", "tag2"]
toc: true
prev:
  title: "Previous Page"
  url: "/docs/previous/"
next:
  title: "Next Page"
  url: "/docs/next/"
---

<h1>Page Content</h1>
<p>Content goes here...</p>
```

### Interactive Notation Examples

Use custom `<notation>` HTML tags for interactive examples:

```html
<notation id="example1" showSource="true" caption="Example Title">
S R G M P D N S'
sa ri ga ma pa dha ni sa
</notation>
```

**Attributes:**
- `id`: Unique identifier (required)
- `showSource`: Show source code (true/false)
- `caption`: Caption text above the notation
- Content: Notation DSL code

## Building the Documentation

### Prerequisites

1. **Go**: Install Go 1.20+ (for s3gen)
2. **Node.js**: Install Node.js 18+ (for TypeScript components)
3. **s3gen**: Symlink or reference to s3gen library

### Development Workflow

1. **Build TypeScript components** (first time or when changed):
   ```bash
   cd docs/components
   pnpm install
   pnpm build
   # Output: docs/static/js/gen/
   ```

2. **Build documentation site**:
   ```bash
   # From notations root
   go run docs/main.go
   # Or just run the site with watch mode
   NOTATIONS_ENV=dev go run docs/main.go
   ```

3. **View site**:
   - Open `docs/sites/docs/index.html` in browser
   - Or serve with local server:
     ```bash
     cd docs/sites/docs
     python3 -m http.server 8000
     # Visit http://localhost:8000
     ```

### Watch Mode (Live Reload)

For development, use watch mode:

```bash
NOTATIONS_ENV=dev go run docs/main.go
```

This will:
- Watch content files for changes
- Automatically rebuild affected pages
- Batch changes over 1 second

## Templates

### Template Engine

Uses **templar** (superset of Go html/template) with special syntax:

**Include Syntax:**
```html
{{# include "Header.html" #}}
{{# include "nav/TutorialsNav.html" #}}
```

**Template Data:**
- `.Site`: Global site configuration
- `.Res`: Current resource/page
- `.FrontMatter`: Parsed front matter map
- `.Content`: Page content (bytes)

### Built-in Functions

- `AllRes()`: Get all resources
- `LeafPages(hideDrafts, orderby, offset, count)`: Get non-index pages
- `PagesByDate(...)`: Date-sorted pages
- `PagesByTag(tag, ...)`: Tag-filtered pages
- `json(path, fieldpath)`: Load JSON data
- `HtmlTemplate(file, name, params)`: Render template

### Creating New Templates

1. Add template file to `docs/templates/`
2. Reference in front matter:
   ```yaml
   ---
   template: "MyCustomTemplate.html"
   ---
   ```
3. Or set as `BodyTemplateName` param in main.go

## Deployment

### Build for Production

```bash
# Build TypeScript components (production mode)
cd docs/components
pnpm build:production

# Build site
NOTATIONS_ENV=production go run docs/main.go

# Output ready in: docs/sites/docs/
```

### Deploy to GitHub Pages

```bash
# Copy output to gh-pages branch or docs/ folder in main branch
cp -r docs/sites/docs/* ../gh-pages/

# Or configure GitHub Pages to serve from /docs directory
```

### Deploy to Netlify/Vercel

1. Build command: `go run docs/main.go`
2. Output directory: `docs/sites/docs`
3. Set environment: `NOTATIONS_ENV=production`

## Content Authoring Guidelines

### Writing Tutorials

1. **Progressive Difficulty**: Build on previous concepts
2. **Interactive Examples**: Include `<notation>` tags for every concept
3. **Clear Sections**: Use headings (##, ###) for structure
4. **Code Blocks**: Use markdown fenced code blocks with language tags
5. **Cross-References**: Link to reference docs and other tutorials

### Writing Reference Docs

1. **Complete Coverage**: Document every feature
2. **Syntax Tables**: Use tables for parameter lists
3. **Examples**: Show usage for each feature
4. **Cross-References**: Link to tutorials where concepts are taught

### Writing Cookbook Examples

1. **Real Compositions**: Use actual ragas, talas, compositions
2. **Annotations**: Explain techniques used
3. **Tags**: Add appropriate tags for filtering
4. **Difficulty Level**: Indicate complexity (beginner/intermediate/advanced)

## Navigation Structure

Navigation is defined in `HeaderNavLinks.json` (top menu) and `nav/*.html` templates (sidebar).

### Adding New Pages

1. Create content file with front matter
2. Add link to appropriate navigation template
3. Set `prev`/`next` in front matter for pagination
4. Rebuild site

### Adding New Sections

1. Create directory in `content/`
2. Create `index.html` for section homepage
3. Create navigation template in `templates/nav/`
4. Add to `HeaderNavLinks.json`
5. Add section detection in `Sidebar.html`

## Troubleshooting

### Common Issues

**Build fails:**
- Check Go version (1.20+)
- Verify s3gen is accessible
- Check front matter YAML syntax

**Notation examples don't render:**
- Verify TypeScript components are built
- Check `gen.DocsPage.html` is included in template
- Inspect browser console for errors

**Templates not updating:**
- Restart watch mode
- Check template syntax errors
- Verify include paths

**Styles not applied:**
- Check CSS file paths in templates
- Verify static folder configuration in main.go
- Clear browser cache

## Contributing

See [CONTRIBUTING.md](/docs/contributing/) for guidelines on:
- Writing documentation
- Adding examples
- Improving templates
- Reporting issues

---

**Last Updated**: 2025-01-10
**Documentation Version**: 1.0
