import DocumentLibrary from '@/components/library/DocumentLibrary';

export default async function LibraryFolderPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  return <DocumentLibrary path={segments} />;
}
