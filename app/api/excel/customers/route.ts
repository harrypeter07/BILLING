import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const dataDir = path.join(process.cwd(), "data");
const customersFile = path.join(dataDir, "Customers.xlsx");
const SHEET = "Customers";

function log(...args: any[]) { console.log("[EXCEL:customers]", ...args); }
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}
function ensureFileAndSheet(forceReset = false) {
  ensureDataDir();
  if (forceReset && fs.existsSync(customersFile)) {
    fs.unlinkSync(customersFile);
    log('Deleted corrupt Customers.xlsx');
  }
  if (!fs.existsSync(customersFile)) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), SHEET);
    XLSX.writeFile(wb, customersFile);
    log('Initialized missing Customers file:', customersFile);
  }
}
function tryLoadCustomers(): any[] {
  try {
    ensureFileAndSheet();
    const wb = XLSX.readFile(customersFile);
    const ws = wb.Sheets[SHEET];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  } catch (e: any) {
    log('Load failed, possibly locked/corrupt. Retrying with reset.', e?.message);
    try {
      ensureFileAndSheet(true);
      const wb = XLSX.readFile(customersFile);
      const ws = wb.Sheets[SHEET];
      return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
    } catch (final) {
      log('Failed after reset attempt:', final?.message);
      throw new Error('Excel file locked or not accessible. Please close it in Excel and try again.');
    }
  }
}
function trySaveCustomers(customers: any[]) {
  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), SHEET);
    XLSX.writeFile(wb, customersFile);
    log('Customers saved:', customers.length, 'total');
  } catch (e: any) {
    log('Save failed (locked?):', e?.message);
    throw new Error('Excel file locked for write. Please close it in Excel.');
  }
}
export async function GET() {
  try {
    const customers = tryLoadCustomers();
    log('Fetched customers:', customers.length);
    return NextResponse.json({ customers });
  } catch (e) {
    log('GET error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    log('POST body:', data);
    let customers = tryLoadCustomers();
    if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const id = data.id || crypto.randomUUID();
    const newCust = { ...data, id };
    customers.push(newCust);
    trySaveCustomers(customers);
    log('Customer added:', id);
    return NextResponse.json({ customer: newCust, customers });
  } catch (e) {
    log('POST error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    log('PUT body:', data);
    let customers = tryLoadCustomers();
    if (!data.id) return NextResponse.json({ error: 'Customer id required for update' }, { status: 400 });
    const idx = customers.findIndex((c: any) => c.id === data.id);
    if (idx === -1) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    customers[idx] = { ...customers[idx], ...data };
    trySaveCustomers(customers);
    log('Customer updated:', data.id);
    return NextResponse.json({ customer: customers[idx], customers });
  } catch (e) {
    log('PUT error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    log('DELETE body:', data);
    let customers = tryLoadCustomers();
    if (!data.id) return NextResponse.json({ error: 'Customer id required for delete' }, { status: 400 });
    const before = customers.length;
    customers = customers.filter((c: any) => c.id !== data.id);
    trySaveCustomers(customers);
    log('Customer deleted:', data.id, 'remaining:', customers.length);
    return NextResponse.json({ success: true, deleted: data.id, count: before - customers.length, customers });
  } catch (e) {
    log('DELETE error:', e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
