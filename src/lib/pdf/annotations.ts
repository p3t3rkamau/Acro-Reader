'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

type NavigateToPage = (pageNumber: number) => void;
type PdfDestination = Awaited<ReturnType<PDFDocumentProxy['getDestination']>>;

type LinkAnnotation = {
  // PDF.js 4.x identifies annotations with annotationType (Link = 2).
  // Some wrappers/builds may also expose the PDF subtype string.
  annotationType?: number;
  subtype?: string;
  rect?: number[];
  title?: string;
  url?: string | null;
  unsafeUrl?: string | null;
  newWindow?: boolean;
  dest?: string | PdfDestination | null;
  action?: string | null;
};

const PDFJS_LINK_ANNOTATION_TYPE = 2;

function isLinkAnnotation(annotation: LinkAnnotation): boolean {
  return annotation.annotationType === PDFJS_LINK_ANNOTATION_TYPE ||
    annotation.subtype === 'Link';
}

async function resolveInternalDestination(
  document: PDFDocumentProxy,
  annotation: LinkAnnotation,
): Promise<PdfDestination | null> {
  const action = annotation.action;
  const destination = annotation.dest;

  if (action && action !== 'GoTo') return null;
  if (typeof destination === 'string') {
    return await document.getDestination(destination) ?? null;
  }
  return Array.isArray(destination) ? destination : null;
}

/**
 * Creates transparent, accessible hit areas for PDF.js Link annotations.
 *
 * PDF.js 4.x exposes the annotation kind as numeric annotationType
 * (AnnotationType.LINK = 2); it does not reliably expose subtype: 'Link'.
 * Checking subtype alone silently skips every link, leaving the PDF looking
 * correct while none of its buttons or links respond to pointer/touch input.
 */
export async function renderAnnotationLinks(
  layer: HTMLDivElement,
  page: PDFPageProxy,
  document: PDFDocumentProxy,
  viewport: ReturnType<PDFPageProxy['getViewport']>,
  navigateToPage: NavigateToPage,
) {
  layer.replaceChildren();

  const annotations = await page.getAnnotations({ intent: 'display' });

  for (const rawAnnotation of annotations) {
    const annotation = rawAnnotation as typeof rawAnnotation & LinkAnnotation;
    if (!isLinkAnnotation(annotation) || !Array.isArray(annotation.rect)) continue;

    const bounds = viewport.convertToViewportRectangle(annotation.rect);
    const left = Math.max(0, Math.min(bounds[0], bounds[2]));
    const top = Math.max(0, Math.min(bounds[1], bounds[3]));
    const right = Math.min(viewport.width, Math.max(bounds[0], bounds[2]));
    const bottom = Math.min(viewport.height, Math.max(bounds[1], bounds[3]));
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) continue;

    const anchor = window.document.createElement('a');
    anchor.className = 'pdf-annotation-link';
    anchor.style.left = `${left}px`;
    anchor.style.top = `${top}px`;
    anchor.style.width = `${width}px`;
    anchor.style.height = `${height}px`;
    anchor.setAttribute('aria-label', annotation.title || 'PDF navigation link');

    const externalUrl = annotation.url || annotation.unsafeUrl;
    if (typeof externalUrl === 'string' && externalUrl.length > 0) {
      anchor.href = externalUrl;
      anchor.target = annotation.newWindow ? '_blank' : '_self';
      if (anchor.target === '_blank') anchor.rel = 'noopener noreferrer';
    } else {
      const hasInternalDestination =
        typeof annotation.dest === 'string' ||
        (Array.isArray(annotation.dest) && annotation.dest.length > 0);

      if (!hasInternalDestination) continue;

      anchor.href = '#';
      anchor.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          const destination = await resolveInternalDestination(document, annotation);
          if (!destination?.length) {
            console.warn('PDF Go To link has no resolvable internal destination.', {
              pageNumber: page.pageNumber,
              title: annotation.title,
              action: annotation.action,
              dest: annotation.dest,
            });
            return;
          }

          const pageReference = destination[0];
          const pageIndex = typeof pageReference === 'number'
            ? pageReference
            : await document.getPageIndex(pageReference);

          if (Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < document.numPages) {
            navigateToPage(pageIndex + 1);
          }
        } catch (error) {
          console.error('Unable to resolve PDF Go To destination.', error);
        }
      });
    }

    layer.appendChild(anchor);
  }
}
