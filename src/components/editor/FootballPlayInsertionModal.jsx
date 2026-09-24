import React, { useEffect, useRef, useState } from 'react';

const contextLabel = (context, teams) => `${teams[context?.possession]?.abbr || context?.possession || 'No possession'} · ${context?.down || '—'} & ${context?.goalToGo ? 'goal' : context?.distance ?? '—'} · ${context?.yardLine || '—'}`;

export default function FootballPlayInsertionModal({ session, teams, error, onStart, onSave, onCancel, onReenter }) {
  const [clock, setClock] = useState(session.clock);
  const dialog = useRef(null);
  const preview = session.preview;
  useEffect(() => { dialog.current?.querySelector('input,button')?.focus(); }, [preview]);
  const keys = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),input')];
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onKeyDown={keys}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={preview ? 'Preview play insertion' : 'Insert play before'} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-300 bg-white p-5 shadow-2xl">
      <h2 className="text-xl font-bold">{preview ? 'Preview play insertion' : `Insert before play #${session.target.sequence}`}</h2>
      <p className="mt-2 text-sm text-zinc-700">{session.target.description}</p>
      {!preview ? <form onSubmit={event => { event.preventDefault(); onStart(clock); }}>
        <p className="mt-4 text-sm">Starting context: {contextLabel(session.target.preState, teams)}</p>
        <label className="mt-4 block text-sm font-bold">Quarter {session.target.period} · Clock
          <input className="mt-1 block rounded border border-zinc-300 px-3 py-2" aria-label="Insertion clock" value={clock} onChange={event => setClock(event.target.value)} placeholder="MM:SS" />
        </label>
        <p className="mt-3 text-sm text-zinc-600">Enter the missing play normally. You will review its effect before saving.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded border px-4 py-2 font-semibold" onClick={onCancel}>Cancel Insertion</button><button className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white" type="submit">Start Insertion</button></div>
      </form> : <>
        <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm"><strong>New play #{preview.event.sequence} · Q{preview.event.period} {preview.event.clock}</strong><br />{preview.event.description}</p>
        <p className="mt-3 text-sm">The following {preview.shiftedCount === 1 ? 'entry will' : `${preview.shiftedCount} entries will`} be renumbered. Their recorded results stay the same.</p>
        <table className="mt-3 w-full text-left text-sm"><thead><tr><th>Team</th><th>Score before</th><th>Score after</th></tr></thead><tbody>{['V','H'].map(team => <tr key={team}><td>{teams[team].name}</td><td>{preview.scoreBefore[team]}</td><td>{preview.scoreAfter[team]}</td></tr>)}</tbody></table>
        <table aria-label="Insertion statistics preview" className="mt-4 w-full text-left text-sm"><thead><tr><th>Statistic · before → after</th>{['V','H'].map(team => <th key={team}>{teams[team].abbr || teams[team].name}</th>)}</tr></thead><tbody>{[
          ['Plays', stats => stats.plays || 0], ['Rushing attempts', stats => stats.rushAttempts || 0], ['Rushing yards', stats => stats.rushYards || 0], ['Pass attempts', stats => stats.pass?.att || 0], ['Passing yards', stats => stats.pass?.yds || 0],
          ['First downs', stats => stats.firstDowns || 0], ['Fumbles (lost)', stats => `${stats.fumbles?.num || 0} (${stats.fumbles?.lost || 0})`], ['Penalties', stats => `${stats.penalties?.num || 0}–${stats.penalties?.yds || 0}`],
        ].map(([label, value]) => <tr key={label}><td>{label}</td>{['V','H'].map(team => <td key={team}>{value(preview.statsBefore[team] || {})} → {value(preview.statsAfter[team] || {})}</td>)}</tr>)}</tbody></table>
        {preview.affected.length ? <div className="mt-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm"><p className="font-bold">Following context needs review</p>{preview.affected.map(review => <div className="mt-2" key={review.eventId || review.sequence}><strong>Play #{review.originalSequence} → #{review.sequence}</strong><p>Recorded: {contextLabel(review.recorded, teams)}</p><p>After insertion: {contextLabel(review.expected, teams)}</p></div>)}<p className="mt-2">After saving, open the flagged play and use Recalculate this play or Replace This Play to confirm the correction. Statistics will reflect the saved starting contexts until you review them.</p></div> : <p className="mt-4 text-sm text-emerald-800">The following recorded context remains consistent.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button className="rounded border px-4 py-2 font-semibold" onClick={onCancel}>Cancel Insertion</button><button className="rounded border px-4 py-2 font-semibold" onClick={onReenter}>Re-enter Play</button><button className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white" onClick={onSave}>Save Inserted Play</button></div>
      </>}
    </section>
  </div>;
}
