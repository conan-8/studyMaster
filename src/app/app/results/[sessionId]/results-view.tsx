import Link from "next/link";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import type { OverallRollup, SectionRollup } from "@/lib/exam/score";
import type { ResultsData, ReviewEntry, ReviewStatus } from "./data";
import { UnitBarChart, formatPercent } from "./unit-bar-chart";

type ResultsViewProps = {
  blueprintName: string;
  mode: string;
  completedAt: string | null;
  data: ResultsData | null;
};

const MODE_LABELS: Record<string, string> = {
  EXAM: "Mock exam",
  PRACTICE: "Quick practice",
  DIAGNOSTIC: "Diagnostic",
};

const STATUS_PILLS: Record<ReviewStatus, { label: string; className: string }> = {
  correct: {
    label: "Correct",
    className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  },
  wrong: {
    label: "Incorrect",
    className: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  },
  idk: {
    label: "Didn't know",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  },
  unanswered: {
    label: "Not answered",
    className: "border-slate-700 bg-slate-900 text-slate-400",
  },
};

const ENTRY_BORDERS: Record<ReviewStatus, string> = {
  correct: "border-emerald-400/30 hover:border-emerald-400/60 hover:shadow-emerald-500/5",
  wrong: "border-rose-400/30 hover:border-rose-400/60 hover:shadow-rose-500/5",
  idk: "border-amber-400/30 hover:border-amber-400/60 hover:shadow-amber-500/5",
  unanswered: "border-slate-800 hover:border-slate-600 hover:shadow-black/20",
};

function choiceText(entry: ReviewEntry, choiceId: string): string {
  return entry.choices.find((choice) => choice.id === choiceId)?.text ?? choiceId;
}

/** Rules 36 — overall summary straight from the persisted OverallRollup. */
function OverallSummary({
  overall,
  sections,
}: {
  overall: OverallRollup;
  sections: SectionRollup[];
}) {
  return (
    <section
      data-testid="overall-summary"
      className="relative mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 animate-[rise_0.5s_ease_both] [animation-delay:80ms] sm:p-8"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,auto)_1fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
            Overall score
          </p>
          <p className="mt-2 text-6xl font-bold tabular-nums tracking-tighter text-white sm:text-7xl">
            {formatPercent(overall.percent)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            <span className="font-semibold text-emerald-300">{overall.correct}</span> of{" "}
            {overall.total} multiple-choice questions correct
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40">
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Correct
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-white">{overall.correct}</dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/40">
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Didn&apos;t know
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-amber-300">
              {overall.idkCount}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-slate-600">
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              Unanswered
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-300">
              {overall.unansweredCount}
            </dd>
          </div>
        </dl>
      </div>

      {sections.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
          {sections.map((section) => (
            <span
              key={section.sectionId}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium tabular-nums text-slate-300"
            >
              Section {section.sectionId} ·{" "}
              <span className="font-semibold text-white">
                {section.correct}/{section.total}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        IDK and unanswered questions count toward the total but are never marked correct.
      </p>
    </section>
  );
}

/** Rules 39–43 — one review card per MCQ question (answered, IDK, unanswered). */
function ReviewEntryCard({ entry, index }: { entry: ReviewEntry; index: number }) {
  const pill = STATUS_PILLS[entry.status];
  const isAnswered = entry.status === "correct" || entry.status === "wrong";

  return (
    <li
      data-testid={`review-entry-${entry.questionId}`}
      className={`rounded-2xl border bg-slate-900/50 p-5 shadow-transparent transition duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-6 animate-[rise_0.5s_ease_both] ${ENTRY_BORDERS[entry.status]}`}
      style={{ animationDelay: `${240 + Math.min(index, 8) * 70}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/70 text-xs font-bold tabular-nums text-slate-300">
          {index + 1}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${pill.className}`}
        >
          {pill.label}
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
          Unit {entry.unitNumber} · {entry.unitTitle}
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-400">
          Section {entry.sectionId}
        </span>
      </div>

      {entry.stimulus ? (
        <blockquote className="mt-4 whitespace-pre-line rounded-lg border-l-2 border-slate-700 bg-slate-950/50 px-4 py-3 text-sm leading-relaxed text-slate-300">
          {entry.stimulus}
        </blockquote>
      ) : null}

      <p className="mt-4 text-sm font-semibold leading-relaxed text-white sm:text-base">
        {entry.stem}
      </p>

      {/* Distinct IDK / unanswered banners — IDK is never styled as correct. */}
      {entry.status === "idk" ? (
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-200">
          You said you didn&apos;t know
        </p>
      ) : null}
      {entry.status === "unanswered" ? (
        <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-400">
          Not answered
        </p>
      ) : null}

      {/* The user's answer versus the correct answer, choice id + text. */}
      <p className="mt-4 text-sm">
        <span className="text-slate-500">Your answer:</span>{" "}
        {isAnswered ? (
          <span
            className={`font-semibold ${
              entry.status === "correct" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {entry.selectedAnswer}. {choiceText(entry, entry.selectedAnswer)}
          </span>
        ) : (
          <span className="font-medium text-slate-400">
            {entry.status === "idk" ? "I don't know" : "—"}
          </span>
        )}
        <span aria-hidden className="mx-2 text-slate-700">
          ·
        </span>
        <span className="text-slate-500">Correct answer:</span>{" "}
        <span className="font-semibold text-emerald-300">
          {entry.correctAnswer}. {choiceText(entry, entry.correctAnswer)}
        </span>
      </p>

      {entry.choices.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {entry.choices.map((choice) => {
            const isCorrectChoice = choice.id === entry.correctAnswer;
            const isPicked = isAnswered && choice.id === entry.selectedAnswer;
            const rowClass = isCorrectChoice
              ? "border-emerald-400/50 bg-emerald-400/10"
              : isPicked
                ? "border-rose-400/50 bg-rose-400/10"
                : "border-slate-800 bg-slate-950/40";
            const badgeClass = isCorrectChoice
              ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
              : isPicked
                ? "border-rose-400/60 bg-rose-400/15 text-rose-300"
                : "border-slate-700 bg-slate-900 text-slate-400";

            return (
              <li
                key={choice.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${rowClass}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${badgeClass}`}
                >
                  {choice.id}
                </span>
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    isCorrectChoice || isPicked ? "text-white" : "text-slate-400"
                  }`}
                >
                  {choice.text}
                </span>
                {isCorrectChoice ? (
                  <span className="shrink-0 text-xs font-semibold text-emerald-300">
                    {isPicked ? "Your answer · Correct" : "Correct answer"}
                  </span>
                ) : isPicked ? (
                  <span className="shrink-0 text-xs font-semibold text-rose-300">Your answer</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Misconception tags surface ONLY on a real wrong distractor (rule 43). */}
      {entry.misconceptionTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300">
            Misconception
          </span>
          {entry.misconceptionTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-200"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Explanation
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
          {entry.explanation}
        </p>
      </div>
    </li>
  );
}

/**
 * Rules 34–44 — the real results page presentation: overall summary from the
 * persisted ScoreJson, the plain-div per-unit accuracy chart, and a review
 * list covering every assembled MCQ question in the session.
 */
export function ResultsView({ blueprintName, mode, completedAt, data }: ResultsViewProps) {
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const completedLabel = completedAt
    ? `Completed ${new Date(completedAt).toLocaleString()}`
    : "Awaiting submission";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AmbientBackdrop />

      <div className="relative mx-auto max-w-5xl px-6 py-10 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-6 animate-[rise_0.5s_ease_both]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
              StudyMate · Exam results
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {blueprintName}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{completedLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
              {modeLabel}
            </span>
            <Link
              href="/app"
              className="inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        {data ? (
          <>
            <OverallSummary overall={data.score.overall} sections={data.score.sections} />
            <UnitBarChart units={data.score.units} />

            <section className="mt-8 animate-[rise_0.5s_ease_both] [animation-delay:240ms]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
                    Question review
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    Every question, reviewed
                  </h2>
                </div>
                <p className="text-xs tabular-nums text-slate-500">
                  {data.entries.length}{" "}
                  {data.entries.length === 1 ? "question" : "questions"}
                </p>
              </div>

              {data.entries.length > 0 ? (
                <ol className="mt-5 space-y-4">
                  {data.entries.map((entry, index) => (
                    <ReviewEntryCard key={entry.questionId} entry={entry} index={index} />
                  ))}
                </ol>
              ) : (
                <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400">
                  No multiple-choice questions were assembled for this session.
                </p>
              )}
            </section>
          </>
        ) : (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 animate-[rise_0.5s_ease_both] [animation-delay:80ms] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-400/90">
              Results
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              No results yet
            </h2>
            <p className="mt-2 max-w-prose text-sm text-slate-400">
              This session hasn&apos;t been scored yet. Submit the exam and your score,
              per-unit accuracy, and a full question-by-question review will appear here.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-200"
            >
              Back to dashboard
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
