import { describe, expect, it } from 'vitest';
import fixture from './fixtures/football-fumble-return-touchdown.json';
import { buildFootballScoringSummary } from './footballScoringSummary';
import { buildFootballQuickieStatsReport } from './footballQuickieStats';
import { buildFootballDriveSummary } from '../scoring/footballDriveSummary';
import { buildFootballTeamStatsReport } from './footballTeamStats';

describe('Play 50 defensive fumble-return touchdown reports', () => {
  it('uses the returner and return distance, groups the PAT, and omits the opponent drive', () => {
    const before = JSON.stringify(fixture);
    const summary = buildFootballScoringSummary(fixture);
    expect(summary.scoring).toEqual([expect.objectContaining({
      quarter: '2', time: '10:57', team: 'LIV',
      description: 'Malachi Adkins 92 yard fumble return (Zapata Kick)',
      drive: '—', score: '7-0',
    })]);
    expect(buildFootballDriveSummary(fixture, fixture.events[1])).toBeNull();
    const beforeTry = { ...fixture, events: [fixture.events[0]] };
    expect(buildFootballScoringSummary(beforeTry).scoring[0]).toMatchObject({
      description: 'Malachi Adkins 92 yard fumble return', drive: '—', score: '6-0',
    });
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('credits a three-yard rush without a rushing touchdown, and a Livingstone fumble return', () => {
    const before = JSON.stringify(fixture);
    const report = buildFootballQuickieStatsReport(fixture);
    expect(report.scoring[0]).toMatchObject({ description: 'Malachi Adkins 92 yard fumble return (Zapata Kick)', drive: '—' });
    expect(report.teamStats.H).toMatchObject({ rushAttempts: 1, rushYards: 3, totalYards: 3, fumbleReturns: { count: 0, yards: 0 } });
    expect(report.teamStats.V).toMatchObject({ fumbleReturns: { count: 1, yards: 92 } });
    expect(report.individual.H.rushing[0]).toMatchObject({ rushAttempts: 1, rushYards: 3, rushTouchdowns: 0, rushLong: 3 });
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('also classifies an interception touchdown before the original pass type', () => {
    const envelope = structuredClone(fixture);
    const play = envelope.events[0];
    play.type = 'pass';
    play.subtype = 'interception';
    delete play.result.fumble;
    play.result.turnover.type = 'interception';
    play.result.return.type = 'Interception';
    expect(buildFootballScoringSummary(envelope).scoring[0]).toMatchObject({
      description: 'Malachi Adkins 92 yard interception return (Zapata Kick)', drive: '—',
    });
  });

  it('keeps team rushing and fumble returns consistent with the individual report', () => {
    const envelope = structuredClone(fixture);
    envelope.stats = { teams: { H: { rushYards: 11, yards: 11 }, V: {} }, players: {} };
    const report = buildFootballTeamStatsReport(envelope);
    expect(report.teamStats.H).toMatchObject({ rushYards: 3, totalYards: 3, fumbleReturns: { count: 0, yards: 0, touchdowns: 0 } });
    expect(report.teamStats.V.fumbleReturns).toMatchObject({ count: 1, yards: 92, touchdowns: 1 });
  });
});
