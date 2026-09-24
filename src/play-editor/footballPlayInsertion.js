import { normalizeFootballScoringSetupEnvelope, projectFootballStatsForEvents, recalculateFootballDriveTotals } from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { buildFootballPlayReplacementEnvelope } from './footballPlayReplacement';
import { footballContextEventKey, reviewFootballPlayContexts } from './footballPlayContext';

const clone = value => JSON.parse(JSON.stringify(value));
const PLAY_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
const seconds = clock => {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(String(clock || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

function targetIndex(envelope, target) {
  const events = envelope?.events;
  if (!Array.isArray(events) || !target) throw new Error('Select the play the missing play should come before.');
  const index = events.findIndex(event => footballContextEventKey(event) === footballContextEventKey(target));
  if (index < 0) throw new Error('The selected play is no longer in the game log.');
  if (JSON.stringify(events[index]) !== JSON.stringify(target)) throw new Error('The selected play changed. Cancel and reopen insertion.');
  if (events.some((event, i) => (event.status && event.status !== 'accepted') || Number(event.sequence) !== i + 1)) {
    throw new Error('This game needs a complete sequential event log before inserting a play.');
  }
  if (!target.preState) throw new Error('This play has no recorded starting context.');
  return index;
}

export function buildFootballPlayInsertionEnvelope(envelope, target, clock = target?.clock) {
  const index = targetIndex(envelope, target);
  const time = seconds(clock);
  const lower = seconds(target.clock);
  const previous = envelope.events[index - 1];
  const upper = Number(previous?.period) === Number(target.period) ? seconds(previous.clock) : null;
  const regulation = Number(target.period) <= Number(envelope.game.rules?.periods || 4);
  const periodLimit = Number(envelope.game.rules?.minutesPerPeriod || 15) * 60;
  if (time != null && ((regulation && time > periodLimit)
    || (!regulation && envelope.game.rules?.overtimeStyle === 'possessionSeries' && time !== 0))) {
    throw new Error('The insertion clock is outside the selected period.');
  }
  if (time == null || lower == null || time < lower || (upper != null && time > upper)) {
    throw new Error('Enter a clock time between the preceding play and the selected play.');
  }
  const input = buildFootballPlayReplacementEnvelope(envelope, target);
  input.clock = { ...input.clock, clock, clockTenths: time * 10 };
  // Historical input must not inherit the final game's scores, drive or stats.
  for (const event of envelope.events.slice(index)) {
    if (!PLAY_TYPES.has(event.type) || !event.preState) continue;
    const scoring = applyFootballEventToEnvelope({ ...envelope, liveState: event.preState }, event).scoringUpdate;
    if (scoring?.team) input.game.teams[scoring.team].score = Number(input.game.teams[scoring.team].score || 0) - Number(scoring.points || 0);
  }
  const drives = [...(envelope.drives?.completed || []), envelope.drives?.current].filter(Boolean);
  const current = clone(drives.find(drive => drive.driveId === input.liveState.driveId) || null);
  if (current) { delete current.endClock; delete current.endPeriod; current.result = null; }
  input.drives = { current, completed: clone(drives.filter(drive => drive.driveId !== current?.driveId && Number(drive.driveNumber) < Number(input.liveState.driveNumber))) };
  input.drives = recalculateFootballDriveTotals(input);
  input.stats = projectFootballStatsForEvents(input);
  return input;
}

/** Pure preview. Persistence remains an explicit operator action in the scorer. */
export function previewFootballPlayInsertion(envelope, target, submittedEvent, { clock = target?.clock, editedAt = new Date().toISOString(), insertionId = globalThis.crypto.randomUUID() } = {}) {
  const index = targetIndex(envelope, target);
  if (!PLAY_TYPES.has(submittedEvent?.type)) throw new Error('Insert a scoring play or penalty, not Game Control.');
  const input = buildFootballPlayInsertionEnvelope(envelope, target, clock);
  const eventId = `INSERT-${insertionId}`;
  const clientEventId = `insert-${insertionId}`;
  if (envelope.events.some(event => event.eventId === eventId || event.clientEventId === clientEventId)) throw new Error('This insertion is already in the game log.');
  const event = { ...clone(submittedEvent), eventId, clientEventId, sequence: index + 1,
    period: target.period, clock, preState: clone(input.liveState), status: 'accepted',
    createdAt: editedAt, acceptedAt: editedAt,
    source: { ...clone(submittedEvent.source || {}), baseEventSequence: index,
      insertion: { insertedAt: editedAt, beforeEventId: target.eventId || null, beforeClientEventId: target.clientEventId || null } },
  };
  delete event.postState;
  const projection = applyFootballEventToEnvelope(input, event, { nextDriveId: `INSERT-DRIVE-${insertionId}` });
  event.postState = clone(projection.liveState);
  const amended = clone(envelope);
  amended.updatedAt = editedAt;
  amended.events.splice(index, 0, event);
  amended.events.forEach((record, i) => {
    record.sequence = i + 1;
    if (i > index && Number.isFinite(record.source?.baseEventSequence) && record.source.baseEventSequence >= index) record.source.baseEventSequence += 1;
  });
  const scoring = projection.scoringUpdate;
  if (scoring?.team) amended.game.teams[scoring.team].score = Number(amended.game.teams[scoring.team].score || 0) + Number(scoring.points || 0);
  amended.drives = recalculateFootballDriveTotals(amended);
  const normalized = normalizeFootballScoringSetupEnvelope(amended);
  const beforeReviews = reviewFootballPlayContexts(envelope).reviews;
  const reviews = reviewFootballPlayContexts(normalized).reviews;
  const affected = normalized.events.slice(index + 1).flatMap(record => {
    const key = footballContextEventKey(record), review = reviews.get(key), before = beforeReviews.get(key);
    return review?.fields.length && JSON.stringify(review.expected) !== JSON.stringify(before?.expected)
      ? [{ eventId: record.eventId, sequence: record.sequence, originalSequence: record.sequence - 1, ...review }] : [];
  });
  return { envelope: normalized, event: normalized.events[index], affected,
    insertedBefore: { eventId: target.eventId, originalSequence: target.sequence, sequence: target.sequence + 1 },
    shiftedCount: envelope.events.length - index,
    scoreBefore: { H: envelope.game.teams.H.score, V: envelope.game.teams.V.score },
    scoreAfter: { H: normalized.game.teams.H.score, V: normalized.game.teams.V.score },
    statsBefore: clone(envelope.stats?.teams || {}), statsAfter: clone(normalized.stats?.teams || {}),
  };
}
