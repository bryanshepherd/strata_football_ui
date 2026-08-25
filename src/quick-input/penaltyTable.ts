import penaltyCatalogData from '../data/penaltyTable.json';
import legacyPenaltyTableData from '../data/legacyPenaltyTable.json';

export const FOOTBALL_PENALTY_TABLE_STORAGE_KEY = 'strata.football.penalty-codes.v1';

export type FootballPenaltyRuleset = 'NFHS' | 'NCAA';
export type FootballPenaltyTeamRole = 'offense' | 'defense' | 'both';
export type FootballPenaltyDefaultEnforcement = 'PREVIOUS' | 'SPOT' | 'END';
export type FootballPenaltyDown = 'repeat' | 'loss' | 'auto';
export type FootballPenaltyEnforcement = 'previous' | 'spot' | 'succeeding';

export type FootballPenaltyCatalogRule = {
  yards: number;
  down: FootballPenaltyDown;
  enforcement: FootballPenaltyEnforcement;
  eject: boolean;
};

export type FootballPenaltyCatalogEntry = {
  code: string;
  name: string;
  team: FootballPenaltyTeamRole;
  NFHS?: FootballPenaltyCatalogRule;
  NCAA?: FootballPenaltyCatalogRule;
};

export type FootballPenaltyTableEntry = {
  lookupKey: string;
  code: string;
  name: string;
  team: FootballPenaltyTeamRole;
  ruleset?: FootballPenaltyRuleset;
  aliases?: string[];
  liveBall: boolean;
  deadBall: boolean;
  autoEjection: boolean;
  ejectionable: boolean;
  yards?: number;
  requiresYards: boolean;
  requiresSpot: boolean;
  defaultEnforcement: FootballPenaltyDefaultEnforcement;
  automaticFirstDown: boolean;
  lossOfDown: boolean;
};

export type FootballPenaltyTableInput = Partial<FootballPenaltyTableEntry> & Pick<FootballPenaltyTableEntry, 'code' | 'name'>;

type PenaltyTableOptions = {
  ruleset?: FootballPenaltyRuleset;
  teamRole?: Exclude<FootballPenaltyTeamRole, 'both'>;
};

type StoredPenaltyTable = {
  entries: FootballPenaltyTableEntry[];
  replacedCodes: string[];
  replacedLookupKeys: string[];
};

const catalog = penaltyCatalogData as { penalties: FootballPenaltyCatalogEntry[] };
const legacySeedTable = (legacyPenaltyTableData as unknown as Array<Partial<FootballPenaltyTableEntry> & {
  code: string;
  name: string;
}>).map(normalizePenaltyEntry);

let storedTable = readStoredPenaltyTable();

export function listFootballPenaltyCatalog(): FootballPenaltyCatalogEntry[] {
  return catalog.penalties.map((entry) => ({
    ...entry,
    ...(entry.NFHS ? { NFHS: { ...entry.NFHS } } : {}),
    ...(entry.NCAA ? { NCAA: { ...entry.NCAA } } : {}),
  }));
}

export function listFootballPenaltyTable(
  options: PenaltyTableOptions | FootballPenaltyRuleset = {},
): FootballPenaltyTableEntry[] {
  const normalizedOptions = normalizeOptions(options);
  return mergePenaltyTable(seedTableForRuleset(normalizedOptions.ruleset), storedTable)
    .map(clonePenaltyEntry);
}

export function findFootballPenaltyDefinition(
  value: string,
  options: PenaltyTableOptions | FootballPenaltyRuleset = {},
): FootballPenaltyTableEntry | null {
  const trimmed = value.trim();
  const normalized = normalizePenaltySearch(trimmed);
  if (!normalized) return null;
  const normalizedOptions = normalizeOptions(options);
  const matches = listFootballPenaltyTable(normalizedOptions).filter((entry) => (
    entry.lookupKey === trimmed
    || normalizePenaltySearch(entry.code) === normalized
    || penaltyNameMatches(entry, normalized)
  ));
  const match = bestRoleMatch(matches, normalizedOptions.teamRole);
  return match ? clonePenaltyEntry(match) : null;
}

export function searchFootballPenaltyTable(
  value: string,
  limit = 8,
  options: PenaltyTableOptions | FootballPenaltyRuleset = {},
): FootballPenaltyTableEntry[] {
  const normalized = normalizePenaltySearch(value);
  const normalizedOptions = normalizeOptions(options);
  const matches = listFootballPenaltyTable(normalizedOptions).filter((entry) => (
    !normalized
    || normalizePenaltySearch(entry.code).includes(normalized)
    || normalizePenaltySearch(entry.name).includes(normalized)
    || entry.aliases?.some((alias) => normalizePenaltySearch(alias).includes(normalized))
  ));
  return matches.slice(0, limit).map(clonePenaltyEntry);
}

export function resolveFootballPenaltyDefinitionForTeam(
  definition: FootballPenaltyTableEntry | undefined,
  {
    penaltyTeam,
    possession,
    ruleset = 'NCAA',
  }: {
    penaltyTeam?: 'H' | 'V';
    possession?: 'H' | 'V' | null;
    ruleset?: FootballPenaltyRuleset;
  },
): FootballPenaltyTableEntry | undefined {
  if (!definition || !penaltyTeam || !possession) return definition;
  if (!definition.lookupKey.startsWith('catalog:')) return definition;
  const teamRole: Exclude<FootballPenaltyTeamRole, 'both'> = penaltyTeam === possession
    ? 'offense'
    : 'defense';
  const roleMatch = findFootballPenaltyDefinition(definition.name, { ruleset, teamRole });
  if (!roleMatch || (roleMatch.team !== teamRole && roleMatch.team !== 'both')) return definition;
  return roleMatch;
}

export function footballPenaltyRulesetFromRules(
  rules: { penaltyRuleset?: unknown; ruleset?: unknown } | null | undefined,
): FootballPenaltyRuleset {
  const value = String(rules?.penaltyRuleset ?? rules?.ruleset ?? '').trim().toUpperCase();
  return value === 'NFHS' ? 'NFHS' : 'NCAA';
}

export function saveFootballPenaltyDefinition(
  entry: FootballPenaltyTableInput,
  {
    previousCode,
    previousLookupKey,
  }: { previousCode?: string; previousLookupKey?: string } = {},
): FootballPenaltyTableEntry {
  const normalized = normalizePenaltyEntry(entry);
  const priorCode = String(previousCode || normalized.code).trim().toUpperCase();
  const priorLookupKey = String(previousLookupKey || '').trim();
  const entries = storedTable.entries.filter((candidate) => (
    candidate.code !== priorCode && candidate.code !== normalized.code
  ));
  const replacedCodes = new Set(storedTable.replacedCodes);
  const replacedLookupKeys = new Set(storedTable.replacedLookupKeys);
  if (priorCode) replacedCodes.add(priorCode);
  replacedCodes.delete(normalized.code);
  if (seedTableForRuleset('NCAA').some((candidate) => candidate.code === normalized.code)) {
    replacedCodes.add(normalized.code);
  }
  if (priorLookupKey.startsWith('catalog:')) {
    const catalogIndex = priorLookupKey.split(':').at(-1);
    if (catalogIndex) {
      replacedLookupKeys.add(`catalog:NCAA:${catalogIndex}`);
      replacedLookupKeys.add(`catalog:NFHS:${catalogIndex}`);
    }
  }
  storedTable = {
    entries: [...entries, normalized],
    replacedCodes: [...replacedCodes],
    replacedLookupKeys: [...replacedLookupKeys],
  };
  writeStoredPenaltyTable(storedTable);
  return clonePenaltyEntry(normalized);
}

export function resetFootballPenaltyTableForTests(): void {
  storedTable = { entries: [], replacedCodes: [], replacedLookupKeys: [] };
  if (typeof window !== 'undefined') window.localStorage.removeItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY);
}

function seedTableForRuleset(ruleset: FootballPenaltyRuleset): FootballPenaltyTableEntry[] {
  return catalog.penalties.flatMap((entry, index) => {
    const rule = entry[ruleset];
    if (!rule) return [];
    const legacy = findLegacyEntry(entry.name);
    const code = String(entry.code || legacy?.code || '').trim().toUpperCase();
    return [{
      lookupKey: `catalog:${ruleset}:${index}`,
      code,
      name: entry.name,
      team: entry.team,
      ruleset,
      aliases: legacy && normalizePenaltySearch(legacy.name) !== normalizePenaltySearch(entry.name)
        ? [legacy.name]
        : undefined,
      liveBall: legacy?.liveBall ?? true,
      deadBall: legacy?.deadBall ?? false,
      autoEjection: Boolean(rule.eject),
      ejectionable: Boolean(rule.eject),
      yards: Number(rule.yards),
      requiresYards: false,
      requiresSpot: rule.enforcement === 'spot',
      defaultEnforcement: enforcementForCatalogRule(rule.enforcement),
      automaticFirstDown: rule.down === 'auto',
      lossOfDown: rule.down === 'loss',
    }];
  });
}

function findLegacyEntry(name: string): FootballPenaltyTableEntry | undefined {
  const normalized = normalizePenaltySearch(name);
  return legacySeedTable.find((entry) => {
    const candidate = normalizePenaltySearch(entry.name);
    return candidate === normalized
      || (normalized === 'OFFSIDES' && candidate === 'OFFSIDE');
  });
}

function enforcementForCatalogRule(enforcement: FootballPenaltyEnforcement): FootballPenaltyDefaultEnforcement {
  if (enforcement === 'spot') return 'SPOT';
  if (enforcement === 'succeeding') return 'END';
  return 'PREVIOUS';
}

function normalizePenaltyEntry(
  entry: Partial<FootballPenaltyTableEntry> & { code?: string; name?: string },
): FootballPenaltyTableEntry {
  const code = String(entry.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = String(entry.name || '').trim();
  if (!code) throw new Error('Penalty code is required.');
  if (!name) throw new Error('Penalty name is required.');
  const yards = entry.yards === undefined || entry.yards === null
    ? undefined
    : Number(entry.yards);
  const liveBall = Boolean(entry.liveBall);
  const deadBall = entry.deadBall === undefined ? !liveBall : Boolean(entry.deadBall);
  if (yards !== undefined && (!Number.isFinite(yards) || yards < 0)) {
    throw new Error('Penalty yards must be a non-negative number.');
  }
  if (!liveBall && !deadBall) {
    throw new Error('Choose Live-Ball Penalty, Dead-Ball Penalty, or both.');
  }
  return {
    lookupKey: String(entry.lookupKey || `custom:${code}`),
    code,
    name,
    team: ['offense', 'defense', 'both'].includes(String(entry.team))
      ? entry.team as FootballPenaltyTeamRole
      : 'both',
    ...(entry.ruleset === 'NFHS' || entry.ruleset === 'NCAA' ? { ruleset: entry.ruleset } : {}),
    ...(entry.aliases?.length ? { aliases: [...entry.aliases] } : {}),
    liveBall,
    deadBall,
    autoEjection: Boolean(entry.autoEjection ?? entry.ejectionable),
    ejectionable: Boolean(entry.ejectionable ?? entry.autoEjection),
    ...(yards === undefined ? {} : { yards }),
    requiresYards: Boolean(entry.requiresYards),
    requiresSpot: Boolean(entry.requiresSpot),
    defaultEnforcement: ['PREVIOUS', 'SPOT', 'END'].includes(String(entry.defaultEnforcement))
      ? entry.defaultEnforcement as FootballPenaltyDefaultEnforcement
      : 'PREVIOUS',
    automaticFirstDown: Boolean(entry.automaticFirstDown),
    lossOfDown: Boolean(entry.lossOfDown),
  };
}

function mergePenaltyTable(
  seeds: FootballPenaltyTableEntry[],
  stored: StoredPenaltyTable,
): FootballPenaltyTableEntry[] {
  const replacedCodes = new Set(stored.replacedCodes);
  const replacedLookupKeys = new Set(stored.replacedLookupKeys);
  const merged = seeds
    .filter((entry) => !replacedLookupKeys.has(entry.lookupKey))
    .filter((entry) => !entry.code || !replacedCodes.has(entry.code))
    .map(clonePenaltyEntry);
  stored.entries.forEach((entry) => {
    const index = merged.findIndex((candidate) => candidate.code && candidate.code === entry.code);
    if (index >= 0) merged[index] = clonePenaltyEntry(entry);
    else merged.push(clonePenaltyEntry(entry));
  });
  return merged.sort((left, right) => (
    left.name.localeCompare(right.name)
    || left.team.localeCompare(right.team)
    || left.lookupKey.localeCompare(right.lookupKey)
  ));
}

function readStoredPenaltyTable(): StoredPenaltyTable {
  if (typeof window === 'undefined') return { entries: [], replacedCodes: [], replacedLookupKeys: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY) || 'null');
    return {
      entries: Array.isArray(parsed?.entries)
        ? parsed.entries.map((entry: FootballPenaltyTableEntry) => normalizePenaltyEntry(entry))
        : [],
      replacedCodes: Array.isArray(parsed?.replacedCodes)
        ? parsed.replacedCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean)
        : [],
      replacedLookupKeys: Array.isArray(parsed?.replacedLookupKeys)
        ? parsed.replacedLookupKeys.map((key: unknown) => String(key).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return { entries: [], replacedCodes: [], replacedLookupKeys: [] };
  }
}

function writeStoredPenaltyTable(stored: StoredPenaltyTable): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOOTBALL_PENALTY_TABLE_STORAGE_KEY, JSON.stringify(stored));
}

function normalizeOptions(
  options: PenaltyTableOptions | FootballPenaltyRuleset,
): Required<Pick<PenaltyTableOptions, 'ruleset'>> & Pick<PenaltyTableOptions, 'teamRole'> {
  if (typeof options === 'string') return { ruleset: options };
  return { ruleset: options.ruleset ?? 'NCAA', ...(options.teamRole ? { teamRole: options.teamRole } : {}) };
}

function bestRoleMatch(
  entries: FootballPenaltyTableEntry[],
  teamRole?: Exclude<FootballPenaltyTeamRole, 'both'>,
): FootballPenaltyTableEntry | undefined {
  if (!teamRole) return entries[0];
  return entries.find((entry) => entry.team === teamRole)
    ?? entries.find((entry) => entry.team === 'both')
    ?? entries[0];
}

function penaltyNameMatches(entry: FootballPenaltyTableEntry, normalizedSearch: string): boolean {
  return normalizePenaltySearch(entry.name) === normalizedSearch
    || Boolean(entry.aliases?.some((alias) => normalizePenaltySearch(alias) === normalizedSearch));
}

function clonePenaltyEntry(entry: FootballPenaltyTableEntry): FootballPenaltyTableEntry {
  return { ...entry, ...(entry.aliases ? { aliases: [...entry.aliases] } : {}) };
}

function normalizePenaltySearch(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
