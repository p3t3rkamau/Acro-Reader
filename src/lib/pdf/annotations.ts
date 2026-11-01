'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PageViewport } from 'pdfjs-dist';

type NavigateToPage = (pageNumber: number) => void;

/**
 * Creates transparent, accessible hit areas for PDF.js Link annotations.
 * Keeping these as real anchors makes the controls work with mouse, touch,
 * keyboard navigation and screen readers.
 */
export async function renderAnnotationLinks(
  layer: HTMLDivElement,
  page: PDFPageProxy,
  document: PDFDocumentProxy,
  viewport: PageViewport,
  navigateToPage: NavigateToPage,
) {
  layer.replaceChildren();

  const annotations = await page.getAnnotations({ intent: 'display' });

  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link' || !Array.isArray(annotation.rect)) continue;

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
    anchor.setAttribute('aria-label', annotation.title || 'PDF link');

    if (typeof annotation.url === 'string' && annotation.url.length > 0) {
      anchor.href = annotation.url;
      anchor.target = annotation.newWindow ? '_blank' : '_self';
      if (anchor.target === '_blank') anchor.rel = 'noopener noreferrer';
    } else if (annotation.dest) {
      anchor.href = '#';
      anchor.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          const destination = typeof annotation.dest === 'string'
            ? await document.getDestination(annotation.dest)
            : annotation.dest;

          if (!Array.isArray(destination) || destination.length === 0) return;

          const pageReference = destination[0];
          const pageIndex = typeof pageReference === 'number'
            ? pageReference
            : await document.getPageIndex(pageReference);

          navigateToPage(pageIndex + 1);
        } catch (error) {
          console.error('Unable to resolve PDF link destination.', error);
        }
      });
    } else {
      continue;
    }

    layer.appendChild(anchor);
  }
}
