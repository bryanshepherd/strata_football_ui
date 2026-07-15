/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/football-draft-intent.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

/**
 * Canonical FCQI draft intent passed to FPSG and the Football Event Builder. It is never an accepted scoring event.
 */
export type FootballDraftIntent = {
  [k: string]: unknown;
} & {
  schemaVersion: 'football.draftIntent.v1';
  intentId: string;
  clientEventId: string;
  status: 'collecting' | 'readyForSummary' | 'summaryGenerated' | 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  revision: number;
  game: Game;
  source: Source;
  play: Play;
  prePlay: State;
  participants: Participants;
  result: Result;
  penalties: Penalty[];
  warnings: Warning[];
  confirmation?: Confirmation;
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "teamCode".
 */
export type TeamCode = 'H' | 'V';
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "result".
 */
export type Result = {
  [k: string]: unknown;
} & {
  code:
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
    | 'successful'
    | 'accepted'
    | 'declined'
    | 'offsetting'
    | 'noPlay'
    | 'clockUpdate'
    | 'periodUpdate';
  yards?: number;
  endYardLine?: Spot;
  firstDown?: boolean;
  driveEnds?: boolean;
  nextPossession?: TeamCode;
  scoring?: Scoring;
  turnover?: Turnover;
  fumble?: Fumble;
  pass?: Pass;
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "spot".
 */
export type Spot = string;

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "game".
 */
export interface Game {
  gameId: string;
  homeTeamId?: string;
  visitorTeamId?: string;
  teams: {
    H: TeamSummary;
    V: TeamSummary;
  };
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "teamSummary".
 */
export interface TeamSummary {
  team: TeamCode;
  teamId?: string;
  name?: string;
  abbr: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "source".
 */
export interface Source {
  kind: 'fcqi';
  startedBy: 'hotkey' | 'button' | 'programmatic';
  hotkey?: string;
  startedAt: string;
  baseEnvelopeVersion?: string;
  baseEventSequence: number;
  sessionId?: string;
  userId?: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "play".
 */
export interface Play {
  family: 'rush' | 'pass' | 'punt' | 'kickoff' | 'fieldGoal' | 'try' | 'penalty' | 'gameControl';
  subtype: string | null;
  actionTeam: TeamCode;
  possession: TeamCode | null;
  period: number;
  clock: string | null;
  clockTenths?: number | null;
}
export interface State {
  possession: ('H' | 'V') | null;
  down: number | null;
  distance: number | null;
  yardLine: string | null;
  lineToGain: string | 'goal' | null;
  goalToGo?: boolean;
  redZone?: boolean;
  driveId: string | null;
  driveNumber: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "participants".
 */
export interface Participants {
  primary?: Participant;
  secondary?: Participant;
  defenders: Participant[];
  target?: Participant;
  receiver?: Participant;
  interceptor?: Participant;
  returner?: Participant;
  kicker?: Participant;
  punter?: Participant;
  holder?: Participant;
  fumbler?: Participant;
  forcedBy?: Participant;
  recoveredBy?: Participant;
  penalizedPlayers: Participant[];
  others: Participant[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "participant".
 */
export interface Participant {
  participantId: string;
  playerId: string;
  team: TeamCode;
  role:
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
  jersey: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  resolution: Resolution;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "resolution".
 */
export interface Resolution {
  source: 'singleMatch' | 'duplicateConfirmed' | 'explicitUnknown';
  jerseyToken: string;
  teamScope: TeamCode;
  duplicateCandidateIds?: string[];
  recommendedPlayerId?: string;
  selectedRecommended?: boolean;
  actionContext: 'offense' | 'defense' | 'specialTeams' | 'penalty' | 'gameControl';
}
export interface Scoring {
  team: 'H' | 'V';
  points: 1 | 2 | 3 | 6;
  type: 'touchdown' | 'fieldGoal' | 'patKick' | 'twoPointTry' | 'safety' | 'defensiveConversion';
}
export interface Turnover {
  type: 'interception' | 'fumble' | 'downs' | 'muffedKick' | 'blockedKick';
  team: 'H' | 'V';
  playerId?: string;
  spot?: string;
  returnYards?: number;
  returnEndYardLine?: string;
  recoveredBy?: 'H' | 'V';
}
export interface Fumble {
  fumblerPlayerId: string;
  forcedByPlayerId?: string;
  spot?: string;
  recoveredByPlayerId: string;
  recoveredByTeam: 'H' | 'V';
  recoverySpot: string;
  returnYards?: number;
  returnEndYardLine?: string;
  turnover: boolean;
}
export interface Pass {
  outcome: 'complete' | 'incomplete' | 'interception';
  startYardLine?: string;
  catchYardLine?: string;
  interceptionYardLine?: string;
  terminalYardLine?: string;
  passingYards?: number;
  receivingYards?: number;
  interceptionReturnYards?: number;
  outOfBounds?: boolean;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "penalty".
 */
export interface Penalty {
  penaltyId: string;
  code: string;
  team: 'H' | 'V';
  playerId?: string | null;
  timing?: 'liveBall' | 'deadBall';
  status: 'accepted' | 'declined' | 'offsetting' | 'pending';
  yards?: number;
  enforcedFrom?: 'previousSpot' | 'spotOfFoul' | 'endOfPlay' | 'trySpot' | 'freeKickSpot' | 'succeedingSpot';
  spotOfFoul?: string;
  finalSpot?: string;
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  replayDown?: boolean;
  notes?: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "warning".
 */
export interface Warning {
  code: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  field?: string;
  source: 'fcqi' | 'fpsg' | 'eventBuilder';
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "confirmation".
 */
export interface Confirmation {
  summaryText: string;
  summaryRevision: number;
  confirmedAt: string;
  confirmedByUserId?: string;
  operatorAction: 'confirmSubmit';
  penaltiesReviewed: boolean;
  warningsAcknowledged: string[];
}
