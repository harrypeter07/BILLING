# Billing Solutions - Data Schema and Excel Import Formats

## Schema (Dexie / Offline)
- Products (`products`): id, name, sku?, category?, price, cost_price?, stock_quantity?, unit?, hsn_code?, gst_rate?, is_active?
- Customers (`customers`): id, name, email?, phone?, gstin?, billing_address?, shipping_address?, notes?
- Invoices (`invoices`): id, customer_id, invoice_number, invoice_date (YYYY-MM-DD), status, is_gst_invoice, subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, notes?, terms?, created_at (ISO)
- Invoice Items (`invoice_items`): id, invoice_id, product_id?, description, quantity, unit_price, discount_percent, gst_rate, hsn_code?, line_total, gst_amount, created_at (ISO)
- Employees (`employees`): id, name, email, phone, role (admin|employee), salary, joining_date (YYYY-MM-DD or ISO), is_active
- Settings (`settings`): id, invoice_prefix?, next_invoice_number?
- FS Handles (`fsHandles`): key (stores File System Access handle)

## Excel Export/Sync
- One workbook with sheets: Products, Customers, Invoices, InvoiceItems, Employees
- File is fully overwritten on save for MS Excel compatibility

## Excel Import (first sheet of the workbook)
- Products: columns (case-insensitive)
  - Product Name/name, SKU/sku?, Category/category?, Price/price, Cost Price/cost_price?, Stock Quantity/stock_quantity?, Unit/unit?, HSN Code/hsn_code?, GST Rate/gst_rate?, Active/is_active (Yes/No)
- Customers: columns (case-insensitive)
  - Name/name, Email/email?, Phone/phone?, GSTIN/gstin?, Billing Address/billing_address?, Shipping Address/shipping_address?, Notes/notes?
- Employees: columns (case-insensitive)
  - Name/name, Email/email, Phone/phone, Role/role (admin|employee), Salary/salary, Joining Date/joining_date, Active/is_active (Yes/No)
- Invoices (basic, without line items): columns
  - CustomerId/customer_id, Invoice Number/invoice_number, Invoice Date/invoice_date (YYYY-MM-DD), Status/status, GST Invoice/is_gst_invoice (Yes/No), Subtotal/subtotal, CGST Amount/cgst_amount, SGST Amount/sgst_amount, IGST Amount/igst_amount, Total Amount/total_amount, Notes/notes?, Terms/terms?

Notes:
- Imports currently insert rows into Dexie; autosync writes them to the connected Excel file.
- Basic Invoices import does not include line items.
