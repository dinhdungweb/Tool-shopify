import { NextRequest, NextResponse } from "next/server";
import { verifyPasswordResetToken, resetPassword } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Verify token (GET request)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Token is required",
        },
        { status: 400 }
      );
    }

    const verification = await verifyPasswordResetToken(token);

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      email: verification.user?.email,
    });
  } catch (error: any) {
    console.error("Verify token error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify token",
      },
      { status: 500 }
    );
  }
}

// Reset password (POST request)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Reset password
    const result = await resetPassword(token, password);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password",
      },
      { status: 500 }
    );
  }
}
