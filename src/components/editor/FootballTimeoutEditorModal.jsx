import React, { useEffect, useRef, useState } from 'react';
import { footballTimeoutValues } from '../../utils/footballTimeout';

export default function FootballTimeoutEditorModal({ event, teams, contextReview, onClose, onSave, saveError }) {
  const [draft, setDraft] = useState(() => footballTimeoutValues(event));
  const firstInput = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    firstInput.current?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  const baseline = footballTimeoutValues(event);
  const dirty = draft.teamSide !== baseline.teamSide || draft.clock !== baseline.clock;
  const canRecalculate = Boolean(contextReview?.expected && !contextReview.unavailable);
  const save = () => onSave(draft, { recalculateContext: canRecalculate });
  const handleKeyDown = e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key !== 'Tab') return;
    const inputs = [...dialog.current.querySelectorAll('button:not(:disabled), input, select')];
    if (e.shiftKey && document.activeElement === inputs[0]) { e.preventDefault(); inputs.at(-1)?.focus(); }
    else if (!e.shiftKey && document.activeElement === inputs.at(-1)) { e.preventDefault(); inputs[0]?.focus(); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-3">
    <form ref={dialog} role="dialog" aria-modal="true" aria-label={`Edit Timeout ${event.sequence}`} onKeyDown={handleKeyDown}
      onSubmit={e => { e.preventDefault(); if (dirty) save(); }}
      className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-300 bg-zinc-100 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-300 bg-white px-5 py-4">
        <div><div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Play #{event.sequence} · Q{event.period}</div><h1 className="mt-1 text-xl font-black">Edit timeout</h1></div>
        <button type="button" aria-label="Close timeout editor" onClick={onClose} className="rounded border border-zinc-300 px-3 py-1 text-xl">×</button>
      </header>
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Timeout Team
            <select ref={firstInput} value={draft.teamSide} onChange={e => setDraft({ ...draft, teamSide: e.target.value })} className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2">
              <option value="">Choose team</option>
              {['V', 'H'].map(side => <option key={side} value={side}>{teams[side]?.name || side}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Timeout Clock
            <input value={draft.clock} onChange={e => setDraft({ ...draft, clock: e.target.value })} placeholder="5:59" className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2" />
          </label>
        </div>
        <section aria-label="Timeout context" className={`rounded border p-3 text-sm ${contextReview?.fields.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-zinc-300 bg-white'}`}>
          <h2 className="font-bold">{contextReview?.fields.length ? 'Context mismatch' : 'Recorded context'}</h2>
          <p className="mt-1">Recorded: {contextReview?.recordedLabel || 'Unavailable'}</p>
          {canRecalculate ? <>
            <p className="mt-1">After #{contextReview.previousSequence}: {contextReview.expectedLabel}</p>
            <p className="mt-2">Saving uses the preceding result for this timeout’s context. Later recorded plays stay unchanged.</p>
            <button type="button" disabled={dirty} onClick={save} className="mt-3 rounded border border-amber-500 bg-white px-3 py-2 font-bold disabled:opacity-40">Recalculate context</button>
          </> : <p className="mt-2">{contextReview?.unavailable || 'No preceding context is available.'}</p>}
        </section>
        {saveError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{saveError}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-zinc-300 bg-white px-5 py-4">
        <button type="button" onClick={onClose} className="rounded border border-zinc-300 px-4 py-2 font-bold">Cancel</button>
        <button type="submit" disabled={!dirty} className="rounded bg-emerald-700 px-4 py-2 font-bold text-white disabled:bg-zinc-300">Save Changes</button>
      </footer>
    </form>
  </div>;
}
