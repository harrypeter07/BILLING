const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const files = [
  { name: 'Customers.xlsx', sheet: 'Customers' },
  { name: 'Products.xlsx', sheet: 'Products' },
  { name: 'Invoices.xlsx', sheet: 'Invoices' }
];

function log(...a){ console.log('[create-blank-excel]', ...a); }

function checkWritable(filePath){
  try {
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return { writable: true };
  } catch (e) {
    return { writable: false, error: e && e.message ? e.message : String(e) };
  }
}

function checkReadableExcel(filePath){
  try {
    XLSX.readFile(filePath);
    return { readable: true };
  } catch (e) {
    return { readable: false, error: e && e.message ? e.message : String(e) };
  }
}

for (const f of files) {
  const filePath = path.join(dataDir, f.name);
  const exists = fs.existsSync(filePath);
  if (exists && !FORCE) {
    log(`Exists (not overwritten): ${filePath}`);
    const w = checkWritable(filePath);
    if (w.writable) log(` - Writable: yes`); else log(` - Writable: no (${w.error})`);
    const r = checkReadableExcel(filePath);
    if (r.readable) log(` - Readable Excel: yes`); else log(` - Readable Excel: no (${r.error})`);
    continue;
  }
  if (exists && FORCE) {
    log(`--force specified; overwriting: ${filePath}`);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), f.sheet);
  XLSX.writeFile(wb, filePath);
  log(`Created blank Excel file: ${filePath}`);
}

log('Done. Pass --force to overwrite existing files.');
