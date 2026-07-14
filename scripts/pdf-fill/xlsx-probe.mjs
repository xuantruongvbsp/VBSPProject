import * as XLSX from '../../node_modules/xlsx/xlsx.mjs';
import fs from 'node:fs';

const file = process.argv[2];
const wb = XLSX.read(fs.readFileSync(file), { cellFormula: true, cellNF: true, sheetStubs: true });
console.log('SHEETS:', wb.SheetNames.join(' | '));

const target = process.argv[3] || wb.SheetNames[0];
const ws = wb.Sheets[target];
console.log('\n=== SHEET:', target, '===');
const ref = ws['!ref'];
console.log('range:', ref);
const range = XLSX.utils.decode_range(ref);

// dump rows 1..(maxRow) cols A..N showing value + formula
const maxR = Math.min(range.e.r, 130);
const maxC = Math.min(range.e.c, 14);
for (let r = range.s.r; r <= maxR; r++) {
  let line = [];
  for (let c = range.s.c; c <= maxC; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (!cell) continue;
    let s = '';
    if (cell.f) s = `=${cell.f}`;
    else if (cell.v !== undefined && cell.v !== '') s = String(cell.v);
    if (s) line.push(`${addr}:${s}`);
  }
  if (line.length) console.log(`R${r + 1} | ` + line.join('  ||  '));
}
