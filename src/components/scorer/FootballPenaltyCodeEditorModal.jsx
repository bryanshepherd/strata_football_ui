import React, { useEffect, useMemo, useState } from 'react';
import {
  listFootballPenaltyTable,
  saveFootballPenaltyDefinition,
} from '../../quick-input/penaltyTable';

const emptyPenalty = () => ({
  code: '',
  name: '',
  liveBall: true,
  deadBall: false,
  ejectionable: false,
  yards: '',
  requiresYards: false,
  requiresSpot: false,
  defaultEnforcement: 'PREVIOUS',
  automaticFirstDown: false,
  lossOfDown: false,
});

const formForPenalty = (penalty) => ({
  ...emptyPenalty(),
  ...penalty,
  yards: penalty?.yards ?? '',
});

export default function FootballPenaltyCodeEditorModal({ onClose, open }) {
  const [entries, setEntries] = useState(() => listFootballPenaltyTable());
  const [filter, setFilter] = useState('');
  const [previousCode, setPreviousCode] = useState(null);
  const [form, setForm] = useState(() => emptyPenalty());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setEntries(listFootballPenaltyTable());
    setFilter('');
    setPreviousCode(null);
    setForm(emptyPenalty());
    setMessage('');
    setError('');
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const visibleEntries = useMemo(() => {
    const query = filter.trim().toUpperCase();
    if (!query) return entries;
    return entries.filter((entry) => (
      entry.code.includes(query) || entry.name.toUpperCase().includes(query)
    ));
  }, [entries, filter]);

  if (!open) return null;

  const startNew = () => {
    setPreviousCode(null);
    setForm(emptyPenalty());
    setMessage('');
    setError('');
  };

  const editPenalty = (penalty) => {
    setPreviousCode(penalty.code);
    setForm(formForPenalty(penalty));
    setMessage('');
    setError('');
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const save = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const saved = saveFootballPenaltyDefinition({
        ...form,
        code: form.code,
        yards: form.yards === '' ? undefined : Number(form.yards),
      }, { previousCode: previousCode || undefined });
      setEntries(listFootballPenaltyTable());
      setPreviousCode(saved.code);
      setForm(formForPenalty(saved));
      setMessage(`${saved.name} (${saved.code}) saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Penalty code could not be saved.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
      <section
        aria-label="Edit penalty codes"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-zinc-300 bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Game Control</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">Edit Penalty Codes</h2>
            <p className="mt-1 text-sm text-zinc-600">Add or revise the penalty types available during play entry.</p>
          </div>
          <button
            aria-label="Close penalty code editor"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
            type="button"
          >
            Esc
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-zinc-200 bg-zinc-50 md:border-b-0 md:border-r">
            <div className="space-y-2 border-b border-zinc-200 p-4">
              <input
                aria-label="Search penalty codes"
                className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search code or name"
                type="search"
                value={filter}
              />
              <button
                className="w-full rounded border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                onClick={startNew}
                type="button"
              >
                Add Penalty Type
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {visibleEntries.map((entry) => (
                <button
                  className={`mb-1 w-full rounded border px-3 py-2 text-left hover:bg-white ${
                    previousCode === entry.code ? 'border-emerald-600 bg-emerald-50' : 'border-transparent'
                  }`}
                  key={entry.code}
                  onClick={() => editPenalty(entry)}
                  type="button"
                >
                  <span className="block text-xs font-black text-emerald-800">{entry.code}</span>
                  <span className="block text-sm font-semibold text-zinc-900">{entry.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <form className="min-h-0 overflow-y-auto p-5" onSubmit={save}>
            <h3 className="text-lg font-semibold text-zinc-950">{previousCode ? 'Edit Penalty Type' : 'Add Penalty Type'}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-zinc-800">
                Penalty Code
                <input
                  autoFocus
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono uppercase"
                  maxLength={12}
                  onChange={(event) => update('code', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  required
                  value={form.code}
                />
              </label>
              <label className="text-sm font-semibold text-zinc-800">
                Penalty Name
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                  onChange={(event) => update('name', event.target.value)}
                  required
                  value={form.name}
                />
              </label>
              <label className="text-sm font-semibold text-zinc-800">
                Default Yards
                <input
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                  min="0"
                  onChange={(event) => update('yards', event.target.value)}
                  placeholder="Variable"
                  type="number"
                  value={form.yards}
                />
              </label>
              <label className="text-sm font-semibold text-zinc-800">
                Default Enforcement
                <select
                  className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2"
                  onChange={(event) => update('defaultEnforcement', event.target.value)}
                  value={form.defaultEnforcement}
                >
                  <option value="PREVIOUS">Previous Spot</option>
                  <option value="SPOT">Spot of Foul</option>
                  <option value="END">Succeeding Spot</option>
                </select>
              </label>
            </div>

            <fieldset className="mt-5 grid gap-3 rounded border border-zinc-200 p-4 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold text-zinc-800">Penalty Rules</legend>
              {[
                ['liveBall', 'Live-Ball Penalty'],
                ['deadBall', 'Dead-Ball Penalty'],
                ['ejectionable', 'Ejectionable'],
                ['requiresYards', 'Ask Operator for Yards'],
                ['requiresSpot', 'Requires Spot of Foul'],
                ['automaticFirstDown', 'Automatic First Down'],
                ['lossOfDown', 'Loss of Down'],
              ].map(([field, label]) => (
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-800" key={field}>
                  <input
                    checked={Boolean(form[field])}
                    onChange={(event) => update(field, event.target.checked)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {error && <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{error}</p>}
            {message && <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">{message}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border border-zinc-300 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50" onClick={onClose} type="button">
                Close
              </button>
              <button className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800" type="submit">
                Save Penalty Type
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
