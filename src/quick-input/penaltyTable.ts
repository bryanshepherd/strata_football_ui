import penaltyTableData from '../data/penaltyTable.json';

export type FootballPenaltyDefaultEnforcement = 'PREVIOUS' | 'SPOT' | 'END';

export type FootballPenaltyTableEntry = {
  code: string;
  name: string;
  liveBall: boolean;
  yards?: number;
  requiresYards: boolean;
  requiresSpot: boolean;
  defaultEnforcement: FootballPenaltyDefaultEnforcement;
  automaticFirstDown: boolean;
  lossOfDown: boolean;
};

const table = (penaltyTableData as FootballPenaltyTableEntry[]).map((entry) => ({ ...entry }));

export function listFootballPenaltyTable(): FootballPenaltyTableEntry[] {
  return table.map((entry) => ({ ...entry }));
}

export function findFootballPenaltyDefinition(value: string): FootballPenaltyTableEntry | null {
  const normalized = normalizePenaltySearch(value);
  if (!normalized) return null;
  const match = table.find((entry) =>
    normalizePenaltySearch(entry.code) === normalized
    || normalizePenaltySearch(entry.name) === normalized
  );
  return match ? { ...match } : null;
}

export function searchFootballPenaltyTable(value: string, limit = 8): FootballPenaltyTableEntry[] {
  const normalized = normalizePenaltySearch(value);
  const matches = !normalized
    ? table
    : table.filter((entry) =>
      normalizePenaltySearch(entry.code).includes(normalized)
      || normalizePenaltySearch(entry.name).includes(normalized)
    );
  return matches.slice(0, limit).map((entry) => ({ ...entry }));
}

function normalizePenaltySearch(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
