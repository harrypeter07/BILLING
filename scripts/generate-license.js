#!/usr/bin/env node

/**
 * Generate and seed a license for a given MAC address
 * 
 * Usage:
 *   node scripts/generate-license.js <MAC_ADDRESS> [CLIENT_NAME] [expiresInDays]
 * 
 * Example:
 *   node scripts/generate-license.js E5:8D:22:87:C6:34 "My Client" 365
 */

const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");
const path = require("path");

function generateLicenseKey(macAddress) {
  // Normalize MAC address (uppercase, remove separators)
  const normalizedMac = macAddress.trim().toUpperCase().replace(/[:-]/g, "");
  
  // Generate license key in format: LICENSE-XXXXXXXXXXXX-XXXXXXXX
  const licenseKey = `LICENSE-${normalizedMac.substring(0, 12)}-${uuidv4().substring(0, 8).toUpperCase()}`;
  return licenseKey;
}

async function main() {
  const [, , macAddressArg, clientNameArg, expiresArg] = process.argv;

  if (!macAddressArg) {
    console.error("Usage: node scripts/generate-license.js <MAC_ADDRESS> [CLIENT_NAME] [expiresInDays]");
    console.error("Example: node scripts/generate-license.js E5:8D:22:87:C6:34 \"My Client\" 365");
    process.exit(1);
  }

  const macAddress = macAddressArg.trim();
  const clientName = clientNameArg?.trim() || "Default Client";
  const expiresInDays = expiresArg ? Number(expiresArg) : 365;

  // Validate MAC address format
  const normalizedMac = macAddress.toUpperCase().replace(/[:-]/g, "");
  if (!/^[0-9A-F]{12}$/.test(normalizedMac)) {
    console.error("Error: Invalid MAC address format. Expected format: XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX");
    process.exit(1);
  }

  // Generate license key
  const licenseKey = generateLicenseKey(macAddress);
  
  console.log("\n📋 License Generation");
  console.log("===================");
  console.log(`MAC Address: ${macAddress}`);
  console.log(`Client Name: ${clientName}`);
  console.log(`Expires In: ${expiresInDays} days`);
  console.log(`License Key: ${licenseKey}`);
  console.log("\n🌱 Seeding license to Firestore...\n");

  // Run the seed-license script
  const seedScriptPath = path.join(__dirname, "seed-license.js");
  const seedProcess = spawn("node", [seedScriptPath, licenseKey, macAddress, clientName, expiresInDays.toString()], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  seedProcess.on("close", (code) => {
    if (code === 0) {
      console.log("\n✅ License generated and seeded successfully!");
      console.log(`\n📝 License Key: ${licenseKey}`);
      console.log(`   Use this key to activate the license on the device.\n`);
    } else {
      console.error(`\n❌ Failed to seed license (exit code: ${code})`);
      process.exit(code);
    }
  });

  seedProcess.on("error", (error) => {
    console.error(`\n❌ Error running seed script: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

