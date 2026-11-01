export type RecentDocument = {
  id: string;
  name: string;
  size: number;
  lastOpened: number;
};

type StoredDocument = RecentDocument & { blob: Blob };

const DB_NAME = 'acroreader-library';
const STORE_NAME = 'documents';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastOpened', 'lastOpened');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecentDocument(file: File): Promise<RecentDocument[]> {
  const db = await openDatabase();
  const record: StoredDocument = {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    lastOpened: Date.now(),
    blob: file,
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  return listRecentDocuments();
}

export async function listRecentDocuments(): Promise<RecentDocument[]> {
  const db = await openDatabase();
  const records = await new Promise<StoredDocument[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredDocument[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, 12)
    .map(({ id, name, size, lastOpened }) => ({ id, name, size, lastOpened }));
}

export async function getRecentDocument(id: string): Promise<File | null> {
  const db = await openDatabase();
  const record = await new Promise<StoredDocument | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!record) return null;
  return new File([record.blob], record.name, { type: 'application/pdf', lastModified: record.lastOpened });
}


export async function deleteRecentDocument(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}

export async function clearRecentDocuments(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  db.close();
}
