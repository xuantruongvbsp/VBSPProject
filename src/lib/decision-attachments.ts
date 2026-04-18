/**
 * IndexedDB-backed store cho file PDF đính kèm Quyết định.
 * Blob lưu trong IDB (sức chứa lớn), còn metadata (tên, size) lưu trong Zustand/localStorage.
 */

const DB_NAME = 'vsppro-credit-plan';
const STORE = 'decision-pdfs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveAttachmentBlob(decisionId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, decisionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAttachmentBlob(decisionId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(decisionId);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAttachmentBlob(decisionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(decisionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Mở PDF trong tab mới. Trả về URL tạo ra để caller có thể revoke sau. */
export async function openAttachmentInNewTab(decisionId: string): Promise<string | null> {
  const blob = await getAttachmentBlob(decisionId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // Revoke sau 60s — đủ cho trình duyệt tải blob. Không revoke ngay kẻo tab mới mất nguồn.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/** Tải file về máy với tên gốc. */
export async function downloadAttachment(decisionId: string, fileName: string): Promise<void> {
  const blob = await getAttachmentBlob(decisionId);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB
