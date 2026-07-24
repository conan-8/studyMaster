import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ExamShell } from "./exam-shell";
import {
  parseAssembledCounts,
  parseBlueprintSections,
  type ShellSection,
} from "./sections";

export const metadata: Metadata = {
  title: "Exam session · StudyMate",
};

type ExamSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

/**
 * R34 — the exam shell route: /exam/[sessionId]. Loads the ExamSession by id
 * (including its blueprint for sectionsJson) and renders the assembled
 * sections from answersJson + sectionsJson.
 */
export default async function ExamSessionPage({ params }: ExamSessionPageProps) {
  const { sessionId } = await params;

  // R38 — guard unauthenticated access, consistent with the dashboard.
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

  // R39 — a signed-in user cannot open another user's session.
  if (!session || session.userId !== user.id) {
    notFound();
  }

  const blueprintSections = parseBlueprintSections(session.blueprint.sectionsJson);
  const assembledCounts = parseAssembledCounts(session.answersJson);

  const sections: ShellSection[] = blueprintSections.map((section) => ({
    ...section,
    assembledCount: assembledCounts.get(section.id) ?? 0,
  }));

  if (sections.length === 0) {
    notFound();
  }

  const initialIndex = Math.min(
    Math.max(session.currentSectionIndex, 0),
    sections.length - 1,
  );

  return (
    <ExamShell
      sessionId={session.id}
      blueprintName={session.blueprint.name}
      mode={String(session.mode)}
      status={String(session.status)}
      startedAt={session.startedAt.toISOString()}
      initialIndex={initialIndex}
      sections={sections}
    />
  );
}
