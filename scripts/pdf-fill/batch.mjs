import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const TIMES = 'C:/Windows/Fonts/times.ttf';
const LABEL = 'Tỷ lệ khảo sát: 100%';
const MATCH = /T[ỷy]\s*l[ệe]\s*kh[ảa]o\s*s[áa]t/i;
const ROOT = process.argv[2];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function findTargets(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const targets = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (MATCH.test(it.str) && /%/.test(it.str)) {
        const t = it.transform;
        targets.push({ pageIndex: p - 1, x: t[4], baselineY: t[5], width: it.width, fontSize: Math.hypot(t[2], t[3]) });
      }
    }
  }
  await doc.cleanup();
  return targets;
}

async function fillFile(p) {
  const targets = await findTargets(p);
  if (targets.length === 0) return 0;
  const pdf = await PDFDocument.load(fs.readFileSync(p));
  pdf.registerFontkit(fontkit);
  const times = await pdf.embedFont(fs.readFileSync(TIMES), { subset: true });
  const pages = pdf.getPages();
  for (const tg of targets) {
    const page = pages[tg.pageIndex];
    const fz = tg.fontSize;
    page.drawRectangle({ x: tg.x - 1, y: tg.baselineY - 0.30 * fz, width: tg.width + 4, height: fz * 1.32, color: rgb(1, 1, 1) });
    page.drawText(LABEL, { x: tg.x, y: tg.baselineY, size: fz, font: times, color: rgb(0, 0, 0) });
  }
  fs.writeFileSync(p, await pdf.save());
  return targets.length;
}

const files = walk(ROOT);
let totalFields = 0, changed = 0, skipped = 0;
for (const f of files) {
  const n = await fillFile(f);
  totalFields += n;
  if (n > 0) changed++; else skipped++;
  console.log(`${n > 0 ? 'OK ' : '-- '} [${n}] ${path.relative(ROOT, f)}`);
}
console.log(`\nFiles: ${files.length} | filled: ${changed} | no-field: ${skipped} | total fields: ${totalFields}`);
