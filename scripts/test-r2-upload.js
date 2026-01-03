/**
 * Test script for Cloudflare R2 invoice upload
 *
 * Usage: node scripts/test-r2-upload.js
 *
 * Prerequisites:
 * - All R2 environment variables set in .env.local
 * - App running on localhost (for API route)
 */

const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
function loadEnvFile() {
	const envPath = path.join(__dirname, "..", ".env");

	// Try using dotenv if available
	try {
		require("dotenv").config({ path: envPath });
		return;
	} catch (e) {
		// If dotenv not available, parse manually
	}

	// Manual parsing of .env.local
	if (fs.existsSync(envPath)) {
		const envContent = fs.readFileSync(envPath, "utf8");
		const lines = envContent.split("\n");

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith("#")) {
				const [key, ...valueParts] = trimmed.split("=");
				if (key && valueParts.length > 0) {
					const value = valueParts.join("=").replace(/^["']|["']$/g, ""); // Remove quotes
					process.env[key.trim()] = value.trim();
				}
			}
		}
	}
}

loadEnvFile();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Test data
const TEST_ADMIN_ID = "test_admin_" + Date.now();
const TEST_INVOICE_ID = "test_invoice_" + Date.now();
const TEST_INVOICE_NUMBER = "TEST_INV_" + Date.now().toString().slice(-6);

/**
 * Generate a simple test PDF buffer
 */
function generateTestPDF() {
	// Create a minimal PDF content
	// PDF header
	const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Invoice PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000314 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
398
%%EOF`;

	return Buffer.from(pdfContent);
}

/**
 * Convert buffer to base64
 */
function bufferToBase64(buffer) {
	return buffer.toString("base64");
}

/**
 * Test R2 upload via API route
 */
async function testR2Upload() {
	console.log("🧪 Testing Cloudflare R2 Upload\n");
	console.log("=".repeat(60));

	// Check environment variables
	console.log("\n📋 Environment Variables Check:");
	const envVars = {
		R2_ACCOUNT_ID: R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY
			? "***" + R2_SECRET_ACCESS_KEY.slice(-4)
			: undefined,
		R2_BUCKET_NAME: R2_BUCKET_NAME,
		R2_PUBLIC_BASE_URL: R2_PUBLIC_BASE_URL,
	};

	let allVarsSet = true;
	for (const [key, value] of Object.entries(envVars)) {
		const status = value ? "✅" : "❌";
		console.log(`  ${status} ${key}: ${value || "NOT SET"}`);
		if (!value) allVarsSet = false;
	}

	if (!allVarsSet) {
		console.error("\n❌ Error: Some environment variables are missing!");
		console.error("Please set all R2 environment variables in .env.local");
		process.exit(1);
	}

	console.log("\n📦 Test Data:");
	console.log(`  Admin ID: ${TEST_ADMIN_ID}`);
	console.log(`  Invoice ID: ${TEST_INVOICE_ID}`);
	console.log(`  Invoice Number: ${TEST_INVOICE_NUMBER}`);
	console.log(`  API URL: ${API_BASE_URL}/api/invoices/upload-r2`);

	// Generate test PDF
	console.log("\n📄 Generating test PDF...");
	const pdfBuffer = generateTestPDF();
	const pdfBase64 = bufferToBase64(pdfBuffer);
	console.log(`  ✅ PDF generated (${pdfBuffer.length} bytes)`);

	// Prepare request
	const requestBody = {
		pdfData: pdfBase64,
		adminId: TEST_ADMIN_ID,
		invoiceId: TEST_INVOICE_ID,
		invoiceNumber: TEST_INVOICE_NUMBER,
	};

	console.log("\n🚀 Uploading to Cloudflare R2...");
	console.log(
		`  Object key will be: invoices/${TEST_ADMIN_ID}/${TEST_INVOICE_NUMBER}.pdf`
	);

	try {
		const response = await fetch(`${API_BASE_URL}/api/invoices/upload-r2`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		const responseText = await response.text();
		let result;

		try {
			result = JSON.parse(responseText);
		} catch (parseError) {
			console.error("\n❌ Error: Invalid JSON response from API");
			console.error("Response:", responseText);
			console.error("\nThis might mean:");
			console.error("  1. The app is not running on localhost:3000");
			console.error("  2. The API route has an error");
			console.error("  3. Check the server logs for details");
			process.exit(1);
		}

		if (!response.ok) {
			console.error("\n❌ Upload failed!");
			console.error(`  Status: ${response.status} ${response.statusText}`);
			console.error(`  Error: ${result.error || "Unknown error"}`);

			if (result.error?.includes("not configured")) {
				console.error(
					"\n💡 Tip: Check that all R2 environment variables are set correctly"
				);
			} else if (result.error?.includes("bucket")) {
				console.error(
					"\n💡 Tip: Verify R2_BUCKET_NAME matches your bucket name"
				);
			} else if (result.error?.includes("credentials")) {
				console.error(
					"\n💡 Tip: Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY"
				);
			}

			process.exit(1);
		}

		if (result.success) {
			console.log("\n✅ Upload successful!");
			console.log("\n📊 Results:");
			console.log(`  Object Key: ${result.objectKey}`);
			console.log(`  Public URL: ${result.publicUrl}`);
			console.log(`  Expires At: ${result.expiresAt}`);

			// Test public URL accessibility
			console.log("\n🔗 Testing public URL accessibility...");
			try {
				const urlResponse = await fetch(result.publicUrl, { method: "HEAD" });
				if (urlResponse.ok) {
					console.log(
						`  ✅ Public URL is accessible (Status: ${urlResponse.status})`
					);
					console.log(
						`  Content-Type: ${urlResponse.headers.get("content-type")}`
					);
					console.log(
						`  Content-Length: ${urlResponse.headers.get(
							"content-length"
						)} bytes`
					);
				} else {
					console.log(
						`  ⚠️  Public URL returned status: ${urlResponse.status}`
					);
					console.log("  This might mean:");
					console.log("    1. Public access is not enabled on the bucket");
					console.log("    2. R2_PUBLIC_BASE_URL is incorrect");
				}
			} catch (urlError) {
				console.log(
					`  ⚠️  Could not verify URL accessibility: ${urlError.message}`
				);
			}

			console.log("\n" + "=".repeat(60));
			console.log("✅ All tests passed!");
			console.log("\n📝 Next steps:");
			console.log("  1. Verify the file exists in your R2 bucket dashboard");
			console.log("  2. Check that the public URL opens in a browser");
			console.log("  3. Test creating an invoice in the app");
			console.log("\n🎉 R2 integration is working correctly!");
		} else {
			console.error("\n❌ Upload returned success=false");
			console.error(`  Error: ${result.error || "Unknown error"}`);
			process.exit(1);
		}
	} catch (error) {
		console.error("\n❌ Error during upload:");
		console.error(`  ${error.message}`);

		if (
			error.message.includes("fetch failed") ||
			error.message.includes("ECONNREFUSED")
		) {
			console.error("\n💡 Tip: Make sure the app is running on localhost:3000");
			console.error("  Run: npm run dev");
		} else if (error.message.includes("ENOTFOUND")) {
			console.error("\n💡 Tip: Check your internet connection");
		}

		process.exit(1);
	}
}

// Run the test
testR2Upload().catch((error) => {
	console.error("\n❌ Unexpected error:");
	console.error(error);
	process.exit(1);
});
