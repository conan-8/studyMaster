import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { LogoutButton } from "./logout-button";
import { StartMockExam } from "./start-mock-exam";
import { QuickPractice } from "./quick-practice";

export const metadata: Metadata = {
  title: "Dashboard · StudyMate",
};

/**
 * R32 — the real APCSA section summary, replacing the old hardcoded
 * "AP Physics 1 · Test Preview" card. Rendered verbatim as single text nodes
 * so they are trivially selectable by tests.
 */
const MOCK_SECTION_SUMMARY = [
  "Section I · 40 multiple-choice · 90 min · 50%",
  "Section II · 4 free-response (FRQ) · 90 min · 50%",
] as const;

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // R28 — keep the auth guard.
  if (!user) {
    redirect("/login");
  }

  // R31 — the four seeded APCSA units, ordered by unit number.
  const units = await prisma.unit.findMany({
    where: { subject: { code: "APCSA" } },
    orderBy: { unitNumber: "asc" },
  });

  const practiceUnits = units.map((unit) => ({
    id: unit.id,
    unitNumber: unit.unitNumber,
    title: unit.title,
    examWeight: unit.examWeight,
  }));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AmbientBackdrop />

      <div className="relative mx-auto max-w-5xl px-6 py-10 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-6 animate-[rise_0.5s_ease_both]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
              StudyMate · Exam prep
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">Welcome back to StudyMate.</p>
          </div>
          <LogoutButton />
        </header>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 animate-[rise_0.5s_ease_both] [animation-delay:80ms]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Signed in as
            </p>
            <p className="mt-0.5 text-base font-medium text-white">{user.email}</p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            AP Computer Science A
          </span>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* R29/R30/R32/R33 — Start Mock Exam card */}
          <section className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-500/5 sm:p-7 lg:col-span-3 animate-[rise_0.5s_ease_both] [animation-delay:160ms]">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-400/90">
                  AP Computer Science A
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Mock Exam</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Full-length run · 2 sections · 180 minutes
                </p>
              </div>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                Full length
              </span>
            </div>

            <ul className="mt-5 space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
              {MOCK_SECTION_SUMMARY.map((line) => (
                <li key={line} className="flex items-center gap-3 text-sm text-slate-300">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <StartMockExam />
            </div>
          </section>

          {/* R31/R40-R44 — Quick Practice entry point */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-emerald-500/5 sm:p-7 lg:col-span-2 animate-[rise_0.5s_ease_both] [animation-delay:240ms]">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/90">
              APCSA Quick Practice
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Quick Practice</h2>
            <p className="mt-1 text-sm text-slate-400">
              10-question sets · one unit at a time
            </p>

            <QuickPractice units={practiceUnits} />
          </section>
        </div>
      </div>
    </main>
  );
}
