import type { UnitRollup } from "@/lib/exam/score";

type UnitBarChartProps = {
  units: UnitRollup[];
};

/** Format a [0, 1] ratio for display, e.g. 0.9333 -> "93%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Rules 37/38 — the per-unit accuracy breakdown as a bar chart built from
 * plain styled div elements (no chart dependency). Each bar's fill width
 * reflects the unit's persisted `accuracy` ratio (correct / answered); a unit
 * with `answered === 0` is shown distinctly as a flat gray track carrying a
 * "No answers" label — there is no separate flag field in the frozen type.
 */
export function UnitBarChart({ units }: UnitBarChartProps) {
  if (units.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="unit-bar-chart"
      className="relative mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 animate-[rise_0.5s_ease_both] [animation-delay:160ms] sm:p-7"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
            Per-unit breakdown
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Accuracy by unit</h2>
        </div>
        <p className="text-xs text-slate-500">
          Accuracy = correct ÷ answered · IDK and unanswered are excluded
        </p>
      </div>

      <ul className="mt-6 space-y-5">
        {units.map((unit, index) => {
          // answered === 0 is the frozen "no answered questions" condition.
          const hasAnswers = unit.answered > 0;
          const widthPercent = Math.round(unit.accuracy * 100);

          return (
            <li key={unit.unitId} data-testid={`unit-bar-${unit.unitId}`} className="group">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 rounded-md border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-300 transition duration-300 group-hover:border-emerald-400/40">
                    Unit {unit.unitNumber}
                  </span>
                  <span className="truncate text-sm font-semibold text-white">{unit.title}</span>
                </p>
                <p className="text-xs tabular-nums text-slate-400">
                  {hasAnswers ? (
                    <>
                      <span className="font-semibold text-emerald-300">
                        {unit.correct}/{unit.answered} correct
                      </span>
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className="font-semibold text-white">
                        {formatPercent(unit.accuracy)} accuracy
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-500">No answers</span>
                  )}
                </p>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full border border-slate-800 bg-slate-950/70">
                {hasAnswers ? (
                  <div
                    role="img"
                    aria-label={`Unit ${unit.unitNumber} ${unit.title}: ${formatPercent(
                      unit.accuracy,
                    )} accuracy (${unit.correct} of ${unit.answered} answered questions correct)`}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 animate-[grow-bar_0.9s_ease_both] transition-[opacity] duration-300 group-hover:opacity-90"
                    style={{
                      width: `${widthPercent}%`,
                      animationDelay: `${200 + index * 110}ms`,
                    }}
                  />
                ) : (
                  /* Distinct "no answered questions" rendering: zero-width
                     emerald fill (none at all) over a flat gray track. */
                  <div aria-hidden className="h-full w-full bg-slate-800/40" />
                )}
              </div>

              <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                {unit.total} {unit.total === 1 ? "question" : "questions"} in this unit
              </p>
            </li>
          );
        })}
      </ul>

      {/* Bars grow from 0 to their inline width on page load (pure CSS, no JS). */}
      <style>{`
        @keyframes grow-bar {
          from { width: 0%; }
        }
      `}</style>
    </section>
  );
}
