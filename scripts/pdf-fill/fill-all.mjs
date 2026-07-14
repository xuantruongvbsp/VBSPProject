import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const TIMES = 'C:/Windows/Fonts/times.ttf';
const ROOT = process.argv[2];
const ONLY = process.argv[3]; // optional single relative file
const DISTRICT = 'Định Quán';
const MONTH = '03';

const RE_TYLE = /T[ỷy]\s*l[ệe]\s*kh[ảa]o\s*s[áa]t/i;
const RE_THOIDIEM = /Th[ờo]i\s*đi[ểe]m/i;
// the 3 footer lines: "Số hộ (nghèo|cận nghèo|thoát nghèo) khảo sát/ ... trên địa bàn ..."
const RE_FOOTER = /S[ốo]\s*h[ộo].*kh[ảa]o\s*s[áa]t.*tr[êe]n\s*đ[ịi]a\s*b[àa]n/i;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

function properCase(s) {
  return s.toLowerCase().trim().split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

// commune + year from filename: 02ĐTN_ĐỊNH QUÁN_2025_GIA CANH.pdf
function metaFromName(file) {
  const base = path.basename(file).replace(/\.pdf$/i, '');
  const yearM = base.match(/_(20\d{2})_?/);
  const year = yearM ? yearM[1] : null;
  const after = year ? base.split(`_${year}_`)[1] : null; // commune token after year
  const commune = after ? properCase(after) : DISTRICT;
  return { year, commune };
}

async function getPageLines(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({
      str: it.str, x: it.transform[4], y: it.transform[5], width: it.width,
      fontSize: Math.hypot(it.transform[2], it.transform[3]),
    }));
    pages.push({ width: page.getViewport({ scale: 1 }).width, items });
  }
  await doc.cleanup();
  return pages;
}

// right edge of the run of items sharing the same baseline starting at/after anchor.x
function lineRight(items, anchor) {
  let right = anchor.x + anchor.width;
  for (const it of items) {
    if (Math.abs(it.y - anchor.y) < 2.5 && it.x >= anchor.x - 1) right = Math.max(right, it.x + it.width);
  }
  return right;
}

async function fillFile(file) {
  const { year, commune } = metaFromName(file);
  const pages = await getPageLines(file);
  const edits = []; // {pageIndex, x, y, fontSize, width, text, align, center}

  pages.forEach((pg, pi) => {
    // 1) Tỷ lệ khảo sát -> 100% on ALL THREE footer lines (nghèo / cận nghèo / thoát nghèo)
    const tyleItems = pg.items.filter(it => RE_TYLE.test(it.str));
    const footers = pg.items.filter(it => RE_FOOTER.test(it.str));
    if (footers.length) {
      const tyleX = tyleItems.length ? Math.min(...tyleItems.map(i => i.x)) : 641.6;
      const tyleFz = tyleItems.length ? tyleItems[0].fontSize : 10.2;
      // white-out existing "Tỷ lệ khảo sát: …%" runs (remove the dotted originals underneath)
      for (const it of tyleItems) {
        const right = lineRight(pg.items, it);
        edits.push({ pageIndex: pi, rect: { x: it.x - 1, y: it.y - 0.30 * it.fontSize, w: (right - it.x) + 4, h: it.fontSize * 1.34 } });
      }
      // draw label aligned to each footer line's baseline
      for (const f of footers) {
        edits.push({ pageIndex: pi, draw: { x: tyleX, y: f.y, size: tyleFz, text: 'Tỷ lệ khảo sát: 100%' }, kind: 'tyle' });
      }
    }
    // 2) Thời điểm line
    for (const it of pg.items) {
      if (RE_THOIDIEM.test(it.str)) {
        const right = lineRight(pg.items, it);
        const text = `Thời điểm: Tháng ${MONTH}/${year}, xã/phường/thị trấn ${commune}      Huyện/TP: ${DISTRICT}`;
        const w = text.length; // placeholder, real width computed at draw time
        edits.push({ pageIndex: pi, rect: { x: it.x - 1, y: it.y - 0.30 * it.fontSize, w: (right - it.x) + 4, h: it.fontSize * 1.34 },
          draw: { y: it.y, size: it.fontSize, text, center: pg.width }, kind: 'thoidiem' });
      }
    }
  });

  if (edits.length === 0) return { tyle: 0, thoidiem: 0 };

  const pdf = await PDFDocument.load(fs.readFileSync(file));
  pdf.registerFontkit(fontkit);
  const times = await pdf.embedFont(fs.readFileSync(TIMES), { subset: true });
  const docPages = pdf.getPages();
  let tyle = 0, thoidiem = 0;

  // rects first (white-out), then text on top
  for (const e of edits) {
    if (!e.rect) continue;
    docPages[e.pageIndex].drawRectangle({ x: e.rect.x, y: e.rect.y, width: e.rect.w, height: e.rect.h, color: rgb(1, 1, 1) });
  }
  for (const e of edits) {
    if (!e.draw) continue;
    const d = e.draw;
    let x = d.x;
    if (d.center) x = (d.center / 2) - times.widthOfTextAtSize(d.text, d.size) / 2;
    docPages[e.pageIndex].drawText(d.text, { x, y: d.y, size: d.size, font: times, color: rgb(0, 0, 0) });
    if (e.kind === 'thoidiem') thoidiem++; else tyle++;
  }
  fs.writeFileSync(file, await pdf.save());
  return { tyle, thoidiem };
}

const files = ONLY ? [path.join(ROOT, ONLY)] : walk(ROOT);
let fTyle = 0, fThoi = 0, changed = 0;
for (const f of files) {
  const r = await fillFile(f);
  fTyle += r.tyle; fThoi += r.thoidiem;
  if (r.tyle || r.thoidiem) changed++;
  console.log(`${(r.tyle||r.thoidiem)?'OK ':'-- '} [tỷlệ:${r.tyle} thời:${r.thoidiem}] ${path.relative(ROOT, f)}`);
}
console.log(`\nFiles: ${files.length} | changed: ${changed} | Tỷ lệ fields: ${fTyle} | Thời điểm lines: ${fThoi}`);
