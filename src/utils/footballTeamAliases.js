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
