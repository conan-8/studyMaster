"use server";

import { SessionStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * R37/R39 — mark a session COMPLETED once the user has proceeded through all
 * sections (answering or skipping empty ones). Strictly owner-scoped: a
 * session can only be finished by the user it belongs to.
 */
export async function finishSession(sessionId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false };
  }

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session || session.userId !== user.id) {
      return { ok: false };
    }

    await prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("[finishSession] failed to complete session", err);
    return { ok: false };
  }
}
