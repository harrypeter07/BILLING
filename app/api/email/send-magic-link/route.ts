import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Email configuration from environment variables
const getEmailTransporter = () => {
  // You can configure this to use SMTP (Gmail, Outlook, etc.) or other services
  // For production, use environment variables
  const emailHost = process.env.EMAIL_HOST || "smtp.gmail.com"
  const emailPort = parseInt(process.env.EMAIL_PORT || "587")
  const emailUser = process.env.EMAIL_USER
  const emailPassword = process.env.EMAIL_PASSWORD
  const emailFrom = process.env.EMAIL_FROM || emailUser

  if (!emailUser || !emailPassword) {
    console.warn("[Email] Email credentials not configured. Magic links will not be sent.")
    return null
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, magicLink, customerName } = body

    if (!email || !magicLink) {
      return NextResponse.json(
        { error: "Email and magic link are required" },
        { status: 400 }
      )
    }

    const transporter = getEmailTransporter()
    
    if (!transporter) {
      // If email is not configured, return success but log that email wasn't sent
      console.log("[Email] Email not configured. Magic link:", magicLink)
      return NextResponse.json({
        success: true,
        message: "Magic link generated (email not configured)",
        magicLink, // Return link for development
      })
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: "Your Login Link - Billing Solutions",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #000; color: #fff; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background-color: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Billing Solutions</h1>
            </div>
            <div class="content">
              <h2>Login Link</h2>
              <p>Hello${customerName ? ` ${customerName}` : ""},</p>
              <p>You requested a login link for your account. Click the button below to log in:</p>
              <div style="text-align: center;">
                <a href="${magicLink}" class="button">Login Now</a>
              </div>
              <p style="margin-top: 30px; font-size: 12px; color: #666;">
                Or copy and paste this link into your browser:<br>
                <a href="${magicLink}" style="color: #0066cc; word-break: break-all;">${magicLink}</a>
              </p>
              <p style="margin-top: 20px; font-size: 12px; color: #666;">
                This link will expire in 1 hour for security reasons.
              </p>
              <p style="margin-top: 20px; font-size: 12px; color: #999;">
                If you didn't request this link, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Billing Solutions. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello${customerName ? ` ${customerName}` : ""},

You requested a login link for your account. Use the following link to log in:

${magicLink}

This link will expire in 1 hour for security reasons.

If you didn't request this link, please ignore this email.

© ${new Date().getFullYear()} Billing Solutions
      `.trim(),
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({
      success: true,
      message: "Magic link email sent successfully",
    })
  } catch (error: any) {
    console.error("[Email] Error sending email:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    )
  }
}

