/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/roster-envelope.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

/**
 * This interface was referenced by `RosterEnvelope`'s JSON-Schema
 * via the `definition` "teamCode".
 */
export type TeamCode = 'H' | 'V';

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
/**
 * This interface was referenced by `RosterEnvelope`'s JSON-Schema
 * via the `definition` "player".
 */
export interface Player {
  playerId: string;
  team: TeamCode;
  jersey: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  position?: string;
  active: boolean;
}
