"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startQuickPractice } from "./actions";

export type PracticeUnit = {
  id: string;
  unitNumber: number;
  title: string;
  examWeight: number;
};

type Notice =
  | { kind: "empty"; unitId: string }
  | { kind: "shortfall"; unitId: string; assembledCount: number };

const PRACTICE_SET_SIZE = 10;

/**
 * R31/R40-R44 — pick one of the four APCSA units and start a 10-question
 * PRACTICE session. A returned id routes to /exam/[sessionId]; `null` from
 * assembly (zero active questions) renders the "no questions yet" placeholder
 * with NO navigation and NO session; a 1-9 count surfaces a shortfall note.
 */
export function QuickPractice({ units }: { units: PracticeUnit[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingUnitId, setPendingUnitId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleStart(unitId: string) {
    setNotice(null);
    setError(null);
    setPendingUnitId(unitId);

    startTransition(async () => {
      const result = await startQuickPractice(unitId);
      setPendingUnitId(null);

      if (result.sessionId) {
        if (
          typeof result.assembledCount === "number" &&
          result.assembledCount < PRACTICE_SET_SIZE
        ) {
          // R44 — surface the shortfall, give it a beat, then enter the session.
          setNotice({ kind: "shortfall", unitId, assembledCount: result.assembledCount });
          await new Promise((resolve) => setTimeout(resolve, 1400));
        }
        router.push(`/exam/${result.sessionId}`);
      } else if (result.empty) {
        // R43 — zero active questions: placeholder, no session, no navigation.
        setNotice({ kind: "empty", unitId });
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-5">
      {units.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
          Units are being prepared. Check back soon.
        </p>
      ) : (
        <div className="grid gap-2.5">
          {units.map((unit) => {
            const isThisPending = pendingUnitId === unit.id;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => handleStart(unit.id)}
                disabled={isPending}
                data-testid={`quick-practice-unit-${unit.unitNumber}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-left transition duration-200 hover:-translate-y-px hover:border-emerald-400/50 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-sm font-bold text-emerald-300">
                    {unit.unitNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {`Unit ${unit.unitNumber} · ${unit.title}`}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {`${Math.round(unit.examWeight * 100)}% of exam weight`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-emerald-300 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {isThisPending ? "Starting…" : "Start"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {notice?.kind === "empty" ? (
        <p
          role="status"
          data-testid="quick-practice-no-questions"
          className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-200"
        >
          There are no questions yet for that unit. Check back soon.
        </p>
      ) : null}

      {notice?.kind === "shortfall" ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-200"
        >
          {`Only ${notice.assembledCount} of ${PRACTICE_SET_SIZE} questions are available in that unit right now — starting your set…`}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
