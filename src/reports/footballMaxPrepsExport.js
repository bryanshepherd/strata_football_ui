import { projectFootballStatsForEvents } from '../services/footballDashboardService';
import {
  acceptedFootballEvents,
  buildFootballPlayerStats,
} from './footballQuickieStats';
import { footballKickoffGrossYards } from './footballTeamStats';

export const MAXPREPS_STAT_SUPPLIER_ID = '42987abe-b839-405c-9e4b-955fd70852bc';

export const MAXPREPS_FOOTBALL_FIELDS = Object.freeze([
  'Jersey',
  'RushingNum',
  'RushingYards',
  'RushingLong',
  'ReceivingNum',
  'ReceivingYards',
  'ReceivingLong',
  'PassingComp',
  'PassingAtt',
  'PassingInt',
  'PassingYards',
  'PassingTD',
  'PassingLong',
  'OffensiveFumbles',
  'OffensiveFumblesLost',
  'PancakeBlocks',
  'Tackles',
  'Assists',
  'TotalTackles',
  'TacklesForLoss',
  'Sacks',
  'SacksYardsLost',
  'QBHurries',
  'INTs',
  'INTYards',
  'PassesDefensed',
  'BlockedPunts',
  'BlockedFG',
  'FumbleRecoveries',
  'FumbleRecoveryYards',
  'CausedFumbles',
  'PuntReturnNum',
  'PuntReturnYards',
  'PuntReturnLong',
  'PuntReturnFairCatches',
  'KickoffReturnNum',
  'KickoffReturnYards',
  'KickoffReturnLong',
  'TotalReturnYards',
  'PuntNum',
  'PuntYards',
  'PuntLong',
  'PuntInside20',
  'KickoffNum',
  'KickoffYards',
  'KickoffLong',
  'KickoffTouchbacks',
  'RushingTDNum',
  'ReceivingTDNum',
  'FumbleReturnedTDNum',
  'IntReturnedTDNum',
  'PuntReturnedTDNum',
  'KickoffReturnedTDNum',
  'TotalTDNum',
  'PATKickingMade',
  'PATKickingAtt',
  'PATKickingPoints',
  'PATRushingNum',
  'PATReceivingNum',
  'TotalConversionPoints',
  'FGMade',
  'FGAttempted',
  'FGLong',
  'Safeties',
  'TotalPoints',
]);

const TEAM_CODES = ['V', 'H'];

const DEFENSIVE_FIELDS = [
  'Tackles',
  'Assists',
  'TacklesForLoss',
  'Sacks',
  'SacksYardsLost',
  'QBHurries',
  'INTs',
  'INTYards',
  'PassesDefensed',
  'BlockedPunts',
  'BlockedFG',
  'FumbleRecoveries',
  'FumbleRecoveryYards',
  'CausedFumbles',
  'Safeties',
];

const TOUCHDOWN_FIELDS = [
  'RushingTDNum',
  'ReceivingTDNum',
  'FumbleReturnedTDNum',
  'IntReturnedTDNum',
  'PuntReturnedTDNum',
  'KickoffReturnedTDNum',
];

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const optionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const readPath = (source, path) => String(path).split('.').reduce((value, key) => (
  value === undefined || value === null ? undefined : value[key]
), source);

const readOptionalNumber = (source, paths) => {
  for (const path of paths) {
    const value = optionalNumber(readPath(source, path));
    if (value !== undefined) return value;
  }
  return undefined;
};

const hasAcceptedPreviousSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && ['previous', 'previousspot'].includes(String(penalty.enforcedFrom || '').toLowerCase())
));

const normalizedRole = (participant) => String(participant?.role || '').toLowerCase();

const uniqueParticipants = (participants) => {
  const byPlayer = new Map();
  participants.filter((participant) => participant?.playerId).forEach((participant) => {
    if (!byPlayer.has(participant.playerId)) byPlayer.set(participant.playerId, participant);
  });
  return [...byPlayer.values()];
};

const eventParticipants = (event) => uniqueParticipants(Object.values(event?.participants || {})
  .flatMap((value) => (Array.isArray(value) ? value : [value]))
  .filter(Boolean));

const kickoffTeam = (event) => event?.participants?.kicker?.team
  || event?.participants?.primary?.team
  || event?.possession;

const touchdownReceiver = (event) => {
  const terminalLateral = Array.isArray(event?.result?.laterals)
    ? event.result.laterals.at(-1)
    : null;
  if (terminalLateral?.toPlayerId) {
    return {
      playerId: terminalLateral.toPlayerId,
      team: event.possession,
      role: 'receiver',
    };
  }
  return event?.participants?.receiver
    || event?.participants?.secondary
    || event?.participants?.target;
};

const scoringReturnType = (event) => {
  const explicit = String(event?.result?.return?.type || '').toLowerCase();
  if (explicit) return explicit;
  if (event?.type === 'kickoff') return 'kickoff';
  if (event?.type === 'punt') return 'punt';
  if (event?.type === 'pass' && (event?.result?.pass?.outcome || event?.subtype) === 'interception') {
    return 'interception';
  }
  return event?.result?.fumble?.turnover ? 'fumble' : '';
};

const explicitFieldAliases = {
  RushingNum: ['RushingNum', 'rushingNum', 'rushAttempts'],
  RushingYards: ['RushingYards', 'rushingYards', 'rushYards'],
  RushingLong: ['RushingLong', 'rushingLong', 'rushLong'],
  ReceivingNum: ['ReceivingNum', 'receivingNum', 'receptions'],
  ReceivingYards: ['ReceivingYards', 'receivingYards'],
  ReceivingLong: ['ReceivingLong', 'receivingLong'],
  PassingComp: ['PassingComp', 'passingComp', 'passCompletions'],
  PassingAtt: ['PassingAtt', 'passingAtt', 'passAttempts'],
  PassingInt: ['PassingInt', 'passingInt', 'passInterceptions'],
  PassingYards: ['PassingYards', 'passingYards', 'passYards'],
  PassingTD: ['PassingTD', 'passingTD', 'passTouchdowns'],
  PassingLong: ['PassingLong', 'passingLong', 'passLong'],
  OffensiveFumbles: ['OffensiveFumbles', 'offensiveFumbles', 'fumbles'],
  OffensiveFumblesLost: ['OffensiveFumblesLost', 'offensiveFumblesLost', 'fumblesLost'],
  PancakeBlocks: ['PancakeBlocks', 'pancakeBlocks'],
  Tackles: ['Tackles', 'tackles', 'soloTackles'],
  Assists: ['Assists', 'assists', 'assistedTackles'],
  TotalTackles: ['TotalTackles', 'totalTackles'],
  TacklesForLoss: ['TacklesForLoss', 'tacklesForLoss'],
  Sacks: ['Sacks', 'sacks'],
  SacksYardsLost: ['SacksYardsLost', 'sacksYardsLost', 'sackYardsLost'],
  QBHurries: ['QBHurries', 'qbHurries', 'quarterbackHurries'],
  INTs: ['INTs', 'ints', 'interceptions'],
  INTYards: ['INTYards', 'intYards', 'interceptionReturnYards'],
  PassesDefensed: ['PassesDefensed', 'passesDefensed', 'passBreakups'],
  BlockedPunts: ['BlockedPunts', 'blockedPunts'],
  BlockedFG: ['BlockedFG', 'blockedFG', 'blockedFieldGoals'],
  FumbleRecoveries: ['FumbleRecoveries', 'fumbleRecoveries'],
  FumbleRecoveryYards: ['FumbleRecoveryYards', 'fumbleRecoveryYards', 'fumbleReturnYards'],
  CausedFumbles: ['CausedFumbles', 'causedFumbles', 'forcedFumbles'],
  PuntReturnNum: ['PuntReturnNum', 'puntReturnNum', 'puntReturns'],
  PuntReturnYards: ['PuntReturnYards', 'puntReturnYards'],
  PuntReturnLong: ['PuntReturnLong', 'puntReturnLong'],
  PuntReturnFairCatches: ['PuntReturnFairCatches', 'puntReturnFairCatches', 'fairCatches'],
  KickoffReturnNum: ['KickoffReturnNum', 'kickoffReturnNum', 'kickReturns'],
  KickoffReturnYards: ['KickoffReturnYards', 'kickoffReturnYards', 'kickReturnYards'],
  KickoffReturnLong: ['KickoffReturnLong', 'kickoffReturnLong', 'kickReturnLong'],
  TotalReturnYards: ['TotalReturnYards', 'totalReturnYards'],
  PuntNum: ['PuntNum', 'puntNum', 'punts'],
  PuntYards: ['PuntYards', 'puntYards'],
  PuntLong: ['PuntLong', 'puntLong'],
  PuntInside20: ['PuntInside20', 'puntInside20'],
  KickoffNum: ['KickoffNum', 'kickoffNum', 'kickoffs'],
  KickoffYards: ['KickoffYards', 'kickoffYards'],
  KickoffLong: ['KickoffLong', 'kickoffLong'],
  KickoffTouchbacks: ['KickoffTouchbacks', 'kickoffTouchbacks'],
  RushingTDNum: ['RushingTDNum', 'rushingTDNum', 'rushTouchdowns'],
  ReceivingTDNum: ['ReceivingTDNum', 'receivingTDNum', 'receivingTouchdowns'],
  FumbleReturnedTDNum: ['FumbleReturnedTDNum', 'fumbleReturnedTDNum'],
  IntReturnedTDNum: ['IntReturnedTDNum', 'intReturnedTDNum', 'interceptionReturnTouchdowns'],
  PuntReturnedTDNum: ['PuntReturnedTDNum', 'puntReturnedTDNum', 'puntReturnTouchdowns'],
  KickoffReturnedTDNum: ['KickoffReturnedTDNum', 'kickoffReturnedTDNum', 'kickReturnTouchdowns'],
  TotalTDNum: ['TotalTDNum', 'totalTDNum', 'touchdowns'],
  PATKickingMade: ['PATKickingMade', 'patKickingMade'],
  PATKickingAtt: ['PATKickingAtt', 'patKickingAtt'],
  PATKickingPoints: ['PATKickingPoints', 'patKickingPoints'],
  PATRushingNum: ['PATRushingNum', 'patRushingNum'],
  PATReceivingNum: ['PATReceivingNum', 'patReceivingNum'],
  TotalConversionPoints: ['TotalConversionPoints', 'totalConversionPoints'],
  FGMade: ['FGMade', 'fgMade', 'fieldGoalsMade'],
  FGAttempted: ['FGAttempted', 'fgAttempted', 'fieldGoalsAttempted'],
  FGLong: ['FGLong', 'fgLong', 'fieldGoalLong'],
  Safeties: ['Safeties', 'safeties'],
  TotalPoints: ['TotalPoints', 'totalPoints', 'points'],
};

const playerIdentityLookup = (envelope, events) => {
  const lookup = new Map();
  TEAM_CODES.forEach((team) => {
    Object.values(envelope?.rosters?.teams?.[team]?.players || {}).forEach((player) => {
      lookup.set(player.playerId, { ...player, team: player.team || team });
    });
  });
  events.flatMap(eventParticipants).forEach((participant) => {
    const existing = lookup.get(participant.playerId) || {};
    lookup.set(participant.playerId, {
      ...participant,
      ...existing,
      team: existing.team || participant.team,
      jersey: existing.jersey ?? participant.jersey,
      displayName: existing.displayName || participant.displayName,
    });
  });
  return lookup;
};

const createRowStore = (envelope, events) => {
  const identity = playerIdentityLookup(envelope, events);
  const rows = new Map();
  const get = (playerId, team, participant) => {
    if (!playerId) return null;
    const known = identity.get(playerId) || participant || {};
    if (!rows.has(playerId)) {
      rows.set(playerId, {
        playerId,
        team: known.team || team,
        jersey: String(known.jersey ?? ''),
        name: String(known.displayName || [known.firstName, known.lastName].filter(Boolean).join(' ') || playerId),
        values: {},
      });
    }
    const row = rows.get(playerId);
    if (!row.team && team) row.team = team;
    if (!row.jersey && participant?.jersey !== undefined) row.jersey = String(participant.jersey);
    return row;
  };
  return { get, identity, rows };
};

const declare = (row, field, value) => {
  if (!row) return;
  const numeric = optionalNumber(value);
  if (numeric !== undefined) row.values[field] = numeric;
};

const declareZeroes = (row, fields) => fields.forEach((field) => {
  if (row && row.values[field] === undefined) row.values[field] = 0;
});

const increment = (row, field, amount = 1) => {
  if (!row) return;
  row.values[field] = finiteNumber(row.values[field]) + finiteNumber(amount);
};

const maximize = (row, field, value) => {
  if (!row) return;
  row.values[field] = Math.max(finiteNumber(row.values[field]), finiteNumber(value));
};

const initializeDefense = (row) => declareZeroes(row, DEFENSIVE_FIELDS);

const seedProjectedPlayerStats = (store, players) => {
  players.forEach((player) => {
    const row = store.get(player.playerId, player.team);
    if (player.rushAttempts > 0) {
      declare(row, 'RushingNum', player.rushAttempts);
      declare(row, 'RushingYards', player.rushYards);
      declare(row, 'RushingLong', player.rushLong);
      declare(row, 'RushingTDNum', player.rushTouchdowns);
    }
    if (player.passAttempts > 0 || player.sacksTaken > 0) {
      declare(row, 'PassingComp', player.passCompletions);
      declare(row, 'PassingAtt', player.passAttempts);
      declare(row, 'PassingInt', player.passInterceptions);
      declare(row, 'PassingYards', player.passYards);
      declare(row, 'PassingTD', player.passTouchdowns);
      declare(row, 'PassingLong', player.passLong);
    }
    if (
      player.targets > 0
      || player.receptions > 0
      || player.receivingYards !== 0
      || player.receivingTouchdowns > 0
    ) {
      declare(row, 'ReceivingNum', player.receptions);
      declare(row, 'ReceivingYards', player.receivingYards);
      declare(row, 'ReceivingLong', player.receivingLong);
      declare(row, 'ReceivingTDNum', player.receivingTouchdowns);
    }
    if (player.fumbles > 0) {
      declare(row, 'OffensiveFumbles', player.fumbles);
      declare(row, 'OffensiveFumblesLost', player.fumblesLost);
    }
    if (player.punts > 0) {
      declare(row, 'PuntNum', player.punts);
      declare(row, 'PuntYards', player.puntYards);
      declare(row, 'PuntLong', player.puntLong);
      declare(row, 'PuntInside20', player.puntInside20);
    }
    if (player.puntReturns > 0 || player.puntReturnYards !== 0) {
      declare(row, 'PuntReturnNum', player.puntReturns);
      declare(row, 'PuntReturnYards', player.puntReturnYards);
      declare(row, 'PuntReturnLong', player.puntReturnLong);
      declare(row, 'PuntReturnFairCatches', 0);
    }
    if (player.kickReturns > 0 || player.kickReturnYards !== 0) {
      declare(row, 'KickoffReturnNum', player.kickReturns);
      declare(row, 'KickoffReturnYards', player.kickReturnYards);
      declare(row, 'KickoffReturnLong', player.kickReturnLong);
    }
  });
};

const creditDefense = (store, event) => {
  if (hasAcceptedPreviousSpotPenalty(event)) return;
  const defenders = uniqueParticipants(event?.participants?.defenders || []);
  const tackleParticipants = defenders.filter((participant) => (
    ['tackler', 'assisttackler', 'sack'].includes(normalizedRole(participant))
  ));
  const explicitAssists = tackleParticipants.filter((participant) => normalizedRole(participant) === 'assisttackler');
  const primaryTacklers = tackleParticipants.filter((participant) => normalizedRole(participant) !== 'assisttackler');

  tackleParticipants.forEach((participant) => initializeDefense(store.get(participant.playerId, participant.team, participant)));

  if (explicitAssists.length > 0) {
    primaryTacklers.forEach((participant) => increment(store.get(participant.playerId, participant.team, participant), 'Tackles'));
    explicitAssists.forEach((participant) => increment(store.get(participant.playerId, participant.team, participant), 'Assists'));
  } else if (tackleParticipants.length === 1) {
    increment(store.get(tackleParticipants[0].playerId, tackleParticipants[0].team, tackleParticipants[0]), 'Tackles');
  } else {
    tackleParticipants.forEach((participant) => increment(store.get(participant.playerId, participant.team, participant), 'Assists'));
  }

  const loss = ['rush', 'pass'].includes(event?.type) && finiteNumber(event?.result?.yards) < 0;
  if (loss && tackleParticipants.length > 0) {
    const credit = 1 / tackleParticipants.length;
    tackleParticipants.forEach((participant) => increment(
      store.get(participant.playerId, participant.team, participant),
      'TacklesForLoss',
      credit,
    ));
  }

  const sackers = defenders.filter((participant) => normalizedRole(participant) === 'sack');
  if (sackers.length > 0) {
    const sackCredit = 1 / sackers.length;
    const yardCredit = Math.abs(finiteNumber(event?.result?.yards)) / sackers.length;
    sackers.forEach((participant) => {
      const row = store.get(participant.playerId, participant.team, participant);
      initializeDefense(row);
      increment(row, 'Sacks', sackCredit);
      increment(row, 'SacksYardsLost', yardCredit);
    });
  }

  const hurryIds = new Set(event?.result?.pass?.hurriedByPlayerIds || []);
  defenders.filter((participant) => normalizedRole(participant) === 'qbhurry').forEach((participant) => hurryIds.add(participant.playerId));
  hurryIds.forEach((playerId) => {
    const participant = defenders.find((candidate) => candidate.playerId === playerId) || store.identity.get(playerId);
    const row = store.get(playerId, participant?.team, participant);
    initializeDefense(row);
    increment(row, 'QBHurries');
  });

  const breakupIds = new Set([
    event?.result?.pass?.brokenUpByPlayerId,
    ...defenders.filter((participant) => normalizedRole(participant) === 'passbreakup').map((participant) => participant.playerId),
  ].filter(Boolean));
  breakupIds.forEach((playerId) => {
    const participant = defenders.find((candidate) => candidate.playerId === playerId) || store.identity.get(playerId);
    const row = store.get(playerId, participant?.team, participant);
    initializeDefense(row);
    increment(row, 'PassesDefensed');
  });

  const outcome = event?.result?.pass?.outcome || event?.subtype;
  if (event?.type === 'pass' && outcome === 'interception') {
    const interceptor = event?.participants?.interceptor
      || defenders.find((participant) => normalizedRole(participant) === 'interceptor')
      || store.identity.get(event?.result?.turnover?.playerId);
    const row = store.get(interceptor?.playerId || event?.result?.turnover?.playerId, interceptor?.team || event?.result?.turnover?.team, interceptor);
    if (row) {
      initializeDefense(row);
      increment(row, 'INTs');
      increment(row, 'INTYards', event?.result?.return?.returnYards ?? event?.result?.turnover?.returnYards);
    }
  }

  const blockerId = event?.result?.kick?.blockedByPlayerId;
  const blocker = defenders.find((participant) => (
    participant.playerId === blockerId || normalizedRole(participant) === 'blocker'
  )) || store.identity.get(blockerId);
  if (blocker && ['punt', 'fieldGoal'].includes(event?.type)) {
    const row = store.get(blocker.playerId, blocker.team, blocker);
    initializeDefense(row);
    increment(row, event.type === 'punt' ? 'BlockedPunts' : 'BlockedFG');
  }

  const fumble = event?.result?.fumble;
  if (fumble) {
    const forcedBy = event?.participants?.forcedBy
      || eventParticipants(event).find((participant) => (
        participant.playerId === fumble.forcedByPlayerId || normalizedRole(participant) === 'forcedfumble'
      ))
      || store.identity.get(fumble.forcedByPlayerId);
    if (forcedBy?.playerId) {
      const row = store.get(forcedBy.playerId, forcedBy.team, forcedBy);
      initializeDefense(row);
      increment(row, 'CausedFumbles');
    }

    const recoveredBy = event?.participants?.recoveredBy
      || eventParticipants(event).find((participant) => (
        participant.playerId === fumble.recoveredByPlayerId || normalizedRole(participant) === 'recoverer'
      ))
      || store.identity.get(fumble.recoveredByPlayerId);
    const fumbler = event?.participants?.fumbler
      || eventParticipants(event).find((participant) => participant.playerId === fumble.fumblerPlayerId)
      || store.identity.get(fumble.fumblerPlayerId);
    const recoveryTeam = fumble.recoveredByTeam || recoveredBy?.team;
    if (recoveredBy?.playerId && recoveryTeam && recoveryTeam !== fumbler?.team) {
      const row = store.get(recoveredBy.playerId, recoveryTeam, recoveredBy);
      initializeDefense(row);
      increment(row, 'FumbleRecoveries');
      increment(row, 'FumbleRecoveryYards', fumble.returnYards ?? event?.result?.return?.returnYards);
    }
  }

  if (event?.result?.scoring?.type === 'safety') {
    const safetyCandidates = uniqueParticipants([
      ...sackers,
      ...primaryTacklers,
      event?.participants?.forcedBy,
    ].filter(Boolean));
    if (safetyCandidates.length === 1) {
      const participant = safetyCandidates[0];
      const row = store.get(participant.playerId, participant.team, participant);
      initializeDefense(row);
      increment(row, 'Safeties');
    }
  }
};

const creditSpecialTeams = (store, envelope, event) => {
  if (hasAcceptedPreviousSpotPenalty(event)) return;
  if (event?.type === 'punt' && ['faircatch'].includes(String(event?.result?.code || event?.subtype || '').toLowerCase())) {
    const returner = event?.participants?.returner;
    const row = store.get(returner?.playerId, returner?.team, returner);
    if (row) {
      declareZeroes(row, ['PuntReturnNum', 'PuntReturnYards', 'PuntReturnLong', 'PuntReturnFairCatches']);
      increment(row, 'PuntReturnFairCatches');
    }
  }

  if (event?.type === 'kickoff') {
    const kicker = event?.participants?.kicker || event?.participants?.primary;
    const row = store.get(kicker?.playerId, kicker?.team || kickoffTeam(event), kicker);
    if (row) {
      declareZeroes(row, ['KickoffNum', 'KickoffYards', 'KickoffLong', 'KickoffTouchbacks']);
      const yards = footballKickoffGrossYards(envelope, event);
      increment(row, 'KickoffNum');
      increment(row, 'KickoffYards', yards);
      maximize(row, 'KickoffLong', yards);
      if (['touchback'].includes(String(event?.result?.code || event?.subtype || '').toLowerCase())) {
        increment(row, 'KickoffTouchbacks');
      }
    }
  }
};

const creditKickingAndConversions = (store, event) => {
  if (hasAcceptedPreviousSpotPenalty(event)) return;
  const resultCode = String(event?.result?.code || event?.subtype || '').toLowerCase();
  const made = ['made', 'good'].includes(resultCode);

  if (event?.type === 'fieldGoal') {
    const kicker = event?.participants?.kicker || event?.participants?.primary;
    const row = store.get(kicker?.playerId, kicker?.team || event?.possession, kicker);
    if (row) {
      declareZeroes(row, ['FGMade', 'FGAttempted', 'FGLong']);
      increment(row, 'FGAttempted');
      if (made) {
        increment(row, 'FGMade');
        maximize(row, 'FGLong', event?.result?.kick?.attemptYards);
      }
    }
  }

  if (event?.type !== 'try') return;
  const subtype = String(event?.subtype || '').toLowerCase();
  const successful = Boolean(event?.result?.scoring) && finiteNumber(event.result.scoring.points) > 0;
  if (subtype === 'kick') {
    const kicker = event?.participants?.kicker || event?.participants?.primary;
    const row = store.get(kicker?.playerId, kicker?.team, kicker);
    if (row) {
      declareZeroes(row, ['PATKickingMade', 'PATKickingAtt', 'PATKickingPoints']);
      increment(row, 'PATKickingAtt');
      if (made || successful) {
        increment(row, 'PATKickingMade');
        increment(row, 'PATKickingPoints', event?.result?.scoring?.points || 1);
      }
    }
  }
  if (subtype === 'rush') {
    const rusher = event?.participants?.primary;
    const row = store.get(rusher?.playerId, rusher?.team, rusher);
    if (row) {
      declareZeroes(row, ['PATRushingNum', 'TotalConversionPoints']);
      if (successful) {
        increment(row, 'PATRushingNum');
        increment(row, 'TotalConversionPoints', event.result.scoring.points || 2);
      }
    }
  }
  if (subtype === 'pass') {
    const receiver = touchdownReceiver(event);
    const row = store.get(receiver?.playerId, receiver?.team, receiver);
    if (row) {
      declareZeroes(row, ['PATReceivingNum', 'TotalConversionPoints']);
      if (successful) {
        increment(row, 'PATReceivingNum');
        increment(row, 'TotalConversionPoints', event.result.scoring.points || 2);
      }
    }
  }
};

const creditReturnTouchdown = (store, event) => {
  if (hasAcceptedPreviousSpotPenalty(event) || event?.result?.scoring?.type !== 'touchdown') return;
  const type = scoringReturnType(event);
  const field = {
    fumble: 'FumbleReturnedTDNum',
    interception: 'IntReturnedTDNum',
    punt: 'PuntReturnedTDNum',
    kickoff: 'KickoffReturnedTDNum',
  }[type];
  if (!field) return;
  const returner = event?.participants?.returner
    || (type === 'interception' ? event?.participants?.interceptor : null)
    || (type === 'fumble' ? event?.participants?.recoveredBy : null)
    || store.identity.get(event?.result?.return?.returnerPlayerId)
    || store.identity.get(event?.result?.turnover?.playerId)
    || store.identity.get(event?.result?.fumble?.recoveredByPlayerId);
  const row = store.get(
    event?.result?.return?.returnerPlayerId
      || returner?.playerId
      || event?.result?.turnover?.playerId
      || event?.result?.fumble?.recoveredByPlayerId,
    returner?.team || event?.result?.scoring?.team,
    returner,
  );
  if (row) {
    if (field === 'FumbleReturnedTDNum' || field === 'IntReturnedTDNum') initializeDefense(row);
    declareZeroes(row, [field]);
    increment(row, field);
  }
};

const applyExplicitPlayerStats = (envelope, store) => {
  Object.entries(envelope?.stats?.players || {}).forEach(([playerId, source]) => {
    const row = store.get(source?.playerId || playerId, source?.team);
    if (!row) return;
    MAXPREPS_FOOTBALL_FIELDS.slice(1).forEach((field) => {
      if (row.values[field] !== undefined) return;
      const value = readOptionalNumber(source, explicitFieldAliases[field] || [field]);
      if (value !== undefined) row.values[field] = value;
    });
  });
};

const finalizeRows = (rows) => rows.forEach((row) => {
  if (row.values.Tackles !== undefined || row.values.Assists !== undefined) {
    if (row.values.TotalTackles === undefined) {
      row.values.TotalTackles = finiteNumber(row.values.Tackles) + finiteNumber(row.values.Assists);
    }
  }
  if (
    row.values.PuntReturnNum !== undefined
    || row.values.KickoffReturnNum !== undefined
    || row.values.TotalReturnYards !== undefined
  ) {
    if (row.values.TotalReturnYards === undefined) {
      row.values.TotalReturnYards = finiteNumber(row.values.PuntReturnYards)
        + finiteNumber(row.values.KickoffReturnYards);
    }
  }
  if (TOUCHDOWN_FIELDS.some((field) => row.values[field] !== undefined)) {
    if (row.values.TotalTDNum === undefined) {
      row.values.TotalTDNum = TOUCHDOWN_FIELDS.reduce((total, field) => total + finiteNumber(row.values[field]), 0);
    }
  }
  const hasScoringValue = [
    'TotalTDNum',
    'PATKickingPoints',
    'TotalConversionPoints',
    'FGMade',
    'Safeties',
  ].some((field) => row.values[field] !== undefined);
  if (hasScoringValue && row.values.TotalPoints === undefined) {
    row.values.TotalPoints = (finiteNumber(row.values.TotalTDNum) * 6)
      + finiteNumber(row.values.PATKickingPoints)
      + finiteNumber(row.values.TotalConversionPoints)
      + (finiteNumber(row.values.FGMade) * 3)
      + (finiteNumber(row.values.Safeties) * 2);
  }
});

const formatMaxPrepsValue = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (Object.is(numeric, -0)) return '0';
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(3)));
};

const compareJerseys = (left, right) => {
  const leftNumber = Number(left.jersey);
  const rightNumber = Number(right.jersey);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.jersey.localeCompare(right.jersey, undefined, { numeric: true })
    || left.name.localeCompare(right.name);
};

const safeFilenameToken = (value, fallback) => {
  const token = String(value || fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["'()]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return token || fallback;
};

const gameDateToken = (scheduledAt) => {
  const match = String(scheduledAt || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : 'game';
};

export const buildMaxPrepsFilename = (envelope, team) => {
  const teamRecord = envelope?.game?.teams?.[team] || {};
  const teamToken = safeFilenameToken(teamRecord.abbr || teamRecord.name, team.toLowerCase());
  return `${gameDateToken(envelope?.game?.scheduledAt)}-${teamToken}-maxpreps.txt`;
};

export const serializeMaxPrepsTeam = ({ fields, players }) => {
  const lines = [MAXPREPS_STAT_SUPPLIER_ID, fields.join('|')];
  players.forEach((player) => {
    lines.push(fields.map((field) => (
      field === 'Jersey' ? player.jersey : formatMaxPrepsValue(player.values[field])
    )).join('|'));
  });
  return `${lines.join('\r\n')}\r\n`;
};

export const buildFootballMaxPrepsExports = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for MaxPreps export.');
  }
  const events = acceptedFootballEvents(envelope);
  const projected = projectFootballStatsForEvents(envelope, events);
  const players = buildFootballPlayerStats(envelope, events, projected);
  const store = createRowStore(envelope, events);

  seedProjectedPlayerStats(store, players);
  events.forEach((event) => {
    creditDefense(store, event);
    creditSpecialTeams(store, envelope, event);
    creditKickingAndConversions(store, event);
    creditReturnTouchdown(store, event);
  });
  applyExplicitPlayerStats(envelope, store);
  const allRows = [...store.rows.values()];
  finalizeRows(allRows);

  const exports = Object.fromEntries(TEAM_CODES.map((team) => {
    const candidateRows = allRows.filter((row) => (
      row.team === team && Object.keys(row.values).length > 0
    ));
    const omittedPlayers = candidateRows.filter((row) => (
      !row.jersey || row.jersey === '—' || /[|\r\n]/.test(row.jersey)
    ));
    const teamPlayers = candidateRows
      .filter((row) => !omittedPlayers.includes(row))
      .sort(compareJerseys);
    const fields = [...MAXPREPS_FOOTBALL_FIELDS];
    const teamRecord = envelope.game.teams[team];
    const exportRecord = {
      team,
      teamName: teamRecord.name || teamRecord.abbr || team,
      filename: buildMaxPrepsFilename(envelope, team),
      fields,
      players: teamPlayers,
      omittedPlayers: omittedPlayers.map((row) => ({
        playerId: row.playerId,
        jersey: row.jersey,
        name: row.name,
      })),
    };
    return [team, {
      ...exportRecord,
      content: serializeMaxPrepsTeam(exportRecord),
    }];
  }));

  return {
    gameId: envelope.gameId,
    supplierId: MAXPREPS_STAT_SUPPLIER_ID,
    exports,
  };
};
