import React, { useEffect, useMemo, useRef, useState } from 'react';
import { footballBallContextRevisionValues } from '../../play-editor/footballBallContextRevision';

const sameRevision = (left, right) => (
  String(left.down) === String(right.down)
  && String(left.distance) === String(right.distance)
  && String(left.spot).trim().toUpperCase() === String(right.spot).trim().toUpperCase()
  && String(left.lineToGain).trim().toUpperCase() === String(right.lineToGain).trim().toUpperCase()
);

export default function FootballBallContextRevisionModal({
  downs = 4,
  event,
  isOpen,
  onClose,
  onDelete,
  onSave,
  saveError = '',
}) {
  const baseline = useMemo(() => footballBallContextRevisionValues(event), [event]);
  const [draft, setDraft] = useState(baseline);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(baseline);
    setShowDeletePrompt(false);
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [baseline, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (keyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return;
      keyboardEvent.preventDefault();
      if (showDeletePrompt) setShowDeletePrompt(false);
      else onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showDeletePrompt]);

  if (!isOpen || !event) return null;

  const hasChanges = !sameRevision(baseline, draft);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    if (!hasChanges) return;
    onSave({ ...draft });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-3" role="presentation">
      <form
        aria-label={`Edit Ball Context Revision ${event.sequence}`}
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-300 bg-zinc-100 shadow-2xl"
        onSubmit={submit}
        role="dialog"
      >
        <header className="border-b border-zinc-300 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Edit ball context revision</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600">Record #{event.sequence}</span>
              </div>
              <h1 className="mt-1 text-xl font-black text-zinc-950">Correct this recorded context</h1>
              <p className="mt-1 text-sm text-zinc-600">Later plays keep the down, distance, and spot they originally recorded.</p>
            </div>
            <button
              aria-label="Close ball context revision editor"
              className="grid h-9 w-9 shrink-0 place-items-center rounded border border-zinc-300 bg-white text-xl font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </header>

        <div className="border-b border-zinc-300 bg-zinc-50 px-5 py-3 text-xs font-semibold text-zinc-600">
          Q{event.period || '-'} {event.clock || '--:--'} · Possession {event.possession || '-'}
        </div>

        <main className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <RevisionField
              inputRef={firstInputRef}
              label="Down"
              max={downs}
              min="1"
              onChange={(value) => update('down', value)}
              type="number"
              value={draft.down}
            />
            <RevisionField
              label="Distance"
              min="1"
              onChange={(value) => update('distance', value)}
              type="number"
              value={draft.distance}
            />
            <RevisionField
              autoCapitalize="characters"
              label="Ball Spot"
              onChange={(value) => update('spot', value)}
              placeholder="H35"
              value={draft.spot}
            />
            <RevisionField
              autoCapitalize="characters"
              label="Line To Gain"
              onChange={(value) => update('lineToGain', value)}
              placeholder="H45 or goal"
              value={draft.lineToGain}
            />
          </div>

          {saveError && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900" role="alert">
              {saveError}
            </div>
          )}

          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            Delete this revision when the preceding replacement already establishes the correct context. Later records will be renumbered without changing their recorded starting context.
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-300 bg-white px-5 py-4">
          <button
            className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
            onClick={() => setShowDeletePrompt(true)}
            type="button"
          >
            Delete Revision
          </button>
          <div className="flex items-center gap-2">
            <button className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="rounded border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
              disabled={!hasChanges}
              type="submit"
            >
              Save Changes
            </button>
          </div>
        </footer>

        {showDeletePrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/70 p-4">
            <section
              aria-label={`Delete Ball Context Revision ${event.sequence}`}
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-red-300 bg-white p-5 shadow-2xl"
              role="alertdialog"
            >
              <h2 className="text-lg font-black text-zinc-950">Delete ball context revision #{event.sequence}?</h2>
              <p className="mt-2 text-sm text-zinc-700">
                This removes the revision from the game log and play-by-play, renumbers later records, and preserves their recorded starting contexts.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100" onClick={() => setShowDeletePrompt(false)} type="button">
                  Keep Revision
                </button>
                <button className="rounded border border-red-700 bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800" onClick={onDelete} type="button">
                  Delete Revision
                </button>
              </div>
            </section>
          </div>
        )}
      </form>
    </div>
  );
}

function RevisionField({ inputRef, label, onChange, value, ...inputProps }) {
  return (
    <label className="block text-sm font-bold text-zinc-800">
      {label}
      <input
        {...inputProps}
        className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base font-semibold text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        value={value}
      />
    </label>
  );
}
