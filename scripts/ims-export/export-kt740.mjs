// Auto-export "Sao kê chi tiết KTKSNB - Kỳ ngày / 31 - Tạo hồ sơ tín dụng chi tiết theo ngày"
// from VBSP IMS_REPORTS, for report date = yesterday, save as .xlsx.
//
// All settings come from config.json (next to this file).
// Login is done through the real UI (handles ~280 dynamic hidden fields + JS).
// The cascade + export are replayed via the logged-in request context.
//
// Password: provided via env IMS_PASS (run-export.ps1 decrypts config.passwordEnc and injects it).
// Optional env overrides: IMS_DATE (dd/MM/yyyy), IMS_OUT_DIR, IMS_HEADFUL=1 (show browser).

import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse((await readFile(path.join(HERE, 'config.json'), 'utf8')).replace(/^﻿/, ''));

const BASE    = (cfg.baseUrl || 'http://10.129.0.55:8080/IMS_REPORTS').replace(/\/$/, '');
const USER    = cfg.username;
const PASS    = process.env.IMS_PASS || '';
const OUT_DIR = process.env.IMS_OUT_DIR || cfg.outDir;

const R = cfg.report;
const EXPORT_TIMEOUT_MS = 15 * 60 * 1000; // server report generation can be slow (~7 min observed)

function ddmmyyyy(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function main() {
  if (!PASS) throw new Error('IMS_PASS is empty — password not provided (run via run-export.ps1).');
  const reportDate = process.env.IMS_DATE || ddmmyyyy(yesterday());
  const fileDate   = reportDate.split('/').reverse().join('-'); // yyyy-MM-dd
  await mkdir(OUT_DIR, { recursive: true });

  log(`Start. user=${USER} reportDate=${reportDate} out=${OUT_DIR}`);
  const browser = await chromium.launch({ headless: process.env.IMS_HEADFUL !== '1' });
  const context = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // 1) LOGIN through the UI
    log('Logging in...');
    await page.goto(`${BASE}/beforeLogin_Proccess.action`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('#js_usernameid', USER);
    await page.fill('#loginform_password', PASS);
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
      page.click('#loginform input[type="submit"], #loginform button[type="submit"], #loginform button, input[value*="ĐĂNG NHẬP"]')
        .catch(async () => { await page.evaluate(() => document.getElementById('loginform').submit()); }),
    ]);
    await page.waitForTimeout(1500);

    const stillLogin = await page.evaluate(() => !!document.getElementById('loginform_password'));
    if (stillLogin) {
      const body = await page.content();
      throw new Error('Login failed (still on login page). Check credentials. Snippet: ' +
        body.replace(/\s+/g, ' ').slice(0, 300));
    }
    log('Login OK.');

    // 2) Prime report context + cascade via the logged-in request context
    const req = context.request;
    await req.get(`${BASE}/Menu_redirect.action?menuUrl=${R.menuUrl}&menuId=${R.menuId}&userName=${USER}`, { timeout: 60000 });
    await req.post(`${BASE}/loadselectexportkt740.action`, {
      form: { group_id: R.groupId, save_id: '1' },
      headers: { 'X-Requested-With': 'XMLHttpRequest' }, timeout: 60000,
    });
    await req.post(`${BASE}/LoadParameterskt740.action`, {
      form: { group_id: R.groupId, save_id: R.saveId },
      headers: { 'X-Requested-With': 'XMLHttpRequest' }, timeout: 60000,
    });

    // 3) Generate the report -> returns HTML with a download link (fileNamelocal)
    log('Requesting export (server generation can take several minutes)...');
    const genResp = await req.post(`${BASE}/genReportExcelQuerykt740.action`, {
      form: {
        save_id: R.saveId,
        PV_POS_CD_MAPGD_LIST: R.posCd,
        PARA_TONGHOP_LIST: R.tongHop,
        PD_REPORT_DATE_DATE: reportDate,
      },
      timeout: EXPORT_TIMEOUT_MS,
    });
    const genHtml = await genResp.text();
    log(`Gen response: status=${genResp.status()} size=${genHtml.length}`);

    const m = /name="fileNamelocal"\s+value="([^"]+)"/i.exec(genHtml);
    if (genResp.status() !== 200 || !m) {
      const dump = path.join(OUT_DIR, `ERROR_${fileDate}.html`);
      await writeFile(dump, genHtml);
      throw new Error(`Generation did not return a download link (status=${genResp.status()}). Saved to ${dump}`);
    }
    const fileNamelocal = m[1];
    log(`Server file: ${fileNamelocal}`);

    // 4) Download the actual XLSX
    const dlResp = await req.post(`${BASE}/download.action`, {
      form: { fileNamelocal }, timeout: EXPORT_TIMEOUT_MS,
    });
    const buf = Buffer.from(await dlResp.body());
    const ct = (dlResp.headers()['content-type'] || '').toLowerCase();
    log(`Download: status=${dlResp.status()} type=${ct} size=${buf.length}`);

    const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" => xlsx/zip
    if (dlResp.status() !== 200 || !isZip) {
      const dump = path.join(OUT_DIR, `ERROR_${fileDate}.bin`);
      await writeFile(dump, buf);
      throw new Error(`download.action did not return an Excel file (status=${dlResp.status()}, type=${ct}). Saved to ${dump}`);
    }

    const ext = (path.extname(fileNamelocal) || '.xlsx').toLowerCase();
    const outPath = path.join(OUT_DIR, `SaoKe_KTKSNB_${fileDate}${ext}`);
    await writeFile(outPath, buf);
    log(`SUCCESS -> ${outPath} (${buf.length} bytes)`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { log('FAILED:', err.message); process.exit(1); });
