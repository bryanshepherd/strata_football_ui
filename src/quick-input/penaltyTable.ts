import penaltyTableData from '../data/penaltyTable.json';

export const FOOTBALL_PENALTY_TABLE_STORAGE_KEY = 'strata.football.penalty-codes.v1';

export type FootballPenaltyDefaultEnforcement = 'PREVIOUS' | 'SPOT' | 'END';

export type FootballPenaltyTableEntry = {
  code: string;
  name: string;
  liveBall: boolean;
  deadBall: boolean;
  ejectionable: boolean;
  yards?: number;
  requiresYards: boolean;
  requiresSpot: boolean;
  defaultEnforcement: FootballPenaltyDefaultEnforcement;
  automaticFirstDown: boolean;
  lossOfDown: boolean;
};

const seedTable = (penaltyTableData as unknown as FootballPenaltyTableEntry[]).map(normalizePenaltyEntry);

type StoredPenaltyTable = {
  entries: FootballPenaltyTableEntry[];
  replacedCodes: string[];
};

let storedTable = readStoredPenaltyTable();
let table = mergePenaltyTable(seedTable, storedTable);

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

export function saveFootballPenaltyDefinition(
  entry: FootballPenaltyTableEntry,
  { previousCode }: { previousCode?: string } = {},
): FootballPenaltyTableEntry {
  const normalized = normalizePenaltyEntry(entry);
  const priorCode = String(previousCode || normalized.code).trim().toUpperCase();
  const entries = storedTable.entries.filter((candidate) => (
    candidate.code !== priorCode && candidate.code !== normalized.code
  ));
  const replacedCodes = new Set(storedTable.replacedCodes);
  replacedCodes.add(priorCode);
  replacedCodes.delete(normalized.code);
  if (seedTable.some((candidate) => candidate.code === normalized.code)) replacedCodes.add(normalized.code);
  storedTable = {
    entries: [...entries, normalized],
    replacedCodes: [...replacedCodes],
  };
  table = mergePenaltyTable(seedTable, storedTable);
  writeStoredPenaltyTable(storedTable);
  return { ...normalized };
}

export function resetFootballPenaltyTableForTests(): void {
  storedTable = { entries: [], replacedCodes: [] };
  table = seedTable.map((entry) => ({ ...entry }));
  if (typeof window !== 'undefined') window.localStorage.removeItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY);
}

function normalizePenaltyEntry(entry: FootballPenaltyTableEntry): FootballPenaltyTableEntry {
  const code = String(entry.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = String(entry.name || '').trim();
  if (!code) throw new Error('Penalty code is required.');
  if (!name) throw new Error('Penalty name is required.');
  const yards = entry.yards === undefined || entry.yards === null
    ? undefined
    : Number(entry.yards);
  const liveBall = Boolean(entry.liveBall);
  // Older saved definitions represented dead-ball fouls as liveBall: false.
  // Preserve that meaning while allowing new definitions to support both.
  const deadBall = entry.deadBall === undefined ? !liveBall : Boolean(entry.deadBall);
  if (yards !== undefined && (!Number.isFinite(yards) || yards < 0)) {
    throw new Error('Penalty yards must be a non-negative number.');
  }
  if (!liveBall && !deadBall) {
    throw new Error('Choose Live-Ball Penalty, Dead-Ball Penalty, or both.');
  }
  return {
    code,
    name,
    liveBall,
    deadBall,
    ejectionable: Boolean(entry.ejectionable),
    ...(yards === undefined ? {} : { yards }),
    requiresYards: Boolean(entry.requiresYards),
    requiresSpot: Boolean(entry.requiresSpot),
    defaultEnforcement: ['PREVIOUS', 'SPOT', 'END'].includes(entry.defaultEnforcement)
      ? entry.defaultEnforcement
      : 'PREVIOUS',
    automaticFirstDown: Boolean(entry.automaticFirstDown),
    lossOfDown: Boolean(entry.lossOfDown),
  };
}

function mergePenaltyTable(
  seeds: FootballPenaltyTableEntry[],
  stored: StoredPenaltyTable,
): FootballPenaltyTableEntry[] {
  const replaced = new Set(stored.replacedCodes);
  const merged = seeds.filter((entry) => !replaced.has(entry.code)).map((entry) => ({ ...entry }));
  stored.entries.forEach((entry) => {
    const index = merged.findIndex((candidate) => candidate.code === entry.code);
    if (index >= 0) merged[index] = { ...entry };
    else merged.push({ ...entry });
  });
  return merged.sort((left, right) => left.name.localeCompare(right.name));
}

function readStoredPenaltyTable(): StoredPenaltyTable {
  if (typeof window === 'undefined') return { entries: [], replacedCodes: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY) || 'null');
    return {
      entries: Array.isArray(parsed?.entries)
        ? parsed.entries.map((entry: FootballPenaltyTableEntry) => normalizePenaltyEntry(entry))
        : [],
      replacedCodes: Array.isArray(parsed?.replacedCodes)
        ? parsed.replacedCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean)
        : [],
    };
  } catch {
    return { entries: [], replacedCodes: [] };
  }
}

function writeStoredPenaltyTable(stored: StoredPenaltyTable): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY, JSON.stringify(stored));
}

function normalizePenaltySearch(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
