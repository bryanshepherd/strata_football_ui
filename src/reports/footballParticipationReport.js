import { footballParticipationForEnvelope } from '../utils/footballParticipation';
import { formatFootballReportDate } from './footballScoringSummary';

const array = (value) => Array.isArray(value) ? value : [];
const starterId = (value) => typeof value === 'string' ? value : value?.playerId;
const nameFor = (player) => player.displayName
  || [player.firstName, player.lastName].filter(Boolean).join(' ')
  || 'Unlisted player';
const positionFor = (player, unit) => String(
  (unit === 'offense' ? player.off_position : player.def_position)
  || player.position || player.pos || '',
).trim().toUpperCase();

export const buildFootballParticipationReport = (envelope) => {
  const teams = envelope?.game?.teams;
  if (!teams?.V || !teams?.H) {
    throw new Error('A football game envelope is required for Participation.');
  }
  const participation = footballParticipationForEnvelope(envelope);
  const teamReports = Object.fromEntries(['V', 'H'].map((team) => {
    const roster = envelope.rosters?.teams?.[team]?.players || {};
    const identity = (playerId, fallback = {}) => {
      const player = roster[playerId] || fallback;
      return {
        playerId,
        name: nameFor(player),
        jersey: String(player.jersey ?? player.jerseyNumber ?? player.number ?? ''),
      };
    };
    const displayedStarters = new Set();
    const starters = Object.fromEntries(['offense', 'defense'].map((unit) => {
      const seen = new Set();
      const rows = array(envelope.pregame?.starters?.[unit]?.[team]).flatMap((entry) => {
        const playerId = starterId(entry);
        if (!playerId || seen.has(playerId)) return [];
        seen.add(playerId);
        displayedStarters.add(playerId);
        const fallback = typeof entry === 'object' ? entry : {};
        return [{ ...identity(playerId, fallback), position: positionFor(roster[playerId] || fallback, unit) }];
      });
      return [unit, rows];
    }));
    const others = Object.values(participation[team])
      .filter((player) => player.played && !displayedStarters.has(player.playerId))
      .map((player) => identity(player.playerId))
      .sort((left, right) => (
        Number(!left.jersey) - Number(!right.jersey)
        || left.jersey.localeCompare(right.jersey, undefined, { numeric: true })
        || left.name.localeCompare(right.name)
        || left.playerId.localeCompare(right.playerId)
      ));
    return [team, { starters, others, total: displayedStarters.size + others.length }];
  }));
  return {
    gameId: envelope.gameId,
    reportTitle: 'Participation',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    teamReports,
  };
};
