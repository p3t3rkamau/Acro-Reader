export type LibraryDocument = {
  id: string;
  title: string;
  revision: string;
  effectiveDate: string;
  fileUrl: string;
  status: 'current' | 'superseded';
};

export type LibraryFolder = {
  slug: string;
  title: string;
  description?: string;
  folders?: LibraryFolder[];
  documents?: LibraryDocument[];
};

const flightOperationsFolders: LibraryFolder[] = [
  { slug: 'afm', title: 'AFM', description: 'Aircraft Flight Manual', documents: [] },
  { slug: 'qrh', title: 'QRH', description: 'Quick Reference Handbook', documents: [] },
  { slug: 'aom', title: 'AOM', description: 'Aircraft Operating Manual', documents: [] },
  { slug: 'clg', title: 'CLG', description: 'Checklist and guidance documents', documents: [] },
];

const maintenanceFolders: LibraryFolder[] = [
  {
    slug: 'aircraft-specific-manuals',
    title: 'Aircraft-specific manuals',
    description: 'Manual collections organised by individual aircraft. Aircraft folders and manual types can be added as the catalogue is populated.',
    folders: [],
  },
];

function createAircraftLibrary(slug: string, title: string): LibraryFolder {
  return {
    slug,
    title,
    description: `Technical documentation for ${title} aircraft.`,
    folders: [
      {
        slug: 'flight-operations',
        title: 'Flight Operations',
        description: 'Operational manuals, checklists and flight crew references.',
        folders: flightOperationsFolders,
      },
      {
        slug: 'maintenance',
        title: 'Maintenance',
        description: 'Maintenance documentation organised by aircraft and manual type.',
        folders: maintenanceFolders,
      },
    ],
  };
}

export const documentLibrary: LibraryFolder = {
  slug: 'library',
  title: 'Aircraft Documentation',
  description: 'Browse published aircraft manuals and operational documents.',
  folders: [
    createAircraftLibrary('dash-100', 'DASH 100'),
    createAircraftLibrary('dash-200', 'DASH 200'),
    createAircraftLibrary('dash-300', 'DASH 300'),
    createAircraftLibrary('dash-400', 'DASH 400'),
  ],
};

export function findLibraryFolder(path: string[], root: LibraryFolder = documentLibrary): LibraryFolder | null {
  let current: LibraryFolder = root;
  for (const segment of path) {
    const next = current.folders?.find((folder) => folder.slug === segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

export function getLibraryBreadcrumbs(path: string[], root: LibraryFolder = documentLibrary) {
  const crumbs: { title: string; href: string }[] = [
    { title: root.title, href: '/' },
  ];
  let current = root;
  const accumulated: string[] = [];
  for (const segment of path) {
    const next = current.folders?.find((folder) => folder.slug === segment);
    if (!next) break;
    accumulated.push(segment);
    crumbs.push({ title: next.title, href: `/library/${accumulated.join('/')}` });
    current = next;
  }
  return crumbs;
}
