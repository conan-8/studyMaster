export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <div className="w-full max-w-md space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-800" />
      </div>
    </main>
  );
}
