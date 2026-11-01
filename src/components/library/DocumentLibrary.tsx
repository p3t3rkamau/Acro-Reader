import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronRight, FileText, Folder, Plane, Wrench } from 'lucide-react';
import {
  findLibraryFolder,
  getLibraryBreadcrumbs,
  type LibraryFolder,
} from '@/data/documentLibrary';
import styles from './DocumentLibrary.module.scss';

type Props = { path?: string[] };

function FolderIcon({ title }: { title: string }) {
  if (title === 'Flight Operations') return <BookOpen size={22} />;
  if (title === 'Maintenance') return <Wrench size={22} />;
  if (title.startsWith('DASH')) return <Plane size={22} />;
  return <Folder size={22} />;
}

function FolderCard({ folder, href }: { folder: LibraryFolder; href: string }) {
  const count = folder.folders?.length ?? folder.documents?.length ?? 0;
  return (
    <Link className={styles.folderCard} href={href}>
      <span className={styles.folderIcon}><FolderIcon title={folder.title} /></span>
      <span className={styles.folderCopy}>
        <strong>{folder.title}</strong>
        <small>{folder.description ?? 'Browse documents in this folder.'}</small>
        <em>{count ? `${count} ${folder.folders ? 'folders' : 'documents'}` : 'Open folder'}</em>
      </span>
      <ChevronRight className={styles.chevron} size={19} />
    </Link>
  );
}

export default function DocumentLibrary({ path = [] }: Props) {
  const folder = findLibraryFolder(path);
  if (!folder) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <FileText size={30} />
          <h1>Folder not found</h1>
          <p>This location may have moved or is not part of the published document catalogue.</p>
          <Link href="/">Return to document library</Link>
        </div>
      </main>
    );
  }

  const breadcrumbs = getLibraryBreadcrumbs(path);
  const childFolders = folder.folders ?? [];
  const documents = folder.documents ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}><BookOpen size={19} /></span>
          <span>AcroReader</span>
        </Link>
        <Link className={styles.publicLabel} href="/reader">Open a PDF from device</Link>
      </header>

      <section className={styles.content}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href}>
              {index > 0 && <ChevronRight size={14} />}
              {index === breadcrumbs.length - 1
                ? <strong>{crumb.title}</strong>
                : <Link href={crumb.href}>{crumb.title}</Link>}
            </span>
          ))}
        </nav>

        <div className={styles.hero}>
          <span className={styles.eyebrow}>AVIATION DOCUMENT PORTAL</span>
          <h1>{folder.title}</h1>
          <p>{folder.description}</p>
          {path.length === 0 && <div className={styles.heroNote}><BookOpen size={16} /> Browse the aircraft family to find its published manuals.</div>}
        </div>

        {childFolders.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><h2>{path.length === 0 ? 'Aircraft families' : 'Folders'}</h2><p>Select a folder to continue.</p></div>
              <span>{childFolders.length} {childFolders.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div className={styles.folderGrid}>
              {childFolders.map((child) => (
                <FolderCard key={child.slug} folder={child} href={`/library/${[...path, child.slug].join('/')}`} />
              ))}
            </div>
          </section>
        )}

        {documents.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><h2>Published documents</h2><p>Choose a document to open it in AcroReader.</p></div>
              <span>{documents.length} documents</span>
            </div>
            <div className={styles.documentList}>
              {documents.map((document) => (
                <Link className={styles.documentRow} key={document.id} href={`/reader?url=${encodeURIComponent(document.fileUrl)}&title=${encodeURIComponent(document.title)}`}>
                  <span className={styles.pdfIcon}><FileText size={20} /></span>
                  <span className={styles.documentCopy}>
                    <strong>{document.title}</strong>
                    <small>Revision {document.revision} · Effective {document.effectiveDate}</small>
                  </span>
                  <span className={document.status === 'current' ? styles.currentStatus : styles.oldStatus}>
                    {document.status === 'current' ? 'Current' : 'Superseded'}
                  </span>
                  <ArrowRight size={18} />
                </a>
              ))}
            </div>
          </section>
        )}

        {childFolders.length === 0 && documents.length === 0 && (
          <div className={styles.emptyLibrary}>
            <span><Folder size={25} /></span>
            <h2>No documents published here yet</h2>
            <p>This folder is ready for published manuals. When documents are added to the catalogue, they will appear here for public access.</p>
            <Link href={breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].href : '/'}>Back to previous folder</Link>
          </div>
        )}

        <footer className={styles.footer}>
          <span>AcroReader</span>
          <span>Public access · Published documents only</span>
        </footer>
      </section>
    </main>
  );
}
