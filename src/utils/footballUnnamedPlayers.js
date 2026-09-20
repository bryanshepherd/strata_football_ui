export const footballRosterPlayerName = (player) => [player?.displayName, player?.name, [player?.firstName || player?.FirstName, player?.lastName || player?.LastName].filter(Boolean).join(' ')]
  .map(value => String(value || '').trim()).find(Boolean) || '';

export const footballUnnamedPlayers = (envelope) => ['V', 'H'].flatMap(team => (
  Object.values(envelope?.rosters?.teams?.[team]?.players || {})
    .filter(player => /^\d+$/.test(String(player.jersey ?? '').trim()) && !footballRosterPlayerName(player))
    .sort((a, b) => Number(a.jersey) - Number(b.jersey))
    .map(player => ({ ...player, team }))
));

export function addFootballRosterPlayers(envelope, additions) {
  const teams = { ...envelope.rosters.teams };
  for (const player of additions) {
    const team = player.team;
    if (!['H', 'V'].includes(team) || !player.playerId || !/^\d+$/.test(String(player.jersey ?? ''))) throw new Error('Invalid roster player.');
    const roster = teams[team];
    const players = { ...roster.players, [player.playerId]: { ...player, ...roster.players[player.playerId], active: true } };
    const jerseyIndex = {};
    for (const entry of Object.values(players)) {
      if (entry.active === false) continue;
      const jersey = String(entry.jersey ?? '').trim();
      if (jersey) (jerseyIndex[jersey] ||= []).push(entry.playerId);
    }
    teams[team] = { ...roster, players, jerseyIndex };
  }
  return { ...envelope, rosters: { ...envelope.rosters, teams, updatedAt: new Date().toISOString() } };
}
