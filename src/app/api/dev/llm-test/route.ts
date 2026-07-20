import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

const okSchema = z.object({ ok: z.literal(true) });

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isAdmin) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const result = await callLLM({
      system: "You are a JSON-only test endpoint. Respond with valid JSON only.",
      user: 'Return exactly {"ok": true}',
      schema: okSchema,
      purpose: "dev-llm-test",
      maxTokens: 64,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
