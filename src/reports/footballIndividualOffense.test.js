import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { buildFootballIndividualOffenseReport } from './footballIndividualOffense';

describe('football Individual Offense projection', () => {
  it('builds all nine ordered team sections from the full event ledger', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    expect(report).toMatchObject({
      gameId: 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7',
      reportTitle: 'Individual Offense',
      reportMatchup: 'Fairmont St. vs. West Virginia St. (September 27, 2025)',
      showYac: true,
    });
    expect(Object.keys(report.teamReports.V)).toEqual([
      'rushing',
      'passing',
      'receiving',
      'punting',
      'returns',
      'fieldGoals',
      'kickoffs',
      'allPurpose',
      'fumbles',
    ]);
    expect(report.teamReports.V.receiving.players.length).toBeGreaterThan(4);
  });

  it('includes team-charged plays in offensive and punting totals', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    expect(report.teamReports.H.rushing.totals).toMatchObject({
      rushAttempts: 46,
      rushYards: 327,
    });
    expect(report.teamReports.V.passing.totals).toMatchObject({
      passCompletions: 30,
      passAttempts: 50,
      passYards: 313,
    });
    expect(report.teamReports.V.punting.totals).toMatchObject({
      punts: 4,
      puntYards: 107,
    });
    expect(report.teamReports.H.rushing.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Team', teamEntry: true, rushAttempts: 2, rushYards: -2 }),
    ]));
  });

  it('allocates a completed-pass lateral to both receivers in Individual Offense', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    envelope.rosters.teams.H.players['H-16'] = {
      playerId: 'H-16', team: 'H', jersey: '16', displayName: 'Passer', active: true,
    };
    envelope.rosters.teams.H.players['H-49'] = {
      playerId: 'H-49', team: 'H', jersey: '49', displayName: 'Original Receiver', active: true,
    };
    envelope.rosters.teams.H.players['H-47'] = {
      playerId: 'H-47', team: 'H', jersey: '47', displayName: 'Lateral Receiver', active: true,
    };
    envelope.events = [{
      eventId: 'PASS-LATERAL-TD-1',
      sequence: 1,
      status: 'accepted',
      type: 'pass',
      subtype: 'complete',
      period: 1,
      clock: '09:11',
      possession: 'H',
      preState: {
        possession: 'H', down: 1, distance: 10, yardLine: 'H16', lineToGain: 'H26', driveId: 'DRV-1', driveNumber: 1,
      },
      participants: {
        primary: { playerId: 'H-16', team: 'H', role: 'passer' },
        receiver: { playerId: 'H-49', team: 'H', role: 'receiver' },
        secondary: { playerId: 'H-49', team: 'H', role: 'intendedReceiver' },
        others: [{ playerId: 'H-47', team: 'H', role: 'other' }],
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 84,
        endYardLine: 'V00',
        pass: { outcome: 'complete', terminalYardLine: 'V00', passingYards: 84, receivingYards: 84 },
        laterals: [{ fromPlayerId: 'H-49', toPlayerId: 'H-47', spot: 'H24' }],
        scoring: { team: 'H', points: 6, type: 'touchdown' },
      },
      penalties: [],
    }];
    envelope.stats = { teams: {}, players: {} };

    const report = buildFootballIndividualOffenseReport(envelope);
    const receiving = report.teamReports.H.receiving;

    expect(report.teamReports.H.passing.totals).toMatchObject({ passYards: 84, passTouchdowns: 1 });
    expect(receiving.totals).toMatchObject({ receptions: 1, receivingYards: 84, receivingTouchdowns: 1 });
    expect(receiving.players.find((player) => player.playerId === 'H-49')).toMatchObject({
      receptions: 1,
      receivingYards: 8,
      receivingTouchdowns: 0,
      receivingLong: 8,
    });
    expect(receiving.players.find((player) => player.playerId === 'H-47')).toMatchObject({
      receptions: 0,
      receivingYards: 76,
      receivingTouchdowns: 1,
      rushAttempts: 0,
      rushYards: 0,
    });
  });

  it('credits return counts, yards, and long returns to the individual returners', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    const home = report.teamReports.H.returns;
    expect(home.totals).toMatchObject({
      puntReturns: 2,
      puntReturnYards: 18,
      puntReturnLong: 10,
      kickReturns: 4,
      kickReturnYards: 96,
      kickReturnLong: 27,
      interceptionReturns: 0,
      interceptionReturnYards: 0,
    });
    expect(home.players.find((player) => player.playerId === '38a31195-3d19-afb2-7d9b-f99deed7b9b8')).toMatchObject({
      puntReturns: 1,
      puntReturnYards: 8,
      puntReturnLong: 8,
    });
    expect(report.teamReports.V.returns.totals).toMatchObject({
      kickReturns: 6,
      kickReturnYards: 76,
      kickReturnLong: 21,
    });
  });

  it('uses gross landing yardage for each kickoff specialist', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    const visitor = report.teamReports.V.kickoffs;
    const home = report.teamReports.H.kickoffs;
    expect(visitor.players).toEqual([
      expect.objectContaining({ name: 'Connor Mollohan', kickoffs: 7, kickoffYards: 444, kickoffTouchbacks: 2, kickoffOutOfBounds: 0 }),
    ]);
    expect(visitor.totals).toMatchObject({ kickoffs: 7, kickoffYards: 444 });
    expect(home.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Tony Hornbuckle', kickoffs: 4, kickoffYards: 214, kickoffTouchbacks: 1, kickoffOutOfBounds: 1 }),
      expect.objectContaining({ name: 'Joseph Shrader', kickoffs: 6, kickoffYards: 325, kickoffTouchbacks: 2, kickoffOutOfBounds: 0 }),
    ]));
    expect(home.totals).toMatchObject({ kickoffs: 10, kickoffYards: 539, kickoffTouchbacks: 3, kickoffOutOfBounds: 1 });
  });

  it('lists field-goal attempts chronologically with distance and detailed miss results', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    expect(report.teamReports.H.fieldGoals.rows).toEqual([
      expect.objectContaining({ quarter: 1, time: '6:43', distance: '30 Yards', result: 'GOOD' }),
      expect.objectContaining({ quarter: 2, time: '0:04', distance: '27 Yards', result: 'GOOD' }),
    ]);
    expect(report.teamReports.V.fieldGoals.rows).toEqual([
      expect.objectContaining({ quarter: 3, time: '3:47', distance: '41 Yards', result: 'GOOD' }),
    ]);

    const envelope = structuredClone(baselineRecord.envelope);
    const attempt = structuredClone(envelope.events.find((event) => event.type === 'fieldGoal'));
    attempt.result.code = 'missed';
    attempt.subtype = 'missed';
    attempt.result.kick.missedReason = 'wideRight';
    delete attempt.result.scoring;
    envelope.events = [attempt];
    const missed = buildFootballIndividualOffenseReport(envelope);
    expect(missed.teamReports.H.fieldGoals.rows[0].result).toBe('WIDE RIGHT');
  });

  it('keeps all-purpose totals as yardage and player fumbles separate from recoveries', () => {
    const report = buildFootballIndividualOffenseReport(baselineRecord.envelope);
    report.teamReports.V.allPurpose.players.forEach((player) => {
      expect(player.allPurposeTotal).toBe(
        player.allPurposeRush
        + player.allPurposeReceiving
        + player.allPurposeKick
        + player.allPurposePunt
        + player.allPurposeInterception
        + player.allPurposeFumble,
      );
    });
    expect(report.teamReports.V.fumbles.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: '91e62fb5-9dfa-f4de-1b11-93b1444cd002', fumbles: 1, fumblesLost: 0 }),
      expect.objectContaining({ playerId: 'c6194f96-7b5d-0f5a-7fe0-cf24fb6323b1', fumbles: 2, fumblesLost: 2 }),
    ]));
    expect(report.teamReports.V.fumbles.players.some((player) => player.teamEntry)).toBe(false);
    expect(report.teamReports.V.fumbles.totals).toEqual({ fumbles: 3, fumblesLost: 2 });
  });
});
