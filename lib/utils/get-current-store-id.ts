/**
 * Utility to get the current active store ID
 * 
 * This is the SINGLE SOURCE OF TRUTH for getting the active store ID
 * Used by all queries to ensure proper store-scoped data isolation
 * 
 * Priority:
 * 1. Employee session store_id
 * 2. localStorage currentStoreId
 * 3. First store from admin's stores (fallback)
 * 
 * @returns Promise<string | null> - Current store ID or null if not found
 */
export async function getCurrentStoreId(): Promise<string | null> {
	if (typeof window === "undefined") {
		return null; // Server-side, return null
	}

	try {
		const authType = localStorage.getItem("authType");

		// For employees, get store from session
		if (authType === "employee") {
			const employeeSession = localStorage.getItem("employeeSession");
			if (employeeSession) {
				try {
					const session = JSON.parse(employeeSession);
					if (session.storeId) {
						return session.storeId;
					}
				} catch (e) {
					// Invalid session, continue to fallback
				}
			}
		}

		// Check localStorage for currentStoreId
		const storedStoreId = localStorage.getItem("currentStoreId");
		if (storedStoreId) {
			return storedStoreId;
		}

		// Fallback: Get first store for admin (only for Supabase mode)
		const dbType = localStorage.getItem("databaseType");
		if (dbType === "supabase") {
			const { createClient } = await import("@/lib/supabase/client");
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (user) {
				const { data: stores } = await supabase
					.from("stores")
					.select("id")
					.eq("admin_user_id", user.id)
					.limit(1);

				if (stores && stores.length > 0) {
					const storeId = stores[0].id;
					localStorage.setItem("currentStoreId", storeId);
					return storeId;
				}
			}
		} else {
			// IndexedDB mode - get from Dexie
			const { db } = await import("@/lib/dexie-client");
			const stores = await db.stores.toArray();
			if (stores && stores.length > 0) {
				const storeId = stores[0].id;
				localStorage.setItem("currentStoreId", storeId);
				return storeId;
			}
		}

		return null;
	} catch (error) {
		console.error("[getCurrentStoreId] Error:", error);
		return null;
	}
}

/**
 * Get current store ID synchronously (from localStorage only)
 * Use this when you need the store ID immediately without async operations
 * 
 * @returns string | null - Current store ID from localStorage or null
 */
export function getCurrentStoreIdSync(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const authType = localStorage.getItem("authType");

		// For employees, get store from session
		if (authType === "employee") {
			const employeeSession = localStorage.getItem("employeeSession");
			if (employeeSession) {
				try {
					const session = JSON.parse(employeeSession);
					if (session.storeId) {
						return session.storeId;
					}
				} catch (e) {
					// Invalid session, continue to fallback
				}
			}
		}

		// Check localStorage for currentStoreId
		return localStorage.getItem("currentStoreId");
	} catch (error) {
		console.error("[getCurrentStoreIdSync] Error:", error);
		return null;
	}
}

