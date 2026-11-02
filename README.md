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
- Selectable text overlay generated from PDF.js text content
- Text selection and copy support for selectable PDF text
- Search highlighting for matches contained within individual PDF text items
- Search navigation between matching pages
- Basic text extraction search
- Recent-document library stored locally in IndexedDB (up to 12 shown)
- Reopen recent PDFs without browsing for the file again
- Native browser file picker for local PDF selection on desktop, iOS/iPadOS and Android browsers
- Render-task cancellation, cancellation settling, and document-generation guards when switching PDFs

## Important compatibility note
This is the first development milestone, not a completed Acrobat replacement. The current renderer uses PDF.js canvas rendering plus a lightweight accessible overlay for standard link annotations and internal destinations. Advanced text layout fidelity, matches spanning multiple PDF text items, full PDF action coverage, form widgets, password entry, robust virtualization, pinch gestures, print/share, and a tested compatibility report are still to be implemented. Recent documents are stored in the current browser's local IndexedDB; they are not synced between devices and may be cleared by the browser or operating system. PDF.js does not execute arbitrary Acrobat JavaScript or guarantee support for InDesign multimedia/animation exports.

## Next milestones
1. Improve text-layer alignment across rotated pages, mixed fonts and constrained mobile widths; add cross-text-item search matches.
2. Add robust virtualized page mounting and continue hardening render-task cancellation on scroll/zoom/document switches.
3. Improve bookmark destination resolution for all destination forms and nested outlines.
4. Add search result navigation and highlighting.
5. Add mobile pinch/pan gestures, print/share/download and compatibility diagnostics.
6. Add automated browser/device QA against the Q400 interactive PDF and other test documents.

## Payload backend connection

AcroReader reads its document catalogue from the Payload CMS backend through the public `GET /api/acro-documents` endpoint.

Set this environment variable in the AcroReader deployment:

```env
PAYLOAD_API_URL=https://your-payload-project.vercel.app
```

Use the Payload backend origin only; do not add `/api` or a trailing slash. The catalogue is fetched server-side and cached for 60 seconds.

### Payload document setup

1. Create the aircraft records (DASH 100, DASH 200, DASH 300 and DASH 400) in Payload.
2. Create the category tree using parent relationships, for example DASH 400 → Flight Operations → QRH.
3. Create a document record and link its aircraft, category and document type.
4. Create a separate Document Revision record and upload its PDF.
5. Move the revision through Draft → In Review → Published.

Only Published and Superseded revisions are returned by the public catalogue endpoint. Publishing a new revision updates the document's current revision and preserves the previous revision as history.

### API

- `GET /api/acro-documents` — published and superseded document revisions.
- `GET /api/acro-documents?aircraft=dash-400` — filter by aircraft series.
- `GET /api/acro-documents?document=DOCUMENT_ID` — revisions for one document.
- `GET /api/acro-documents?status=superseded` — historical revisions only.

The API returns document metadata, revision number, effective date, aircraft series, category folder path, and PDF URL. AcroReader maps those records into the existing library layout and opens the PDF using its existing `/reader` route.

**Viewer preservation:** the PDF.js renderer, annotation/link handling, internal PDF navigation, zoom, page controls, local PDF opening and recent-document storage are not replaced by this integration.
