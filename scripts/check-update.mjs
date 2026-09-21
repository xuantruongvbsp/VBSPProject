import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// So sánh phiên bản giữa bản portable đang chạy và thư mục chia sẻ.
// Dùng Node thay vì parse JSON bằng batch (batch parse JSON rất dễ hỏng).
//
// Exit code:
//   0 = đã là bản mới nhất (hoặc chưa cấu hình nguồn)
//   1 = có bản mới
//   2 = bản trong thư mục chia sẻ cũ hơn
//   3 = lỗi (thiếu nguồn hợp lệ / thiếu file / JSON hỏng / không đọc được UNC)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const printSource = process.argv.includes('--print-source');

// Đọc dòng hợp lệ đầu tiên từ update-source.txt (bỏ comment `#`, dòng rỗng,
// bỏ dấu ngoặc kép nếu người dùng có dán vào).
function readUpdateSource() {
  const file = path.join(__dirname, 'update-source.txt');
  if (!existsSync(file)) return null;
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split(/\r?\n/);
  } catch {
    return null;
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return line.replace(/^["']/, '').replace(/["']$/, '');
  }
  return null;
}

const source = readUpdateSource();

if (printSource) {
  // Chỉ in đường dẫn (không in gì khác) để batch bắt bằng for /f.
  if (source) {
    console.log(source);
    process.exit(0);
  }
  process.exit(1);
}

if (!source) {
  console.log('Chua cau hinh thu muc nguon cap nhat.');
  console.log('Mo file update-source.txt va ghi duong dan den thu muc chua ban VSPPRO moi.');
  console.log('Vi du: \\\\FILESERVER\\Share\\VSPPRO   hoac   D:\\Builds\\VSPPRO');
  process.exit(0);
}

function readVersion(file) {
  try {
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const localFile = path.join(__dirname, 'app', 'version.json');
const remoteFile = path.join(source, 'app', 'version.json');

const local = readVersion(localFile);
const remote = readVersion(remoteFile);

let localTs = 0;
let localId = 'unknown';
if (local && typeof local.buildTs === 'number') {
  localTs = local.buildTs;
  localId = typeof local.buildId === 'string' ? local.buildId : 'unknown';
} else {
  // Bản portable cũ chưa có version.json → coi như buildTs = 0 để vẫn nâng
  // cấp được lên bản có A4.
  console.log('Ban hien tai chua co thong tin phien ban - se cap nhat neu thu muc chia se co ban moi.');
}

if (!remote || typeof remote.buildTs !== 'number') {
  console.log('Khong doc duoc phien ban tu thu muc chia se:');
  console.log(`  ${remoteFile}`);
  process.exit(3);
}

const remoteTs = remote.buildTs;
const remoteId = typeof remote.buildId === 'string' ? remote.buildId : 'unknown';

if (remoteTs > localTs) {
  console.log(`Co ban moi: ${remoteId} (hien tai: ${localId})`);
  process.exit(1);
}

if (remoteTs === localTs) {
  console.log(`Da la ban moi nhat (${remoteId}).`);
  process.exit(0);
}

console.log('Ban trong thu muc chia se CU HON ban dang chay - bo qua.');
process.exit(2);
