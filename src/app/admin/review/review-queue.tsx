"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { batchApproveQuestions, type ReviewState } from "@/lib/actions/review";
import { QuestionCard } from "./question-card";
import type { ReviewQuestion } from "./types";

const initialBatchState: ReviewState = {};

export function ReviewQueue({ questions }: { questions: ReviewQuestion[] }) {
  const [visible, setVisible] = useState(questions);
  const [batchState, batchAction, batchPending] = useActionState(
    batchApproveQuestions,
    initialBatchState,
  );

  const removeResolved = (ids: string[]) =>
    setVisible((v) => v.filter((q) => !ids.includes(q.id)));

  useEffect(() => {
    if (batchState.affectedIds?.length) {
      removeResolved(batchState.affectedIds);
    }
  }, [batchState]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">{visible.length}</span>{" "}
            {visible.length === 1 ? "question" : "questions"} in queue
          </p>
          <form action={batchAction}>
            {visible.map((q) => (
              <input
                type="hidden"
                name="questionId"
                value={q.id}
                key={q.id}
              />
            ))}
            <button
              type="submit"
              disabled={visible.length === 0 || batchPending}
              className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {batchPending ? "Approving…" : "Approve all visible"}
            </button>
          </form>
        </div>
        {batchState.error ? (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {batchState.error}
          </p>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm text-slate-300">
            Queue is clear — no inactive questions pending review.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visible.map((q) => (
            <QuestionCard key={q.id} question={q} onResolved={removeResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
