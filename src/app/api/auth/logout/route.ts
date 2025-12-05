import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("session_token")?.value;

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear cookie
    response.cookies.delete("session_token");

    return response;
  } catch (error: any) {
    console.error("Logout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to logout",
      },
      { status: 500 }
    );
  }
}
