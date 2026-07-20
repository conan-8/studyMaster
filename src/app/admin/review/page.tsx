import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ReviewQueue } from "./review-queue";
import type { Choice, ReviewQuestion } from "./types";

export const metadata: Metadata = {
  title: "Review Queue · StudyMate",
};

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!profile?.isAdmin) {
    notFound();
  }

  const pending = await prisma.question.findMany({
    where: { isActive: false },
    include: {
      subject: { select: { code: true } },
      topic: { select: { code: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const questions: ReviewQuestion[] = pending.map((q) => ({
    id: q.id,
    type: q.type,
    difficulty: q.difficulty,
    stem: q.stem,
    stimulus: q.stimulus,
    choices: (q.choicesJson as Choice[]) ?? [],
    correctAnswer: q.correctAnswer,
    rubric: q.rubricJson ?? null,
    explanation: q.explanation,
    misconceptionTags: q.misconceptionTags,
    sourceTag: q.sourceTag,
    subjectCode: q.subject.code,
    topicCode: q.topic.code,
    topicTitle: q.topic.title,
    createdAt: q.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Review Queue</h1>
              <p className="mt-1 text-sm text-slate-400">
                {questions.length} inactive{" "}
                {questions.length === 1 ? "question" : "questions"} pending
                review.
              </p>
            </div>
            <Link
              href="/app"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Back to app
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <ReviewQueue questions={questions} />
        </section>
      </div>
    </main>
  );
}
