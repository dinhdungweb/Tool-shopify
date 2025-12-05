import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, createSession } from "@/lib/auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`signin:${clientIP}`, RATE_LIMITS.signin);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
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
    const validation = signinSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = validation.data;

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Create session with rememberMe flag
    const session = await createSession(user.id, rememberMe);

    // Set cookie - duration based on rememberMe
    const cookieMaxAge = rememberMe
      ? 30 * 24 * 60 * 60  // 30 days
      : 7 * 24 * 60 * 60;  // 7 days

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    response.cookies.set("session_token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: cookieMaxAge,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Signin error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sign in",
      },
      { status: 500 }
    );
  }
}
