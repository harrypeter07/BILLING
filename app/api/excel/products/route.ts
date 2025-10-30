import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const dataDir = path.join(process.cwd(), "data");
const productsFile = path.join(dataDir, "Products.xlsx");
const SHEET = "Products";

function log(...args: any[]) { console.log("[EXCEL:products]", ...args); }
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}
function atomicWriteWorkbook(filePath: string, wb: XLSX.WorkBook) {
  const tmp = filePath + ".tmp";
  XLSX.writeFile(wb, tmp);
  fs.renameSync(tmp, filePath);
}
function ensureFileAndSheet(forceReset = false) {
  ensureDataDir();
  const bak = productsFile + ".bak";
  if (forceReset && fs.existsSync(productsFile)) {
    try {
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
      fs.renameSync(productsFile, bak);
      log('Backed up Products.xlsx to', bak);
    } catch (e: any) { log('Backup failed:', e?.message); }
  }
  if (!fs.existsSync(productsFile)) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), SHEET);
    try {
      atomicWriteWorkbook(productsFile, wb);
      log('Initialized Products file:', productsFile);
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
    } catch (e: any) {
      log('Initialize write failed:', e?.message);
      if (fs.existsSync(bak)) { try { fs.renameSync(bak, productsFile); log('Restored backup'); } catch {} }
      throw e;
    }
  } else if (forceReset && fs.existsSync(bak)) {
    try { fs.unlinkSync(bak); } catch {}
  }
}
function tryLoadProducts(): any[] {
  try {
    ensureFileAndSheet();
    const wb = XLSX.readFile(productsFile);
    const ws = wb.Sheets[SHEET];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  } catch (e: any) {
    log('Load failed, possibly locked/corrupt. Retrying with reset.', e?.message);
    try {
      ensureFileAndSheet(true);
      const wb = XLSX.readFile(productsFile);
      const ws = wb.Sheets[SHEET];
      return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
    } catch (final) {
      log('Failed after reset attempt:', final?.message);
      throw new Error('Excel file locked or not accessible. Please close it in Excel and try again.');
    }
  }
}
function trySaveProducts(products: any[]) {
  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), SHEET);
    atomicWriteWorkbook(productsFile, wb);
    log('Products saved:', products.length, 'total');
  } catch (e: any) {
    log('Save failed (locked?):', e?.message);
    throw new Error('Excel file locked for write. Please close it in Excel.');
  }
}
export async function GET() {
  try {
    const products = tryLoadProducts();
    log('Fetched products:', products.length);
    return NextResponse.json({ products });
  } catch (e) {
    log('GET error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    log('POST body:', data);
    let products = tryLoadProducts();
    if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const id = data.id || crypto.randomUUID();
    const newProd = { ...data, id };
    products.push(newProd);
    trySaveProducts(products);
    log('Product added:', id);
    return NextResponse.json({ product: newProd, products });
  } catch (e) {
    log('POST error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    log('PUT body:', data);
    let products = tryLoadProducts();
    if (!data.id) return NextResponse.json({ error: 'Product id required for update' }, { status: 400 });
    const idx = products.findIndex((p: any) => p.id === data.id);
    if (idx === -1) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    products[idx] = { ...products[idx], ...data };
    trySaveProducts(products);
    log('Product updated:', data.id);
    return NextResponse.json({ product: products[idx], products });
  } catch (e) {
    log('PUT error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    log('DELETE body:', data);
    let products = tryLoadProducts();
    if (!data.id) return NextResponse.json({ error: 'Product id required for delete' }, { status: 400 });
    const before = products.length;
    products = products.filter((p: any) => p.id !== data.id);
    trySaveProducts(products);
    log('Product deleted:', data.id, 'remaining:', products.length);
    return NextResponse.json({ success: true, deleted: data.id, count: before - products.length, products });
  } catch (e) {
    log('DELETE error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
