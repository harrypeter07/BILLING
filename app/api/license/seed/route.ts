import { NextResponse } from "next/server";
import { getAdminFirestore, Timestamp } from "@/lib/utils/firebase-admin";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

// Force Node.js runtime - Edge runtime doesn't support Firebase Admin SDK
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/license/seed
 * Seeds a license for a given MAC address
 * 
 * Body: {
 *   macAddress: string (required)
 *   clientName?: string (optional, defaults to "Default Client")
 *   expiresInDays?: number (optional, defaults to 365)
 * }
 */
export async function POST(request: Request) {
  try {
    // License seed API is accessible without authentication
    // This allows seeding licenses in a separate environment from the main app
    // Authentication is optional - if user is authenticated, we'll record who created it
    let user = null;
    
    try {
      const supabase = await createClient();
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user; // Will be null if not authenticated, which is fine
    } catch (fetchError: any) {
      // Silently handle auth errors - license seed doesn't require auth
      console.log("[API /license/seed] No authentication (this is allowed for license seeding)");
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error("[API /license/seed] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON format." },
        { status: 400 }
      );
    }

    const { macAddress, clientName, expiresInDays } = body;

    // Validate MAC address
    if (!macAddress || !macAddress.trim()) {
      return NextResponse.json(
        { error: "MAC address is required" },
        { status: 400 }
      );
    }

    // Normalize MAC address (uppercase, remove separators if any)
    const normalizedMac = macAddress.trim().toUpperCase().replace(/[:-]/g, "");
    
    // Validate MAC address format (should be 12 hex characters)
    if (!/^[0-9A-F]{12}$/.test(normalizedMac)) {
      return NextResponse.json(
        { error: "Invalid MAC address format. Expected format: XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX" },
        { status: 400 }
      );
    }

    // Format MAC address with colons for storage
    const formattedMac = normalizedMac.match(/.{2}/g)?.join(":") || normalizedMac;

    // Set defaults
    const finalClientName = clientName?.trim() || "Default Client";
    const finalExpiresInDays = expiresInDays ? Number(expiresInDays) : 365;

    if (Number.isNaN(finalExpiresInDays) || finalExpiresInDays <= 0) {
      return NextResponse.json(
        { error: "expiresInDays must be a positive number" },
        { status: 400 }
      );
    }

    // Generate license key (UUID-based)
    const licenseKey = `LICENSE-${normalizedMac.substring(0, 12)}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Initialize Firebase Admin
    let firestore;
    try {
      firestore = getAdminFirestore();
    } catch (firebaseError: any) {
      console.error("[API /license/seed] Firebase Admin initialization error:", firebaseError);
      return NextResponse.json(
        {
          error: "Failed to initialize Firebase Admin. Please check your Firebase credentials configuration.",
          details: process.env.NODE_ENV === "development" ? firebaseError.message : undefined,
        },
        { status: 500 }
      );
    }

    const licensesRef = firestore.collection("licenses");

    // Check if license already exists for this MAC address
    let existingSnapshot;
    try {
      existingSnapshot = await licensesRef
        .where("macAddress", "==", formattedMac)
        .limit(1)
        .get();
    } catch (firestoreError: any) {
      console.error("[API /license/seed] Firestore query error:", firestoreError);
      return NextResponse.json(
        {
          error: "Failed to query Firestore. Please check your Firebase configuration.",
          details: process.env.NODE_ENV === "development" ? firestoreError.message : undefined,
        },
        { status: 500 }
      );
    }

    const licenseData = {
      licenseKey,
      macAddress: formattedMac,
      clientName: finalClientName,
      activatedOn: Timestamp.now(),
      expiresOn: Timestamp.fromDate(
        new Date(Date.now() + finalExpiresInDays * 24 * 60 * 60 * 1000)
      ),
      status: "active",
      createdBy: user?.id || "system", // Use "system" if no user is authenticated
      createdAt: Timestamp.now(),
    };

    let docId: string;
    let isUpdate = false;

    try {
      if (!existingSnapshot.empty) {
        // Update existing license
        const docRef = existingSnapshot.docs[0].ref;
        await docRef.update(licenseData);
        docId = docRef.id;
        isUpdate = true;
      } else {
        // Create new license
        const docRef = await licensesRef.add(licenseData);
        docId = docRef.id;
      }
    } catch (firestoreError: any) {
      console.error("[API /license/seed] Firestore write error:", firestoreError);
      return NextResponse.json(
        {
          error: "Failed to save license to Firestore. Please check your Firebase configuration.",
          details: process.env.NODE_ENV === "development" ? firestoreError.message : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: isUpdate
          ? "License updated successfully"
          : "License created successfully",
        license: {
          licenseKey,
          macAddress: formattedMac,
          clientName: finalClientName,
          expiresInDays: finalExpiresInDays,
          status: "active",
          documentId: docId,
        },
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("[API /license/seed] Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to seed license",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/license/seed
 * Returns method not allowed - this endpoint only accepts POST
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. This endpoint only accepts POST requests.",
      message: "Use POST method to seed a license. Example: POST /api/license/seed with body { macAddress: 'AA:BB:CC:DD:EE:FF' }",
    },
    { status: 405 }
  );
}

