import * as XLSX from 'xlsx';
import type { ActualSummary, ActualImportResult } from '../lib/credit-plan-types';

/**
 * Parse file thực tế (Báo cáo 31 — 260331.Actual.XLSX format).
 * Gộp theo maXa + maNguonVon + maChuongTrinh → tính tổng dư nợ.
 */
export async function parseActualFile(file: File): Promise<ActualImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  // Find header row (row containing "Mã xã")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row.some((c) => String(c).includes('Mã xã'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Không tìm thấy dòng tiêu đề (cần có cột "Mã xã")');

  const headers = rows[headerIdx].map((c) => String(c).trim());

  // Map column indices
  const col = (name: string) => headers.indexOf(name);
  const iMaXa = col('Mã xã');
  const iTenXa = col('Tên xã');
  const iNguonVon = col('Nguồn vốn');
  const iMaCT = col('Mã chương trình');
  const iTenCT = col('Tên chương trình');
  const iTongDuNo = col('Tổng dư nợ');
  const iDuNoTH = col('Dư nợ trong hạn');
  const iDuNoQH = col('Dư nợ quá hạn');
  const iDuNoKhoanh = col('Dư nợ khoanh');
  const iTongGN = col('Tổng giải ngân');
  const iNgaySL = col('Ngày số liệu');

  const iCapQLV = col('Cấp QL vốn');
  const iTenQD = col('Tên Quyết định');

  if (iMaXa === -1) throw new Error('Không tìm thấy cột "Mã xã"');

  // Aggregate by key
  const map = new Map<string, ActualSummary>();
  let totalRows = 0;
  let ngaySoLieu: string | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const maXa = String(row[iMaXa] ?? '').trim();
    if (!maXa) continue;

    totalRows++;
    let maNguonVon = String(row[iNguonVon] ?? '').trim();
    let maCT = String(row[iMaCT] ?? '').trim();
    const tenQD = iTenQD !== -1 ? String(row[iTenQD] ?? '').trim() : '';

    // Detect STEM: empty maCT + tenQD contains "STEM" → assign code STEM, NV=1
    if (!maCT && tenQD.toUpperCase().includes('STEM')) {
      maCT = 'STEM';
      if (!maNguonVon) maNguonVon = '1';
    }

    // Split CT=03 + NV=1 by Cấp QL vốn:
    //   03A = Ngân sách TW cấp (CapQLV is non-empty AND ≠ 21, e.g. 12/13/20)
    //   03B = NHCSXH huy động  (CapQLV = 21 OR empty/blank)
    if (maCT === '03' && maNguonVon === '1' && iCapQLV !== -1) {
      const capQLV = String(row[iCapQLV] ?? '').trim();
      maCT = (capQLV && capQLV !== '21') ? '03A' : '03B';
    }

    const key = `${maXa}|${maNguonVon}|${maCT}`;

    if (!ngaySoLieu && iNgaySL !== -1) {
      const v = row[iNgaySL];
      if (v) ngaySoLieu = String(v);
    }

    const existing = map.get(key);
    const num = (idx: number) => {
      if (idx === -1) return 0;
      const v = row[idx];
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    if (existing) {
      existing.tongDuNo += num(iTongDuNo);
      existing.duNoTrongHan += num(iDuNoTH);
      existing.duNoQuaHan += num(iDuNoQH);
      existing.duNoKhoanh += num(iDuNoKhoanh);
      existing.tongGiaiNgan += num(iTongGN);
      existing.soMonVay += 1;
    } else {
      let tenCT = String(row[iTenCT] ?? '').trim();
      // Override label for split/derived sub-programs
      if (maCT === '03A') tenCT = 'Cho vay GQVL — Ngân sách TW cấp';
      else if (maCT === '03B') tenCT = 'Cho vay GQVL — NHCSXH huy động';
      else if (maCT === 'STEM') tenCT = 'Cho vay HSSV các ngành học STEM';

      map.set(key, {
        maXa,
        tenXa: String(row[iTenXa] ?? '').trim(),
        maNguonVon,
        maChuongTrinh: maCT,
        tenChuongTrinh: tenCT,
        tongDuNo: num(iTongDuNo),
        duNoTrongHan: num(iDuNoTH),
        duNoQuaHan: num(iDuNoQH),
        duNoKhoanh: num(iDuNoKhoanh),
        tongGiaiNgan: num(iTongGN),
        soMonVay: 1,
      });
    }
  }

  return {
    summaries: Array.from(map.values()).sort(
      (a, b) => a.maXa.localeCompare(b.maXa) || a.maNguonVon.localeCompare(b.maNguonVon) || a.maChuongTrinh.localeCompare(b.maChuongTrinh)
    ),
    ngaySoLieu,
    totalRows,
  };
}
