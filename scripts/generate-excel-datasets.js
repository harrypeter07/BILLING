/*
This script generates Excel files with correct structure and mock data to tmp/.
- Products.xlsx, Customers.xlsx, Employees.xlsx, Invoices.xlsx
*/

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Change from tmp to public/excel-test
const outDir = path.join(__dirname, '../public/excel-test');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Mock data for each type
const mockProducts = [
  { id: '1', name: 'Sample Product', sku: 'SP-001', category: 'QA', price: 100.0, cost_price: 60.0, stock_quantity: 10, unit: 'piece', hsn_code: '9000', gst_rate: 18, is_active: true }
];
const mockCustomers = [
  { id: '1', name: 'Sample Customer', email: 'sample@customer.com', phone: '9123456780', gstin: '', address: 'Street 1' },
];
const mockEmployees = [
  { id: '1', name: 'Sample Employee', title: 'Dev', salary: 50000 },
];
const mockInvoices = [
  { id: '1', customer_id: '1', total: 200, created_at: (new Date()).toISOString(), items: '[{"product_id":"1","qty":2,"price":100}]' },
];

function writeExcel(filename, sheetName, data) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), sheetName);
  XLSX.writeFile(wb, path.join(outDir, filename));
  console.log('Created', path.join(outDir, filename));
}

writeExcel('Products.xlsx', 'Products', mockProducts);
writeExcel('Customers.xlsx', 'Customers', mockCustomers);
writeExcel('Employees.xlsx', 'Employees', mockEmployees);
writeExcel('Invoices.xlsx', 'Invoices', mockInvoices);

console.log('All Excel files generated in', outDir);
