import { NextRequest, NextResponse } from "next/server";
import { seedInitialLicense, createLicense } from "@/lib/utils/firestore-seed";

/**
 * API route to provision licenses in Firestore.
 *
 * POST /api/seed-license
 * Body: { licenseKey?: string, macAddress?: string, clientName?: string, expiresInDays?: number }
 *
 * If no body is provided, creates an initial placeholder license (macAddress=00:00:00:00:00:00).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // If specific license data is provided, create that license
    if (body.licenseKey && body.macAddress && body.clientName) {
      const result = await createLicense({
        licenseKey: body.licenseKey,
        macAddress: body.macAddress,
        clientName: body.clientName,
        expiresInDays: body.expiresInDays || 365,
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message,
          licenseId: result.licenseId,
        });
      } else {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 }
        );
      }
    }

    // Otherwise, seed a default license placeholder
    const result = await seedInitialLicense();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in seed-license API:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to seed license",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if licenses exist
 */
export async function GET() {
  try {
    const result = await seedInitialLicense();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to check licenses",
      },
      { status: 500 }
    );
  }
}


