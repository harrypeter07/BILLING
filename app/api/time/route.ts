import { NextResponse } from "next/server"

/**
 * Server-side time endpoint
 * Returns current server timestamp to prevent client-side time manipulation
 */
export async function GET() {
  try {
    const timestamp = Date.now()
    return NextResponse.json({ 
      timestamp,
      iso: new Date(timestamp).toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get server time" },
      { status: 500 }
    )
  }
}

