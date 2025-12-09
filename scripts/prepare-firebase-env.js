#!/usr/bin/env node

/**
 * Helper script to convert Firebase service account JSON to environment variable format
 * 
 * Usage:
 *   node scripts/prepare-firebase-env.js [path-to-service-account.json]
 * 
 * This will output the JSON as a single-line string that can be used in .env files
 * or as a base64-encoded string for production deployments.
 */

const fs = require("fs");
const path = require("path");

function main() {
  // Try to find the service account JSON file
  let jsonPath = process.argv[2];

  if (!jsonPath) {
    // Try common locations
    const candidates = [
      path.join(process.cwd(), "app", "firebase", "billingsolution-firebase-adminsdk-*.json"),
      path.join(process.cwd(), "service-account.json"),
      path.join(process.cwd(), "app", "firebase", "*.json"),
    ];

    // Find first existing JSON file in app/firebase
    try {
      const firebaseDir = path.join(process.cwd(), "app", "firebase");
      if (fs.existsSync(firebaseDir)) {
        const files = fs
          .readdirSync(firebaseDir)
          .filter((f) => f.toLowerCase().endsWith(".json"));
        if (files.length > 0) {
          jsonPath = path.join(firebaseDir, files[0]);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error("Error: Firebase service account JSON file not found.");
    console.error("\nUsage:");
    console.error("  node scripts/prepare-firebase-env.js [path-to-service-account.json]");
    console.error("\nOr place the JSON file at:");
    console.error("  - app/firebase/*.json");
    console.error("  - service-account.json (project root)");
    process.exit(1);
  }

  try {
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const jsonData = JSON.parse(jsonContent);

    // Validate it's a service account JSON
    if (!jsonData.type || jsonData.type !== "service_account") {
      console.error("Error: File does not appear to be a Firebase service account JSON.");
      process.exit(1);
    }

    console.log("\n✅ Firebase Service Account JSON loaded successfully\n");
    console.log("=".repeat(80));
    console.log("OPTION 1: Plain JSON String (for .env.local)");
    console.log("=".repeat(80));
    console.log("\nAdd this to your .env.local file:");
    console.log("\nFIREBASE_ADMIN_CREDENTIALS='" + JSON.stringify(jsonData).replace(/'/g, "\\'") + "'\n");

    console.log("=".repeat(80));
    console.log("OPTION 2: Base64 Encoded (for production/Vercel)");
    console.log("=".repeat(80));
    const base64 = Buffer.from(JSON.stringify(jsonData)).toString("base64");
    console.log("\nFIREBASE_ADMIN_CREDENTIALS=" + base64 + "\n");

    console.log("=".repeat(80));
    console.log("OPTION 3: File Path (for local development)");
    console.log("=".repeat(80));
    console.log("\nGOOGLE_APPLICATION_CREDENTIALS=" + path.resolve(jsonPath) + "\n");

    console.log("=".repeat(80));
    console.log("📝 Notes:");
    console.log("=".repeat(80));
    console.log("1. For local development: Use Option 3 or place the JSON file at app/firebase/");
    console.log("2. For production (Vercel/etc): Use Option 2 (base64) and set as environment variable");
    console.log("3. Never commit the service account JSON file to Git (already in .gitignore)");
    console.log("4. The API route will automatically detect credentials from any of these sources\n");
  } catch (error) {
    console.error("Error processing JSON file:", error.message);
    process.exit(1);
  }
}

main();

