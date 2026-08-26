import { generateFootballPlaySummary } from '../quick-input/footballPlaySummaryGrammar';
import { classifyPlayEdit } from './footballPlayEditPolicy';

const clone = (value) => JSON.parse(JSON.stringify(value));

const LOCKED_EVENT_FIELDS = [
  'eventId',
  'clientEventId',
  'sequence',
  'type',
  'subtype',
  'createdAt',
  'acceptedAt',
  'status',
  'period',
  'clock',
  'possession',
  'preState',
  'postState',
];

const ENFORCEMENT_ALIASES = {
  endofplay: 'END',
  freekick: 'FREE_KICK',
  previous: 'PREVIOUS',
  previousspot: 'PREVIOUS',
  spot: 'SPOT',
  spotoffoul: 'SPOT',
  succeeding: 'END',
  succeedingspot: 'END',
  successfultd: 'SUCCESSFUL_TD',
  successfultouchdown: 'SUCCESSFUL_TD',
  try: 'TRY',
};

const normalizeToken = (value) => String(value || '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const findEventIndex = (events, target) => events.findIndex((event) => (
  (target?.eventId && event.eventId === target.eventId)
  || (target?.clientEventId && event.clientEventId === target.clientEventId)
  || (Number.isFinite(Number(target?.sequence)) && Number(event.sequence) === Number(target.sequence))
));

const participantForSummary = (participant) => {
  if (!participant) return participant;
  return {
    ...participant,
    participantId: participant.participantId || `${participant.playerId || 'unknown'}-${participant.role || 'other'}`,
    resolution: participant.resolution || {
      source: 'singleMatch',
      jerseyToken: String(participant.jersey || ''),
      teamScope: participant.team,
      actionContext: 'gameControl',
    },
  };
};

const allEnvelopePlayers = (envelope) => ['H', 'V'].flatMap((team) => (
  Object.values(envelope?.rosters?.teams?.[team]?.players || {})
));

const penaltyParticipant = (envelope, penalty) => {
  const playerId = penalty.playerId || penalty.penalizedPlayerId;
  const player = allEnvelopePlayers(envelope).find((candidate) => candidate.playerId === playerId);
  if (!player) return null;
  return participantForSummary({ ...player, role: 'penalizedPlayer' });
};

const summaryParticipants = (envelope, event) => {
  const participants = event.participants || {};
  const penalizedPlayers = (event.penalties || [])
    .map((penalty) => penaltyParticipant(envelope, penalty))
    .filter(Boolean);
  return {
    ...participants,
    primary: participantForSummary(participants.primary),
    secondary: participantForSummary(participants.secondary),
    defenders: (participants.defenders || []).map(participantForSummary),
    returner: participantForSummary(participants.returner),
    kicker: participantForSummary(participants.kicker),
    punter: participantForSummary(participants.punter),
    holder: participantForSummary(participants.holder),
    fumbler: participantForSummary(participants.fumbler),
    forcedBy: participantForSummary(participants.forcedBy),
    recoveredBy: participantForSummary(participants.recoveredBy),
    penalizedPlayers,
    others: (participants.others || []).map(participantForSummary),
  };
};

const summaryPenalty = (penalty) => {
  const normalizedEnforcement = ENFORCEMENT_ALIASES[normalizeToken(penalty.enforcedFrom)]
    || penalty.enforcedFrom;
  const downConsequence = penalty.downConsequence
    || (penalty.automaticFirstDown ? 'AUTO_FIRST' : null)
    || (penalty.lossOfDown ? 'LOSS_OF_DOWN' : null)
    || (penalty.replayDown ? 'REPEAT' : null)
    || (penalty.downCounts ? 'DOWN_COUNTS' : null);
  return {
    ...penalty,
    accepted: penalty.status === 'accepted',
    enforcedFrom: normalizedEnforcement,
    downConsequence: downConsequence || undefined,
    carryOverToKO: Boolean(penalty.carryOverToKO || penalty.carryOverToKickoff),
    penalizedPlayerId: penalty.penalizedPlayerId || penalty.playerId || undefined,
  };
};

const actionTeamForEvent = (event) => (
  event.possession
  || event.participants?.primary?.team
  || event.participants?.kicker?.team
  || event.participants?.punter?.team
  || event.penalties?.[0]?.team
  || 'H'
);

export function buildFootballEditedPlaySummary(envelope, event) {
  const now = event.acceptedAt || event.createdAt || new Date().toISOString();
  const participants = summaryParticipants(envelope, event);
  const intent = {
    schemaVersion: 'football.draftIntent.v1',
    intentId: event.source?.draftIntentId || `edit-${event.eventId || event.sequence}`,
    clientEventId: event.clientEventId,
    status: 'confirmed',
    createdAt: event.createdAt || now,
    updatedAt: now,
    revision: 1,
    game: {
      gameId: envelope.gameId,
      teams: {
        H: { team: 'H', ...envelope.game?.teams?.H },
        V: { team: 'V', ...envelope.game?.teams?.V },
      },
      rules: envelope.game?.rules || {},
    },
    source: {
      kind: 'fcqi',
      startedBy: 'programmatic',
      startedAt: now,
      baseEventSequence: Math.max(0, Number(event.sequence || 1) - 1),
    },
    play: {
      family: event.type,
      subtype: event.subtype ?? null,
      actionTeam: actionTeamForEvent(event),
      possession: event.possession ?? null,
      period: Number(event.period || 1),
      clock: event.clock || null,
    },
    prePlay: {
      possession: event.preState?.possession ?? event.possession ?? null,
      down: event.preState?.down ?? null,
      distance: event.preState?.distance ?? null,
      yardLine: event.preState?.yardLine ?? null,
      lineToGain: event.preState?.lineToGain ?? null,
      goalToGo: Boolean(event.preState?.goalToGo),
      redZone: Boolean(event.preState?.redZone),
      driveId: event.preState?.driveId ?? null,
      driveNumber: Number(event.preState?.driveNumber || 0),
    },
    participants,
    result: event.result || {},
    penalties: (event.penalties || []).map(summaryPenalty),
    warnings: [],
  };

  return generateFootballPlaySummary(intent).summaryText;
}

export function applyFootballPlayEditToEnvelope(envelope, editedPlay, { editedAt = new Date().toISOString() } = {}) {
  if (!envelope || !Array.isArray(envelope.events) || !editedPlay) {
    throw new Error('A game envelope and selected play are required.');
  }

  const eventIndex = findEventIndex(envelope.events, editedPlay);
  if (eventIndex < 0) throw new Error('The selected play is no longer in the game log.');
  const original = envelope.events[eventIndex];
  const decision = classifyPlayEdit(original, editedPlay);
  if (decision.mode !== 'update') {
    throw new Error(decision.reasons[0] || 'This change requires replacing the play.');
  }

  const changedLockedField = LOCKED_EVENT_FIELDS.find((field) => !sameValue(original[field], editedPlay[field]));
  if (changedLockedField) {
    throw new Error(`${changedLockedField} is locked context and cannot be edited.`);
  }

  const amendedEvent = {
    ...original,
    participants: clone(editedPlay.participants || original.participants || {}),
    result: clone(editedPlay.result || original.result || {}),
    penalties: clone(editedPlay.penalties || []),
  };
  const description = buildFootballEditedPlaySummary(envelope, amendedEvent);
  amendedEvent.description = description;
  if (original.confirmation) {
    amendedEvent.confirmation = { ...original.confirmation, summaryText: description };
  }

  const events = envelope.events.slice();
  events[eventIndex] = amendedEvent;
  return {
    ...envelope,
    updatedAt: editedAt,
    events,
  };
}
