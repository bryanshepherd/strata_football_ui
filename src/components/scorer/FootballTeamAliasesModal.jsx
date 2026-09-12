import React, { useEffect, useRef, useState } from 'react';
import { TeamAliasesScreen } from '../pregame/FootballCoinTossModal';
import { footballTeamAliasesForEnvelope, normalizeFootballTeamAlias, validateFootballTeamAliases } from '../../utils/footballTeamAliases';

export default function FootballTeamAliasesModal({ envelope, onClose, onSave }) {
  const [aliases, setAliases] = useState(() => footballTeamAliasesForEnvelope(envelope));
  const [error, setError] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
    const onKeyDown = (event) => {
      // This dialog owns scoring hotkeys while the operator edits abbreviations.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const save = (event) => {
    event.preventDefault();
    const validation = validateFootballTeamAliases(aliases);
    if (!validation.ok) { setError(validation.message); return; }
    try {
      onSave(aliases);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Abbreviations could not be saved.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
      <form aria-label="Team Abbreviations" aria-modal="true" className="max-h-[90vh] w-full max-w-xl overflow-auto rounded border border-zinc-300 bg-white p-5 shadow-xl" onSubmit={save} ref={formRef} role="dialog">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">Game Control</p>
        <TeamAliasesScreen aliases={aliases} onChange={(team, value) => setAliases((current) => ({ ...current, [team]: normalizeFootballTeamAlias(value) }))} teams={envelope.game.teams} />
        <p className="mt-4 text-sm text-zinc-600">These abbreviations are saved with this game and used for team selection and ball spots.</p>
        {error && <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold" onClick={onClose} type="button">Cancel</button>
          <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" type="submit">Save Abbreviations</button>
        </div>
      </form>
    </div>
  );
}
