'use client';

import type { PDFDocumentProxy } from 'pdfjs-dist';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/** Load PDF.js only in the browser so its DOM and worker dependencies never run on the server. */
export async function getPdfJs() {
  if (typeof window === 'undefined') throw new Error('PDF rendering is only available in the browser.');
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      // Keep the worker version exactly aligned with the installed PDF.js package.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export type { PDFDocumentProxy };
