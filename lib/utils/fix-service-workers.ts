"use client"

/**
 * Comprehensive fix for service worker issues
 * Unregisters all service workers, clears caches, and reloads
 */
export async function fixServiceWorkers(): Promise<{
  success: boolean
  unregistered: number
  cachesCleared: number
  errors: string[]
}> {
  const errors: string[] = []
  let unregistered = 0
  let cachesCleared = 0

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      success: false,
      unregistered: 0,
      cachesCleared: 0,
      errors: ["Service workers not supported"],
    }
  }

  try {
    // Step 1: Unregister ALL service workers for this origin
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const currentOrigin = window.location.origin

      for (const registration of registrations) {
        // Only unregister service workers from this origin
        if (registration.scope.startsWith(currentOrigin)) {
          try {
            await registration.unregister()
            unregistered++
            console.log("[SW Fix] Unregistered:", registration.scope)
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            errors.push(`Failed to unregister ${registration.scope}: ${errorMsg}`)
            console.error("[SW Fix] Error unregistering:", err)
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Error getting registrations: ${errorMsg}`)
    }

    // Step 2: Clear ALL caches
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys()
        for (const cacheName of cacheNames) {
          try {
            await caches.delete(cacheName)
            cachesCleared++
            console.log("[SW Fix] Deleted cache:", cacheName)
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err)
            errors.push(`Failed to delete cache ${cacheName}: ${errorMsg}`)
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Error clearing caches: ${errorMsg}`)
    }

    // Step 3: Clear IndexedDB if needed (optional, more aggressive)
    // We'll skip this as it might delete user data

    return {
      success: errors.length === 0,
      unregistered,
      cachesCleared,
      errors,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      unregistered,
      cachesCleared,
      errors: [errorMsg],
    }
  }
}

/**
 * Fix and reload - does everything and reloads the page
 */
export async function fixServiceWorkersAndReload(): Promise<void> {
  const result = await fixServiceWorkers()
  console.log("[SW Fix] Cleanup result:", result)
  
  // Wait a moment for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Reload the page
  window.location.reload()
}

