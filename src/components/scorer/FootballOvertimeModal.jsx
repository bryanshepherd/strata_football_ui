import React, { useState } from 'react';
import { footballOvertimeDefaultSpot, footballOvertimeIsNcaa } from '../../utils/footballOvertime';

export default function FootballOvertimeModal({ envelope, pending, onConfirm }) {
  const [team, setTeam] = useState(pending.nextTeam || 'H');
  const initial = footballOvertimeDefaultSpot(envelope, pending.nextTeam || 'H', pending.round);
  const [side, setSide] = useState(initial[0]);
  const [yard, setYard] = useState(Number(initial.slice(1)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const twoPoint = footballOvertimeIsNcaa(envelope.game.rules) && pending.round >= 3;
  const choose = (value) => {
    setTeam(value);
    const spot = footballOvertimeDefaultSpot(envelope, value, pending.round);
    setSide(spot[0]); setYard(Number(spot.slice(1)));
  };
  const valid = Number.isInteger(Number(yard)) && Number(yard) >= 1 && Number(yard) <= 50;
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true); setError('');
    try { await onConfirm({ team, spot: Number(yard) === 50 ? '50' : `${side}${String(yard).padStart(2, '0')}` }); }
    catch (err) { setError(err.message || 'Could not start overtime.'); setBusy(false); }
  };
  const label = side === team || Number(yard) > 10 ? '1st and 10' : `1st and goal`;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="ot-title" className="w-full max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
      <h2 id="ot-title" className="text-2xl font-bold">Overtime {pending.round} · Possession {pending.series} of 2</h2>
      <p className="mt-3">{pending.series === 1 ? 'Following the officials’ choice, who will be on offense first?' : 'Confirm the next team’s possession.'}</p>
      <div className="my-4 grid grid-cols-2 gap-3">{['H', 'V'].map(code => <button key={code} type="button" aria-pressed={team === code} disabled={busy || (pending.series === 2 && code !== pending.nextTeam)} onClick={() => choose(code)} className={`rounded-xl border-2 p-3 font-semibold disabled:opacity-40 ${team === code ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>{envelope.game.teams[code].name}</button>)}</div>
      <p className="mb-3">{twoPoint ? 'Two-point tries only. Each team gets one attempt.' : 'Each team gets a possession. There are no kickoffs.'}</p>
      <div className="flex gap-3">
        <label className="flex-1">Ball on<select aria-label="Yardline team" value={side} onChange={e => setSide(e.target.value)} disabled={busy} className="mt-1 block w-full rounded border p-2">{['H','V'].map(code => <option key={code} value={code}>{envelope.game.teams[code].abbr || envelope.game.teams[code].name}</option>)}</select></label>
        <label>Yard line<input autoFocus aria-label="Overtime yard line" type="number" min="1" max="50" value={yard} onChange={e => setYard(e.target.value)} disabled={busy} className="mt-1 block w-24 rounded border p-2" /></label>
      </div>
      <p className="my-4 font-semibold">Please confirm: {envelope.game.teams[team].abbr || envelope.game.teams[team].name} ball, {twoPoint ? 'two-point try' : label} on {Number(yard) === 50 ? 'the 50' : `${envelope.game.teams[side].abbr || side} ${yard}`}.</p>
      <p className="mb-4 text-sm">Change the spot above if the officials enforced a penalty before this possession.</p>
      {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
      <button disabled={busy || !valid} className="w-full rounded-xl bg-blue-700 p-3 font-semibold text-white disabled:opacity-40">{busy ? 'Starting…' : 'Confirm and start possession'}</button>
    </form>
  </div>;
}
