import * as XLSX from 'xlsx';
import type {
  ActualSummary,
  ActualImportResult,
  BucketLoanDetail,
  Nq11ImportResult,
  Nq11XaSummary,
  Nq11MatchXa,
} from '../lib/credit-plan-types';

/**
 * Parse file thực tế (Báo cáo 31 — 260331.Actual.XLSX format).
 * Gộp theo maXa + maNguonVon + maChuongTrinh → tính tổng dư nợ.
 *
 * @param file        file Excel
 * @param nq11Ids     (tuỳ chọn) set các Mã món vay NQ11 — nếu có, parser
 *                    sẽ đồng thời tính kết quả match theo xã (Nq11MatchXa)
 */
export async function parseActualFile(
  file: File,
  nq11Ids?: Set<string>
): Promise<ActualImportResult> {
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

  const rawHeaders = rows[headerIdx].map((c) => String(c).trim());
  // Normalized headers cho matching: lowercase + collapse whitespace.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const headers = rawHeaders.map(norm);

  // Map column indices — so sánh theo chuỗi normalized.
  const col = (name: string) => headers.indexOf(norm(name));
  const colAny = (names: string[]) => {
    for (const n of names) {
      const i = col(n);
      if (i !== -1) return i;
    }
    return -1;
  };
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
  const iMaNhaDauTu = colAny([
    'Mã nhà đầu tư',
    'Mã Nhà Đầu Tư',
    'Mã NĐT',
    'Mã nha dau tu',
    'Ma nha dau tu',
    'Nhà đầu tư',
  ]);
  const iTenQD = col('Tên Quyết định');
  const iMaMonVay = col('Mã món vay');
  const iSoKheUoc = col('Số khế ước');
  const iMonId = iMaMonVay !== -1 ? iMaMonVay : iSoKheUoc;
  // Các cột nhận dạng "dòng chi tiết" (1 món vay) — dùng để loại dòng Cộng/tổng.
  const iMaKH = col('Mã KH');
  const iTenKH = col('Tên KH');
  // Yêu cầu: dòng chi tiết phải có giá trị ở ít nhất 1 cột dưới đây.
  // Subtotal/cộng thường bỏ trống tất cả.
  const detailIdCols: { name: string; idx: number }[] = [
    { name: 'Số khế ước', idx: iSoKheUoc },
    { name: 'Mã món vay', idx: iMaMonVay },
    { name: 'Mã KH', idx: iMaKH },
    { name: 'Tên KH', idx: iTenKH },
  ].filter((c) => c.idx !== -1);

  if (iMaXa === -1) throw new Error('Không tìm thấy cột "Mã xã"');

  // Aggregate by key
  const map = new Map<string, ActualSummary>();
  const loanDetailsByBucket: Record<string, BucketLoanDetail[]> = {};
  let totalRows = 0;
  let scannedRows = 0;
  let skippedRows = 0;
  let duplicateLoanIds = 0;
  let gqvlXaReclassified = 0; // Số dòng CT=03 NV=2 được định lại NV=3 theo Mã NĐT
  const seenLoanIds = new Set<string>();
  let ngaySoLieu: string | null = null;

  // Match NQ11 theo xã (nếu cung cấp nq11Ids)
  const nq11MatchMap = new Map<string, {
    tenXa: string;
    matchedTongDuNo: number;
    matchedSoMon: number;
    matchedIds: Set<string>;
  }>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const maXa = String(row[iMaXa] ?? '').trim();
    if (!maXa) continue;
    scannedRows++;

    // Bỏ qua dòng cộng/tổng — yêu cầu ít nhất 1 cột nhận dạng có giá trị.
    // Subtotal thường bỏ trống Số khế ước / Mã món vay / Mã KH / Tên KH.
    if (detailIdCols.length > 0) {
      const hasDetailId = detailIdCols.some(
        (c) => String(row[c.idx] ?? '').trim() !== ''
      );
      if (!hasDetailId) {
        skippedRows++;
        continue;
      }
    }

    // Dedup theo Số khế ước / Mã món vay — file có thể lặp lại 1 món nhiều dòng
    // (phân kỳ, lãi suất, …), "Tổng dư nợ" trên mỗi dòng sẽ bằng số dư hiện tại
    // của loan → cộng hết sẽ nhân đôi/ba. Chỉ tính 1 lần cho mỗi loan.
    if (iMonId !== -1) {
      const loanId = String(row[iMonId] ?? '').trim();
      if (loanId) {
        if (seenLoanIds.has(loanId)) {
          duplicateLoanIds++;
          continue; // bỏ qua dòng trùng
        }
        seenLoanIds.add(loanId);
      }
    }

    totalRows++;
    let maNguonVon = String(row[iNguonVon] ?? '').trim();
    let maCT = String(row[iMaCT] ?? '').trim();
    const tenQD = iTenQD !== -1 ? String(row[iTenQD] ?? '').trim() : '';

    // Detect STEM theo "Tên Quyết định" chứa "STEM" — override maCT bất kể.
    // Báo cáo 31: dòng STEM dùng chung mã 02 với HSSV thường, chỉ phân biệt bằng Tên QĐ
    // ("Cho vay HSSV STEM") → ép sang mã 'STEM' để tách bucket.
    if (tenQD.toUpperCase().includes('STEM')) {
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

    // Split CT=03 + NV=2 by Mã nhà đầu tư:
    //   Nhà đầu tư tỉnh (INV0802140002662, INV0603170027393) → giữ NV=2 ("Cho vay GQVL ĐP tỉnh")
    //   Nhà đầu tư còn lại → chuyển NV=3 ("Cho vay GQVL xã {tenXa}")
    if (maCT === '03' && maNguonVon === '2' && iMaNhaDauTu !== -1) {
      const ndt = String(row[iMaNhaDauTu] ?? '').trim();
      if (ndt !== 'INV0802140002662' && ndt !== 'INV0603170027393') {
        maNguonVon = '3';
        gqvlXaReclassified++;
      }
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

    // NQ11 match: nếu có Mã món vay và id trong set nq11Ids → cộng dồn theo xã
    if (nq11Ids && nq11Ids.size > 0 && iMonId !== -1) {
      const monId = String(row[iMonId] ?? '').trim();
      if (monId && nq11Ids.has(monId)) {
        const tenXa = String(row[iTenXa] ?? '').trim();
        let m = nq11MatchMap.get(maXa);
        if (!m) {
          m = { tenXa, matchedTongDuNo: 0, matchedSoMon: 0, matchedIds: new Set() };
          nq11MatchMap.set(maXa, m);
        }
        if (!m.matchedIds.has(monId)) {
          m.matchedIds.add(monId);
          m.matchedTongDuNo += num(iTongDuNo);
          m.matchedSoMon += 1;
        }
      }
    }

    // Ghi chi tiết món vay vào bucket (để export/inspect sau này).
    const loanDetail: BucketLoanDetail = {
      maMonVay: iMaMonVay !== -1 ? String(row[iMaMonVay] ?? '').trim() : '',
      soKheUoc: iSoKheUoc !== -1 ? String(row[iSoKheUoc] ?? '').trim() : '',
      maKH: iMaKH !== -1 ? String(row[iMaKH] ?? '').trim() : '',
      tenKH: iTenKH !== -1 ? String(row[iTenKH] ?? '').trim() : '',
      tongDuNo: num(iTongDuNo),
      duNoTrongHan: num(iDuNoTH),
      duNoQuaHan: num(iDuNoQH),
      duNoKhoanh: num(iDuNoKhoanh),
    };
    if (!loanDetailsByBucket[key]) loanDetailsByBucket[key] = [];
    loanDetailsByBucket[key].push(loanDetail);

    if (existing) {
      existing.tongDuNo += num(iTongDuNo);
      existing.duNoTrongHan += num(iDuNoTH);
      existing.duNoQuaHan += num(iDuNoQH);
      existing.duNoKhoanh += num(iDuNoKhoanh);
      existing.tongGiaiNgan += num(iTongGN);
      existing.soMonVay += 1;
    } else {
      const tenXa = String(row[iTenXa] ?? '').trim();
      let tenCT = String(row[iTenCT] ?? '').trim();
      // Override label for split/derived sub-programs
      if (maCT === '03A') tenCT = 'Cho vay GQVL — Ngân sách TW cấp';
      else if (maCT === '03B') tenCT = 'Cho vay GQVL — NHCSXH huy động';
      else if (maCT === 'STEM') tenCT = 'Cho vay HSSV các ngành học STEM';
      else if (maCT === '03' && maNguonVon === '2') tenCT = 'Cho vay GQVL ĐP tỉnh';
      else if (maCT === '03' && maNguonVon === '3') tenCT = `Cho vay GQVL xã ${tenXa}`;

      map.set(key, {
        maXa,
        tenXa,
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

  let nq11MatchByXa: Nq11MatchXa[] | undefined;
  if (nq11Ids && nq11Ids.size > 0) {
    nq11MatchByXa = [];
    // Build per-xa stats. "missingSoMon" cần biết tổng số món NQ11 ở xã đó —
    // nhưng ở đây chỉ tính được phần matched. Việc trừ ra "thiếu" sẽ diễn ra ở store.
    for (const [maXa, m] of nq11MatchMap) {
      nq11MatchByXa.push({
        maXa,
        tenXa: m.tenXa,
        matchedTongDuNo: m.matchedTongDuNo,
        matchedSoMon: m.matchedSoMon,
        missingSoMon: 0,
      });
    }
    nq11MatchByXa.sort((a, b) => a.maXa.localeCompare(b.maXa));
  }

  return {
    summaries: Array.from(map.values()).sort(
      (a, b) => a.maXa.localeCompare(b.maXa) || a.maNguonVon.localeCompare(b.maNguonVon) || a.maChuongTrinh.localeCompare(b.maChuongTrinh)
    ),
    ngaySoLieu,
    totalRows,
    nq11MatchByXa,
    scannedRows,
    skippedRows,
    detectedIdCols: detailIdCols.map((c) => c.name),
    duplicateLoanIds,
    hasInvestorCol: iMaNhaDauTu !== -1,
    gqvlXaReclassified,
    loanDetailsByBucket,
  };
}

/**
 * Parse file "Sao kê dư nợ món vay GQVL" (SK_GQVL_*.xlsx).
 * Đây là danh sách các món vay GQVL bị đánh dấu NQ11 (không được cho vay quay vòng).
 * Mỗi dòng = 1 món vay. Gộp theo maXa, đồng thời split theo Cấp QLV:
 *   CAPQLV = 21  → phần 03B (NHCSXH huy động) sẽ bị trừ
 *   CAPQLV ≠ 21  → phần 03A (Ngân sách TW cấp) sẽ bị trừ
 * Trả về kèm danh sách Mã món vay (để match với Báo cáo 31 chi tiết nếu cần).
 */
export async function parseNq11File(file: File): Promise<Nq11ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Tìm dòng tiêu đề — dòng có chứa "Mã món vay"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (row.some((c) => norm(c) === 'mã món vay')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Không tìm thấy dòng tiêu đề (cần có cột "Mã món vay")');

  const headers = rows[headerIdx].map((c) => norm(c));
  const col = (name: string) => headers.indexOf(norm(name));

  const iMaXa = col('Mã xã');
  const iTenXa = col('Tên xã');
  const iMaMonVay = col('Mã món vay');
  const iDuNoTH = col('Dư nợ trong hạn');
  const iDuNoQH = col('Dư nợ quá hạn');
  const iDuNoKhoanh = col('Dư nợ khoanh');
  const iTongGN = col('Tổng giải ngân');
  const iCapQLV = col('Mã CAPQLV');
  // "Ngày dd tháng mm năm yyyy" thường nằm trong 1 ô phía trên header
  let ngaySoLieu: string | null = null;
  for (let i = 0; i < headerIdx; i++) {
    for (const c of rows[i]) {
      const s = String(c ?? '').trim();
      const m = s.match(/Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        ngaySoLieu = `${dd}/${mm}/${m[3]}`;
        break;
      }
    }
    if (ngaySoLieu) break;
  }

  if (iMaXa === -1 || iMaMonVay === -1) {
    throw new Error('File SK_GQVL thiếu cột "Mã xã" hoặc "Mã món vay"');
  }

  const map = new Map<string, Nq11XaSummary>();
  const monVayIds: string[] = [];
  let totalRows = 0;

  const num = (row: unknown[], idx: number): number => {
    if (idx === -1) return 0;
    const v = row[idx];
    if (typeof v === 'number') return v;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    let maXa = String(row[iMaXa] ?? '').trim();
    const maMonVay = String(row[iMaMonVay] ?? '').trim();
    if (!maXa || !maMonVay) continue;

    // Normalize maXa: SK_GQVL dùng mã 2 số ("25", "44"...),
    // Báo cáo 31 / XA_LIST dùng mã 6 số ("460025", "460044"...).
    // Nếu maXa chỉ còn số (≤ 3 ký tự), tự động ghép prefix "4600".
    if (/^\d{1,3}$/.test(maXa)) {
      maXa = '4600' + maXa.padStart(2, '0');
    }

    totalRows++;
    monVayIds.push(maMonVay);

    const capQLV = iCapQLV !== -1 ? String(row[iCapQLV] ?? '').trim() : '';
    const bucket03B = capQLV === '21';

    const th = num(row, iDuNoTH);
    const qh = num(row, iDuNoQH);
    const kh = num(row, iDuNoKhoanh);
    const gn = num(row, iTongGN);
    const total = th + qh + kh;

    let s = map.get(maXa);
    if (!s) {
      s = {
        maXa,
        tenXa: String(row[iTenXa] ?? '').trim(),
        tongDuNo: 0,
        duNoTrongHan: 0,
        duNoQuaHan: 0,
        duNoKhoanh: 0,
        tongGiaiNgan: 0,
        soMonVay: 0,
        from03A_tongDuNo: 0,
        from03A_duNoTrongHan: 0,
        from03A_duNoQuaHan: 0,
        from03A_duNoKhoanh: 0,
        from03A_tongGiaiNgan: 0,
        from03A_soMonVay: 0,
        from03B_tongDuNo: 0,
        from03B_duNoTrongHan: 0,
        from03B_duNoQuaHan: 0,
        from03B_duNoKhoanh: 0,
        from03B_tongGiaiNgan: 0,
        from03B_soMonVay: 0,
        monVayIds: [],
      };
      map.set(maXa, s);
    }

    s.monVayIds.push(maMonVay);
    s.tongDuNo += total;
    s.duNoTrongHan += th;
    s.duNoQuaHan += qh;
    s.duNoKhoanh += kh;
    s.tongGiaiNgan += gn;
    s.soMonVay += 1;

    if (bucket03B) {
      s.from03B_tongDuNo += total;
      s.from03B_duNoTrongHan += th;
      s.from03B_duNoQuaHan += qh;
      s.from03B_duNoKhoanh += kh;
      s.from03B_tongGiaiNgan += gn;
      s.from03B_soMonVay += 1;
    } else {
      s.from03A_tongDuNo += total;
      s.from03A_duNoTrongHan += th;
      s.from03A_duNoQuaHan += qh;
      s.from03A_duNoKhoanh += kh;
      s.from03A_tongGiaiNgan += gn;
      s.from03A_soMonVay += 1;
    }
  }

  return {
    summariesByXa: Array.from(map.values()).sort((a, b) => a.maXa.localeCompare(b.maXa)),
    monVayIds,
    ngaySoLieu,
    totalRows,
  };
}

/**
 * Merge NQ11 vào danh sách `ActualSummary` đã có:
 *   - Trừ `from03A_*` ra khỏi bucket (xã, NV=1, 03A)
 *   - Trừ `from03B_*` ra khỏi bucket (xã, NV=1, 03B)
 *   - Thêm bucket mới (xã, NV=1, 03N) = tổng NQ11 của xã
 * Nếu bucket bị trừ không tồn tại, vẫn tạo bucket 03N mới (nhưng không trừ âm).
 */
export function mergeNq11IntoActuals(
  actuals: ActualSummary[],
  nq11: Nq11XaSummary[]
): ActualSummary[] {
  if (!nq11.length) return actuals;

  const key = (maXa: string, nv: string, ct: string) => `${maXa}|${nv}|${ct}`;
  const map = new Map<string, ActualSummary>();
  for (const a of actuals) {
    map.set(key(a.maXa, a.maNguonVon, a.maChuongTrinh), { ...a });
  }

  for (const s of nq11) {
    const k03A = key(s.maXa, '1', '03A');
    const k03B = key(s.maXa, '1', '03B');
    const a = map.get(k03A);
    if (a) {
      a.tongDuNo = Math.max(0, a.tongDuNo - s.from03A_tongDuNo);
      a.duNoTrongHan = Math.max(0, a.duNoTrongHan - s.from03A_duNoTrongHan);
      a.duNoQuaHan = Math.max(0, a.duNoQuaHan - s.from03A_duNoQuaHan);
      a.duNoKhoanh = Math.max(0, a.duNoKhoanh - s.from03A_duNoKhoanh);
      a.tongGiaiNgan = Math.max(0, a.tongGiaiNgan - s.from03A_tongGiaiNgan);
      a.soMonVay = Math.max(0, a.soMonVay - s.from03A_soMonVay);
    }
    const b = map.get(k03B);
    if (b) {
      b.tongDuNo = Math.max(0, b.tongDuNo - s.from03B_tongDuNo);
      b.duNoTrongHan = Math.max(0, b.duNoTrongHan - s.from03B_duNoTrongHan);
      b.duNoQuaHan = Math.max(0, b.duNoQuaHan - s.from03B_duNoQuaHan);
      b.duNoKhoanh = Math.max(0, b.duNoKhoanh - s.from03B_duNoKhoanh);
      b.tongGiaiNgan = Math.max(0, b.tongGiaiNgan - s.from03B_tongGiaiNgan);
      b.soMonVay = Math.max(0, b.soMonVay - s.from03B_soMonVay);
    }

    map.set(key(s.maXa, '1', '03N'), {
      maXa: s.maXa,
      tenXa: s.tenXa,
      maNguonVon: '1',
      maChuongTrinh: '03N',
      tenChuongTrinh: 'Cho vay GQVL — NQ11',
      tongDuNo: s.tongDuNo,
      duNoTrongHan: s.duNoTrongHan,
      duNoQuaHan: s.duNoQuaHan,
      duNoKhoanh: s.duNoKhoanh,
      soMonVay: s.soMonVay,
      tongGiaiNgan: s.tongGiaiNgan,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      a.maXa.localeCompare(b.maXa) ||
      a.maNguonVon.localeCompare(b.maNguonVon) ||
      a.maChuongTrinh.localeCompare(b.maChuongTrinh)
  );
}
