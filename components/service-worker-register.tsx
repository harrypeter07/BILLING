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
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          })

          console.log("[SW] Service Worker registered:", registration.scope)

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
        }
      }

      // Register immediately
      registerSW()

      // Also register when page becomes visible (in case it was backgrounded)
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          registerSW()
        }
      })
    } else {
      console.warn("[SW] Service Workers are not supported in this browser")
    }
  }, [])

  return null
}

