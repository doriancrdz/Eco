import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const h = headers();
  const cookie = h.get("cookie") ?? "";

  const { userId } = await auth();

  return NextResponse.json(
    {
      userId: userId ?? null,
      hasCookie: cookie.length > 0,
      cookieLength: cookie.length,
      host: h.get("host"),
      origin: h.get("origin"),
      referer: h.get("referer"),
    },
    { status: 200 }
  );
}
