import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession, findUserByEmail } from "@/lib/auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`signup:${clientIP}`, RATE_LIMITS.signup);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many signup attempts. Please try again later.",
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
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName } = validation.data;

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already registered",
        },
        { status: 409 }
      );
    }

    // Create user
    const user = await createUser({
      email,
      password,
      firstName,
      lastName,
    });

    // Create session
    const session = await createSession(user.id);

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
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create account",
      },
      { status: 500 }
    );
  }
}
