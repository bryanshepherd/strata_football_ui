import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const EDITABLE_REPLACEMENT_TYPES = new Set([
  'rush',
  'pass',
  'punt',
  'kickoff',
  'fieldGoal',
  'try',
  'penalty',
]);

const CONTEXT_FIELDS = [
  'possession',
  'down',
  'distance',
  'yardLine',
  'lineToGain',
  'goalToGo',
  'driveId',
  'driveNumber',
];

const findEventIndex = (events, target) => events.findIndex((event) => (
  (target?.eventId && event.eventId === target.eventId)
  || (target?.clientEventId && event.clientEventId === target.clientEventId)
  || (Number.isFinite(Number(target?.sequence)) && Number(event.sequence) === Number(target.sequence))
));

const acceptedEvent = (event) => !event?.status || event.status === 'accepted';

const clockTenths = (clock) => {
  const [minutes, seconds] = String(clock || '00:00').split(':').map(Number);
  return (((Number(minutes) || 0) * 60) + (Number(seconds) || 0)) * 10;
};

const nextAcceptedEvent = (events, eventIndex) => events
  .slice(eventIndex + 1)
  .find(acceptedEvent) || null;

const hasCompleteAcceptedEventLog = (events) => events
  .filter(acceptedEvent)
  .every((event, index) => Number(event.sequence) === index + 1);

const comparableValue = (field, value) => {
  if (value == null || value === '') return null;
  if (['down', 'distance', 'driveNumber'].includes(field)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (field === 'goalToGo') return Boolean(value);
  return value;
};

const valuesMatch = (field, left, right) => (
  comparableValue(field, left) === comparableValue(field, right)
);

const contextLabel = (context = {}) => {
  const possession = context.possession || 'No possession';
  const series = context.down
    ? `${context.down} & ${context.goalToGo ? 'goal' : context.distance ?? '?'}`
    : 'no active series';
  return `${possession}, ${series}, ${context.yardLine || 'no spot'}`;
};

const projectionFor = (envelope, event, checkpoint) => applyFootballEventToEnvelope({
  ...envelope,
  liveState: clone(event.preState || envelope.liveState || {}),
}, event, {
  nextDriveId: checkpoint?.driveId || undefined,
});

const scoringEffect = (projection) => {
  const scoring = projection?.scoringUpdate;
  if (!scoring?.team || !Number.isFinite(Number(scoring.points))) return null;
  return { team: scoring.team, points: Number(scoring.points) };
};

const applyScoringDelta = (teams, originalProjection, replacementProjection) => {
  const next = {
    H: { ...teams.H },
    V: { ...teams.V },
  };
  const original = scoringEffect(originalProjection);
  const replacement = scoringEffect(replacementProjection);
  if (original && next[original.team]) {
    next[original.team].score = Number(next[original.team].score || 0) - original.points;
  }
  if (replacement && next[replacement.team]) {
    next[replacement.team].score = Number(next[replacement.team].score || 0) + replacement.points;
  }
  return next;
};

const replacementAuditSource = (original, replacement, editedAt) => ({
  ...(clone(replacement.source || {})),
  replacement: {
    replacedAt: editedAt,
    replacedEventId: original.eventId || null,
    replacedClientEventId: original.clientEventId || null,
    replacementDraftClientEventId: replacement.clientEventId || null,
    previousType: original.type || null,
    previousSubtype: original.subtype ?? null,
  },
});

const canonicalReplacementEvent = (original, replacement, editedAt) => ({
  ...clone(replacement),
  eventId: original.eventId,
  clientEventId: original.clientEventId,
  sequence: original.sequence,
  type: replacement.type,
  subtype: replacement.subtype ?? null,
  createdAt: original.createdAt || replacement.createdAt || editedAt,
  acceptedAt: original.acceptedAt || replacement.acceptedAt || editedAt,
  status: original.status || 'accepted',
  period: original.period,
  clock: original.clock,
  preState: clone(original.preState || replacement.preState || {}),
  source: replacementAuditSource(original, replacement, editedAt),
});

const setupStateForTarget = (events, eventIndex, target) => {
  const preState = clone(target.preState || {});
  const previous = [...events.slice(0, eventIndex)].reverse().find(acceptedEvent);
  if (target.type === 'try') {
    const tryTeam = target.result?.scoring?.team
      || target.participants?.primary?.team
      || target.participants?.kicker?.team
      || target.possession
      || previous?.result?.scoring?.team
      || previous?.possession;
    return {
      ...preState,
      possession: null,
      pendingTryTeam: tryTeam || null,
      nextPlayContext: 'awaitingTry',
    };
  }
  if (target.type === 'kickoff') {
    const kickoffTeam = target.participants?.kicker?.team
      || target.participants?.primary?.team
      || target.possession
      || previous?.result?.scoring?.team
      || previous?.possession;
    return {
      ...preState,
      possession: null,
      kickoffTeam: kickoffTeam || null,
      nextPlayContext: 'awaitingKickoff',
    };
  }
  return preState;
};

export function buildFootballPlayReplacementEnvelope(envelope, play) {
  if (!envelope || !Array.isArray(envelope.events) || !play) {
    throw new Error('A game envelope and selected play are required.');
  }
  const eventIndex = findEventIndex(envelope.events, play);
  if (eventIndex < 0) throw new Error('The selected play is no longer in the game log.');
  if (!hasCompleteAcceptedEventLog(envelope.events)) {
    throw new Error('This game does not contain a complete sequential event log, so replacement statistics cannot be recalculated safely.');
  }
  const target = envelope.events[eventIndex];
  if (!acceptedEvent(target)) throw new Error('Only an accepted play can be replaced.');
  if (!target.preState || typeof target.preState !== 'object') {
    throw new Error(`Play #${target.sequence || eventIndex + 1} does not contain a recorded starting context, so it cannot be replaced safely.`);
  }
  const checkpointEvent = nextAcceptedEvent(envelope.events, eventIndex);
  if (checkpointEvent && !checkpointEvent.preState) {
    throw new Error(`Play #${checkpointEvent.sequence || eventIndex + 2} does not contain a recorded starting context, so this replacement cannot be verified safely.`);
  }
  const replacementState = setupStateForTarget(envelope.events, eventIndex, target);
  return {
    ...clone(envelope),
    game: {
      ...clone(envelope.game),
      status: 'inProgress',
      period: target.period,
    },
    pregame: envelope.pregame
      ? { ...clone(envelope.pregame), gamePhase: 'live' }
      : envelope.pregame,
    clock: {
      ...clone(envelope.clock || {}),
      period: target.period,
      clock: target.clock,
      clockTenths: clockTenths(target.clock),
      isRunning: false,
    },
    liveState: replacementState,
    events: clone(envelope.events.slice(0, eventIndex).filter(acceptedEvent)),
    stats: {
      ...clone(envelope.stats || {}),
      sourceEventSequence: Math.max(0, Number(target.sequence || eventIndex + 1) - 1),
    },
  };
}

export function replaceFootballPlayInEnvelope(
  envelope,
  play,
  replacement,
  { editedAt = new Date().toISOString() } = {},
) {
  if (!envelope || !Array.isArray(envelope.events) || !play || !replacement) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_PLAY_REPLACEMENT', message: 'A game envelope, selected play, and replacement play are required.' }],
    };
  }
  const eventIndex = findEventIndex(envelope.events, play);
  if (eventIndex < 0) {
    return {
      ok: false,
      errors: [{ code: 'PLAY_NOT_FOUND', message: 'The selected play is no longer in the game log.' }],
    };
  }
  if (!hasCompleteAcceptedEventLog(envelope.events)) {
    return {
      ok: false,
      errors: [{
        code: 'REPLACEMENT_EVENT_LOG_INCOMPLETE',
        message: 'This game does not contain a complete sequential event log, so replacement statistics cannot be recalculated safely.',
      }],
    };
  }
  if (!EDITABLE_REPLACEMENT_TYPES.has(replacement.type)) {
    return {
      ok: false,
      errors: [{ code: 'INVALID_REPLACEMENT_TYPE', field: 'event.type', message: 'Replace this play with a scoring play or penalty, not Game Control.' }],
    };
  }

  const original = envelope.events[eventIndex];
  if (!acceptedEvent(original)) {
    return {
      ok: false,
      errors: [{ code: 'PLAY_NOT_ACCEPTED', message: 'Only an accepted play can be replaced.' }],
    };
  }
  if (!original.preState || typeof original.preState !== 'object') {
    return {
      ok: false,
      errors: [{
        code: 'REPLACEMENT_PRESTATE_UNAVAILABLE',
        message: `Play #${original.sequence || eventIndex + 1} does not contain a recorded starting context, so it cannot be replaced safely.`,
      }],
    };
  }
  const checkpointEvent = nextAcceptedEvent(envelope.events, eventIndex);
  if (checkpointEvent && !checkpointEvent.preState) {
    return {
      ok: false,
      errors: [{
        code: 'REPLACEMENT_CHECKPOINT_UNAVAILABLE',
        message: `Play #${checkpointEvent.sequence || eventIndex + 2} does not contain a recorded starting context, so this replacement cannot be verified safely.`,
      }],
    };
  }
  const checkpoint = clone(checkpointEvent?.preState || envelope.liveState || {});
  const nextEventLabel = checkpointEvent?.sequence ? `play #${checkpointEvent.sequence}` : 'the final game state';
  const nextDriveId = checkpoint?.driveId || undefined;
  const event = canonicalReplacementEvent(original, replacement, editedAt);

  let originalProjection;
  let replacementProjection;
  try {
    originalProjection = projectionFor(envelope, original, { driveId: nextDriveId });
    replacementProjection = projectionFor(envelope, event, { driveId: nextDriveId });
  } catch (error) {
    return {
      ok: false,
      errors: [{
        code: 'REPLACEMENT_PROJECTION_FAILED',
        message: error instanceof Error ? error.message : 'The replacement could not be calculated.',
      }],
    };
  }

  const mismatches = CONTEXT_FIELDS.filter((field) => (
    checkpoint[field] !== undefined
    && !valuesMatch(field, replacementProjection.liveState?.[field], checkpoint[field])
  ));
  const warnings = mismatches.length > 0
    ? [{
        code: 'REPLACEMENT_CONTEXT_MISMATCH',
        field: `event.result.${mismatches[0]}`,
        message: `The replacement calculates ${contextLabel(replacementProjection.liveState)}, but ${nextEventLabel} begins ${contextLabel(checkpoint)}. The replacement was saved and the recorded downstream context was preserved; review ${nextEventLabel} next.`,
        details: {
          fields: mismatches,
          calculated: clone(replacementProjection.liveState),
          checkpoint,
          checkpointEventSequence: checkpointEvent?.sequence || null,
        },
      }]
    : [];

  event.postState = clone(replacementProjection.liveState);
  const events = clone(envelope.events);
  events[eventIndex] = event;
  const amended = {
    ...clone(envelope),
    updatedAt: editedAt,
    game: {
      ...clone(envelope.game),
      teams: applyScoringDelta(envelope.game.teams, originalProjection, replacementProjection),
    },
    events,
  };
  const normalized = normalizeFootballScoringSetupEnvelope(amended);

  return {
    ok: true,
    envelope: normalized,
    event: normalized.events[eventIndex],
    projection: replacementProjection,
    checkpoint,
    warnings,
  };
}
