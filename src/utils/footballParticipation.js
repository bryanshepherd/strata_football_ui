const SIDES = ['H', 'V'];
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const identity = (value) => typeof value === 'string' ? value : value?.playerId;
const STAT_METADATA = new Set(['playerId', 'team', 'jersey', 'jerseyNumber', 'number', 'sourceEventSequence', 'updatedAt', 'gp', 'gs', 'gamesPlayed', 'gamesStarted', 'played', 'active']);

export function hasFootballPlayerStats(value) {
  return Object.entries(record(value)).some(([key, stat]) => {
    if (STAT_METADATA.has(key)) return false;
    if (stat && typeof stat === 'object') return hasFootballPlayerStats(stat);
    return (typeof stat === 'number' || (typeof stat === 'string' && stat.trim() !== ''))
      && Number.isFinite(Number(stat)) && Number(stat) !== 0;
  });
}

function collectActorIds(value, ids, participant = false) {
  if (Array.isArray(value)) { value.forEach((item) => collectActorIds(item, ids, participant)); return; }
  if (participant && typeof value === 'string') { ids.add(value); return; }
  for (const [key, item] of Object.entries(record(value))) {
    if (key === 'playerId' || /PlayerIds?$/.test(key)) {
      for (const id of Array.isArray(item) ? item : [item]) if (typeof id === 'string') ids.add(id);
    } else if (item && typeof item === 'object') collectActorIds(item, ids, participant);
  }
}

// Some older defensive plays identify a hurry/breakup actor only in the readout.
function collectLegacyDefenders(envelope, event, ids) {
  const offense = event.possession || event.preState?.possession || event.participants?.primary?.team;
  const team = ['punt', 'kickoff'].includes(event.type) ? offense : offense === 'H' ? 'V' : 'H';
  const players = Object.entries(record(envelope.rosters?.teams?.[team]?.players));
  const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const marker of ['broken up by ', 'hurried by ']) {
    const description = String(event.description || '');
    const start = description.toLowerCase().indexOf(marker);
    if (start < 0) continue;
    const clause = description.slice(start + marker.length).split(/,\s*PENALTY\b/i)[0];
    for (const match of clause.matchAll(/#([A-Za-z0-9-]+)\s+(.+?)(?=(?:\s+and\s+|\s*,\s*)#[A-Za-z0-9-]+|\.\s*$|$)/g)) {
      const candidates = players.filter(([, player]) => String(player.jersey ?? '') === match[1]);
      const named = candidates.filter(([, player]) => [player.displayName, `${player.firstName || ''} ${player.lastName || ''}`, `${player.lastName || ''} ${player.firstName || ''}`].some((name) => normalize(name) === normalize(match[2])));
      const selected = named.length === 1 ? named[0] : candidates.length === 1 ? candidates[0] : null;
      if (selected) ids.add(selected[0]);
    }
  }
}

export function footballParticipationForEnvelope(envelope) {
  const actorIds = new Set();
  const penaltyIds = new Set();
  for (const event of array(envelope?.events)) {
    if (!event || (event.status && event.status !== 'accepted')) continue;
    collectActorIds(event.participants, actorIds, true);
    collectActorIds(event.result, actorIds);
    collectActorIds(event.penalties, penaltyIds);
    collectLegacyDefenders(envelope, event, actorIds);
  }
  return Object.fromEntries(SIDES.map((team) => {
    const starters = new Set(Object.values(record(envelope?.pregame?.starters))
      .flatMap((group) => array(group?.[team]).map(identity)).filter(Boolean));
    const manual = new Set(array(envelope?.participation?.manualPlayed?.[team]));
    return [team, Object.fromEntries(Object.entries(record(envelope?.rosters?.teams?.[team]?.players)).map(([playerId, player]) => {
      const reasons = [];
      if (starters.has(playerId)) reasons.push('Starter');
      if (actorIds.has(playerId)) reasons.push('Play actor');
      if (penaltyIds.has(playerId)) reasons.push('Penalty actor');
      if (hasFootballPlayerStats(envelope?.stats?.players?.[playerId])) reasons.push('Has stats');
      return [playerId, { playerId, team, active: player.active !== false, played: reasons.length > 0 || manual.has(playerId), locked: reasons.length > 0, reasons }];
    }))];
  }));
}

export function applyFootballParticipation(envelope, selections, now = new Date().toISOString()) {
  const participation = footballParticipationForEnvelope(envelope);
  const manualPlayed = Object.fromEntries(SIDES.map((team) => {
    const requested = new Set(array(selections?.[team]));
    const previous = new Set(array(envelope.participation?.manualPlayed?.[team]));
    return [team, Object.values(participation[team])
      .filter((player) => player.locked || !player.active ? previous.has(player.playerId) : requested.has(player.playerId))
      .map((player) => player.playerId)];
  }));
  return { ...envelope, updatedAt: now, participation: { schemaVersion: 'football.participation.v1', manualPlayed, updatedAt: now } };
}
