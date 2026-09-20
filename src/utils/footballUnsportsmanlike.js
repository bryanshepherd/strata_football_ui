// Discipline counts follow recorded player fouls, including declined/offsetting
// enforcement. Pending fouls and removed events do not charge a player.
export function isFootballUnsportsmanlike(penalty) {
  const name = String(penalty?.name || '').replace(/[^a-z]/gi, '').toLowerCase();
  const code = String(penalty?.code || '').toUpperCase();
  return name === 'unsportsmanlikeconduct' || ['UC', 'UNS', 'USC'].includes(code);
}

export function footballUnsportsmanlikeKey(team, playerId) {
  return JSON.stringify([team, playerId]);
}

export function chargeFootballUnsportsmanlike(counts, penalty) {
  const playerId = penalty?.playerId || penalty?.penalizedPlayerId;
  if (!playerId || !['H', 'V'].includes(penalty?.team) || !isFootballUnsportsmanlike(penalty)
    || !['accepted', 'declined', 'offsetting'].includes(penalty.status)) return undefined;
  const key = footballUnsportsmanlikeKey(penalty.team, playerId);
  counts[key] = (counts[key] || 0) + 1;
  return counts[key];
}

export function footballUnsportsmanlikeCounts(events = []) {
  const counts = {};
  for (const event of events) {
    if (event.status && event.status !== 'accepted') continue;
    for (const penalty of event.penalties || []) chargeFootballUnsportsmanlike(counts, penalty);
  }
  return counts;
}
