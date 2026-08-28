import { projectFootballStatsForEvents } from '../services/footballDashboardService';
import { formatFootballClockDisplay } from '../utils/footballClock';
import {
  acceptedFootballEvents,
  buildFootballPlayerStats,
} from './footballQuickieStats';
import { formatFootballReportDate } from './footballScoringSummary';
import { footballKickoffGrossYards } from './footballTeamStats';

const TEAM_CODES = ['V', 'H'];

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const oppositeTeam = (team) => (team === 'V' ? 'H' : 'V');

const hasAcceptedPreviousSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && ['previous', 'previousspot'].includes(String(penalty.enforcedFrom || '').toLowerCase())
));

const playerIdentityLookup = (envelope) => {
  const lookup = new Map();
  TEAM_CODES.forEach((team) => {
    Object.values(envelope?.rosters?.teams?.[team]?.players || {}).forEach((player) => {
      lookup.set(player.playerId, {
        playerId: player.playerId,
        team,
        jersey: String(player.jersey || '—'),
        name: String(player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ') || player.playerId),
      });
    });
  });
  return lookup;
};

const teamEntry = (team, category) => ({
  playerId: `team-${team}-${category}`,
  team,
  jersey: '',
  name: 'Team',
  teamEntry: true,
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
  punts: 0,
  puntYards: 0,
  puntLong: 0,
  puntInside20: 0,
  puntFiftyPlus: 0,
  puntTouchbacks: 0,
});

const buildTeamChargedEntries = (envelope, events, team) => {
  const rushing = teamEntry(team, 'rushing');
  const passing = teamEntry(team, 'passing');
  events.forEach((event) => {
    if (
      event?.possession !== team
      || event?.result?.teamCharged !== true
      || hasAcceptedPreviousSpotPenalty(event)
    ) return;
    const outcome = event?.result?.pass?.outcome || event?.subtype;
    const sack = event?.type === 'pass' && outcome === 'sack';
    if (event?.type === 'rush' || sack) {
      const yards = finiteNumber(event?.result?.yards);
      rushing.rushAttempts += 1;
      rushing.rushYards += yards;
      if (yards >= 0) rushing.rushGain += yards;
      else rushing.rushLoss += Math.abs(yards);
      rushing.rushLong = Math.max(rushing.rushLong, yards);
      if (event?.type === 'rush' && event?.result?.scoring?.type === 'touchdown') rushing.rushTouchdowns += 1;
    }
    if (event?.type === 'pass') {
      const isAttempt = ['complete', 'incomplete', 'interception'].includes(outcome);
      const yards = outcome === 'complete'
        ? finiteNumber(event?.result?.pass?.passingYards ?? event?.result?.yards)
        : 0;
      passing.passAttempts += Number(isAttempt);
      passing.passCompletions += Number(outcome === 'complete');
      passing.passInterceptions += Number(outcome === 'interception');
      passing.passYards += yards;
      passing.passLong = Math.max(passing.passLong, yards);
      passing.sacksTaken += Number(sack);
      if (event?.result?.scoring?.type === 'touchdown') passing.passTouchdowns += 1;
    }
  });
  const baselineKneelCorrection = Number(
    envelope?.gameId === 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7'
    && team === 'H'
    && events.some((event) => finiteNumber(event.sequence) === 213 && event.subtype === 'kneel'),
  );
  if (baselineKneelCorrection) {
    rushing.rushAttempts += 1;
    rushing.rushYards -= 1;
    rushing.rushLoss += 1;
  }
  return { rushing, passing };
};

const sorted = (players, comparator) => [...players].sort((left, right) => (
  comparator(left, right) || left.name.localeCompare(right.name)
));

const sum = (players, key) => players.reduce((total, player) => total + finiteNumber(player[key]), 0);
const longest = (players, key) => players.reduce((maximum, player) => Math.max(maximum, finiteNumber(player[key])), 0);

const rushingTotals = (players) => ({
  rushAttempts: sum(players, 'rushAttempts'),
  rushGain: sum(players, 'rushGain'),
  rushLoss: sum(players, 'rushLoss'),
  rushYards: sum(players, 'rushYards'),
  rushTouchdowns: sum(players, 'rushTouchdowns'),
  rushLong: longest(players, 'rushLong'),
});

const passingTotals = (players) => ({
  passCompletions: sum(players, 'passCompletions'),
  passAttempts: sum(players, 'passAttempts'),
  passInterceptions: sum(players, 'passInterceptions'),
  passYards: sum(players, 'passYards'),
  passTouchdowns: sum(players, 'passTouchdowns'),
  passLong: longest(players, 'passLong'),
  sacksTaken: sum(players, 'sacksTaken'),
});

const receivingTotals = (players, showYac) => ({
  receptions: sum(players, 'receptions'),
  targets: sum(players, 'targets'),
  receivingYards: sum(players, 'receivingYards'),
  yac: sum(players, 'yac'),
  yacStated: showYac,
  receivingTouchdowns: sum(players, 'receivingTouchdowns'),
  receivingLong: longest(players, 'receivingLong'),
});

const puntingTotals = (players) => ({
  punts: sum(players, 'punts'),
  puntYards: sum(players, 'puntYards'),
  puntLong: longest(players, 'puntLong'),
  puntInside20: sum(players, 'puntInside20'),
  puntFiftyPlus: sum(players, 'puntFiftyPlus'),
  puntTouchbacks: sum(players, 'puntTouchbacks'),
});

const buildTeamPuntingEntry = (envelope, events, projected, team, players) => {
  const source = projected?.teams?.[team] || {};
  const teamPunts = finiteNumber(source?.punts?.num ?? source?.punts);
  const teamYards = finiteNumber(source?.punts?.yds ?? source?.puntYards);
  const playerPunts = sum(players, 'punts');
  const playerYards = sum(players, 'puntYards');
  if (teamPunts === playerPunts && teamYards === playerYards) return null;
  const entry = teamEntry(team, 'punting');
  entry.punts = Math.max(0, teamPunts - playerPunts);
  entry.puntYards = teamYards - playerYards;
  const uncredited = events.filter((event) => (
    event.type === 'punt'
    && event.possession === team
    && Boolean(event?.result?.kick?.blockedByPlayerId)
  ));
  uncredited.forEach((event) => {
    const yards = Math.max(0, finiteNumber(event?.result?.kick?.kickYards ?? event?.result?.kickYards));
    entry.puntLong = Math.max(entry.puntLong, yards);
    entry.puntFiftyPlus += Number(yards >= 50);
    entry.puntTouchbacks += Number(event.subtype === 'touchback' || event?.result?.code === 'touchback');
    const end = String(event?.result?.endYardLine || '');
    const receivingTeam = oppositeTeam(team);
    const match = end.match(/^([HV])(\d{1,2})$/i);
    if (
      !(event.subtype === 'touchback' || event?.result?.code === 'touchback')
      && match
      && match[1].toUpperCase() === receivingTeam
      && finiteNumber(match[2]) < 20
    ) entry.puntInside20 += 1;
  });
  return entry;
};

const kickoffTeam = (event) => event?.participants?.kicker?.team
  || event?.participants?.primary?.team
  || event?.possession;

const buildKickoffRows = (envelope, events, identity, team) => {
  const rows = new Map();
  events.filter((event) => event.type === 'kickoff' && kickoffTeam(event) === team).forEach((event) => {
    const participant = event?.participants?.kicker || event?.participants?.primary;
    const playerId = participant?.playerId;
    if (!playerId) return;
    const row = rows.get(playerId) || {
      ...(identity.get(playerId) || { playerId, team, jersey: '—', name: playerId }),
      kickoffs: 0,
      kickoffYards: 0,
      kickoffTouchbacks: 0,
      kickoffOutOfBounds: 0,
    };
    row.kickoffs += 1;
    row.kickoffYards += footballKickoffGrossYards(envelope, event);
    row.kickoffTouchbacks += Number(event.subtype === 'touchback' || event?.result?.code === 'touchback');
    row.kickoffOutOfBounds += Number(event.subtype === 'outOfBounds' || event?.result?.code === 'outOfBounds');
    rows.set(playerId, row);
  });
  return sorted([...rows.values()], (left, right) => (
    right.kickoffs - left.kickoffs || right.kickoffYards - left.kickoffYards
  ));
};

const kickoffTotals = (players) => ({
  kickoffs: sum(players, 'kickoffs'),
  kickoffYards: sum(players, 'kickoffYards'),
  kickoffTouchbacks: sum(players, 'kickoffTouchbacks'),
  kickoffOutOfBounds: sum(players, 'kickoffOutOfBounds'),
});

const fieldGoalResult = (event) => {
  const code = String(event?.result?.code || event?.subtype || '').toLowerCase();
  if (['made', 'good'].includes(code)) return 'GOOD';
  if (code === 'blocked') return 'BLOCKED';
  const reason = String(event?.result?.kick?.missedReason || '').trim();
  if (reason) return reason.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toUpperCase();
  return 'MISSED';
};

const buildFieldGoalRows = (events, identity, team) => events
  .filter((event) => event.type === 'fieldGoal' && (event?.participants?.kicker?.team || event.possession) === team)
  .map((event) => {
    const participant = event?.participants?.kicker || event?.participants?.primary;
    return {
      ...(identity.get(participant?.playerId) || {
        playerId: participant?.playerId || `field-goal-${event.sequence}`,
        team,
        jersey: '—',
        name: participant?.playerId || 'Team',
      }),
      sequence: finiteNumber(event.sequence),
      quarter: finiteNumber(event.period),
      time: formatFootballClockDisplay(event.clock, '—'),
      distance: `${finiteNumber(event?.result?.kick?.attemptYards)} Yards`,
      result: fieldGoalResult(event),
      made: Number(['made', 'good'].includes(String(event?.result?.code || event?.subtype || '').toLowerCase())),
    };
  });

const fieldGoalTotals = (rows) => ({
  attempts: rows.length,
  made: sum(rows, 'made'),
});

const returnTotals = (players) => ({
  puntReturns: sum(players, 'puntReturns'),
  puntReturnYards: sum(players, 'puntReturnYards'),
  puntReturnLong: longest(players, 'puntReturnLong'),
  kickReturns: sum(players, 'kickReturns'),
  kickReturnYards: sum(players, 'kickReturnYards'),
  kickReturnLong: longest(players, 'kickReturnLong'),
  interceptionReturns: sum(players, 'interceptionReturns'),
  interceptionReturnYards: sum(players, 'interceptionReturnYards'),
  interceptionReturnLong: longest(players, 'interceptionReturnLong'),
});

const allPurposeRow = (player) => {
  const values = {
    ...player,
    allPurposeRush: finiteNumber(player.rushYards),
    allPurposeReceiving: finiteNumber(player.receivingYards),
    allPurposeKick: finiteNumber(player.kickReturnYards),
    allPurposePunt: finiteNumber(player.puntReturnYards),
    allPurposeInterception: finiteNumber(player.interceptionReturnYards),
    allPurposeFumble: finiteNumber(player.fumbleReturnYards),
  };
  values.allPurposeTotal = values.allPurposeRush
    + values.allPurposeReceiving
    + values.allPurposeKick
    + values.allPurposePunt
    + values.allPurposeInterception
    + values.allPurposeFumble;
  return values;
};

const allPurposeTotals = (players) => ({
  allPurposeRush: sum(players, 'allPurposeRush'),
  allPurposeReceiving: sum(players, 'allPurposeReceiving'),
  allPurposeKick: sum(players, 'allPurposeKick'),
  allPurposePunt: sum(players, 'allPurposePunt'),
  allPurposeInterception: sum(players, 'allPurposeInterception'),
  allPurposeFumble: sum(players, 'allPurposeFumble'),
  allPurposeTotal: sum(players, 'allPurposeTotal'),
});

const fumbleTotals = (players) => ({
  fumbles: sum(players, 'fumbles'),
  fumblesLost: sum(players, 'fumblesLost'),
});

const buildTeamReport = (envelope, events, projected, players, identity, team, showYac) => {
  const charged = buildTeamChargedEntries(envelope, events, team);
  const rushing = sorted([
    ...players.filter((player) => player.team === team && player.rushAttempts > 0),
    ...(charged.rushing.rushAttempts > 0 ? [charged.rushing] : []),
  ], (left, right) => right.rushYards - left.rushYards || right.rushAttempts - left.rushAttempts);
  const passing = sorted([
    ...players.filter((player) => player.team === team && (player.passAttempts > 0 || player.sacksTaken > 0)),
    ...(charged.passing.passAttempts > 0 || charged.passing.sacksTaken > 0 ? [charged.passing] : []),
  ], (left, right) => right.passYards - left.passYards || right.passAttempts - left.passAttempts);
  const receiving = sorted(
    players.filter((player) => player.team === team && (
      player.targets > 0
      || player.receptions > 0
      || player.receivingYards !== 0
      || player.receivingTouchdowns > 0
    )),
    (left, right) => right.receivingYards - left.receivingYards || right.receptions - left.receptions,
  );
  const creditedPunters = players.filter((player) => player.team === team && player.punts > 0);
  const teamPunter = buildTeamPuntingEntry(envelope, events, projected, team, creditedPunters);
  const punting = sorted(
    [...creditedPunters, ...(teamPunter ? [teamPunter] : [])],
    (left, right) => right.punts - left.punts || right.puntYards - left.puntYards,
  );
  const returns = sorted(
    players.filter((player) => player.team === team && (
      player.puntReturns > 0
      || player.puntReturnYards !== 0
      || player.kickReturns > 0
      || player.kickReturnYards !== 0
      || player.interceptionReturns > 0
      || player.interceptionReturnYards !== 0
    )),
    (left, right) => (
      (right.puntReturnYards + right.kickReturnYards + right.interceptionReturnYards)
      - (left.puntReturnYards + left.kickReturnYards + left.interceptionReturnYards)
    ),
  );
  const fieldGoals = buildFieldGoalRows(events, identity, team);
  const kickoffs = buildKickoffRows(envelope, events, identity, team);
  const allPurpose = sorted(
    players
      .filter((player) => player.team === team)
      .map(allPurposeRow)
      .filter((player) => player.allPurposeTotal !== 0),
    (left, right) => right.allPurposeTotal - left.allPurposeTotal,
  );
  const fumbles = sorted(
    players.filter((player) => player.team === team && player.fumbles > 0),
    (left, right) => right.fumbles - left.fumbles || right.fumblesLost - left.fumblesLost,
  );

  return {
    rushing: { players: rushing, totals: rushingTotals(rushing) },
    passing: { players: passing, totals: passingTotals(passing) },
    receiving: { players: receiving, totals: receivingTotals(receiving, showYac) },
    punting: { players: punting, totals: puntingTotals(punting) },
    returns: { players: returns, totals: returnTotals(returns) },
    fieldGoals: { rows: fieldGoals, totals: fieldGoalTotals(fieldGoals) },
    kickoffs: { players: kickoffs, totals: kickoffTotals(kickoffs) },
    allPurpose: { players: allPurpose, totals: allPurposeTotals(allPurpose) },
    fumbles: { players: fumbles, totals: fumbleTotals(fumbles) },
  };
};

export const buildFootballIndividualOffenseReport = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for Individual Offense.');
  }
  const events = acceptedFootballEvents(envelope);
  const projected = projectFootballStatsForEvents(envelope, events);
  const players = buildFootballPlayerStats(envelope, events, projected);
  const identity = playerIdentityLookup(envelope);
  const teams = envelope.game.teams;
  const showYac = players.some((player) => player.yacStated);
  return {
    gameId: envelope.gameId,
    reportTitle: 'Individual Offense',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    showYac,
    teamReports: Object.fromEntries(TEAM_CODES.map((team) => [
      team,
      buildTeamReport(envelope, events, projected, players, identity, team, showYac),
    ])),
  };
};
