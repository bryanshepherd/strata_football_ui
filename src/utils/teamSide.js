// src/utils/teamSide.js

export function normalizeTeam(team) {
  const t = String(team ?? '').trim().toLowerCase();
  // debug.debug('[teamSide] normalizeTeam:', { input: team, normalized: t });
  if (t === 'home' || t === 'h') return 'home';
  if (t === 'visitor' || t === 'away' || t === 'v') return 'visitor';
  // debug.warn('[teamSide] normalizeTeam returning null for unexpected input:', team);
  return null; // let callers decide how to handle unknowns
}

export function otherTeam(team) {
  const t = normalizeTeam(team);
  if (!t) return null;
  return t === 'home' ? 'visitor' : 'home';
}

/** Returns 'home' | 'visitor' for the current offense, given possession. */
export function offenseKey(possession) {
  const p = normalizeTeam(possession);
  const result = p ?? 'home'; // or throw Error if you prefer strict
  // debug.debug('[teamSide] offenseKey:', { possession, normalized: p, result });
  return result;
}

/** Returns 'home' | 'visitor' for defense, given possession. */
export function defenseKey(possession) {
  const off = offenseKey(possession);
  return off === 'home' ? 'visitor' : 'home';
}

/** For kicks: who is returning (opposite of kicking team). */
export function returnTeamForKick(kickingTeam) {
  const k = normalizeTeam(kickingTeam);
  return k ? otherTeam(k) : null;
}

// Optional: legacy aliases that just delegate to the new names
export const offenseTeam = offenseKey;
export const defenseTeam = defenseKey;