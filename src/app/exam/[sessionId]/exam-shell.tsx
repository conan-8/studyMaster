"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import type { CapturedAnswerMap } from "@/lib/exam/score";
import { finishSession } from "./actions";
import {
  checkPracticeAnswer,
  getExamSessionForScoring,
  submitExamAnswers,
  type CheckPracticeAnswerResult,
  type ScoringQuestion,
} from "./scoring-actions";
import type { ShellSection } from "./sections";

type ExamShellProps = {
  sessionId: string;
  blueprintName: string;
  mode: string;
  status: string;
  startedAt: string;
  initialIndex: number;
  sections: ShellSection[];
};

const MODE_LABELS: Record<string, string> = {
  EXAM: "Mock exam",
  PRACTICE: "Quick practice",
  DIAGNOSTIC: "Diagnostic",
};

type SectionState = "done" | "skipped" | "active" | "upcoming";

/** The successful payload of a PRACTICE per-question check, for inline reveal. */
type PracticeCheck = Extract<CheckPracticeAnswerResult, { ok: true }>;

/**
 * R34-R37 — the exam shell, extended into the answer-capture shell.
 *
 * Every section is still rendered from the blueprint's sectionsJson (names,
 * counts, durations, subParts) together with its assembled question count from
 * answersJson; empty sections keep the "no questions yet" placeholder + Skip
 * control so the user can proceed through and complete the session.
 *
 * On top of that, the shell loads the assembled MCQ questions
 * (getExamSessionForScoring) and captures answers in React state only:
 *  - EXAM mode    -> a single Submit finalizes the whole session at once
 *                    (submitExamAnswers) and navigates to /app/results/[sessionId].
 *  - PRACTICE mode -> a per-question Check scores one question (checkPracticeAnswer)
 *                    and reveals the full explanation inline; it NEVER navigates to
 *                    or links to the results page.
 * Scoring itself lives server-side; the client only holds selections and renders
 * the scored feedback (no scoreExam call here).
 */
export function ExamShell({
  sessionId,
  blueprintName,
  mode,
  status,
  startedAt,
  initialIndex,
  sections,
}: ExamShellProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(initialIndex, 0), sections.length - 1),
  );
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [finished, setFinished] = useState(() => status === "COMPLETED");
  const [isPending, startTransition] = useTransition();

  // Answer-capture state (held in React only; nothing persists until submit/check).
  const [sessionData, setSessionData] = useState<{
    mode: string;
    questions: ScoringQuestion[];
  } | null>(null);
  const [captured, setCaptured] = useState<CapturedAnswerMap>({});
  const [practiceResults, setPracticeResults] = useState<Record<string, PracticeCheck>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lastIndex = sections.length - 1;
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const totalMinutes = sections.reduce((sum, section) => sum + section.durationMinutes, 0);
  const startedLabel = new Date(startedAt).toLocaleString();

  // Load the assembled MCQ questions once on mount.
  useEffect(() => {
    let active = true;
    getExamSessionForScoring(sessionId)
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setSessionData({ mode: result.mode, questions: result.questions });
        } else {
          setErrorMessage(result.error);
        }
      })
      .catch(() => {
        if (active) setErrorMessage("Failed to load questions");
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const effectiveMode = sessionData?.mode ?? mode;
  const isPractice = effectiveMode === "PRACTICE";
  const allQuestions = sessionData?.questions ?? [];
  const totalQuestions = allQuestions.length;
  const hasQuestions = totalQuestions > 0;
  const answeredCount = allQuestions.filter((question) => captured[question.id] !== undefined)
    .length;

  // Group loaded questions by their derived section id (blueprint section order).
  const questionsBySection = useMemo(() => {
    const map = new Map<string, ScoringQuestion[]>();
    for (const question of sessionData?.questions ?? []) {
      const list = map.get(question.sectionId);
      if (list) {
        list.push(question);
      } else {
        map.set(question.sectionId, [question]);
      }
    }
    return map;
  }, [sessionData]);

  function selectChoice(questionId: string, choiceId: string) {
    setCaptured((previous) => ({
      ...previous,
      [questionId]: { answer: choiceId, isIDK: false },
    }));
  }

  function selectIdk(questionId: string) {
    setCaptured((previous) => ({
      ...previous,
      [questionId]: { answer: "", isIDK: true },
    }));
  }

  async function handleCheck(questionId: string) {
    const capturedAnswer = captured[questionId];
    if (!capturedAnswer || checkingId) return;
    setCheckingId(questionId);
    try {
      const result = await checkPracticeAnswer(sessionId, questionId, capturedAnswer);
      if (result.ok) {
        setPracticeResults((previous) => ({ ...previous, [questionId]: result }));
      } else {
        setErrorMessage(result.error);
      }
    } catch {
      setErrorMessage("Failed to check answer");
    } finally {
      setCheckingId(null);
    }
  }

  async function handleSubmitExam() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await submitExamAnswers(sessionId, captured);
      if (result.ok) {
        // EXAM only — PRACTICE never navigates to the results page.
        router.push(`/app/results/${sessionId}`);
        return;
      }
      setErrorMessage(result.error);
    } catch {
      setErrorMessage("Failed to submit answers");
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToSection(index: number) {
    const target = sections[index];
    if (!target) return;
    // Give the DOM a tick to settle before scrolling the new active card into view.
    window.setTimeout(() => {
      document
        .getElementById(`section-card-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function complete() {
    setFinished(true);
    startTransition(async () => {
      await finishSession(sessionId);
    });
  }

  function handleAdvance(index: number) {
    if (index < lastIndex) {
      setCurrent(index + 1);
      scrollToSection(index + 1);
    } else if (!isPractice && hasQuestions) {
      // EXAM primary path: finalize the whole session via scoring + persistence.
      void handleSubmitExam();
    } else {
      // PRACTICE (or a session with no answerable questions): keep the existing
      // finishSession flow.
      complete();
    }
  }

  function handleSkip(sectionId: string, index: number) {
    // R37 — an empty section can always be skipped past.
    setSkipped((previous) => {
      const next = new Set(previous);
      next.add(sectionId);
      return next;
    });
    if (index >= current) {
      if (index < lastIndex) {
        setCurrent(index + 1);
        scrollToSection(index + 1);
      } else {
        complete();
      }
    }
  }

  function handleBack(index: number) {
    if (index <= 0) return;
    setCurrent(index - 1);
    scrollToSection(index - 1);
  }

  function sectionState(index: number, section: ShellSection): SectionState {
    if (skipped.has(section.id)) return "skipped";
    if (finished || index < current) return "done";
    if (index === current) return "active";
    return "upcoming";
  }

  function renderQuestion(question: ScoringQuestion) {
    const capturedAnswer = captured[question.id];
    const practice = practiceResults[question.id];
    return (
      <div
        key={question.id}
        data-testid={`question-${question.id}`}
        className="rounded-xl border border-slate-800 bg-slate-950/40 p-5"
      >
        {question.stimulus ? (
          <pre
            data-testid={`stimulus-${question.id}`}
            className="mb-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-200"
          >
            <code>{question.stimulus}</code>
          </pre>
        ) : null}

        <p className="text-sm font-semibold text-slate-100">{question.stem}</p>

        <div className="mt-3 space-y-2">
          {question.choicesJson.map((choice) => {
            const isSelected =
              capturedAnswer?.answer === choice.id && !capturedAnswer?.isIDK;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => selectChoice(question.id, choice.id)}
                data-testid={`choice-${question.id}-${choice.id}`}
                className={
                  isSelected
                    ? "flex w-full items-start gap-3 rounded-lg border border-emerald-400/60 bg-emerald-400/10 px-4 py-2.5 text-left transition duration-200"
                    : "flex w-full items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-left transition duration-200 hover:border-slate-500"
                }
              >
                <span
                  className={
                    isSelected
                      ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-400/15 text-xs font-bold text-emerald-300"
                      : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-950/70 text-xs font-bold text-slate-300"
                  }
                >
                  {choice.id}
                </span>
                <span className="text-sm text-slate-200">{choice.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => selectIdk(question.id)}
            data-testid={`idk-${question.id}`}
            className={
              capturedAnswer?.isIDK
                ? "rounded-lg border border-amber-400/60 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-300 transition duration-200"
                : "rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition duration-200 hover:border-amber-400/50 hover:text-amber-300"
            }
          >
            I don&apos;t know
          </button>

          {isPractice ? (
            <button
              type="button"
              onClick={() => handleCheck(question.id)}
              disabled={!capturedAnswer || checkingId === question.id}
              data-testid={`check-${question.id}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {checkingId === question.id ? "Checking…" : "Check answer"}
            </button>
          ) : null}
        </div>

        {isPractice && practice ? (
          <div
            data-testid={`practice-result-${question.id}`}
            className={
              practice.isCorrect
                ? "mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4"
                : "mt-4 rounded-xl border border-rose-400/40 bg-rose-400/10 p-4"
            }
          >
            <p
              className={
                practice.isCorrect
                  ? "text-sm font-bold text-emerald-300"
                  : "text-sm font-bold text-rose-300"
              }
            >
              {practice.isCorrect
                ? "Correct"
                : practice.isIDK
                  ? "You said you didn't know"
                  : "Not quite"}
            </p>
            <p className="mt-1 text-sm text-slate-300">{`Correct answer: ${practice.correctAnswer}`}</p>
            <p className="mt-2 text-sm text-slate-300">{practice.explanation}</p>
            {practice.misconceptionTagsToShow.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {practice.misconceptionTagsToShow.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AmbientBackdrop />

      <div className="relative mx-auto max-w-4xl px-6 py-10 sm:px-8">
        <header className="border-b border-slate-800/80 pb-6 animate-[rise_0.5s_ease_both]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
                StudyMate · Exam shell
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {blueprintName}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {`${sections.length} sections · ${totalMinutes} min total · started ${startedLabel}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                {modeLabel}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                {finished ? "Completed" : "In progress"}
              </span>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div
            data-testid="exam-shell-error"
            className="mt-6 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-300"
          >
            {errorMessage}
          </div>
        ) : null}

        {!sessionData && !errorMessage ? (
          <p data-testid="loading-questions" className="mt-6 text-sm text-slate-500">
            Loading questions…
          </p>
        ) : null}

        {finished ? (
          <section
            data-testid="session-complete"
            className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 animate-[rise_0.45s_ease_both]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
              Done
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Session complete</h2>
            <p className="mt-2 text-sm text-slate-300">
              You reached the end of {blueprintName}. Every section was reviewed or skipped.
            </p>
            <Link
              href="/app"
              className="mt-4 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200"
            >
              Back to dashboard
            </Link>
          </section>
        ) : null}

        {/* progress rail */}
        <ol className="mt-6 flex flex-wrap items-center gap-y-2 animate-[rise_0.5s_ease_both] [animation-delay:80ms]">
          {sections.map((section, index) => {
            const state = sectionState(index, section);
            return (
              <li key={section.id} className="flex items-center">
                <span
                  className={
                    state === "active"
                      ? "flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-400/15 text-sm font-bold text-emerald-300"
                      : state === "done"
                        ? "flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-sm font-bold text-slate-200"
                        : state === "skipped"
                          ? "flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/10 text-sm font-bold text-amber-300"
                          : "flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-slate-500"
                  }
                >
                  {section.id}
                </span>
                <span
                  className={
                    state === "active"
                      ? "ml-2 text-xs font-semibold text-emerald-300"
                      : state === "skipped"
                        ? "ml-2 text-xs font-semibold text-amber-300"
                        : "ml-2 text-xs font-medium text-slate-500"
                  }
                >
                  {state === "active"
                    ? "current"
                    : state === "done"
                      ? "done"
                      : state === "skipped"
                        ? "skipped"
                        : "upcoming"}
                </span>
                {index < lastIndex ? (
                  <span aria-hidden className="mx-3 h-px w-8 bg-slate-700/80" />
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* assembled sections, in blueprint order */}
        <ol className="mt-6 space-y-5">
          {sections.map((section, index) => {
            const state = sectionState(index, section);
            const isActive = state === "active" && !finished;
            const isEmpty = section.assembledCount === 0;
            const hasShortfall = !isEmpty && section.assembledCount < section.questionCount;
            const sectionQuestions = questionsBySection.get(section.id) ?? [];
            const weightSuffix =
              typeof section.weightPercent === "number" && section.weightPercent > 0
                ? ` · ${section.weightPercent}% of score`
                : "";

            return (
              <li
                key={section.id}
                id={`section-card-${section.id}`}
                data-testid={`section-card-${section.id}`}
                className={
                  isActive
                    ? "scroll-mt-6 rounded-2xl border border-emerald-400/40 bg-slate-900/70 p-6 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-400/20 animate-[rise_0.5s_ease_both] [animation-delay:160ms]"
                    : "scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 animate-[rise_0.5s_ease_both] [animation-delay:160ms]"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 text-base font-bold text-slate-200">
                      {section.id}
                    </span>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                        {section.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {`${section.questionCount} questions · ${section.durationMinutes} min${weightSuffix}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      isEmpty
                        ? "rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300"
                        : hasShortfall
                          ? "rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300"
                          : "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                    }
                  >
                    {isEmpty
                      ? "awaiting questions"
                      : hasShortfall
                        ? `${section.assembledCount} of ${section.questionCount} available`
                        : `${section.assembledCount} assembled`}
                  </span>
                </div>

                {section.subParts.length > 0 ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {section.subParts.map((subPart) => (
                      <li
                        key={subPart.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/50 px-3.5 py-2.5 transition duration-200 hover:border-slate-600"
                      >
                        <p className="text-sm font-semibold text-slate-200">
                          {`${subPart.id} · ${subPart.name}`}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {`${subPart.questionCount} question · ${subPart.durationMinutes} min`}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {isEmpty ? (
                  /* R36 — placeholder for a section assembled with zero questions */
                  <div
                    data-testid="no-questions-placeholder"
                    className="mt-4 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 px-4 py-3.5"
                  >
                    <p className="text-sm font-semibold text-amber-300">No questions yet</p>
                    <p className="mt-1 text-sm text-slate-400">
                      This section has no questions yet — skip it to keep moving through your
                      session.
                    </p>
                  </div>
                ) : hasShortfall ? (
                  /* R44 — shortfall surfaced, never a crash */
                  <p className="mt-4 text-sm text-amber-300">
                    {`Only ${section.assembledCount} of ${section.questionCount} questions are available for this section right now.`}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-emerald-300">
                    {`All ${section.assembledCount} questions assembled and ready.`}
                  </p>
                )}

                {sectionQuestions.length > 0 ? (
                  <div
                    data-testid={`section-questions-${section.id}`}
                    className="mt-4 space-y-4"
                  >
                    {sectionQuestions.map((question) => renderQuestion(question))}
                  </div>
                ) : null}

                {isActive ? (
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-4">
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleBack(index)}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition duration-200 hover:border-slate-500 hover:bg-slate-800"
                      >
                        Previous
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleAdvance(index)}
                      disabled={isPending || submitting}
                      data-testid={
                        index === lastIndex && !isPractice && hasQuestions
                          ? "submit-exam-section"
                          : undefined
                      }
                      className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {index === lastIndex
                        ? !isPractice && hasQuestions
                          ? submitting
                            ? "Submitting…"
                            : "Submit answers"
                          : "Finish session"
                        : "Next section"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSkip(section.id, index)}
                      disabled={isPending}
                      data-testid="skip-section"
                      className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-300 transition duration-200 hover:border-amber-300 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Skip section
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* EXAM mode — single Submit for the whole session at once */}
        {!isPractice && hasQuestions ? (
          <div
            data-testid="exam-submit-bar"
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-400/40 bg-slate-900/70 p-6 animate-[rise_0.5s_ease_both]"
          >
            <div>
              <p className="text-sm font-semibold text-white">Ready to submit?</p>
              <p className="mt-1 text-sm text-slate-400">
                {`${answeredCount} of ${totalQuestions} answered · "I don't know" and unanswered count as not correct`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSubmitExam()}
              disabled={submitting}
              data-testid="submit-exam"
              className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {submitting ? "Submitting…" : "Submit answers"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
