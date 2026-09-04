import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import {
  buildFootballPlayerStats,
  buildFootballQuickieStatsReport,
  resolveFootballQuickieScope,
} from './footballQuickieStats';

const row = (report, id) => report.rows.find((candidate) => candidate.id === id);

describe('football Quickie Stats projection', () => {
  it('projects the completed baseline game onto one full-game report', () => {
    const report = buildFootballQuickieStatsReport(baselineRecord.envelope);
    expect(report).toMatchObject({
      gameId: 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7',
      reportTitle: 'Quickie Stats',
      reportMatchup: 'Fairmont St. vs. West Virginia St. (September 27, 2025)',
      scope: { value: 'cumulative-game', label: 'Full Game', periods: [1, 2, 3, 4] },
    });
    expect(row(report, 'score').values).toEqual({ V: '39', H: '60' });
    expect(row(report, 'passing-yards').values.V).toBe('313');
    expect(row(report, 'rushing').values.H).toBe('46-327');
    expect(report.scoring).toHaveLength(16);
    expect(report.scoring.at(-1).score).toBe('39-60');
  });

  it('formats the requested compact team-stat rows and return averages', () => {
    const report = buildFootballQuickieStatsReport(baselineRecord.envelope);
    expect(row(report, 'passing-cai').values).toEqual({ V: '30-50-0', H: '7-17-0' });
    expect(row(report, 'total-offense').values).toEqual({ V: '78-517', H: '63-563' });
    expect(row(report, 'kickoff-returns').values).toEqual({ V: '6-12.7', H: '4-24.0' });
    expect(row(report, 'punt-returns').values).toEqual({ V: '0-0.0', H: '2-9.0' });
    expect(row(report, 'possession').values).toEqual({ V: '28:42', H: '31:18' });
  });

  it('ranks scoped individual leaders without printing instruction labels', () => {
    const report = buildFootballQuickieStatsReport(baselineRecord.envelope);
    expect(report.individual.V.rushing).toHaveLength(3);
    expect(report.individual.V.receiving).toHaveLength(4);
    expect(report.individual.H.tackles).toHaveLength(4);
    expect(report.individual.V.passing[0]).toMatchObject({
      name: 'Nino Marzullo',
      passCompletions: 30,
      passAttempts: 50,
      passYards: 313,
    });
    expect(report.individual.showYac).toBe(true);
    expect(report.individual.V.receiving).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Winston Page', yac: 30, yacStated: true }),
      expect.objectContaining({ name: 'Fred Highsmith', yac: 22, yacStated: true }),
    ]));
    expect(report.individual.H.receiving[0]).toMatchObject({
      name: 'Amare Ary',
      yac: 112,
      yacStated: true,
    });
  });

  it('counts every sack as both a tackle and a tackle for loss even with zero recorded yards', () => {
    const [defender] = buildFootballPlayerStats(
      { rosters: { teams: { V: { players: {} }, H: { players: {} } } } },
      [{
        type: 'pass',
        subtype: 'sack',
        possession: 'H',
        participants: { defenders: [{ playerId: 'V-SACKER', team: 'V', role: 'sack' }] },
        result: { code: 'sack', yards: 0, pass: { outcome: 'sack' } },
        penalties: [],
      }],
      { players: {} },
    );

    expect(defender).toMatchObject({
      soloTackles: 1,
      assistedTackles: 0,
      tacklesForLoss: 1,
      sacks: 1,
    });
  });

  it('derives negative YAC from the entered catch and terminal spots', () => {
    const envelope = structuredClone(baselineRecord.envelope);
    const completion = envelope.events.find((event) => event.type === 'pass' && event.result?.pass?.outcome === 'complete');
    completion.result.pass.catchYardLine = 'V40';
    completion.result.pass.terminalYardLine = 'V37';
    envelope.events = [completion];
    envelope.stats = { teams: {}, players: {} };

    const report = buildFootballQuickieStatsReport(envelope, { mode: 'quarter', quarter: completion.period });
    const receiver = [...report.individual.V.receiving, ...report.individual.H.receiving][0];

    expect(report.individual.showYac).toBe(true);
    expect(receiver).toMatchObject({ yac: -3, yacStated: true });
  });

  it('builds an isolated half with only its points, possession, stats, and scoring rows', () => {
    const report = buildFootballQuickieStatsReport(baselineRecord.envelope, { mode: 'half', half: 1 });
    expect(report.scope).toMatchObject({ value: 'half-1', periods: [1, 2], label: 'First Half' });
    expect(row(report, 'score').values).toEqual({ V: '14', H: '26' });
    expect(report.scoring.every((play) => ['1', '2'].includes(play.quarter))).toBe(true);
    expect(report.scoring.at(-1).score).toBe('14-26');
    expect(row(report, 'possession').values).toEqual({ V: '11:37', H: '18:23' });
  });

  it('builds an isolated quarter and resets the scoped scoring ledger to 0-0', () => {
    const report = buildFootballQuickieStatsReport(baselineRecord.envelope, { mode: 'quarter', quarter: 3 });
    expect(report.scope).toMatchObject({ value: 'quarter-3', periods: [3], label: 'Third Quarter' });
    expect(row(report, 'score').values).toEqual({ V: '11', H: '21' });
    expect(report.scoring.every((play) => play.quarter === '3')).toBe(true);
    expect(report.scoring.at(-1).score).toBe('11-21');
  });

  it('normalizes cumulative, half, and quarter URL scopes', () => {
    expect(resolveFootballQuickieScope(new URLSearchParams('scope=cumulative&quarter=2'))).toMatchObject({
      value: 'cumulative-2', periods: [1, 2],
    });
    expect(resolveFootballQuickieScope(new URLSearchParams('scope=half&half=2'))).toMatchObject({
      value: 'half-2', periods: [3, 4],
    });
    expect(resolveFootballQuickieScope(new URLSearchParams('scope=quarter&quarter=4'))).toMatchObject({
      value: 'quarter-4', periods: [4],
    });
  });
});
