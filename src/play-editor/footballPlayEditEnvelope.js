import { repairFootballPenaltyNames } from '../utils/footballPenaltyNames';
import { footballPenaltyDisplayName, footballPenaltyRulesetFromRules } from '../quick-input/penaltyTable';
import { generateFootballPlaySummary } from '../quick-input/footballPlaySummaryGrammar';
import { classifyPlayEdit } from './footballPlayEditPolicy';
import { repairFootballEditedActorReferences, synchronizeFootballEditedActors } from './footballActorReferences';
import { calculateEditedPenaltyYards } from './footballPlayEditYardage';
import { isFootballKickoffReplay } from '../utils/footballKickoffReplay';
import { formatFootballChallengeReadout } from '../utils/footballChallengeReadout';
import { repairFootballPassDefense } from '../utils/footballPassDefense';

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
  const players = allEnvelopePlayers(envelope);
  const resolve = (participant) => participantForSummary(participant && {
    ...players.find((player) => player.playerId === participant.playerId),
    ...participant,
  });
  const penalizedPlayers = (event.penalties || [])
    .map((penalty) => penaltyParticipant(envelope, penalty))
    .filter(Boolean);
  return {
    ...participants,
    primary: resolve(participants.primary),
    secondary: resolve(participants.secondary),
    receiver: resolve(participants.receiver),
    target: resolve(participants.target),
    interceptor: resolve(participants.interceptor),
    defenders: (participants.defenders || []).map(resolve),
    returner: resolve(participants.returner),
    kicker: resolve(participants.kicker),
    punter: resolve(participants.punter),
    holder: resolve(participants.holder),
    fumbler: resolve(participants.fumbler),
    forcedBy: resolve(participants.forcedBy),
    recoveredBy: resolve(participants.recoveredBy),
    penalizedPlayers,
    others: (participants.others || []).map(resolve),
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

  const synchronizedPlay = synchronizeFootballEditedActors(envelope, original, editedPlay);
  if (synchronizedPlay.result?.fumble?.recoveredByPlayerId === 'TM'
    && (synchronizedPlay.result.fumble.returnYards || synchronizedPlay.result.fumble.returnEndYardLine
      || synchronizedPlay.result.return?.returnerPlayerId === 'TM')) {
    throw new Error('A team recovery cannot have a player return. Replace the play to remove the return.');
  }
  const amendedEvent = {
    ...original,
    participants: clone(synchronizedPlay.participants || original.participants || {}),
    result: clone(synchronizedPlay.result || original.result || {}),
    penalties: clone(editedPlay.penalties || []).map((penalty, index) => {
      const previous = original.penalties?.[index];
      const codeChanged = penalty.code !== previous?.code;
      const name = footballPenaltyDisplayName(
        codeChanged && penalty.name === previous?.name ? { ...penalty, name: '' } : penalty,
        footballPenaltyRulesetFromRules(envelope.game?.rules),
        codeChanged ? '' : repairFootballPenaltyNames(envelope, original).penalties?.[index]?.name,
      );
      return { ...penalty, name };
    }),
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

export function repairFootballEditedActorsInEnvelope(envelope) {
  if (!Array.isArray(envelope?.events)) return envelope;
  let changed = false;
  const events = envelope.events.map(event => {
    const withPassDefense = repairFootballPassDefense(envelope, event);
    const repaired = repairFootballEditedActorReferences(envelope, withPassDefense);
    if (repaired === event) return event;
    changed = true;
    // Filling missing actor references does not require rewriting historical text.
    if (repaired === withPassDefense) return repaired;
    const description = buildFootballEditedPlaySummary(envelope, repairFootballPenaltyNames(envelope, repaired));
    return {
      ...repaired, description,
      ...(event.confirmation ? { confirmation: { ...event.confirmation, summaryText: description } } : {}),
    };
  });
  return changed ? { ...envelope, events } : envelope;
}

export function repairFootballPlayReadoutsInEnvelope(envelope) {
  const repaired = repairFootballEditedActorsInEnvelope(envelope);
  if (!Array.isArray(repaired?.events)) return repaired;
  let changed = false;
  const events = repaired.events.map(original => {
    if (!original || (original.status && original.status !== 'accepted')) return original;
    const event = repairFootballPenaltyNames(repaired, original);
    if (event !== original) changed = true;
    let missingYardsRepaired = false;
    const penalties = (event.penalties || []).map((penalty, index) => {
      if (penalty.status !== 'accepted' || penalty.yards !== null && penalty.yards !== undefined) return penalty;
      const yards = calculateEditedPenaltyYards(event, penalty, index);
      if (yards === null) return penalty;
      missingYardsRepaired = true;
      return { ...penalty, yards };
    });
    const missingRekickReadout = isFootballKickoffReplay(event) && !/\bNo play\.[\s\S]*\bRe-kick\b/i.test(event.description || '');
    const challengeReadout = event.type === 'gameControl'
      ? formatFootballChallengeReadout(event.result?.gameControl, repaired.game?.teams)
      : null;
    const staleChallengeReadout = challengeReadout && (event.description !== challengeReadout
      || event.confirmation && event.confirmation.summaryText !== challengeReadout);
    if (!missingYardsRepaired && !missingRekickReadout && !staleChallengeReadout) return event;
    changed = true;
    const next = { ...event, penalties };
    const description = challengeReadout || buildFootballEditedPlaySummary(repaired, next);
    return { ...next, description, ...(event.confirmation ? { confirmation: { ...event.confirmation, summaryText: description } } : {}) };
  });
  return changed ? { ...repaired, events } : repaired;
}
