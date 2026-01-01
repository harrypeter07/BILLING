// Enhanced Service Worker for Offline-First PWA
const CACHE_VERSION = "billing-solutions-v2"
const CACHE_NAME = `${CACHE_VERSION}-cache`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const OFFLINE_PAGE = "/offline.html"

// App Shell - critical routes that must work offline
const APP_SHELL = [
  "/",
  "/dashboard",
  "/invoices",
  "/invoices/new",
  "/products",
  "/products/new",
  "/customers",
  "/customers/new",
  "/employees",
  "/auth/login",
  OFFLINE_PAGE,
]

// Install event - cache app shell
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...")
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching app shell")
      return cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" })))
        .catch((err) => {
          console.warn("[SW] Some app shell files failed to cache:", err)
          // Continue even if some files fail
        })
    })
  )
  // Force activation of new service worker
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...")
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log("[SW] Deleting old cache:", cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Take control of all clients immediately
  return self.clients.claim()
})

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith("http")) {
    return
  }

  // API calls - NetworkFirst strategy
  if (url.pathname.startsWith("/api/") || url.pathname.includes("supabase.co")) {
    event.respondWith(networkFirst(request))
    return
  }

  // Static assets (JS, CSS, images) - CacheFirst strategy
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML pages and app routes - NetworkFirst with offline fallback
  if (request.headers.get("accept")?.includes("text/html") || url.pathname.startsWith("/")) {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // Default: try network, fallback to cache
  event.respondWith(networkFirst(request))
})

// NetworkFirst strategy - try network, fallback to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url)
  }

  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  // If it's a navigation request and we have no cache, return offline page
  if (request.mode === "navigate") {
    const offlinePage = await caches.match(OFFLINE_PAGE)
    if (offlinePage) {
      return offlinePage
    }
  }

  throw new Error("No cache available")
}

// CacheFirst strategy - try cache, fallback to network
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log("[SW] Cache and network both failed:", request.url)
    throw error
  }
}

// NetworkFirst with offline fallback for HTML pages
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    console.log("[SW] Network failed for page, trying cache:", request.url)
  }

  // Try cache
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  // For navigation requests, return offline page
  if (request.mode === "navigate") {
    const offlinePage = await caches.match(OFFLINE_PAGE)
    if (offlinePage) {
      return offlinePage
    }
  }

  // Last resort: return a basic offline response
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain" },
  })
}
