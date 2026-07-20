"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-center">
      <h1 className="text-3xl font-bold text-slate-100">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-slate-400">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-600">Error ID: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-lg bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        Try again
      </button>
    </main>
  );
}
