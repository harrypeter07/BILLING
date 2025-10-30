import { db, type SyncQueue } from "@/lib/db/dexie"
import { createClient } from "@/lib/supabase/client"

export class SyncManager {
  private supabase = createClient()
  private isSyncing = false
  private syncInterval: NodeJS.Timeout | null = null

  async initialize() {
    // Start sync interval (every 30 seconds if online)
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncAll()
      }
    }, 30000)

    // Listen for online/offline events
    window.addEventListener("online", () => this.syncAll())

    // Initial sync if online
    if (navigator.onLine) {
      this.syncAll()
    }
  }

  async syncAll() {
    if (this.isSyncing) return

    this.isSyncing = true

    try {
      // 1. Process sync queue (push local changes)
      await this.processSyncQueue()

      // 2. Pull remote changes
      await this.pullRemoteChanges()
    } catch (error) {
      console.error("[v0] Sync error:", error)
    } finally {
      this.isSyncing = false
    }
  }

  private async processSyncQueue() {
    const queue = await db.sync_queue.orderBy("created_at").toArray()

    for (const item of queue) {
      try {
        await this.syncItem(item)
        await db.sync_queue.delete(item.id!)
      } catch (error) {
        console.error("[v0] Failed to sync item:", error)

        // Increment retry count
        await db.sync_queue.update(item.id!, {
          retry_count: item.retry_count + 1,
        })

        // Give up after 5 retries
        if (item.retry_count >= 5) {
          console.error("[v0] Max retries reached, removing from queue:", item)
          await db.sync_queue.delete(item.id!)
        }
      }
    }
  }

  private async syncItem(item: SyncQueue) {
    const { entity_type, entity_id, action, data } = item

    switch (entity_type) {
      case "product":
        if (action === "create" || action === "update") {
          await this.supabase.from("products").upsert(data)
        } else if (action === "delete") {
          await this.supabase.from("products").delete().eq("id", entity_id)
        }
        break

      case "customer":
        if (action === "create" || action === "update") {
          await this.supabase.from("customers").upsert(data)
        } else if (action === "delete") {
          await this.supabase.from("customers").delete().eq("id", entity_id)
        }
        break

      case "invoice":
        if (action === "create" || action === "update") {
          // Upsert invoice header
          await this.supabase.from("invoices").upsert(data)
          // Sync items from IndexedDB for this invoice
          const items = await db.invoice_items.where("invoice_id").equals(entity_id).toArray()
          // Replace items remotely
          if (items.length > 0) {
            await this.supabase.from("invoice_items").delete().eq("invoice_id", entity_id)
            await this.supabase.from("invoice_items").insert(
              items.map((it) => ({
                invoice_id: it.invoice_id,
                product_id: it.product_id,
                description: it.description,
                quantity: it.quantity,
                unit_price: it.unit_price,
                discount_percent: it.discount_percent,
                gst_rate: it.gst_rate,
                hsn_code: it.hsn_code,
                line_total: it.line_total,
                gst_amount: it.gst_amount,
              })),
            )
          }
        } else if (action === "delete") {
          await this.supabase.from("invoices").delete().eq("id", entity_id)
          await this.supabase.from("invoice_items").delete().eq("invoice_id", entity_id)
        }
        break
    }

    // Mark as synced in IndexedDB
    await this.markAsSynced(entity_type, entity_id)
  }

  private async markAsSynced(entity_type: string, entity_id: string) {
    switch (entity_type) {
      case "product":
        await db.products.update(entity_id, { is_synced: true })
        break
      case "customer":
        await db.customers.update(entity_id, { is_synced: true })
        break
      case "invoice":
        await db.invoices.update(entity_id, { is_synced: true })
        break
    }
  }

  private async pullRemoteChanges() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser()
    if (!user) return

    // Fetch updated products
    const { data: products } = await this.supabase.from("products").select("*").eq("user_id", user.id)

    if (products) {
      await db.products.bulkPut(
        products.map((p) => ({
          ...p,
          is_synced: true,
          deleted: false,
        })),
      )
    }

    // Fetch updated customers
    const { data: customers } = await this.supabase.from("customers").select("*").eq("user_id", user.id)

    if (customers) {
      await db.customers.bulkPut(
        customers.map((c) => ({
          ...c,
          is_synced: true,
          deleted: false,
        })),
      )
    }

    // Fetch updated invoices
    const { data: invoices } = await this.supabase.from("invoices").select("*").eq("user_id", user.id)

    if (invoices) {
      await db.invoices.bulkPut(
        invoices.map((i) => ({
          ...i,
          is_synced: true,
          deleted: false,
        })),
      )
    }
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }
}

// Singleton instance
export const syncManager = new SyncManager()
