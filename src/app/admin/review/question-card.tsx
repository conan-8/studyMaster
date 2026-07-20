"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  approveQuestion,
  editAndApproveQuestion,
  rejectQuestion,
  type ReviewState,
} from "@/lib/actions/review";
import type { ReviewQuestion } from "./types";

const initialState: ReviewState = {};

const labelClass = "mb-1.5 block text-sm font-medium text-slate-300";
const fieldClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
const chipClass =
  "rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300";

export function QuestionCard({
  question,
  onResolved,
}: {
  question: ReviewQuestion;
  onResolved: (ids: string[]) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [approveState, approveAction, approvePending] = useActionState(
    approveQuestion,
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectQuestion,
    initialState,
  );
  const [editState, editAction, editPending] = useActionState(
    editAndApproveQuestion,
    initialState,
  );

  useEffect(() => {
    const states = [approveState, rejectState, editState];
    const resolved = states.some(
      (s) => s.affectedIds?.includes(question.id) && !s.error,
    );
    if (resolved) {
      onResolved([question.id]);
    }
  }, [approveState, rejectState, editState, question.id, onResolved]);

  const actionError = showEdit
    ? editState.error
    : showReject
      ? rejectState.error
      : (approveState.error ?? rejectState.error ?? editState.error);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap gap-2">
        <span className={chipClass}>{question.subjectCode}</span>
        <span className={chipClass}>
          {question.topicCode} — {question.topicTitle}
        </span>
        <span className={chipClass}>{question.type}</span>
        <span className={chipClass}>Difficulty {question.difficulty}</span>
        <span className={chipClass}>{question.sourceTag}</span>
      </div>

      {question.stimulus ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Stimulus
          </p>
          <div className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
            {question.stimulus}
          </div>
        </div>
      ) : null}

      <p className="mt-4 whitespace-pre-wrap text-base font-medium text-white">
        {question.stem}
      </p>

      {question.type === "MCQ" ? (
        <ol className="mt-4 space-y-2">
          {question.choices.map((choice) => {
            const isCorrect = choice.id === question.correctAnswer;
            return (
              <li
                key={choice.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 text-slate-200"
                }`}
              >
                <span>
                  <span className="mr-2 font-semibold">{choice.id}.</span>
                  {choice.text}
                </span>
                {isCorrect ? (
                  <span className="shrink-0 text-xs font-semibold">
                    ✓ Correct
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rubric
          </p>
          {question.rubric ? (
            <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(question.rubric, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-400">No rubric</p>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Explanation
        </p>
        <p className="whitespace-pre-wrap text-sm text-slate-300">
          {question.explanation}
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          QA critic notes
        </p>
        {question.misconceptionTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {question.misconceptionTags.map((tag) => (
              <span key={tag} className={chipClass}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">None</p>
        )}
      </div>

      {showEdit ? (
        <form
          action={editAction}
          className="mt-6 space-y-4 border-t border-slate-800 pt-4"
        >
          <input type="hidden" name="questionId" value={question.id} />

          <div>
            <label htmlFor={`stem-${question.id}`} className={labelClass}>
              Stem
            </label>
            <textarea
              id={`stem-${question.id}`}
              name="stem"
              rows={3}
              required
              defaultValue={question.stem}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor={`stimulus-${question.id}`} className={labelClass}>
              Stimulus (optional)
            </label>
            <textarea
              id={`stimulus-${question.id}`}
              name="stimulus"
              rows={4}
              defaultValue={question.stimulus ?? ""}
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor={`explanation-${question.id}`}
              className={labelClass}
            >
              Explanation
            </label>
            <textarea
              id={`explanation-${question.id}`}
              name="explanation"
              rows={3}
              required
              defaultValue={question.explanation}
              className={fieldClass}
            />
          </div>

          {question.type === "MCQ" ? (
            <>
              <div>
                <label
                  htmlFor={`correctAnswer-${question.id}`}
                  className={labelClass}
                >
                  Correct answer
                </label>
                <input
                  id={`correctAnswer-${question.id}`}
                  type="text"
                  name="correctAnswer"
                  defaultValue={question.correctAnswer ?? ""}
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor={`choicesJson-${question.id}`}
                  className={labelClass}
                >
                  Choices JSON
                </label>
                <textarea
                  id={`choicesJson-${question.id}`}
                  name="choicesJson"
                  rows={6}
                  defaultValue={JSON.stringify(question.choices, null, 2)}
                  className={`${fieldClass} font-mono text-xs`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  JSON array of {`{"id", "text"}`}
                </p>
              </div>
            </>
          ) : null}

          {editState.error ? (
            <p role="alert" className="text-sm text-red-400">
              {editState.error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={editPending}
              className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editPending ? "Saving…" : "Save & approve"}
            </button>
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <div className="flex gap-3">
            <form action={approveAction}>
              <input type="hidden" name="questionId" value={question.id} />
              <button
                type="submit"
                disabled={approvePending}
                className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approvePending ? "Approving…" : "Approve"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowReject((v) => !v)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Reject…
            </button>

            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Edit…
            </button>
          </div>

          {showReject ? (
            <form action={rejectAction} className="mt-4 space-y-3">
              <input type="hidden" name="questionId" value={question.id} />
              <textarea
                name="reason"
                required
                rows={2}
                placeholder="Reason for rejection…"
                className={fieldClass}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={rejectPending}
                  className="rounded-lg border border-red-600 bg-red-600/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rejectPending ? "Rejecting…" : "Confirm rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {actionError ? (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {actionError}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
