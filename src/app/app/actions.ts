"use server";

import { redirect } from "next/navigation";
import { SessionMode } from "@/generated/prisma";
import { assembleExam, assembleQuickPractice } from "@/lib/exam/assemble";
import { getMockBlueprintId } from "@/lib/exam/blueprints";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Result of a "start session" action.
 *  - sessionId      => a session was created; the client routes to /exam/[sessionId]
 *  - assembledCount => how many questions were actually assembled (R44 shortfall)
 *  - empty          => the chosen unit has zero active questions; NO session was
 *                      created (R43) and the client renders "no questions yet"
 *  - error          => something went wrong; the client surfaces the message
 */
export type StartSessionResult = {
  sessionId?: string;
  assembledCount?: number;
  empty?: boolean;
  error?: string;
};

/** Signed-in user id, or a redirect to /login (mirrors the dashboard guard). */
async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user.id;
}

/**
 * R29/R30/R33 — assemble the APCSA MOCK blueprint with mode EXAM for the
 * signed-in user and hand the client the new session id to navigate to.
 */
export async function startMockExam(): Promise<StartSessionResult> {
  const userId = await requireUserId();

  try {
    const blueprintId = await getMockBlueprintId();
    const sessionId = await assembleExam(userId, blueprintId, SessionMode.EXAM);
    return { sessionId };
  } catch (err) {
    console.error("[startMockExam] assembly failed", err);
    return { error: "Could not assemble the mock exam. Please try again." };
  }
}

/**
 * R40-R44 — assemble a 10-question PRACTICE session for one APCSA unit.
 * Returns { empty: true } (no session row) when the unit has zero active
 * questions, and the assembled count so the UI can surface a 1-9 shortfall.
 */
export async function startQuickPractice(unitId: string): Promise<StartSessionResult> {
  const userId = await requireUserId();

  try {
    const sessionId = await assembleQuickPractice(userId, unitId);

    if (!sessionId) {
      // R43 — zero active questions in the chosen unit: no session was created.
      return { empty: true };
    }

    const assembledCount = await countAssembledQuestions(sessionId);
    return assembledCount === null ? { sessionId } : { sessionId, assembledCount };
  } catch (err) {
    console.error("[startQuickPractice] assembly failed", err);
    return { error: "Could not start quick practice. Please try again." };
  }
}

/**
 * Best-effort count of the questions recorded in a session's answersJson
 * (canonical shape: Array<{ sectionId, questionIds }>). Used only to surface
 * a shortfall indication in the UI (R44); never throws.
 */
async function countAssembledQuestions(sessionId: string): Promise<number | null> {
  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { answersJson: true },
    });
    if (!session || !Array.isArray(session.answersJson)) {
      return null;
    }

    let count = 0;
    for (const entry of session.answersJson) {
      const record = (entry ?? {}) as Record<string, unknown>;
      const ids = record.questionIds ?? record.ids ?? record.questions ?? record.answers;
      if (Array.isArray(ids)) {
        count += ids.length;
      }
    }
    return count;
  } catch {
    return null;
  }
}
