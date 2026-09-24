import { hasAcceptedDpiSpotPenalty, repairDpiSpotDrivePlayCounts } from '../utils/footballPenaltyStatistics';
import { projectFootballStatsForEvents, repairFootballStatsFromCompleteEventLog } from '../services/footballDashboardService';
import { footballSpotFoulStatisticalYards } from '../utils/footballStatisticalYardage';

// Older mirrors can retain totals computed from the final enforcement spot.
// Refresh affected yardage and legacy first-down totals with a complete play log.
// This is a report projection; it does not save or rewrite any recorded event.
export const withFootballReportYardage = (envelope) => {
  const events = [...(envelope?.events || [])]
    .filter(event => !event.status || event.status === 'accepted')
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));
  if (!events.length || events.some((event, index) => Number(event.sequence) !== index + 1)) return envelope;
  if (events.some(hasAcceptedDpiSpotPenalty)) {
    envelope = repairDpiSpotDrivePlayCounts({ ...envelope, stats: repairFootballStatsFromCompleteEventLog(envelope) });
  }
  const legacyFirstDownTeams = new Set(events.filter(event => (
    event.result?.firstDown === true
    && event.result?.officialOutcome?.source !== 'penaltyEnforcement'
    && (event.penalties || []).some(penalty => penalty.status === 'accepted' && penalty.automaticFirstDown)
  )).map(event => event.possession).filter(team => ['H', 'V'].includes(team)));
  let projected;
  if (legacyFirstDownTeams.size) {
    projected = projectFootballStatsForEvents(envelope);
    const teams = { ...(envelope.stats?.teams || {}) };
    for (const team of legacyFirstDownTeams) {
      teams[team] = { ...teams[team], firstDowns: projected.teams?.[team]?.firstDowns || 0 };
    }
    envelope = { ...envelope, stats: { ...(envelope.stats || {}), teams } };
  }
  const affected = events.filter(event => footballSpotFoulStatisticalYards(event, envelope?.game?.rules?.fieldLength || 100) !== null);
  if (!affected.length) return envelope;
  projected ||= projectFootballStatsForEvents(envelope);
  const teams = { ...(envelope.stats?.teams || {}) };
  const players = { ...(envelope.stats?.players || {}) };
  const seen = new Set();
  for (const event of affected) {
    const passing = event.type === 'pass' && (event.result?.pass?.outcome || event.subtype) === 'complete';
    const rushing = event.type === 'rush' || (event.result?.pass?.outcome || event.subtype) === 'sack';
    if (!passing && !rushing) continue;
    const team = event.possession;
    const key = `${team}:${passing ? 'pass' : 'rush'}`;
    if (!seen.has(key)) {
      seen.add(key);
      const source = teams[team] || {};
      const fresh = projected.teams?.[team] || {};
      const oldYards = Number(passing ? source.pass?.yds : source.rushYards) || 0;
      const yards = Number(passing ? fresh.pass?.yds : fresh.rushYards) || 0;
      teams[team] = {
        ...source,
        ...(passing ? { pass: { ...(source.pass || {}), yds: yards } } : { rushYards: yards }),
        yards: (Number(source.yards) || 0) + yards - oldYards,
      };
    }
    const primary = event.participants?.primary?.playerId;
    const receiver = (event.participants?.receiver || event.participants?.secondary || event.participants?.target)?.playerId;
    for (const [id, field] of [[primary, passing ? 'passYards' : 'rushYards'], ...(passing ? [[receiver, 'receivingYards']] : [])]) {
      if (!id || event.result?.teamCharged || !projected.players?.[id]) continue;
      players[id] = { ...(players[id] || {}), [field]: projected.players[id][field] || 0 };
    }
  }
  return { ...envelope, stats: { ...(envelope.stats || {}), teams, players } };
};
