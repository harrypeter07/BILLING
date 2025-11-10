/**
 * Get MAC address of the device
 * 
 * In browser environment, we'll use a fallback approach since direct MAC access isn't available.
 * For Electron, this will be replaced with node-machine-id or os.networkInterfaces()
 * 
 * For now, we'll generate a device fingerprint based on available browser APIs.
 * In Electron, we'll use the actual MAC address.
 */

export async function getMacAddress(): Promise<string> {
  // Check if we're in Electron environment
  if (typeof window !== "undefined" && (window as any).electron) {
    // Electron environment - use actual MAC address
    try {
      const mac = await (window as any).electron.getMacAddress();
      return mac;
    } catch (error) {
      console.error("Error getting MAC address from Electron:", error);
    }
  }

  // Browser environment - generate device fingerprint
  // This is a fallback until Electron is integrated
  try {
    const fingerprint = await generateDeviceFingerprint();
    return fingerprint;
  } catch (error) {
    console.error("Error generating device fingerprint:", error);
    // Ultimate fallback
    return `browser-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Generate a device fingerprint for browser environments
 * This will be replaced with actual MAC address in Electron
 */
async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // User agent
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    components.push(navigator.userAgent);
  }

  // Screen resolution
  if (typeof screen !== "undefined") {
    components.push(`${screen.width}x${screen.height}`);
    components.push(screen.colorDepth?.toString() || "");
  }

  // Timezone
  if (typeof Intl !== "undefined") {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  // Language
  if (typeof navigator !== "undefined") {
    components.push(navigator.language || "");
  }

  // Hardware concurrency
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    components.push(navigator.hardwareConcurrency.toString());
  }

  // Platform
  if (typeof navigator !== "undefined" && navigator.platform) {
    components.push(navigator.platform);
  }

  // Get stored device ID or create one
  const storageKey = "device_fingerprint_id";
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, deviceId);
  }
  components.push(deviceId);

  // Create hash-like identifier
  const combined = components.join("|");
  const hash = await hashString(combined);
  
  // Format as MAC-like address (00:1A:2B:3C:4D:5E)
  return formatAsMacAddress(hash);
}

/**
 * Simple hash function for string
 */
async function hashString(str: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("Error hashing with crypto.subtle:", error);
    }
  }
  
  // Fallback hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Format hash as MAC address (00:1A:2B:3C:4D:5E)
 */
function formatAsMacAddress(hash: string): string {
  // Take first 12 characters and format as MAC
  const mac = hash.substring(0, 12).padEnd(12, "0");
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(mac.substring(i * 2, (i + 1) * 2));
  }
  return parts.join(":").toUpperCase();
}


