export default function ExamSessionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <div className="text-center">
        <div
          aria-hidden
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400"
        />
        <p className="mt-4 text-sm text-slate-400">Loading your session…</p>
      </div>
    </main>
  );
}
