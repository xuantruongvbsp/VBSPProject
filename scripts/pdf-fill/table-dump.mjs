import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const f = process.argv[2];
const data = new Uint8Array(fs.readFileSync(f));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(1);
const tc = await page.getTextContent();
const items = tc.items.filter(i => i.str.trim()).map(i => ({
  s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width,
}));

// sub-header column centers
console.log('--- (Số tiền)/(Số hộ) sub-headers ---');
items.filter(i => /^\(S[ốo]\s*(ti[ềe]n|h[ộo])\)$/i.test(i.s)).sort((a,b)=>a.x-b.x)
  .forEach(i => console.log(`${i.s}  xc=${(i.x+i.w/2).toFixed(1)} (x=${i.x.toFixed(1)} w=${i.w.toFixed(1)}) y=${i.y.toFixed(1)}`));

console.log('\n--- footer anchor ys ---');
items.filter(i => /S[ốo]\s*h[ộo].*kh[ảa]o\s*s[áa]t.*tr[êe]n/i.test(i.s)).forEach(i=>console.log(`y=${i.y.toFixed(1)} :: ${i.s.slice(0,40)}`));

console.log('\n--- all numeric-ish items (potential cells) sorted by y desc ---');
items.filter(i => /^[0-9]+([.,][0-9]+)?$/.test(i.s)).sort((a,b)=>b.y-a.y || a.x-b.x)
  .forEach(i => console.log(`y=${i.y.toFixed(1)} xc=${(i.x+i.w/2).toFixed(1)}  = ${i.s}`));
