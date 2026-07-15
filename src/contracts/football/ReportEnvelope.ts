/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: contracts/football/report-envelope.schema.json
 * Contract version: football.v1
 * Regenerate with: npm run contracts:generate
 */

export interface ReportEnvelope {
  schemaVersion: 'football.reportEnvelope.v1';
  gameId: string;
  sourceEventSequence: number;
  generatedAt: string;
  summary: {
    status: 'pregame' | 'inProgress' | 'halftime' | 'final' | 'suspended';
    score: TeamPair;
    periods: {
      period: number;
      H: number;
      V: number;
    }[];
  };
  teams: {
    H: TeamStats;
    V: TeamStats;
  };
  players: {
    [k: string]: unknown;
  };
  scoringSummary: {
    [k: string]: unknown;
  }[];
  driveSummary: {
    [k: string]: unknown;
  }[];
}
/**
 * This interface was referenced by `ReportEnvelope`'s JSON-Schema
 * via the `definition` "teamPair".
 */
export interface TeamPair {
  H: number;
  V: number;
}
/**
 * This interface was referenced by `ReportEnvelope`'s JSON-Schema
 * via the `definition` "teamStats".
 */
export interface TeamStats {
  firstDowns: number;
  rushAttempts: number;
  rushYards: number;
  passCompletions: number;
  passAttempts: number;
  passYards: number;
  totalYards: number;
  punts: number;
  penalties: number;
  penaltyYards: number;
  turnovers: number;
}
