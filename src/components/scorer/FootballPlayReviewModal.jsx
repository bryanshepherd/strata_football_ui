import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildFootballPlayReview, footballReviewMatches, isEditableFootballReviewEvent } from '../../utils/footballPlayReview';

export default function FootballPlayReviewModal({ envelope, hidden = false, onClose, onEdit, onInsertBefore, feedback }) {
  const [view, setView] = useState('all');
  const [team, setTeam] = useState('V');
  const [playerId, setPlayerId] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [playQuery, setPlayQuery] = useState('');
  const dialogRef = useRef(null);
  const listRef = useRef(null);
  const scrollRef = useRef(0);
  const focusRef = useRef(null);
  const openerRef = useRef(document.activeElement);
  useLayoutEffect(() => () => { if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true }); }, []);
  const model = useMemo(() => buildFootballPlayReview(envelope), [envelope]);
  const selected = model.players.find(player => player.playerId === playerId);
  const players = model.players.filter(player => player.team === team
    && footballReviewMatches(`${player.name} ${player.jersey} ${player.position}`, playerQuery));
  const exactSequence = playQuery.trim().match(/^#(\d+)$/)?.[1];
  const rows = model.rows.filter(row => (view === 'all' || (playerId && row.involvement.has(playerId)))
    && (exactSequence ? Number(row.event.sequence) === Number(exactSequence) : footballReviewMatches(row.searchText, playQuery)));
  const resetScroll = () => { scrollRef.current = 0; if (listRef.current) listRef.current.scrollTop = 0; };
  const selectPlayer = id => { setPlayerId(id); resetScroll(); };

  useLayoutEffect(() => {
    if (hidden) return;
    if (listRef.current) listRef.current.scrollTop = scrollRef.current;
    const target = focusRef.current?.isConnected ? focusRef.current : dialogRef.current?.querySelector('button');
    target?.focus({ preventScroll: true });
  }, [hidden]);

  const edit = (event, button) => {
    scrollRef.current = listRef.current?.scrollTop || 0;
    focusRef.current = button;
    onEdit(event);
  };
  const handleKeyDown = event => {
    // This window owns the keyboard; scorer hotkeys must not start a play.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-2 sm:p-5" style={hidden ? { display: 'none' } : undefined}>
      <section aria-label="Review Plays" aria-modal="true" className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div><h2 className="text-xl font-semibold">Review Plays</h2><p className="mt-1 text-sm text-zinc-600">{envelope.game.teams.V.name} at {envelope.game.teams.H.name} · Entire game</p></div>
          <button className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-100" onClick={onClose} type="button">Close</button>
        </header>
        <div aria-label="Review view" className="flex shrink-0 gap-2 border-b border-zinc-200 px-5 py-3">
          {[['all', 'All Plays'], ['player', 'By Player']].map(([value, label]) => <button aria-pressed={view === value} className={`rounded border px-4 py-2 text-sm font-semibold ${view === value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-zinc-300 hover:bg-zinc-100'}`} key={value} onClick={() => { setView(value); resetScroll(); }} type="button">{label}</button>)}
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {view === 'player' && <aside aria-label="Choose player" className="flex max-h-[32vh] shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 sm:max-h-none sm:w-72 sm:border-b-0 sm:border-r">
            <div className="space-y-3 p-3">
              <label className="block text-xs font-semibold">Team<select className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-sm" onChange={event => { setTeam(event.target.value); setPlayerId(''); setPlayerQuery(''); resetScroll(); }} value={team}>
                <option value="V">Away — {envelope.game.teams.V.name}</option><option value="H">Home — {envelope.game.teams.H.name}</option>
              </select></label>
              <label className="block text-xs font-semibold">Find player<input className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm" onChange={event => setPlayerQuery(event.target.value)} placeholder="Name or number" type="search" value={playerQuery} /></label>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              {players.map(player => <li key={player.playerId}><button aria-pressed={playerId === player.playerId} className={`mb-1 w-full rounded border p-3 text-left text-sm ${playerId === player.playerId ? 'border-emerald-700 bg-emerald-50' : 'border-transparent hover:border-zinc-300 hover:bg-white'}`} onClick={() => selectPlayer(player.playerId)} type="button">
                <span className="block font-semibold">{player.jersey ? `#${player.jersey} ` : ''}{player.name}</span><span className="text-xs text-zinc-600">{player.position ? `${player.position} · ` : ''}{player.playCount} {player.playCount === 1 ? 'play' : 'plays'}</span>
              </button></li>)}
              {!players.length && <li className="p-3 text-sm text-zinc-600">No matching players.</li>}
            </ul>
          </aside>}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 space-y-2 border-b border-zinc-200 px-5 py-3">
              <h3 className="font-semibold">{view === 'all' ? 'All Plays' : selected ? `${selected.jersey ? `#${selected.jersey} ` : ''}${selected.name}` : 'Choose a player'}</h3>
              <label className="block text-xs font-semibold">Search plays<input className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm" onChange={event => { setPlayQuery(event.target.value); resetScroll(); }} placeholder="Play number, name, or description" type="search" value={playQuery} /></label>
              <p aria-live="polite" className="text-xs text-zinc-600">{rows.length} {rows.length === 1 ? 'play' : 'plays'}{view === 'player' && selected ? ' involving this player' : ''}</p>
              {feedback?.message && <p className={`text-sm ${feedback.tone === 'error' ? 'text-red-800' : 'text-emerald-800'}`} role="status">{feedback.message.replace(' in the local envelope', '')}</p>}
            </div>
            <div aria-label="Reviewed plays" className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onScroll={() => { if (!hidden) scrollRef.current = listRef.current.scrollTop; }} ref={listRef} tabIndex={0}>
              <ol className="divide-y divide-zinc-200">{rows.map(row => <li aria-label={`Review play ${row.event.sequence}`} className="px-5 py-4" key={row.key}>
                <div className="flex flex-wrap items-center gap-2">
                  {onInsertBefore && row.event.preState && <button aria-label={`Insert before reviewed play ${row.event.sequence}`} className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-semibold hover:border-emerald-700" onClick={event => { scrollRef.current = listRef.current?.scrollTop || 0; focusRef.current = event.currentTarget; onInsertBefore(row.event); }} type="button">Insert Before</button>}{isEditableFootballReviewEvent(row.event) && <button aria-label={`Edit reviewed play ${row.event.sequence}`} className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm font-semibold hover:border-emerald-700 hover:bg-emerald-50" onClick={event => edit(row.event, event.currentTarget)} type="button">Edit</button>}
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">#{row.event.sequence}</span>
                </div>
                <div className="mt-2 text-sm font-semibold capitalize">{row.event.type}{row.event.subtype ? ` · ${row.event.subtype}` : ''}</div>
                <p className="mt-1 break-words text-sm text-zinc-900">{row.description}</p>
                <div className="mt-2 text-xs text-zinc-500">{row.context}</div>
                {view === 'player' && <p className="mt-2 text-xs font-semibold text-emerald-800">{[...(row.involvement.get(playerId) || [])].join(' · ')}</p>}
              </li>)}</ol>
              {!rows.length && <p className="p-5 text-sm text-zinc-600">{view === 'player' && !playerId ? 'Choose a team and click a player to review their plays.' : playQuery ? 'No plays match this search.' : 'No recorded plays to show.'}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
