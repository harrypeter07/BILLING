"use client"

import { useEffect } from "react"

/**
 * Service Worker Registration Component
 * Registers the service worker for PWA offline functionality
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Only register in browser, not in Electron
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      console.log("[SW] Skipping service worker registration in Electron")
      return
    }

    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          // Check if we're offline and already have a service worker
          const isOnline = navigator.onLine
          const existingRegistrations = await navigator.serviceWorker.getRegistrations()
          const currentOrigin = window.location.origin
          
          // Find registrations for this app
          const appRegistrations = existingRegistrations.filter((reg) => {
            const isSameOrigin = reg.scope.startsWith(currentOrigin)
            const isOurSW = reg.active?.scriptURL.includes("sw.js") ||
                           reg.installing?.scriptURL.includes("sw.js") ||
                           reg.waiting?.scriptURL.includes("sw.js")
            return isSameOrigin && isOurSW
          })

          // If we have exactly one active registration, check if it's working
          if (appRegistrations.length === 1) {
            const existing = appRegistrations[0]
            if (existing.active && existing.active.state === "activated") {
              console.log("[SW] Service worker already registered and active:", existing.scope)
              return // Don't register again
            }
          }

          // If offline and we have any registration, don't try to register new one
          if (!isOnline && appRegistrations.length > 0) {
            console.log("[SW] Offline and service worker exists, skipping registration")
            return
          }

          // If offline and no registration exists, we can't register (need sw.js file)
          if (!isOnline && appRegistrations.length === 0) {
            console.warn("[SW] Offline and no service worker found. Cannot register without network.")
            return
          }

          // If we have multiple or broken registrations, clean them up (only when online)
          if (isOnline && (appRegistrations.length > 1 || (appRegistrations.length === 1 && !appRegistrations[0].active))) {
            console.log(`[SW] Found ${appRegistrations.length} registration(s), cleaning up...`)
            for (const registration of appRegistrations) {
              try {
                await registration.unregister()
                console.log("[SW] Unregistered:", registration.scope)
              } catch (err) {
                console.warn("[SW] Failed to unregister:", err)
              }
            }
            // Wait a bit for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          // Only register when online (or if sw.js is cached)
          if (!isOnline) {
            console.log("[SW] Skipping registration - offline")
            return
          }

          // Try to fetch the service worker file first to check if it's accessible
          try {
            const swResponse = await fetch("/sw.js", { cache: "no-store" })
            if (!swResponse.ok) {
              console.error("[SW] Service worker file not accessible:", swResponse.status)
              return
            }
            const swText = await swResponse.text()
            if (!swText || swText.trim().length === 0) {
              console.error("[SW] Service worker file is empty")
              return
            }
          } catch (fetchError) {
            console.error("[SW] Failed to fetch service worker file:", fetchError)
            return
          }

          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none", // Always check for updates
          })

          console.log("[SW] Service Worker registered:", registration.scope)

          // Wait for service worker to be ready
          if (registration.installing) {
            registration.installing.addEventListener("statechange", (e) => {
              const worker = e.target as ServiceWorker
              if (worker.state === "activated") {
                console.log("[SW] Service worker activated successfully")
              } else if (worker.state === "redundant") {
                console.error("[SW] Service worker became redundant")
              }
            })
          }

          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[SW] New service worker available")
                  // Optionally show update notification to user
                }
              })
            }
          })

          // Handle service worker updates
          let refreshing = false
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
              refreshing = true
              console.log("[SW] New service worker activated")
              // Note: We avoid reload here to maintain offline-first behavior
              // The new service worker will be active on next page navigation
            }
          })
        } catch (error) {
          console.error("[SW] Service Worker registration failed:", error)
          // Log more details about the error
          if (error instanceof Error) {
            console.error("[SW] Error details:", {
              message: error.message,
              stack: error.stack,
              name: error.name,
            })
          } else {
            // Handle non-Error objects
            console.error("[SW] Error details (non-Error):", {
              error,
              type: typeof error,
              stringified: String(error),
            })
          }
        }
      }

      // Register after a short delay to ensure page is fully loaded
      setTimeout(() => {
        registerSW()
      }, 100)

      // Also register when page becomes visible (in case it was backgrounded)
      // But only if online
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && navigator.onLine) {
          setTimeout(() => registerSW(), 100)
        }
      })

      // Listen for online event to register when connection is restored
      window.addEventListener("online", () => {
        console.log("[SW] Connection restored, checking service worker...")
        setTimeout(() => registerSW(), 500)
      })
    } else {
      console.warn("[SW] Service Workers are not supported in this browser")
    }
  }, [])

  return null
}

