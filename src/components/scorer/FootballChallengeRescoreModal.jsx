import React, { useEffect, useState } from 'react';
import { footballChallengeEventKey, footballChallengeTarget, FOOTBALL_CHALLENGE_PLAY_TYPES } from '../../utils/footballChallengeRescore';
import { formatFootballClockDisplay } from '../../utils/footballClock';

export default function FootballChallengeRescoreModal({ envelope, challenge, onClose, onConfirm, error }) {
  const [selected, setSelected] = useState('');
  useEffect(() => { setSelected(footballChallengeEventKey(footballChallengeTarget(envelope, challenge)) || ''); }, [challenge, envelope]);
  useEffect(() => {
    if (!challenge) return undefined;
    const ownKeys = event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', ownKeys, true);
    return () => window.removeEventListener('keydown', ownKeys, true);
  }, [challenge, onClose]);
  if (!challenge) return null;
  const candidates = envelope.events.filter(event => FOOTBALL_CHALLENGE_PLAY_TYPES.has(event.type) && event.sequence < challenge.sequence);
  const target = candidates.find(event => footballChallengeEventKey(event) === selected);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="challenge-rescore-title" className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
      <h2 id="challenge-rescore-title" className="text-xl font-black">Ruling overturned — rescore the play</h2>
      <p className="mt-2 text-sm">Confirm the play to correct. Its original record will remain in history marked Overturned.</p>
      <label className="mt-4 block text-sm font-bold">Play to rescore
        <select autoFocus className="mt-1 w-full rounded border p-2" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Choose a play</option>
          {[...candidates].reverse().map(event => <option key={footballChallengeEventKey(event)} value={footballChallengeEventKey(event)}>Play #{event.sequence} · Q{event.period} {formatFootballClockDisplay(event.clock, '')} · {event.type}</option>)}
        </select>
      </label>
      {target && <p className="mt-3 rounded bg-zinc-100 p-3 text-sm">{target.description}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button className="rounded border px-4 py-2 font-bold" onClick={onClose}>Review later</button>
        <button className="rounded bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={!target} onClick={() => onConfirm(target)}>Rescore Play #{target?.sequence || '—'}</button>
      </div>
    </section>
  </div>;
}
