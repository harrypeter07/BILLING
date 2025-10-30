"use client"

import * as XLSX from "xlsx"

// This will be used to maintain in-memory and on-device Excel sheet storage
class ExcelSheetManager {
  workbook: XLSX.WorkBook | null = null
  products: any[] = []
  customers: any[] = []
  employees: any[] = []
  invoices: any[] = []
  fh: any = null // FileSystemFileHandle reference
  isExcelMode = false
  subscribers: (() => void)[] = []

  subscribe(fn: () => void) {
    this.subscribers.push(fn)
    return () => { this.subscribers = this.subscribers.filter(f => f !== fn) }
  }

  notify() {
    for (const fn of this.subscribers) fn()
  }

  setExcelMode(active: boolean) {
    this.isExcelMode = active
    this.notify()
    console.log(`[excelSheetManager] Excel mode set:`, active)
  }

  get isActive() { return this.isExcelMode }

  async initializeExcelMode() {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{
            description: "Excel Workbook",
            accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
          }]
        })
        this.fh = fileHandle
        console.log("[excelSheetManager] Using opened Excel file handle", fileHandle)
        await this.loadAllFromExcel()
      } else {
        // fallback: prompt upload
        console.warn("[excelSheetManager] File System Access API not found - fallback to upload required")
        // UI should call loadAllFromExcel with user file
      }
      this.setExcelMode(true)
    } catch (e) {
      console.error("[excelSheetManager] Could not open Excel file. Excel mode not enabled.", e)
      this.setExcelMode(false)
      throw e
    }
  }

  async loadAllFromExcel(file?: File) {
    let arrayBuffer: ArrayBuffer
    if (file) {
      arrayBuffer = await file.arrayBuffer()
      console.log("[excelSheetManager] Loaded Excel from uploaded file")
    } else if (this.fh) {
      const file = await this.fh.getFile()
      arrayBuffer = await file.arrayBuffer()
      console.log("[excelSheetManager] Loaded Excel from file handle")
    } else {
      throw new Error("[excelSheetManager] No Excel file to load")
    }
    this.workbook = XLSX.read(arrayBuffer, { type: "array" })
    this.products = XLSX.utils.sheet_to_json(this.workbook.Sheets["Products"] || [], { defval: "" })
    this.customers = XLSX.utils.sheet_to_json(this.workbook.Sheets["Customers"] || [], { defval: "" })
    this.employees = XLSX.utils.sheet_to_json(this.workbook.Sheets["Employees"] || [], { defval: "" })
    this.invoices = XLSX.utils.sheet_to_json(this.workbook.Sheets["Invoices"] || [], { defval: "" })
    this.notify()
    console.log(`[excelSheetManager] Loaded all sheets from Excel. products/customers/employees/invoices:`, {
      products: this.products.length, customers: this.customers.length, employees: this.employees.length, invoices: this.invoices.length
    })
  }

  async persistAllToExcel() {
    try {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.products), "Products")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.customers), "Customers")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.employees), "Employees")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.invoices), "Invoices")
      this.workbook = wb
      if (this.fh && 'createWritable' in this.fh) {
        const writable = await this.fh.createWritable()
        const out = XLSX.write(wb, { type: "array", bookType: "xlsx" })
        await writable.write(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
        await writable.close()
        console.log("[excelSheetManager] Persisted Excel to file handle.")
      } else {
        XLSX.writeFile(wb, "BillingData.xlsx")
        console.log("[excelSheetManager] Persisted Excel to download (fallback).")
      }
    } catch (e) {
      console.error("[excelSheetManager] Persist error: ", e)
    }
  }

  ensureWorkbookIfNeeded() {
    if (!this.workbook) {
      console.log("[excelSheetManager] No workbook in memory: creating a new in-memory Excel workbook.")
      const wb = XLSX.utils.book_new()
      wb.SheetNames = ["Products", "Customers", "Employees", "Invoices"]
      wb.Sheets = {}
      wb.Sheets["Products"] = XLSX.utils.json_to_sheet([])
      wb.Sheets["Customers"] = XLSX.utils.json_to_sheet([])
      wb.Sheets["Employees"] = XLSX.utils.json_to_sheet([])
      wb.Sheets["Invoices"] = XLSX.utils.json_to_sheet([])
      this.workbook = wb
      this.products = []
      this.customers = []
      this.employees = []
      this.invoices = []
    }
  }

  // CRUD Generic methods for each entity
  getList(type: "products" | "customers" | "employees" | "invoices") { return this[type] }
  add(type: "products" | "customers" | "employees" | "invoices", item: any) {
    try {
      if (!this.workbook) this.ensureWorkbookIfNeeded()
      this[type].push(item)
      this.persistAllToExcel()
      this.notify()
      console.log(`[excelSheetManager] Added item to ${type}:`, item)
    } catch (e) {
      console.error(`[excelSheetManager] Add error on ${type}:`, e)
    }
  }
  update(type: "products" | "customers" | "employees" | "invoices", id: any, patch: any) {
    try {
      if (!this.workbook) this.ensureWorkbookIfNeeded()
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...patch }
        this.persistAllToExcel()
        this.notify()
        console.log(`[excelSheetManager] Updated item in ${type}:`, { id, patch })
      }
    } catch (e) {
      console.error(`[excelSheetManager] Update error on ${type}:`, e)
    }
  }
  remove(type: "products" | "customers" | "employees" | "invoices", id: any) {
    try {
      if (!this.workbook) this.ensureWorkbookIfNeeded()
      const arr = this[type]
      const idx = arr.findIndex((x: any) => x.id === id)
      if (idx !== -1) {
        arr.splice(idx, 1)
        this.persistAllToExcel()
        this.notify()
        console.log(`[excelSheetManager] Removed item from ${type}:`, id)
      }
    } catch (e) {
      console.error(`[excelSheetManager] Remove error on ${type}:`, e)
    }
  }
  // For UI to check if we're in excel mode
  isExcelModeActive() {
    return this.isExcelMode
  }
}

export const excelSheetManager = new ExcelSheetManager()


