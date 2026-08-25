/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/scoring-event.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

/**
 * A canonical football event. Drafts omit backend acceptance fields; accepted events require backend identity and sequence.
 */
export type ScoringEvent = DraftScoringEvent | AcceptedScoringEvent;
export type DraftScoringEvent = EventProperties & {
  eventId?: never;
  sequence?: never;
  status?: never;
  acceptedAt?: never;
  postState?: never;
  [k: string]: unknown;
};
export type Clock = string;
export type TeamCode = 'H' | 'V';
export type Spot = string;
export type LineToGain = Spot | 'goal' | null;
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
  kickYards?: number;
  returnYards?: number;
  kickedToYardLine?: Spot;
  attemptYardLine?: Spot;
  points?: number;
  clock?: Clock;
  clockTenths?: number;
  isRunning?: boolean;
  period?: number;
  scoring?: Scoring | null;
  turnover?: Turnover | null;
  fumble?: Fumble | null;
  pass?: Pass;
};
export type AcceptedScoringEvent = EventProperties & {
  eventId: string;
  sequence: number;
  status: 'accepted';
  acceptedAt: string;
  [k: string]: unknown;
};

export interface EventProperties {
  eventId?: string;
  clientEventId: string;
  sequence?: number;
  type: 'rush' | 'pass' | 'punt' | 'kickoff' | 'fieldGoal' | 'try' | 'penalty' | 'gameControl';
  subtype?: string | null;
  status?: 'accepted';
  createdAt?: string;
  acceptedAt?: string;
  period: number;
  clock: Clock;
  possession: TeamCode | null;
  preState: State;
  participants: Participants;
  result: Result;
  penalties: Penalty[];
  postState?: State;
  description?: string;
  [k: string]: unknown;
}
export interface State {
  possession: TeamCode | null;
  down: number | null;
  distance: number | null;
  yardLine: Spot | null;
  lineToGain: LineToGain;
  goalToGo?: boolean;
  redZone?: boolean;
  driveId: string | null;
  driveNumber: number;
}
export interface Participants {
  primary: Participant | null;
  secondary: Participant | null;
  defenders: Participant[];
  target?: Participant | null;
  receiver?: Participant | null;
  interceptor?: Participant | null;
}
export interface Participant {
  playerId: string;
  team: TeamCode;
  role?: string;
}
export interface Scoring {
  team: TeamCode;
  points: 1 | 2 | 3 | 6;
  type: 'touchdown' | 'fieldGoal' | 'patKick' | 'twoPointTry' | 'safety' | 'defensiveConversion';
}
export interface Turnover {
  type: 'interception' | 'fumble' | 'downs' | 'muffedKick' | 'blockedKick';
  team: TeamCode;
  playerId?: string;
  spot?: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  recoveredBy?: TeamCode;
}
export interface Fumble {
  fumblerPlayerId: string;
  forcedByPlayerId?: string;
  spot?: Spot;
  recoveredByPlayerId: string;
  recoveredByTeam: TeamCode;
  recoverySpot: Spot;
  returnYards?: number;
  returnEndYardLine?: Spot;
  turnover: boolean;
}
export interface Pass {
  outcome: 'complete' | 'incomplete' | 'interception';
  startYardLine?: Spot;
  catchYardLine?: Spot;
  interceptionYardLine?: Spot;
  terminalYardLine?: Spot;
  passingYards?: number;
  receivingYards?: number;
  interceptionReturnYards?: number;
  outOfBounds?: boolean;
}
export interface Penalty {
  penaltyId: string;
  code: string;
  team: TeamCode;
  playerId?: string | null;
  timing?: 'liveBall' | 'deadBall';
  status: 'accepted' | 'declined' | 'offsetting' | 'pending';
  yards?: number;
  enforcedFrom?: 'previousSpot' | 'spotOfFoul' | 'endOfPlay' | 'trySpot' | 'freeKickSpot' | 'succeedingSpot';
  spotOfFoul?: Spot;
  finalSpot?: Spot;
  automaticFirstDown?: boolean;
  lossOfDown?: boolean;
  replayDown?: boolean;
  downCounts?: boolean;
  notes?: string;
}
