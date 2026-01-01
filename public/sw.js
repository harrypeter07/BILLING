'use strict';

// Enhanced Service Worker for Offline-First PWA
const CACHE_VERSION = 'billing-solutions-v2';
const CACHE_NAME = CACHE_VERSION + '-cache';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';
const OFFLINE_PAGE = '/offline.html';

// App Shell - critical routes that must work offline
const APP_SHELL = [
  '/',
  '/dashboard',
  '/invoices',
  '/invoices/new',
  '/products',
  '/products/new',
  '/customers',
  '/customers/new',
  '/employees',
  '/auth/login',
  OFFLINE_PAGE,
];

// Install event - cache app shell
self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (function() {
      return new Promise(function(resolve, reject) {
        caches.open(CACHE_NAME).then(function(cache) {
          console.log('[SW] Caching app shell');
          
          var cachePromises = [];
          for (var i = 0; i < APP_SHELL.length; i++) {
            var url = APP_SHELL[i];
            cachePromises.push(
              cache.add(url).catch(function(err) {
                console.warn('[SW] Failed to cache ' + url + ':', err.message || err);
                return null;
              })
            );
          }
          
          Promise.all(cachePromises).then(function() {
            console.log('[SW] App shell caching completed');
            return self.skipWaiting();
          }).then(resolve).catch(function(err) {
            console.error('[SW] Install error:', err);
            self.skipWaiting().then(resolve).catch(reject);
          });
        }).catch(function(err) {
          console.error('[SW] Cache open error:', err);
          self.skipWaiting().then(resolve).catch(reject);
        });
      });
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (function() {
      return new Promise(function(resolve, reject) {
        caches.keys().then(function(cacheNames) {
          var deletePromises = [];
          for (var i = 0; i < cacheNames.length; i++) {
            var cacheName = cacheNames[i];
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              deletePromises.push(caches.delete(cacheName));
            }
          }
          return Promise.all(deletePromises);
        }).then(function() {
          return self.clients.claim();
        }).then(function() {
          console.log('[SW] Service worker activated');
          resolve();
        }).catch(function(err) {
          console.error('[SW] Activate error:', err);
          resolve(); // Still resolve to activate the worker
        });
      });
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API calls - NetworkFirst strategy
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (JS, CSS, images) - CacheFirst strategy
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages and app routes - NetworkFirst with offline fallback
  var acceptHeader = request.headers.get('accept');
  if ((acceptHeader && acceptHeader.includes('text/html')) || url.pathname.startsWith('/')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(networkFirst(request));
});

// NetworkFirst strategy - try network, fallback to cache
function networkFirst(request) {
  return fetch(request).then(function(networkResponse) {
    if (networkResponse && networkResponse.status === 200) {
      var responseClone = networkResponse.clone();
      caches.open(RUNTIME_CACHE).then(function(cache) {
        cache.put(request, responseClone).catch(function() {
          // Ignore cache errors
        });
      });
      return networkResponse;
    }
    throw new Error('Network response not ok');
  }).catch(function() {
    console.log('[SW] Network failed, trying cache:', request.url);
    return caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      // If it's a navigation request and we have no cache, return offline page
      if (request.mode === 'navigate') {
        return caches.match(OFFLINE_PAGE).then(function(offlinePage) {
          if (offlinePage) {
            return offlinePage;
          }
          throw new Error('No cache available');
        });
      }
      throw new Error('No cache available');
    });
  });
}

// CacheFirst strategy - try cache, fallback to network
function cacheFirst(request) {
  return caches.match(request).then(function(cachedResponse) {
    if (cachedResponse) {
      return cachedResponse;
    }
    return fetch(request).then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200) {
        var responseClone = networkResponse.clone();
        caches.open(RUNTIME_CACHE).then(function(cache) {
          cache.put(request, responseClone).catch(function() {
            // Ignore cache errors
          });
        });
      }
      return networkResponse;
    }).catch(function(error) {
      console.log('[SW] Cache and network both failed:', request.url);
      throw error;
    });
  });
}

// NetworkFirst with offline fallback for HTML pages
function networkFirstWithOfflineFallback(request) {
  return fetch(request).then(function(networkResponse) {
    if (networkResponse && networkResponse.status === 200) {
      var responseClone = networkResponse.clone();
      caches.open(RUNTIME_CACHE).then(function(cache) {
        cache.put(request, responseClone).catch(function() {
          // Ignore cache errors
        });
      });
      return networkResponse;
    }
    throw new Error('Network response not ok');
  }).catch(function() {
    console.log('[SW] Network failed for page, trying cache:', request.url);
    return caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      // For navigation requests, return offline page
      if (request.mode === 'navigate') {
        return caches.match(OFFLINE_PAGE).then(function(offlinePage) {
          if (offlinePage) {
            return offlinePage;
          }
          // Last resort: return a basic offline response
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      }
      // Last resort: return a basic offline response
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    });
  });
}
