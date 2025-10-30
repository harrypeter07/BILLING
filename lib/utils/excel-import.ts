import * as XLSX from "xlsx"

export interface ImportResult {
  success: boolean
  data: any[]
  errors: string[]
}

export async function importProductsFromExcel(file: File): Promise<ImportResult> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    const errors: string[] = []
    const products = data
      .map((row: any, index: number) => {
        try {
          return {
            name: row["Product Name"] || row.name,
            sku: row.SKU || row.sku || "",
            category: row.Category || row.category || "",
            price: Number.parseFloat(row.Price || row.price || 0),
            cost_price: Number.parseFloat(row["Cost Price"] || row.cost_price || 0),
            stock_quantity: Number.parseInt(row["Stock Quantity"] || row.stock_quantity || 0),
            unit: row.Unit || row.unit || "piece",
            hsn_code: row["HSN Code"] || row.hsn_code || "",
            gst_rate: Number.parseFloat(row["GST Rate"] || row.gst_rate || 18),
            is_active: (row.Active || row.is_active || "Yes").toLowerCase() === "yes",
          }
        } catch (error) {
          errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid data"}`)
          return null
        }
      })
      .filter((p) => p !== null)

    return {
      success: errors.length === 0,
      data: products,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [error instanceof Error ? error.message : "Failed to import file"],
    }
  }
}
