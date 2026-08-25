import React from 'react';

export default function FootballClockEntryModal({
  ariaLabel,
  eyebrow,
  error,
  inputId,
  inputRef,
  onChange,
  onSubmit,
  value,
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-zinc-950/60 p-4" role="presentation">
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        className="w-full max-w-md rounded border border-sky-400 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-sky-200 bg-sky-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-sky-800">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">What does the game clock read?</h2>
        </div>

        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-semibold text-zinc-900" htmlFor={inputId}>
              Game Clock
            </label>
            <input
              ref={inputRef}
              aria-invalid={error ? 'true' : 'false'}
              autoFocus
              autoComplete="off"
              className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-2xl font-bold tabular-nums tracking-widest outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              id={inputId}
              inputMode="numeric"
              onChange={onChange}
              placeholder="M:SS or MM:SS"
              value={value}
            />
            {error && (
              <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end border-t border-zinc-200 pt-4">
            <button
              className="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
              type="submit"
            >
              Record Clock
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
