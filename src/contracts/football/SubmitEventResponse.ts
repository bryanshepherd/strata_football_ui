/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/submit-event-response.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

export type SubmitEventResponse = {
  [k: string]: unknown;
} & {
  schemaVersion: 'football.submitEventResponse.v1';
  success: boolean;
  status: 'accepted' | 'duplicateAccepted' | 'rejected';
  acceptedEvent: AcceptedScoringEvent | null;
  gameEnvelope: GameEnvelope;
  warnings: Message[];
  errors: Error[];
};
export type AcceptedScoringEvent = EventProperties & {
  eventId: string;
  sequence: number;
  status: 'accepted';
  acceptedAt: string;
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
  notes?: string;
}
/**
 * The backend-owned authoritative football game state.
 */
export interface GameEnvelope {
  schemaVersion: 'football.gameEnvelope.v1';
  gameId: string;
  updatedAt: string;
  game: Game;
  clock: GameClock;
  liveState: LiveState;
  rosters: RosterEnvelope;
  events: AcceptedScoringEvent[];
  drives: Drives;
  stats: Stats;
  locks: Locks;
  pregame?: Pregame;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "game".
 */
export interface Game {
  status: 'pregame' | 'inProgress' | 'halftime' | 'final' | 'suspended';
  period: number;
  periodType: 'quarter' | 'overtime' | 'try';
  scheduledAt?: string;
  venue?: {
    name?: string;
    city?: string;
    state?: string;
  };
  teams: {
    H: Team;
    V: Team;
  };
  rules: Rules;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "team".
 */
export interface Team {
  teamId: string;
  name: string;
  abbr: string;
  score: number;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "rules".
 */
export interface Rules {
  periods: number;
  minutesPerPeriod: number;
  downs: number;
  yardsToFirstDown: number;
  fieldLength?: number;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "spot".
   */
  kickoffSpot?: string;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "spot".
   */
  touchbackSpot?: string;
  nonKickTouchbackSpot?: string;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "spot".
   */
  patSpot?: string;
  safetyKickSpot?: string;
  overtimeEnabled?: boolean;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "gameClock".
 */
export interface GameClock {
  period: number;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "clockText".
   */
  clock: string;
  clockTenths?: number;
  isRunning: boolean;
  playClock: number | null;
  lastStartedAt: string | null;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "liveState".
 */
export interface LiveState {
  possession: ('H' | 'V') | null;
  down: number | null;
  distance: number | null;
  yardLine: string | null;
  lineToGain: string | 'goal' | null;
  goalToGo: boolean;
  redZone: boolean;
  driveId: string | null;
  driveNumber: number;
  nextPlayContext?: string;
  pendingTryTeam?: 'H' | 'V';
  kickoffTeam?: 'H' | 'V';
}
export interface RosterEnvelope {
  schemaVersion: 'football.rosterEnvelope.v1';
  gameId: string;
  updatedAt: string;
  teams: {
    H: TeamRoster;
    V: TeamRoster;
  };
  unknownPlayerPolicy: {
    allowUnknown: boolean;
    idPrefix: string;
  };
}
/**
 * This interface was referenced by `RosterEnvelope`'s JSON-Schema
 * via the `definition` "teamRoster".
 */
export interface TeamRoster {
  teamId: string;
  name: string;
  abbr: string;
  players: {
    [k: string]: Player;
  };
  jerseyIndex: {
    [k: string]: string;
  };
}
/**
 * This interface was referenced by `RosterEnvelope`'s JSON-Schema
 * via the `definition` "player".
 */
export interface Player {
  playerId: string;
  /**
   * This interface was referenced by `RosterEnvelope`'s JSON-Schema
   * via the `definition` "teamCode".
   */
  team: 'H' | 'V';
  jersey: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  position?: string;
  active: boolean;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "drives".
 */
export interface Drives {
  current: Drive | null;
  completed: Drive[];
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "drive".
 */
export interface Drive {
  driveId: string;
  driveNumber: number;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "teamCode".
   */
  team: 'H' | 'V';
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "spot".
   */
  startYardLine: string;
  /**
   * This interface was referenced by `GameEnvelope`'s JSON-Schema
   * via the `definition` "clockText".
   */
  startClock?: string;
  startReason?: string;
  plays: number;
  yards: number;
  result?: string | null;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "stats".
 */
export interface Stats {
  sourceEventSequence: number;
  teams: {
    [k: string]: unknown;
  };
  players: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "locks".
 */
export interface Locks {
  activeScorerSessionId: string | null;
  lockedByUserId: string | null;
  lockedAt: string | null;
  expiresAt: string | null;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "pregame".
 */
export interface Pregame {
  gamePhase: 'pregame' | 'awaitingKickoff' | 'live' | 'halftime' | 'final';
  coinToss: CoinToss;
  starters: {
    offense: StarterTeams;
    defense: StarterTeams;
    specialTeams: StarterTeams;
  };
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "coinToss".
 */
export interface CoinToss {
  status: 'notStarted' | 'inProgress' | 'complete';
  captains: CaptainTeams;
  winnerTeam: ('H' | 'V') | null;
  loserTeam: ('H' | 'V') | null;
  winnerInitialChoice: ('kick' | 'receive' | 'side' | 'defer') | null;
  loserChoice: ('kick' | 'receive' | 'side') | null;
  winnerSecondaryChoice: ('kick' | 'receive' | 'side') | null;
  direction: ('north' | 'south' | 'east' | 'west') | null;
  directionChoiceTeam: ('H' | 'V') | null;
  firstHalfKickingTeam: ('H' | 'V') | null;
  firstHalfReceivingTeam: ('H' | 'V') | null;
  secondHalfChoiceTeam: ('H' | 'V') | null;
  completedAt: string | null;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "captainTeams".
 */
export interface CaptainTeams {
  H: Captain[];
  V: Captain[];
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "captain".
 */
export interface Captain {
  playerId: string;
  jerseyNumber: string;
}
/**
 * This interface was referenced by `GameEnvelope`'s JSON-Schema
 * via the `definition` "starterTeams".
 */
export interface StarterTeams {
  H: string[];
  V: string[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "message".
 */
export interface Message {
  code: string;
  message: string;
  field?: string | null;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "error".
 */
export interface Error {
  code: string;
  message: string;
  field: string | null;
}
