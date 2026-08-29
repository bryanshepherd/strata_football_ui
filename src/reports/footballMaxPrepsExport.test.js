import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  buildFootballMaxPrepsExports,
  MAXPREPS_FOOTBALL_FIELDS,
  MAXPREPS_STAT_SUPPLIER_ID,
} from './footballMaxPrepsExport';

const player = (playerId, team, jersey, displayName = playerId) => ({
  playerId,
  team,
  jersey,
  displayName,
  active: true,
});

const participant = (record, role) => ({
  playerId: record.playerId,
  team: record.team,
  jersey: record.jersey,
  displayName: record.displayName,
  role,
});

const envelopeWithEvents = (events, players = {}) => {
  const envelope = structuredClone(baselineRecord.envelope);
  envelope.gameId = 'FB-MAXPREPS-TEST';
  envelope.game.scheduledAt = '2026-08-29T19:00:00-04:00';
  envelope.game.teams.V = { ...envelope.game.teams.V, name: 'Visitor (Test)', abbr: 'VIS' };
  envelope.game.teams.H = { ...envelope.game.teams.H, name: 'Home "Test"', abbr: 'HOM' };
  envelope.rosters.teams = {
    V: { ...envelope.rosters.teams.V, players: {} },
    H: { ...envelope.rosters.teams.H, players: {} },
  };
  Object.values(players).forEach((record) => {
    envelope.rosters.teams[record.team].players[record.playerId] = record;
  });
  envelope.events = events.map((event, index) => ({
    eventId: `MAXPREPS-${index + 1}`,
    sequence: index + 1,
    status: 'accepted',
    period: 1,
    clock: '10:00',
    preState: {
      possession: event.possession ?? 'H',
      down: 1,
      distance: 10,
      yardLine: 'H20',
      lineToGain: 'H30',
      driveId: 'DRV-MAXPREPS',
      driveNumber: 1,
    },
    penalties: [],
    ...event,
  }));
  envelope.stats = { sourceEventSequence: 0, teams: {}, players: {} };
  return envelope;
};

const rowFor = (teamExport, playerId) => teamExport.players.find((row) => row.playerId === playerId);

describe('football MaxPreps export', () => {
  it('defines every requested Boys Football field in exact MaxPreps order', () => {
    expect(MAXPREPS_STAT_SUPPLIER_ID).toBe('42987abe-b839-405c-9e4b-955fd70852bc');
    expect(MAXPREPS_FOOTBALL_FIELDS).toEqual([
      'Jersey',
      'RushingNum', 'RushingYards', 'RushingLong',
      'ReceivingNum', 'ReceivingYards', 'ReceivingLong',
      'PassingComp', 'PassingAtt', 'PassingInt', 'PassingYards', 'PassingTD', 'PassingLong',
      'OffensiveFumbles', 'OffensiveFumblesLost',
      'PancakeBlocks',
      'Tackles', 'Assists', 'TotalTackles', 'TacklesForLoss',
      'Sacks', 'SacksYardsLost', 'QBHurries',
      'INTs', 'INTYards', 'PassesDefensed',
      'BlockedPunts', 'BlockedFG',
      'FumbleRecoveries', 'FumbleRecoveryYards', 'CausedFumbles',
      'PuntReturnNum', 'PuntReturnYards', 'PuntReturnLong', 'PuntReturnFairCatches',
      'KickoffReturnNum', 'KickoffReturnYards', 'KickoffReturnLong',
      'TotalReturnYards',
      'PuntNum', 'PuntYards', 'PuntLong', 'PuntInside20',
      'KickoffNum', 'KickoffYards', 'KickoffLong', 'KickoffTouchbacks',
      'RushingTDNum', 'ReceivingTDNum', 'FumbleReturnedTDNum', 'IntReturnedTDNum',
      'PuntReturnedTDNum', 'KickoffReturnedTDNum', 'TotalTDNum',
      'PATKickingMade', 'PATKickingAtt', 'PATKickingPoints',
      'PATRushingNum', 'PATReceivingNum', 'TotalConversionPoints',
      'FGMade', 'FGAttempted', 'FGLong',
      'Safeties',
      'TotalPoints',
    ]);
  });

  it('builds separate accredited CRLF text files and preserves exact jersey formatting', () => {
    const rusher = player('H-RUSH', 'H', '02', 'Leading Zero');
    const passer = player('H-PASS', 'H', '7', 'Passer');
    const envelope = envelopeWithEvents([
      {
        type: 'rush',
        subtype: 'tackle',
        possession: 'H',
        participants: { primary: participant(rusher, 'rusher'), defenders: [] },
        result: { code: 'tackle', yards: 0, endYardLine: 'H20' },
      },
      {
        type: 'pass',
        subtype: 'incomplete',
        possession: 'H',
        participants: {
          primary: participant(passer, 'passer'),
          secondary: participant(rusher, 'intendedReceiver'),
          target: participant(rusher, 'intendedReceiver'),
          receiver: null,
          interceptor: null,
          defenders: [],
        },
        result: { code: 'incomplete', pass: { outcome: 'incomplete' }, yards: 0, endYardLine: 'H20' },
      },
    ], { rusher, passer });

    const report = buildFootballMaxPrepsExports(envelope);
    const home = report.exports.H;
    const rusherRow = rowFor(home, rusher.playerId);
    const passerRow = rowFor(home, passer.playerId);

    expect(Object.keys(report.exports)).toEqual(['V', 'H']);
    expect(home.filename).toBe('2026-08-29-hom-maxpreps.txt');
    expect(home.filename).not.toMatch(/["'()]/);
    expect(home.content.startsWith(`${MAXPREPS_STAT_SUPPLIER_ID}\r\nJersey|`)).toBe(true);
    expect(home.content.endsWith('\r\n')).toBe(true);
    expect(home.fields).toEqual(MAXPREPS_FOOTBALL_FIELDS);
    expect(rusherRow.jersey).toBe('02');
    expect(rusherRow.values).toMatchObject({ RushingNum: 1, RushingYards: 0, RushingLong: 0 });
    expect(rusherRow.values.PassingInt).toBeUndefined();
    expect(passerRow.values).toMatchObject({ PassingComp: 0, PassingAtt: 1, PassingInt: 0, PassingYards: 0 });

    const lines = home.content.split('\r\n');
    const headers = lines[1].split('|');
    const rusherLine = lines.find((line) => line.startsWith('02|')).split('|');
    expect(rusherLine[headers.indexOf('RushingYards')]).toBe('0');
    expect(rusherLine[headers.indexOf('PassingInt')]).toBe('');
  });

  it('projects defense, returns, kicking, conversions, touchdowns, and explicit pancake blocks', () => {
    const qb = player('H-QB', 'H', '10');
    const fumbler = player('H-FUM', 'H', '20');
    const sackOne = player('V-S1', 'V', '31');
    const sackTwo = player('V-S2', 'V', '32');
    const interceptor = player('V-INT', 'V', '33');
    const recoverer = player('V-REC', 'V', '34');
    const forcer = player('V-FORCE', 'V', '35');
    const blocker = player('V-BLOCK', 'V', '36');
    const cover = player('V-COVER', 'V', '37');
    const returner = player('H-RET', 'H', '40');
    const kicker = player('H-K', 'H', '90');
    const converter = player('H-CONV', 'H', '8');
    const receiver = player('H-CONV-REC', 'H', '9');
    const players = Object.fromEntries([
      qb, fumbler, sackOne, sackTwo, interceptor, recoverer, forcer, blocker,
      cover, returner, kicker, converter, receiver,
    ].map((record) => [record.playerId, record]));

    const envelope = envelopeWithEvents([
      {
        type: 'pass', subtype: 'sack', possession: 'H',
        participants: {
          primary: participant(qb, 'sackVictim'),
          defenders: [participant(sackOne, 'sack'), participant(sackTwo, 'sack')],
        },
        result: { code: 'sack', yards: -8, endYardLine: 'H12', pass: { outcome: 'sack' } },
      },
      {
        type: 'pass', subtype: 'interception', possession: 'H',
        participants: {
          primary: participant(qb, 'passer'),
          secondary: participant(receiver, 'intendedReceiver'),
          target: participant(receiver, 'intendedReceiver'),
          receiver: null,
          interceptor: participant(interceptor, 'interceptor'),
          returner: participant(interceptor, 'returner'),
          defenders: [participant(interceptor, 'interceptor')],
        },
        result: {
          code: 'interception',
          pass: { outcome: 'interception' },
          turnover: { type: 'interception', team: 'V', playerId: interceptor.playerId, returnYards: 30 },
          return: { type: 'Interception', returnerPlayerId: interceptor.playerId, returnYards: 30 },
          scoring: { team: 'V', points: 6, type: 'touchdown' },
          yards: 0,
          endYardLine: 'goal',
        },
      },
      {
        type: 'rush', subtype: 'fumble', possession: 'H',
        participants: {
          primary: participant(fumbler, 'rusher'),
          fumbler: participant(fumbler, 'fumbler'),
          forcedBy: participant(forcer, 'forcedFumble'),
          recoveredBy: participant(recoverer, 'recoverer'),
          returner: participant(recoverer, 'returner'),
          defenders: [participant(forcer, 'forcedFumble'), participant(recoverer, 'recoverer')],
        },
        result: {
          code: 'fumble',
          yards: 4,
          endYardLine: 'goal',
          fumble: {
            fumblerPlayerId: fumbler.playerId,
            forcedByPlayerId: forcer.playerId,
            recoveredByPlayerId: recoverer.playerId,
            recoveredByTeam: 'V',
            returnYards: 12,
            turnover: true,
          },
          return: { type: 'Fumble', returnerPlayerId: recoverer.playerId, returnYards: 12 },
          scoring: { team: 'V', points: 6, type: 'touchdown' },
        },
      },
      {
        type: 'pass', subtype: 'incomplete', possession: 'H',
        participants: {
          primary: participant(qb, 'passer'),
          secondary: participant(receiver, 'intendedReceiver'),
          defenders: [participant(cover, 'passBreakup')],
        },
        result: {
          code: 'incomplete', yards: 0, endYardLine: 'H20',
          pass: { outcome: 'incomplete', brokenUpByPlayerId: cover.playerId, hurriedByPlayerIds: [cover.playerId] },
        },
      },
      {
        type: 'punt', subtype: 'blocked', possession: 'H',
        participants: {
          primary: participant(kicker, 'punter'),
          punter: participant(kicker, 'punter'),
          defenders: [participant(blocker, 'blocker')],
        },
        result: { code: 'blocked', kick: { kickYards: 0, blockedByPlayerId: blocker.playerId }, endYardLine: 'H20' },
      },
      {
        type: 'fieldGoal', subtype: 'blocked', possession: 'H',
        participants: {
          primary: participant(kicker, 'kicker'),
          kicker: participant(kicker, 'kicker'),
          defenders: [participant(blocker, 'blocker')],
        },
        result: { code: 'blocked', kick: { attemptYards: 37, blockedByPlayerId: blocker.playerId }, endYardLine: 'H20' },
      },
      {
        type: 'punt', subtype: 'fairCatch', possession: 'V',
        participants: {
          primary: participant(blocker, 'punter'),
          punter: participant(blocker, 'punter'),
          returner: participant(returner, 'returner'),
          defenders: [],
        },
        result: { code: 'fairCatch', kick: { kickYards: 40 }, endYardLine: 'H20', nextPossession: 'H' },
      },
      {
        type: 'fieldGoal', subtype: 'made', possession: 'H',
        participants: { primary: participant(kicker, 'kicker'), kicker: participant(kicker, 'kicker'), defenders: [] },
        result: { code: 'made', kick: { attemptYards: 42 }, scoring: { team: 'H', points: 3, type: 'fieldGoal' } },
      },
      {
        type: 'try', subtype: 'kick', possession: null,
        participants: { primary: participant(kicker, 'kicker'), kicker: participant(kicker, 'kicker'), defenders: [] },
        result: { code: 'made', scoring: { team: 'H', points: 1, type: 'patKick' } },
      },
      {
        type: 'try', subtype: 'rush', possession: 'H',
        participants: { primary: participant(converter, 'rusher'), defenders: [] },
        result: { code: 'made', scoring: { team: 'H', points: 2, type: 'twoPoint' } },
      },
      {
        type: 'try', subtype: 'pass', possession: 'H',
        participants: {
          primary: participant(qb, 'passer'),
          secondary: participant(receiver, 'receiver'),
          receiver: participant(receiver, 'receiver'),
          defenders: [],
        },
        result: { code: 'made', pass: { outcome: 'complete', passingYards: 3 }, scoring: { team: 'H', points: 2, type: 'twoPoint' } },
      },
    ], players);
    envelope.stats.players[blocker.playerId] = { playerId: blocker.playerId, team: 'V', pancakeBlocks: 3 };

    const report = buildFootballMaxPrepsExports(envelope);
    const visitor = report.exports.V;

    expect(rowFor(visitor, sackOne.playerId).values).toMatchObject({
      Assists: 1,
      Sacks: 0.5,
      SacksYardsLost: 4,
      TacklesForLoss: 0.5,
    });
    expect(rowFor(visitor, interceptor.playerId).values).toMatchObject({
      INTs: 1,
      INTYards: 30,
      IntReturnedTDNum: 1,
      TotalTDNum: 1,
      TotalPoints: 6,
    });
    expect(rowFor(visitor, recoverer.playerId).values).toMatchObject({
      FumbleRecoveries: 1,
      FumbleRecoveryYards: 12,
      FumbleReturnedTDNum: 1,
      TotalPoints: 6,
    });
    expect(rowFor(visitor, forcer.playerId).values.CausedFumbles).toBe(1);
    expect(rowFor(visitor, blocker.playerId).values).toMatchObject({
      BlockedPunts: 1,
      BlockedFG: 1,
      PancakeBlocks: 3,
    });
    expect(rowFor(visitor, cover.playerId).values).toMatchObject({ QBHurries: 1, PassesDefensed: 1 });

    const home = report.exports.H;
    expect(rowFor(home, returner.playerId).values.PuntReturnFairCatches).toBe(1);
    expect(rowFor(home, kicker.playerId).values).toMatchObject({
      FGMade: 1,
      FGAttempted: 2,
      FGLong: 42,
      PATKickingMade: 1,
      PATKickingAtt: 1,
      PATKickingPoints: 1,
      TotalPoints: 4,
    });
    expect(rowFor(home, converter.playerId).values).toMatchObject({ PATRushingNum: 1, TotalConversionPoints: 2, TotalPoints: 2 });
    expect(rowFor(home, receiver.playerId).values).toMatchObject({ PATReceivingNum: 1, TotalConversionPoints: 2, TotalPoints: 2 });
  });

  it('omits stat participants without a valid MaxPreps jersey instead of writing an invalid row', () => {
    const rusher = player('H-NO-JERSEY', 'H', '', 'No Jersey');
    const envelope = envelopeWithEvents([{
      type: 'rush', subtype: 'tackle', possession: 'H',
      participants: { primary: participant(rusher, 'rusher'), defenders: [] },
      result: { code: 'tackle', yards: 5, endYardLine: 'H25' },
    }], { rusher });

    const home = buildFootballMaxPrepsExports(envelope).exports.H;
    expect(home.players).toHaveLength(0);
    expect(home.omittedPlayers).toEqual([expect.objectContaining({ name: 'No Jersey' })]);
    expect(home.content).toBe(
      `${MAXPREPS_STAT_SUPPLIER_ID}\r\n${MAXPREPS_FOOTBALL_FIELDS.join('|')}\r\n`,
    );
  });
});
