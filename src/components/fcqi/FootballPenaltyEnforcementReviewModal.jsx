import React, { useEffect, useMemo, useState } from 'react';
import { activeFootballPenaltyOfficialState, resolveFootballDraftPenaltyOutcome } from '../../utils/footballPenaltyOutcome';
import { normalizeFootballSpot } from '../../utils/footballSpotNormalization';

const editableSelector = 'input, textarea, select, [contenteditable="true"]';

export default function FootballPenaltyEnforcementReviewModal({
  draft,
  onCancel,
  onConfirm,
  teamAliases,
}) {
  const [stage, setStage] = useState('order');
  const [order, setOrder] = useState(() => draft?.penalties
    ?.filter((penalty) => penalty.status === 'accepted')
    .map((penalty) => penalty.penaltyId) || []);
  const orderedDraft = useMemo(
    () => (draft ? resolveFootballDraftPenaltyOutcome(draft, { enforcementOrder: order }) : null),
    [draft, order],
  );
  const calculated = activeFootballPenaltyOfficialState(orderedDraft?.result);
  const [down, setDown] = useState(() => calculated?.down ?? 1);
  const [distance, setDistance] = useState(() => calculated?.distance ?? 10);
  const [yardLine, setYardLine] = useState(() => calculated?.yardLine ?? '');
  const [firstDownAwarded, setFirstDownAwarded] = useState(() => calculated?.firstDownAwarded === true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (stage !== 'order' || !calculated) return;
    setDown(calculated.down);
    setDistance(calculated.distance);
    setYardLine(calculated.yardLine);
    setFirstDownAwarded(calculated.firstDownAwarded === true);
  }, [calculated, stage]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (stage === 'verify' && !event.target?.closest?.(editableSelector) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFirstDownAwarded((value) => !value);
      }
      if (stage === 'order' && event.key === 'Enter' && !event.target?.closest?.('button')) {
        event.preventDefault();
        setStage('verify');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage]);

  if (!draft || !calculated) return null;

  const penaltiesById = new Map(draft.penalties.map((penalty) => [penalty.penaltyId, penalty]));
  const orderedPenalties = order.map((id) => penaltiesById.get(id)).filter(Boolean);
  const acceptedCount = draft.penalties.filter((penalty) => penalty.status === 'accepted').length;
  const maxDown = Number(draft.game?.rules?.downs) || 4;

  const movePenalty = (index, offset) => {
    const destination = index + offset;
    if (destination < 0 || destination >= order.length) return;
    const next = [...order];
    [next[index], next[destination]] = [next[destination], next[index]];
    setOrder(next);
  };

  const submit = (event) => {
    event.preventDefault();
    const normalizedSpot = normalizeFootballSpot(yardLine, { teamAliases });
    const parsedDown = Number(down);
    const parsedDistance = Number(distance);
    if (!Number.isInteger(parsedDown) || parsedDown < 1 || parsedDown > maxDown) {
      setError(`Down must be between 1 and ${maxDown}.`);
      return;
    }
    if (!Number.isInteger(parsedDistance) || parsedDistance < 0 || parsedDistance > 99) {
      setError('Distance must be a whole number between 0 and 99.');
      return;
    }
    if (!normalizedSpot || normalizedSpot === 'goal') {
      setError('Ball spot must use H35, V20, or 50 format.');
      return;
    }
    onConfirm({
      enforcementOrder: order,
      down: parsedDown,
      distance: parsedDistance,
      yardLine: normalizedSpot,
      firstDownAwarded,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4" role="presentation">
      <section
        aria-label="Penalty enforcement review"
        aria-modal="true"
        className="w-full max-w-2xl rounded border border-amber-400 bg-white shadow-xl"
        role="dialog"
      >
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">
            {acceptedCount} accepted fouls
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">
            {stage === 'order' ? 'Set Enforcement Order' : 'Verify Official Result'}
          </h2>
        </div>

        {stage === 'order' ? (
          <div className="space-y-4 p-5">
            <p className="text-sm text-zinc-700">
              Fouls are enforced in the order entered. Move any foul that should be enforced earlier or later.
            </p>
            <ol className="space-y-2">
              {orderedPenalties.map((penalty, index) => (
                <li className="flex items-center gap-3 rounded border border-zinc-200 bg-zinc-50 p-3" key={penalty.penaltyId}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-950">{penalty.name || penalty.code || 'Penalty'}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      {penalty.team} · {penalty.deadBall ? 'Dead ball' : 'Live ball'} · {penalty.status}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label={`Move ${penalty.name || 'penalty'} earlier`}
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-35"
                      disabled={index === 0}
                      onClick={() => movePenalty(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${penalty.name || 'penalty'} later`}
                      className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-35"
                      disabled={index === orderedPenalties.length - 1}
                      onClick={() => movePenalty(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold" onClick={onCancel} type="button">
                Back
              </button>
              <button className="rounded border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setStage('verify')} type="button">
                Continue
              </button>
            </div>
          </div>
        ) : (
          <form className="space-y-4 p-5" onSubmit={submit}>
            <p className="text-sm text-zinc-700">
              Verify the official state after every foul is enforced. Press Enter once to submit all three fields.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold text-zinc-800">
                Down
                <input autoFocus className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-base" inputMode="numeric" max={maxDown} min="1" onChange={(event) => setDown(event.target.value)} required type="number" value={down} />
              </label>
              <label className="text-sm font-semibold text-zinc-800">
                Distance
                <input className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-base" inputMode="numeric" max="99" min="0" onChange={(event) => setDistance(event.target.value)} required type="number" value={distance} />
              </label>
              <label className="text-sm font-semibold text-zinc-800">
                Ball Spot
                <input className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-base uppercase" onChange={(event) => setYardLine(event.target.value.toUpperCase())} required value={yardLine} />
              </label>
            </div>
            <button
              aria-pressed={firstDownAwarded}
              className={`flex w-full items-center justify-between rounded border px-4 py-3 text-left text-sm font-bold ${firstDownAwarded ? 'border-emerald-700 bg-emerald-50 text-emerald-950' : 'border-zinc-300 bg-zinc-50 text-zinc-800'}`}
              onClick={() => setFirstDownAwarded((value) => !value)}
              type="button"
            >
              <span>First Down Awarded</span>
              <span className="flex items-center gap-2">
                <span>{firstDownAwarded ? 'On' : 'Off'}</span>
                <span className="grid h-7 min-w-7 place-items-center rounded border border-current bg-white px-2 text-xs">F</span>
              </span>
            </button>
            {error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
              <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold" onClick={() => { setError(''); setStage('order'); }} type="button">
                Enforcement Order
              </button>
              <button className="rounded border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Submit Play
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
