export interface PDFOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items: PDFOutlineItem[];
}

export interface PDFDocumentInfo {
  name: string;
  numPages: number;
}
