import {
  listAllAttachmentBlobs,
  saveAttachmentBlobs,
} from './decision-attachments';

const BACKUP_KIND = 'vsppro-app-backup';
// v2 thêm mảng `attachments` (PDF quyết định đính kèm) so với v1 chỉ có stores.
const BACKUP_VERSION = 2;
// Vẫn đọc được bản sao lưu cũ (v1) — chỉ thiếu phần PDF đính kèm.
const SUPPORTED_VERSIONS: readonly number[] = [1, 2];

const STORAGE_KEYS = [
  'vsppro-credit-plan',
  'vsppro-staff',
  'vsppro-txn-points',
] as const;

type StorageKey = (typeof STORAGE_KEYS)[number];

export interface AttachmentEntry {
  decisionId: string;
  mime: string;
  data: string; // base64 của blob PDF
}

export interface AppBackup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  stores: Partial<Record<StorageKey, string>>;
  attachments?: AttachmentEntry[];
}

export function hasBackupData(): boolean {
  return STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    // Chia nhỏ để không vượt giới hạn stack của String.fromCharCode với file lớn.
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  });
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/pdf' });
}

async function gzipText(text: string): Promise<Blob> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).blob();
}

/** Giải nén nếu là gzip (magic 1f 8b), ngược lại trả nguyên nội dung. */
async function decompressText(buf: ArrayBuffer): Promise<string> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head.length === 2 && head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const out = await new Response(stream).arrayBuffer();
    return new TextDecoder('utf-8').decode(out);
  }
  return new TextDecoder('utf-8').decode(buf);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke chậm để trình duyệt kịp đọc blob (bản sao lưu có thể khá lớn).
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadAppBackup(): Promise<void> {
  const stores: AppBackup['stores'] = {};
  for (const key of STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) stores[key] = value;
  }

  // Kèm toàn bộ PDF đính kèm quyết định (blob trong IndexedDB) vào bản sao lưu.
  const attachments: AttachmentEntry[] = [];
  const blobs = await listAllAttachmentBlobs();
  for (const { decisionId, blob } of blobs) {
    attachments.push({
      decisionId,
      mime: blob.type || 'application/pdf',
      data: await blobToBase64(blob),
    });
  }

  const backup: AppBackup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
  const date = backup.exportedAt.slice(0, 10).replaceAll('-', '');
  const gz = await gzipText(JSON.stringify(backup, null, 2));
  triggerDownload(gz, `VSPPRO-backup-${date}.json.gz`);
}

export async function readAppBackup(file: File): Promise<AppBackup> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.json') && !name.endsWith('.json.gz') && !name.endsWith('.gz')) {
    throw new Error('Vui lòng chọn tệp sao lưu VSPPRO (.json hoặc .json.gz).');
  }

  let parsed: unknown;
  try {
    const text = await decompressText(await file.arrayBuffer());
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.');
  }

  if (
    !isRecord(parsed) ||
    parsed.kind !== BACKUP_KIND ||
    typeof parsed.version !== 'number' ||
    !SUPPORTED_VERSIONS.includes(parsed.version)
  ) {
    throw new Error('Tệp không đúng định dạng sao lưu VSPPRO hoặc không tương thích.');
  }
  if (!isRecord(parsed.stores)) {
    throw new Error('Tệp sao lưu thiếu dữ liệu cần thiết.');
  }

  const stores: AppBackup['stores'] = {};
  for (const key of STORAGE_KEYS) {
    const value = parsed.stores[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new Error(`Dữ liệu ${key} trong tệp sao lưu không hợp lệ.`);
    }
    // Mỗi store của Zustand phải là JSON độc lập hợp lệ.
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Dữ liệu ${key} trong tệp sao lưu đã bị hỏng.`);
    }
    stores[key] = value;
  }

  let attachments: AttachmentEntry[] | undefined;
  if (parsed.attachments !== undefined) {
    if (!Array.isArray(parsed.attachments)) {
      throw new Error('Danh sách PDF đính kèm trong tệp sao lưu không hợp lệ.');
    }
    attachments = parsed.attachments.map((a, i) => {
      if (!isRecord(a) || typeof a.decisionId !== 'string' || typeof a.data !== 'string') {
        throw new Error(`PDF đính kèm thứ ${i + 1} trong tệp sao lưu không hợp lệ.`);
      }
      return {
        decisionId: a.decisionId,
        mime: typeof a.mime === 'string' ? a.mime : 'application/pdf',
        data: a.data,
      };
    });
  }

  return {
    kind: BACKUP_KIND,
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    stores,
    attachments,
  };
}

export async function restoreAppBackup(backup: AppBackup): Promise<void> {
  const previous = new Map<StorageKey, string | null>();
  for (const key of STORAGE_KEYS) previous.set(key, localStorage.getItem(key));
  const previousAttachments = await listAllAttachmentBlobs();

  // Giải mã PDF trước khi sửa localStorage để tệp sao lưu lỗi không làm dữ
  // liệu cấu hình rơi vào trạng thái đã đổi nhưng PDF chưa khôi phục.
  const attachmentEntries = (backup.attachments ?? []).map((a) => ({
    decisionId: a.decisionId,
    blob: base64ToBlob(a.data, a.mime),
  }));

  try {
    for (const key of STORAGE_KEYS) {
      const value = backup.stores[key];
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    // PDF đính kèm được thay toàn bộ để bản khôi phục không giữ sót file cũ.
    await saveAttachmentBlobs(attachmentEntries);
  } catch (error) {
    rollbackLocalStorage(previous);
    try {
      await saveAttachmentBlobs(previousAttachments);
    } catch {
      // Nếu rollback IndexedDB cũng lỗi, vẫn ném lỗi gốc để UI báo khôi phục
      // thất bại. localStorage đã được trả lại ở bước trên.
    }
    throw error;
  }
}

function rollbackLocalStorage(previous: Map<StorageKey, string | null>): void {
  for (const key of STORAGE_KEYS) {
    const value = previous.get(key);
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
