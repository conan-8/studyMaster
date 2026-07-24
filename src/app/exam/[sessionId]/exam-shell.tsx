"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { finishSession } from "./actions";
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

/**
 * R34-R37 — the exam shell. Every section is rendered from the blueprint's
 * sectionsJson (names, counts, durations, subParts) together with its
 * assembled question count from answersJson. Sections with an empty question
 * list get the "no questions yet" placeholder and a Skip control so the user
 * can proceed through and complete the session.
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
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(initialIndex, 0), sections.length - 1),
  );
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [finished, setFinished] = useState(() => status === "COMPLETED");
  const [isPending, startTransition] = useTransition();

  const lastIndex = sections.length - 1;
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const totalMinutes = sections.reduce((sum, section) => sum + section.durationMinutes, 0);
  const startedLabel = new Date(startedAt).toLocaleString();

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
    } else {
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
                      disabled={isPending}
                      className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {index === lastIndex ? "Finish session" : "Next section"}
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
      </div>
    </main>
  );
}
