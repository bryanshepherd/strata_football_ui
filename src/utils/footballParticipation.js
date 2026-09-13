import { repairFootballPassDefense } from './footballPassDefense';
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

export function footballParticipationForEnvelope(envelope) {
  const actorIds = new Set();
  const penaltyIds = new Set();
  for (const event of array(envelope?.events)) {
    if (!event || (event.status && event.status !== 'accepted')) continue;
    collectActorIds(event.participants, actorIds, true);
    collectActorIds(event.result, actorIds);
    collectActorIds(event.penalties, penaltyIds);
    collectActorIds(repairFootballPassDefense(envelope, event).participants, actorIds, true);
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
