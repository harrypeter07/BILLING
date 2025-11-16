/**
 * Get MAC address of the device
 * 
 * In browser environment, we'll use a fallback approach since direct MAC access isn't available.
 * We generate a device fingerprint based on available browser APIs.
 */

export async function getMacAddress(): Promise<string> {
  // Check if we're in Electron environment
  if (typeof window !== "undefined" && (window as any).electron) {
    try {
      const mac = await (window as any).electron.getMacAddress();
      if (mac) return mac;
    } catch (error) {
      console.error("Error getting MAC address from Electron:", error);
    }
  }

  // Browser environment - generate device fingerprint with timeout
  try {
    const fingerprint = await Promise.race([
      generateDeviceFingerprint(),
      new Promise<string>((resolve) => {
        setTimeout(() => {
          resolve(generateSimpleFingerprint());
        }, 2000); // 2 second timeout
      }),
    ]);
    return fingerprint;
  } catch (error) {
    console.error("Error generating device fingerprint:", error);
    // Ultimate fallback - simple and fast
    return generateSimpleFingerprint();
  }
}

/**
 * Generate a simple device fingerprint (fast, no crypto operations)
 */
function generateSimpleFingerprint(): string {
  const storageKey = "device_fingerprint_id";
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    // Generate a simple but unique ID
    const components: string[] = [];
    
    if (typeof navigator !== "undefined") {
      components.push(navigator.userAgent || "");
      components.push(navigator.language || "");
      components.push(navigator.platform || "");
    }
    
    if (typeof screen !== "undefined") {
      components.push(`${screen.width}x${screen.height}`);
    }
    
    const baseString = components.join("|") + Date.now().toString();
    // Simple hash
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    deviceId = `device-${Math.abs(hash).toString(16)}-${Date.now().toString(36)}`;
    try {
      localStorage.setItem(storageKey, deviceId);
    } catch (e) {
      console.warn("Could not store device ID:", e);
    }
  }
  
  // Format as MAC-like address
  const hashStr = deviceId.replace(/[^0-9a-f]/gi, "").substring(0, 12).padEnd(12, "0");
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(hashStr.substring(i * 2, (i + 1) * 2));
  }
  return parts.join(":").toUpperCase();
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
    try {
      localStorage.setItem(storageKey, deviceId);
    } catch (e) {
      console.warn("Could not store device ID:", e);
    }
  }
  components.push(deviceId);

  // Create hash-like identifier with timeout protection
  const combined = components.join("|");
  let hash: string;
  
  try {
    hash = await Promise.race([
      hashString(combined),
      new Promise<string>((resolve) => {
        setTimeout(() => {
          // Fallback to simple hash if crypto.subtle takes too long
          let simpleHash = 0;
          for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            simpleHash = ((simpleHash << 5) - simpleHash) + char;
            simpleHash = simpleHash & simpleHash;
          }
          resolve(Math.abs(simpleHash).toString(16));
        }, 1000); // 1 second timeout for crypto operation
      }),
    ]);
  } catch (error) {
    console.error("Error hashing, using simple hash:", error);
    // Fallback to simple hash
    let simpleHash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      simpleHash = ((simpleHash << 5) - simpleHash) + char;
      simpleHash = simpleHash & simpleHash;
    }
    hash = Math.abs(simpleHash).toString(16);
  }
  
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


