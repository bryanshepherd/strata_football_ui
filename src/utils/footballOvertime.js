import { createLiveState, oppositeTeam, parseSpot } from './footballRulesEngine';

export const footballOvertimeEnabled = (envelope) => envelope?.game?.rules?.overtimeEnabled === true
  && envelope?.game?.rules?.overtimeStyle !== 'timedPeriod';
export const footballOvertimeIsNcaa = (rules) => String(rules?.rulesPresetId || rules?.ruleset || rules?.penaltyRuleset || '').toLowerCase() === 'ncaa';
export const footballOvertimeRound = (envelope) => Math.max(1, Number(envelope?.game?.period || envelope?.clock?.period || 4) - Number(envelope?.game?.rules?.periods || 4));
export const footballOvertimeNeedsTwo = (rules, period) => footballOvertimeIsNcaa(rules) && Number(period) >= Number(rules?.periods || 4) + 2;
const tied = (envelope) => Number(envelope.game.teams.H.score || 0) === Number(envelope.game.teams.V.score || 0);
const regulation = (envelope) => Number(envelope.game.rules?.periods || 4);
const append = (envelope, event) => ({ ...envelope, updatedAt: event.acceptedAt, events: [...(envelope.events || []), event], stats: { ...envelope.stats, sourceEventSequence: event.sequence } });
const closeDrive = (envelope, reason, period) => {
  const current = envelope.drives?.current;
  return { ...envelope.drives, current: null, completed: [...(envelope.drives?.completed || []), ...(current ? [{ ...current, result: current.result || reason, endPeriod: period, endClock: '00:00' }] : [])] };
};
const inactive = (envelope, overtime, next = 'overtimeReady') => ({
  ...envelope.liveState, possession: null, down: null, distance: null, yardLine: null, lineToGain: null,
  goalToGo: false, redZone: false, driveId: null, pendingTryTeam: null, kickoffTeam: null, nextPlayContext: next, overtime,
});
export function footballOvertimePending(envelope) {
  const ot = envelope?.liveState?.overtime;
  if (ot && ['awaitingRound', 'awaitingSeries'].includes(ot.phase)) return ot;
  // Recover the former Q4-final bug when an operator refreshes a tied game.
  if (!ot && footballOvertimeEnabled(envelope) && envelope.game.status === 'final' && tied(envelope)
    && Number(envelope.game.period) >= regulation(envelope)) return { round: footballOvertimeRound(envelope), series: 1, phase: 'awaitingRound' };
  return null;
}
export function footballOvertimeDefaultSpot(envelope, team, round) {
  const yards = footballOvertimeIsNcaa(envelope.game.rules) ? (round >= 3 ? 3 : 25) : 10;
  return `${oppositeTeam(team)}${String(yards).padStart(2, '0')}`;
}
function pendingRound(envelope, event, round) {
  const period = regulation(envelope) + round;
  const next = append(envelope, event);
  return {
    ...next, game: { ...next.game, status: 'inProgress', period, periodType: 'overtime' },
    clock: { ...next.clock, period, clock: '00:00', clockTenths: 0, isRunning: false },
    pregame: { ...next.pregame, gamePhase: 'live' }, drives: closeDrive(next, 'endOfRegulation', event.period),
    liveState: inactive(next, { ...next.liveState?.overtime, round, series: 1, phase: 'awaitingRound' }),
  };
}
export function applyFootballOvertimeControl(envelope, event) {
  const control = event.result?.gameControl;
  if (!control || !footballOvertimeEnabled(envelope)) return null;
  const ot = envelope.liveState?.overtime;
  if (control.action === 'endQuarter' && Number(control.period || event.period) >= regulation(envelope)) {
    if (ot) {
      if (ot.phase === 'complete') return append(envelope, event);
      throw new Error('Overtime advances when each possession is complete. Finish the current possession or try.');
    }
    if (envelope.liveState?.pendingTryTeam) throw new Error('Complete the pending try before ending regulation.');
    if (tied(envelope)) return pendingRound(envelope, event, 1);
  }
  if (control.action === 'startQuarter' && Number(control.period) > regulation(envelope)) {
    if (ot) throw new Error('Use the overtime possession confirmation to continue overtime.');
    if (!tied(envelope)) throw new Error('Overtime requires a tied game at the end of regulation.');
    return pendingRound(envelope, event, 1);
  }
  if (control.action !== 'startDrive' || !control.overtime) return null;
  const pending = footballOvertimePending(envelope);
  if (!pending) throw new Error('An overtime possession is not awaiting confirmation.');
  const team = control.possession;
  if (!['H', 'V'].includes(team)) throw new Error('Choose the team on offense.');
  if (pending.phase === 'awaitingSeries' && team !== pending.nextTeam) throw new Error('The other team must receive its overtime possession.');
  const spot = parseSpot(control.spot);
  if (!spot.valid || spot.goal || spot.yard === 0) throw new Error('Confirm a ball spot between the goal lines.');
  const round = pending.round;
  const period = regulation(envelope) + round;
  const twoPointRound = footballOvertimeIsNcaa(envelope.game.rules) && round >= 3;
  const driveNumber = Math.max(Number(envelope.liveState.driveNumber || 0), ...(envelope.drives?.completed || []).map(d => Number(d.driveNumber || 0))) + 1;
  const driveId = `DRV-${String(driveNumber).padStart(4, '0')}`;
  const state = createLiveState({ possession: team, down: 1, yardLine: spot.raw, driveId, driveNumber });
  let timeouts = envelope.liveState.timeouts;
  if (pending.series === 1 && (!footballOvertimeIsNcaa(envelope.game.rules) || round <= 3)) timeouts = { H: 1, V: 1 };
  const overtime = { ...pending, phase: 'active', possessionTeam: team, firstTeam: pending.series === 1 ? team : pending.firstTeam, nextTeam: null };
  const initialized = append(envelope, { ...event, period, clock: '00:00' });
  return {
    ...initialized, game: { ...envelope.game, status: 'inProgress', period, periodType: 'overtime' },
    pregame: { ...envelope.pregame, gamePhase: 'live' },
    clock: { ...envelope.clock, period, clock: '00:00', clockTenths: 0, isRunning: false },
    liveState: { ...state, timeouts, overtime, ...(twoPointRound ? { down: null, distance: null, lineToGain: null, pendingTryTeam: team, nextPlayContext: 'awaitingTry' } : {}) },
    drives: { ...envelope.drives, current: twoPointRound ? null : { driveId, driveNumber, team, startYardLine: spot.raw, startReason: 'overtime', startPeriod: period, startClock: '00:00', plays: 0, yards: 0, result: null } },
  };
}
export function validateFootballOvertimeEvent(envelope, event) {
  const ot = envelope.liveState?.overtime;
  if (!ot || event.type === 'gameControl') return;
  if (ot.phase !== 'active') throw new Error('Confirm the next overtime possession first.');
  if (event.type === 'kickoff') throw new Error('There are no kickoffs during possession overtime.');
  if (event.type === 'try' && footballOvertimeNeedsTwo(envelope.game.rules, envelope.game.period)
    && (event.subtype === 'kick' || event.result?.scoring?.type === 'patKick')) throw new Error('A two-point rush or pass is required in this overtime round.');
  if (envelope.liveState.pendingTryTeam && !['try', 'penalty'].includes(event.type)) throw new Error('Enter the two-point play using Kick, PAT, then Rush or Pass.');
}
function finishGame(envelope, ot) {
  return { ...envelope, game: { ...envelope.game, status: 'final' }, pregame: { ...envelope.pregame, gamePhase: 'final' },
    liveState: inactive(envelope, { ...ot, phase: 'complete' }, null), drives: closeDrive(envelope, 'endOfGame', envelope.game.period) };
}
export function applyFootballOvertimeOutcome(before, after, event, projection) {
  const ot = before.liveState?.overtime;
  if (!ot || ot.phase !== 'active' || event.type === 'gameControl') return after;
  const scoring = projection?.scoringUpdate;
  const replay = (event.penalties || []).some(p => p.status === 'accepted' && (p.replayDown || p.downConsequence === 'REPEAT'))
    || ((event.penalties || []).some(p => p.status === 'offsetting') && event.result?.code === 'noPlay');
  const next = { ...after, clock: { ...after.clock, clock: '00:00', clockTenths: 0, isRunning: false }, liveState: { ...after.liveState, overtime: ot } };
  if (replay && !scoring && !projection?.driveTransition?.shouldEndCurrent) {
    if (event.type === 'try') next.liveState = { ...next.liveState, possession: ot.possessionTeam, pendingTryTeam: ot.possessionTeam, kickoffTeam: null, nextPlayContext: 'awaitingTry' };
    return next;
  }
  if (scoring?.points > 0 && scoring.team !== ot.possessionTeam && event.type !== 'try') return finishGame(next, ot);
  if (scoring?.type === 'touchdown') {
    if (ot.series === 2 && Number(next.game.teams[ot.possessionTeam].score) > Number(next.game.teams[oppositeTeam(ot.possessionTeam)].score)) return finishGame(next, ot);
    return next;
  }
  const changedPossession = event.result?.turnover || event.result?.fumble?.turnover || (event.result?.return && event.result.return.team !== ot.possessionTeam);
  const complete = event.type === 'try' || projection?.driveTransition?.shouldEndCurrent || changedPossession;
  if (!complete) return next;
  const ended = { ...next, liveState: { ...next.liveState, driveNumber: before.liveState.driveNumber }, drives: { ...next.drives, current: null } };
  if (ot.series === 1) return { ...ended, liveState: inactive(ended, { ...ot, series: 2, phase: 'awaitingSeries', nextTeam: oppositeTeam(ot.firstTeam) }) };
  if (!tied(ended)) return finishGame(ended, ot);
  const round = ot.round + 1;
  const period = regulation(ended) + round;
  return { ...ended, game: { ...ended.game, period, periodType: 'overtime' }, clock: { ...ended.clock, period }, liveState: inactive(ended, { ...ot, round, series: 1, phase: 'awaitingRound', nextTeam: null }) };
}
