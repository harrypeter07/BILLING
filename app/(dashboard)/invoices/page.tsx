import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { InvoicesTable } from "@/components/features/invoices/invoices-table"
import { excelSheetManager } from "@/lib/utils/excel-sync-controller";
import { fetchInvoices } from "@/lib/api/invoices"

export default async function InvoicesPage() {
  if (excelSheetManager.isExcelModeActive && excelSheetManager.isExcelModeActive()) {
    // Prefer fetching via API so we reflect files saved in /data
    let invoices: any[] = []
    try {
      invoices = await fetchInvoices()
      console.log('[InvoicesPage][Excel] fetched', invoices?.length || 0, 'invoices from /api/excel/invoices')
    } catch (e) {
      console.error('[InvoicesPage][Excel] fetch failed:', e)
      invoices = excelSheetManager.getList("invoices")
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Create and manage your invoices</p>
          </div>
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        </div>
        {(!invoices || invoices.length === 0) && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            No invoices found in data/Invoices.xlsx
          </div>
        )}
        <InvoicesTable invoices={invoices || []} />
      </div>
    );
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and manage your invoices</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <InvoicesTable invoices={invoices || []} />
    </div>
  )
}
