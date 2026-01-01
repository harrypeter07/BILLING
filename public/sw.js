"use strict";

// Enhanced Service Worker for Offline-First PWA
var CACHE_VERSION = "billing-solutions-v2";
var CACHE_NAME = CACHE_VERSION + "-cache";
var RUNTIME_CACHE = CACHE_VERSION + "-runtime";
var OFFLINE_PAGE = "/offline.html";

// App Shell - critical routes that must work offline
var APP_SHELL = [
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
];

// Install event - cache app shell
self.addEventListener("install", function (event) {
	console.log("[SW] Installing service worker...");

	event.waitUntil(
		(function () {
			return new Promise(function (resolve) {
				caches
					.open(CACHE_NAME)
					.then(function (cache) {
						console.log("[SW] Caching app shell");

						var promises = [];
						for (var i = 0; i < APP_SHELL.length; i++) {
							var url = APP_SHELL[i];
							promises.push(
								cache.add(url).catch(function (err) {
									console.warn(
										"[SW] Failed to cache " + url + ":",
										err.message || err
									);
									return null;
								})
							);
						}

						Promise.all(promises)
							.then(function () {
								console.log("[SW] App shell caching completed");
								return self.skipWaiting();
							})
							.then(resolve)
							.catch(function (err) {
								console.error("[SW] Install error:", err);
								self
									.skipWaiting()
									.then(resolve)
									.catch(function () {
										resolve(); // Always resolve
									});
							});
					})
					.catch(function (err) {
						console.error("[SW] Cache open error:", err);
						self
							.skipWaiting()
							.then(resolve)
							.catch(function () {
								resolve(); // Always resolve
							});
					});
			});
		})()
	);
});

// Activate event - clean up old caches
self.addEventListener("activate", function (event) {
	console.log("[SW] Activating service worker...");

	event.waitUntil(
		(function () {
			return new Promise(function (resolve) {
				caches
					.keys()
					.then(function (cacheNames) {
						var deletes = [];
						for (var i = 0; i < cacheNames.length; i++) {
							var name = cacheNames[i];
							if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
								console.log("[SW] Deleting old cache:", name);
								deletes.push(caches.delete(name));
							}
						}
						return Promise.all(deletes);
					})
					.then(function () {
						return self.clients.claim();
					})
					.then(function () {
						console.log("[SW] Service worker activated");
						resolve();
					})
					.catch(function (err) {
						console.error("[SW] Activate error:", err);
						resolve(); // Always resolve
					});
			});
		})()
	);
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", function (event) {
	var request = event.request;
	var url;

	try {
		url = new URL(request.url);
	} catch (e) {
		return; // Invalid URL, skip
	}

	// Skip non-GET requests
	if (request.method !== "GET") {
		return;
	}

	// Skip non-http protocols
	if (!url.protocol || !url.protocol.startsWith("http")) {
		return;
	}

	// API calls - NetworkFirst strategy
	if (
		url.pathname &&
		(url.pathname.indexOf("/api/") === 0 ||
			url.pathname.indexOf("supabase.co") !== -1)
	) {
		event.respondWith(networkFirst(request));
		return;
	}

	// Static assets (JS, CSS, images) - CacheFirst strategy
	var isStaticAsset = false;
	if (url.pathname) {
		var extMatch = url.pathname.match(
			/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
		);
		isStaticAsset =
			extMatch !== null || url.pathname.indexOf("/_next/static/") === 0;
	}

	if (isStaticAsset) {
		event.respondWith(cacheFirst(request));
		return;
	}

	// HTML pages and app routes - NetworkFirst with offline fallback
	var acceptHeader = request.headers ? request.headers.get("accept") : null;
	var isHtml = acceptHeader && acceptHeader.indexOf("text/html") !== -1;
	var isAppRoute = url.pathname && url.pathname.indexOf("/") === 0;

	if (isHtml || isAppRoute) {
		event.respondWith(networkFirstWithOfflineFallback(request));
		return;
	}

	// Default: try network, fallback to cache
	event.respondWith(networkFirst(request));
});

// NetworkFirst strategy - try network, fallback to cache
function networkFirst(request) {
	return fetch(request)
		.then(function (networkResponse) {
			if (networkResponse && networkResponse.status === 200) {
				var clone = networkResponse.clone();
				caches.open(RUNTIME_CACHE).then(function (cache) {
					cache.put(request, clone).catch(function () {
						// Ignore cache errors
					});
				});
				return networkResponse;
			}
			throw new Error("Network response not ok");
		})
		.catch(function () {
			console.log("[SW] Network failed, trying cache:", request.url);
			return caches.match(request).then(function (cached) {
				if (cached) {
					return cached;
				}
				if (request.mode === "navigate") {
					return caches.match(OFFLINE_PAGE).then(function (offline) {
						if (offline) {
							return offline;
						}
						throw new Error("No cache available");
					});
				}
				throw new Error("No cache available");
			});
		});
}

// CacheFirst strategy - try cache, fallback to network
function cacheFirst(request) {
	return caches.match(request).then(function (cached) {
		if (cached) {
			return cached;
		}
		return fetch(request)
			.then(function (networkResponse) {
				if (networkResponse && networkResponse.status === 200) {
					var clone = networkResponse.clone();
					caches.open(RUNTIME_CACHE).then(function (cache) {
						cache.put(request, clone).catch(function () {
							// Ignore cache errors
						});
					});
				}
				return networkResponse;
			})
			.catch(function (error) {
				console.log("[SW] Cache and network both failed:", request.url);
				throw error;
			});
	});
}

// NetworkFirst with offline fallback for HTML pages
function networkFirstWithOfflineFallback(request) {
	return fetch(request)
		.then(function (networkResponse) {
			if (networkResponse && networkResponse.status === 200) {
				var clone = networkResponse.clone();
				caches.open(RUNTIME_CACHE).then(function (cache) {
					cache.put(request, clone).catch(function () {
						// Ignore cache errors
					});
				});
				return networkResponse;
			}
			throw new Error("Network response not ok");
		})
		.catch(function () {
			console.log("[SW] Network failed for page, trying cache:", request.url);
			return caches.match(request).then(function (cached) {
				if (cached) {
					return cached;
				}
				if (request.mode === "navigate") {
					return caches.match(OFFLINE_PAGE).then(function (offline) {
						if (offline) {
							return offline;
						}
						return new Response("Offline", {
							status: 503,
							statusText: "Service Unavailable",
							headers: { "Content-Type": "text/plain" },
						});
					});
				}
				return new Response("Offline", {
					status: 503,
					statusText: "Service Unavailable",
					headers: { "Content-Type": "text/plain" },
				});
			});
		});
}
