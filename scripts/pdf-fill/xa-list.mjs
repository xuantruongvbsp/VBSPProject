import * as XLSX from '../../node_modules/xlsx/xlsx.mjs';
import fs from 'node:fs';
import AdmZip from '../../node_modules/adm-zip/adm-zip.js';

const file = process.argv[2];
const wb = XLSX.read(fs.readFileSync(file), {});
const ws = wb.Sheets['02ĐTN'];
const order = [];
const seen = new Map();
for (let r = 12; r <= 107; r++) {
  const c = ws['B' + r];
  const v = c && c.v != null ? String(c.v).trim() : '';
  if (!v) continue;
  if (!seen.has(v)) { seen.set(v, 0); order.push(v); }
  seen.set(v, seen.get(v) + 1);
}
console.log('Distinct Xã:', order.length);
order.forEach((x, i) => console.log(`  ${i + 1}. ${x}  (${seen.get(x)} rows)`));
console.log('mergeCells:', ws['!merges'] ? ws['!merges'].length : 0);
