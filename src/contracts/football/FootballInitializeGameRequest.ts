/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/initialize-game-request.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

export interface FootballInitializeGameRequest {
  schemaVersion: 'football.initializeGameRequest.v1';
  game: {
    gameId: string;
    organizationId: string;
    externalGameId?: string;
    scheduledAt?: string | null;
  };
  homeTeam: Team;
  awayTeam: Team;
  rules: Rules;
  rosterSnapshot: {
    H: TeamRoster;
    V: TeamRoster;
    unknownPlayerPolicy: {
      allowUnknown: boolean;
      idPrefix: string;
    };
  };
}
/**
 * This interface was referenced by `FootballInitializeGameRequest`'s JSON-Schema
 * via the `definition` "team".
 */
export interface Team {
  teamId: string;
  name: string;
  abbr: string;
}
/**
 * This interface was referenced by `FootballInitializeGameRequest`'s JSON-Schema
 * via the `definition` "rules".
 */
export interface Rules {
  periods: number;
  minutesPerPeriod: number;
  downs: number;
  yardsToFirstDown: number;
  fieldLength?: number;
  kickoffSpot: string;
  touchbackSpot?: string;
  patSpot?: string;
  overtimeEnabled?: boolean;
}
export interface TeamRoster {
  teamId: string;
  name: string;
  abbr: string;
  players: {
    [k: string]: Player;
  };
  /**
   * Derived active-player candidates keyed by the exact jersey string. Jersey values are not identities; duplicate numbers retain every stable player ID in deterministic order.
   */
  jerseyIndex?: {
    /**
     * @minItems 1
     */
    [k: string]: [string, ...string[]];
  };
}
export interface Player {
  playerId: string;
  team: 'H' | 'V';
  jersey: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  position?: string;
  active: boolean;
}
