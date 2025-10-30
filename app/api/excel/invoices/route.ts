export const runtime = 'nodejs'
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
function checkAccess(filePath: string) {
  try { fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK); return { ok: true }; }
  catch(e: any) { return { ok: false, error: e?.message || String(e) }; }
}
function atomicWriteWorkbook(filePath: string, wb: XLSX.WorkBook) {
  const tmp = filePath + ".tmp";
  XLSX.writeFile(wb, tmp);
  fs.renameSync(tmp, filePath);
}
function ensureFileAndSheet(forceReset = false) {
  ensureDataDir();
  const bak = invoicesFile + ".bak";
  if (forceReset && fs.existsSync(invoicesFile)) {
    try {
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
      fs.renameSync(invoicesFile, bak);
      log('Backed up Invoices.xlsx to', bak);
    } catch (e: any) { log('Backup failed:', e?.message); }
  }
  if (!fs.existsSync(invoicesFile)) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), SHEET);
    try {
      atomicWriteWorkbook(invoicesFile, wb);
      log('Initialized Invoices file:', invoicesFile);
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
    } catch (e: any) {
      log('Initialize write failed:', e?.message);
      if (fs.existsSync(bak)) { try { fs.renameSync(bak, invoicesFile); log('Restored backup'); } catch {} }
      throw e;
    }
  } else if (forceReset && fs.existsSync(bak)) {
    try { fs.unlinkSync(bak); } catch {}
  }
}
function tryLoadInvoices(): any[] {
  try {
    ensureFileAndSheet();
    const access = checkAccess(invoicesFile);
    if (!access.ok) throw new Error('Access denied: ' + access.error);
    const wb = XLSX.readFile(invoicesFile);
    const ws = wb.Sheets[SHEET];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  } catch(e: any) {
    log('Load failed, possibly locked/corrupt. Retrying with reset.', e?.message);
    try {
      ensureFileAndSheet(true);
      const access = checkAccess(invoicesFile);
      if (!access.ok) throw new Error('Access denied after reset: ' + access.error);
      const wb = XLSX.readFile(invoicesFile);
      const ws = wb.Sheets[SHEET];
      return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
    } catch (final) {
      log('Failed after reset attempt:', (final as any)?.message);
      throw final instanceof Error ? final : new Error(String(final));
    }
  }
}
function trySaveInvoices(invoices: any[]) {
  try {
    const access = checkAccess(invoicesFile);
    if (!access.ok) throw new Error('Cannot write: ' + access.error);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices), SHEET);
    atomicWriteWorkbook(invoicesFile, wb);
    log('Invoices saved:', invoices.length, 'total');
  } catch(e: any) {
    log('Save failed (locked?):', e?.message);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
export async function GET() {
  try {
    const invoices = tryLoadInvoices();
    log('Fetched invoices:', invoices.length);
    return NextResponse.json({ invoices });
  } catch (e: any) {
    log('GET error:', e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
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
  } catch (e: any) {
    log('POST error:', e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
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
  } catch (e: any) {
    log('PUT error:', e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
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
  } catch (e: any) {
    log('DELETE error:', e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
