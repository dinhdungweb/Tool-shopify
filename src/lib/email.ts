// Email service for sending password reset emails
// Using nodemailer - install: npm install nodemailer

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  // Check if SMTP is configured
  const smtpConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  // For development or if SMTP not configured: Just log to console
  if (!smtpConfigured) {
    console.log("\n📧 Email would be sent (SMTP not configured):");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Content:", html.substring(0, 200) + "...");
    console.log("\n💡 Configure SMTP in .env to send real emails\n");
    return { success: true };
  }

  // For production: Use actual email service with nodemailer
  try {
    const nodemailer = require("nodemailer");
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Email send error:", error);
    return { success: false, error };
  }
}

export function generatePasswordResetEmail(resetUrl: string, userName: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #4F46E5; 
          color: white!important; 
          text-decoration: none; 
          border-radius: 6px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hi ${userName},</p>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <div class="footer">
          <p>This is an automated email, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
