import { buildFootballDefensivePlayerStats } from './footballMaxPrepsExport';
import { formatFootballReportDate } from './footballScoringSummary';

const STAT_KEYS = [
  'solo', 'assists', 'total', 'sacks', 'sackYards', 'tfl', 'tflYards',
  'forcedFumbles', 'recoveries', 'recoveryYards', 'interceptions',
  'interceptionYards', 'breakups', 'blocks', 'hurries',
];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export const formatDefensiveStat = (value) => String(Number(number(value).toFixed(2)));
export const formatDefensiveStatYards = (count, yards) => (
  `${formatDefensiveStat(count)}-${formatDefensiveStat(yards)}`
);

export const buildFootballDefensiveStatsReport = (envelope) => {
  const teams = envelope?.game?.teams;
  if (!teams?.V || !teams?.H) {
    throw new Error('A football game envelope is required for Defensive Stats.');
  }
  const players = buildFootballDefensivePlayerStats(envelope).map(({ values, ...identity }) => ({
    ...identity,
    solo: number(values.Tackles),
    assists: number(values.Assists),
    total: number(values.TotalTackles),
    sacks: number(values.Sacks),
    sackYards: number(values.SacksYardsLost),
    tfl: number(values.TacklesForLoss),
    tflYards: number(values.TacklesForLossYards),
    forcedFumbles: number(values.CausedFumbles),
    recoveries: number(values.FumbleRecoveries),
    recoveryYards: number(values.FumbleRecoveryYards),
    interceptions: number(values.INTs),
    interceptionYards: number(values.INTYards),
    breakups: number(values.PassesDefensed),
    blocks: number(values.BlockedPunts) + number(values.BlockedFG) + number(values.BlockedPAT),
    hurries: number(values.QBHurries),
  })).filter((player) => STAT_KEYS.some((key) => player[key] !== 0));

  return {
    gameId: envelope.gameId,
    reportTitle: 'Defensive Stats',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    teamReports: Object.fromEntries(['V', 'H'].map((team) => {
      const rows = players.filter((player) => player.team === team).sort((left, right) => (
        right.total - left.total || right.solo - left.solo
        || left.jersey.localeCompare(right.jersey, undefined, { numeric: true })
        || left.name.localeCompare(right.name)
      ));
      return [team, {
        players: rows,
        totals: Object.fromEntries(STAT_KEYS.map((key) => [
          key, rows.reduce((sum, player) => sum + player[key], 0),
        ])),
      }];
    })),
  };
};
