"use client"

/**
 * Clean up all service workers for this app
 * This only affects service workers registered by this app, not other websites
 */
export async function cleanupServiceWorkers(): Promise<{
  success: boolean
  unregistered: number
  errors: string[]
}> {
  const errors: string[] = []
  let unregistered = 0

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { success: false, unregistered: 0, errors: ["Service workers not supported"] }
  }

  try {
    // Get all registered service workers
    const registrations = await navigator.serviceWorker.getRegistrations()

    // Unregister all service workers for this origin
    for (const registration of registrations) {
      try {
        // Only unregister service workers from this app
        if (
          registration.scope.includes(window.location.origin) ||
          registration.active?.scriptURL.includes("sw.js") ||
          registration.installing?.scriptURL.includes("sw.js") ||
          registration.waiting?.scriptURL.includes("sw.js")
        ) {
          await registration.unregister()
          unregistered++
          console.log("[SW Cleanup] Unregistered:", registration.scope)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        errors.push(`Failed to unregister ${registration.scope}: ${errorMsg}`)
        console.error("[SW Cleanup] Error unregistering:", err)
      }
    }

    // Clear all caches for this app
    try {
      const cacheNames = await caches.keys()
      for (const cacheName of cacheNames) {
        // Only delete caches that belong to this app
        if (cacheName.includes("billing-solutions")) {
          await caches.delete(cacheName)
          console.log("[SW Cleanup] Deleted cache:", cacheName)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to clear caches: ${errorMsg}`)
      console.error("[SW Cleanup] Error clearing caches:", err)
    }

    return {
      success: errors.length === 0,
      unregistered,
      errors,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      unregistered,
      errors: [errorMsg],
    }
  }
}

/**
 * Check if there are multiple service workers registered
 */
export async function checkServiceWorkerStatus(): Promise<{
  count: number
  registrations: Array<{ scope: string; state: string }>
}> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { count: 0, registrations: [] }
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const appRegistrations = registrations.filter((reg) =>
      reg.scope.includes(window.location.origin)
    )

    return {
      count: appRegistrations.length,
      registrations: appRegistrations.map((reg) => ({
        scope: reg.scope,
        state: reg.active?.state || reg.installing?.state || reg.waiting?.state || "unknown",
      })),
    }
  } catch (err) {
    console.error("[SW Status] Error checking status:", err)
    return { count: 0, registrations: [] }
  }
}

