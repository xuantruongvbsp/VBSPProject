import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const f = process.argv[2];
const data = new Uint8Array(fs.readFileSync(f));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1 });
console.log('PAGE size (pt):', vp.width.toFixed(1), 'x', vp.height.toFixed(1));
const tc = await page.getTextContent();

// Reconstruct: list items containing "khảo sát" or near, and the "%" items
for (const it of tc.items) {
  const s = it.str;
  if (/kh[ảa]o\s*s[áa]t|T[ỷy]\s*l[ệe]|%|\.\.\.\./.test(s)) {
    const [a,b,c,d,e,g] = it.transform; // e=x, g=y (PDF coords, origin bottom-left)
    console.log(JSON.stringify(s), 'x=', e.toFixed(1), 'y=', g.toFixed(1), 'w=', it.width.toFixed(1), 'h=', it.height.toFixed(1));
  }
}
