import React, { useMemo, useState } from 'react';
import {
  awaitingKickoffState,
  isConsequentialTossEdit,
  pregameForEnvelope,
  resolveCompleteToss,
  validateCoinToss,
} from '../../pregame/footballPregame';
import FootballCoinTossModal from './FootballCoinTossModal';

export default function FootballPregameWorkspace({
  envelope,
  onEnvelopeChange,
  onTeamAliasesChange,
  teamAliases,
}) {
  const pregame = pregameForEnvelope(envelope);
  const roster = useMemo(() => flattenRoster(envelope), [envelope]);
  const [notice, setNotice] = useState('');
  const [coinTossOpen, setCoinTossOpen] = useState(false);
  const kickoffAccepted = envelope.events?.some((event) => event.type === 'kickoff' && event.status === 'accepted');
  const tossComplete = pregame.coinToss.status === 'complete';

  const update = async (nextPregame, patch = {}) => {
    try {
      await onEnvelopeChange({ ...envelope, ...patch, pregame: nextPregame });
    } catch (error) {
      const message = error instanceof Error
        ? `Not saved: ${error.message}`
        : 'Not saved. Retry the change after restoring the canonical backend connection.';
      setNotice(message);
      throw error;
    }
  };

  const finalizeCoinToss = async (draftToss) => {
    const coinToss = resolveCompleteToss(draftToss);
    const validation = validateCoinToss(coinToss, roster);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    if (kickoffAccepted && isConsequentialTossEdit(pregame.coinToss, coinToss, true)) {
      throw new Error('Kickoff has been accepted. Changes that would alter kickoff context are blocked.');
    }
    const kickoff = awaitingKickoffState(envelope.game.rules, coinToss);
    await update({ ...pregame, gamePhase: 'awaitingKickoff', coinToss }, {
      clock: { ...envelope.clock, ...kickoff.clock },
      game: { ...envelope.game, ...kickoff.game },
      liveState: { ...envelope.liveState, ...kickoff.liveState },
    });
    setNotice('Coin toss complete. Awaiting Kickoff — kickoff and dead-ball penalty input are available.');
  };

  return (
    <section className="rounded border border-emerald-200 bg-white shadow-sm" aria-label="Pregame workspace">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Pregame Workspace</h2>
        </div>
      </div>

      {notice && <div className="mx-4 mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">{notice}</div>}

      <div className="p-4">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded border border-zinc-200 bg-zinc-50 p-4" aria-label="Coin Toss Setup">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-zinc-950">Coin Toss</h3>
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tossComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                {tossComplete ? 'Complete' : 'Incomplete'}
              </span>
            </div>
          </div>
          <button className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => { setNotice(''); setCoinTossOpen(true); }} type="button">
            {tossComplete ? 'Review Coin Toss' : 'Open Coin Toss'}
          </button>
        </section>
      </div>

      <FootballCoinTossModal
        kickoffAccepted={kickoffAccepted}
        onClose={() => setCoinTossOpen(false)}
        onFinalize={finalizeCoinToss}
        onTeamAliasesChange={onTeamAliasesChange}
        open={coinTossOpen}
        pregame={pregame}
        roster={roster}
        teamAliases={teamAliases}
        teams={envelope.game?.teams}
      />
    </section>
  );
}

function flattenRoster(envelope) {
  return Object.values(envelope.rosters?.teams || {}).flatMap((team) => Object.values(team.players || {}));
}
