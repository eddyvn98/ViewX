import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return NextResponse.json({ configured: false, client_id: "" }, { status: 200 });
  }

  return NextResponse.json(
    {
      configured: true,
      client_id: clientId,
    },
    { status: 200 },
  );
}

