import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { createLiveState } from '../utils/footballRulesEngine';
import { normalizeFootballSpot } from '../utils/footballSpotNormalization';
import { footballTeamAliasesForEnvelope } from '../utils/footballTeamAliases';
import { buildFootballEditedPlaySummary } from './footballPlayEditEnvelope';

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const findEventIndex = (events, target) => events.findIndex((event) => (
  (target?.eventId && event.eventId === target.eventId)
  || (target?.clientEventId && event.clientEventId === target.clientEventId)
  || (Number.isFinite(Number(target?.sequence)) && Number(event.sequence) === Number(target.sequence))
));

const acceptedEvent = (event) => !event?.status || event.status === 'accepted';

export const isFootballBallContextRevision = (event) => (
  event?.type === 'gameControl'
  && String(event?.result?.gameControl?.action || '').toLowerCase() === 'setballcontext'
);

export const footballBallContextRevisionValues = (event) => {
  const control = event?.result?.gameControl || {};
  return {
    down: control.down ?? '',
    distance: control.distance ?? '',
    spot: control.spot ?? '',
    lineToGain: control.lineToGain ?? '',
  };
};

const normalizedRevision = (envelope, revision) => {
  const downs = Number(envelope?.game?.rules?.downs || 4);
  const down = Number(revision?.down);
  const distance = Number(revision?.distance);
  const teamAliases = footballTeamAliasesForEnvelope(envelope);
  const spot = normalizeFootballSpot(revision?.spot, { teamAliases });
  const lineToGain = normalizeFootballSpot(revision?.lineToGain, { teamAliases });

  if (!Number.isInteger(down) || down < 1 || down > downs) {
    throw new Error(`Down must be a whole number from 1 through ${downs}.`);
  }
  if (!Number.isInteger(distance) || distance < 1) {
    throw new Error('Distance must be a whole number of at least 1 yard.');
  }
  if (!spot || spot === 'goal') {
    throw new Error('Ball spot must be a valid field yardline.');
  }
  if (!lineToGain) {
    throw new Error('Line to gain must be a valid field yardline or goal.');
  }

  return { down, distance, spot, lineToGain };
};

const latestAcceptedEventIndex = (events) => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (acceptedEvent(events[index])) return index;
  }
  return -1;
};

const liveStateForRevision = (envelope, event, revision) => {
  const current = event.postState || event.preState || envelope.liveState || {};
  const possession = event.result?.gameControl?.possession
    || event.preState?.possession
    || event.possession
    || envelope.liveState?.possession;
  return createLiveState({
    possession,
    down: revision.down,
    distance: revision.distance,
    yardLine: revision.spot,
    lineToGain: revision.lineToGain,
    driveId: current.driveId,
    driveNumber: current.driveNumber,
  });
};

export function updateFootballBallContextRevision(
  envelope,
  target,
  revision,
  { editedAt = new Date().toISOString() } = {},
) {
  if (!envelope || !Array.isArray(envelope.events) || !target) {
    throw new Error('A game envelope and ball context revision are required.');
  }
  const eventIndex = findEventIndex(envelope.events, target);
  if (eventIndex < 0) throw new Error('The selected ball context revision is no longer in the game log.');
  const original = envelope.events[eventIndex];
  if (!isFootballBallContextRevision(original)) {
    throw new Error('Only a ball context revision can be changed with this editor.');
  }

  const nextRevision = normalizedRevision(envelope, revision);
  const contextState = liveStateForRevision(envelope, original, nextRevision);
  const amendedEvent = {
    ...clone(original),
    result: {
      ...clone(original.result || {}),
      gameControl: {
        ...clone(original.result?.gameControl || {}),
        ...nextRevision,
      },
    },
  };
  if (original.postState) amendedEvent.postState = { ...clone(original.postState), ...contextState };
  const description = buildFootballEditedPlaySummary(envelope, amendedEvent);
  amendedEvent.description = description;
  if (original.confirmation) {
    amendedEvent.confirmation = { ...clone(original.confirmation), summaryText: description };
  }

  const events = clone(envelope.events);
  events[eventIndex] = amendedEvent;
  const isLatestAccepted = eventIndex === latestAcceptedEventIndex(envelope.events);
  return normalizeFootballScoringSetupEnvelope({
    ...clone(envelope),
    updatedAt: editedAt,
    events,
    liveState: isLatestAccepted
      ? { ...clone(envelope.liveState || {}), ...contextState }
      : clone(envelope.liveState || {}),
  });
}

const rebaseEventSource = (source, deletedSequence) => {
  if (!source || !Number.isFinite(Number(source.baseEventSequence))) return source;
  const baseEventSequence = Number(source.baseEventSequence);
  if (baseEventSequence < deletedSequence) return source;
  return { ...source, baseEventSequence: Math.max(0, baseEventSequence - 1) };
};

export function deleteFootballBallContextRevision(
  envelope,
  target,
  { editedAt = new Date().toISOString() } = {},
) {
  if (!envelope || !Array.isArray(envelope.events) || !target) {
    throw new Error('A game envelope and ball context revision are required.');
  }
  const eventIndex = findEventIndex(envelope.events, target);
  if (eventIndex < 0) throw new Error('The selected ball context revision is no longer in the game log.');
  const original = envelope.events[eventIndex];
  if (!isFootballBallContextRevision(original)) {
    throw new Error('Only a ball context revision can be deleted with this control.');
  }

  const deletedSequence = Number(original.sequence || eventIndex + 1);
  const isLatestAccepted = eventIndex === latestAcceptedEventIndex(envelope.events);
  const events = envelope.events
    .filter((_event, index) => index !== eventIndex)
    .map((event, index) => ({
      ...clone(event),
      sequence: index + 1,
      source: rebaseEventSource(clone(event.source), deletedSequence),
    }));
  const restoredLiveState = createLiveState({
    possession: original.preState?.possession,
    down: original.preState?.down,
    distance: original.preState?.distance,
    yardLine: original.preState?.yardLine,
    lineToGain: original.preState?.lineToGain,
    driveId: original.preState?.driveId,
    driveNumber: original.preState?.driveNumber,
  });

  const amended = {
    ...clone(envelope),
    updatedAt: editedAt,
    events,
    stats: {
      ...clone(envelope.stats || {}),
      sourceEventSequence: events.length,
    },
    liveState: isLatestAccepted
      ? { ...clone(envelope.liveState || {}), ...restoredLiveState }
      : clone(envelope.liveState || {}),
  };
  return normalizeFootballScoringSetupEnvelope(amended);
}
