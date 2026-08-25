import type { PenaltyDef } from '../types/penalties';
import {
  findFootballPenaltyDefinition,
  listFootballPenaltyTable,
} from '../quick-input/penaltyTable';

let penaltyTable: PenaltyDef[] | null = null;

/**
 * Compatibility adapter for the legacy penalty modal. The confirmed quick
 * input path can use name-only catalog entries while their official codes are
 * pending; this modal continues to expose only entries that have a code.
 */
export async function loadPenaltyTable(): Promise<PenaltyDef[]> {
  penaltyTable = buildCodedPenaltyTable();
  return penaltyTable;
}

export function getPenaltyDef(code: string): PenaltyDef | undefined {
  const definition = findFootballPenaltyDefinition(code);
  return definition?.code ? toPenaltyDef(definition) : undefined;
}

export function isPenaltyTableLoaded(): boolean {
  return penaltyTable !== null && penaltyTable.length > 0;
}

export function getAllPenalties(): PenaltyDef[] {
  if (!penaltyTable) penaltyTable = buildCodedPenaltyTable();
  return penaltyTable;
}

export function initPenaltyTable(): void {
  if (!penaltyTable) penaltyTable = buildCodedPenaltyTable();
}

function buildCodedPenaltyTable(): PenaltyDef[] {
  const byCode = new Map<string, PenaltyDef>();
  listFootballPenaltyTable().forEach((entry) => {
    if (entry.code && !byCode.has(entry.code)) byCode.set(entry.code, toPenaltyDef(entry));
  });
  return [...byCode.values()];
}

function toPenaltyDef(entry: ReturnType<typeof listFootballPenaltyTable>[number]): PenaltyDef {
  return {
    code: entry.code,
    name: entry.name,
    liveBall: entry.liveBall,
    ...(entry.yards === undefined ? {} : { yards: entry.yards }),
    requiresYards: entry.requiresYards,
    requiresSpot: entry.requiresSpot,
    defaultEnforcement: entry.defaultEnforcement,
    automaticFirstDown: entry.automaticFirstDown,
    lossOfDown: entry.lossOfDown,
  };
}
