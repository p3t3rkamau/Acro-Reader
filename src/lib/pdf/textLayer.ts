import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';

export type TextLayerResult = { matchCount: number };

function multiplyMatrices(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * Builds a selectable text overlay from PDF.js text content.
 * Canvas remains responsible for the page artwork; this layer only provides text selection/search.
 */
export async function renderSelectableText(
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLDivElement,
  searchTerm = '',
): Promise<TextLayerResult> {
  container.replaceChildren();
  const content = await page.getTextContent();
  const styles = content.styles;
  const query = searchTerm.trim().toLocaleLowerCase();
  let matchCount = 0;

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue;
    const transform = multiplyMatrices(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2], transform[3]);
    if (!fontHeight) continue;

    const span = document.createElement('span');
    span.className = 'pdf-text-item';
    span.textContent = item.str;
    span.style.left = `${transform[4]}px`;
    span.style.top = `${transform[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = styles[item.fontName]?.fontFamily || 'sans-serif';
    span.style.transform = `rotate(${Math.atan2(transform[1], transform[0])}rad)`;
    span.style.transformOrigin = '0 0';
    span.style.width = `${Math.max(0, item.width * viewport.scale)}px`;

    if (query) {
      const lower = item.str.toLocaleLowerCase();
      let from = 0;
      let found = lower.indexOf(query, from);
      if (found === -1) {
        span.textContent = item.str;
      } else {
        const fragment = document.createDocumentFragment();
        while (found !== -1) {
          if (found > from) fragment.append(document.createTextNode(item.str.slice(from, found)));
          const mark = document.createElement('mark');
          mark.className = 'pdf-search-highlight';
          mark.textContent = item.str.slice(found, found + query.length);
          fragment.append(mark);
          matchCount += 1;
          from = found + query.length;
          found = lower.indexOf(query, from);
        }
        if (from < item.str.length) fragment.append(document.createTextNode(item.str.slice(from)));
        span.replaceChildren(fragment);
      }
    }
    container.append(span);
  }

  return { matchCount };
}
