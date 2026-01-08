# RLS CRUD Operations Verification

## ✅ All CRUD Operations Covered

### Products
- ✅ **SELECT**: `"Store members read products"` (SELECT)
- ✅ **INSERT**: `"Store members insert products"` (INSERT)
- ✅ **UPDATE**: `"Store members manage products"` (ALL - includes UPDATE)
- ✅ **DELETE**: `"Store members manage products"` (ALL - includes DELETE)

### Customers
- ✅ **SELECT**: `"Store members read customers"` (SELECT)
- ✅ **INSERT**: `"Store members insert customers"` (INSERT)
- ✅ **UPDATE**: `"Store members manage customers"` (ALL - includes UPDATE)
- ✅ **DELETE**: `"Store members manage customers"` (ALL - includes DELETE)

### Invoices
- ✅ **SELECT**: `"Store members manage invoices"` (ALL - includes SELECT)
- ✅ **INSERT**: `"Store members insert invoices"` (INSERT)
- ✅ **UPDATE**: `"Store members manage invoices"` (ALL - includes UPDATE)
- ✅ **DELETE**: `"Store members manage invoices"` (ALL - includes DELETE)

### Invoice Items
- ✅ **ALL**: `"Store members manage invoice items"` (ALL - covers SELECT, INSERT, UPDATE, DELETE)

### Invoice Sequences
- ✅ **ALL**: `"Store members manage invoice sequences"` (ALL - covers SELECT, INSERT, UPDATE, DELETE)

## 🔧 Fix Applied

Fixed WITH CHECK clauses in INSERT and UPDATE policies to use explicit table column references:
- Changed from: `user_id`, `store_id` (ambiguous)
- Changed to: `products.user_id`, `products.store_id`, `customers.user_id`, `customers.store_id` (explicit)

This ensures PostgreSQL correctly identifies which columns to check in the WITH CHECK clauses.

## 📋 Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| products | ✅ | ✅ | ✅ | ✅ |
| customers | ✅ | ✅ | ✅ | ✅ |
| invoices | ✅ | ✅ | ✅ | ✅ |
| invoice_items | ✅ | ✅ | ✅ | ✅ |
| invoice_sequences | ✅ | ✅ | ✅ | ✅ |

All CRUD operations are now properly covered with RLS policies!
