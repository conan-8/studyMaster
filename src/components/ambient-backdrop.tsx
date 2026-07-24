/**
 * Layered ambient background shared by the dashboard and the exam shell:
 * a faint blueprint grid plus two slow-drifting glows (emerald + amber).
 * Purely decorative — hidden from assistive tech, never intercepts clicks.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* faint grid, fading out towards the bottom */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(75%_65%_at_50%_0%,black,transparent)]" />
      {/* drifting glows */}
      <div className="absolute -top-32 left-[-10%] h-96 w-[36rem] rounded-full bg-emerald-500/10 blur-3xl animate-[drift_16s_ease-in-out_infinite_alternate]" />
      <div className="absolute -top-24 right-[-12%] h-80 w-[30rem] rounded-full bg-amber-500/10 blur-3xl animate-[drift_22s_ease-in-out_infinite_alternate-reverse]" />

      <style>{`
        @keyframes drift {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(48px, 28px, 0) scale(1.08); }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
