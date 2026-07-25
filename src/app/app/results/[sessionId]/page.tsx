import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { SessionMode } from "@/generated/prisma";
import { loadResultsData } from "./data";
import { ResultsView } from "./results-view";

export const metadata: Metadata = {
  title: "Results · StudyMate",
};

type ResultsPageProps = {
  params: Promise<{ sessionId: string }>;
};

/**
 * Rules 34–36 — the real results page at /app/results/[sessionId].
 *
 * Server component with the same owner-scoped guard as the existing app
 * pages: redirect to /login when there is no user, notFound() when the
 * session belongs to someone else. PRACTICE sessions never use the results
 * page, so a direct URL hit on a PRACTICE session redirects to /app (rule 35)
 * instead of showing a stale page.
 *
 * All figures render from persisted data (ExamSession.scoreJson + Response
 * rows) — nothing is recomputed here (rule 44).
 */
export default async function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = await params;

  // Owner-scoped auth guard, consistent with the dashboard and exam shell.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { blueprint: true },
  });

  // A signed-in user cannot open another user's session.
  if (!session || session.userId !== user.id) {
    notFound();
  }

  // PRACTICE results are revealed inline in the exam shell; the results page
  // is exam-only, so direct URL access cannot show a stale page.
  if (session.mode === SessionMode.PRACTICE) {
    redirect("/app");
  }

  const data = await loadResultsData(session);

  return (
    <ResultsView
      blueprintName={session.blueprint.name}
      mode={String(session.mode)}
      completedAt={session.completedAt ? session.completedAt.toISOString() : null}
      data={data}
    />
  );
}
