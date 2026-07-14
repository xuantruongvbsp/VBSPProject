const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const outDir = 'C:\\Users\\Administrator\\Desktop\\New folder';
const outFile = path.join(outDir, 'VAT_Invoice_Statistics.xlsx');

const rawRows = [
  { series: '1C26THL-548',      date: '2026-05-09', issued: 'CÔNG TY TNHH PHÚC HẢI LIÊN',                                        address: 'Số 1602, tổ 3, Khu phố Ngọc Lâm 4, Phường Tân Phú, Thành phố Đồng Nai, Việt Nam',  total: 100015630 },
  { series: '1C26TBH-00002025', date: '2026-05-27', issued: 'Chi Nhánh Đồng Nai - Công Ty Cổ Phần Gạch Ốp Lát Hoà Bình Minh',     address: 'A25, Khu phố 5, Phường Tam Hiệp, Thành Phố Đồng Nai, Việt Nam',                    total: 35575200 },
  { series: '1C26TTT-1818',     date: '2026-03-24', issued: 'CÔNG TY TNHH HÒA THÀNH TIẾN',                                        address: '10A, KDC 3, ấp 5, Xã Phú Vinh, Tỉnh Đồng Nai, Việt Nam',                            total: 2424000 },
  { series: '1C26TTT-1832',     date: '2026-03-25', issued: 'CÔNG TY TNHH HÒA THÀNH TIẾN',                                        address: '10A, KDC 3, ấp 5, Xã Phú Vinh, Tỉnh Đồng Nai, Việt Nam',                            total: 2626000 },
  { series: '1C26TTT-2364',     date: '2026-04-13', issued: 'CÔNG TY TNHH HÒA THÀNH TIẾN',                                        address: '10A, KDC 3, ấp 5, Xã Phú Vinh, Tỉnh Đồng Nai, Việt Nam',                            total: 5050000 },
  { series: '1C26TTT-2261',     date: '2026-04-09', issued: 'CÔNG TY TNHH HÒA THÀNH TIẾN',                                        address: '10A, KDC 3, ấp 5, Xã Phú Vinh, Tỉnh Đồng Nai, Việt Nam',                            total: 5125000 },
  { series: '1C26TDT-0000540',  date: '2026-05-27', issued: 'CÔNG TY TNHH MTV VÕ ĐỨC TÂM',                                         address: '513, Quốc lộ 1A, ấp Hoà Bình, Xã Hưng Thịnh, Thành Phố Đồng Nai, Việt Nam',         total: 19550646 },
  { series: '1C26TAP-00000599', date: '2026-05-26', issued: 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI SƠN ALPHA VIỆT NAM',                 address: 'Số 30 Đường 50A, Khu phố 9, Phường Tân Tạo, Thành phố Hồ Chí Minh, Việt Nam',      total: 48803040 },
  { series: '1C26THH-00001920', date: '2026-05-21', issued: 'CÔNG TY CỔ PHẦN HOA SEN HOME - CHI NHÁNH TỈNH ĐỒNG NAI',              address: 'Số 282 Đường Đồng Khởi, Tổ 47, Khu phố 11, Phường Tân Triều, Thành phố Đồng Nai, Việt Nam', total: 279729 },
  { series: '1C26THH-00001921', date: '2026-05-21', issued: 'CÔNG TY CỔ PHẦN HOA SEN HOME - CHI NHÁNH TỈNH ĐỒNG NAI',              address: 'Số 282 Đường Đồng Khởi, Tổ 47, Khu phố 11, Phường Tân Triều, Thành phố Đồng Nai, Việt Nam', total: 15901600 },
];

rawRows.sort((a, b) => a.date.localeCompare(b.date) || a.series.localeCompare(b.series));

const header = ['No', 'Series', 'Date/Month/Year', 'Issued', 'Address', 'Grand Total'];
const aoa = [header];
rawRows.forEach((r, i) => {
  aoa.push([i + 1, r.series, new Date(r.date + 'T00:00:00'), r.issued, r.address, r.total]);
});
const totalRow = rawRows.length + 2;
aoa.push(['', '', '', 'TOTAL', '', { f: `SUM(F2:F${totalRow - 1})` }]);

const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

ws['!cols'] = [
  { wch: 5 },
  { wch: 20 },
  { wch: 16 },
  { wch: 58 },
  { wch: 80 },
  { wch: 18 },
];

for (let i = 2; i <= rawRows.length + 1; i++) {
  const dateCell = ws[`C${i}`];
  if (dateCell) dateCell.z = 'dd/mm/yyyy';
  const totalCell = ws[`F${i}`];
  if (totalCell) totalCell.z = '#,##0';
}
const sumCell = ws[`F${totalRow}`];
if (sumCell) sumCell.z = '#,##0';

ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'VAT Invoices');
XLSX.writeFile(wb, outFile);

console.log('Wrote', outFile);
console.log('Rows:', rawRows.length);
console.log('Size:', fs.statSync(outFile).size, 'bytes');
