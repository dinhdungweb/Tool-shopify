import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth";
import { sendEmail, generatePasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`forgot:${clientIP}`, RATE_LIMITS.forgotPassword);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateLimitResult.resetIn / 1000)),
          },
        }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Create reset token
    const result = await createPasswordResetToken(email);

    // Always return success (don't reveal if email exists)
    if (!result) {
      return NextResponse.json({
        success: true,
        message: "If that email exists, we sent a password reset link",
      });
    }

    // Generate reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const resetUrl = `${baseUrl}/reset-password?token=${result.token}`;

    // Send email
    const userName = result.user.firstName || result.user.email.split("@")[0];
    await sendEmail({
      to: result.user.email,
      subject: "Reset Your Password",
      html: generatePasswordResetEmail(resetUrl, userName),
    });

    return NextResponse.json({
      success: true,
      message: "If that email exists, we sent a password reset link",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
      },
      { status: 500 }
    );
  }
}
