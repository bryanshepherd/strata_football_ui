const singleLetterAlias = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]$/.test(normalized) ? normalized : '';
};

const teamDefaultAlias = (team, fallback) => (
  singleLetterAlias(String(team?.abbr || '').trim().charAt(0))
  || singleLetterAlias(String(team?.name || '').trim().charAt(0))
  || fallback
);

export function footballTeamAliasesForEnvelope(envelope, preferredAliases) {
  const configured = preferredAliases || envelope?.operatorTeamAliases || {};
  let home = singleLetterAlias(configured.H)
    || teamDefaultAlias(envelope?.game?.teams?.H, 'H');
  let visitor = singleLetterAlias(configured.V)
    || teamDefaultAlias(envelope?.game?.teams?.V, 'V');

  if (home === 'V') home = 'H';
  if (visitor === 'H') visitor = 'V';
  if (home === visitor) return { H: 'H', V: 'V' };
  return { H: home, V: visitor };
}

export function normalizeFootballTeamAlias(value) {
  return String(value || '').replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase();
}

export function normalizeFootballTeamAliases(aliases) {
  return { H: normalizeFootballTeamAlias(aliases?.H), V: normalizeFootballTeamAlias(aliases?.V) };
}

export function validateFootballTeamAliases(aliases) {
  const normalized = normalizeFootballTeamAliases(aliases);
  if (!normalized.H || !normalized.V) return { ok: false, message: 'Enter one letter for each team.' };
  if (normalized.H === normalized.V) return { ok: false, message: 'Team abbreviations must be different.' };
  if (normalized.H === 'V' || normalized.V === 'H') return { ok: false, message: 'H and V remain reserved for their canonical Home and Visitor teams.' };
  return { ok: true };
}
