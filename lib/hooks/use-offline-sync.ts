"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/db/dexie"
import { syncManager } from "@/lib/sync/sync-manager"

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [syncQueueCount, setSyncQueueCount] = useState(0)

  useEffect(() => {
    // Initialize sync manager
    syncManager.initialize()

    // Update online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Monitor sync queue
    const interval = setInterval(async () => {
      const count = await db.sync_queue.count()
      setSyncQueueCount(count)
    }, 2000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
      syncManager.destroy()
    }
  }, [])

  return { isSyncing, isOnline, syncQueueCount }
}
