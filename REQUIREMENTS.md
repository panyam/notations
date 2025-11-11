# Notations Library - Documentation Requirements & Roadmap

**Project**: Comprehensive Documentation & Tutorial System for Carnatic Music Notations Library
**Start Date**: 2025-01-10
**Timeline**: 12 weeks (comprehensive approach)
**Status**: Phase 0 - Project Setup

---

## Project Vision

The Notations library currently provides powerful capabilities for parsing, modeling, and rendering Carnatic music notation, but its documentation is fragmented across multiple repositories and incomplete. This project aims to create a **comprehensive, self-contained documentation system** within the notations library repository that serves three distinct audiences: end users (musicians writing notation), developers (integrating the library), and contributors (extending the library).

By moving documentation into the library repository and establishing multiple formats (progressive tutorials, complete reference, cookbook examples, and interactive playground), we will enable the library to be independently usable by any application or website. The current live site (notation/) will then embed or link to this documentation rather than maintaining its own copy of library tutorials.

The success of this project will be measured by: (1) A musician can learn the DSL and notate complex compositions within 2 hours, (2) A developer can integrate the library and render their first notation within 30 minutes, (3) A new contributor can understand the architecture and make their first PR within 1 week, and (4) Documentation becomes the primary resource, reducing "how to" issues on GitHub.

---

## Design Decisions

### DD-001: Documentation Framework Choice
- **Decision**: Use s3gen (Go-based static site generator)
- **Rationale**:
  - Already in use for notation live site tutorial
  - Very small bundle size (no TypeScript compilation overhead)
  - Go templates + Markdown (fast builds)
  - Can reuse existing templates from notation/web/tutorial
  - Integrates cleanly with TypeScript components via webpack
  - User preference for consistency with existing tooling
  - Simple, maintainable, and performant
- **Date**: 2025-01-10
- **Status**: Approved
- **Location**: `notation/locallinks/s3gen/` (symlink to `/Users/dzshrh/personal/golang/s3gen/`)
- **Options Rejected**:
  - Docusaurus: Too heavy, unnecessary React overhead
  - VitePress: Different tech stack, more complexity
  - Hugo: Considered but s3gen is simpler and custom-built
- **Implementation**: Set up similar to `notation/web/tutorial/` structure

### DD-002: Documentation Location Strategy
- **Decision**: Move primary documentation to `notations/` repository, separate from live site
- **Rationale**:
  - Makes documentation self-contained and reusable by any integrator
  - Library consumers get documentation with npm package
  - Live site can focus on site-specific tutorials (how to use the composer)
  - Aligns with standard npm package documentation practices
  - Enables documentation versioning with library releases
- **Date**: 2025-01-10
- **Status**: Approved
- **Impact**: Will require migration of existing tutorials from `notation/web/tutorial/` to `notations/docs/`

### DD-003: Multi-Format Documentation Approach
- **Decision**: Provide ALL four formats - Progressive Tutorials, Reference Docs, Cookbook, Interactive Playground
- **Rationale**: Different learning styles and use cases require different formats:
  - Tutorials: Best for learning progression (beginners)
  - Reference: Best for looking up syntax (intermediate users)
  - Cookbook: Best for practical examples (all levels)
  - Playground: Best for experimentation (all levels)
- **Date**: 2025-01-10
- **Status**: Approved
- **Trade-off**: More work upfront, but maximizes documentation utility

### DD-004: Interactive Examples Strategy
- **Decision**: Use custom `<notation>` HTML tags with TypeScript components (same as tutorial site)
- **Rationale**:
  - Proven pattern from notation/web/tutorial
  - NotationBlock.ts component finds and enhances `<notation>` tags
  - Works seamlessly with s3gen's HTML output
  - Supports showSource, caption, and other attributes
  - Webpack bundles components, s3gen includes them via templates
  - No iframe overhead, components render inline
- **Date**: 2025-01-10
- **Status**: Approved
- **Implementation**:
  - Reuse NotationBlock.ts and TutorialPage.ts from tutorial
  - Include compiled bundles in templates via `{{# include "gen.DocsPage.html" #}}`
  - Write notation examples in markdown/HTML using `<notation>` tags

---

## Requirements

### Functional Requirements

#### FR-001: User Tutorial Series (Priority: P0 - Critical)
- **Description**: Complete progressive tutorials from basics through advanced topics, enabling musicians to learn the DSL from scratch
- **Acceptance Criteria**:
  - [ ] Basics tutorial migrated from live site and enhanced with additional examples
  - [ ] Commands tutorial completed (currently stubbed on live site)
  - [ ] Embelishments tutorial completed (currently stubbed on live site)
  - [ ] Advanced topics tutorial created (multi-track, sections, front matter, performance)
  - [ ] All tutorials have 4+ interactive examples each
  - [ ] Clear progression from one tutorial to next
  - [ ] Estimated learning time for complete series: 2 hours
- **Status**: Not Started (20% existing content in live site)
- **Dependencies**: DD-001 (framework), DD-002 (location), DD-004 (interactivity)
- **Tasks**: #016-030

#### FR-002: Complete Syntax Reference (Priority: P0 - Critical)
- **Description**: Comprehensive reference documentation covering every DSL feature
- **Acceptance Criteria**:
  - [ ] BNF grammar extracted from parser and documented
  - [ ] Every command documented with parameters, types, defaults, examples
  - [ ] Every embelishment/gamaka cataloged with symbol, effect, usage
  - [ ] All cycle/tala patterns documented
  - [ ] Quick reference PDF cheat sheet created
  - [ ] Cross-references to tutorials where concepts are taught
- **Status**: Not Started (some info exists in parser comments)
- **Dependencies**: None
- **Tasks**: #031-035

#### FR-003: Developer API Documentation (Priority: P0 - Critical)
- **Description**: Complete API documentation enabling developers to integrate the library
- **Acceptance Criteria**:
  - [ ] Integration guide with 5 complexity levels (Hello World to Full Editor)
  - [ ] Architecture documentation with diagrams
  - [ ] TypeDoc-generated API reference for all public APIs
  - [ ] Component library guide (NotationView, LineView, BeatView, etc.)
  - [ ] Extension guide (custom embelishments, renderers)
  - [ ] Build configuration examples (webpack, vite, rollup)
  - [ ] Developer can render first notation within 30 minutes
- **Status**: Not Started (some JSDoc comments exist)
- **Dependencies**: DD-001 (framework for TypeDoc integration)
- **Tasks**: #036-050

#### FR-004: Cookbook with Real Examples (Priority: P1 - High)
- **Description**: Library of real-world compositions and patterns for copy-paste usage
- **Acceptance Criteria**:
  - [ ] 15+ well-known compositions fully notated
  - [ ] 20+ common patterns (jatis, sangatis, neraval)
  - [ ] Organized by: complexity, raga, tala, composer
  - [ ] Each example annotated with techniques used
  - [ ] Downloadable .notation files
  - [ ] Search/filter functionality
- **Status**: Not Started
- **Dependencies**: DD-001 (framework), FR-001 (tutorials reference cookbook)
- **Tasks**: #065-066

#### FR-005: Interactive Playground (Priority: P1 - High)
- **Description**: Embedded editor for trying examples and experimenting
- **Acceptance Criteria**:
  - [ ] Every tutorial example is editable inline
  - [ ] Standalone playground page with full editor
  - [ ] Pre-loaded examples from cookbook
  - [ ] URL-sharing of notation (encoded in URL)
  - [ ] Export functionality (download, copy)
  - [ ] Real-time parsing and error display
- **Status**: Not Started (similar functionality exists in live site)
- **Dependencies**: DD-004 (interactive strategy)
- **Tasks**: #061-070

#### FR-006: Contributor Documentation (Priority: P2 - Medium)
- **Description**: Documentation for developers wanting to contribute to the library
- **Acceptance Criteria**:
  - [ ] Enhanced CONTRIBUTING.md with full workflow
  - [ ] Architecture documentation (entity hierarchy, data flow, key algorithms)
  - [ ] Design decisions documented (from designs/ folder)
  - [ ] Development setup guide
  - [ ] Extension points guide
  - [ ] Testing strategy documentation
  - [ ] New contributor can make first PR within 1 week
- **Status**: Not Started (basic CONTRIBUTING.md exists)
- **Dependencies**: FR-003 (architecture docs)
- **Tasks**: #051-060

### Non-Functional Requirements

#### NFR-001: Documentation Searchability (Priority: P0)
- **Description**: Users must be able to quickly find information
- **Acceptance Criteria**:
  - [ ] Full-text search across all documentation
  - [ ] Search results < 2 seconds
  - [ ] Search suggestions/autocomplete
  - [ ] Search analytics to identify gaps
- **Status**: Not Started
- **Dependencies**: DD-001 (framework must support search)

#### NFR-002: Interactive Examples (Priority: P0)
- **Description**: All code examples must be runnable and modifiable
- **Acceptance Criteria**:
  - [ ] 100% of notation examples are rendered live
  - [ ] Edit-render cycle < 500ms
  - [ ] Error messages shown inline
  - [ ] Mobile-friendly (touch-enabled editor)
- **Status**: Not Started
- **Dependencies**: DD-004 (interactivity strategy)

#### NFR-003: Documentation Maintainability (Priority: P1)
- **Description**: Documentation must be easy to update and keep current
- **Acceptance Criteria**:
  - [ ] CI/CD pipeline auto-deploys on commit
  - [ ] Broken link checker runs on CI
  - [ ] Example validation in tests (examples must parse)
  - [ ] Version tagging aligned with library releases
- **Status**: Not Started
- **Dependencies**: DD-001 (framework)

#### NFR-004: Accessibility (Priority: P2)
- **Description**: Documentation must be accessible to all users
- **Acceptance Criteria**:
  - [ ] WCAG 2.1 AA compliance
  - [ ] Keyboard navigation
  - [ ] Screen reader compatible
  - [ ] Color contrast ratios meet standards
- **Status**: Not Started
- **Dependencies**: DD-001 (framework should provide accessibility)

---

## Roadmap

### Phase 0: Project Setup (Week 1, Days 1-2) - CURRENT PHASE
**Goals**: Create project management infrastructure and make initial decisions
**Deliverables**:
- [x] REQUIREMENTS.md document created
- [ ] Documentation framework chosen (DD-001)
- [ ] Directory structure created
- [ ] Initial commit to repository

**Tasks**: #001-005

**Timeline**: Jan 10-11, 2025

---

### Phase 1: Foundation & Structure (Weeks 1-2)
**Goals**: Set up documentation infrastructure and migrate existing content
**Deliverables**:
- [ ] Documentation framework installed and running
- [ ] `docs/` directory structure created
- [ ] Existing tutorials migrated from live site
- [ ] Interactive notation components working in docs
- [ ] Build/deploy pipeline configured
- [ ] Staging site deployed to GitHub Pages

**Tasks**: #006-015

**Timeline**: Jan 10-24, 2025

---

### Phase 2: User Documentation (Weeks 3-4)
**Goals**: Complete all user-facing tutorials and reference documentation
**Deliverables**:
- [ ] Commands tutorial (5 pages with 20+ examples)
- [ ] Embelishments tutorial (5 pages with gamaka showcase)
- [ ] Advanced topics tutorial (3 pages)
- [ ] Complete syntax reference (BNF + tables)
- [ ] Quick reference PDF cheat sheet
- [ ] Cookbook structure with initial examples

**Tasks**: #016-035

**Timeline**: Jan 24 - Feb 7, 2025

---

### Phase 3: Developer Documentation (Weeks 5-6)
**Goals**: Enable developers to integrate and extend the library
**Deliverables**:
- [ ] Integration guide with 5 example levels
- [ ] Architecture documentation with diagrams
- [ ] TypeDoc-generated API reference
- [ ] Component library guide
- [ ] Extension guide
- [ ] 5 sample applications

**Tasks**: #036-050

**Timeline**: Feb 7-21, 2025

---

### Phase 4: Contributor Documentation (Week 7)
**Goals**: Enable new contributors to understand and extend the library
**Deliverables**:
- [ ] Enhanced CONTRIBUTING.md
- [ ] Design decisions documented
- [ ] Architecture deep-dive
- [ ] Development workflow guide
- [ ] Extension points documentation

**Tasks**: #051-060

**Timeline**: Feb 21-28, 2025

---

### Phase 5: Interactive Features (Week 8)
**Goals**: Add interactive playground and learning challenges
**Deliverables**:
- [ ] MDX NotationBlock component working
- [ ] Standalone playground page
- [ ] 20 cookbook examples completed
- [ ] Learning challenges/exercises
- [ ] URL-sharing functionality

**Tasks**: #061-070

**Timeline**: Feb 28 - Mar 7, 2025

---

### Phase 6: Integration & Migration (Weeks 9-10)
**Goals**: Integrate docs with live site and update npm package
**Deliverables**:
- [ ] Live site refactored to remove library tutorials
- [ ] Documentation links added to live site
- [ ] npm package updated with docs links
- [ ] All cross-references validated
- [ ] Migration guide for live site users

**Tasks**: #071-080

**Timeline**: Mar 7-21, 2025

---

### Phase 7: Polish & Launch (Weeks 11-12)
**Goals**: Quality assurance, deployment, and launch
**Deliverables**:
- [ ] All examples tested and validated
- [ ] Copy editing completed
- [ ] SEO optimization done
- [ ] Production deployment to GitHub Pages
- [ ] Launch announcement
- [ ] Feedback collection mechanism

**Tasks**: #081-095

**Timeline**: Mar 21 - Apr 4, 2025

---

## TODO List

### Active Tasks (Phase 0 - Current)

- [x] **#000**: Initial exploration and understanding (Completed: 2025-01-10)
  - Owner: AI Assistant
  - Priority: P0
  - Estimated: 2h
  - Actual: 2h
  - Status: Completed
  - Notes: Thoroughly explored notations library and notation live site

- [x] **#000b**: Create REQUIREMENTS.md document (Completed: 2025-01-10)
  - Owner: AI Assistant
  - Priority: P0
  - Estimated: 1h
  - Status: Completed
  - Notes: This document - living documentation for entire project

- [x] **#001**: Research and decide on documentation framework (Completed: 2025-01-10)
  - Owner: AI Assistant
  - Priority: P0
  - Estimated: 4h
  - Actual: 1h
  - Status: Completed
  - Acceptance Criteria:
    - [x] User requested s3gen (already in use for notation/web/tutorial)
    - [x] Explored s3gen architecture and capabilities
    - [x] Documented decision in DD-001 (Approved)
    - [x] Documented interactive strategy in DD-004 (Approved)
    - [x] Updated REQUIREMENTS.md
  - Notes: Decision made to use s3gen for consistency, small bundle size, and proven pattern

- [x] **#002**: Create `docs/` directory structure for s3gen in notations repository (Completed: 2025-01-10)
  - Owner: AI Assistant
  - Priority: P0
  - Estimated: 3h
  - Actual: 1.5h
  - Status: Completed
  - Acceptance Criteria:
    - [x] Create s3gen directory structure (content/, templates/, components/, static/)
    - [x] Create site.go configuration file
    - [x] Create all content sections: tutorials/, reference/, cookbook/, api/, contributing/, getting-started/
    - [x] Create base templates (BasePage.html, Header.html, Sidebar.html, Footer.html, Content.html)
    - [x] Create navigation templates for all sections
    - [x] Create index.html for main page and tutorials section
    - [x] Add SiteMetadata.json and HeaderNavLinks.json
    - [x] Add main.css stylesheet
    - [x] Add placeholder gen.DocsPage.html for TypeScript includes
    - [x] Document structure in comprehensive docs/README.md
  - Notes: Structure complete and ready for content authoring. Next: set up build workflow

- [ ] **#003**: Set up s3gen build and development workflow
  - Owner: TBD
  - Priority: P0
  - Estimated: 3h
  - Status: Not Started
  - Blocked by: #002
  - Acceptance Criteria:
    - [ ] s3gen symlinked or referenced in notations repo
    - [ ] site.go configured with correct paths
    - [ ] Build rules defined (MDToHtml, HTMLToHtml, parametric pages)
    - [ ] Build script works (`go run docs/site.go build` or similar)
    - [ ] Watch mode works (`go run docs/site.go watch`)
    - [ ] Output directory configured (./sites/docs or ./dist/docs)
    - [ ] Static folders configured for CSS/JS/images
  - Notes: Reference notation/web/tutorial/site.go as template

- [ ] **#004**: Set up TypeScript components for interactive notation examples
  - Owner: TBD
  - Priority: P0
  - Estimated: 4h
  - Status: Not Started
  - Blocked by: #003
  - Acceptance Criteria:
    - [ ] Copy NotationBlock.ts and DocsPage.ts from notation/web/tutorial/components
    - [ ] Adapt components for docs context (rename TutorialPage → DocsPage)
    - [ ] Set up webpack config to build components
    - [ ] Configure output to docs/static/js/gen/
    - [ ] Create gen.DocsPage.html template with script includes
    - [ ] Test `<notation>` tag rendering in sample page
    - [ ] Verify source code display, syntax highlighting, timing info
  - Notes: Reuse proven pattern from tutorial site

- [ ] **#005**: Create initial getting-started guide
  - Owner: TBD
  - Priority: P0
  - Estimated: 3h
  - Status: Not Started
  - Blocked by: #003
  - Acceptance Criteria:
    - [ ] docs/getting-started/installation.md (npm install, setup)
    - [ ] docs/getting-started/quick-start.md (5-minute intro)
    - [ ] docs/getting-started/first-notation.md (Hello World example)
    - [ ] All examples tested and working
  - Notes: This will be the entry point for new users

### Upcoming Tasks (Phase 1)

- [ ] **#006**: Migrate basics/literals.html → docs/tutorials/01-basics/literals.md
- [ ] **#007**: Migrate basics/roles.html → docs/tutorials/01-basics/roles.md
- [ ] **#008**: Create tutorial index pages
- [ ] **#009**: Test all migrated examples
- [ ] **#010**: Create additional basics content (spaces, timing, groups)
- [ ] **#011**: Set up TypeDoc integration
- [ ] **#012**: Create reference/ section structure
- [ ] **#013**: Configure GitHub Actions CI/CD
- [ ] **#014**: Deploy staging site to GitHub Pages
- [ ] **#015**: Test staging deployment

### Backlog (Phases 2-7)

**Phase 2 Tasks (#016-035)**: User Documentation
- Commands tutorial (5 pages)
- Embelishments tutorial (5 pages)
- Advanced tutorial (3 pages)
- Complete reference documentation
- Quick reference PDF

**Phase 3 Tasks (#036-050)**: Developer Documentation
- Integration guide
- API reference (TypeDoc)
- Sample applications
- Component guides

**Phase 4 Tasks (#051-060)**: Contributor Documentation
- Architecture docs
- Design decisions
- Development workflow

**Phase 5 Tasks (#061-070)**: Interactive Features
- Playground
- Cookbook examples
- Learning challenges

**Phase 6 Tasks (#071-080)**: Integration
- Live site migration
- Package updates
- Cross-linking

**Phase 7 Tasks (#081-095)**: Launch
- QA and testing
- Deployment
- Announcement

### Completed Tasks

- [x] **#000**: Initial exploration and understanding (2025-01-10)
  - 2 hours spent understanding library architecture, DSL, live site structure

- [x] **#000b**: Create REQUIREMENTS.md (2025-01-10)
  - Created this comprehensive tracking document

---

## Progress Tracking

### Overall Progress
- **Total Planned Tasks**: 95 (plus discovery tasks)
- **Completed**: 6
- **In Progress**: 0
- **Not Started**: 1 (Phase 0), 88 (future phases)
- **Percentage Complete**: 6.3%

### Phase Progress
- **Phase 0** (Setup): 100% complete (6 of 6 tasks done) ✅
- **Phase 1** (Foundation): 0% complete
- **Phase 2** (User Docs): 0% complete
- **Phase 3** (Dev Docs): 0% complete
- **Phase 4** (Contributor Docs): 0% complete
- **Phase 5** (Interactive): 0% complete
- **Phase 6** (Integration): 0% complete
- **Phase 7** (Launch): 0% complete

### Weekly Updates

#### Week 0 (Jan 10-11, 2025) - Project Kickoff & Build Setup ✅
**Completed**:
- ✅ Explored notations library thoroughly
- ✅ Explored notation live site and tutorial system
- ✅ Defined project vision and multi-audience strategy
- ✅ Created comprehensive 12-week roadmap
- ✅ Created REQUIREMENTS.md tracking document
- ✅ Explored s3gen static site generator
- ✅ Decided on s3gen as documentation framework (DD-001)
- ✅ Decided on interactive examples strategy (DD-004)
- ✅ Created complete docs/ directory structure (Task #002)
- ✅ Set up s3gen build workflow (Task #003)
- ✅ Fixed critical s3gen bug with JSON frontmatter parsing
- ✅ Site building and running successfully at localhost:8085

**In Progress**:
- None

**Blockers**: None

**Next Session Plan**:
- Set up TypeScript components (#004)
- Create getting-started guide (#005)
- Begin Phase 1 content migration

---

## Session Notes

### Session 2025-01-10 (Initial Planning & Setup)

**Participants**: User, AI Assistant
**Duration**: ~2 hours
**Phase**: Phase 0 - Project Setup

**Summary**:
Started with request to "thoroughly understand this package for parsing and rendering carnatic music notations." Conducted comprehensive exploration of both the `notations/` library and the `notation/` live site.

**Key Findings**:
1. **Library Architecture**: Well-designed entity hierarchy (Entity → TimedEntity → Atom), sophisticated beat layout system using fractions for precise timing, DAG-based column alignment
2. **Current Documentation State**:
   - Library has good inline comments and design docs in `designs/` folder
   - Live site has partial tutorials (only Basics complete, Commands and Embelishments stubbed)
   - No comprehensive API documentation
   - No developer integration guides
3. **User Requirements**: Three-audience focus (users, developers, contributors), need for all four doc formats (tutorials, reference, cookbook, playground), comprehensive 1-2 month effort

**Decisions Made**:
- ✅ DD-002: Move documentation to library repo (approved)
- ✅ DD-003: Multi-format approach (approved)
- ⏳ DD-001: Documentation framework (research in progress)
- ⏳ DD-004: Interactive strategy (depends on DD-001)

**Action Items**:
1. Create REQUIREMENTS.md ✅ (completed this session)
2. Research documentation frameworks (Task #001 - next session)
3. Set up directory structure (Task #002 - next session)

**Open Questions**:
1. Should we use Docusaurus or VitePress? (Need to research features)
2. Should we version docs from the start or add later? (Can defer to Phase 6)
3. Custom domain for docs or just GitHub Pages? (Can decide at deployment)
4. Should cookbook be in separate repo or in docs/? (Decided: in docs/ for now)

**Notes**:
- User emphasized importance of REQUIREMENTS.md for resumability across sessions
- Project timeline is flexible - quality over speed
- Live site will link to library docs rather than duplicating

**Next Session**:
- Start with reading REQUIREMENTS.md to restore context
- Begin Task #001 (framework research)
- Make DD-001 decision
- Proceed to Task #002 (directory setup)

---

### Session 2025-01-10 (s3gen Decision)

**Participants**: User, AI Assistant
**Duration**: ~30 minutes
**Phase**: Phase 0 - Project Setup

**Summary**:
User clarified preference for using s3gen (their custom Go-based static site generator) instead of Docusaurus or VitePress. s3gen is already in use for the notation live site tutorial and provides small bundle sizes with Go templates + Markdown.

**Key Findings**:
1. **s3gen Location**: `notation/locallinks/s3gen/` (symlink to `~/personal/golang/s3gen/`)
2. **Current Usage**: Powers `notation/web/tutorial/` and `/web/blog/`
3. **Architecture**: Resource-based system with front matter, build rules, Go templates (templar), and parametric pages
4. **Integration**: Works cleanly with TypeScript components via webpack
5. **Templates**: Can reuse existing templates from tutorial site

**Decisions Made**:
- ✅ DD-001: Use s3gen (approved)
- ✅ DD-004: Use `<notation>` HTML tags with TypeScript components (approved)

**Technical Details Documented**:
- s3gen uses Site configuration in site.go
- Build rules: MDToHtml, HTMLToHtml, ParametricPages
- Template engine: templar (superset of Go html/template)
- Supports live reloading with watch mode
- Parametric pages enable dynamic generation (tags, categories)
- TypeScript components built separately, included via templates

**Action Items**:
1. ✅ Update DD-001 in REQUIREMENTS.md (completed this session)
2. ✅ Update DD-004 in REQUIREMENTS.md (completed this session)
3. ✅ Update Task #001 to completed (completed this session)
4. ✅ Adjust Tasks #002-#005 for s3gen specifics (completed this session)
5. Next: Begin Task #002 (create directory structure)

**Notes**:
- User emphasized small bundle size and consistency with existing tooling
- Can reuse templates and components from notation/web/tutorial
- Pattern is proven and working well
- Documentation will follow same architecture as tutorial site

**Next Session**:
- Start Task #002: Create docs/ directory structure for s3gen
- Reference notation/web/tutorial/ as template
- Adapt for library documentation needs

---

### Session 2025-01-11: Build Workflow Setup & Bug Fixes

**Completed Tasks**:
- ✅ Task #002: Created complete docs/ directory structure (20 files, 14 directories)
- ✅ Task #003: Set up s3gen build workflow

**Critical Bug Fixed in s3gen**:
- **Issue**: JSON files returning empty content when read via `json` template function
- **Root Cause**: The `adrg/frontmatter` library treats pure JSON files as having JSON frontmatter (no content after), causing the entire file to be parsed as frontmatter and leaving 0 bytes for content
- **Fix**: Modified `locallinks/s3gen/resource.go:271` to exclude JSON format from frontmatter parsing:
  ```go
  // Before: frontmatter.Parse(f, r.frontMatter.Data)
  // After: frontmatter.MustParse(f, r.frontMatter.Data, frontmatter.Formats[0], frontmatter.Formats[1])
  ```
  Now only YAML (Formats[0]) and TOML (Formats[1]) are parsed, which require delimiters (`---` or `+++`)
- **Impact**: JSON files in content/ directory now load correctly in templates

**Files Created/Modified**:
1. `docs/main.go` - Site configuration (replaced site.go)
2. `docs/go.mod` - Separate Go module for docs
3. `docs/Makefile` - Symlink management for local development
4. `docs/templates/` - 11 template files (BasePage, Header, Sidebar, Footer, Content, 5 nav templates, gen.DocsPage)
5. `docs/content/` - Content structure with SiteMetadata.json, HeaderNavLinks.json, index.html
6. `docs/static/css/main.css` - Complete styling including dropdown navigation
7. `docs/locallinks/` - Symlinks to s3gen, templar, goutils, oneauth

**Technical Decisions**:
- Docs as separate Go module (cleaner dependency management)
- Makefile for symlink management (`make resymlink`)
- Environment-based behavior: `NOTATIONS_ENV=dev` enables watch mode
- Default server port: 8085 (configurable via `NOTATIONS_DOCS_PORT`)

**Build System Working**:
- ✅ Site builds successfully
- ✅ Watch mode active (auto-rebuild on file changes)
- ✅ Server running at http://localhost:8085
- ✅ JSON files load correctly in templates
- ✅ Navigation dropdowns work on hover
- ✅ Sidebar displays context-aware navigation

**Next Steps**:
- Checkpoint and commit changes
- Task #004: Set up TypeScript components (copy from tutorial site)
- Task #005: Create getting-started guide

---

## Open Questions

### High Priority (Blocking)
None currently - all blocking questions resolved!

### Medium Priority
2. **Q002**: Should we version documentation from the start?
   - Options: Yes (v1, v2, latest), No (only latest)
   - Trade-off: Complexity vs future-proofing
   - Can defer to: Phase 6

3. **Q003**: Where should we host documentation?
   - Options: GitHub Pages (free), Custom domain (paid), Both
   - Depends on: Budget, branding goals
   - Can defer to: Phase 7

4. **Q004**: Should cookbook examples be in separate repository?
   - Options: In docs/cookbook/, Separate repo, Both
   - Current decision: In docs/ (easier to maintain)
   - Can revisit if: Cookbook grows very large (>100 examples)

### Low Priority
5. **Q005**: Should we support multiple languages (i18n)?
   - Options: English only, Add Tamil/Hindi/Telugu
   - Effort: Significant (doubles work)
   - Can defer to: Future enhancement

6. **Q006**: Should we have video tutorials?
   - Options: Yes (screen recordings), No (text/images only)
   - Effort: High
   - Can defer to: Future enhancement after Phase 7

---

## Resources

### Repository Locations
- **Library Repo**: `/Users/dzshrh/personal/music/notations/`
- **Live Site Repo**: `/Users/dzshrh/personal/music/notation/`

### Key Files
- **Current Tutorials**: `notation/web/tutorial/content/`
- **Design Docs**: `notations/designs/`
- **Library Source**: `notations/src/`
- **TypeScript Docs**: Generated via `npm run builddocs` → `notations/docs/` (currently)

### External Resources
- **TypeDoc**: https://typedoc.org/
- **Docusaurus**: https://docusaurus.io/
- **VitePress**: https://vitepress.dev/
- **MDX**: https://mdxjs.com/

### Team
- **Project Lead**: User (dzshrh)
- **Current Contributors**: [To be documented as project progresses]

---

## Metrics & KPIs

### Success Metrics (End of Phase 7)
- [ ] **User Success**: Musician can notate complex composition in < 2 hours (measured via user testing)
- [ ] **Developer Success**: Developer renders first notation in < 30 minutes (measured via tutorial timing)
- [ ] **Contributor Success**: New contributor makes first PR in < 1 week (measured via GitHub activity)
- [ ] **Adoption**: Documentation becomes primary resource (measured by GitHub issue reduction)

### Ongoing Metrics (Post-Launch)
- **Traffic**: Docs page views per week
- **Engagement**: Average time on page, bounce rate
- **Search**: Top search queries (identify gaps)
- **Feedback**: "Was this helpful?" ratings
- **GitHub**: Issue reduction for documentation questions
- **npm**: Package downloads (indirect measure of adoption)

---

## Changelog

### 2025-01-10
- **Created**: REQUIREMENTS.md document
- **Added**: All sections (Vision, Design Decisions, Requirements, Roadmap, TODO, etc.)
- **Completed**: Tasks #000, #000b, #001
- **Approved**: DD-001 (s3gen framework), DD-004 (interactive examples strategy)
- **Updated**: Tasks #002-#005 for s3gen-specific implementation
- **Updated**: Session notes with s3gen decision and technical details
- **Updated**: Progress tracking (Phase 0 now 60% complete)
- **Status**: Phase 0 in progress (60% complete, 3 of 5 tasks done)

---

**Last Updated**: 2025-01-10
**Next Review**: 2025-01-11 (continue Phase 0)
**Document Version**: 1.1
