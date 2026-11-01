import PDFViewer from '@/components/pdf-viewer/PDFViewer';

export default async function ReaderPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; title?: string }>;
}) {
  const params = await searchParams;
  let sourceUrl: string | undefined;
  if (params.url) {
    try {
      const parsed = new URL(params.url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') sourceUrl = parsed.toString();
    } catch {
      sourceUrl = undefined;
    }
  }
  return <PDFViewer sourceUrl={sourceUrl} documentTitle={params.title} />;
}
