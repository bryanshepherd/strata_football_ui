export const FOOTBALL_DRAFT_INTENT_SCHEMA_VERSION = 'football.draftIntent.v1' as const;

export type TeamCode = 'H' | 'V';
export type Spot = `${TeamCode}${string}` | '50' | 'goal';
export type ClockText = `${number}${number}:${number}${number}`;

export type FootballPlayFamily =
  | 'rush'
  | 'pass'
  | 'punt'
  | 'kickoff'
  | 'fieldGoal'
  | 'try'
  | 'penalty'
  | 'gameControl';

export type FootballPlaySubtype =
  | 'complete'
  | 'incomplete'
  | 'sack'
  | 'interception'
  | 'returned'
  | 'fairCatch'
  | 'downed'
  | 'touchback'
  | 'outOfBounds'
  | 'blocked'
  | 'muffed'
  | 'onside'
  | 'made'
  | 'missed'
  | 'kick'
  | 'rush'
  | 'pass'
  | 'failed'
  | 'defensiveReturn'
  | 'accepted'
  | 'declined'
  | 'offsetting'
  | 'startQuarter'
  | 'endQuarter'
  | 'setBallContext'
  | 'startDrive'
  | 'setPossession'
  | 'coinToss'
  | 'emergency'
  | 'rosterFunction'
  | null;

export type FootballDraftIntentStatus =
  | 'collecting'
  | 'readyForSummary'
  | 'summaryGenerated'
  | 'confirmed'
  | 'cancelled';

export type DraftGameContext = {
  gameId: string;
  homeTeamId?: string;
  visitorTeamId?: string;
  teams: {
    H: DraftTeamSummary;
    V: DraftTeamSummary;
  };
  rules?: DraftRulesSnapshot;
};

export type DraftTeamSummary = {
  team: TeamCode;
  teamId?: string;
  name?: string;
  abbr: string;
};

export type DraftRulesSnapshot = {
  periods?: number;
  minutesPerPeriod?: number;
  downs?: number;
  yardsToFirstDown?: number;
  kickoffSpot?: Spot;
  touchbackSpot?: Spot;
  patSpot?: Spot;
  fgReturn?: boolean;
  patReturns?: boolean;
};

export type DraftSourceContext = {
  kind: 'fcqi';
  startedBy: 'hotkey' | 'button' | 'programmatic';
  hotkey?: string;
  startedAt: string;
  baseEnvelopeVersion?: string;
  baseEventSequence: number;
  sessionId?: string;
  userId?: string;
};

export type DraftPlayContext = {
  family: FootballPlayFamily;
  subtype: FootballPlaySubtype;
  actionTeam: TeamCode;
  possession: TeamCode | null;
  period: number;
  clock: ClockText | null;
  clockTenths?: number | null;
};

export type DraftPrePlayContext = {
  possession: TeamCode | null;
  down: number | null;
  distance: number | null;
  yardLine: Spot | null;
  lineToGain: Spot | null;
  goalToGo?: boolean;
  redZone?: boolean;
  driveId: string | null;
  driveNumber: number;
};

export type DraftParticipants = {
  primary?: DraftParticipant;
  secondary?: DraftParticipant;
  defenders: DraftParticipant[];
  returner?: DraftParticipant;
  kicker?: DraftParticipant;
  punter?: DraftParticipant;
  holder?: DraftParticipant;
  fumbler?: DraftParticipant;
  forcedBy?: DraftParticipant;
  recoveredBy?: DraftParticipant;
  penalizedPlayers: DraftParticipant[];
  others: DraftParticipant[];
};

export type DraftParticipant = {
  participantId: string;
  playerId: string;
  team: TeamCode;
  role: DraftParticipantRole;
  jersey: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  resolution: DraftPlayerResolution;
};

export type DraftParticipantRole =
  | 'rusher'
  | 'passer'
  | 'receiver'
  | 'intendedReceiver'
  | 'sackVictim'
  | 'punter'
  | 'kicker'
  | 'returner'
  | 'holder'
  | 'tackler'
  | 'assistTackler'
  | 'sack'
  | 'passBreakup'
  | 'interceptor'
  | 'fumbler'
  | 'forcedFumble'
  | 'recoverer'
  | 'blocker'
  | 'penalizedPlayer'
  | 'other';

export type DraftPlayerResolution = {
  source: 'singleMatch' | 'duplicateConfirmed' | 'explicitUnknown';
  jerseyToken: string;
  teamScope: TeamCode;
  duplicateCandidateIds?: string[];
  recommendedPlayerId?: string;
  selectedRecommended?: boolean;
  actionContext: 'offense' | 'defense' | 'specialTeams' | 'penalty' | 'gameControl';
};

export type DraftResult = {
  code: DraftResultCode;
  yards?: number;
  endYardLine?: Spot;
  firstDown?: boolean;
  driveEnds?: boolean;
  nextPossession?: TeamCode;
  pass?: DraftPassResult;
  kick?: DraftKickResult;
  return?: DraftReturnResult;
  fumble?: DraftFumbleResult;
  turnover?: DraftTurnoverResult;
  scoring?: DraftScoringResult;
  gameControl?: DraftGameControlResult;
};

export type DraftResultCode =
  | 'tackle'
  | 'touchdown'
  | 'outOfBounds'
  | 'complete'
  | 'incomplete'
  | 'sack'
  | 'interception'
  | 'fumble'
  | 'safety'
  | 'returned'
  | 'fairCatch'
  | 'downed'
  | 'touchback'
  | 'blocked'
  | 'muffed'
  | 'onside'
  | 'made'
  | 'missed'
  | 'failed'
  | 'accepted'
  | 'declined'
  | 'offsetting'
  | 'noPlay';

export type DraftPassResult = {
  outcome?: 'complete' | 'incomplete' | 'interception';
  startYardLine?: Spot;
  terminalYardLine?: Spot;
  interceptionYardLine?: Spot;
  passingYards?: number;
  receivingYards?: number;
  interceptionReturnYards?: number;
  outOfBounds?: boolean;
  targetPlayerId?: string;
  completed?: boolean;
  caughtAtYardLine?: Spot;
  intendedYardLine?: Spot;
  brokenUpByPlayerId?: string;
  hurriedByPlayerIds?: string[];
  completeResultCode?: 'T' | 'O' | 'F' | 'C' | '.';
};

export type DraftKickResult = {
  kickYards?: number;
  catchYardLine?: Spot;
  kickSpot?: Spot;
  attemptYards?: number;
  blockedByPlayerId?: string;
  missedReason?: 'wideRight' | 'wideLeft' | 'short' | 'leftUpright' | 'rightUpright' | 'crossbar';
  receiveResultCode?: 'R' | 'T' | 'C' | 'O' | 'M' | 'D';
};

export type DraftReturnResult = {
  type?: 'Fumble' | 'Interception' | 'Field Goal' | 'Kick' | 'Kickoff' | 'Punt' | 'Try';
  returnerPlayerId?: string;
  returnYards?: number;
  returnStartYardLine?: Spot;
  returnEndYardLine?: Spot;
  resultCode?: 'T' | 'O' | 'F' | 'C' | '.';
  tackledByPlayerIds?: string[];
};

export type DraftFumbleResult = {
  fumblerPlayerId: string;
  forcedByPlayerId?: string;
  spot?: Spot;
  recoveredByPlayerId?: string;
  recoveredByTeam?: TeamCode;
  recoverySpot?: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  turnover?: boolean;
};

export type DraftTurnoverResult = {
  type: 'interception' | 'fumble' | 'downs' | 'muffedKick' | 'blockedKick';
  team: TeamCode;
  playerId?: string;
  spot?: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  recoveredBy?: TeamCode;
};

export type DraftScoringResult = {
  team: TeamCode;
  points: 1 | 2 | 3 | 6;
  type: 'touchdown' | 'fieldGoal' | 'patKick' | 'twoPoint' | 'safety' | 'defensiveConversion';
};

export type DraftGameControlResult = {
  action:
    | 'startQuarter'
    | 'endQuarter'
    | 'setBallContext'
    | 'startDrive'
    | 'setPossession'
    | 'coinToss'
    | 'emergency'
    | 'rosterFunction';
  period?: number;
  clock?: ClockText | null;
  down?: number;
  distance?: number;
  spot?: Spot;
  lineToGain?: Spot;
  possession?: TeamCode;
  driveId?: string;
};

export type DraftPenalty = {
  penaltyId: string;
  team: TeamCode;
  code: string;
  name?: string;
  tableYards?: number;
  requiresYards?: boolean;
  requiresSpot?: boolean;
  defaultEnforcement?: DraftPenaltyEnforcementSpot;
  resolution?: DraftPenaltyStatus;
  yards?: number;
  spot?: Spot;
  playerId?: string | null;
  enforcedFrom?: DraftPenaltyEnforcementSpot;
  spotOfFoul?: Spot;
  finalSpot?: Spot;
  downConsequence?: DraftPenaltyDownConsequence;
  source?: 'immediate' | 'queued';
  status: DraftPenaltyStatus;
  accepted: boolean;
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  replayDown?: boolean;
  liveBall?: boolean;
  safetyByRule?: boolean;
  carryOverToKO?: boolean;
  offsetting?: DraftPenaltyOffsetting;
  notes?: string;
  penalizedPlayerId?: string;
};

export type DraftPenaltyEnforcementSpot =
  | 'PREVIOUS'
  | 'SPOT'
  | 'END'
  | 'TRY'
  | 'FREE_KICK'
  | 'SUCCESSFUL_TD';

export type DraftPenaltyStatus = 'accepted' | 'declined' | 'offsetting' | 'pending';

export type DraftPenaltyOffsetting = {
  previousPlayCounts: boolean;
};

export type DraftPenaltyDownConsequence = 'REPEAT' | 'LOSS_OF_DOWN' | 'AUTO_FIRST';

export type DraftWarning = {
  code: DraftWarningCode;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  field?: string;
  source: 'fcqi' | 'fpsg' | 'eventBuilder';
};

export type DraftWarningCode =
  | 'UNRESOLVED_PLAYER'
  | 'DUPLICATE_PLAYER_CONFIRMED'
  | 'NON_RECOMMENDED_DUPLICATE_PLAYER_SELECTED'
  | 'UNUSUAL_POSITION_FOR_ACTION'
  | 'MISSING_OPTIONAL_DEFENDER'
  | 'MISSING_YARDS'
  | 'MISSING_SPOT'
  | 'INVALID_SPOT'
  | 'PENALTY_PENDING'
  | 'PENALTY_MISSING_YARDS'
  | 'PENALTY_MISSING_SPOT'
  | 'STALE_BASE_SEQUENCE'
  | 'SUMMARY_STALE'
  | 'UNSUPPORTED_PLAY_FAMILY';

export type DraftConfirmation = {
  summaryText: string;
  summaryRevision: number;
  confirmedAt: string;
  confirmedByUserId?: string;
  operatorAction: 'confirmSubmit';
  penaltiesReviewed: boolean;
  warningsAcknowledged: string[];
};

export type FootballDraftIntent = {
  schemaVersion: typeof FOOTBALL_DRAFT_INTENT_SCHEMA_VERSION;
  intentId: string;
  clientEventId: string;
  status: FootballDraftIntentStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;
  game: DraftGameContext;
  source: DraftSourceContext;
  play: DraftPlayContext;
  prePlay: DraftPrePlayContext;
  participants: DraftParticipants;
  result: DraftResult;
  penalties: DraftPenalty[];
  warnings: DraftWarning[];
  confirmation?: DraftConfirmation;
};

export type FootballIntentValidationErrorCode =
  | 'INVALID_SCHEMA_VERSION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_STATUS'
  | 'INVALID_PLAY_FAMILY'
  | 'INVALID_PLAY_SUBTYPE'
  | 'INVALID_RESULT_CODE'
  | 'INVALID_TEAM_CODE'
  | 'INVALID_SPOT'
  | 'INVALID_CLOCK'
  | 'INVALID_SOURCE'
  | 'INVALID_PRE_PLAY_CONTEXT'
  | 'MISSING_REQUIRED_PARTICIPANT'
  | 'INVALID_PARTICIPANT'
  | 'UNRESOLVED_PLAYER'
  | 'MISSING_REQUIRED_RESULT'
  | 'INVALID_RESULT'
  | 'INVALID_PENALTY'
  | 'PENALTY_PENDING'
  | 'MISSING_CONFIRMATION'
  | 'INVALID_CONFIRMATION'
  | 'SUMMARY_STALE'
  | 'BLOCKING_WARNING';

export type FootballIntentValidationError = {
  code: FootballIntentValidationErrorCode;
  message: string;
  field?: string;
};

export type FootballIntentValidationResult =
  | {
      ok: true;
      warnings: DraftWarning[];
    }
  | {
      ok: false;
      errors: FootballIntentValidationError[];
      warnings: DraftWarning[];
    };

const PLAY_FAMILIES = new Set<FootballPlayFamily>([
  'rush',
  'pass',
  'punt',
  'kickoff',
  'fieldGoal',
  'try',
  'penalty',
  'gameControl',
]);

const PLAY_SUBTYPES = new Set<Exclude<FootballPlaySubtype, null>>([
  'complete',
  'incomplete',
  'sack',
  'interception',
  'returned',
  'fairCatch',
  'downed',
  'touchback',
  'outOfBounds',
  'blocked',
  'muffed',
  'onside',
  'made',
  'missed',
  'kick',
  'rush',
  'pass',
  'failed',
  'defensiveReturn',
  'accepted',
  'declined',
  'offsetting',
  'startQuarter',
  'endQuarter',
  'setBallContext',
  'startDrive',
  'setPossession',
  'coinToss',
  'emergency',
  'rosterFunction',
]);

const INTENT_STATUSES = new Set<FootballDraftIntentStatus>([
  'collecting',
  'readyForSummary',
  'summaryGenerated',
  'confirmed',
  'cancelled',
]);

const PARTICIPANT_ROLES = new Set<DraftParticipantRole>([
  'rusher',
  'passer',
  'receiver',
  'intendedReceiver',
  'sackVictim',
  'punter',
  'kicker',
  'returner',
  'holder',
  'tackler',
  'assistTackler',
  'sack',
  'passBreakup',
  'interceptor',
  'fumbler',
  'forcedFumble',
  'recoverer',
  'blocker',
  'penalizedPlayer',
  'other',
]);

const RESOLUTION_SOURCES = new Set<DraftPlayerResolution['source']>([
  'singleMatch',
  'duplicateConfirmed',
  'explicitUnknown',
]);

const ACTION_CONTEXTS = new Set<DraftPlayerResolution['actionContext']>([
  'offense',
  'defense',
  'specialTeams',
  'penalty',
  'gameControl',
]);

const RESULT_CODES = new Set<DraftResultCode>([
  'tackle',
  'touchdown',
  'outOfBounds',
  'complete',
  'incomplete',
  'sack',
  'interception',
  'fumble',
  'safety',
  'returned',
  'fairCatch',
  'downed',
  'touchback',
  'blocked',
  'muffed',
  'onside',
  'made',
  'missed',
  'failed',
  'accepted',
  'declined',
  'offsetting',
  'noPlay',
]);

const PENALTY_ENFORCEMENT_SPOTS = new Set<DraftPenaltyEnforcementSpot>([
  'PREVIOUS',
  'SPOT',
  'END',
  'TRY',
  'FREE_KICK',
  'SUCCESSFUL_TD',
]);

const PENALTY_STATUSES = new Set<DraftPenaltyStatus>(['accepted', 'declined', 'offsetting', 'pending']);

export function validateFootballDraftIntent(input: unknown): FootballIntentValidationResult {
  const errors: FootballIntentValidationError[] = [];
  const intent = isRecord(input) ? input : null;
  const warnings = Array.isArray(intent?.warnings) ? [...(intent.warnings as DraftWarning[])] : [];

  if (!intent) {
    return {
      ok: false,
      errors: [error('MISSING_REQUIRED_FIELD', 'Intent must be an object')],
      warnings,
    };
  }

  validateTopLevel(intent, errors);

  if (isRecord(intent.game)) validateGameContext(intent.game, errors);
  if (isRecord(intent.source)) validateSourceContext(intent.source, errors);
  if (isRecord(intent.play)) validatePlayContext(intent.play, errors);
  if (isRecord(intent.prePlay)) validatePrePlayContext(intent.prePlay, intent.play, errors);
  if (isRecord(intent.participants)) validateParticipants(intent.participants, errors);
  if (isRecord(intent.result)) validateResult(intent.result, errors);
  if (Array.isArray(intent.penalties)) validatePenalties(intent.penalties, intent.play, errors);

  if (isRecord(intent.play) && isRecord(intent.participants) && isRecord(intent.result)) {
    validatePlayFamilyRequirements(intent.play, intent.participants, intent.result, intent.penalties, errors);
  }

  validateWarnings(warnings, intent.status, errors);
  validateConfirmation(intent, errors);

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, warnings };
}

export function validateSchemaVersion(value: unknown): boolean {
  return value === FOOTBALL_DRAFT_INTENT_SCHEMA_VERSION;
}

export function isTeamCode(value: unknown): value is TeamCode {
  return value === 'H' || value === 'V';
}

export function isCanonicalSpot(value: unknown): value is Spot {
  if (value === '50' || value === 'goal') return true;
  if (typeof value !== 'string') return false;
  const match = value.match(/^([HV])(\d{2})$/);
  if (!match) return false;
  const yard = Number(match[2]);
  return yard >= 1 && yard <= 49;
}

function validateTopLevel(intent: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  const requiredFields = [
    'schemaVersion',
    'intentId',
    'clientEventId',
    'status',
    'createdAt',
    'updatedAt',
    'revision',
    'game',
    'source',
    'play',
    'prePlay',
    'participants',
    'result',
    'penalties',
    'warnings',
  ];

  for (const field of requiredFields) {
    if (!(field in intent)) {
      errors.push(error('MISSING_REQUIRED_FIELD', `Missing required field: ${field}`, field));
    }
  }

  if (!validateSchemaVersion(intent.schemaVersion)) {
    errors.push(error('INVALID_SCHEMA_VERSION', 'schemaVersion must be football.draftIntent.v1', 'schemaVersion'));
  }

  for (const field of ['intentId', 'clientEventId', 'createdAt', 'updatedAt']) {
    if (!isNonEmptyString(intent[field])) {
      errors.push(error('MISSING_REQUIRED_FIELD', `${field} must be a non-empty string`, field));
    }
  }

  if (!Number.isInteger(intent.revision) || Number(intent.revision) < 0) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'revision must be a non-negative integer', 'revision'));
  }

  if (!INTENT_STATUSES.has(intent.status as FootballDraftIntentStatus)) {
    errors.push(error('INVALID_STATUS', 'status is not a supported FootballDraftIntent status', 'status'));
  }

  if (!Array.isArray(intent.penalties)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'penalties must be an array', 'penalties'));
  }

  if (!Array.isArray(intent.warnings)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'warnings must be an array', 'warnings'));
  }
}

function validateGameContext(game: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (!isNonEmptyString(game.gameId)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'game.gameId is required', 'game.gameId'));
  }

  if (!isRecord(game.teams)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'game.teams is required', 'game.teams'));
    return;
  }

  for (const team of ['H', 'V'] as const) {
    const summary = game.teams[team];
    if (!isRecord(summary)) {
      errors.push(error('MISSING_REQUIRED_FIELD', `game.teams.${team} is required`, `game.teams.${team}`));
      continue;
    }

    if (summary.team !== team) {
      errors.push(error('INVALID_TEAM_CODE', `game.teams.${team}.team must be ${team}`, `game.teams.${team}.team`));
    }

    if (!isNonEmptyString(summary.abbr)) {
      errors.push(error('MISSING_REQUIRED_FIELD', `game.teams.${team}.abbr is required`, `game.teams.${team}.abbr`));
    }
  }

  if (isRecord(game.rules)) {
    for (const field of ['kickoffSpot', 'touchbackSpot', 'patSpot']) {
      if (game.rules[field] !== undefined && !isCanonicalSpot(game.rules[field])) {
        errors.push(error('INVALID_SPOT', `${field} must use canonical spot format`, `game.rules.${field}`));
      }
    }
  }
}

function validateSourceContext(source: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (source.kind !== 'fcqi') {
    errors.push(error('INVALID_SOURCE', 'source.kind must be fcqi', 'source.kind'));
  }

  if (!['hotkey', 'button', 'programmatic'].includes(String(source.startedBy))) {
    errors.push(error('INVALID_SOURCE', 'source.startedBy is invalid', 'source.startedBy'));
  }

  if (!isNonEmptyString(source.startedAt)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'source.startedAt is required', 'source.startedAt'));
  }

  if (!Number.isInteger(source.baseEventSequence) || Number(source.baseEventSequence) < 0) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'source.baseEventSequence must be a non-negative integer', 'source.baseEventSequence'));
  }
}

function validatePlayContext(play: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (!PLAY_FAMILIES.has(play.family as FootballPlayFamily)) {
    errors.push(error('INVALID_PLAY_FAMILY', 'play.family is not supported', 'play.family'));
  }

  if (play.subtype !== null && play.subtype !== undefined && !PLAY_SUBTYPES.has(play.subtype as Exclude<FootballPlaySubtype, null>)) {
    errors.push(error('INVALID_PLAY_SUBTYPE', 'play.subtype is not supported', 'play.subtype'));
  }

  if (!isTeamCode(play.actionTeam)) {
    errors.push(error('INVALID_TEAM_CODE', 'play.actionTeam must be H or V', 'play.actionTeam'));
  }

  if (play.possession !== null && !isTeamCode(play.possession)) {
    errors.push(error('INVALID_TEAM_CODE', 'play.possession must be H, V, or null', 'play.possession'));
  }

  if (!Number.isInteger(play.period) || Number(play.period) < 0) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'play.period must be a non-negative integer', 'play.period'));
  }

  if (play.clock !== null && play.clock !== undefined && !isValidClock(play.clock)) {
    errors.push(error('INVALID_CLOCK', 'play.clock must use MM:SS format', 'play.clock'));
  }
}

function validatePrePlayContext(
  prePlay: Record<string, unknown>,
  play: unknown,
  errors: FootballIntentValidationError[],
) {
  if (prePlay.possession !== null && !isTeamCode(prePlay.possession)) {
    errors.push(error('INVALID_TEAM_CODE', 'prePlay.possession must be H, V, or null', 'prePlay.possession'));
  }

  for (const field of ['yardLine', 'lineToGain']) {
    if (prePlay[field] !== null && prePlay[field] !== undefined && !isCanonicalSpot(prePlay[field])) {
      errors.push(error('INVALID_SPOT', `prePlay.${field} must use canonical spot format`, `prePlay.${field}`));
    }
  }
  if (prePlay.yardLine === 'goal') {
    errors.push(error('INVALID_SPOT', 'prePlay.yardLine cannot use the line-to-gain sentinel goal', 'prePlay.yardLine'));
  }

  if (!Number.isInteger(prePlay.driveNumber) || Number(prePlay.driveNumber) < 0) {
    errors.push(error('INVALID_PRE_PLAY_CONTEXT', 'prePlay.driveNumber must be a non-negative integer', 'prePlay.driveNumber'));
  }

  const family = isRecord(play) ? play.family : null;
  const isPossessionFree = family === 'kickoff' || family === 'try' || family === 'gameControl';

  if (!isPossessionFree) {
    for (const field of ['possession', 'down', 'distance', 'yardLine', 'lineToGain']) {
      if (prePlay[field] === null || prePlay[field] === undefined) {
        errors.push(error('MISSING_REQUIRED_FIELD', `prePlay.${field} is required for this play family`, `prePlay.${field}`));
      }
    }
  }
}

function validateParticipants(participants: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (!Array.isArray(participants.defenders)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'participants.defenders must be an array', 'participants.defenders'));
  }

  if (!Array.isArray(participants.penalizedPlayers)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'participants.penalizedPlayers must be an array', 'participants.penalizedPlayers'));
  }

  if (!Array.isArray(participants.others)) {
    errors.push(error('MISSING_REQUIRED_FIELD', 'participants.others must be an array', 'participants.others'));
  }

  for (const [field, value] of Object.entries(participants)) {
    if (Array.isArray(value)) {
      value.forEach((participant, index) => validateParticipant(participant, `${field}.${index}`, errors));
    } else if (value !== undefined) {
      validateParticipant(value, field, errors);
    }
  }
}

function validateParticipant(value: unknown, field: string, errors: FootballIntentValidationError[]) {
  if (!isRecord(value)) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field} must be an object`, `participants.${field}`));
    return;
  }

  for (const required of ['participantId', 'playerId', 'team', 'role', 'jersey', 'displayName', 'resolution']) {
    if (!(required in value)) {
      errors.push(error('INVALID_PARTICIPANT', `participants.${field}.${required} is required`, `participants.${field}.${required}`));
    }
  }

  if (!isNonEmptyString(value.participantId)) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.participantId is required`, `participants.${field}.participantId`));
  }

  if (!isNonEmptyString(value.playerId)) {
    errors.push(error('UNRESOLVED_PLAYER', `participants.${field}.playerId is required`, `participants.${field}.playerId`));
  }

  if (!isTeamCode(value.team)) {
    errors.push(error('INVALID_TEAM_CODE', `participants.${field}.team must be H or V`, `participants.${field}.team`));
  }

  if (!PARTICIPANT_ROLES.has(value.role as DraftParticipantRole)) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.role is invalid`, `participants.${field}.role`));
  }

  if (!isNonEmptyString(value.jersey)) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.jersey is required`, `participants.${field}.jersey`));
  }

  if (!isRecord(value.resolution)) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.resolution is required`, `participants.${field}.resolution`));
    return;
  }

  if (!RESOLUTION_SOURCES.has(value.resolution.source as DraftPlayerResolution['source'])) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.resolution.source is invalid`, `participants.${field}.resolution.source`));
  }

  if (value.resolution.source === 'explicitUnknown') {
    errors.push(error('UNRESOLVED_PLAYER', `participants.${field} uses unsupported explicit unknown player resolution`, `participants.${field}.resolution.source`));
  }

  if (!isTeamCode(value.resolution.teamScope)) {
    errors.push(error('INVALID_TEAM_CODE', `participants.${field}.resolution.teamScope must be H or V`, `participants.${field}.resolution.teamScope`));
  }

  if (!ACTION_CONTEXTS.has(value.resolution.actionContext as DraftPlayerResolution['actionContext'])) {
    errors.push(error('INVALID_PARTICIPANT', `participants.${field}.resolution.actionContext is invalid`, `participants.${field}.resolution.actionContext`));
  }
}

function validateResult(result: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (!RESULT_CODES.has(result.code as DraftResultCode)) {
    errors.push(error('INVALID_RESULT_CODE', 'result.code is not supported', 'result.code'));
  }

  if (result.endYardLine !== undefined && !isCanonicalSpot(result.endYardLine)) {
    errors.push(error('INVALID_SPOT', 'result.endYardLine must use canonical spot format', 'result.endYardLine'));
  }

  if (result.nextPossession !== undefined && !isTeamCode(result.nextPossession)) {
    errors.push(error('INVALID_TEAM_CODE', 'result.nextPossession must be H or V', 'result.nextPossession'));
  }

  validateNestedSpot(result.kick, 'result.kick.catchYardLine', 'catchYardLine', errors);
  validateNestedSpot(result.kick, 'result.kick.kickSpot', 'kickSpot', errors);
  validateNestedSpot(result.pass, 'result.pass.caughtAtYardLine', 'caughtAtYardLine', errors);
  validateNestedSpot(result.pass, 'result.pass.intendedYardLine', 'intendedYardLine', errors);
  validateNestedSpot(result.return, 'result.return.returnStartYardLine', 'returnStartYardLine', errors);
  validateNestedSpot(result.return, 'result.return.returnEndYardLine', 'returnEndYardLine', errors);
  validateNestedSpot(result.fumble, 'result.fumble.spot', 'spot', errors);
  validateNestedSpot(result.fumble, 'result.fumble.recoverySpot', 'recoverySpot', errors);
  validateNestedSpot(result.fumble, 'result.fumble.returnEndYardLine', 'returnEndYardLine', errors);
  validateNestedSpot(result.turnover, 'result.turnover.spot', 'spot', errors);
  validateNestedSpot(result.turnover, 'result.turnover.returnEndYardLine', 'returnEndYardLine', errors);
  validateNestedSpot(result.gameControl, 'result.gameControl.spot', 'spot', errors);
  validateNestedSpot(result.gameControl, 'result.gameControl.lineToGain', 'lineToGain', errors);

  if (isRecord(result.fumble) && result.fumble.recoveredByTeam !== undefined && !isTeamCode(result.fumble.recoveredByTeam)) {
    errors.push(error('INVALID_TEAM_CODE', 'result.fumble.recoveredByTeam must be H or V', 'result.fumble.recoveredByTeam'));
  }

  if (isRecord(result.turnover)) {
    if (!['interception', 'fumble', 'downs', 'muffedKick', 'blockedKick'].includes(String(result.turnover.type))) {
      errors.push(error('INVALID_RESULT', 'result.turnover.type is invalid', 'result.turnover.type'));
    }
    if (!isTeamCode(result.turnover.team)) {
      errors.push(error('INVALID_TEAM_CODE', 'result.turnover.team must be H or V', 'result.turnover.team'));
    }
    if (result.turnover.recoveredBy !== undefined && !isTeamCode(result.turnover.recoveredBy)) {
      errors.push(error('INVALID_TEAM_CODE', 'result.turnover.recoveredBy must be H or V', 'result.turnover.recoveredBy'));
    }
  }

  if (isRecord(result.scoring)) {
    if (!isTeamCode(result.scoring.team)) {
      errors.push(error('INVALID_TEAM_CODE', 'result.scoring.team must be H or V', 'result.scoring.team'));
    }
    if (![1, 2, 3, 6].includes(Number(result.scoring.points))) {
      errors.push(error('INVALID_RESULT', 'result.scoring.points must be 1, 2, 3, or 6', 'result.scoring.points'));
    }
  }

  if (isRecord(result.gameControl)) {
    if (![
      'startQuarter',
      'endQuarter',
      'setBallContext',
      'startDrive',
      'setPossession',
      'coinToss',
      'emergency',
      'rosterFunction',
    ].includes(String(result.gameControl.action))) {
      errors.push(error('INVALID_RESULT', 'result.gameControl.action is invalid', 'result.gameControl.action'));
    }
    if (result.gameControl.possession !== undefined && !isTeamCode(result.gameControl.possession)) {
      errors.push(error('INVALID_TEAM_CODE', 'result.gameControl.possession must be H or V', 'result.gameControl.possession'));
    }
  }
}

function validatePenalties(
  penalties: unknown[],
  play: unknown,
  errors: FootballIntentValidationError[],
) {
  penalties.forEach((penalty, index) => {
    const field = `penalties.${index}`;
    if (!isRecord(penalty)) {
      errors.push(error('INVALID_PENALTY', `${field} must be an object`, field));
      return;
    }

    for (const required of ['penaltyId', 'team', 'code', 'status', 'accepted']) {
      if (!(required in penalty)) {
        errors.push(error('INVALID_PENALTY', `${field}.${required} is required`, `${field}.${required}`));
      }
    }

    if (!isNonEmptyString(penalty.penaltyId)) {
      errors.push(error('INVALID_PENALTY', `${field}.penaltyId is required`, `${field}.penaltyId`));
    }

    if (!isTeamCode(penalty.team)) {
      errors.push(error('INVALID_TEAM_CODE', `${field}.team must be H or V`, `${field}.team`));
    }

    if (!isNonEmptyString(penalty.code)) {
      errors.push(error('INVALID_PENALTY', `${field}.code is required`, `${field}.code`));
    }

    if (penalty.enforcedFrom !== undefined && !PENALTY_ENFORCEMENT_SPOTS.has(penalty.enforcedFrom as DraftPenaltyEnforcementSpot)) {
      errors.push(error('INVALID_PENALTY', `${field}.enforcedFrom is invalid`, `${field}.enforcedFrom`));
    }

    if (!PENALTY_STATUSES.has(penalty.status as DraftPenaltyStatus)) {
      errors.push(error('INVALID_PENALTY', `${field}.status is invalid`, `${field}.status`));
    }

    if (penalty.status === 'pending') {
      errors.push(error('PENALTY_PENDING', `${field}.status cannot be pending at confirmation`, `${field}.status`));
    }

    if (typeof penalty.accepted !== 'boolean') {
      errors.push(error('INVALID_PENALTY', `${field}.accepted must be boolean`, `${field}.accepted`));
    } else if ((penalty.status === 'accepted') !== penalty.accepted) {
      errors.push(error('INVALID_PENALTY', `${field}.accepted must mirror accepted status`, `${field}.accepted`));
    }

    if (penalty.spot !== undefined && !isCanonicalSpot(penalty.spot)) {
      errors.push(error('INVALID_SPOT', `${field}.spot must use canonical spot format`, `${field}.spot`));
    }

    if (penalty.spotOfFoul !== undefined && !isCanonicalSpot(penalty.spotOfFoul)) {
      errors.push(error('INVALID_SPOT', `${field}.spotOfFoul must use canonical spot format`, `${field}.spotOfFoul`));
    }

    if (penalty.finalSpot !== undefined && !isCanonicalSpot(penalty.finalSpot)) {
      errors.push(error('INVALID_SPOT', `${field}.finalSpot must use canonical spot format`, `${field}.finalSpot`));
    }

    if (penalty.status === 'accepted') {
      if (penalty.yards !== undefined && (typeof penalty.yards !== 'number' || !Number.isFinite(penalty.yards))) {
        errors.push(error('INVALID_PENALTY', `${field}.yards must be numeric when present`, `${field}.yards`));
      }
      if (!PENALTY_ENFORCEMENT_SPOTS.has(penalty.enforcedFrom as DraftPenaltyEnforcementSpot)) {
        errors.push(error('INVALID_PENALTY', `${field}.enforcedFrom is required for accepted penalties`, `${field}.enforcedFrom`));
      }
      if (!isCanonicalSpot(penalty.finalSpot)) {
        errors.push(error('INVALID_SPOT', `${field}.finalSpot is required for accepted penalties`, `${field}.finalSpot`));
      }
      if (penalty.enforcedFrom === 'SPOT' && !isCanonicalSpot(penalty.spotOfFoul)) {
        errors.push(error('INVALID_SPOT', `${field}.spotOfFoul is required when enforcedFrom is SPOT`, `${field}.spotOfFoul`));
      }
    }

    if (penalty.status === 'offsetting') {
      if (!isRecord(penalty.offsetting) || typeof penalty.offsetting.previousPlayCounts !== 'boolean') {
        errors.push(error('INVALID_PENALTY', `${field}.offsetting.previousPlayCounts is required for offsetting penalties`, `${field}.offsetting.previousPlayCounts`));
      }
    }
  });

  const isPenaltyOnly = isRecord(play) && play.family === 'penalty';
  if (isPenaltyOnly && penalties.length === 0) {
    errors.push(error('MISSING_REQUIRED_RESULT', 'Penalty-only intent requires at least one penalty', 'penalties'));
  }

  const offsettingPenalties = penalties.filter((penalty) => isRecord(penalty) && penalty.status === 'offsetting');
  if (offsettingPenalties.length > 0) {
    const offsettingTeams = new Set(offsettingPenalties.map((penalty) => penalty.team).filter(isTeamCode));
    if (offsettingTeams.size < 2) {
      errors.push(error('INVALID_PENALTY', 'Offsetting penalties require at least one offsetting penalty on each team', 'penalties'));
    }
  }
}

function validatePlayFamilyRequirements(
  play: Record<string, unknown>,
  participants: Record<string, unknown>,
  result: Record<string, unknown>,
  penalties: unknown,
  errors: FootballIntentValidationError[],
) {
  const family = play.family;
  const subtype = play.subtype;

  if (family === 'rush') {
    requireParticipant(participants.primary, 'rusher', 'participants.primary', errors);
    if (result.code !== 'touchdown') requireEndYardLine(result, errors);
  }

  if (family === 'pass') {
    if (subtype === 'sack') {
      requireParticipant(participants.primary, 'sackVictim', 'participants.primary', errors);
      requireDefenderRole(participants, 'sack', errors);
      requireResultCode(result, 'sack', errors);
      requireEndYardLine(result, errors);
    } else {
      requireParticipant(participants.primary, 'passer', 'participants.primary', errors);
    }

    if (subtype === 'complete') {
      requireParticipant(participants.secondary, 'receiver', 'participants.secondary', errors);
      if (result.code !== 'complete' && result.code !== 'outOfBounds') {
        errors.push(error('MISSING_REQUIRED_RESULT', 'Complete pass requires complete or outOfBounds result code', 'result.code'));
      }
      requireEndYardLine(result, errors);
    }

    if (subtype === 'incomplete') {
      requireResultCode(result, 'incomplete', errors);
    }

    if (subtype === 'interception') {
      requireDefenderRole(participants, 'interceptor', errors);
      requireResultCode(result, 'interception', errors);
      if (!isRecord(result.turnover)) {
        errors.push(error('MISSING_REQUIRED_RESULT', 'Interception requires result.turnover', 'result.turnover'));
      }
    }
  }

  if (result.code === 'fumble' || isRecord(result.fumble)) {
    if (!isRecord(result.fumble)) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Fumble result requires result.fumble', 'result.fumble'));
    }
    if (isRecord(result.fumble) && result.fumble.turnover === true && !isRecord(result.turnover)) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Possession-changing fumble requires result.turnover', 'result.turnover'));
    }
  }

  if (family === 'punt') {
    requireParticipant(participants.primary, 'punter', 'participants.primary', errors);
    requireEndYardLine(result, errors);
  }

  if (family === 'kickoff') {
    requireParticipant(participants.primary, 'kicker', 'participants.primary', errors);
    requireEndYardLine(result, errors);
    if (!isTeamCode(result.nextPossession)) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Kickoff requires result.nextPossession', 'result.nextPossession'));
    }
  }

  if (family === 'fieldGoal') {
    requireParticipant(participants.primary, 'kicker', 'participants.primary', errors);
    if (!['made', 'missed', 'blocked', 'returned'].includes(String(subtype)) && !['made', 'missed', 'blocked', 'returned'].includes(String(result.code))) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Field goal requires made, missed, blocked, or returned result', 'result.code'));
    }
    if (!isRecord(result.kick) || typeof result.kick.attemptYards !== 'number') {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Field goal requires result.kick.attemptYards', 'result.kick.attemptYards'));
    }
  }

  if (family === 'try') {
    if (subtype === 'kick') requireParticipant(participants.primary, 'kicker', 'participants.primary', errors);
    if (subtype === 'rush') requireParticipant(participants.primary, 'rusher', 'participants.primary', errors);
    if (subtype === 'pass') {
      requireParticipant(participants.primary, 'passer', 'participants.primary', errors);
      requireParticipant(participants.secondary, 'receiver', 'participants.secondary', errors);
    }
    if (!['failed', 'missed', 'blocked', 'interception', 'fumble', 'incomplete'].includes(String(result.code)) && !isRecord(result.scoring)) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Try requires scoring metadata or failed result', 'result.scoring'));
    }
  }

  if (family === 'penalty') {
    if (!Array.isArray(penalties) || penalties.length === 0) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Penalty-only intent requires at least one penalty', 'penalties'));
    }
    if (!['accepted', 'declined', 'offsetting'].includes(String(result.code))) {
      errors.push(error('MISSING_REQUIRED_RESULT', 'Penalty-only result must be accepted, declined, or offsetting', 'result.code'));
    }
  }
}

function validateWarnings(
  warnings: DraftWarning[],
  status: unknown,
  errors: FootballIntentValidationError[],
) {
  warnings.forEach((warning, index) => {
    if (warning?.severity === 'blocker' && status === 'confirmed') {
      errors.push(error('BLOCKING_WARNING', `Blocking warning prevents confirmation: ${warning.code}`, `warnings.${index}`));
    }
  });
}

function validateConfirmation(intent: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (intent.status !== 'confirmed') return;

  if (!isRecord(intent.confirmation)) {
    errors.push(error('MISSING_CONFIRMATION', 'Confirmed intent requires confirmation metadata', 'confirmation'));
    return;
  }

  const confirmation = intent.confirmation;

  if (!isNonEmptyString(confirmation.summaryText)) {
    errors.push(error('INVALID_CONFIRMATION', 'confirmation.summaryText is required', 'confirmation.summaryText'));
  }

  if (confirmation.summaryRevision !== intent.revision) {
    errors.push(error('SUMMARY_STALE', 'confirmation.summaryRevision must match intent revision', 'confirmation.summaryRevision'));
  }

  if (!isNonEmptyString(confirmation.confirmedAt)) {
    errors.push(error('INVALID_CONFIRMATION', 'confirmation.confirmedAt is required', 'confirmation.confirmedAt'));
  }

  if (confirmation.operatorAction !== 'confirmSubmit') {
    errors.push(error('INVALID_CONFIRMATION', 'confirmation.operatorAction must be confirmSubmit', 'confirmation.operatorAction'));
  }

  if (typeof confirmation.penaltiesReviewed !== 'boolean') {
    errors.push(error('INVALID_CONFIRMATION', 'confirmation.penaltiesReviewed must be boolean', 'confirmation.penaltiesReviewed'));
  }

  if (!Array.isArray(confirmation.warningsAcknowledged)) {
    errors.push(error('INVALID_CONFIRMATION', 'confirmation.warningsAcknowledged must be an array', 'confirmation.warningsAcknowledged'));
  }
}

function requireParticipant(
  value: unknown,
  role: DraftParticipantRole,
  field: string,
  errors: FootballIntentValidationError[],
) {
  if (!isRecord(value)) {
    errors.push(error('MISSING_REQUIRED_PARTICIPANT', `Missing required ${role} participant`, field));
    return;
  }

  if (value.role !== role) {
    errors.push(error('MISSING_REQUIRED_PARTICIPANT', `${field} must have role ${role}`, `${field}.role`));
  }

  if (!isNonEmptyString(value.playerId)) {
    errors.push(error('UNRESOLVED_PLAYER', `${field}.playerId is required`, `${field}.playerId`));
  }
}

function requireDefenderRole(
  participants: Record<string, unknown>,
  role: DraftParticipantRole,
  errors: FootballIntentValidationError[],
) {
  const defenders = Array.isArray(participants.defenders) ? participants.defenders : [];
  if (!defenders.some((defender) => isRecord(defender) && defender.role === role && isNonEmptyString(defender.playerId))) {
    errors.push(error('MISSING_REQUIRED_PARTICIPANT', `Missing required defender role ${role}`, 'participants.defenders'));
  }
}

function requireResultCode(
  result: Record<string, unknown>,
  code: DraftResultCode,
  errors: FootballIntentValidationError[],
) {
  if (result.code !== code) {
    errors.push(error('MISSING_REQUIRED_RESULT', `result.code must be ${code}`, 'result.code'));
  }
}

function requireEndYardLine(result: Record<string, unknown>, errors: FootballIntentValidationError[]) {
  if (!isCanonicalSpot(result.endYardLine)) {
    errors.push(error('MISSING_REQUIRED_RESULT', 'result.endYardLine is required and must be canonical', 'result.endYardLine'));
  }
}

function validateNestedSpot(
  container: unknown,
  field: string,
  key: string,
  errors: FootballIntentValidationError[],
) {
  if (isRecord(container) && container[key] !== undefined && !isCanonicalSpot(container[key])) {
    errors.push(error('INVALID_SPOT', `${field} must use canonical spot format`, field));
  }
}

function error(
  code: FootballIntentValidationErrorCode,
  message: string,
  field?: string,
): FootballIntentValidationError {
  return { code, message, field };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidClock(value: unknown): value is ClockText {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return false;
  const minutes = Number(match[1]);
  return minutes >= 0 && minutes <= 99;
}
