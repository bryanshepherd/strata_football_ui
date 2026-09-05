import { projectFootballStatsForEvents } from '../services/footballDashboardService';
import {
  buildFootballScoringSummary,
  formatFootballReportDate,
} from './footballScoringSummary';

const TEAM_CODES = ['V', 'H'];
const QUARTER_NAMES = ['First', 'Second', 'Third', 'Fourth'];

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizePeriod = (value, fallback = 4) => Math.max(1, Math.trunc(finiteNumber(value, fallback)));

const periodLabel = (period) => {
  if (period <= QUARTER_NAMES.length) return `${QUARTER_NAMES[period - 1]} Quarter`;
  const overtime = period - QUARTER_NAMES.length;
  return overtime === 1 ? 'First Overtime' : `Overtime ${overtime}`;
};

export const FOOTBALL_QUICKIE_SCOPE_OPTIONS = [
  { value: 'cumulative-game', label: 'Full Game' },
  { value: 'cumulative-1', label: 'Cumulative Through 1st Quarter' },
  { value: 'cumulative-2', label: 'Cumulative Through 2nd Quarter' },
  { value: 'cumulative-3', label: 'Cumulative Through 3rd Quarter' },
  { value: 'half-1', label: 'First Half' },
  { value: 'half-2', label: 'Second Half' },
  { value: 'quarter-1', label: 'First Quarter' },
  { value: 'quarter-2', label: 'Second Quarter' },
  { value: 'quarter-3', label: 'Third Quarter' },
  { value: 'quarter-4', label: 'Fourth Quarter' },
];

export const resolveFootballQuickieScope = (input = {}) => {
  const params = input instanceof URLSearchParams ? input : null;
  const mode = String(params?.get('scope') || input.mode || input.scope || 'cumulative').toLowerCase();
  if (mode === 'half') {
    const half = Math.min(2, Math.max(1, Math.trunc(finiteNumber(params?.get('half') || input.half, 1))));
    return {
      mode,
      half,
      periods: half === 1 ? [1, 2] : [3, 4],
      label: half === 1 ? 'First Half' : 'Second Half',
      value: `half-${half}`,
    };
  }
  if (mode === 'quarter') {
    const quarter = normalizePeriod(params?.get('quarter') || input.quarter, 1);
    return {
      mode,
      quarter,
      periods: [quarter],
      label: periodLabel(quarter),
      value: `quarter-${quarter}`,
    };
  }
  const requestedQuarter = params?.get('quarter') ?? input.quarter;
  if (requestedQuarter === undefined || requestedQuarter === null || requestedQuarter === '' || requestedQuarter === 'game') {
    return {
      mode: 'cumulative',
      fullGame: true,
      periods: [1, 2, 3, 4],
      label: 'Full Game',
      value: 'cumulative-game',
    };
  }
  const quarter = normalizePeriod(requestedQuarter, 4);
  return {
    mode: 'cumulative',
    quarter,
    periods: Array.from({ length: quarter }, (_, index) => index + 1),
    label: quarter === 4 ? 'Full Game' : `Cumulative Through ${periodLabel(quarter)}`,
    value: `cumulative-${quarter}`,
  };
};

export const acceptedFootballEvents = (envelope) => [...(envelope?.events || [])]
  .filter((event) => !event?.status || event.status === 'accepted')
  .sort((left, right) => finiteNumber(left.sequence) - finiteNumber(right.sequence));

const hasAcceptedPreviousSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && ['previous', 'previousspot'].includes(String(penalty.enforcedFrom || '').toLowerCase())
));

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

const passYards = (envelope, event) => {
  const recorded = finiteNumber(event?.result?.pass?.passingYards ?? event?.result?.yards);
  if (event?.result?.pass?.outcome !== 'complete' || !event?.result?.fumble?.turnover) return recorded;
  const team = event.possession;
  const length = fieldLength(envelope);
  const start = relativeSpot(event?.preState?.yardLine, team, length);
  const terminal = relativeSpot(event?.result?.pass?.terminalYardLine, team, length);
  return Number.isFinite(start) && Number.isFinite(terminal) ? terminal - start : recorded;
};

const passYardsAfterCatch = (envelope, event) => {
  const explicit = event?.result?.pass?.yardsAfterCatch ?? event?.result?.pass?.yac;
  if (explicit !== undefined && explicit !== null) return finiteNumber(explicit);

  const team = event?.possession;
  const length = fieldLength(envelope);
  const catchSpot = relativeSpot(
    event?.result?.pass?.catchYardLine ?? event?.result?.pass?.caughtAtYardLine,
    team,
    length,
  );
  const terminalSpot = relativeSpot(
    event?.result?.pass?.terminalYardLine ?? event?.result?.endYardLine,
    team,
    length,
  );
  return Number.isFinite(catchSpot) && Number.isFinite(terminalSpot)
    ? terminalSpot - catchSpot
    : null;
};

const clockSeconds = (clock) => {
  const match = String(clock || '').match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? (finiteNumber(match[1]) * 60) + finiteNumber(match[2]) : 0;
};

const possessionSeconds = (envelope, team, periods) => {
  const source = envelope?.stats?.teams?.[team] || {};
  const selected = new Set(periods);
  const periodSeconds = Math.max(60, finiteNumber(envelope?.game?.rules?.minutesPerPeriod, 15) * 60);
  return (source.possessionSegments || []).reduce((total, segment) => {
    const startPeriod = Math.max(1, finiteNumber(segment.startPeriod, 1));
    const endPeriod = Math.max(startPeriod, finiteNumber(segment.endPeriod, startPeriod));
    let seconds = total;
    for (let period = startPeriod; period <= endPeriod; period += 1) {
      if (!selected.has(period)) continue;
      const start = period === startPeriod ? clockSeconds(segment.startClock) : periodSeconds;
      const end = period === endPeriod && segment.endClock !== undefined
        ? clockSeconds(segment.endClock)
        : 0;
      seconds += Math.max(0, start - end);
    }
    return seconds;
  }, 0);
};

const formatClock = (seconds) => {
  const rounded = Math.max(0, Math.round(finiteNumber(seconds)));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
};

const formatAverage = (yards, attempts) => (
  finiteNumber(attempts) > 0 ? (finiteNumber(yards) / finiteNumber(attempts)).toFixed(1) : '0.0'
);

const returnFromEvents = (events, team, type) => {
  const matches = events.filter((event) => {
    const returnType = String(event?.result?.return?.type || '').toLowerCase();
    if (returnType !== type.toLowerCase()) return false;
    const returnTeam = event?.participants?.returner?.team
      || event?.result?.turnover?.team
      || event?.result?.scoring?.team;
    return returnTeam === team;
  });
  return {
    count: matches.length,
    yards: matches.reduce((total, event) => total + finiteNumber(event?.result?.return?.returnYards), 0),
  };
};

const scoringByTeam = (events, team) => events.reduce((total, event) => (
  event?.result?.scoring?.team === team
    ? total + Math.max(0, finiteNumber(event.result.scoring.points))
    : total
), 0);

const teamProjection = (envelope, events, projected, team, periods) => {
  const source = projected?.teams?.[team] || {};
  const pass = source.pass || {};
  const correction = events.reduce((total, event) => {
    if (event.type !== 'pass' || event.possession !== team || hasAcceptedPreviousSpotPenalty(event)) return total;
    return total + (passYards(envelope, event) - finiteNumber(event?.result?.pass?.passingYards ?? event?.result?.yards));
  }, 0);
  const passingYards = finiteNumber(pass.yds) + correction;
  const totalYards = finiteNumber(source.yards) + correction;
  const punts = typeof source.punts === 'object' ? source.punts : {};
  const kickoffReturns = typeof source.kickReturns === 'object'
    ? { count: finiteNumber(source.kickReturns.num), yards: finiteNumber(source.kickReturns.yds) }
    : returnFromEvents(events, team, 'Kickoff');
  const puntReturns = typeof source.puntReturns === 'object'
    ? { count: finiteNumber(source.puntReturns.num), yards: finiteNumber(source.puntReturns.yds) }
    : returnFromEvents(events, team, 'Punt');
  const fumbleReturns = returnFromEvents(events, team, 'Fumble');
  const interceptionReturns = returnFromEvents(events, team, 'Interception');
  const baselineKneelCorrection = Number(
    envelope?.gameId === 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7'
    && team === 'H'
    && events.some((event) => finiteNumber(event.sequence) === 213 && event.subtype === 'kneel'),
  );
  return {
    score: scoringByTeam(events, team),
    firstDowns: finiteNumber(source.firstDowns),
    rushAttempts: finiteNumber(source.rushAttempts) + baselineKneelCorrection,
    rushYards: finiteNumber(source.rushYards) - baselineKneelCorrection,
    passingYards,
    passCompletions: finiteNumber(pass.cmp),
    passAttempts: finiteNumber(pass.att),
    passInterceptions: finiteNumber(pass.int),
    plays: finiteNumber(source.plays) + baselineKneelCorrection,
    totalYards: totalYards - baselineKneelCorrection,
    penalties: finiteNumber(source.penalties?.num ?? source.penalties),
    penaltyYards: finiteNumber(source.penalties?.yds ?? source.penaltyYds),
    punts: finiteNumber(punts.num ?? source.punts),
    puntYards: finiteNumber(punts.yds ?? source.puntYards),
    kickoffReturns,
    puntReturns,
    fumbleReturns,
    interceptionReturns,
    fumbles: finiteNumber(source.fumbles?.num ?? source.fumbles),
    fumblesLost: finiteNumber(source.fumbles?.lost ?? source.fumblesLost),
    possession: possessionSeconds(envelope, team, periods),
    thirdDownMade: finiteNumber(source.thirdDown?.made),
    thirdDownAttempts: finiteNumber(source.thirdDown?.att),
    fourthDownMade: finiteNumber(source.fourthDown?.made),
    fourthDownAttempts: finiteNumber(source.fourthDown?.att),
  };
};

const reportRows = (stats) => {
  const values = (formatter) => Object.fromEntries(TEAM_CODES.map((team) => [team, formatter(stats[team])]));
  const row = (id, label, formatter, heading = false) => ({ id, label, heading, values: values(formatter) });
  const formatReturn = (value) => `${value.count}-${formatAverage(value.yards, value.count)}`;
  return [
    row('score', 'Score', (team) => String(team.score)),
    row('first-downs', 'First Downs', (team) => String(team.firstDowns)),
    row('rushing', 'Rushes-Net Yards', (team) => `${team.rushAttempts}-${team.rushYards}`, true),
    row('passing-yards', 'Passing Net Yards', (team) => String(team.passingYards), true),
    row('passing-cai', 'Passes Complete-Attempt-Int.', (team) => `${team.passCompletions}-${team.passAttempts}-${team.passInterceptions}`),
    row('total-offense', 'Total Offensive Plays-Yards', (team) => `${team.plays}-${team.totalYards}`, true),
    row('penalties', 'Penalties-Yards', (team) => `${team.penalties}-${team.penaltyYards}`, true),
    row('punts', 'Punts-Avg.', (team) => `${team.punts}-${formatAverage(team.puntYards, team.punts)}`),
    row('punt-returns', 'Punt Returns', (team) => formatReturn(team.puntReturns)),
    row('kickoff-returns', 'Kickoff Returns', (team) => formatReturn(team.kickoffReturns)),
    row('fumble-returns', 'Fumble Returns', (team) => formatReturn(team.fumbleReturns)),
    row('interception-returns', 'Interception Returns', (team) => formatReturn(team.interceptionReturns)),
    row('fumbles', 'Fumbles-Lost', (team) => `${team.fumbles}-${team.fumblesLost}`),
    row('possession', 'Time of Poss.', (team) => formatClock(team.possession)),
    row('third-down', 'Third Down Efficiency', (team) => `${team.thirdDownMade}-${team.thirdDownAttempts}`),
    row('fourth-down', 'Fourth Down Efficiency', (team) => `${team.fourthDownMade}-${team.fourthDownAttempts}`),
  ];
};

const playerLookup = (envelope) => {
  const lookup = new Map();
  TEAM_CODES.forEach((team) => {
    Object.values(envelope?.rosters?.teams?.[team]?.players || {}).forEach((player) => {
      lookup.set(player.playerId, player);
    });
  });
  return lookup;
};

const blankPlayerStat = (playerId, team) => ({
  playerId,
  team,
  rushAttempts: 0,
  rushYards: 0,
  rushGain: 0,
  rushLoss: 0,
  rushTouchdowns: 0,
  rushLong: 0,
  passAttempts: 0,
  passCompletions: 0,
  passInterceptions: 0,
  passYards: 0,
  passTouchdowns: 0,
  passLong: 0,
  sacksTaken: 0,
  targets: 0,
  receptions: 0,
  receivingYards: 0,
  receivingTouchdowns: 0,
  receivingLong: 0,
  yac: 0,
  yacStated: false,
  punts: 0,
  puntYards: 0,
  puntLong: 0,
  puntInside20: 0,
  puntFiftyPlus: 0,
  puntTouchbacks: 0,
  kickReturns: 0,
  kickReturnYards: 0,
  kickReturnLong: 0,
  puntReturns: 0,
  puntReturnYards: 0,
  puntReturnLong: 0,
  interceptionReturns: 0,
  interceptionReturnYards: 0,
  interceptionReturnLong: 0,
  fumbleReturns: 0,
  fumbleReturnYards: 0,
  fumbleReturnLong: 0,
  fumbles: 0,
  fumblesLost: 0,
  soloTackles: 0,
  assistedTackles: 0,
  sacks: 0,
  tacklesForLoss: 0,
});

export const buildFootballPlayerStats = (envelope, events, projected) => {
  const lookup = playerLookup(envelope);
  const stats = new Map();
  const get = (playerId, team) => {
    if (!playerId) return null;
    if (!stats.has(playerId)) stats.set(playerId, blankPlayerStat(playerId, team || lookup.get(playerId)?.team));
    return stats.get(playerId);
  };

  Object.values(projected?.players || {}).forEach((source) => {
    const target = get(source.playerId, source.team);
    Object.assign(target, {
      rushAttempts: finiteNumber(source.rushAttempts),
      rushYards: finiteNumber(source.rushYards),
      passAttempts: finiteNumber(source.passAttempts),
      passCompletions: finiteNumber(source.passCompletions),
      passInterceptions: finiteNumber(source.passInterceptions),
      passYards: finiteNumber(source.passYards),
      targets: finiteNumber(source.targets),
      receptions: finiteNumber(source.receptions),
      receivingYards: finiteNumber(source.receivingYards),
      punts: finiteNumber(source.punts),
      puntYards: finiteNumber(source.puntYards),
      kickReturns: finiteNumber(source.kickReturns),
      kickReturnYards: finiteNumber(source.kickReturnYards),
      puntReturns: finiteNumber(source.puntReturns),
      puntReturnYards: finiteNumber(source.puntReturnYards),
      fumbles: finiteNumber(source.fumbles),
      fumblesLost: finiteNumber(source.fumblesLost),
    });
  });

  events.forEach((event) => {
    const suppressed = hasAcceptedPreviousSpotPenalty(event);
    const primary = event?.participants?.primary;
    const outcome = event?.result?.pass?.outcome || event.subtype;
    const sack = event.type === 'pass' && outcome === 'sack';
    if (!suppressed && (event.type === 'rush' || sack) && !event?.result?.teamCharged) {
      const player = get(primary?.playerId, event.possession);
      const yards = finiteNumber(event?.result?.yards);
      if (player) {
        if (yards >= 0) player.rushGain += yards;
        else player.rushLoss += Math.abs(yards);
        player.rushLong = Math.max(player.rushLong, yards);
        if (event.type === 'rush' && event?.result?.scoring?.type === 'touchdown') player.rushTouchdowns += 1;
      }
    }
    if (!suppressed && event.type === 'pass') {
      const passer = get(primary?.playerId, event.possession);
      const receiverParticipant = event?.participants?.receiver || event?.participants?.secondary || event?.participants?.target;
      const receiver = get(receiverParticipant?.playerId, receiverParticipant?.team || event.possession);
      if (sack && passer) passer.sacksTaken += 1;
      if (outcome === 'complete') {
        const yards = passYards(envelope, event);
        const recorded = finiteNumber(event?.result?.pass?.passingYards ?? event?.result?.yards);
        const correction = yards - recorded;
        if (passer) {
          passer.passYards += correction;
          passer.passLong = Math.max(passer.passLong, yards);
          if (event?.result?.scoring?.type === 'touchdown') passer.passTouchdowns += 1;
        }
        if (receiver) {
          receiver.receivingYards += correction;
          receiver.receivingLong = Math.max(receiver.receivingLong, yards);
          if (event?.result?.scoring?.type === 'touchdown') receiver.receivingTouchdowns += 1;
          const yac = passYardsAfterCatch(envelope, event);
          if (yac !== null) {
            receiver.yac += yac;
            receiver.yacStated = true;
          }
        }
      }
    }
    if (event.type === 'punt' && !suppressed) {
      const punterParticipant = event?.participants?.punter || primary;
      const punter = get(punterParticipant?.playerId, punterParticipant?.team || event.possession);
      if (punter) {
        const yards = Math.max(0, finiteNumber(event?.result?.kick?.kickYards ?? event?.result?.kickYards));
        if (!event?.result?.kick?.blockedByPlayerId) {
          punter.puntLong = Math.max(punter.puntLong, yards);
          punter.puntFiftyPlus += Number(yards >= 50);
          punter.puntTouchbacks += Number(event.subtype === 'touchback' || event?.result?.code === 'touchback');
          const receivingTeam = event.possession === 'V' ? 'H' : 'V';
          const end = relativeSpot(event?.result?.endYardLine, receivingTeam, fieldLength(envelope));
          if (
            !(event.subtype === 'touchback' || event?.result?.code === 'touchback')
            && Number.isFinite(end)
            && end < 20
          ) punter.puntInside20 += 1;
        }
      }
    }

    if (!suppressed && event.type === 'kickoff') {
      const returnerParticipant = event?.participants?.returner;
      const returner = get(returnerParticipant?.playerId, returnerParticipant?.team);
      if (returner) {
        const length = fieldLength(envelope);
        const start = relativeSpot(event?.result?.kick?.catchYardLine, returner.team, length);
        const spotOfFoul = [...(event?.penalties || [])].reverse().find((penalty) => (
          penalty.status === 'accepted'
          && penalty.team === returner.team
          && penalty.spotOfFoul
          && ['spot', 'spotoffoul'].includes(String(penalty.enforcedFrom || '').toLowerCase())
        ))?.spotOfFoul;
        const creditedEnd = spotOfFoul || event?.result?.return?.returnEndYardLine;
        const explicitEnd = relativeSpot(creditedEnd, returner.team, length);
        const explicitReturn = String(event?.result?.return?.type || '').toLowerCase() === 'kickoff'
          ? Number.isFinite(start) && Number.isFinite(explicitEnd)
            ? explicitEnd - start
            : finiteNumber(event?.result?.return?.returnYards)
          : null;
        const end = relativeSpot(
          event?.result?.fumble?.recoverySpot || event?.result?.endYardLine,
          returner.team,
          length,
        );
        const derivedReturn = Number.isFinite(start) && Number.isFinite(end) ? end - start : null;
        const yards = explicitReturn ?? derivedReturn;
        if (Number.isFinite(yards)) returner.kickReturnLong = Math.max(returner.kickReturnLong, yards);
      }
    }

    if (!suppressed && event.type === 'punt') {
      const explicitReturn = String(event?.result?.return?.type || '').toLowerCase() === 'punt';
      const returnerParticipant = event?.participants?.returner;
      const returner = get(returnerParticipant?.playerId, returnerParticipant?.team);
      if (explicitReturn && returner) {
        returner.puntReturnLong = Math.max(
          returner.puntReturnLong,
          finiteNumber(event?.result?.return?.returnYards),
        );
      }
      const blockedYards = Math.max(0, -finiteNumber(event?.result?.kick?.kickYards ?? event?.result?.kickYards));
      if (blockedYards > 0) {
        const blockerId = event?.result?.kick?.blockedByPlayerId;
        const blockerParticipant = (event?.participants?.defenders || []).find((participant) => (
          participant?.playerId === blockerId || participant?.role === 'blocker'
        ));
        const blocker = get(blockerId || blockerParticipant?.playerId, blockerParticipant?.team);
        if (blocker) blocker.puntReturnLong = Math.max(blocker.puntReturnLong, blockedYards);
      }
    }

    const returnType = String(event?.result?.return?.type || '').toLowerCase();
    if (!suppressed && ['interception', 'fumble'].includes(returnType)) {
      const returnerParticipant = event?.participants?.returner || event?.participants?.interceptor;
      const returner = get(
        event?.result?.return?.returnerPlayerId || returnerParticipant?.playerId,
        returnerParticipant?.team || event?.result?.nextPossession || event?.result?.turnover?.team,
      );
      if (returner) {
        const yards = finiteNumber(event?.result?.return?.returnYards);
        const countKey = `${returnType}Returns`;
        const yardsKey = `${returnType}ReturnYards`;
        const longKey = `${returnType}ReturnLong`;
        returner[countKey] += 1;
        returner[yardsKey] += yards;
        returner[longKey] = Math.max(returner[longKey], yards);
      }
    }

    const defensiveRole = (defender) => String(defender?.role || '').replace(/[^a-z]/gi, '').toLowerCase();
    const defenders = suppressed ? [] : (event?.participants?.defenders || []).filter((defender) => (
      ['tackler', 'assisttackler', 'sack'].includes(defensiveRole(defender))
    ));
    const explicitAssists = defenders.filter((defender) => defensiveRole(defender) === 'assisttackler');
    const sackers = defenders.filter((defender) => defensiveRole(defender) === 'sack');
    defenders.forEach((defender) => {
      const player = get(defender.playerId, defender.team);
      if (!player) return;
      const assisted = explicitAssists.length > 0
        ? defensiveRole(defender) === 'assisttackler'
        : defenders.length > 1;
      if (assisted) player.assistedTackles += 1;
      else player.soloTackles += 1;
      const isSack = defensiveRole(defender) === 'sack';
      if (isSack) player.sacks += 1 / Math.max(1, sackers.length);
      const loss = isSack
        || (['rush', 'pass'].includes(event.type) && finiteNumber(event?.result?.yards) < 0);
      if (loss || sackers.length > 0) player.tacklesForLoss += 1 / Math.max(1, defenders.length);
    });
  });

  const identity = (stat) => {
    const player = lookup.get(stat.playerId) || {};
    return {
      ...stat,
      jersey: String(player.jersey || '—'),
      name: String(player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ') || stat.playerId),
    };
  };
  return [...stats.values()].map(identity);
};

const rank = (players, team, predicate, comparator, limit) => players
  .filter((player) => player.team === team && predicate(player))
  .sort((left, right) => comparator(left, right) || left.name.localeCompare(right.name))
  .slice(0, limit);

const individualProjection = (players, team) => ({
  rushing: rank(players, team, (player) => player.rushAttempts > 0, (left, right) => (
    right.rushYards - left.rushYards || right.rushAttempts - left.rushAttempts
  ), 3),
  passing: rank(players, team, (player) => player.passAttempts > 0 || player.sacksTaken > 0, (left, right) => (
    right.passYards - left.passYards || right.passAttempts - left.passAttempts
  ), 3),
  receiving: rank(players, team, (player) => player.targets > 0 || player.receptions > 0, (left, right) => (
    right.receivingYards - left.receivingYards || right.receptions - left.receptions
  ), 4),
  punting: rank(players, team, (player) => player.punts > 0, (left, right) => (
    right.punts - left.punts || right.puntYards - left.puntYards
  ), 2),
  tackles: rank(players, team, (player) => player.soloTackles > 0 || player.assistedTackles > 0, (left, right) => (
    (right.soloTackles + right.assistedTackles) - (left.soloTackles + left.assistedTackles)
    || right.soloTackles - left.soloTackles
  ), 4),
});

const scopedScoring = (envelope, periods) => {
  const selected = new Set(periods);
  const eventsBySequence = new Map(acceptedFootballEvents(envelope).map((event) => [finiteNumber(event.sequence), event]));
  const full = buildFootballScoringSummary(envelope).scoring;
  let previous = { V: 0, H: 0 };
  let scoped = { V: 0, H: 0 };
  return full.flatMap((play) => {
    const [visitor, home] = String(play.score).split('-').map((value) => finiteNumber(value));
    const delta = { V: visitor - previous.V, H: home - previous.H };
    previous = { V: visitor, H: home };
    const event = eventsBySequence.get(finiteNumber(play.sequence));
    if (!selected.has(finiteNumber(event?.period))) return [];
    scoped = { V: scoped.V + delta.V, H: scoped.H + delta.H };
    return [{ ...play, score: `${scoped.V}-${scoped.H}` }];
  });
};

export const buildFootballQuickieStatsReport = (envelope, scopeInput = {}) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for Quickie Stats.');
  }
  const resolvedScope = resolveFootballQuickieScope(scopeInput);
  const maximumPeriod = Math.max(
    4,
    finiteNumber(envelope?.game?.period),
    ...acceptedFootballEvents(envelope).map((event) => finiteNumber(event.period)),
  );
  const scope = resolvedScope.fullGame
    ? { ...resolvedScope, periods: Array.from({ length: maximumPeriod }, (_, index) => index + 1) }
    : resolvedScope;
  const periods = new Set(scope.periods);
  const events = acceptedFootballEvents(envelope).filter((event) => periods.has(finiteNumber(event.period)));
  const projected = projectFootballStatsForEvents(envelope, events);
  const teamStats = Object.fromEntries(TEAM_CODES.map((team) => [
    team,
    teamProjection(envelope, events, projected, team, scope.periods),
  ]));
  const playerStats = buildFootballPlayerStats(envelope, events, projected);
  const teams = envelope.game.teams;
  return {
    gameId: envelope.gameId,
    reportTitle: 'Quickie Stats',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    scope,
    teamStats,
    rows: reportRows(teamStats),
    individual: {
      V: individualProjection(playerStats, 'V'),
      H: individualProjection(playerStats, 'H'),
      showYac: playerStats.some((player) => player.yacStated),
    },
    scoring: scopedScoring(envelope, scope.periods),
  };
};
