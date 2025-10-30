/*
Populates the Excel API routes with mock data for customers, products, and invoices.
Usage: node scripts/populate-excel-api.js
*/
const http = require("http");

const host = "localhost";
const port = 3000;
const api = (route) => `http://${host}:${port}/api/excel/${route}`;

async function postJson(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let result = "";
      res.on("data", chunk => result += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(result) });
        } catch (e) {
          reject(`Parse error from ${endpoint} - ${result}`);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // Insert a product
  let output = {};
  try {
    const prod = {
      name: "Test Widget",
      sku: "SKU-100",
      category: "UnitTest",
      price: 99,
      cost_price: 80,
      stock_quantity: 10,
      unit: "piece",
      hsn_code: "9901",
      gst_rate: 18,
      is_active: true
    };
    output.products = await postJson(api("products"), prod);
    console.log("Product result:", output.products);
  } catch (e) { console.error("Product API failed:", e); }
  // Insert a customer
  try {
    const cust = {
      name: "Customer QA",
      email: "qa@example.com",
      phone: "+911234567890",
      gstin: "GST9901QA",
      billing_address: "QATown 1",
      shipping_address: "QATown 2",
      notes: "Fake customer (test)"
    };
    output.customers = await postJson(api("customers"), cust);
    console.log("Customer result:", output.customers);
  } catch (e) { console.error("Customer API failed:", e); }
  // Insert an invoice
  try {
    // Use ids if returned from above, else random
    const prodId = output.products?.data?.product?.id || "p-id-test";
    const custId = output.customers?.data?.customer?.id || "c-id-test";
    const invoice = {
      customer_id: custId,
      invoice_number: "INV-1001",
      invoice_date: new Date().toISOString().split("T")[0],
      status: "draft",
      is_gst_invoice: true,
      subtotal: 99,
      cgst_amount: 10,
      sgst_amount: 10,
      igst_amount: 0,
      total_amount: 119,
      notes: "Test invoice",
      terms: "Net 7",
      items: [{
        id: "li-1",
        product_id: prodId,
        description: "Test Widget",
        quantity: 1,
        unit_price: 99,
        discount_percent: 0,
        gst_rate: 18,
        hsn_code: "9901",
        line_total: 99,
        gst_amount: 20,
      }],
      created_at: new Date().toISOString(),
    };
    output.invoices = await postJson(api("invoices"), invoice);
    console.log("Invoice result:", output.invoices);
  } catch (e) { console.error("Invoice API failed:", e); }
  return output;
}

run();
