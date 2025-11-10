import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Seed an initial license in Firestore if the collection is empty.
 * Intended for first-run provisioning; safe to run multiple times.
 */
export async function seedInitialLicense(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if licenses collection already has data
    const licensesRef = collection(db, "licenses");
    const snapshot = await getDocs(licensesRef);

    if (!snapshot.empty) {
      return {
        success: true,
        message: "Licenses collection already has data. Skipping seed.",
      };
    }

    // Create a test license
    // Note: In production, you would generate proper license keys
    const initialLicense = {
      licenseKey: "DEFAULT-000-KEY",
      macAddress: "00:00:00:00:00:00", // Placeholder - replace with actual device ID
      clientName: "Default Client",
      activatedOn: new Date(),
      expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      status: "active",
    };

    await addDoc(licensesRef, initialLicense);

    return {
      success: true,
      message: `Initial license created: ${initialLicense.licenseKey}. Update the macAddress field to match the target device before activation.`,
    };
  } catch (error: any) {
    console.error("Error seeding test license:", error);
    return {
      success: false,
      message: error.message || "Failed to seed test license",
    };
  }
}

/**
 * Create a license with specific MAC address
 * This can be called from the admin panel or API
 */
export async function createLicense(data: {
  licenseKey: string;
  macAddress: string;
  clientName: string;
  expiresInDays?: number;
}): Promise<{ success: boolean; message: string; licenseId?: string }> {
  try {
    // Check if license key already exists
    const licensesRef = collection(db, "licenses");
    const q = query(licensesRef, where("licenseKey", "==", data.licenseKey));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return {
        success: false,
        message: "License key already exists",
      };
    }

    const expiresInDays = data.expiresInDays || 365;
    const expiresOn = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const licenseData = {
      licenseKey: data.licenseKey,
      macAddress: data.macAddress,
      clientName: data.clientName,
      activatedOn: new Date(),
      expiresOn,
      status: "active" as const,
    };

    const docRef = await addDoc(licensesRef, licenseData);

    return {
      success: true,
      message: "License created successfully",
      licenseId: docRef.id,
    };
  } catch (error: any) {
    console.error("Error creating license:", error);
    return {
      success: false,
      message: error.message || "Failed to create license",
    };
  }
}

/**
 * Update license status (e.g., revoke, activate)
 */
export async function updateLicenseStatus(
  licenseKey: string,
  status: "active" | "expired" | "revoked"
): Promise<{ success: boolean; message: string }> {
  try {
    const licensesRef = collection(db, "licenses");
    const q = query(licensesRef, where("licenseKey", "==", licenseKey));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        success: false,
        message: "License not found",
      };
    }

    const licenseDoc = snapshot.docs[0];
    const licenseDocRef = doc(licensesRef, licenseDoc.id);
    await updateDoc(licenseDocRef, { status });

    return {
      success: true,
      message: "License status updated",
    };
  } catch (error: any) {
    console.error("Error updating license status:", error);
    return {
      success: false,
      message: error.message || "Failed to update license status",
    };
  }
}

