import 'server-only'

import { documentLibrary, type LibraryDocument, type LibraryFolder } from '@/data/documentLibrary'

type PayloadFolderNode = {
  slug: string
  title: string
  description?: string | null
  sortOrder?: number
}

type PayloadMedia = {
  url?: string | null
  filename?: string | null
}

type PayloadDocument = {
  id: string | number
  title: string
  documentNumber?: string
  revision: string
  effectiveDate: string
  status: 'published' | 'superseded'
  aircraft: string
  folderPath?: string
  folderNodes?: PayloadFolderNode[]
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

function ensureFolderPath(root: LibraryFolder, aircraft: string, nodes: PayloadFolderNode[]) {
  const aircraftFolder = root.folders?.find((folder) => folder.slug === aircraft)
  if (!aircraftFolder) return null

  let current: LibraryFolder = aircraftFolder

  for (const node of nodes) {
    current.folders ??= []
    let next: LibraryFolder | undefined = current.folders.find(
      (folder) => folder.slug === node.slug,
    )

    if (!next) {
      const createdFolder: LibraryFolder = {
        slug: node.slug,
        title: node.title,
        description: node.description ?? undefined,
        folders: [],
        documents: [],
      }

      current.folders.push(createdFolder)
      current.folders.sort((a, b) => {
        const aOrder =
          nodes.find((item) => item.slug === a.slug)?.sortOrder ?? Number.MAX_SAFE_INTEGER
        const bOrder =
          nodes.find((item) => item.slug === b.slug)?.sortOrder ?? Number.MAX_SAFE_INTEGER
        return aOrder - bOrder || a.title.localeCompare(b.title)
      })
      next = createdFolder
    }

    current = next
  }

  return current
}

export async function getDocumentLibrary(): Promise<LibraryFolder> {
  const root = cloneFolder(documentLibrary)
  const configuredUrl = process.env.PAYLOAD_API_URL

  if (!configuredUrl) {
    console.warn('[AcroReader] PAYLOAD_API_URL is not configured; showing the empty library structure.')
    return root
  }

  try {
    const apiBase = configuredUrl.replace(/\/$/, '')
    const endpoint = new URL('/api/acro-documents', apiBase)
    endpoint.searchParams.set('limit', '1000')

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

      if (!media?.url || !record.aircraft || !record.status) continue

      const nodes = record.folderNodes ?? (record.folderPath
        ? record.folderPath.split('/').filter(Boolean).map((slug) => ({ slug, title: slug }))
        : [])

      const folder = ensureFolderPath(root, record.aircraft, nodes)
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
