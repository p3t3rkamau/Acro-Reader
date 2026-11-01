# AcroReader

A mobile-first interactive PDF reader built with Next.js, TypeScript, SCSS Modules and Mozilla PDF.js.

## Requirements
- Node.js 20.9+
- npm 10+

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Current foundation
- Responsive application shell for desktop and mobile
- Local PDF file opening
- Real PDF.js document loading and canvas rendering
- Continuous page layout with IntersectionObserver-driven lazy rendering
- Current-page tracking and page jump controls
- Basic zoom controls
- PDF outline retrieval and bookmark panel foundation
- PDF.js link annotation hit areas with mouse, touch and keyboard access
- Internal page navigation for direct and named PDF destinations
- External PDF links with safe new-window handling when requested by the PDF
- Basic text extraction search (first matching page)

## Important compatibility note
This is the first development milestone, not a completed Acrobat replacement. The current renderer uses PDF.js canvas rendering plus a lightweight accessible overlay for standard link annotations and internal destinations. Text selection/highlight overlays, full PDF action coverage, form widgets, password entry, robust virtualization, pinch gestures, print/share, and a tested compatibility report are still to be implemented. PDF.js does not execute arbitrary Acrobat JavaScript or guarantee support for InDesign multimedia/animation exports.

## Next milestones
1. Add PDF.js text selection and text-layer search highlighting.
2. Add robust virtualized page mounting and render-task cancellation on scroll/zoom.
3. Improve bookmark destination resolution for all destination forms and nested outlines.
4. Add search result navigation and highlighting.
5. Add mobile pinch/pan gestures, print/share/download and compatibility diagnostics.
6. Add automated browser/device QA against the Q400 interactive PDF and other test documents.
