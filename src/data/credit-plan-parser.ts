import * as XLSX from 'xlsx';
import type {
  ActualSummary,
  ActualImportResult,
  BucketLoanDetail,
  Nq11ImportResult,
  Nq11XaSummary,
  Nq11MatchXa,
  Nq11NoxhImportResult,
  Nq11NoxhXaSummary,
} from '../lib/credit-plan-types';

/**
 * Parse file thực tế (Báo cáo 31 — 260331.Actual.XLSX format).
 * Gộp theo maXa + maNguonVon + maChuongTrinh → tính tổng dư nợ.
 *
 * @param file           file Excel
 * @param nq11Ids        (tuỳ chọn) set các Mã món vay NQ11 GQVL — nếu có, parser
 *                       sẽ đồng thời tính kết quả match theo xã (Nq11MatchXa).
 *                       Lưu ý: GQVL-NQ11 vẫn split bằng post-merge (mergeNq11IntoActuals)
 *                       vì cần phân biệt nguồn 03A/03B; bộ này chỉ dùng cho stats.
 * @param gqvlXaNdtSet   (tuỳ chọn) whitelist các Mã nhà đầu tư thuộc QĐ GQVL xã.
 *                       Dòng CT=03 có Mã NĐT thuộc set này sẽ được chuyển NV sang '3'
 *                       (Địa phương xã). Danh sách lấy từ Decisions NV=3 có maNhaDauTu.
 * @param nq11NoxhIds    (tuỳ chọn) set các Số khế ước NOXH-NQ11. Dòng CT=12 có Số
 *                       khế ước thuộc set này sẽ được tách thẳng sang CT='12N'
 *                       ("Cho vay NOXH — NQ11") ngay tại lúc parse — giống cơ chế
 *                       split 03A/03B theo Cấp QLV. Plan có thể nhập riêng cho 12 và 12N.
 */
export async function parseActualFile(
  file: File,
  nq11Ids?: Set<string>,
  gqvlXaNdtSet?: Set<string>,
  nq11NoxhIds?: Set<string>
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

    // Split CT=12 (NOXH) sang 12N nếu Số khế ước thuộc danh sách NOXH-NQ11.
    // Cơ chế giống 03A/03B: tách thẳng tại parse, plan nhập độc lập cho 12 / 12N.
    // NOXH-NQ11 file (BCQUERY) match bằng "Số khế ước" — KHÔNG dùng iMonId
    // (vì iMonId ưu tiên "Mã món vay" → không khớp với set Số khế ước).
    if (maCT === '12' && nq11NoxhIds && nq11NoxhIds.size > 0 && iSoKheUoc !== -1) {
      const sku = String(row[iSoKheUoc] ?? '').trim();
      if (sku && nq11NoxhIds.has(sku)) {
        maCT = '12N';
      }
    }

    // Reclassify CT=03 sang NV=3 ("Cho vay GQVL xã") theo whitelist Mã NĐT:
    //   Whitelist lấy từ Decisions NV=3 có maNhaDauTu (cấu hình ở màn Quyết định).
    //   Dòng nào có Mã NĐT thuộc whitelist → chuyển NV sang '3' (bất kể NV gốc).
    //   Các dòng không match whitelist → giữ nguyên NV gốc (NV=2 sẽ đi vào "GQVL ĐP tỉnh").
    if (maCT === '03' && iMaNhaDauTu !== -1 && gqvlXaNdtSet && gqvlXaNdtSet.size > 0) {
      const ndt = String(row[iMaNhaDauTu] ?? '').trim();
      if (ndt && gqvlXaNdtSet.has(ndt) && maNguonVon !== '3') {
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
      else if (maCT === '12N') tenCT = 'Cho vay NOXH — NQ11';

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

/**
 * Parse file "Sao kê khế ước theo chương trình & PNKT" cho danh sách NOXH NQ11
 * (BCQUERY format — VD: NOXH.XLSX). Đặc trưng:
 *   - Dòng 1: tiêu đề báo cáo, dòng 2: header
 *   - Loan id = "Số khế ước"
 *   - Số tiền: "Số tiền giải ngân", "Nợ trong hạn", "Nợ quá hạn", "Nợ khoanh"
 *   - "Nguồn vốn" là chuỗi text (TW / ĐP / ĐP xã) → cần map về '1'/'2'/'3'
 *   - "Mã chương trình" = '12' cho mọi dòng (NOXH); cảnh báo nếu khác
 *   - "Ngày báo cáo" dạng dd/mm/yyyy ở mỗi dòng → dùng giá trị đầu tiên
 * Mọi dòng trong file đều coi là NQ11 (không có cờ riêng).
 */
export async function parseNq11NoxhFile(file: File): Promise<Nq11NoxhImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Tìm dòng tiêu đề — dòng có chứa "Số khế ước" và "Mã xã"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    const hasSoKU = row.some((c) => norm(c) === 'số khế ước');
    const hasMaXa = row.some((c) => norm(c) === 'mã xã');
    if (hasSoKU && hasMaXa) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('File NOXH-NQ11 thiếu dòng tiêu đề (cần có cột "Mã xã" và "Số khế ước")');
  }

  const headers = rows[headerIdx].map((c) => norm(c));
  const col = (name: string) => headers.indexOf(norm(name));

  const iMaXa = col('Mã xã');
  const iTenXa = col('Tên xã');
  const iSoKU = col('Số khế ước');
  const iMaCT = col('Mã chương trình');
  const iNguonVon = col('Nguồn vốn');
  const iSoTienGN = col('Số tiền giải ngân');
  const iNoTH = col('Nợ trong hạn');
  const iNoQH = col('Nợ quá hạn');
  const iNoKhoanh = col('Nợ khoanh');
  const iNgayBC = col('Ngày báo cáo');

  if (iMaXa === -1 || iSoKU === -1) {
    throw new Error('File NOXH-NQ11 thiếu cột "Mã xã" hoặc "Số khế ước"');
  }

  // Map "Nguồn vốn" text → mã NV chuẩn của hệ thống.
  const mapNV = (raw: string): string => {
    const v = raw.trim().toUpperCase();
    if (!v) return '1';
    if (v === 'TW' || v.includes('TRUNG ƯƠNG') || v.includes('TRUNG UONG')) return '1';
    if (v === 'ĐP XÃ' || v === 'DP XA' || v.includes('XÃ')) return '3';
    if (v === 'ĐP' || v === 'DP' || v.includes('ĐỊA PHƯƠNG') || v.includes('DIA PHUONG')) return '2';
    return v; // giữ nguyên nếu đã là '1'/'2'/'3'
  };

  const map = new Map<string, Nq11NoxhXaSummary>();
  const allMonVayIds: string[] = [];
  const seenLoanIds = new Set<string>();
  let totalRows = 0;
  let ngaySoLieu: string | null = null;

  const num = (row: unknown[], idx: number): number => {
    if (idx === -1) return 0;
    const v = row[idx];
    if (typeof v === 'number') return v;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const maXa = String(row[iMaXa] ?? '').trim();
    const soKU = String(row[iSoKU] ?? '').trim();
    if (!maXa || !soKU) continue; // bỏ dòng cộng/tổng (trống Mã xã hoặc Số khế ước)

    // Dedup theo Số khế ước
    if (seenLoanIds.has(soKU)) continue;
    seenLoanIds.add(soKU);

    // Cảnh báo nhẹ: nếu có cột "Mã chương trình" mà ≠ '12' → vẫn xử lý nhưng người
    // dùng nên dùng đúng file NOXH. (Không throw để tránh chặn import; UI có thể hiển
    // thị diagnostic sau này nếu cần.)
    if (iMaCT !== -1) {
      const ct = String(row[iMaCT] ?? '').trim();
      if (ct && ct !== '12') {
        // Không throw — chỉ skip nhẹ để bucket 12 không bị méo.
        continue;
      }
    }

    totalRows++;
    allMonVayIds.push(soKU);

    if (!ngaySoLieu && iNgayBC !== -1) {
      const v = row[iNgayBC];
      if (v) ngaySoLieu = String(v).trim();
    }

    const nv = mapNV(iNguonVon !== -1 ? String(row[iNguonVon] ?? '') : '');
    const key = `${maXa}|${nv}`;

    const th = num(row, iNoTH);
    const qh = num(row, iNoQH);
    const kh = num(row, iNoKhoanh);
    const gn = num(row, iSoTienGN);
    const total = th + qh + kh;

    let s = map.get(key);
    if (!s) {
      s = {
        maXa,
        tenXa: iTenXa !== -1 ? String(row[iTenXa] ?? '').trim() : '',
        maNguonVon: nv,
        tongDuNo: 0,
        duNoTrongHan: 0,
        duNoQuaHan: 0,
        duNoKhoanh: 0,
        tongGiaiNgan: 0,
        soMonVay: 0,
        monVayIds: [],
      };
      map.set(key, s);
    }

    s.tongDuNo += total;
    s.duNoTrongHan += th;
    s.duNoQuaHan += qh;
    s.duNoKhoanh += kh;
    s.tongGiaiNgan += gn;
    s.soMonVay += 1;
    s.monVayIds.push(soKU);
  }

  return {
    summariesByXa: Array.from(map.values()).sort(
      (a, b) => a.maXa.localeCompare(b.maXa) || a.maNguonVon.localeCompare(b.maNguonVon)
    ),
    monVayIds: allMonVayIds,
    ngaySoLieu,
    totalRows,
  };
}

/**
 * Merge NOXH-NQ11 vào danh sách `ActualSummary`:
 *   - Trừ tổng NOXH-NQ11 ra khỏi bucket gốc (xã, NV, '12')
 *   - Thêm bucket mới (xã, NV, '12N') gắn nhãn "Cho vay NOXH — NQ11"
 * Nếu bucket gốc không tồn tại (Báo cáo 31 chưa có món NOXH ở xã đó), vẫn
 * tạo bucket 12N để hiện số liệu nhưng không trừ âm.
 */
export function mergeNq11NoxhIntoActuals(
  actuals: ActualSummary[],
  nq11Noxh: Nq11NoxhXaSummary[]
): ActualSummary[] {
  if (!nq11Noxh.length) return actuals;

  const key = (maXa: string, nv: string, ct: string) => `${maXa}|${nv}|${ct}`;
  const map = new Map<string, ActualSummary>();
  for (const a of actuals) {
    map.set(key(a.maXa, a.maNguonVon, a.maChuongTrinh), { ...a });
  }

  for (const s of nq11Noxh) {
    const kBase = key(s.maXa, s.maNguonVon, '12');
    const base = map.get(kBase);
    if (base) {
      base.tongDuNo = Math.max(0, base.tongDuNo - s.tongDuNo);
      base.duNoTrongHan = Math.max(0, base.duNoTrongHan - s.duNoTrongHan);
      base.duNoQuaHan = Math.max(0, base.duNoQuaHan - s.duNoQuaHan);
      base.duNoKhoanh = Math.max(0, base.duNoKhoanh - s.duNoKhoanh);
      base.tongGiaiNgan = Math.max(0, base.tongGiaiNgan - s.tongGiaiNgan);
      base.soMonVay = Math.max(0, base.soMonVay - s.soMonVay);
    }

    map.set(key(s.maXa, s.maNguonVon, '12N'), {
      maXa: s.maXa,
      tenXa: s.tenXa,
      maNguonVon: s.maNguonVon,
      maChuongTrinh: '12N',
      tenChuongTrinh: 'Cho vay NOXH — NQ11',
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
