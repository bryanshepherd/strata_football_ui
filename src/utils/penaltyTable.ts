import type { PenaltyDef } from '../types/penalties';
import penaltyTableData from '../data/penaltyTable.json';

let penaltyTable: PenaltyDef[] | null = null;

/**
 * Load the penalty table data
 */
export async function loadPenaltyTable(): Promise<PenaltyDef[]> {
  // In a real app, this might fetch from an API
  // For now, we're using the imported JSON data
  penaltyTable = penaltyTableData as PenaltyDef[];
  return penaltyTable;
}

/**
 * Get a specific penalty definition by code
 */
export function getPenaltyDef(code: string): PenaltyDef | undefined {
  if (!penaltyTable) {
    // Try to load synchronously from import
    penaltyTable = penaltyTableData as PenaltyDef[];
  }
  return penaltyTable?.find(p => p.code === code);
}

/**
 * Check if the penalty table is loaded
 */
export function isPenaltyTableLoaded(): boolean {
  return penaltyTable !== null && penaltyTable.length > 0;
}

/**
 * Get all penalty definitions
 */
export function getAllPenalties(): PenaltyDef[] {
  if (!penaltyTable) {
    penaltyTable = penaltyTableData as PenaltyDef[];
  }
  return penaltyTable || [];
}

/**
 * Initialize penalty table on app start
 */
export function initPenaltyTable(): void {
  if (!penaltyTable) {
    penaltyTable = penaltyTableData as PenaltyDef[];
  }
}