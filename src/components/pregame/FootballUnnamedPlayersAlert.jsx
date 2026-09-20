import React, { useState } from 'react';
import { footballUnnamedPlayers } from '../../utils/footballUnnamedPlayers';

export default function FootballUnnamedPlayersAlert({ envelope, onSaveName, onEditingChange, visible }) {
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const players = footballUnnamedPlayers(envelope);
  const label = player => `${envelope.game?.teams?.[player.team]?.abbr || player.team} #${player.jersey}`;
  const close = () => { setSelected(null); setError(''); onEditingChange(false); };
  const save = async event => {
    event.preventDefault();
    if (!name.trim()) { setError('Enter a player name.'); return; }
    if (saving) return;
    setSaving(true); setError('');
    try { await onSaveName(selected.team, selected.playerId, name.trim()); close(); }
    catch (failure) { setError(failure.message || 'Player name could not be saved.'); }
    finally { setSaving(false); }
  };
  if (!visible && !selected || !players.length && !selected) return null;
  return <>
    <section className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950" role="status" aria-label="Players missing names">
      <p className="font-semibold">Players missing names</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {players.map(player => <button className="rounded border border-amber-500 bg-white px-3 py-2 font-semibold hover:bg-amber-100" key={`${player.team}-${player.playerId}`} type="button" onClick={() => { setSelected(player); setName(''); setError(''); onEditingChange(true); }}>{label(player)}</button>)}
      </div>
    </section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Name ${label(selected)}`} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !saving) close(); }}>
      <form className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onSubmit={save}>
        <h2 className="text-lg font-bold">{label(selected)}</h2>
        <label className="mt-3 block text-sm font-semibold" htmlFor="unnamed-player-name">Player name</label>
        <input autoFocus className="mt-1 w-full rounded border border-zinc-300 px-3 py-2" id="unnamed-player-name" value={name} onChange={event => setName(event.target.value)} disabled={saving} autoComplete="off" />
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-2" type="button" disabled={saving} onClick={close}>Cancel</button>
          <button className="rounded bg-emerald-700 px-3 py-2 font-semibold text-white" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button>
        </div>
      </form>
    </div>}
  </>;
}
