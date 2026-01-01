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
      cachesCleared: 0,
      errors: [errorMsg],
    }
  }
}

/**
 * Fix and reload - does everything and reloads the page
 */
export async function fixServiceWorkersAndReload(): Promise<void> {
  console.log("[SW Fix] Starting comprehensive service worker cleanup...")
  
  const result = await fixServiceWorkers()
  console.log("[SW Fix] Cleanup result:", result)
  
  // Wait for all service workers to be fully unregistered
  let attempts = 0
  const maxAttempts = 10
  while (attempts < maxAttempts) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const currentOrigin = window.location.origin
      const appRegistrations = registrations.filter(reg => 
        reg.scope.startsWith(currentOrigin)
      )
      
      if (appRegistrations.length === 0) {
        console.log("[SW Fix] All service workers unregistered")
        break
      }
      
      console.log(`[SW Fix] Waiting for ${appRegistrations.length} service worker(s) to unregister... (attempt ${attempts + 1}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, 300))
      attempts++
    } catch (err) {
      console.error("[SW Fix] Error checking registrations:", err)
      break
    }
  }
  
  // Clear all caches one more time to be sure
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys()
      for (const cacheName of cacheNames) {
        try {
          await caches.delete(cacheName)
          console.log("[SW Fix] Final cache deletion:", cacheName)
        } catch (err) {
          // Ignore errors on final pass
        }
      }
    }
  } catch (err) {
    // Ignore errors
  }
  
  // Set a flag to prevent immediate re-registration
  sessionStorage.setItem("sw_cleanup_done", Date.now().toString())
  
  // Wait a bit more to ensure everything is cleaned up
  await new Promise(resolve => setTimeout(resolve, 500))
  
  console.log("[SW Fix] Cleanup complete, reloading page...")
  
  // Force a hard reload to bypass cache
  window.location.href = window.location.href.split('#')[0] + '?sw_cleanup=' + Date.now()
}

