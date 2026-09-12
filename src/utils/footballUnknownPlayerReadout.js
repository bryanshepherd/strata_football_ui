// Resolve only a placeholder's recorded role and player ID. Preserve all other
// wording and never guess an identity from a jersey number.
export const resolveFootballUnknownPlayerText = (event, text, rosterTeams = {}) => {
  if (!/\bunknown player\b/i.test(text)) return text;
  const players = new Map(Object.values(rosterTeams).flatMap((team) => (
    Object.entries(team?.players || {}).map(([id, player]) => [player.playerId || id, player])
  )));
  const people = event?.participants || {};
  const result = event?.result || {};
  const playerLabel = (candidate) => {
    const actor = typeof candidate === 'string' ? { playerId: candidate } : candidate;
    if (!actor?.playerId || actor.resolution?.source === 'explicitUnknown') return null;
    const player = { ...players.get(actor.playerId), ...actor };
    const name = player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ');
    if (!name || /\bunknown player\b/i.test(name)) return null;
    const jersey = player.jersey ?? player.jerseyNumber;
    return `${jersey !== undefined && jersey !== null && jersey !== '' ? `#${jersey} ` : ''}${name}`;
  };
  const receiver = people.receiver || people.target || people.secondary || result.pass?.targetPlayerId;
  const returner = people.returner || result.return?.returnerPlayerId;
  const recoverer = people.recoveredBy || result.fumble?.recoveredByPlayerId;
  const primary = people.primary || people.kicker || people.punter;
  const soleDefender = (roles) => {
    const matching = (people.defenders || []).filter((player) => roles.includes(player.role));
    return matching.length === 1 ? matching[0] : null;
  };
  return text.replace(/\bunknown player\b/gi, (placeholder, offset) => {
    const before = text.slice(0, offset);
    const after = text.slice(offset + placeholder.length);
    let actor;
    if (/(?:pass complete to|pass incomplete intended for|pass intended for)\s+$/i.test(before)) actor = receiver;
    else if (/(?:fair catch by|returned by|muffed by)\s+$/i.test(before) || /^\s+return\b/i.test(after)) actor = returner;
    else if (/recovered by\s+$/i.test(before)) actor = recoverer;
    else if (/forced by\s+$/i.test(before)) actor = people.forcedBy || result.fumble?.forcedByPlayerId;
    else if (/intercepted by\s+$/i.test(before)) actor = people.interceptor || result.turnover?.playerId;
    else if (/broken up by\s+$/i.test(before)) actor = result.pass?.brokenUpByPlayerId;
    else if (/sacked by\s+$/i.test(before)) actor = soleDefender(['sack', 'tackler', 'assistTackler']);
    else if (/tackled by\s+$/i.test(before)) actor = soleDefender(['tackler', 'assistTackler']);
    else if (/\btwo-point pass from\s+$/i.test(before)) actor = primary;
    else if (/\btwo-point pass from\b.*\bto\s+$/i.test(before)) actor = receiver;
    else if (/(?:Kneel down by|Spike by|two-point rush by)\s+$/i.test(before)) actor = primary;
    else if (/^\s+(?:rush\b|pass\b|sacked\b|punt\b|kickoff\b|extra point\b|\d+[- ]yard field goal\b|fumbled\b)/i.test(after)) actor = primary;
    return playerLabel(actor) || placeholder;
  });
};
