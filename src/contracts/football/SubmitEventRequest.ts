/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/submit-event-request.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

export type DraftScoringEvent = EventProperties & {
  eventId?: never;
  sequence?: never;
  status?: never;
  acceptedAt?: never;
  postState?: never;
  [k: string]: unknown;
};
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
  endYardLine?: string;
  firstDown?: boolean;
  driveEnds?: boolean;
  nextPossession?: 'H' | 'V';
  kickYards?: number;
  returnYards?: number;
  kickedToYardLine?: string;
  attemptYardLine?: string;
  points?: number;
  clock?: string;
  clockTenths?: number;
  isRunning?: boolean;
  period?: number;
  scoring?: Scoring | null;
  turnover?: Turnover | null;
  fumble?: Fumble | null;
  pass?: Pass;
};

export interface SubmitEventRequest {
  schemaVersion: 'football.submitEventRequest.v1';
  gameId: string;
  clientContext: {
    clientEventId: string;
    sessionId?: string;
    userId?: string;
    submittedAt: string;
    baseEnvelopeVersion?: string;
    baseEventSequence: number;
  };
  event: DraftScoringEvent;
}
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
  clock: string;
  possession: ('H' | 'V') | null;
  preState: State;
  participants: Participants;
  result: Result;
  penalties: Penalty[];
  postState?: State;
  description?: string;
  [k: string]: unknown;
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
  team: 'H' | 'V';
  role?: string;
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
  downCounts?: boolean;
  notes?: string;
}
