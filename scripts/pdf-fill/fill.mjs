import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const TIMES = 'C:/Windows/Fonts/times.ttf';
const LABEL = 'Tỷ lệ khảo sát: 100%';
const MATCH = /T[ỷy]\s*l[ệe]\s*kh[ảa]o\s*s[áa]t/i; // matches "Tỷ lệ khảo sát"

async function findTargets(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const targets = []; // {pageIndex, x, baselineFromTop, width, fontSize}
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (MATCH.test(it.str)) {
        const t = it.transform; // [a,b,c,d,e,f]; e=x, f=baseline (scale1,rot0)
        const fontSize = Math.hypot(t[2], t[3]);
        targets.push({ pageIndex: p - 1, x: t[4], yTop: t[5], width: it.width, fontSize });
      }
    }
  }
  await doc.cleanup();
  return targets;
}

async function fillFile(inPath, outPath) {
  const targets = await findTargets(inPath);
  const pdfBytes = fs.readFileSync(inPath);
  const pdf = await PDFDocument.load(pdfBytes);
  pdf.registerFontkit(fontkit);
  const times = await pdf.embedFont(fs.readFileSync(TIMES), { subset: true });
  const pages = pdf.getPages();

  for (const tg of targets) {
    const page = pages[tg.pageIndex];
    const baselineY = tg.yTop; // pdfjs transform[5] is already native bottom-left y
    const fs2 = tg.fontSize;
    // white-out the original run (label + dotted leader + %)
    page.drawRectangle({
      x: tg.x - 1,
      y: baselineY - 0.30 * fs2,
      width: tg.width + 4,
      height: fs2 * 1.32,
      color: rgb(1, 1, 1),
    });
    // redraw clean label
    page.drawText(LABEL, {
      x: tg.x,
      y: baselineY,
      size: fs2,
      font: times,
      color: rgb(0, 0, 0),
    });
  }
  const out = await pdf.save();
  fs.writeFileSync(outPath, out);
  return targets.length;
}

const inPath = process.argv[2];
const outPath = process.argv[3] || inPath;
const n = await fillFile(inPath, outPath);
console.log(`Filled ${n} field(s) -> ${outPath}`);
