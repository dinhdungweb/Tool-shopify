import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("session_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const session = await validateSession(token);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
      },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get user",
      },
      { status: 500 }
    );
  }
}
