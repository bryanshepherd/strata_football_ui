import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { normalizeFootballClock, formatFootballClockDisplay } from '../utils/footballClock';
import { footballOvertimeEnabled, footballOvertimeIsNcaa } from '../utils/footballOvertime';
import { isFootballTimeout, footballTimeoutValues } from '../utils/footballTimeout';
import { footballContextEventKey, reviewFootballPlayContexts } from './footballPlayContext';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const accepted = event => !event.status || event.status === 'accepted';
const timeoutLimit = rules => {
  const value = Number(rules.timeouts ?? rules.timeoutsPerHalf ?? rules.timeoutsPerGame ?? rules.timeoutFull ?? rules.timeout_full);
  return Number.isFinite(value) && value >= 0 ? value : 3;
};
// Match the scorer's halftime and overtime timeout resets. NCAA carries the
// third overtime allotment through later two-point rounds.
const timeoutBucket = (envelope, period) => {
  const regulation = Number(envelope.game.rules?.periods || 4);
  if (period > regulation && footballOvertimeEnabled(envelope)) {
    const round = period - regulation;
    return `ot-${footballOvertimeIsNcaa(envelope.game.rules) ? Math.min(3, round) : round}`;
  }
  return period <= Math.floor(regulation / 2) ? 'firstHalf' : 'secondHalf';
};
const timeoutCharges = (envelope, events, bucket) => {
  const counts = { H: 0, V: 0 };
  for (const event of events) {
    if (!accepted(event) || timeoutBucket(envelope, Number(event.period)) !== bucket) continue;
    const control = event.result?.gameControl;
    const team = control?.teamSide || control?.possession;
    const failedChallenge = control?.action === 'challenge'
      && envelope.game.rules?.challenge?.failedChallengeDecreasesTimeout
      && ['unsuccessful', 'callStands', 'callConfirmed'].includes(control.challengeStatus);
    if (['H', 'V'].includes(team) && (isFootballTimeout(event) || failedChallenge)) counts[team] += 1;
  }
  return counts;
};

export function updateFootballTimeout(envelope, target, values, {
  recalculateContext = false, editedAt = new Date().toISOString(),
} = {}) {
  const events = envelope?.events || [];
  const index = events.findIndex(event => footballContextEventKey(event) === footballContextEventKey(target));
  if (index < 0) throw new Error('The selected timeout is no longer in the game log.');
  const original = events[index];
  if (!isFootballTimeout(original) || !accepted(original)) throw new Error('Only a recorded timeout can be changed here.');
  if (JSON.stringify(original) !== JSON.stringify(target)) throw new Error('This timeout changed while the editor was open. Close and reopen it.');
  if (events.some((event, i) => !accepted(event) || Number(event.sequence) !== i + 1)) throw new Error('A complete sequential event log is required to edit this timeout.');
  const clock = normalizeFootballClock(values.clock);
  if (!clock) throw new Error('Enter a valid timeout clock, such as 5:59.');
  if (!['H', 'V'].includes(values.teamSide)) throw new Error('Choose the team that called the timeout.');
  const seconds = value => { const [m, s] = String(value).split(':').map(Number); return m * 60 + s; };
  if (seconds(clock) > Number(envelope.game.rules?.minutesPerPeriod || envelope.game.rules?.minutes || 15) * 60) throw new Error('The timeout clock exceeds the period length.');
  if (clock !== normalizeFootballClock(original.clock)) {
    const previous = events.slice(0, index).reverse().find(event => Number(event.period) === Number(original.period));
    const next = events.slice(index + 1).find(event => Number(event.period) === Number(original.period));
    if ((previous && seconds(clock) > seconds(previous.clock)) || (next && seconds(clock) < seconds(next.clock))) throw new Error('The timeout clock must stay between the preceding and following records.');
  }
  const event = clone(original);
  const priorValues = footballTimeoutValues(original);
  event.clock = clock;
  const [minutes, clockSeconds] = clock.split(':').map(Number);
  event.result = { ...event.result, clock, clockTenths: (minutes * 60 + clockSeconds) * 10, isRunning: false,
    gameControl: { ...event.result.gameControl, clock, teamSide: values.teamSide, possession: values.teamSide,
      teamId: envelope.game.teams[values.teamSide]?.teamId || null },
  };
  if (recalculateContext) {
    const review = reviewFootballPlayContexts(envelope).reviews.get(footballContextEventKey(original));
    if (!review?.expected || review.unavailable) throw new Error(review?.unavailable || 'No preceding ending context is available.');
    event.preState = { ...event.preState, ...clone(review.expected) };
    event.possession = event.preState.possession;
    event.postState = { ...event.postState, ...clone(review.expected) };
  }
  const team = envelope.game.teams[values.teamSide];
  event.description = `(${formatFootballClockDisplay(clock)}) Timeout called by ${team.name || team.abbr || values.teamSide}.`;
  if (event.confirmation) event.confirmation.summaryText = event.description;
  event.source = { ...event.source, timeoutEdit: { editedAt, previousClock: original.clock,
    previousTeamSide: priorValues.teamSide, recalculatedContext: recalculateContext, previousPreState: clone(original.preState) } };
  const amended = clone(envelope);
  amended.updatedAt = editedAt;
  amended.events[index] = event;
  const currentPeriod = Number(envelope.clock?.period || envelope.game.period);
  const currentBucket = timeoutBucket(envelope, currentPeriod);
  if (priorValues.teamSide !== values.teamSide && timeoutBucket(envelope, Number(original.period)) === currentBucket) {
    const limit = currentBucket.startsWith('ot-') ? 1 : timeoutLimit(envelope.game.rules || {});
    const before = timeoutCharges(envelope, events, currentBucket);
    const after = timeoutCharges(envelope, amended.events, currentBucket);
    const counts = { ...envelope.liveState.timeouts };
    for (const side of ['H', 'V']) {
      const oldRemaining = Math.max(0, limit - before[side]);
      const newRemaining = Math.max(0, limit - after[side]);
      counts[side] = Math.max(0, Math.min(limit, Number(counts[side] ?? oldRemaining) + newRemaining - oldRemaining));
    }
    amended.liveState.timeouts = counts;
  }
  if (index === events.length - 1) {
    if (recalculateContext) amended.liveState = { ...amended.liveState, ...reviewFootballPlayContexts(amended).endingContext };
    if (clock !== normalizeFootballClock(original.clock)) amended.clock = { ...amended.clock, clock, clockTenths: event.result.clockTenths, isRunning: false };
  }
  return normalizeFootballScoringSetupEnvelope(amended);
}
