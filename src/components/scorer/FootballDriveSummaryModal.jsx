import React, { useEffect, useRef } from 'react';

const metricClass = 'min-w-0 px-3 py-3 text-center';

export default function FootballDriveSummaryModal({ summary, onClose }) {
  const continueRef = useRef(null);

  useEffect(() => {
    if (!summary) return undefined;
    continueRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, summary]);

  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-zinc-950/65 p-4" role="presentation">
      <section
        aria-label="Drive summary"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-emerald-500 bg-white shadow-2xl"
        role="dialog"
      >
        <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 px-6 py-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Scoring Drive Complete</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black">Drive Summary</h2>
            <span className="text-right text-sm font-bold text-emerald-100">{summary.teamName}</span>
          </div>
        </header>

        <div className="p-6">
          <dl className="grid grid-cols-3 divide-x divide-emerald-200 rounded-md border border-emerald-200 bg-emerald-50">
            <div className={metricClass}>
              <dt className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Plays</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-950">{summary.plays}</dd>
            </div>
            <div className={metricClass}>
              <dt className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Yards</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-950">{summary.yards}</dd>
            </div>
            <div className={metricClass}>
              <dt className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Time of Poss</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-950">{summary.timeOfPossession}</dd>
            </div>
          </dl>

          <section className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-zinc-500">Scoring Play</h3>
            <p className="mt-1 text-xl font-black leading-snug text-zinc-950">{summary.scoringPlay}</p>
          </section>

          <p className="mt-4 text-sm font-semibold text-zinc-600">{summary.startInfo}</p>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-zinc-200 pt-4">
            <span className="text-xs font-semibold text-zinc-500">Enter or Esc to continue</span>
            <button
              ref={continueRef}
              className="rounded bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              onClick={onClose}
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
