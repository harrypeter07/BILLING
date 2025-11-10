import CryptoJS from "crypto-js";

// Secret key for encryption (in production, this should be more secure)
// For now, using a fixed key. In production, consider using a key derived from device info
const ENCRYPTION_KEY = "billing-solutions-license-key-2025";

/**
 * Encrypt license data before storing in IndexedDB
 */
export function encryptLicenseData(data: {
  licenseKey: string;
  macAddress: string;
  clientName: string;
  activatedOn: string;
  expiresOn: string;
  status: string;
}): string {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error("Error encrypting license data:", error);
    throw new Error("Failed to encrypt license data");
  }
}

/**
 * Decrypt license data from IndexedDB
 */
export function decryptLicenseData(encryptedData: string): {
  licenseKey: string;
  macAddress: string;
  clientName: string;
  activatedOn: string;
  expiresOn: string;
  status: string;
} | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!jsonString) {
      return null;
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error decrypting license data:", error);
    return null;
  }
}


