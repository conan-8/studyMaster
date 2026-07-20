import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-slate-200">StudyMate</h1>
      <p className="text-xl text-slate-300 max-w-prose mx-auto leading-relaxed">
        Your intelligent exam preparation platform. Built with Next.js 15, Tailwind CSS, and modern tools.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <Link
          href="/login"
          className="rounded-lg border border-slate-700 px-5 py-2.5 font-medium text-slate-200 transition hover:bg-slate-800"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-white px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
