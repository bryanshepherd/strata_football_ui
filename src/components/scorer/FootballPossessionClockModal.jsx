import React, { useEffect, useRef, useState } from 'react';

const normalizeClock = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

const formatClockInput = (value) => {
  const rawValue = String(value || '');
  if (rawValue.includes(':')) {
    const [minutes = '', ...secondParts] = rawValue.split(':');
    const minuteDigits = minutes.replace(/\D/g, '').slice(0, 2);
    const secondDigits = secondParts.join('').replace(/\D/g, '').slice(0, 2);
    const paddedMinutes = minuteDigits.length === 1 ? `0${minuteDigits}` : minuteDigits;
    return `${paddedMinutes}:${secondDigits}`;
  }

  const digits = rawValue.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
};

export default function FootballPossessionClockModal({ change, onSave }) {
  const [clock, setClock] = useState(() => formatClockInput(change?.defaultClock || ''));
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setClock(formatClockInput(change?.defaultClock || ''));
    setError('');
    if (!change) return undefined;
    const selectionTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(selectionTimer);
  }, [change]);

  if (!change) return null;

  const submit = (event) => {
    event.preventDefault();
    const normalized = normalizeClock(clock);
    if (!normalized) {
      setError('Enter the game clock in MM:SS format.');
      return;
    }
    onSave(normalized);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-zinc-950/60 p-4" role="presentation">
      <section
        aria-label="Change of possession clock"
        aria-modal="true"
        className="w-full max-w-md rounded border border-sky-400 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-sky-200 bg-sky-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-sky-800">Change of Possession</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">What does the game clock read?</h2>
        </div>

        <form className="space-y-4 p-5" onSubmit={submit}>
          <div>
            <label className="text-sm font-semibold text-zinc-900" htmlFor="possession-change-clock">
              Game Clock
            </label>
            <input
              ref={inputRef}
              aria-invalid={error ? 'true' : 'false'}
              autoFocus
              autoComplete="off"
              className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-2xl font-bold tabular-nums tracking-widest outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              id="possession-change-clock"
              inputMode="numeric"
              onChange={(event) => {
                setClock(formatClockInput(event.target.value));
                setError('');
              }}
              placeholder="_ _ : _ _"
              value={clock}
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
