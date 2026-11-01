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
  fieldType?: string;
  fieldName?: string;
};

const PDFJS_LINK_ANNOTATION_TYPE = 2;
const PDFJS_WIDGET_ANNOTATION_TYPE = 20;

function isLinkAnnotation(annotation: LinkAnnotation): boolean {
  return annotation.annotationType === PDFJS_LINK_ANNOTATION_TYPE ||
    annotation.subtype === 'Link';
}

/**
 * InDesign can export Go To Destination buttons as Widget annotations.
 * PDF.js exposes the named destination on these widgets as annotation.dest,
 * even though annotation.actions is empty and no action dictionary is present.
 */
function isWidgetNavigationAnnotation(annotation: LinkAnnotation): boolean {
  const isWidget = annotation.annotationType === PDFJS_WIDGET_ANNOTATION_TYPE ||
    annotation.subtype === 'Widget';
  return isWidget && annotation.fieldType === 'Btn' &&
    (typeof annotation.dest === 'string' ||
      (Array.isArray(annotation.dest) && annotation.dest.length > 0));
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
    const isLink = isLinkAnnotation(annotation);
    const isWidgetNavigation = isWidgetNavigationAnnotation(annotation);
    if ((!isLink && !isWidgetNavigation) || !Array.isArray(annotation.rect)) continue;

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
    anchor.setAttribute(
      'aria-label',
      annotation.title || annotation.fieldName || 'PDF navigation button',
    );

    const externalUrl = isLink ? annotation.url || annotation.unsafeUrl : null;
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

export type PdfNavigationDiagnostic = {
  pagesScanned: number;
  links: number;
  linksWithDestinations: number;
  widgets: number;
  pushButtons: number;
  pushButtonsWithActions: number;
  pushButtonsWithoutActions: number;
  widgetsWithNavigationData: number;
  widgetDetails: Array<{
    page: number;
    id?: string;
    fieldName?: string;
    fieldType?: string;
    annotationType?: number;
    subtype?: string;
    actionNames: string[];
    action?: unknown;
    dest?: unknown;
    url?: string;
    rect?: number[];
  }>;
};

/**
 * Scans every page for PDF link and widget annotations.
 * This is diagnostic only: it does not change the PDF or its annotations.
 */
export async function diagnosePdfNavigation(
  document: PDFDocumentProxy,
): Promise<PdfNavigationDiagnostic> {
  const report: PdfNavigationDiagnostic = {
    pagesScanned: 0,
    links: 0,
    linksWithDestinations: 0,
    widgets: 0,
    pushButtons: 0,
    pushButtonsWithActions: 0,
    pushButtonsWithoutActions: 0,
    widgetsWithNavigationData: 0,
    widgetDetails: [],
  };

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const annotations = await page.getAnnotations({ intent: 'display' });
    report.pagesScanned += 1;

    for (const raw of annotations) {
      const annotation = raw as typeof raw & {
        annotationType?: number;
        subtype?: string;
        id?: string;
        fieldName?: string;
        fieldType?: string;
        fieldFlags?: number;
        actions?: Record<string, unknown> | null;
        action?: unknown;
        dest?: unknown;
        url?: string;
        rect?: number[];
        pushButton?: boolean;
      };

      if (isLinkAnnotation(annotation)) {
        report.links += 1;
        if (annotation.dest || annotation.url) report.linksWithDestinations += 1;
        continue;
      }

      const isWidget = annotation.annotationType === 20 ||
        annotation.subtype === 'Widget' ||
        typeof annotation.fieldType === 'string';
      if (!isWidget) continue;

      report.widgets += 1;
      const actionNames = annotation.actions && typeof annotation.actions === 'object'
        ? Object.keys(annotation.actions)
        : [];
      const isPushButton = annotation.pushButton === true ||
        (annotation.fieldType === 'Btn' && (typeof annotation.fieldFlags === 'number'
          ? (annotation.fieldFlags & 65536) !== 0
          : false));

      if (isPushButton) {
        report.pushButtons += 1;
        if (actionNames.length > 0 || annotation.action) report.pushButtonsWithActions += 1;
        else report.pushButtonsWithoutActions += 1;
      }

      if (annotation.dest || annotation.url || annotation.action || actionNames.length > 0) {
        report.widgetsWithNavigationData += 1;
      }

      report.widgetDetails.push({
        page: pageNumber,
        id: annotation.id,
        fieldName: annotation.fieldName,
        fieldType: annotation.fieldType,
        annotationType: annotation.annotationType,
        subtype: annotation.subtype,
        actionNames,
        action: annotation.action,
        dest: annotation.dest,
        url: annotation.url,
        rect: annotation.rect,
      });
    }
  }

  return report;
}

