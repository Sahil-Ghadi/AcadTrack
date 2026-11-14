import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const backendRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { message: data.message || "Invalid credentials" },
        { status: backendRes.status },
      );
    }

    // Set httpOnly cookie for server middleware protection
    const cookieStore = await cookies();
    cookieStore.set("acadtrack_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Also store role in a readable cookie for middleware routing
    cookieStore.set("acadtrack_role", data.user.role, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
