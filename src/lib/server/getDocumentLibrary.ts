import 'server-only'

import { documentLibrary, type LibraryDocument, type LibraryFolder } from '@/data/documentLibrary'

type PayloadMedia = {
  url?: string | null
}

type PayloadDocument = {
  id: string | number
  title: string
  revision: string
  effectiveDate: string
  status: 'published' | 'superseded' | 'draft'
  aircraft: string
  folderPath?: string
  pdfFile?: PayloadMedia | string | number | null
}

type PayloadResponse = {
  docs?: PayloadDocument[]
}

function cloneFolder(folder: LibraryFolder): LibraryFolder {
  return {
    ...folder,
    folders: folder.folders?.map(cloneFolder),
    documents: [],
  }
}

function findFolder(root: LibraryFolder, path: string[]): LibraryFolder | null {
  let current: LibraryFolder | undefined = root
  for (const segment of path) {
    current = current.folders?.find((folder) => folder.slug === segment)
    if (!current) return null
  }
  return current
}

export async function getDocumentLibrary(): Promise<LibraryFolder> {
  const root = cloneFolder(documentLibrary)
  const apiBase = process.env.PAYLOAD_API_URL?.replace(/\/$/, '')

  if (!apiBase) {
    console.warn('[AcroReader] PAYLOAD_API_URL is not configured; showing the empty library structure.')
    return root
  }

  try {
    const endpoint = new URL('/api/acro-documents', apiBase)
    endpoint.searchParams.set('depth', '2')
    endpoint.searchParams.set('limit', '500')
    endpoint.searchParams.set('sort', 'sortOrder')
    endpoint.searchParams.set('where[status][in]', 'published,superseded')

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error(`Payload returned HTTP ${response.status}`)
    }

    const payload = (await response.json()) as PayloadResponse
    for (const record of payload.docs ?? []) {
      const media = typeof record.pdfFile === 'object' && record.pdfFile !== null
        ? record.pdfFile
        : null
      if (!media?.url || record.status === 'draft') continue

      const folder = findFolder(root, [record.aircraft, ...(record.folderPath ?? '').split('/').filter(Boolean)])
      if (!folder) continue

      const document: LibraryDocument = {
        id: String(record.id),
        title: record.title,
        revision: record.revision,
        effectiveDate: record.effectiveDate,
        fileUrl: media.url,
        status: record.status === 'published' ? 'current' : 'superseded',
      }
      folder.documents ??= []
      folder.documents.push(document)
    }
  } catch (error) {
    console.error('[AcroReader] Could not load the Payload document catalogue.', error)
  }

  return root
}
