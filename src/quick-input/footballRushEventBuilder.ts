import type { DraftScoringEvent, SubmitEventRequest } from '../contracts/football';
import type {
  DraftParticipant,
  DraftWarning,
  FootballDraftIntent,
} from './footballIntentSchema';
import { validateFootballDraftIntent } from './footballIntentSchema';
import { mapDraftPenaltyToCanonicalEvent } from './footballPenaltyMapper';
import { generateFootballPlaySummary } from './footballPlaySummaryGrammar';

export type RushEventBuildError = {
  code: string;
  message: string;
  field?: string;
};

export type RushEventBuildResult =
  | { ok: true; event: DraftScoringEvent; submitRequest: SubmitEventRequest; warnings: DraftWarning[] }
  | { ok: false; errors: RushEventBuildError[]; warnings: DraftWarning[] };

export function buildCanonicalRushEvent(intent: FootballDraftIntent): RushEventBuildResult {
  const errors: RushEventBuildError[] = [];
  if (intent.play.family !== 'rush') {
    errors.push({ code: 'UNSUPPORTED_PLAY_FAMILY', message: 'Canonical Rush builder accepts Rush intent only.', field: 'play.family' });
  }
  if (intent.status !== 'confirmed' || !intent.confirmation) {
    errors.push({ code: 'UNCONFIRMED_DRAFT', message: 'Rush intent must be explicitly confirmed.', field: 'status' });
  } else if (intent.confirmation.summaryRevision !== intent.revision) {
    errors.push({ code: 'SUMMARY_STALE', message: 'Confirmed Rush summary revision is stale.', field: 'confirmation.summaryRevision' });
  }
  if (!intent.clientEventId) {
    errors.push({ code: 'MISSING_CLIENT_EVENT_ID', message: 'Rush intent requires a clientEventId.', field: 'clientEventId' });
  }
  if (!intent.play.clock) {
    errors.push({ code: 'INVALID_CLOCK', message: 'Rush intent requires a public MM:SS clock.', field: 'play.clock' });
  }
  if (!intent.play.possession || intent.prePlay.possession !== intent.play.possession) {
    errors.push({ code: 'INVALID_PRE_PLAY_CONTEXT', message: 'Rush possession must match the pre-play state.', field: 'prePlay.possession' });
  }
  const validation = validateFootballDraftIntent(intent);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => ({ code: error.code, message: error.message, field: error.field })));
  }

  const rusher = intent.participants.primary;
  if (!rusher || rusher.role !== 'rusher' || rusher.team !== intent.play.possession) {
    errors.push({ code: 'MISSING_REQUIRED_PARTICIPANT', message: 'Rush primary participant must resolve to the possessing-team rusher.', field: 'participants.primary' });
  }
  if (!['tackle', 'outOfBounds', 'touchdown', 'safety', 'touchback', 'fumble'].includes(intent.result.code)) {
    errors.push({ code: 'MISSING_REQUIRED_RESULT', message: 'Unsupported canonical Rush outcome.', field: 'result.code' });
  }
  if (typeof intent.result.yards !== 'number' || !Number.isInteger(intent.result.yards)) {
    errors.push({ code: 'MISSING_REQUIRED_RESULT', message: 'Canonical Rush result requires integer yards.', field: 'result.yards' });
  }
  if (intent.result.code !== 'touchdown' && !intent.result.endYardLine) {
    errors.push({ code: 'MISSING_REQUIRED_RESULT', message: 'Non-touchdown Rush result requires an end spot.', field: 'result.endYardLine' });
  }

  const fumble = intent.result.fumble;
  if (fumble) {
    for (const [field, value] of [
      ['fumblerPlayerId', fumble?.fumblerPlayerId],
      ['recoveredByPlayerId', fumble?.recoveredByPlayerId],
      ['recoveredByTeam', fumble?.recoveredByTeam],
      ['recoverySpot', fumble?.recoverySpot],
    ] as const) {
      if (!value) errors.push({ code: 'MISSING_REQUIRED_RESULT', message: `Rush fumble requires ${field}.`, field: `result.fumble.${field}` });
    }
    if (fumble?.fumblerPlayerId !== rusher?.playerId) {
      errors.push({ code: 'UNRESOLVED_PLAYER', message: 'Rush fumbler must resolve to the rusher.', field: 'result.fumble.fumblerPlayerId' });
    }
    if (fumble?.recoveredByPlayerId && !participantForPlayer(intent, fumble.recoveredByPlayerId)) {
      errors.push({ code: 'UNRESOLVED_PLAYER', message: 'Rush recovery player must have a stable resolved participant identity.', field: 'result.fumble.recoveredByPlayerId' });
    }
    if (fumble?.forcedByPlayerId && !participantForPlayer(intent, fumble.forcedByPlayerId)) {
      errors.push({ code: 'UNRESOLVED_PLAYER', message: 'Rush forced-fumble defender must have a stable resolved participant identity.', field: 'result.fumble.forcedByPlayerId' });
    }
  }

  const summary = generateFootballPlaySummary(intent);
  if (intent.confirmation && intent.confirmation.summaryText !== summary.summaryText) {
    errors.push({ code: 'SUMMARY_STALE', message: 'Rush confirmation summary must match the freshly generated canonical summary.', field: 'confirmation.summaryText' });
  }
  if (errors.length > 0) {
    return { ok: false, errors: dedupeErrors(errors), warnings: summary.warnings };
  }

  const possession = intent.play.possession!;
  const result: DraftScoringEvent['result'] = {
    code: intent.result.code,
    yards: intent.result.yards,
    ...(intent.result.endYardLine && intent.result.endYardLine !== 'goal' ? { endYardLine: intent.result.endYardLine } : {}),
    ...(typeof intent.result.firstDown === 'boolean' ? { firstDown: intent.result.firstDown } : {}),
  };
  if (intent.result.laterals) result.laterals = intent.result.laterals.map((lateral) => ({ ...lateral }));
  if (intent.result.return) result.return = { ...intent.result.return };
  if (intent.result.nextPossession) result.nextPossession = intent.result.nextPossession;
  if (intent.result.scoring) {
    result.scoring = { ...intent.result.scoring };
  } else if (intent.result.code === 'touchdown') {
    result.scoring = { team: possession, points: 6, type: 'touchdown' };
  } else if (intent.result.code === 'safety') {
    result.scoring = { team: possession === 'H' ? 'V' : 'H', points: 2, type: 'safety' };
  }
  if (fumble) {
    const turnover = fumble.recoveredByTeam !== possession;
    result.fumble = {
      fumblerPlayerId: fumble.fumblerPlayerId,
      ...(fumble.forcedByPlayerId ? { forcedByPlayerId: fumble.forcedByPlayerId } : {}),
      ...(fumble.spot && fumble.spot !== 'goal' ? { spot: fumble.spot } : {}),
      recoveredByPlayerId: fumble.recoveredByPlayerId!,
      recoveredByTeam: fumble.recoveredByTeam!,
      recoverySpot: fumble.recoverySpot!,
      ...(typeof fumble.returnYards === 'number' ? { returnYards: fumble.returnYards } : {}),
      ...(fumble.returnEndYardLine ? { returnEndYardLine: fumble.returnEndYardLine } : {}),
      turnover,
    };
    if (turnover) {
      result.turnover = {
        type: 'fumble',
        team: possession,
        playerId: fumble.fumblerPlayerId,
        spot: fumble.recoverySpot!,
        recoveredBy: fumble.recoveredByTeam,
        ...(typeof fumble.returnYards === 'number' ? { returnYards: fumble.returnYards } : {}),
        ...(fumble.returnEndYardLine ? { returnEndYardLine: fumble.returnEndYardLine } : {}),
      };
    }
  }

  const event: DraftScoringEvent = {
    clientEventId: intent.clientEventId,
    type: 'rush',
    subtype: intent.play.subtype,
    createdAt: intent.confirmation!.confirmedAt,
    period: intent.play.period,
    clock: intent.play.clock!,
    possession,
    preState: { ...intent.prePlay },
    participants: {
      primary: mapParticipant(rusher!),
      secondary: null,
      defenders: canonicalRushParticipants(intent).map(mapParticipant),
    },
    result,
    penalties: intent.penalties.map(mapDraftPenaltyToCanonicalEvent),
    description: summary.summaryText,
  };

  return {
    ok: true,
    event,
    submitRequest: {
      schemaVersion: 'football.submitEventRequest.v1',
      gameId: intent.game.gameId,
      clientContext: {
        clientEventId: intent.clientEventId,
        ...(intent.source.sessionId ? { sessionId: intent.source.sessionId } : {}),
        ...(intent.source.userId ? { userId: intent.source.userId } : {}),
        submittedAt: intent.confirmation!.confirmedAt,
        ...(intent.source.baseEnvelopeVersion ? { baseEnvelopeVersion: intent.source.baseEnvelopeVersion } : {}),
        baseEventSequence: intent.source.baseEventSequence,
      },
      event,
    },
    warnings: summary.warnings,
  };
}

function canonicalRushParticipants(intent: FootballDraftIntent): DraftParticipant[] {
  const participants = [...intent.participants.defenders];
  for (const participant of [
    intent.participants.forcedBy,
    intent.participants.recoveredBy,
    intent.participants.returner,
    ...intent.participants.others,
  ]) {
    if (participant && !participants.some((candidate) => candidate.playerId === participant.playerId)) {
      participants.push(participant);
    }
  }
  return participants;
}

function participantForPlayer(intent: FootballDraftIntent, playerId: string): DraftParticipant | undefined {
  return [
    intent.participants.primary,
    ...intent.participants.defenders,
    intent.participants.forcedBy,
    intent.participants.recoveredBy,
  ].find((participant) => participant?.playerId === playerId);
}

function mapParticipant(participant: DraftParticipant) {
  return { playerId: participant.playerId, team: participant.team, role: participant.role };
}

function dedupeErrors(errors: RushEventBuildError[]): RushEventBuildError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.code}:${error.field ?? ''}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
