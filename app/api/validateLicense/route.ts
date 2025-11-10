import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, macAddress } = body;

    if (!licenseKey || !macAddress) {
      return NextResponse.json(
        { valid: false, error: "License key and MAC address are required" },
        { status: 400 }
      );
    }

    // Query Firestore for license
    const licensesRef = collection(db, "licenses");
    const q = query(
      licensesRef,
      where("licenseKey", "==", licenseKey),
      where("macAddress", "==", macAddress),
      where("status", "==", "active")
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({
        valid: false,
        error: "License not found or inactive",
      });
    }

    const licenseDoc = querySnapshot.docs[0];
    const licenseData = licenseDoc.data();

    // Check if license is expired
    let expiresOn: Date;
    if (licenseData.expiresOn instanceof Timestamp) {
      expiresOn = licenseData.expiresOn.toDate();
    } else if (licenseData.expiresOn instanceof Date) {
      expiresOn = licenseData.expiresOn;
    } else if (typeof licenseData.expiresOn === "string") {
      expiresOn = new Date(licenseData.expiresOn);
    } else {
      return NextResponse.json({
        valid: false,
        error: "Invalid expiration date",
      });
    }

    const now = new Date();
    if (expiresOn < now) {
      return NextResponse.json({
        valid: false,
        error: "License has expired",
      });
    }

    // Get activatedOn date
    let activatedOn: string;
    if (licenseData.activatedOn instanceof Timestamp) {
      activatedOn = licenseData.activatedOn.toDate().toISOString();
    } else if (licenseData.activatedOn instanceof Date) {
      activatedOn = licenseData.activatedOn.toISOString();
    } else if (typeof licenseData.activatedOn === "string") {
      activatedOn = licenseData.activatedOn;
    } else {
      activatedOn = new Date().toISOString();
    }

    return NextResponse.json({
      valid: true,
      licenseData: {
        licenseKey: licenseData.licenseKey,
        macAddress: licenseData.macAddress,
        clientName: licenseData.clientName || "Unknown",
        activatedOn,
        expiresOn: expiresOn.toISOString(),
        status: licenseData.status,
      },
    });
  } catch (error: any) {
    console.error("Error validating license:", error);
    return NextResponse.json(
      {
        valid: false,
        error: error.message || "Failed to validate license",
      },
      { status: 500 }
    );
  }
}


