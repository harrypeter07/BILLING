import * as XLSX from "xlsx"
import type { Product, Invoice } from "./dexie-client"

async function writeToOPFS(filename: string, data: ArrayBuffer): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("storage" in navigator)) return false
    const anyNavigator: any = navigator as any
    const root = await anyNavigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  // Overwrite fully to avoid corrupted/hidden sheet views
  await writable.truncate(0)
  await writable.write(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  await writable.close()
    return true
  } catch {
    return false
  }
}

export async function autoSaveExcel(products: Product[], invoices: Invoice[], filename = "smartbill-data.xlsx") {
  try {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoices), "Invoices")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const saved = await writeToOPFS(filename, buf)
    return saved
  } catch {
    return false
  }
}


