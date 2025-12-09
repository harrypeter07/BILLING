/**
 * Firebase Admin SDK initialization utility
 * Supports multiple credential sources for flexibility in deployment
 */

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let adminApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;

/**
 * Load Firebase Admin credentials from environment variables or file
 */
function loadCredentials() {
  // Option 1: FIREBASE_ADMIN_CREDENTIALS as JSON string (for production)
  const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (credentialsJson) {
    try {
      // Try parsing as plain JSON string
      const credentials = JSON.parse(credentialsJson);
      return cert(credentials);
    } catch (e) {
      // Try base64 decoding if plain JSON fails
      try {
        const decoded = Buffer.from(credentialsJson, "base64").toString("utf-8");
        const credentials = JSON.parse(decoded);
        return cert(credentials);
      } catch (e2) {
        console.error("[Firebase Admin] Failed to parse FIREBASE_ADMIN_CREDENTIALS");
        throw new Error("Invalid FIREBASE_ADMIN_CREDENTIALS format");
      }
    }
  }

  // Option 2: GOOGLE_APPLICATION_CREDENTIALS env var pointing to file
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    const credentials = JSON.parse(fs.readFileSync(envPath, "utf-8"));
    return cert(credentials);
  }

  // Option 3: service-account.json at project root
  const localPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(localPath)) {
    const credentials = JSON.parse(fs.readFileSync(localPath, "utf-8"));
    return cert(credentials);
  }

  // Option 4: app/firebase/*.json (for local development)
  try {
    const firebaseDir = path.join(process.cwd(), "app", "firebase");
    if (fs.existsSync(firebaseDir)) {
      const files = fs
        .readdirSync(firebaseDir)
        .filter((f) => f.toLowerCase().endsWith(".json"));
      if (files.length > 0) {
        const candidate = path.join(firebaseDir, files[0]);
        const credentials = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        return cert(credentials);
      }
    }
  } catch (e) {
    // fall through to applicationDefault
  }

  // Option 5: Application Default Credentials (for GCP/Cloud Run)
  try {
    return applicationDefault();
  } catch (e) {
    throw new Error(
      "Firebase Admin credentials not found. Please set FIREBASE_ADMIN_CREDENTIALS environment variable or provide credentials file."
    );
  }
}

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 */
export function getFirebaseAdmin() {
  if (adminApp && firestore) {
    return { app: adminApp, firestore };
  }

  try {
    // Check if already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      firestore = getFirestore(adminApp);
      return { app: adminApp, firestore };
    }

    // Initialize new app
    adminApp = initializeApp({
      credential: loadCredentials(),
    });

    firestore = getFirestore(adminApp);
    return { app: adminApp, firestore };
  } catch (error: any) {
    console.error("[Firebase Admin] Initialization error:", error);
    throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
  }
}

/**
 * Get Firestore instance
 */
export function getAdminFirestore() {
  const { firestore } = getFirebaseAdmin();
  return firestore;
}

/**
 * Get Firestore Timestamp helper
 */
export { Timestamp };

