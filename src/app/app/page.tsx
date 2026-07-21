import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  title: "Dashboard · StudyMate",
};

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Welcome back to StudyMate.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="mt-1 text-lg font-medium text-white">{user.email}</p>
        </section>

        <Link
          href="/exam"
          className="mt-6 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-slate-600 hover:bg-slate-900"
        >
          <div>
            <p className="text-lg font-semibold text-white">AP Physics 1 · Test Preview</p>
            <p className="mt-1 text-sm text-slate-400">
              Section I · 40 multiple-choice questions · 1 hr 20 min
            </p>
          </div>
          <span className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-950">
            Start exam
          </span>
        </Link>
      </div>
    </main>
  );
}
