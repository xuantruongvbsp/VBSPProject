import fs from 'node:fs';

const f = process.argv[2];
const buf = fs.readFileSync(f);
const txt = buf.toString('latin1');

console.log('Size:', buf.length);
console.log('Header:', txt.slice(0, 8));
console.log('Has /Font:', /\/Font/.test(txt));
console.log('Has /Image:', /\/Image/.test(txt));
console.log('Has /XObject:', /\/XObject/.test(txt));
console.log('FlateDecode count:', (txt.match(/FlateDecode/g) || []).length);
const prod = txt.match(/\/Producer ?\(([^)]*)\)/);
const crea = txt.match(/\/Creator ?\(([^)]*)\)/);
console.log('Producer:', prod ? prod[1] : '(none)');
console.log('Creator:', crea ? crea[1] : '(none)');
// page count
console.log('/Page count:', (txt.match(/\/Type\s*\/Page[^s]/g) || []).length);
console.log('/Image subtype count:', (txt.match(/\/Subtype\s*\/Image/g) || []).length);
