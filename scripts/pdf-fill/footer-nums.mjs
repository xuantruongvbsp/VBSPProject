import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const TIMES = 'C:/Windows/Fonts/times.ttf';
const ROOT = process.argv[2];
const ONLY = process.argv[3];

const RE_FOOTER = /S[ốo]\s*h[ộo].*kh[ảa]o\s*s[áa]t.*tr[êe]n\s*đ[ịi]a\s*b[àa]n/i;
const RE_SUB = /^\(S[ốo]\s*(ti[ềe]n|h[ộo])\)$/i;
const NUM = /^[0-9]+([.,][0-9]+)?$/;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function getItems(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items.filter(i => i.str.trim()).map(i => ({
    str: i.str.trim(), x: i.transform[4], y: i.transform[5], width: i.width,
    fontSize: Math.hypot(i.transform[2], i.transform[3]),
  }));
  await doc.cleanup();
  return items;
}

// returns {ngheo, can, thoat} integers, or null
function computeValues(items, footers) {
  const subs = items.filter(i => RE_SUB.test(i.str)).map(i => ({ xc: i.x + i.width / 2, y: i.y })).sort((a, b) => a.xc - b.xc);
  if (subs.length < 9) return null;
  const centers = subs.slice(0, 9).map(s => s.xc);     // D E F G H I J K L
  const subY = subs[0].y;
  const ngheoFooterY = Math.max(...footers.map(f => f.y));
  const yTop = subY - 7, yBottom = ngheoFooterY + 6;
  const sums = new Array(9).fill(0);
  for (const it of items) {
    if (!NUM.test(it.str)) continue;
    if (it.y <= yBottom || it.y >= yTop) continue;
    const xc = it.x + it.width / 2;
    let best = -1, bd = 1e9;
    centers.forEach((c, i) => { const d = Math.abs(c - xc); if (d < bd) { bd = d; best = i; } });
    if (bd < 15) sums[best] += parseFloat(it.str.replace(',', '.'));
  }
  const [D, E, F, G, H, I, J, K, L] = sums;
  return {
    ngheo: Math.round(G + J + (D > 0 ? 2 : 0)),
    can: Math.round(H + K + (E > 0 ? 2 : 0)),
    thoat: Math.round(I + L + (F > 0 ? 2 : 0)),
  };
}

function categoryOf(str) {
  if (/tho[áa]t/i.test(str)) return 'thoat';
  if (/c[ậa]n/i.test(str)) return 'can';
  return 'ngheo';
}

async function fillFile(file) {
  const items = await getItems(file);
  const footers = items.filter(i => RE_FOOTER.test(i.str));
  if (!footers.length) return null;
  const vals = computeValues(items, footers);
  if (!vals) return null;

  const pdf = await PDFDocument.load(fs.readFileSync(file));
  pdf.registerFontkit(fontkit);
  const times = await pdf.embedFont(fs.readFileSync(TIMES), { subset: true });
  const page = pdf.getPages()[0];

  const out = {};
  for (const f of footers) {
    const cat = categoryOf(f.str);
    const v = vals[cat];
    out[cat] = v;
    const fz = f.fontSize;
    // redraw the whole footer line (label up to "TTr:" + value) in Times — no fragile sub-position junction
    const cIdx = f.str.indexOf(':', f.str.search(/TTr/i));
    const label = f.str.slice(0, cIdx + 1);     // "Số hộ ... xã/phường/TTr:"
    const text = `${label} ${v}/${v}`;
    // white-out the entire original run (label + dotted blank + any prior fill)
    page.drawRectangle({ x: f.x - 1, y: f.y - 0.30 * fz, width: f.width + 4, height: fz * 1.34, color: rgb(1, 1, 1) });
    page.drawText(text, { x: f.x, y: f.y, size: fz, font: times, color: rgb(0, 0, 0) });
  }
  const bytes = await pdf.save();
  for (let i = 0; ; i++) {
    try { fs.writeFileSync(file, bytes); break; }
    catch (e) {
      if ((e.code === 'EBUSY' || e.code === 'EPERM') && i < 15) { await new Promise(r => setTimeout(r, 500)); continue; }
      throw e;
    }
  }
  return out;
}

const files = ONLY ? [path.join(ROOT, ONLY)] : walk(ROOT);
let changed = 0;
const failed = [];
for (const f of files) {
  try {
    const r = await fillFile(f);
    if (r) { changed++; console.log(`OK  nghèo=${r.ngheo}/${r.ngheo} cận=${r.can}/${r.can} thoát=${r.thoat}/${r.thoat}  ${path.relative(ROOT, f)}`); }
    else console.log(`--  (no footer)  ${path.relative(ROOT, f)}`);
  } catch (e) {
    failed.push(path.relative(ROOT, f));
    console.log(`!!  FAILED (${e.code || e.message})  ${path.relative(ROOT, f)}`);
  }
}
console.log(`\nFiles: ${files.length} | filled: ${changed} | failed: ${failed.length}`);
if (failed.length) console.log('FAILED:\n' + failed.map(x => '  ' + x).join('\n'));
