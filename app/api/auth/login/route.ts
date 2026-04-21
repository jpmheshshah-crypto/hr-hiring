import { NextResponse } from "next/server";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginPayload;
  const expectedUsername = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  const sessionToken = process.env.DASHBOARD_SESSION_TOKEN;

  if (!expectedUsername || !expectedPassword || !sessionToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Dashboard login is not configured yet."
      },
      { status: 500 }
    );
  }

  if (body.username !== expectedUsername || body.password !== expectedPassword) {
    return NextResponse.json(
      {
        ok: false,
        message: "Wrong ID or password."
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: "Login successful."
  });
  response.cookies.set("dashboard_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}
