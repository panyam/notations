# Next Steps - Notations Documentation

## Completed

### Infrastructure (Phase 0-1) ✅
- [x] Set up s3gen documentation framework
- [x] Create docs/ directory structure with content/, templates/, static/
- [x] Configure s3gen build workflow (main.go, go.mod, Makefile)
- [x] Set up TypeScript components (DocsPage.ts, NotationViewer.ts)
- [x] Configure webpack for JS bundling
- [x] Deploy to GitHub Pages (https://panyam.github.io/notations/)
- [x] Fix critical s3gen bug with JSON frontmatter parsing

### Interactive Features ✅
- [x] Copy-to-clipboard button for notation source
- [x] Edit mode with live preview updates
- [x] Apply/Cancel buttons for edit mode
- [x] NotationBlock web component with source display

### Content ✅
- [x] Documentation homepage (index.html)
- [x] Getting started section (installation guide)
- [x] Examples section with 8 notation examples:
  - Basic Varnam (Ninnu Kori in Mohanam)
  - Complex Gamakas and embellishments
  - Ragam Tanam Pallavi structure
  - Tisram notation (3 notes per beat)
  - Organizing long compositions
  - Percussion notation (mridangam/tabla)
  - Common Talas
  - Different Speeds
- [x] Tutorial section structure (basics, commands, embellishments, advanced)
- [x] Reference section structure (syntax, commands, cycles, embellishments)
- [x] API section structure (integration guide, reference, examples)
- [x] Contributing section

### Styling ✅
- [x] Responsive design for mobile devices
- [x] Dark code blocks for readability
- [x] Navigation header with dropdowns
- [x] Sidebar navigation per section

### Build & Tooling ✅
- [x] Modernize ESLint to v9.39.2 with flat config (eslint.config.mjs)
- [x] Update typescript-eslint to v8.51.0
- [x] Remove legacy .eslintrc.json and .eslintignore
- [x] Auto-fix prettier formatting across src/ files
- [x] Rename "Cookbook" to "Examples" throughout documentation
- [x] Fix broken links (embelishments→embellishments, dsl-syntax→syntax)
- [x] Remove broken symlinks in reference/

### Documentation Content ✅
- [x] Tutorials 01-04: Complete with interactive notation examples
- [x] Reference/Syntax: Comprehensive grammar, tables, all elements documented
- [x] Reference/Commands: All 6 commands with examples (beatDuration, cycle, line, role, breaks, layout)
- [x] Reference/Cycles: Full tala theory, Sapta Talas, gati/kalai explanations
- [x] Reference/Embellishments: 11 gamakas documented with examples
- [x] API Reference: Classes, methods, properties, TypeScript types
- [x] API Examples: 8 code examples (parsing, rendering, batch processing, etc.)
- [x] API Integration Guide: React, Vue, Node.js, Web Components - all complete
- [x] Contributing guide: Setup, workflow, areas to help

### Block-Based DSL Foundation (Phase 1) ✅
- [x] Add parent references to Entity base class
- [x] Remove unused children methods from Entity (cleaner separation)
- [x] Create BlockContainer interface with:
  - blockItems, parentBlock properties
  - localCycle, localAtomsPerBeat, localBreaks, localRoles
  - Property inheritance via tree walking (cycle, atomsPerBeat, breaks, getRole)
- [x] Create Block class implementing BlockContainer
- [x] Create RoleDef and RawBlock classes in block.ts
- [x] Add type guards: isBlock, isLine, isRawBlock, isBlockContainer
- [x] Update Notation to implement BlockContainer
- [x] Add applyToBlock() method to Command base class
- [x] Maintain backward compatibility (blocks, currentAPB, currentCycle, etc.)

---

## Immediate TODOs

### Block-Based DSL (Phase 2) - Complete
- [x] Update grammar with block rules in parser.ts
  - Added grammar rules for `\command(...) { ... }` syntax
  - BlockCommand class wraps commands with block content
  - Semantic actions: beginBlock, endBlock, nullBlock, newCommandWithBlock
  - 5 new block syntax tests added and passing
- [x] Update existing commands for block support
  - All commands have applyToBlock() methods
- [x] Add new block commands: \section(), \group(), \repeat()
  - Section, ScopedGroup, Repeat command classes added
- [x] Block subclasses pattern implemented:
  - SectionBlock, RepeatBlock, CycleBlock, BeatDurationBlock, BreaksBlock, RoleBlock, GroupBlock
  - Each subclass overrides children() for specific behavior
  - Parser's BlockCommand.createBlock() creates appropriate subclass
  - No command property indirection - subclasses ARE commands

### Block-Based DSL (Phase 3) - Complete
- [x] Make Notation extend Block (Notation is root Block)
  - Notation now extends Block with blockType="notation", parent=null
  - Constructor sets default values: localCycle=DEFAULT, localAtomsPerBeat=1, localBreaks=[]
  - Backward compatible aliases: blocks, currentCycle, currentAPB, currentBreaks
- [x] Consolidate applyToNotation into applyToBlock
  - All commands now use applyToBlock() as primary method
  - applyToNotation() is deprecated, delegates to applyToBlock()
  - Notation-specific behavior uses `instanceof Notation` checks
- [x] Update GlobalBeatLayout to use block.children() for recursive processing
  - Added processBlock(block: Block) method
  - Recursively processes children using block.children()
  - Properly handles RepeatBlock expansion and nested structures
  - loader.ts now uses beatLayout.processBlock(notation)

### Block-Based DSL (Phase 4) - Complete
- [x] Update NotationView for block rendering
  - Added processBlock() and processBlockItem() methods
  - Uses block.children() for recursive rendering
  - Properly handles nested blocks (SectionBlock, RepeatBlock, etc.)
- [x] Update notation/web components
  - No changes needed - components consume NotationView which is now block-aware

### Notebook-Style Cell UI (In Progress)
Goal: Notebook-style editing where each Block becomes an editable cell with shared column alignment.

#### Phase 1: Shared GridLayoutGroup - Complete
- [x] Add subscription mechanism to GridLayoutGroup (onLayoutChange, notifyLayoutChange)
- [x] Add LayoutChangeEvent with affected row/column ranges
- [x] Make GridLayoutGroup injectable into GlobalBeatLayout
- [x] Update NotationView with NotationViewConfig interface
- [x] Export grids module from main index.ts

#### Phase 2: Change Detection - Complete
- [x] Inline O(1) change detection during layout pass
  - `previousColumnWidths`/`previousRowHeights` maps track previous dimensions
  - `checkAndUpdateLength()` compares during `doBfsLayout()` - no extra traversal
- [x] `columnWidthsChanged`/`rowHeightsChanged` flags now report actual changes
- [x] Enables subscribers to skip re-render when dimensions unchanged

**Future: Full Incremental Re-render** (deferred until performance becomes critical)
- View-to-GridModel mapping for selective notification
- Partial re-render in NotationView for affected line ranges only

#### Phase 3-8: Web Components - Complete
- [x] types/notebook.ts - CellModel, CellState, NotebookConfig interfaces
- [x] utils/cellFactory.ts - Block hierarchy to CellModel conversion
- [x] NotebookView.ts - Main container with shared GridLayoutGroup
- [x] NotebookCell.ts - Individual cell with preview/edit modes
- [x] utils/sourceSerializer.ts - Cell tree back to notation source
- [x] styles/notebook.css - Default styles with dark mode support

#### Next Steps
- [x] Create SideBySideEditor component for reusable editor layout
- [x] Add playground demos to documentation
  - SideBySidePlayground: DockView-based layout with resizable editor/output/console panels
  - NotebookPlayground: Cell-based editing with drag-and-drop reordering
  - View All button opens complete notation in new window
  - Full dark mode support
- [ ] Update notation/web to use SideBySideEditor in its DockView layout
  - Validate that SideBySideEditor has all needed methods
  - May need to add: line highlighting, cursor position tracking, undo/redo hooks

### Test Fixes ✅
- [x] Fix grid test expectations in `src/tests/grids.spec.ts`
  - Heights updated for padding changes
  - All tests now pass

### UI/UX Improvements
- [ ] Fix button wrapping on narrow screens (keep copy/edit buttons on same line)
- [ ] Add keyboard shortcuts for edit mode (Ctrl+Enter to apply, Esc to cancel)
- [ ] Add error display in notation preview when DSL parsing fails (currently only logs to console)
- [ ] Add loading indicator during re-render

### Content Additions
- [ ] Add more notation examples:
  - Advanced korvai patterns
  - Notation for jathi variations
  - Chauka kala and other speed variations
  - Examples from different gharanas
- [ ] Add video tutorials or animated examples
- [ ] Create printable PDF versions of notation examples
- [ ] Add search functionality across documentation

### Technical Improvements
- [ ] Optimize webpack bundle size (currently ~580 KB)
  - Consider code splitting
  - Lazy load notation parser
- [ ] Fix s3gen static folder auto-copy issue
- [ ] Add automated testing for notation examples
- [ ] Set up CI/CD for automatic deployment on push
- [ ] Add analytics to track popular pages

## Medium-Term Goals

### Features
- [ ] Add notation export (PNG, PDF, MIDI)
- [ ] Add audio playback for notation examples
- [ ] Create interactive notation builder/playground
- [ ] Add notation validation with helpful error messages
- [ ] Support for saving/sharing custom notation examples

### Documentation
- [ ] Add FAQ section
- [ ] Create migration guide from other notation systems
- [ ] Add glossary of terms (Carnatic music terminology)
- [ ] Create video walkthroughs of complex examples
- [ ] Add "Tips & Tricks" section

### Community
- [ ] Set up discussion forum or Discord
- [ ] Create contribution guidelines for new notation examples
- [ ] Add user-submitted examples gallery
- [ ] Create template for submitting new examples

## Long-Term Vision

### Platform Evolution
- [ ] Create cloud-based notation editor
- [ ] Support collaborative editing
- [ ] Add notation versioning and history
- [ ] Create mobile app for viewing notations
- [ ] Support for other music systems (Hindustani, Western, etc.)

### Integration
- [ ] VSCode extension for notation authoring
- [ ] Integration with music learning platforms
- [ ] API for third-party integrations
- [ ] Plugin system for custom renderers

## Infrastructure

### Performance
- [ ] Add CDN for static assets
- [ ] Implement service worker for offline access
- [ ] Optimize image assets
- [ ] Add progressive web app (PWA) support

### Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Track user engagement metrics
- [ ] Monitor broken links

## Documentation Maintenance

### Regular Updates
- [ ] Review and update examples quarterly
- [ ] Keep dependencies up to date
- [ ] Fix reported issues and bugs
- [ ] Add examples for new DSL features
- [ ] Update screenshots and visuals

### Quality Assurance
- [ ] Spell check all content
- [ ] Verify all code examples work
- [ ] Test on multiple browsers and devices
- [ ] Accessibility audit (WCAG compliance)
- [ ] SEO optimization

## Questions to Resolve

- Should we support multiple languages for documentation?
- Should we add comment threads on examples?
- Should we create a separate playground site?
- Should we integrate with notation sheet repositories?
- How to handle versioning of the DSL documentation?
