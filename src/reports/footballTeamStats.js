import { formatFootballReportDate } from './footballScoringSummary';

const TEAM_CODES = ['V', 'H'];

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const readPath = (source, path) => path.split('.').reduce((current, key) => (
  current === null || current === undefined ? undefined : current[key]
), source);

const readNumber = (source, paths, fallback = 0) => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && value !== '') return finiteNumber(value, fallback);
  }
  return fallback;
};

const teamSource = (envelope, team) => {
  const sources = envelope?.stats?.teams || {};
  const teamRecord = envelope?.game?.teams?.[team] || {};
  return sources[team]
    || sources[team === 'V' ? 'visitor' : 'home']
    || sources[teamRecord.teamId]
    || sources[teamRecord.abbr]
    || {};
};

const orderedEvents = (envelope) => (Array.isArray(envelope?.events) ? envelope.events : [])
  .filter((event) => !event?.status || event.status === 'accepted')
  .slice()
  .sort((left, right) => finiteNumber(left.sequence) - finiteNumber(right.sequence));

const oppositeTeam = (team) => (team === 'V' ? 'H' : 'V');

const fieldLength = (envelope) => Math.max(1, finiteNumber(envelope?.game?.rules?.fieldLength, 100));

const relativeSpot = (spot, team, length) => {
  const value = String(spot || '').trim();
  if (/^goal$/i.test(value)) return length;
  if (/^(?:50|midfield)$/i.test(value)) return length / 2;
  const match = value.match(/^([HV])(\d{1,2})$/i);
  if (!match) return null;
  const yard = finiteNumber(match[2]);
  return match[1].toUpperCase() === team ? yard : length - yard;
};

const acceptedPreviousSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && ['previous', 'previousspot'].includes(String(penalty.enforcedFrom || '').toLowerCase())
));

const replayDownPenalty = (event) => (event?.penalties || []).some((penalty) => (
  ['accepted', 'offsetting'].includes(penalty.status) && penalty.replayDown
));

const sameDrive = (left, right) => Boolean(
  left?.preState?.driveId
  && right?.preState?.driveId
  && left.preState.driveId === right.preState.driveId
);

const touchdownFirstDown = (events, event, team, length) => {
  if (String(event?.preState?.lineToGain || '').toLowerCase() !== 'goal') return true;
  let seriesStart = Number(event?.preState?.down) === 1 ? event.preState.yardLine : null;
  if (!seriesStart) {
    seriesStart = [...events].reverse().find((candidate) => (
      finiteNumber(candidate.sequence) < finiteNumber(event.sequence)
      && candidate.possession === team
      && Number(candidate?.preState?.down) === 1
      && ['rush', 'pass', 'penalty'].includes(candidate.type)
      && sameDrive(candidate, event)
    ))?.preState?.yardLine;
  }
  const start = relativeSpot(seriesStart, team, length);
  return Number.isFinite(start) && length - start >= 10;
};

const firstDownBreakdown = (envelope, events, team, total) => {
  const length = fieldLength(envelope);
  let rushing = 0;
  let passing = 0;
  events.forEach((event) => {
    if (
      event.possession !== team
      || !['rush', 'pass'].includes(event.type)
      || acceptedPreviousSpotPenalty(event)
      || replayDownPenalty(event)
    ) return;
    const touchdown = event?.result?.scoring?.type === 'touchdown';
    const start = relativeSpot(event?.preState?.yardLine, team, length);
    const end = touchdown
      ? length
      : relativeSpot(event?.result?.endYardLine, team, length);
    const gained = Number.isFinite(start) && Number.isFinite(end) ? end - start : finiteNumber(event?.result?.yards);
    const earned = touchdown
      ? touchdownFirstDown(events, event, team, length)
      : gained >= finiteNumber(event?.preState?.distance, Number.POSITIVE_INFINITY);
    if (!earned) return;
    if (event.type === 'rush') rushing += 1;
    else passing += 1;
  });
  return {
    rushing,
    passing,
    penalty: Math.max(0, total - rushing - passing),
  };
};

const rushingBreakdown = (events, team, authoritativeYards) => {
  let gained = 0;
  let lost = 0;
  events.forEach((event) => {
    if (event.possession !== team || acceptedPreviousSpotPenalty(event)) return;
    const sack = event.type === 'pass'
      && (event.subtype === 'sack' || event?.result?.pass?.outcome === 'sack');
    if (event.type !== 'rush' && !sack) return;
    const yards = finiteNumber(event?.result?.yards);
    if (yards >= 0) gained += yards;
    else lost += Math.abs(yards);
  });
  const derivedYards = gained - lost;
  if (derivedYards < authoritativeYards) gained += authoritativeYards - derivedYards;
  if (derivedYards > authoritativeYards) lost += derivedYards - authoritativeYards;
  return { gained, lost };
};

const scoringTouchdowns = (events, team, playType) => events.filter((event) => (
  event.type === playType
  && event?.result?.scoring?.team === team
  && event.result.scoring.type === 'touchdown'
)).length;

const spotRuleYards = (value, fallback) => {
  const match = String(value || '').match(/(\d{1,2})$/);
  return match ? finiteNumber(match[1], fallback) : fallback;
};

const puntStats = (envelope, events, team, source, opponentSource) => {
  const punts = events.filter((event) => event.type === 'punt' && event.possession === team);
  const count = readNumber(source, ['punts.num', 'punts.count', 'punts']);
  const yards = readNumber(source, ['punts.yds', 'puntYards']);
  const returnYards = readNumber(opponentSource, ['puntReturns.yds', 'punt_returns.yds', 'puntReturnYds']);
  const touchbacks = punts.filter((event) => (
    event.subtype === 'touchback' || event?.result?.code === 'touchback'
  )).length;
  const touchbackYards = spotRuleYards(envelope?.game?.rules?.touchbackSpot, 20);
  const inside20 = punts.filter((event) => {
    if (event.subtype === 'touchback' || event?.result?.code === 'touchback') return false;
    const receivingTeam = oppositeTeam(team);
    const end = relativeSpot(event?.result?.endYardLine, receivingTeam, fieldLength(envelope));
    return Number.isFinite(end) && end < 20;
  }).length;
  return {
    count,
    yards,
    average: count > 0 ? yards / count : 0,
    net: count > 0 ? (yards - returnYards - (touchbacks * touchbackYards)) / count : 0,
    fairCaught: punts.filter((event) => (
      event.subtype === 'fairCatch' || event?.result?.code === 'fairCatch'
    )).length,
    inside20,
    fiftyPlus: punts.filter((event) => finiteNumber(event?.result?.kick?.kickYards) >= 50).length,
    touchbacks,
  };
};

const kickoffTeam = (event) => event?.participants?.kicker?.team
  || event?.participants?.primary?.team
  || event?.possession;

const kickoffStats = (envelope, events, team, opponentSource) => {
  const kicks = events.filter((event) => event.type === 'kickoff' && kickoffTeam(event) === team);
  const length = fieldLength(envelope);
  let yards = 0;
  let touchbacks = 0;
  kicks.forEach((event) => {
    const touchback = event.subtype === 'touchback' || event?.result?.code === 'touchback';
    if (touchback) touchbacks += 1;
    const recorded = Number(event?.result?.kick?.kickYards);
    if (Number.isFinite(recorded)) {
      yards += recorded;
      return;
    }
    const start = relativeSpot(event?.preState?.yardLine, team, length);
    yards += touchback && Number.isFinite(start) ? length - start : 0;
  });
  const count = kicks.length;
  const returnYards = readNumber(opponentSource, ['kickReturns.yds', 'kick_returns.yds', 'kickReturnYds']);
  const touchbackYards = spotRuleYards(envelope?.game?.rules?.kickoffTouchbackSpot, 25);
  return {
    count,
    yards,
    average: count > 0 ? yards / count : 0,
    net: count > 0 ? (yards - returnYards - (touchbacks * touchbackYards)) / count : 0,
    touchbacks,
  };
};

const explicitReturnStats = (events, team, type) => {
  const matching = events.filter((event) => (
    String(event?.result?.return?.type || '').toLowerCase() === type.toLowerCase()
    && (event?.participants?.returner?.team || event?.result?.turnover?.team || event?.result?.scoring?.team) === team
  ));
  return {
    count: matching.length,
    yards: matching.reduce((total, event) => total + finiteNumber(event?.result?.return?.returnYards), 0),
    touchdowns: matching.filter((event) => (
      event?.result?.scoring?.team === team && event.result.scoring.type === 'touchdown'
    )).length,
  };
};

const returnStats = (events, team, source, type) => {
  const paths = {
    kickoff: ['kickReturns', 'kick_returns'],
    punt: ['puntReturns', 'punt_returns'],
    fumble: ['fumbleReturns', 'fumble_returns'],
    interception: ['intReturns', 'int_returns'],
  }[type];
  const explicit = explicitReturnStats(events, team, type === 'kickoff' ? 'Kickoff' : type === 'punt' ? 'Punt' : type);
  const object = readPath(source, paths[0]) || readPath(source, paths[1]) || {};
  const count = readNumber(object, ['num', 'count'], explicit.count);
  const yards = readNumber(object, ['yds', 'yards'], explicit.yards);
  const eventType = type === 'kickoff' ? 'kickoff' : type === 'punt' ? 'punt' : null;
  const touchdowns = eventType
    ? events.filter((event) => (
      event.type === eventType
      && event?.result?.scoring?.team === team
      && event.result.scoring.type === 'touchdown'
    )).length
    : explicit.touchdowns;
  return {
    count,
    yards,
    touchdowns,
    average: count > 0 ? yards / count : 0,
  };
};

const clockSeconds = (clock) => {
  const match = String(clock || '').match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? (finiteNumber(match[1]) * 60) + finiteNumber(match[2]) : 0;
};

const possessionByQuarter = (envelope, source) => {
  const periodSeconds = Math.max(60, finiteNumber(envelope?.game?.rules?.minutesPerPeriod, 15) * 60);
  const quarters = [0, 0, 0, 0];
  const segments = Array.isArray(source?.possessionSegments) ? source.possessionSegments : [];
  segments.forEach((segment) => {
    const startPeriod = Math.max(1, finiteNumber(segment.startPeriod, 1));
    const endPeriod = Math.max(startPeriod, finiteNumber(segment.endPeriod, startPeriod));
    const start = clockSeconds(segment.startClock);
    const end = segment.endClock === undefined || segment.endClock === null ? 0 : clockSeconds(segment.endClock);
    if (startPeriod === endPeriod) {
      if (startPeriod <= 4) quarters[startPeriod - 1] += Math.max(0, start - end);
      return;
    }
    if (startPeriod <= 4) quarters[startPeriod - 1] += start;
    for (let period = startPeriod + 1; period < endPeriod; period += 1) {
      if (period <= 4) quarters[period - 1] += periodSeconds;
    }
    if (endPeriod <= 4) quarters[endPeriod - 1] += Math.max(0, periodSeconds - end);
  });
  return quarters;
};

const isRedZoneSpot = (spot, team) => {
  const match = String(spot || '').match(/^([HV])(\d{1,2})$/i);
  return Boolean(match && match[1].toUpperCase() !== team && finiteNumber(match[2]) <= 20);
};

const redZoneStats = (envelope, events, team) => {
  const completed = Array.isArray(envelope?.drives?.completed) ? envelope.drives.completed : [];
  const drives = completed.filter((drive) => drive.team === team && events.some((event) => (
    event?.preState?.driveId === drive.driveId
    && (event?.preState?.redZone || isRedZoneSpot(event?.preState?.yardLine, team))
  )));
  const touchdowns = drives.filter((drive) => drive.result === 'touchdown').length;
  const fieldGoals = drives.filter((drive) => drive.result === 'fieldGoal').length;
  return {
    attempts: drives.length,
    scores: touchdowns + fieldGoals,
    touchdowns,
    fieldGoals,
  };
};

const pointsByDrive = (events) => {
  const points = new Map();
  let pendingTouchdown = null;
  events.forEach((event) => {
    const scoring = event?.result?.scoring;
    if (!scoring || finiteNumber(scoring.points) <= 0) return;
    let driveId = event?.preState?.driveId;
    if (event.type === 'try' && pendingTouchdown?.team === scoring.team) driveId = pendingTouchdown.driveId;
    if (driveId) points.set(driveId, finiteNumber(points.get(driveId)) + finiteNumber(scoring.points));
    pendingTouchdown = scoring.type === 'touchdown' ? { driveId, team: scoring.team } : null;
  });
  return points;
};

const pointsOffTurnovers = (envelope, events, team) => {
  const drivePoints = pointsByDrive(events);
  const completed = Array.isArray(envelope?.drives?.completed) ? envelope.drives.completed : [];
  return completed.filter((drive) => {
    if (drive.team !== team) return false;
    const reason = String(drive.startReason || '').toLowerCase();
    return reason === 'turnover' || reason.includes('fumble') || reason.includes('interception');
  }).reduce((total, drive) => total + finiteNumber(drivePoints.get(drive.driveId)), 0);
};

const formatInteger = (value) => String(Math.trunc(finiteNumber(value)));
const formatDecimal = (value) => finiteNumber(value).toFixed(1);
const formatClock = (value) => {
  const seconds = Math.max(0, Math.round(finiteNumber(value)));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const formatEfficiency = (made, attempts) => `${formatInteger(made)}-${formatInteger(attempts)}`;
const formatReturn = (stats) => `${formatInteger(stats.count)}-${formatInteger(stats.yards)}-${formatInteger(stats.touchdowns)}`;

const teamProjection = (envelope, events, team) => {
  const source = teamSource(envelope, team);
  const opponentSource = teamSource(envelope, oppositeTeam(team));
  const firstDowns = readNumber(source, ['firstDowns', 'first_downs']);
  const firstDownTypes = firstDownBreakdown(envelope, events, team, firstDowns);
  const rushAttempts = readNumber(source, ['rushAttempts', 'rush.att', 'rushing.att']);
  const rushYards = readNumber(source, ['rushYards', 'rush.yds', 'rushing.yds']);
  const rushing = rushingBreakdown(events, team, rushYards);
  const passCompletions = readNumber(source, ['pass.cmp', 'passing.cmp']);
  const passAttempts = readNumber(source, ['pass.att', 'passing.att']);
  const passInterceptions = readNumber(source, ['pass.int', 'passing.int']);
  const passYards = readNumber(source, ['pass.yds', 'passing.yds']);
  const plays = readNumber(source, ['plays', 'totalPlays']);
  const totalYards = readNumber(source, ['yards', 'totalYards']);
  const fumbles = readNumber(source, ['fumbles.num', 'fumbles.count', 'fumbles']);
  const fumblesLost = readNumber(source, ['fumbles.lost', 'fumblesLost']);
  const penalties = readNumber(source, ['penalties.num', 'penalties.count', 'penalties']);
  const penaltyYards = readNumber(source, ['penalties.yds', 'penaltyYds']);
  const punts = puntStats(envelope, events, team, source, opponentSource);
  const kickoffs = kickoffStats(envelope, events, team, opponentSource);
  const kickoffReturns = returnStats(events, team, source, 'kickoff');
  const puntReturns = returnStats(events, team, source, 'punt');
  const fumbleReturns = returnStats(events, team, source, 'fumble');
  const interceptionReturns = returnStats(events, team, source, 'interception');
  const possessionQuarters = possessionByQuarter(envelope, source);
  const possession = readNumber(source, ['timeOfPossession', 'possession', 'time_of_possession'], possessionQuarters.reduce((sum, value) => sum + value, 0));
  const thirdDownMade = readNumber(source, ['thirdDown.made', 'third_down.made']);
  const thirdDownAttempts = readNumber(source, ['thirdDown.att', 'third_down.att']);
  const fourthDownMade = readNumber(source, ['fourthDown.made', 'fourth_down.made']);
  const fourthDownAttempts = readNumber(source, ['fourthDown.att', 'fourth_down.att']);
  const redZone = redZoneStats(envelope, events, team);

  return {
    firstDowns,
    firstDownTypes,
    rushAttempts,
    rushYards,
    rushing,
    rushAverage: rushAttempts > 0 ? rushYards / rushAttempts : 0,
    rushTouchdowns: scoringTouchdowns(events, team, 'rush'),
    passCompletions,
    passAttempts,
    passInterceptions,
    passYards,
    passAverageAttempt: passAttempts > 0 ? passYards / passAttempts : 0,
    passAverageCompletion: passCompletions > 0 ? passYards / passCompletions : 0,
    passTouchdowns: scoringTouchdowns(events, team, 'pass'),
    plays,
    totalYards,
    averagePlay: plays > 0 ? totalYards / plays : 0,
    fumbles,
    fumblesLost,
    penalties,
    penaltyYards,
    punts,
    kickoffs,
    kickoffReturns,
    puntReturns,
    fumbleReturns,
    interceptionReturns,
    miscYards: readNumber(source, ['miscYards', 'misc_yards']),
    possession,
    possessionQuarters,
    thirdDownMade,
    thirdDownAttempts,
    fourthDownMade,
    fourthDownAttempts,
    redZone,
    pointsOffTurnovers: pointsOffTurnovers(envelope, events, team),
  };
};

const row = (id, label, level, values, variant = null) => ({ id, label, level, values, variant });
const separator = (id) => ({ id, separator: true });

const reportRows = (teamStats) => {
  const values = (formatter) => Object.fromEntries(TEAM_CODES.map((team) => [team, formatter(teamStats[team])]));
  return [
    row('first-downs', 'First Downs', 'heading', values((stats) => formatInteger(stats.firstDowns))),
    row('first-downs-rushing', 'Rushing', 'detail', values((stats) => formatInteger(stats.firstDownTypes.rushing))),
    row('first-downs-passing', 'Passing', 'detail', values((stats) => formatInteger(stats.firstDownTypes.passing))),
    row('first-downs-penalty', 'Penalty', 'detail', values((stats) => formatInteger(stats.firstDownTypes.penalty))),
    row('rushing-yards', 'Rushing Yards', 'heading', values((stats) => formatInteger(stats.rushYards))),
    row('rushing-attempts', 'Attempts', 'detail', values((stats) => formatInteger(stats.rushAttempts))),
    row('rushing-gained', 'Gained', 'detail', values((stats) => formatInteger(stats.rushing.gained))),
    row('rushing-lost', 'Lost', 'detail', values((stats) => formatInteger(stats.rushing.lost))),
    row('rushing-average', 'Avg. Per Rush', 'detail', values((stats) => formatDecimal(stats.rushAverage))),
    row('rushing-touchdowns', 'Touchdowns', 'detail', values((stats) => formatInteger(stats.rushTouchdowns))),
    row('passing-yards', 'Passing Yards', 'heading', values((stats) => formatInteger(stats.passYards))),
    row('passing-cai', 'Completions - Attempts - Interceptions', 'detail', values((stats) => (
      `${formatInteger(stats.passCompletions)}-${formatInteger(stats.passAttempts)}-${formatInteger(stats.passInterceptions)}`
    ))),
    row('passing-attempt-average', 'Avg. Per Attempt', 'detail', values((stats) => formatDecimal(stats.passAverageAttempt))),
    row('passing-completion-average', 'Avg. Per Completion', 'detail', values((stats) => formatDecimal(stats.passAverageCompletion))),
    row('passing-touchdowns', 'Touchdowns', 'detail', values((stats) => formatInteger(stats.passTouchdowns))),
    row('total-offense', 'Total Offense', 'heading', values((stats) => formatInteger(stats.totalYards))),
    row('total-plays', 'Plays', 'detail', values((stats) => formatInteger(stats.plays))),
    row('total-average', 'Avg. Per Play', 'detail', values((stats) => formatDecimal(stats.averagePlay))),
    row('fumbles', 'Fumbles (Lost)', 'heading', values((stats) => `${formatInteger(stats.fumbles)} (${formatInteger(stats.fumblesLost)})`)),
    row('penalties', 'Penalties - Penalty Yards', 'heading', values((stats) => `${formatInteger(stats.penalties)}-${formatInteger(stats.penaltyYards)}`), 'alternate'),
    row('punts', 'Punts', 'heading', values((stats) => `${formatInteger(stats.punts.count)}-${formatInteger(stats.punts.yards)}`)),
    row('punt-average', 'Avg. Per Punt', 'detail', values((stats) => formatDecimal(stats.punts.average))),
    row('punt-net', 'Net Yards Per Punt', 'detail', values((stats) => formatDecimal(stats.punts.net))),
    row('punt-fair-caught', 'Fair Caught', 'detail', values((stats) => formatInteger(stats.punts.fairCaught))),
    row('punt-inside-20', 'Inside 20', 'detail', values((stats) => formatInteger(stats.punts.inside20))),
    row('punt-50-plus', '50+ Yards', 'detail', values((stats) => formatInteger(stats.punts.fiftyPlus))),
    row('punt-touchbacks', 'Touchbacks', 'detail', values((stats) => formatInteger(stats.punts.touchbacks))),
    row('kickoffs', 'Kickoffs', 'heading', values((stats) => `${formatInteger(stats.kickoffs.count)}-${formatInteger(stats.kickoffs.yards)}`)),
    row('kickoff-average', 'Avg. Per Kickoff', 'detail', values((stats) => formatDecimal(stats.kickoffs.average))),
    row('kickoff-net', 'Net Per Kickoff', 'detail', values((stats) => formatDecimal(stats.kickoffs.net))),
    row('kickoff-touchbacks', 'Touchbacks', 'detail', values((stats) => formatInteger(stats.kickoffs.touchbacks))),
    separator('returns-separator'),
    row('kickoff-returns', 'Kickoff Returns (Num-Yds-TD)', 'heading', values((stats) => formatReturn(stats.kickoffReturns))),
    row('kickoff-return-average', 'Avg. Per Return', 'detail', values((stats) => formatDecimal(stats.kickoffReturns.average))),
    row('punt-returns', 'Punt Returns (Num-Yds-TD)', 'heading', values((stats) => formatReturn(stats.puntReturns))),
    row('punt-return-average', 'Avg. Per Return', 'detail', values((stats) => formatDecimal(stats.puntReturns.average))),
    row('fumble-returns', 'Fumble Returns (Num-Yds-TD)', 'heading', values((stats) => formatReturn(stats.fumbleReturns))),
    row('fumble-return-average', 'Avg. Per Return', 'detail', values((stats) => formatDecimal(stats.fumbleReturns.average))),
    row('interception-returns', 'Interception Returns (Num-Yds-TD)', 'heading', values((stats) => formatReturn(stats.interceptionReturns))),
    row('interception-return-average', 'Avg. Per Return', 'detail', values((stats) => formatDecimal(stats.interceptionReturns.average))),
    separator('possession-separator'),
    row('misc-yards', 'Misc. Yards', 'standard', values((stats) => formatInteger(stats.miscYards))),
    row('possession', 'Time of Possession', 'heading', values((stats) => formatClock(stats.possession))),
    ...[1, 2, 3, 4].map((period) => row(
      `possession-${period}`,
      `${period}${period === 1 ? 'st' : period === 2 ? 'nd' : period === 3 ? 'rd' : 'th'} Quarter`,
      'detail',
      values((stats) => formatClock(stats.possessionQuarters[period - 1])),
    )),
    row('third-down', 'Third Down Efficiency', 'heading', values((stats) => formatEfficiency(stats.thirdDownMade, stats.thirdDownAttempts))),
    row('fourth-down', 'Fourth Down Efficiency', 'heading', values((stats) => formatEfficiency(stats.fourthDownMade, stats.fourthDownAttempts)), 'alternate'),
    row('red-zone', 'Red Zone Efficiency', 'heading', values((stats) => formatEfficiency(stats.redZone.scores, stats.redZone.attempts))),
    row('red-zone-touchdown', 'By Touchdown', 'detail', values((stats) => formatEfficiency(stats.redZone.touchdowns, stats.redZone.attempts))),
    row('red-zone-field-goal', 'By Field Goal', 'detail', values((stats) => formatEfficiency(stats.redZone.fieldGoals, stats.redZone.attempts))),
    row('points-off-turnover', 'Points Off Turnover', 'heading', values((stats) => formatInteger(stats.pointsOffTurnovers))),
  ];
};

export const buildFootballTeamStatsReport = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for the team stats report.');
  }
  const events = orderedEvents(envelope);
  const teams = envelope.game.teams;
  const teamStats = Object.fromEntries(TEAM_CODES.map((team) => [
    team,
    teamProjection(envelope, events, team),
  ]));
  return {
    gameId: envelope.gameId,
    reportTitle: 'Team Stats',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    teamStats,
    rows: reportRows(teamStats),
  };
};
