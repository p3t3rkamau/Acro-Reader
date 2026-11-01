'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, FileUp, History, Minus, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { getPdfJs } from '@/lib/pdf/pdfjs';
import { diagnosePdfNavigation, renderAnnotationLinks } from '@/lib/pdf/annotations';
import { renderSelectableText } from '@/lib/pdf/textLayer';
import { clearRecentDocuments, deleteRecentDocument, getRecentDocument, listRecentDocuments, saveRecentDocument, type RecentDocument } from '@/lib/pdf/recentDocuments';
import styles from './PDFViewer.module.scss';

type PageState = 'idle' | 'loading' | 'ready' | 'error';

export default function PDFViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasks = useRef<Map<number, RenderTask>>(new Map());
  const renderPromises = useRef<Map<number, Promise<void>>>(new Map());
  const documentGeneration = useRef(0);
  const renderEpoch = useRef(0);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState('No document opened');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageStates, setPageStates] = useState<Record<number, PageState>>({});
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({});
  const [outline, setOutline] = useState<any[]>([]);
  const [showOutline, setShowOutline] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchPages, setSearchPages] = useState<number[]>([]);
  const [searchPageIndex, setSearchPageIndex] = useState(0);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);

  const setPageState = useCallback((page: number, state: PageState) => {
    setPageStates((previous) => ({ ...previous, [page]: state }));
  }, []);

  const cancelRenders = useCallback(async () => {
    renderEpoch.current += 1;
    const tasks = Array.from(renderTasks.current.values());
    tasks.forEach((task) => task.cancel());
    await Promise.allSettled(tasks.map((task) => task.promise));
    renderTasks.current.clear();
    renderPromises.current.clear();
  }, []);

  const renderPage = useCallback((document: PDFDocumentProxy, pageNumber: number) => {
    const existing = renderPromises.current.get(pageNumber);
    if (existing) return existing;
    const generation = documentGeneration.current;
    const epoch = renderEpoch.current;
    const work = (async () => {
    const host = pageRefs.current.get(pageNumber);
    if (!host || generation !== documentGeneration.current || epoch !== renderEpoch.current) return;
    setPageState(pageNumber, 'loading');
    let task: RenderTask | undefined;
    try {
      const page: PDFPageProxy = await document.getPage(pageNumber);
      if (generation !== documentGeneration.current || epoch !== renderEpoch.current || pdfRef.current !== document) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, Math.min(host.parentElement?.clientWidth ?? 900, 1100) - 40);
      const fitScale = Math.min(1.5, availableWidth / baseViewport.width);
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const cssViewport = page.getViewport({ scale: fitScale * zoom });
      const renderViewport = page.getViewport({ scale: fitScale * zoom * outputScale });
      const canvas = host.querySelector('canvas');
      const annotationLayer = host.querySelector<HTMLDivElement>('[data-annotation-layer]');
      const textLayer = host.querySelector<HTMLDivElement>('[data-text-layer]');
      if (!canvas || !annotationLayer || !textLayer) return;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not create a canvas rendering context.');
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${cssViewport.width}px`;
      canvas.style.height = `${cssViewport.height}px`;
      task = page.render({ canvasContext: context, viewport: renderViewport, canvas } as Parameters<PDFPageProxy['render']>[0]);
      renderTasks.current.set(pageNumber, task);
      await task.promise;
      if (generation !== documentGeneration.current || epoch !== renderEpoch.current || pdfRef.current !== document) return;
      // The canvas may be constrained by the mobile viewport at high zoom.
      // Match the link layer to its final on-screen size, not its requested size.
      const displayedWidth = canvas.clientWidth || cssViewport.width;
      const displayedHeight = canvas.clientHeight || cssViewport.height;
      const annotationScale = displayedWidth / cssViewport.width;
      const annotationViewport = page.getViewport({ scale: fitScale * zoom * annotationScale });
      annotationLayer.style.width = `${displayedWidth}px`;
      annotationLayer.style.height = `${displayedHeight}px`;
      textLayer.style.width = `${displayedWidth}px`;
      textLayer.style.height = `${displayedHeight}px`;
      await renderSelectableText(page, annotationViewport, textLayer, activeSearchTerm);
      await renderAnnotationLinks(annotationLayer, page, document, annotationViewport, (targetPage) => {
        const safePage = Math.max(1, Math.min(document.numPages, targetPage));
        pageRefs.current.get(safePage)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(safePage);
      });
      if (generation === documentGeneration.current && epoch === renderEpoch.current) setPageState(pageNumber, 'ready');
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'RenderingCancelledException') return;
      if (generation === documentGeneration.current && epoch === renderEpoch.current) {
        console.error(`Failed to render PDF page ${pageNumber}`, cause);
        setPageState(pageNumber, 'error');
      }
    } finally {
      if (task && renderTasks.current.get(pageNumber) === task) renderTasks.current.delete(pageNumber);
    }
    })();
    renderPromises.current.set(pageNumber, work);
    void work.finally(() => {
      if (renderPromises.current.get(pageNumber) === work) renderPromises.current.delete(pageNumber);
    });
    return work;
  }, [setPageState, zoom, activeSearchTerm]);

  const openPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a valid PDF file.');
      return;
    }
    const generation = ++documentGeneration.current;
    setLoading(true);
    setError('');
    setPdf(null);
    try {
      await cancelRenders();
      const previousDocument = pdfRef.current;
      pdfRef.current = null;
      await previousDocument?.destroy();
      if (generation !== documentGeneration.current) return;
      const pdfjs = await getPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const loaded = await pdfjs.getDocument({ data }).promise;
      if (generation !== documentGeneration.current) { await loaded.destroy(); return; }
      pdfRef.current = loaded;
      setPdf(loaded);
      setFileName(file.name);
      setPageCount(loaded.numPages);
      setCurrentPage(1);
      setZoom(1);
      setPageStates({});
      setPageDimensions({});
      setActiveSearchTerm('');
      setSearchPages([]);
      setSearchPageIndex(0);
      setOutline((await loaded.getOutline()) ?? []);

      // Read page dimensions up front so lazy-rendered pages reserve their
      // final space. Without this, placeholder pages grow as they render and
      // can move the scroll target during long-distance navigation.
      const dimensions: Record<number, { width: number; height: number }> = {};
      for (let pageNumber = 1; pageNumber <= loaded.numPages; pageNumber += 1) {
        const page = await loaded.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        dimensions[pageNumber] = { width: viewport.width, height: viewport.height };
      }
      if (generation === documentGeneration.current) setPageDimensions(dimensions);

      // Temporary full-document scan to identify InDesign navigation buttons
      // exported as PDF form widgets instead of Link annotations.
      void diagnosePdfNavigation(loaded).then((report) => {
        console.groupCollapsed('[AcroReader] PDF navigation diagnostic');
        console.info('Annotation summary', {
          pagesScanned: report.pagesScanned,
          links: report.links,
          linksWithDestinations: report.linksWithDestinations,
          widgets: report.widgets,
          pushButtons: report.pushButtons,
          pushButtonsWithActions: report.pushButtonsWithActions,
          pushButtonsWithoutActions: report.pushButtonsWithoutActions,
          widgetsWithNavigationData: report.widgetsWithNavigationData,
        });
        if (report.widgetDetails.length) console.table(report.widgetDetails);
        console.groupEnd();
      }).catch((diagnosticError) => {
        console.warn('[AcroReader] PDF navigation diagnostic failed.', diagnosticError);
      });
      try { setRecentDocuments(await saveRecentDocument(file)); } catch (storageError) { console.warn('Could not save this PDF to recent documents.', storageError); }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The PDF could not be opened.';
      setError(message.includes('password') ? 'This PDF is password-protected. Password entry will be added in a later milestone.' : `Unable to open this PDF. ${message}`);
    } finally {
      if (generation === documentGeneration.current) setLoading(false);
    }
  }, [cancelRenders]);

  useEffect(() => {
    if (!pdf) return;
    const nodes = Array.from(pageRefs.current.entries());
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const pageNumber = Number((entry.target as HTMLElement).dataset.page);
        if (entry.isIntersecting) {
          setCurrentPage(pageNumber);
          void renderPage(pdf, pageNumber);
          if (pageNumber > 1) void renderPage(pdf, pageNumber - 1);
          if (pageNumber < pdf.numPages) void renderPage(pdf, pageNumber + 1);
        }
      });
    }, { root: scrollerRef.current, rootMargin: '900px 0px', threshold: 0.01 });
    nodes.forEach(([, node]) => observer.observe(node));
    return () => observer.disconnect();
  }, [pdf, renderPage, pageCount]);

  useEffect(() => {
    if (!pdf) return;
    void (async () => {
    await cancelRenders();
    if (pdfRef.current !== pdf) return;
    setPageStates({});
    pageRefs.current.forEach((host) => {
      const canvas = host.querySelector('canvas');
      const context = canvas?.getContext('2d');
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    });
    const active = pageRefs.current.get(currentPage);
    if (active) void renderPage(pdf, currentPage);
    })();
  }, [zoom, pdf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    let startDistance = 0;
    let startZoom = 1;

    const distanceBetweenTouches = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        startDistance = distanceBetweenTouches(event.touches);
        startZoom = zoom;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) return;
      event.preventDefault();
      const scale = distanceBetweenTouches(event.touches) / startDistance;
      const nextZoom = Math.max(0.5, Math.min(2.5, startZoom * scale));
      setZoom(Number(nextZoom.toFixed(2)));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) startDistance = 0;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom]);

  useEffect(() => {
    void listRecentDocuments().then(setRecentDocuments).catch((cause) => console.warn('Recent documents are unavailable.', cause));
    return () => {
      documentGeneration.current += 1;
      void cancelRenders().then(() => pdfRef.current?.destroy());
    };
  }, [cancelRenders]);

  const jumpToPage = (page: number) => {
    const safePage = Math.max(1, Math.min(pageCount, page));
    pageRefs.current.get(safePage)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrentPage(safePage);
  };

  const openRecent = async (id: string) => {
    try {
      const file = await getRecentDocument(id);
      if (file) await openPdf(file);
      else setError('That recent PDF is no longer available in this browser. Please browse for it again.');
    } catch { setError('Could not reopen this recent PDF. Please browse for it again.'); }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void openPdf(file);
    event.target.value = '';
  };

  const changeZoom = (delta: number) => setZoom((value) => Math.max(0.5, Math.min(2.5, Number((value + delta).toFixed(2)))));

  const removeRecent = async (id: string) => {
    if (!window.confirm('Remove this PDF from recent documents on this device?')) return;
    try {
      await deleteRecentDocument(id);
      setRecentDocuments(await listRecentDocuments());
    } catch (cause) {
      console.error('Could not delete this recent PDF.', cause);
      setError('Could not remove this PDF from this device.');
    }
  };

  const removeAllRecent = async () => {
    if (!window.confirm('Delete all locally saved PDFs from this device? This cannot be undone.')) return;
    try {
      await clearRecentDocuments();
      setRecentDocuments([]);
    } catch (cause) {
      console.error('Could not clear recent PDFs.', cause);
      setError('Could not clear locally saved PDFs.');
    }
  };

  const searchInDocument = async () => {
    if (!pdf || !searchTerm.trim()) return;
    const term = searchTerm.trim().toLocaleLowerCase();
    const pages: number[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => 'str' in item ? item.str : '').join(' ').toLocaleLowerCase();
      if (pageText.includes(term)) pages.push(pageNumber);
    }
    setSearchPages(pages);
    setSearchPageIndex(0);
    setActiveSearchTerm(searchTerm.trim());
    if (pages.length) jumpToPage(pages[0]);
    else setError(`No match found for “${searchTerm}”.`);
  };

  const moveSearchResult = (direction: -1 | 1) => {
    if (!searchPages.length) return;
    const next = (searchPageIndex + direction + searchPages.length) % searchPages.length;
    setSearchPageIndex(next);
    jumpToPage(searchPages[next]);
  };

  return (
    <main className={styles.appShell}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.brandMark}><BookOpen size={19} /></span><span>AcroReader</span></div>
        <div className={styles.documentName} title={fileName}>{fileName}</div>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} aria-label="Search document" onClick={() => setShowSearch((value) => !value)} disabled={!pdf}><Search size={18} /></button>
          <button className={styles.iconButton} aria-label="Recent documents" title="Recent documents" onClick={() => { setShowRecent((value) => !value); setShowOutline(false); }}><History size={18} /></button><button className={styles.iconButton} aria-label="Show bookmarks" onClick={() => { setShowOutline((value) => !value); setShowRecent(false); }} disabled={!pdf}><BookOpen size={18} /></button>
          <button className={styles.openButton} onClick={() => inputRef.current?.click()}><FileUp size={17} /><span>Open PDF</span></button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFileChange} />
        </div>
      </header>

      {showSearch && <div className={styles.searchBar}><Search size={17} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchInDocument()} placeholder="Search text in this PDF" /><button onClick={() => void searchInDocument()}>Find</button>{searchPages.length > 0 && <><span className={styles.searchCount}>{searchPageIndex + 1} / {searchPages.length} pages</span><button onClick={() => moveSearchResult(-1)} aria-label="Previous search result">↑</button><button onClick={() => moveSearchResult(1)} aria-label="Next search result">↓</button></>}<button className={styles.iconButton} onClick={() => setShowSearch(false)} aria-label="Close search"><X size={16} /></button></div>}

      <div className={styles.workspace}>
        {showRecent && <aside className={styles.outlinePanel}><div className={styles.panelHeading}><span>Recent documents</span><span className={styles.panelActions}>{recentDocuments.length > 0 && <button className={styles.clearRecentButton} onClick={() => void removeAllRecent()}>Clear all</button>}<button className={styles.iconButton} onClick={() => setShowRecent(false)} aria-label="Close recent documents"><X size={16} /></button></span></div>{recentDocuments.length ? recentDocuments.map((item) => <div className={styles.recentItemRow} key={item.id}><button className={styles.recentItem} onClick={() => { setShowRecent(false); void openRecent(item.id); }}><span className={styles.recentIcon}><BookOpen size={17} /></span><span className={styles.recentDetails}><strong>{item.name}</strong><small>{new Date(item.lastOpened).toLocaleString()}</small></span></button><button className={styles.deleteRecentButton} onClick={() => void removeRecent(item.id)} aria-label={`Delete ${item.name}`} title="Delete from this device"><Trash2 size={16} /></button></div>) : <p className={styles.muted}>PDFs you open on this device will appear here.</p>}</aside>}{showOutline && <aside className={styles.outlinePanel}><div className={styles.panelHeading}>Document outline<button className={styles.iconButton} onClick={() => setShowOutline(false)} aria-label="Close bookmarks"><X size={16} /></button></div>{outline.length ? outline.map((item, index) => <button className={styles.outlineItem} key={`${item.title}-${index}`} onClick={async () => { if (typeof item.dest === 'string') { const destination = await pdf?.getDestination(item.dest); if (destination && pdf) { const ref = destination[0]; const pageIndex = await pdf.getPageIndex(ref); jumpToPage(pageIndex + 1); } } }}>{item.title}</button>) : <p className={styles.muted}>This document has no bookmarks.</p>}</aside>}
        <section className={styles.readerArea} ref={scrollerRef}>
          {!pdf && !loading && <div className={styles.emptyState}><div className={styles.emptyIcon}><FileUp size={30} /></div><h1>Your documents, ready to explore.</h1><p>Open an interactive PDF to start reading. Recent files are saved privately in this browser on this device.</p><button className={styles.openButton} onClick={() => inputRef.current?.click()}><FileUp size={17} /> Browse device files</button>{recentDocuments.length > 0 && <div className={styles.recentSection}><h2>Recent documents</h2>{recentDocuments.map((item) => <div className={styles.recentItemRow} key={item.id}><button className={styles.recentItem} onClick={() => void openRecent(item.id)}><span className={styles.recentIcon}><BookOpen size={17} /></span><span className={styles.recentDetails}><strong>{item.name}</strong><small>{new Date(item.lastOpened).toLocaleDateString()} · {(item.size / 1024 / 1024).toFixed(1)} MB</small></span></button><button className={styles.deleteRecentButton} onClick={() => void removeRecent(item.id)} aria-label={`Delete ${item.name}`} title="Delete from this device"><Trash2 size={16} /></button></div>)}</div>}<span className={styles.supportNote}>On phones and tablets, Browse opens your device’s file picker.</span></div>}
          {loading && <div className={styles.loadingState}><div className={styles.spinner} /><p>Opening your document…</p></div>}
          {error && <div className={styles.errorBanner} role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
          {pdf && Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => {
            const dimensions = pageDimensions[pageNumber];
            const availableWidth = Math.max(280, Math.min(scrollerRef.current?.clientWidth ?? 900, 1100) - 40);
            const fitScale = dimensions ? Math.min(1.5, availableWidth / dimensions.width) : 1;
            const reservedWidth = dimensions ? dimensions.width * fitScale * zoom : undefined;
            const reservedHeight = dimensions ? dimensions.height * fitScale * zoom : undefined;
            return <div className={styles.pageSlot} key={pageNumber} data-page={pageNumber} ref={(node) => { if (node) pageRefs.current.set(pageNumber, node); else pageRefs.current.delete(pageNumber); }}>
              <div className={styles.pageLabel}>Page {pageNumber}</div>
              <div className={styles.pageCanvas} style={reservedWidth && reservedHeight ? { width: reservedWidth, height: reservedHeight } : undefined}>
                <canvas aria-label={`PDF page ${pageNumber}`} />
                <div className={styles.textLayer} data-text-layer aria-label={`Selectable text on page ${pageNumber}`} />
                <div className={styles.annotationLayer} data-annotation-layer aria-label={`Interactive links on page ${pageNumber}`} />
                {pageStates[pageNumber] === 'loading' && <span className={styles.pageLoading}>Rendering page…</span>}
                {pageStates[pageNumber] === 'error' && <span className={styles.pageLoading}>This page could not be rendered.</span>}
              </div>
            </div>;
          })}
        </section>
      </div>

      {pdf && <footer className={styles.controlbar}><div className={styles.pageControls}><button className={styles.iconButton} onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page"><ChevronLeft size={18} /></button><input aria-label="Current page" type="number" min={1} max={pageCount} value={currentPage} onChange={(event) => jumpToPage(Number(event.target.value) || 1)} /><span>/ {pageCount}</span><button className={styles.iconButton} onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="Next page"><ChevronRight size={18} /></button></div><div className={styles.zoomControls}><button className={styles.iconButton} onClick={() => changeZoom(-0.1)} aria-label="Zoom out"><Minus size={17} /></button><span>{Math.round(zoom * 100)}%</span><button className={styles.iconButton} onClick={() => changeZoom(0.1)} aria-label="Zoom in"><Plus size={17} /></button><button className={styles.iconButton} onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw size={16} /></button></div></footer>}
    </main>
  );
}
