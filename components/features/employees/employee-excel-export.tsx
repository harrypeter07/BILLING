"use client"

import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { storageManager } from "@/lib/storage-manager"
import { useState } from "react"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { db } from "@/lib/dexie-client"
import * as XLSX from "xlsx"

export function EmployeeExcelExport() {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExportEmployees = async () => {
    setIsExporting(true)
    try {
      const dbType = getDatabaseType()
      
      if (dbType === 'excel') {
        // In Excel mode, export from Dexie
        const employees = await db.employees.toArray()
        
        if (employees.length === 0) {
          toast({
            title: "No Data",
            description: "No employees found to export",
            variant: "destructive",
          })
          return
        }

        // Create workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(employees.map(emp => ({
          'Employee ID': emp.employee_id,
          'Name': emp.name,
          'Email': emp.email || '',
          'Phone': emp.phone || '',
          'Role': emp.role || 'employee',
          'Salary': emp.salary || '',
          'Joining Date': emp.joining_date || '',
          'Active': emp.is_active !== false,
          'Store ID': emp.store_id || '',
        })))
        
        XLSX.utils.book_append_sheet(wb, ws, "Employees")
        
        // Download
        const filename = `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`
        XLSX.writeFile(wb, filename)
        
        toast({
          title: "Export Successful",
          description: `Exported ${employees.length} employee(s) to ${filename}`,
        })
      } else {
        // In Database mode, use storageManager
        const result = await storageManager.saveNowToExcel()
        
        if (result.ok) {
          toast({
            title: "Export Successful",
            description: `Exported data to Excel`,
          })
        } else {
          toast({
            title: "Export Failed",
            description: result.error || "Failed to export to Excel",
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error?.message || "Failed to export employees",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExportEmployees}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <>
          <FileSpreadsheet className="h-4 w-4 animate-pulse" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export Employees
        </>
      )}
    </Button>
  )
}

