import { db, type License } from "@/lib/db/dexie";
import { encryptLicenseData, decryptLicenseData } from "./license-encryption";
import { getMacAddress } from "./mac-address";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db as firestoreDb } from "@/lib/firebase";

export interface LicenseInfo {
  licenseKey: string;
  macAddress: string;
  clientName: string;
  activatedOn: string;
  expiresOn: string;
  status: "active" | "expired" | "revoked";
}

/**
 * Validate license against Firestore
 */
export async function validateLicenseOnline(
  licenseKey: string,
  macAddress: string
): Promise<{ valid: boolean; licenseData?: LicenseInfo; error?: string }> {
  try {
    const licensesRef = collection(firestoreDb, "licenses");
    const q = query(
      licensesRef,
      where("licenseKey", "==", licenseKey),
      where("macAddress", "==", macAddress),
      where("status", "==", "active")
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { valid: false, error: "License not found or inactive" };
    }

    const licenseDoc = querySnapshot.docs[0];
    const licenseData = licenseDoc.data();

    // Check if license is expired
    const expiresOn = licenseData.expiresOn?.toDate?.() || new Date(licenseData.expiresOn);
    const now = new Date();

    if (expiresOn < now) {
      return { valid: false, error: "License has expired" };
    }

    const licenseInfo: LicenseInfo = {
      licenseKey: licenseData.licenseKey,
      macAddress: licenseData.macAddress,
      clientName: licenseData.clientName || "Unknown",
      activatedOn: licenseData.activatedOn?.toDate?.()?.toISOString() || licenseData.activatedOn,
      expiresOn: expiresOn.toISOString(),
      status: licenseData.status,
    };

    return { valid: true, licenseData: licenseInfo };
  } catch (error: any) {
    console.error("Error validating license:", error);
    return {
      valid: false,
      error: error.message || "Failed to validate license. Please check your internet connection.",
    };
  }
}

/**
 * Store license in IndexedDB (encrypted)
 */
export async function storeLicense(licenseInfo: LicenseInfo): Promise<void> {
  try {
    const encryptedData = encryptLicenseData(licenseInfo);
    const now = new Date().toISOString();

    // Check if license already exists
    const existing = await db.license
      .where("licenseKey")
      .equals(licenseInfo.licenseKey)
      .first();

    const licenseRecord: License = {
      licenseKey: licenseInfo.licenseKey,
      macAddress: licenseInfo.macAddress,
      clientName: licenseInfo.clientName,
      activatedOn: licenseInfo.activatedOn,
      expiresOn: licenseInfo.expiresOn,
      status: licenseInfo.status,
      encryptedData,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    if (existing?.id) {
      await db.license.update(existing.id, licenseRecord);
    } else {
      await db.license.add(licenseRecord);
    }
  } catch (error) {
    console.error("Error storing license:", error);
    throw new Error("Failed to store license");
  }
}

/**
 * Get stored license from IndexedDB
 */
export async function getStoredLicense(): Promise<LicenseInfo | null> {
  try {
    const license = await db.license.orderBy("updated_at").reverse().first();

    if (!license) {
      return null;
    }

    // Try to decrypt if encrypted data exists
    if (license.encryptedData) {
      const decrypted = decryptLicenseData(license.encryptedData);
      if (decrypted) {
        return decrypted;
      }
    }

    // Fallback to plain data (for backward compatibility)
    return {
      licenseKey: license.licenseKey,
      macAddress: license.macAddress,
      clientName: license.clientName,
      activatedOn: license.activatedOn,
      expiresOn: license.expiresOn,
      status: license.status,
    };
  } catch (error) {
    console.error("Error getting stored license:", error);
    return null;
  }
}

/**
 * Check if license is valid (checks expiration)
 */
export function isLicenseValid(licenseInfo: LicenseInfo | null): boolean {
  if (!licenseInfo) {
    return false;
  }

  if (licenseInfo.status !== "active") {
    return false;
  }

  const expiresOn = new Date(licenseInfo.expiresOn);
  const now = new Date();

  return expiresOn >= now;
}

/**
 * Activate license (online validation + local storage)
 */
export async function activateLicense(
  licenseKey: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const macAddress = await getMacAddress();
    const validation = await validateLicenseOnline(licenseKey, macAddress);

    if (!validation.valid || !validation.licenseData) {
      return {
        success: false,
        error: validation.error || "License validation failed",
      };
    }

    await storeLicense(validation.licenseData);
    return { success: true };
  } catch (error: any) {
    console.error("Error activating license:", error);
    return {
      success: false,
      error: error.message || "Failed to activate license",
    };
  }
}

/**
 * Check license on app launch (offline-first)
 */
export async function checkLicenseOnLaunch(): Promise<{
  valid: boolean;
  licenseInfo?: LicenseInfo;
  requiresActivation: boolean;
}> {
  try {
    // First, try to get stored license (with timeout protection)
    let storedLicense: LicenseInfo | null = null;
    try {
      storedLicense = await Promise.race([
        getStoredLicense(),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn("getStoredLicense timed out");
            resolve(null);
          }, 2000); // 2 second timeout for IndexedDB access
        }),
      ]);
    } catch (error) {
      console.error("Error getting stored license:", error);
      storedLicense = null;
    }

    if (!storedLicense) {
      return { valid: false, requiresActivation: true };
    }

    // Check if license is expired locally
    if (!isLicenseValid(storedLicense)) {
      return { valid: false, licenseInfo: storedLicense, requiresActivation: true };
    }

    // Try to validate online (optional - for revocation check)
    // Add timeout to prevent hanging on network requests
    try {
      const macAddressPromise = Promise.race([
        getMacAddress(),
        new Promise<string>((resolve) => {
          setTimeout(() => {
            console.warn("getMacAddress timed out, using stored MAC");
            resolve(storedLicense!.macAddress);
          }, 2000); // 2 second timeout
        }),
      ]);

      const macAddress = await macAddressPromise;
      
      const onlineValidationPromise = validateLicenseOnline(
        storedLicense.licenseKey,
        macAddress
      );

      const onlineValidation = await Promise.race([
        onlineValidationPromise,
        new Promise<{ valid: boolean; error?: string }>((resolve) => {
          setTimeout(() => {
            console.warn("Online validation timed out, using offline license");
            resolve({ valid: false, error: "Timeout" });
          }, 3000); // 3 second timeout for network request
        }),
      ]);

      if (!onlineValidation.valid) {
        // License revoked or invalid online, but allow offline use
        // In strict mode, you might want to return requiresActivation: true
        console.warn("License validation failed online, but allowing offline use");
      } else if (onlineValidation.licenseData) {
        // Update local license if online version is newer
        await storeLicense(onlineValidation.licenseData);
        return {
          valid: true,
          licenseInfo: onlineValidation.licenseData,
          requiresActivation: false,
        };
      }
    } catch (error) {
      // Offline - use stored license
      console.log("Offline mode: using stored license", error);
    }

    // Use stored license (offline mode)
    return {
      valid: true,
      licenseInfo: storedLicense,
      requiresActivation: false,
    };
  } catch (error) {
    console.error("Error checking license on launch:", error);
    return { valid: false, requiresActivation: true };
  }
}


