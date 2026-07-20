import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-center">
      <p className="text-6xl font-bold text-slate-700">404</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-100">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-400">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-200"
      >
        Back home
      </Link>
    </main>
  );
}
