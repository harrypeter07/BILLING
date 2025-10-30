import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const customersFile = path.join(process.cwd(), "public/excel-test/Customers.xlsx");
const SHEET = "Customers";

function log(...args: any[]) { console.log("[EXCEL:customers]", ...args); }
function loadCustomers(): any[] {
  if (!fs.existsSync(customersFile)) {
    log("Customers file missing at", customersFile);
    return [];
  }
  const wb = XLSX.readFile(customersFile);
  const ws = wb.Sheets[SHEET];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
}
function saveCustomers(customers: any[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), SHEET);
  XLSX.writeFile(wb, customersFile);
  log('Customers saved:', customers.length, 'total');
}
export async function GET() {
  const customers = loadCustomers();
  log('Fetched customers:', customers.length);
  return NextResponse.json({ customers });
}
export async function POST(request: NextRequest) {
  const data = await request.json();
  log('POST body:', data);
  let customers = loadCustomers();
  if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const id = data.id || crypto.randomUUID();
  const newCust = { ...data, id };
  customers.push(newCust);
  saveCustomers(customers);
  log('Customer added:', id);
  return NextResponse.json({ customer: newCust, customers });
}
export async function PUT(request: NextRequest) {
  const data = await request.json();
  log('PUT body:', data);
  let customers = loadCustomers();
  if (!data.id) return NextResponse.json({ error: 'Customer id required for update' }, { status: 400 });
  const idx = customers.findIndex((c: any) => c.id === data.id);
  if (idx === -1) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  customers[idx] = { ...customers[idx], ...data };
  saveCustomers(customers);
  log('Customer updated:', data.id);
  return NextResponse.json({ customer: customers[idx], customers });
}
export async function DELETE(request: NextRequest) {
  const data = await request.json();
  log('DELETE body:', data);
  let customers = loadCustomers();
  if (!data.id) return NextResponse.json({ error: 'Customer id required for delete' }, { status: 400 });
  const before = customers.length;
  customers = customers.filter((c: any) => c.id !== data.id);
  saveCustomers(customers);
  log('Customer deleted:', data.id, 'remaining:', customers.length);
  return NextResponse.json({ success: true, deleted: data.id, count: before - customers.length, customers });
}
