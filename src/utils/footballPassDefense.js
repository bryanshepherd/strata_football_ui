const role = (player) => String(player?.role || '').toLowerCase();
export const isFootballHurryDefender = (player) => ['hurry', 'qbhurry'].includes(role(player));
export const isFootballBreakupDefender = (player) => ['passbreakup', 'breakup'].includes(role(player));
const nameKey = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The old canonical pass builder kept these credits in the description only.
// Recover an identity only when the defending roster's jersey AND name agree.
const legacyActors = (envelope, event, marker, actorRole, requireAll = false) => {
  const offense = event.possession || event.preState?.possession || event.participants?.primary?.team;
  if (!['H', 'V'].includes(offense)) return [];
  const team = offense === 'H' ? 'V' : 'H';
  const players = Object.entries(envelope?.rosters?.teams?.[team]?.players || {});
  const description = String(event.description || '');
  const start = description.toLowerCase().indexOf(marker);
  if (start < 0) return [];
  const clause = description.slice(start + marker.length).split(/,\s*(?:broken up by|hurried by|PENALTY)\b/i)[0];
  // Partial recovery would turn a shared tackle into a solo tackle.
  if (requireAll && !clause.trim().startsWith('#')) return [];
  const actors = new Map();
  for (const match of clause.matchAll(/#([A-Za-z0-9-]+)\s+(.+?)(?=(?:\s+and\s+|\s*,\s*)#[A-Za-z0-9-]+|\.\s*$|$)/g)) {
    const candidates = players.filter(([, player]) => String(player.jersey ?? '') === match[1]
      && [player.displayName, `${player.firstName || ''} ${player.lastName || ''}`, `${player.lastName || ''} ${player.firstName || ''}`]
        .some((name) => nameKey(name) && nameKey(name) === nameKey(match[2])));
    if (candidates.length === 1) {
      const [playerId] = candidates[0];
      actors.set(playerId, { playerId, team, role: actorRole });
    } else if (requireAll) return [];
  }
  return [...actors.values()];
};

export function repairFootballPassDefense(envelope, event) {
  const outcome = event?.result?.pass?.outcome || event?.subtype || event?.result?.code
    || (/\bpass incomplete\b/i.test(event?.description || '') ? 'incomplete' : null);
  if (event?.type !== 'pass' || (event.status && event.status !== 'accepted')
    || !['complete', 'incomplete'].includes(outcome)) return event;
  const pass = event.result?.pass || {};
  const defenders = event.participants?.defenders || [];
  if (outcome === 'complete') {
    // New submissions and editor saves explicitly own even an empty list.
    if (event.result?.passDefenseRecorded === true || defenders.length) return event;
    const actors = legacyActors(envelope, event, 'tackled by ', 'tackler', true);
    if (!actors.length) return event;
    return {
      ...event,
      participants: { ...event.participants, defenders: actors },
      result: { ...event.result, passDefenseRecorded: true },
    };
  }
  const additions = [];
  const fields = {};
  for (const [field, matches, marker, actorRole, multiple] of [
    ['brokenUpByPlayerId', isFootballBreakupDefender, 'broken up by ', 'passBreakup', false],
    ['hurriedByPlayerIds', isFootballHurryDefender, 'hurried by ', 'hurry', true],
  ]) {
    // An explicit empty value is an operator's removal, not missing data.
    if (Object.hasOwn(pass, field)) continue;
    const recorded = defenders.filter(matches);
    const actors = recorded.length ? recorded : legacyActors(envelope, event, marker, actorRole);
    const ids = [...new Set(actors.map((actor) => actor.playerId).filter(Boolean))];
    if (!ids.length || (!multiple && ids.length !== 1)) continue;
    fields[field] = multiple ? ids : ids[0];
    if (!recorded.length) additions.push(...actors);
  }
  if (!Object.keys(fields).length) return event;
  return {
    ...event,
    participants: { ...event.participants, defenders: [...defenders, ...additions] },
    result: { ...event.result, pass: { ...pass, ...fields } },
  };
}
