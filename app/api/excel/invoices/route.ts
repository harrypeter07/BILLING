import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const dataDir = path.join(process.cwd(), "data");
const invoicesFile = path.join(dataDir, "Invoices.xlsx");
const SHEET = "Invoices";

function log(...args: any[]) { console.log("[EXCEL:invoices]", ...args); }
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}
function ensureFileAndSheet(forceReset = false) {
  ensureDataDir();
  if (forceReset && fs.existsSync(invoicesFile)) {
    fs.unlinkSync(invoicesFile);
    log('Deleted corrupt Invoices.xlsx');
  }
  if (!fs.existsSync(invoicesFile)) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), SHEET);
    XLSX.writeFile(wb, invoicesFile);
    log('Initialized missing Invoices file:', invoicesFile);
  }
}
function tryLoadInvoices(): any[] {
  try {
    ensureFileAndSheet();
    const wb = XLSX.readFile(invoicesFile);
    const ws = wb.Sheets[SHEET];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  } catch(e: any) {
    log('Load failed, possibly locked/corrupt. Retrying with reset.', e?.message);
    try {
      ensureFileAndSheet(true);
      const wb = XLSX.readFile(invoicesFile);
      const ws = wb.Sheets[SHEET];
      return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
    } catch (final) {
      log('Failed after reset attempt:', final?.message);
      throw new Error('Excel file locked or not accessible. Please close it in Excel and try again.');
    }
  }
}
function trySaveInvoices(invoices: any[]) {
  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices), SHEET);
    XLSX.writeFile(wb, invoicesFile);
    log('Invoices saved:', invoices.length, 'total');
  } catch(e: any) {
    log('Save failed (locked?):', e?.message);
    throw new Error('Excel file locked for write. Please close it in Excel.');
  }
}
export async function GET() {
  try {
    const invoices = tryLoadInvoices();
    log('Fetched invoices:', invoices.length);
    return NextResponse.json({ invoices });
  } catch (e) {
    log('GET error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    log('POST body:', data);
    let invoices = tryLoadInvoices();
    if (!data.customer_id || !data.invoice_number) return NextResponse.json({ error: 'customer_id and invoice_number are required' }, { status: 400 });
    const id = data.id || crypto.randomUUID();
    const newInv = { ...data, id };
    invoices.push(newInv);
    trySaveInvoices(invoices);
    log('Invoice added:', id);
    return NextResponse.json({ invoice: newInv, invoices });
  } catch (e) {
    log('POST error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    log('PUT body:', data);
    let invoices = tryLoadInvoices();
    if (!data.id) return NextResponse.json({ error: 'Invoice id required for update' }, { status: 400 });
    const idx = invoices.findIndex((i: any) => i.id === data.id);
    if (idx === -1) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    invoices[idx] = { ...invoices[idx], ...data };
    trySaveInvoices(invoices);
    log('Invoice updated:', data.id);
    return NextResponse.json({ invoice: invoices[idx], invoices });
  } catch (e) {
    log('PUT error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    log('DELETE body:', data);
    let invoices = tryLoadInvoices();
    if (!data.id) return NextResponse.json({ error: 'Invoice id required for delete' }, { status: 400 });
    const before = invoices.length;
    invoices = invoices.filter((i: any) => i.id !== data.id);
    trySaveInvoices(invoices);
    log('Invoice deleted:', data.id, 'remaining:', invoices.length);
    return NextResponse.json({ success: true, deleted: data.id, count: before - invoices.length, invoices });
  } catch (e) {
    log('DELETE error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
