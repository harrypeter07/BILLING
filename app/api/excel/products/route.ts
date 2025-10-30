import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const productsFile = path.join(process.cwd(), "public/excel-test/Products.xlsx");
const SHEET = "Products";

function log(...args: any[]) { console.log("[EXCEL:products]", ...args); }
function ensureFileAndSheet() {
  if (!fs.existsSync(productsFile)) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), SHEET);
    XLSX.writeFile(wb, productsFile);
    log('Initialized missing Products file:', productsFile);
  }
}
function loadProducts(): any[] {
  ensureFileAndSheet();
  const wb = XLSX.readFile(productsFile);
  const ws = wb.Sheets[SHEET];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
}
function saveProducts(products: any[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), SHEET);
  XLSX.writeFile(wb, productsFile);
  log('Products saved:', products.length, 'total');
}
export async function GET() {
  try {
    const products = loadProducts();
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
    let products = loadProducts();
    if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const id = data.id || crypto.randomUUID();
    const newProd = { ...data, id };
    products.push(newProd);
    saveProducts(products);
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
    let products = loadProducts();
    if (!data.id) return NextResponse.json({ error: 'Product id required for update' }, { status: 400 });
    const idx = products.findIndex((p: any) => p.id === data.id);
    if (idx === -1) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    products[idx] = { ...products[idx], ...data };
    saveProducts(products);
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
    let products = loadProducts();
    if (!data.id) return NextResponse.json({ error: 'Product id required for delete' }, { status: 400 });
    const before = products.length;
    products = products.filter((p: any) => p.id !== data.id);
    saveProducts(products);
    log('Product deleted:', data.id, 'remaining:', products.length);
    return NextResponse.json({ success: true, deleted: data.id, count: before - products.length, products });
  } catch (e) {
    log('DELETE error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
