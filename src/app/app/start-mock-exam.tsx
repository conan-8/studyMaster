"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startMockExam } from "./actions";

/**
 * R29/R30/R33 — clicking the CTA runs the "use server" action, which creates
 * a real ExamSession (mode EXAM) and returns its id; we then route to
 * /exam/[sessionId]. Never a static link.
 */
export function StartMockExam() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startMockExam();
      if (result.sessionId) {
        router.push(`/exam/${result.sessionId}`);
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending}
        data-testid="start-mock-exam"
        className="inline-flex items-center gap-2.5 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition duration-200 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-amber-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isPending ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900"
            />
            Assembling your exam…
          </>
        ) : (
          "Start Mock Exam"
        )}
      </button>
      {error ? (
        <p role="alert" className="mt-2.5 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
