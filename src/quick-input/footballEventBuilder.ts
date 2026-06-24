import type {
  DraftParticipant,
  DraftPenalty,
  DraftPrePlayContext,
  DraftResult,
  DraftWarning,
  FootballDraftIntent,
  FootballIntentValidationError,
  FootballPlayFamily,
  FootballPlaySubtype,
  TeamCode,
} from './footballIntentSchema';
import { validateFootballDraftIntent } from './footballIntentSchema';
import { generateFootballPlaySummary } from './footballPlaySummaryGrammar';

export const FOOTBALL_SUBMIT_EVENT_REQUEST_SCHEMA_VERSION = 'football.submitEventRequest.v1' as const;

export type FootballEventBuildErrorCode =
  | 'UNCONFIRMED_DRAFT'
  | 'SUMMARY_STALE'
  | 'MISSING_CONFIRMATION'
  | 'MISSING_CLIENT_EVENT_ID'
  | 'MISSING_REQUIRED_PARTICIPANT'
  | 'MISSING_REQUIRED_RESULT'
  | 'UNRESOLVED_PLAYER'
  | 'INVALID_INTENT'
  | 'UNSUPPORTED_PLAY_FAMILY';

export type FootballEventBuildError = {
  code: FootballEventBuildErrorCode | FootballIntentValidationError['code'];
  message: string;
  field?: string;
};

export type FootballSubmitEventRequest = {
  schemaVersion: typeof FOOTBALL_SUBMIT_EVENT_REQUEST_SCHEMA_VERSION;
  gameId: string;
  clientContext: FootballSubmitClientContext;
  event: DraftFootballEvent;
};

export type FootballSubmitClientContext = {
  clientEventId: string;
  sessionId?: string;
  userId?: string;
  submittedAt: string;
  baseEnvelopeVersion?: string;
  baseEventSequence: number;
};

export type DraftFootballEvent = {
  clientEventId: string;
  type: FootballPlayFamily;
  subtype: FootballPlaySubtype;
  period: number;
  clock: string | null;
  possession: TeamCode | null;
  preState: DraftPrePlayContext;
  participants: FootballEventParticipants;
  result: DraftResult;
  penalties: FootballEventPenalty[];
  description: string;
  source: FootballEventSourceMetadata;
  confirmation: FootballEventConfirmationMetadata;
  warnings: DraftWarning[];
};

export type FootballEventParticipant = {
  playerId: string;
  team: TeamCode;
  role: DraftParticipant['role'];
};

export type FootballEventParticipants = {
  primary: FootballEventParticipant | null;
  secondary: FootballEventParticipant | null;
  defenders: FootballEventParticipant[];
  returner: FootballEventParticipant | null;
  kicker: FootballEventParticipant | null;
  punter: FootballEventParticipant | null;
  holder: FootballEventParticipant | null;
  fumbler: FootballEventParticipant | null;
  forcedBy: FootballEventParticipant | null;
  recoveredBy: FootballEventParticipant | null;
  penalizedPlayers: FootballEventParticipant[];
  others: FootballEventParticipant[];
};

export type FootballEventPenalty = DraftPenalty;

export type FootballEventSourceMetadata = {
  kind: 'fcqi';
  draftIntentId: string;
  draftRevision: number;
  summaryRevision: number;
  confirmedAt: string;
};

export type FootballEventConfirmationMetadata = {
  summaryText: string;
  confirmedByUserId?: string;
  confirmedAt: string;
};

export type FootballEventBuildResult =
  | {
      ok: true;
      submitRequest: FootballSubmitEventRequest;
      event: DraftFootballEvent;
      warnings: DraftWarning[];
    }
  | {
      ok: false;
      errors: FootballEventBuildError[];
      warnings: DraftWarning[];
    };

export function buildFootballEvent(intent: FootballDraftIntent): FootballEventBuildResult {
  const preflightErrors = validateBuilderPreconditions(intent);
  if (preflightErrors.length > 0) {
    return {
      ok: false,
      errors: preflightErrors,
      warnings: [...intent.warnings],
    };
  }

  const validation = validateFootballDraftIntent(intent);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map(mapValidationError),
      warnings: validation.warnings,
    };
  }

  if (!isSupportedPlayFamily(intent.play.family)) {
    return {
      ok: false,
      errors: [
        {
          code: 'UNSUPPORTED_PLAY_FAMILY',
          message: `Unsupported play family: ${intent.play.family}`,
          field: 'play.family',
        },
      ],
      warnings: validation.warnings,
    };
  }

  const confirmation = intent.confirmation;
  if (!confirmation) {
    return {
      ok: false,
      errors: [{ code: 'MISSING_CONFIRMATION', message: 'Confirmed intent requires confirmation metadata', field: 'confirmation' }],
      warnings: validation.warnings,
    };
  }

  const summary = generateFootballPlaySummary(intent);
  const warnings = [...summary.warnings];
  const description = confirmation.summaryText;
  const event = buildDraftEvent(intent, description, warnings);
  const submitRequest = buildSubmitRequest(intent, event, confirmation.confirmedAt);

  return {
    ok: true,
    submitRequest,
    event,
    warnings,
  };
}

function validateBuilderPreconditions(intent: FootballDraftIntent): FootballEventBuildError[] {
  const errors: FootballEventBuildError[] = [];

  if (intent.status !== 'confirmed') {
    errors.push({
      code: 'UNCONFIRMED_DRAFT',
      message: 'FootballDraftIntent must be confirmed before event construction',
      field: 'status',
    });
  }

  if (!intent.clientEventId) {
    errors.push({
      code: 'MISSING_CLIENT_EVENT_ID',
      message: 'FootballDraftIntent.clientEventId is required',
      field: 'clientEventId',
    });
  }

  if (intent.confirmation && intent.confirmation.summaryRevision !== intent.revision) {
    errors.push({
      code: 'SUMMARY_STALE',
      message: 'confirmation.summaryRevision must match intent revision',
      field: 'confirmation.summaryRevision',
    });
  }

  return errors;
}

function buildDraftEvent(
  intent: FootballDraftIntent,
  description: string,
  warnings: DraftWarning[],
): DraftFootballEvent {
  const confirmation = intent.confirmation!;

  return {
    clientEventId: intent.clientEventId,
    type: intent.play.family,
    subtype: intent.play.subtype,
    period: intent.play.period,
    clock: intent.play.clock,
    possession: intent.play.possession ?? intent.play.actionTeam,
    preState: copyPreState(intent.prePlay),
    participants: mapParticipants(intent),
    result: copyResult(intent.result),
    penalties: intent.penalties.map(copyPenalty),
    description,
    source: {
      kind: 'fcqi',
      draftIntentId: intent.intentId,
      draftRevision: intent.revision,
      summaryRevision: confirmation.summaryRevision,
      confirmedAt: confirmation.confirmedAt,
    },
    confirmation: {
      summaryText: description,
      confirmedByUserId: confirmation.confirmedByUserId,
      confirmedAt: confirmation.confirmedAt,
    },
    warnings: [...warnings],
  };
}

function buildSubmitRequest(
  intent: FootballDraftIntent,
  event: DraftFootballEvent,
  submittedAt: string,
): FootballSubmitEventRequest {
  return {
    schemaVersion: FOOTBALL_SUBMIT_EVENT_REQUEST_SCHEMA_VERSION,
    gameId: intent.game.gameId,
    clientContext: {
      clientEventId: intent.clientEventId,
      sessionId: intent.source.sessionId,
      userId: intent.source.userId,
      submittedAt,
      baseEnvelopeVersion: intent.source.baseEnvelopeVersion,
      baseEventSequence: intent.source.baseEventSequence,
    },
    event,
  };
}

function mapParticipants(intent: FootballDraftIntent): FootballEventParticipants {
  return {
    primary: mapParticipant(intent.participants.primary),
    secondary: mapParticipant(intent.participants.secondary),
    defenders: intent.participants.defenders.map(mapRequiredParticipant),
    returner: mapParticipant(intent.participants.returner),
    kicker: mapParticipant(intent.participants.kicker),
    punter: mapParticipant(intent.participants.punter),
    holder: mapParticipant(intent.participants.holder),
    fumbler: mapParticipant(intent.participants.fumbler),
    forcedBy: mapParticipant(intent.participants.forcedBy),
    recoveredBy: mapParticipant(intent.participants.recoveredBy),
    penalizedPlayers: intent.participants.penalizedPlayers.map(mapRequiredParticipant),
    others: intent.participants.others.map(mapRequiredParticipant),
  };
}

function mapParticipant(participant: DraftParticipant | undefined): FootballEventParticipant | null {
  if (!participant) return null;
  return mapRequiredParticipant(participant);
}

function mapRequiredParticipant(participant: DraftParticipant): FootballEventParticipant {
  return {
    playerId: participant.playerId,
    team: participant.team,
    role: participant.role,
  };
}

function copyPreState(preState: DraftPrePlayContext): DraftPrePlayContext {
  return { ...preState };
}

function copyResult(result: DraftResult): DraftResult {
  return {
    ...result,
    pass: result.pass ? { ...result.pass } : undefined,
    kick: result.kick ? { ...result.kick } : undefined,
    return: result.return ? { ...result.return } : undefined,
    fumble: result.fumble ? { ...result.fumble } : undefined,
    turnover: result.turnover ? { ...result.turnover } : undefined,
    scoring: result.scoring ? { ...result.scoring } : undefined,
    gameControl: result.gameControl ? { ...result.gameControl } : undefined,
  };
}

function copyPenalty(penalty: DraftPenalty): FootballEventPenalty {
  return { ...penalty };
}

function mapValidationError(error: FootballIntentValidationError): FootballEventBuildError {
  return {
    code: error.code,
    message: error.message,
    field: error.field,
  };
}

function isSupportedPlayFamily(family: FootballPlayFamily): boolean {
  return [
    'rush',
    'pass',
    'punt',
    'kickoff',
    'fieldGoal',
    'try',
    'penalty',
  ].includes(family);
}
