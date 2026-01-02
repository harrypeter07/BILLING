import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

/**
 * Google Drive Upload API Route
 * 
 * This route handles uploading PDFs to Google Drive and creating shareable links.
 * 
 * Required Environment Variables:
 * - GOOGLE_DRIVE_CLIENT_EMAIL: Service account email
 * - GOOGLE_DRIVE_PRIVATE_KEY: Service account private key (with \n replaced)
 * - GOOGLE_DRIVE_FOLDER_ID: (Optional) Folder ID where files should be uploaded
 */

interface UploadRequest {
  fileName: string
  fileData: string // Base64 encoded
  mimeType: string
}

export async function POST(request: NextRequest) {
  try {
    // Check if Google Drive is configured
    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive is not configured. Please set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY environment variables.',
        },
        { status: 500 }
      )
    }

    // Parse request body
    const body: UploadRequest = await request.json()
    const { fileName, fileData, mimeType } = body

    if (!fileName || !fileData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: fileName and fileData',
        },
        { status: 400 }
      )
    }

    // Initialize Google Drive API with service account
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'), // Replace escaped newlines
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64')

    // Prepare file metadata
    const fileMetadata: any = {
      name: fileName,
      mimeType: mimeType || 'application/pdf',
    }

    // Add folder if specified
    if (folderId) {
      fileMetadata.parents = [folderId]
    }

    // Upload file to Google Drive
    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: mimeType || 'application/pdf',
        body: fileBuffer,
      },
      fields: 'id, name, webViewLink, webContentLink',
    })

    const fileId = uploadResponse.data.id

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get file ID from Google Drive',
        },
        { status: 500 }
      )
    }

    // Make the file publicly viewable (anyone with the link can view)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    // Get the shareable link
    const fileDetails = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink',
    })

    const shareableLink = fileDetails.data.webViewLink || fileDetails.data.webContentLink

    if (!shareableLink) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate shareable link',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      fileId: fileId,
      shareableLink: shareableLink,
      fileName: uploadResponse.data.name,
    })
  } catch (error: any) {
    console.error('[GoogleDrive API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to upload file to Google Drive',
      },
      { status: 500 }
    )
  }
}

