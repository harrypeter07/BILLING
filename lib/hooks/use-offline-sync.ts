"use client";

import { useEffect, useState } from "react";

/**
 * Offline sync hook - DISABLED
 *
 * Note: Sync functionality is disabled because IndexedDB and Supabase
 * are now separate modes with different plans. No cross-mode sync.
 */
export function useOfflineSync() {
	const [isSyncing, setIsSyncing] = useState(false);
	const [isOnline, setIsOnline] = useState(true);
	const [syncQueueCount, setSyncQueueCount] = useState(0);

	useEffect(() => {
		// Sync is disabled - IndexedDB and Supabase are separate modes
		// Only track online/offline status for UI purposes
		setIsOnline(navigator.onLine);

		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return { isSyncing, isOnline, syncQueueCount };
}
