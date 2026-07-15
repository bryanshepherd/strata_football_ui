import React from 'react';

const TEAM_STAT_ROWS = [
  { label: '1st Downs', formatter: (stats) => formatInteger(stats.firstDowns) },
  { label: 'Rushing', formatter: (stats) => `${formatInteger(stats.rushAtt)} for ${formatInteger(stats.rushYds)} yards` },
  { label: 'Passing', formatter: (stats) => `${formatInteger(stats.passComp)} for ${formatInteger(stats.passAtt)}, ${formatInteger(stats.passInt)} INT` },
  { label: 'Passing Yards', formatter: (stats) => formatInteger(stats.passYds) },
  { label: 'Plays', formatter: (stats) => `${formatInteger(stats.totalPlays)} for ${formatInteger(stats.totalYds)} yards` },
  { label: 'Avg/play', formatter: (stats) => formatDecimal(stats.avgPerPlay) },
  { label: 'Kick Returns', formatter: (stats) => `${formatInteger(stats.kickReturnCount)} for ${formatInteger(stats.kickReturnYds)} yards` },
  { label: 'Punt Returns', formatter: (stats) => `${formatInteger(stats.puntReturnCount)} for ${formatInteger(stats.puntReturnYds)} yards` },
  { label: 'Int. Returns', formatter: (stats) => `${formatInteger(stats.intReturnCount)} for ${formatInteger(stats.intReturnYds)} yards` },
  { label: 'Fumble Returns', formatter: (stats) => `${formatInteger(stats.fumbleReturnCount)} for ${formatInteger(stats.fumbleReturnYds)} yards` },
  { label: 'Fumbles', formatter: (stats) => `${formatInteger(stats.fumbles)}-${formatInteger(stats.fumblesLost)} lost` },
  { label: 'Penalties', formatter: (stats) => `${formatInteger(stats.penalties)} for ${formatInteger(stats.penaltyYds)} yards` },
  { label: 'Punts', formatter: (stats) => `${formatInteger(stats.punts)} for ${formatDecimal(stats.puntAverage)} yards` },
  { label: 'Time of Possession', formatter: (stats) => formatPossessionTime(stats.timeOfPossession) },
  { label: '3rd Downs', formatter: (stats) => `${formatInteger(stats.thirdDownConversions)} for ${formatInteger(stats.thirdDownAttempts)}` },
  { label: '4th Downs', formatter: (stats) => `${formatInteger(stats.fourthDownConversions)} for ${formatInteger(stats.fourthDownAttempts)}` },
];

export default function FootballTeamStats({ envelope }) {
  const visitorStats = buildTeamStats(envelope, 'V');
  const homeStats = buildTeamStats(envelope, 'H');

  return (
    <section
      aria-label="Team Stats"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-zinc-300 bg-white"
    >
      <div className="shrink-0 border-b border-zinc-200 px-3 py-2">
        <h2 className="text-sm font-bold text-zinc-950">Team Stats</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full table-fixed text-[10px] leading-tight">
          <thead className="sticky top-0 bg-zinc-50 text-[9px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-[31%] px-2 py-1 text-left font-bold">VIS</th>
              <th className="w-[38%] px-1 py-1 text-center font-bold">Stat</th>
              <th className="w-[31%] px-2 py-1 text-right font-bold">HOME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {TEAM_STAT_ROWS.map(({ label, formatter }) => (
              <tr key={label}>
                <td className="px-2 py-1 text-left font-semibold tabular-nums text-zinc-900">
                  {formatter(visitorStats)}
                </td>
                <th className="px-1 py-1 text-center font-medium text-zinc-500">
                  {label}
                </th>
                <td className="px-2 py-1 text-right font-semibold tabular-nums text-zinc-900">
                  {formatter(homeStats)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function buildTeamStats(envelope, teamCode) {
  const source = resolveTeamStatsSource(envelope, teamCode);
  const rushAtt = readNumber(source, ['rushAttempts', 'rush.att', 'rushing.att', 'rushAtt', 'RushPlays', 'rushing_attempts']);
  const rushYds = readNumber(source, ['rushYards', 'rush.yds', 'rushing.yds', 'rushYds', 'RushYards', 'rushing_yards']);
  const passComp = readNumber(source, ['pass.cmp', 'passing.cmp', 'passComp', 'PassComp', 'completions']);
  const passAtt = readNumber(source, ['pass.att', 'passing.att', 'passAtt', 'PassAtt', 'attempts']);
  const passYds = readNumber(source, ['pass.yds', 'passing.yds', 'passYds', 'PassYards', 'passing_yards']);
  const totalPlays = readNumber(source, ['plays', 'totalPlays', 'total_plays', 'TotalPlays']);
  const totalYds = readNumber(source, ['yards', 'totalYds', 'total_yards', 'TotalYards']);
  const providedAvg = readOptionalNumber(source, ['avgPerPlay', 'avg_play', 'yardsPerPlay', 'YardsPerPlay']);

  return {
    firstDowns: readNumber(source, ['first_downs', 'firstDowns', 'FirstDowns']),
    rushAtt,
    rushYds,
    passComp,
    passAtt,
    passInt: readNumber(source, ['pass.int', 'passing.int', 'passInt', 'Interceptions', 'interceptions']),
    passYds,
    totalPlays,
    totalYds,
    avgPerPlay: providedAvg ?? (totalPlays > 0 ? totalYds / totalPlays : 0),
    kickReturnCount: readNumber(source, ['kick_returns.num', 'kickReturns.num', 'kickReturns.count', 'kickReturnCount']),
    kickReturnYds: readNumber(source, ['kick_returns.yds', 'kickReturns.yds', 'kickReturnYds']),
    puntReturnCount: readNumber(source, ['punt_returns.num', 'puntReturns.num', 'puntReturns.count', 'puntReturnCount']),
    puntReturnYds: readNumber(source, ['punt_returns.yds', 'puntReturns.yds', 'puntReturnYds']),
    intReturnCount: readNumber(source, ['int_returns.num', 'intReturns.num', 'intReturns.count', 'intReturnCount']),
    intReturnYds: readNumber(source, ['int_returns.yds', 'intReturns.yds', 'intReturnYds']),
    fumbleReturnCount: readNumber(source, ['fumble_returns.num', 'fumbleReturns.num', 'fumbleReturns.count', 'fumbleReturnCount']),
    fumbleReturnYds: readNumber(source, ['fumble_returns.yds', 'fumbleReturns.yds', 'fumbleReturnYds']),
    fumbles: readNumber(source, ['fumbles.num', 'fumbles.count', 'fumbles']),
    fumblesLost: readNumber(source, ['fumbles.lost', 'fumblesLost']),
    penalties: readNumber(source, ['penalties.num', 'penalties.count', 'penalties', 'Penalties']),
    penaltyYds: readNumber(source, ['penalties.yds', 'penaltyYds', 'PenaltyYards']),
    punts: readNumber(source, ['punts.num', 'punts.count', 'punts', 'Punts']),
    puntAverage: readNumber(source, ['punts.avg', 'puntAverage', 'punt_average', 'PuntAverage']),
    timeOfPossession: readFirstValue(source, ['possession', 'timeOfPossession', 'time_of_possession', 'TOP'], '00:00'),
    thirdDownConversions: readNumber(source, ['third_down.made', 'thirdDown.made', 'thirdDownConversions']),
    thirdDownAttempts: readNumber(source, ['third_down.att', 'thirdDown.att', 'thirdDownAttempts']),
    fourthDownConversions: readNumber(source, ['fourth_down.made', 'fourthDown.made', 'fourthDownConversions']),
    fourthDownAttempts: readNumber(source, ['fourth_down.att', 'fourthDown.att', 'fourthDownAttempts']),
  };
}

function resolveTeamStatsSource(envelope, teamCode) {
  const teams = envelope?.stats?.teams || {};
  const sideKey = teamCode === 'H' ? 'home' : 'visitor';
  const dbTeamKey = teamCode === 'H' ? 'HOME' : 'VISITOR';
  const teamId = envelope?.game?.teams?.[teamCode]?.teamId;
  const teamAbbr = envelope?.game?.teams?.[teamCode]?.abbr;

  return teams[teamCode]
    || teams[sideKey]
    || teams[dbTeamKey]
    || (teamId ? teams[teamId] : undefined)
    || (teamAbbr ? teams[teamAbbr] : undefined)
    || {};
}

function readNumber(source, paths) {
  return toNumber(readFirstValue(source, paths, 0));
}

function readOptionalNumber(source, paths) {
  const value = readFirstValue(source, paths, undefined);
  return value === undefined ? undefined : toNumber(value);
}

function readFirstValue(source, paths, fallback) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }

  return fallback;
}

function readPath(source, path) {
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, source);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatInteger(value) {
  return String(Math.trunc(toNumber(value)));
}

function formatDecimal(value) {
  return toNumber(value).toFixed(1);
}

function formatPossessionTime(value) {
  if (typeof value === 'string' && value.trim()) return value;
  const seconds = Math.max(0, Math.trunc(toNumber(value)));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
