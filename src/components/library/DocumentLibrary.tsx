import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, ChevronRight, FileText, Folder, Plane, Upload, Wrench } from 'lucide-react';
import logo from '@/images/Logo Final.jpeg';
import {
  findLibraryFolder,
  getLibraryBreadcrumbs,
  type LibraryFolder,
} from '@/data/documentLibrary';
import styles from './DocumentLibrary.module.scss';
import { getDocumentLibrary } from '@/lib/server/getDocumentLibrary';

type Props = { path?: string[] };

function FolderIcon({ title }: { title: string }) {
  if (title === 'Flight Operations') return <BookOpen size={23} />;
  if (title === 'Maintenance') return <Wrench size={23} />;
  if (title.startsWith('DASH')) return <Plane size={24} />;
  return <Folder size={23} />;
}

function FolderCard({ folder, href, index }: { folder: LibraryFolder; href: string; index: number }) {
  const count = folder.folders?.length ?? folder.documents?.length ?? 0;
  const countLabel = folder.folders
    ? `${count} ${count === 1 ? 'folder' : 'folders'}`
    : `${count} ${count === 1 ? 'document' : 'documents'}`;

  return (
    <Link className={styles.folderCard} href={href}>
      <span className={styles.folderCardTop}>
        <span className={styles.folderIcon}><FolderIcon title={folder.title} /></span>
        <span className={styles.folderIndex}>{String(index + 1).padStart(2, '0')}</span>
      </span>
      <span className={styles.folderCopy}>
        <strong>{folder.title}</strong>
        <small>{folder.description ?? 'Browse documents in this folder.'}</small>
      </span>
      <span className={styles.folderCardBottom}>
        <em>{count ? countLabel : 'Explore folder'}</em>
        <span className={styles.cardArrow}><ArrowRight size={17} /></span>
      </span>
    </Link>
  );
}

export default async function DocumentLibrary({ path = [] }: Props) {
  const library = await getDocumentLibrary();
  const folder = findLibraryFolder(path, library);
  if (!folder) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <FileText size={32} />
          <h1>Folder not found</h1>
          <p>This location may have moved or is not part of the published document catalogue.</p>
          <Link href="/">Return to document library</Link>
        </div>
      </main>
    );
  }

  const breadcrumbs = getLibraryBreadcrumbs(path, library);
  const childFolders = folder.folders ?? [];
  const documents = folder.documents ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="AcroReader home">
            <Image src={logo} alt="Leading Edge Aviation Limited" className={styles.brandLogo} priority />
          </Link>
          <Link className={styles.primaryAction} href="/reader">
            <Upload size={18} />
            <span>Open PDF from device</span>
            <ArrowRight size={17} className={styles.actionArrow} />
          </Link>
        </div>
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

        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}><span /> AVIATION DOCUMENT PORTAL</span>
            <h1>{path.length === 0 ? 'Your aviation library.' : folder.title}{path.length === 0 && <><br /><span>Clear, current, accessible.</span></>}</h1>
            <p>{folder.description}</p>
            {path.length === 0 && (
              <div className={styles.heroActions}>
                <a className={styles.heroPrimary} href="#aircraft-library">Explore aircraft library <ArrowRight size={18} /></a>
                <span className={styles.heroHint}><BookOpen size={15} /> Browse published manuals without signing in</span>
              </div>
            )}
          </div>
          <div className={styles.heroArtwork} aria-hidden="true">
            <div className={styles.artCircle} />
            <div className={styles.artRing} />
            <Plane className={styles.artPlane} size={104} strokeWidth={0.8} />
            <span className={styles.artLabel}>DOCUMENTS<br />AT YOUR FINGERTIPS</span>
          </div>
          <div className={styles.heroGlow} />
        </section>

        {childFolders.length > 0 && (
          <section className={styles.section} id="aircraft-library">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionEyebrow}>{path.length === 0 ? 'BROWSE THE LIBRARY' : 'DOCUMENT CATEGORIES'}</span>
                <h2>{path.length === 0 ? 'Aircraft families' : 'Explore folders'}</h2>
                <p>{path.length === 0 ? 'Choose an aircraft family to view its available documentation.' : 'Select a category to continue to the manuals.'}</p>
              </div>
              <span className={styles.itemCount}>{String(childFolders.length).padStart(2, '0')} <small>{childFolders.length === 1 ? 'ITEM' : 'ITEMS'}</small></span>
            </div>
            <div className={styles.folderGrid}>
              {childFolders.map((child, index) => (
                <FolderCard key={child.slug} folder={child} index={index} href={`/library/${[...path, child.slug].join('/')}`} />
              ))}
            </div>
          </section>
        )}

        {documents.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionEyebrow}>AVAILABLE ONLINE</span>
                <h2>Published documents</h2>
                <p>Open a document directly in the interactive AcroReader.</p>
              </div>
              <span className={styles.itemCount}>{String(documents.length).padStart(2, '0')} <small>{documents.length === 1 ? 'FILE' : 'FILES'}</small></span>
            </div>
            <div className={styles.documentList}>
              {documents.map((document) => (
                <Link className={styles.documentRow} key={document.id} href={`/reader?url=${encodeURIComponent(document.fileUrl)}&title=${encodeURIComponent(document.title)}`}>
                  <span className={styles.pdfIcon}><FileText size={21} /></span>
                  <span className={styles.documentCopy}>
                    <strong>{document.title}</strong>
                    <small>Revision {document.revision} <span>·</span> Effective {document.effectiveDate}</small>
                  </span>
                  <span className={document.status === 'current' ? styles.currentStatus : styles.oldStatus}>
                    <i />{document.status === 'current' ? 'Current' : 'Superseded'}
                  </span>
                  <span className={styles.documentArrow}><ArrowRight size={18} /></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {childFolders.length === 0 && documents.length === 0 && (
          <div className={styles.emptyLibrary}>
            <span className={styles.emptyIcon}><Folder size={27} /></span>
            <span className={styles.sectionEyebrow}>NOTHING PUBLISHED YET</span>
            <h2>No documents published here yet</h2>
            <p>This folder is ready for published manuals. When documents are added to the catalogue, they will appear here for public access.</p>
            <Link href={breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].href : '/'}>Back to previous folder <ArrowRight size={16} /></Link>
          </div>
        )}

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} AcroReader</span>
          <span>Public access <i /> Published documents</span>
        </footer>
      </section>
    </main>
  );
}
