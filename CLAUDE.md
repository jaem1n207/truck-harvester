# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Truck Harvester is a Next.js 15 application that extracts truck listing information from Korean used truck websites. It parses URLs, scrapes truck data including images and specifications, and downloads everything as organized files or ZIP archives.

## Development Commands

### Primary Commands

- `bun dev` - Start development server with Turbopack
- `bun run build` - Production build with Turbopack
- `bun test` - Run Vitest tests
- `bun run test:coverage` - Run tests with coverage report
- `bun run test:ui` - Run tests with Vitest UI

### Code Quality Commands

- `bun run code:check` - Complete quality check: typecheck + lint + format + test
- `bun run code:fix` - Auto-fix linting and formatting issues
- `bun run code:audit` - Full audit: quality check + security + outdated dependencies
- `bun run typecheck` - TypeScript type checking only
- `bun run lint` - ESLint checking
- `bun run lint:fix` - ESLint with auto-fix
- `bun run format` - Prettier formatting
- `bun run format:check` - Check Prettier formatting

### Comprehensive Code Check

- `./scripts/code-check.sh` - Complete health check script with detailed output
- Runs sequential checks: TypeScript → ESLint → Prettier → Tests → Security → Build

## Architecture

### Core Application Flow

1. **Root App** (`src/app/truck-harvester-app.tsx`) - Composes the rebuilt UI served from `/`
2. **URL Preparation** (`src/v2/features/listing-preparation`) - Extracts and validates truck listing URLs
3. **API Processing** (`/api/v2/parse-truck`) - Server-side web scraping with Cheerio
4. **File Management** (`src/v2/features/file-management`) - Handles File System Access API and ZIP downloads
5. **State Management** (`src/v2/shared/model`) - Zustand vanilla stores for prepared listings and onboarding

The old `/v2` URL redirects to `/` for compatibility. The current runtime has
no external error-monitoring SDK, no image-stamping pipeline, and no remaining
legacy shared/widget runtime folders.

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/v2/parse-truck/ # Current server-side parsing API
│   ├── page.tsx           # Root route
│   ├── truck-harvester-app.tsx
│   └── v2/page.tsx        # Compatibility redirect to /
└── v2/                    # Internal implementation namespace
    ├── design-system/
    ├── entities/
    ├── features/
    ├── shared/
    └── widgets/
```

### Key Architecture Patterns

#### Current Feature-Sliced Architecture

- **Widgets** (`src/v2/widgets/`) - Composed user-facing blocks for the root app
- **Features** (`src/v2/features/`) - Business workflows such as listing preparation, parsing, saving, and onboarding
- **Entities** (`src/v2/entities/`) - Pure schemas and domain contracts
- **Shared** (`src/v2/shared/`) - Reusable primitives, stores, selectors, and low-level UI
- **Design System** (`src/v2/design-system/`) - Token and motion guidance used by the root app

#### State Management Pattern

- **Zustand Stores** (`src/v2/shared/model`) - Prepared-listing and onboarding state
- **Step-based UI** - Multi-step process: input → parsing → downloading → completed
- **AbortController** - Proper cancellation handling for async operations

#### Data Flow Pattern

1. URLs validated client-side → API call → Server scrapes with Cheerio → TruckData returned
2. Client downloads images via File System Access API or generates ZIP
3. Progress tracking per vehicle with downloadStatus updates

### Core Data Models

#### TruckData Schema (`src/v2/entities/truck`)

- **Vehicle Info**: vname (차명), vnumber (차량번호), year, mileage
- **Pricing**: Structured price object with raw/won/label/compactLabel
- **Images**: Array of image URLs with organized filename generation
- **Validation**: Zod schemas for all data structures

## Development Preferences

### Code Architecture & Design Patterns

- **Architecture**: Feature-Sliced Design for scalable project organization
- **FSD Layer Hierarchy**: `src/app` routes compose `src/v2/widgets` → `src/v2/features` → `src/v2/entities` → `src/v2/shared`
- **FSD Segment Structure**: Each slice contains `model/` (state), `ui/` (components), `api/` (server communication), `lib/` (utilities)
- **Public API Management**: Use `index.ts` files to define clean public APIs for each slice
- **Current Namespace**: Internal FSD layers live under `src/v2/*`; root `src/app` owns routing and app surfaces
- **Naming Conventions**: kebab-case for files/folders, PascalCase for component names
- **TypeScript Patterns**: Prefer `interface` over `type`, Union Types over `enum`
- **Type Safety**: Avoid `any` and type assertions like `as string`, prefer complete type inference including deep nested fields
- **Programming Style**: Declarative and functional programming patterns preferred

### Form Validation & UI Components

- **Form Validation**: Zod schemas with TanStack Form for robust form handling
- **UI Library**: shadcn/ui as base, customize using Awesome shadcn/ui
- **Design System**: Orange theme preferred for consistent branding
- **Animations**: Motion/React for smooth transitions, reference MagicUI for advanced animated components
- **Styling**: Tailwind CSS for utility-first responsive design
- **Theme Support**: Static root theme tokens in `src/app/theme.css`; no runtime theme provider
- **Accessibility**: Strict adherence to WCAG 2.1 AA guidelines for universal access

### Testing & Code Quality Philosophy

- **Testing Focus**: Write tests only for core business logic with strong domain coupling
- **Test Runner**: Vitest preferred for fast TypeScript testing
- **Code Comments**: Minimal comments - prefer self-documenting code with clear variable/function names
- **Exception**: Comments only for reusable utility interfaces, domain-specific hacky code, and complex calculations that require step-by-step explanation

### Development Workflow & Deployment

- **Package Manager**: Bun preferred for fast installation and execution
- **New Dependencies**: Always install latest versions using `bun add <package>@latest`
- **Deployment**: Vercel for free hosting with Hobby plan
- **CI/CD**: GitHub Actions for automated deployment on main branch merges
- **Code Organization**: Encapsulate complex logic into clear, purpose-specific functions

## Technology Stack

### Frontend

- **Framework**: Next.js 15 with App Router and Turbopack
- **State Management**: Zustand with persistence middleware
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS 4 with custom design tokens
- **Animations**: Framer Motion for transitions and micro-interactions
- **Forms**: TanStack Form with Zod validation
- **Theme**: Static `src/app/theme.css` tokens consumed through Tailwind CSS utilities

### Backend & APIs

- **API Routes**: Next.js server-side API with `/api/v2/parse-truck` endpoint
- **Web Scraping**: Cheerio for HTML parsing and data extraction
- **File Operations**: File System Access API for browser-native file management
- **Archive**: JSZip for creating downloadable ZIP files

### Development & Quality

- **Package Manager**: Bun preferred for fast installation and execution
- **Testing**: Vitest with jsdom environment and React testing utilities
- **Type Checking**: TypeScript with strict configuration
- **Linting**: ESLint with Next.js TypeScript rules
- **Formatting**: Prettier with automated fix-on-save
- **Git Hooks**: Husky + lint-staged for pre-commit quality checks
- **Commit Convention**: Conventional Commits with commitlint validation

## Testing

### Test Framework

- **Test Runner**: Vitest with React plugin
- **Environment**: jsdom for browser simulation
- **Setup**: Vitest uses jsdom directly; there is no legacy shared test setup file.
- **Coverage**: Vitest coverage with v8 provider

### Test Structure

- **Unit Tests**: Located in `__tests__/` directories alongside source files
- **Test Files**: Follow pattern `*.test.ts` or `*.test.tsx`
- **Utilities**: URL validation and file system operations have comprehensive tests

## Git Workflow

### Commit Process

1. **Pre-commit Hook**: Automatically runs lint-staged (ESLint fix + Prettier)
2. **Commit Message**: Follows Conventional Commits format, validated by commitlint
3. **Commitizen**: Use `npx cz` for interactive commit message generation

### Commit Types

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring without functional changes
- `perf:` - Performance improvements
- `test:` - Test additions/modifications
- `docs:` - Documentation updates

## API Architecture

### Parse API (`/api/v2/parse-truck`)

- **Input**: One truck listing `url` per request
- **Processing**: Server-side fetch and Cheerio parsing for that listing
- **Output**: Structured TruckData with pricing, specifications, and image URLs
- **Error Handling**: Typed failure response for the requested listing
- **Batch Control**: Client workflows send one request per prepared listing and own concurrency limits

### Data Extraction Strategy

- **Target Sites**: Korean used truck listing sites with specific DOM selectors
- **Key Elements**: `.vname`, `.vnumber`, `.vcash > span.red`, `.car-detail strong.number`
- **Image Extraction**: Complex logic to find high-quality images from `.sumnail` containers
- **Price Processing**: Converts Korean currency format to structured pricing data

## Browser APIs & File Handling

### File System Access API

- **Directory Selection**: Browser-native directory picker for organized downloads
- **File Organization**: Creates subdirectories per vehicle with standardized naming
- **Progress Tracking**: Real-time download progress with per-image status
- **Error Recovery**: Continues processing even if individual images fail

### ZIP Download Fallback

- **Purpose**: Alternative download method for unsupported browsers
- **Implementation**: JSZip with client-side file generation
- **Structure**: Maintains same folder organization as File System Access API

## State Management Patterns

### Zustand Store Design

- **Persistence**: Only config and urlsText persist across sessions
- **Ephemeral State**: Processing status, download progress reset each session
- **Abort Pattern**: AbortController properly integrated for cancellation
- **State Steps**: Linear progression through input → parsing → downloading → completed

### Component State Flow

- **URL Validation**: Client-side validation before API calls
- **Progress Updates**: Real-time status updates during multi-step operations
- **Error Boundaries**: Graceful error handling with user-friendly messages

## Accessibility Standards & Guidelines

### Core Accessibility Requirements

All components and features must be fully accessible to users with disabilities, following WCAG 2.1 AA guidelines:

#### Semantic HTML & Structure

- **Semantic Tags**: Use proper HTML5 semantic elements (`<main>`, `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`)
- **Heading Hierarchy**: Maintain logical heading structure (h1 → h2 → h3) without skipping levels
- **Landmark Regions**: Define clear page landmarks for screen reader navigation
- **List Semantics**: Use `<ul>`, `<ol>`, and `<dl>` for structured content
- **Form Labels**: Associate all form controls with descriptive `<label>` elements or `aria-labelledby`

#### Keyboard Navigation Support

- **Focus Management**: Ensure all interactive elements are keyboard accessible
- **Tab Order**: Maintain logical tab sequence through interactive elements
- **Focus Indicators**: Provide visible focus indicators that meet 3:1 contrast ratio
- **Keyboard Shortcuts**: Implement intuitive keyboard shortcuts for power users
- **Escape Patterns**: Support Escape key to close modals, dropdowns, and overlays
- **Skip Links**: Provide "Skip to main content" links for efficient navigation

#### Screen Reader Compatibility

- **ARIA Labels**: Use `aria-label`, `aria-labelledby`, and `aria-describedby` for context
- **ARIA States**: Implement `aria-expanded`, `aria-selected`, `aria-checked` for dynamic states
- **ARIA Live Regions**: Use `aria-live` for real-time status updates and notifications
- **Role Attributes**: Apply appropriate ARIA roles for custom components
- **Screen Reader Testing**: Test with NVDA, JAWS, and VoiceOver screen readers

#### Visual Design & Color Accessibility

- **Color Independence**: Never rely solely on color to convey information
- **Contrast Ratios**: Maintain 4.5:1 contrast for normal text, 3:1 for large text
- **Focus Indicators**: Ensure 3:1 contrast ratio for focus states
- **Text Scaling**: Support up to 200% text zoom without horizontal scrolling
- **Color Blindness**: Test with color blindness simulators (Deuteranopia, Protanopia, Tritanopia)

#### Real-Time Feedback & Status Updates

- **ARIA Live Regions**: Use `aria-live="polite"` for non-critical updates, `aria-live="assertive"` for urgent alerts
- **Progress Indicators**: Provide accessible progress updates during truck data processing
- **Error Announcements**: Announce form validation errors immediately to screen readers
- **Success Notifications**: Confirm successful actions with accessible feedback
- **Loading States**: Announce loading states and completion to assistive technologies

#### Form Accessibility Standards

- **Required Fields**: Mark required fields with `aria-required="true"` and visual indicators
- **Error Messages**: Associate error messages with form controls using `aria-describedby`
- **Fieldsets**: Group related form controls with `<fieldset>` and `<legend>`
- **Input Types**: Use appropriate HTML5 input types (url, email, tel) for better UX
- **Placeholder Guidelines**: Don't rely on placeholders as labels; use proper labeling

#### Interactive Component Accessibility

- **Button States**: Implement disabled, loading, and active states accessibly
- **Modal Dialogs**: Trap focus, manage focus return, and support Escape key
- **Dropdown Menus**: Support arrow key navigation and typeahead functionality
- **Data Tables**: Use proper table headers, captions, and scope attributes
- **Custom Components**: Ensure all custom UI components follow ARIA authoring practices

### Testing & Validation Requirements

#### Automated Accessibility Testing

- **ESLint Plugin**: Use `eslint-plugin-jsx-a11y` for static code analysis
- **axe-core Integration**: Implement automated accessibility testing in test suites
- **CI/CD Validation**: Include accessibility checks in continuous integration pipeline
- **Lighthouse Audits**: Maintain accessibility scores above 95 in Lighthouse audits

#### Manual Testing Protocol

- **Keyboard-Only Navigation**: Test all functionality using only keyboard
- **Screen Reader Testing**: Verify compatibility with major screen readers
- **High Contrast Mode**: Test in Windows High Contrast mode
- **Zoom Testing**: Verify functionality at 200% browser zoom
- **Color Vision Testing**: Validate with color blindness simulation tools

### Implementation Guidelines

#### Component Development Standards

- **Radix UI Primitives**: Leverage Radix UI's built-in accessibility features
- **shadcn/ui Components**: Extend base components while preserving accessibility
- **Custom Components**: Follow ARIA Authoring Practices Guide patterns
- **Focus Management**: Implement proper focus management in dynamic content
- **Keyboard Event Handling**: Support standard keyboard interaction patterns

#### Documentation Requirements

- **Accessibility Documentation**: Document accessibility features for each component
- **Usage Guidelines**: Provide clear guidance on accessible implementation
- **Testing Instructions**: Include accessibility testing steps in development workflow
- **WCAG Compliance**: Map features to specific WCAG success criteria

## Error Handling & User Experience Patterns

### Suspense Integration

- **Network Requests**: Wrap all async data fetching with React Suspense
- **Loading States**: Provide meaningful loading indicators during data fetching
- **Granular Boundaries**: Use multiple Suspense boundaries for different UI sections
- **Fallback Components**: Design consistent loading skeletons that match final UI structure
- **Progressive Loading**: Load critical content first, defer secondary content

### ErrorBoundary Strategy

- **Granular Error Boundaries**: Wrap individual features and widgets with dedicated error boundaries
- **Error Segmentation**: Isolate errors to prevent entire app crashes
- **Graceful Degradation**: Provide meaningful error messages and recovery options
- **User Experience**: Implement retry mechanisms and alternative workflows
- **Error Context**: Capture and log detailed error context for debugging
- **Recovery Patterns**: Allow users to retry failed operations or continue with partial data

## Feature-Sliced Design Architecture (Current Structure)

### FSD Layer Definitions

```text
src/
├── app/                    # Next.js App Router and root application surfaces
│   ├── api/v2/parse-truck/ # Current server-side parsing API route
│   ├── error.tsx          # Root error surface
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Global layout and metadata
│   ├── not-found.tsx      # Root not-found surface
│   ├── page.tsx           # Root route for the current app flow
│   ├── truck-harvester-app.tsx
│   └── v2/page.tsx        # Compatibility redirect to /
└── v2/                    # Current internal implementation namespace
    ├── widgets/           # Composed user-facing blocks for the root app
    │   └── [widget-name]/
    │       ├── ui/        # Widget UI components
    │       ├── model/     # Widget-specific state
    │       └── lib/       # Widget utilities
    ├── features/          # Business workflows and side-effect orchestration
    ├── entities/          # Pure domain schemas, contracts, and rules
    ├── shared/            # Reusable primitives, stores, selectors, and low-level UI
    └── design-system/     # Token and motion guidance for the root app
```

The `/v2` route exists only as a compatibility redirect to `/`; do not describe it
as the current app flow. New implementation guidance should point to the root app
route in `src/app` and the internal FSD layers in `src/v2/*`.

### Migration Principles

- **Unidirectional Dependencies**: Higher layers import from lower layers only (`src/app` → `src/v2/widgets` → `src/v2/features` → `src/v2/entities` → `src/v2/shared`)
- **Business Domain Organization**: Group by business functionality rather than technical layers
- **Public API Enforcement**: Each slice exports only necessary interfaces through index.ts
- **Feature Independence**: Features should be self-contained and interchangeable
- **Shared Resource Management**: Common utilities remain accessible across all layers

### Implementation Guidelines

- **Layer Responsibility**: Each layer has distinct purpose and scope boundaries
- **Cross-Cutting Concerns**: Handle authentication, theming, error handling at app layer
- **Feature Composition**: Combine multiple entities within features for business workflows
- **Widget Reusability**: Design widgets to be independent of specific business logic
- **Entity Purity**: Keep entities free of UI dependencies and external side effects
