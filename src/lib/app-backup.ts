const BACKUP_KIND = 'vsppro-app-backup';
const BACKUP_VERSION = 1;

const STORAGE_KEYS = [
  'vsppro-credit-plan',
  'vsppro-staff',
  'vsppro-txn-points',
] as const;

type StorageKey = (typeof STORAGE_KEYS)[number];

export interface AppBackup {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  stores: Partial<Record<StorageKey, string>>;
}

export function hasBackupData(): boolean {
  return STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
}

export function downloadAppBackup(): void {
  const stores: AppBackup['stores'] = {};
  for (const key of STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) stores[key] = value;
  }

  const backup: AppBackup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
  const date = backup.exportedAt.slice(0, 10).replaceAll('-', '');
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `VSPPRO-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readAppBackup(file: File): Promise<AppBackup> {
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error('Vui lòng chọn tệp sao lưu .json của VSPPRO.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.');
  }

  if (!isRecord(parsed) || parsed.kind !== BACKUP_KIND || parsed.version !== BACKUP_VERSION) {
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

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    stores,
  };
}

export function restoreAppBackup(backup: AppBackup): void {
  const previous = new Map<StorageKey, string | null>();
  for (const key of STORAGE_KEYS) previous.set(key, localStorage.getItem(key));

  try {
    for (const key of STORAGE_KEYS) {
      const value = backup.stores[key];
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const key of STORAGE_KEYS) {
      const value = previous.get(key);
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
