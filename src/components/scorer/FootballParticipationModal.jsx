import React, { useEffect, useMemo, useRef, useState } from 'react';
import { footballParticipationForEnvelope } from '../../utils/footballParticipation';

export default function FootballParticipationModal({ envelope, onClose, onSave }) {
  const participation = useMemo(() => footballParticipationForEnvelope(envelope), [envelope]);
  const [selected, setSelected] = useState(() => Object.fromEntries(['H', 'V'].map((team) => [team,
    new Set(envelope.participation?.manualPlayed?.[team] || []),
  ])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    formRef.current?.querySelector('input:not(:disabled), button')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!saving) onClose();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, saving]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(Object.fromEntries(['H', 'V'].map((team) => [team, [...selected[team]]])));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Participation could not be saved.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/55 p-4" role="presentation">
      <form aria-label="Participation" aria-modal="true" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl" onSubmit={save} ref={formRef} role="dialog">
        <header className="border-b border-zinc-200 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Game Control</p>
          <h2 className="text-xl font-semibold text-zinc-950">Participation</h2>
          <p className="mt-1 text-sm text-zinc-600">Check players who played. Starters and players with stats or a play or penalty role are checked automatically and cannot be unchecked.</p>
        </header>
        <div className="grid gap-5 overflow-y-auto p-5 md:grid-cols-2">
          {['V', 'H'].map((team) => {
            const players = Object.values(participation[team]).filter((player) => player.active).sort((a, b) => {
              const roster = envelope.rosters.teams[team].players;
              return String(roster[a.playerId].jersey ?? '').localeCompare(String(roster[b.playerId].jersey ?? ''), undefined, { numeric: true })
                || String(roster[a.playerId].displayName || '').localeCompare(String(roster[b.playerId].displayName || ''));
            });
            const teamName = envelope.game?.teams?.[team]?.name || (team === 'H' ? 'Home' : 'Away');
            const played = players.filter((player) => player.locked || selected[team].has(player.playerId)).length;
            return (
              <section aria-label={`${teamName} participation`} key={team}>
                <h3 className="font-semibold text-zinc-950">{teamName}</h3>
                <p className="mb-3 text-xs text-zinc-600">{played} of {players.length} active players marked played</p>
                {players.length === 0 && <p className="text-sm text-zinc-500">No active players.</p>}
                {players.map((player) => {
                  const roster = envelope.rosters.teams[team].players[player.playerId];
                  const name = roster.displayName || [roster.firstName, roster.lastName].filter(Boolean).join(' ') || 'Unnamed player';
                  return (
                    <label className="flex items-center gap-3 border-b border-zinc-100 py-2" key={player.playerId}>
                      <input aria-label={`${teamName} #${roster.jersey || '—'} ${name} played`} checked={player.locked || selected[team].has(player.playerId)} disabled={player.locked || saving} onChange={(event) => {
                        const checked = event.target.checked;
                        setSelected((current) => {
                          const next = new Set(current[team]);
                          if (checked) next.add(player.playerId); else next.delete(player.playerId);
                          return { ...current, [team]: next };
                        });
                      }} type="checkbox" />
                      <span className="w-9 shrink-0 text-right font-semibold tabular-nums">{roster.jersey || '—'}</span>
                      <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{name}</span>{roster.position && <span className="ml-2 text-xs text-zinc-500">{roster.position}</span>}<span className="block text-xs text-zinc-500">{player.locked ? player.reasons.join(' · ') : 'Manual participation'}</span></span>
                    </label>
                  );
                })}
              </section>
            );
          })}
        </div>
        <footer className="border-t border-zinc-200 px-5 py-4">
          {error && <p className="mb-3 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold" disabled={saving} onClick={onClose} type="button">Cancel</button>
            <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Participation'}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
