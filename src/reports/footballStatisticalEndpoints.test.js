import { describe, expect, it } from 'vitest';
import { withFootballReportYardage } from './footballReportYardage';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import { projectFootballStatsForEvents } from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { footballStatisticalYardsAfterCatch } from '../utils/footballStatisticalYardage';
import { buildFootballPlayerStats, buildFootballQuickieStatsReport } from './footballQuickieStats';
import { buildFootballIndividualOffenseReport } from './footballIndividualOffense';
import { buildFootballTeamStatsReport, firstDownBreakdown } from './footballTeamStats';

const fixture = ({ type = 'rush', start = 'H15', end = 'H28', spot = 'H17', final = 'H08', yards = 13, penaltyYards = 9, official = false, status = 'accepted' } = {}) => {
  const envelope = structuredClone(baselineRecord.envelope);
  envelope.gameId = 'FB-statistical-endpoints';
  const event = {
    eventId: 'statistical-endpoint', sequence: 1, period: 1, clock: '10:00', status: 'accepted',
    type, subtype: type === 'pass' ? 'complete' : 'gain', possession: 'H',
    preState: { possession: 'H', yardLine: start, down: 1, distance: 10, lineToGain: 'H25', driveId: 'drive-1', driveNumber: 1 },
    participants: { primary: { playerId: 'runner', team: 'H' }, receiver: { playerId: 'receiver', team: 'H' } },
    result: { yards, endYardLine: end, ...(type === 'pass' ? { pass: { outcome: 'complete', passingYards: yards, terminalYardLine: end, catchYardLine: 'H16', yardsAfterCatch: 12 } } : {}) },
    penalties: [{ status, team: 'H', enforcedFrom: 'SPOT', spotOfFoul: spot, finalSpot: final, yards: penaltyYards }],
  };
  if (official) event.result.officialOutcome = { source: 'penaltyEnforcement', calculated: { possession: 'H', yardLine: final, down: 1, distance: 17, lineToGain: 'H25' } };
  envelope.events = [event];
  envelope.stats = projectFootballStatsForEvents(envelope);
  return { envelope, event };
};

describe('report statistical endpoints', () => {
  it.each([false, true])('credits the foul spot in every offensive report, saved enforcement = %s', (official) => {
    const { envelope, event } = fixture({ type: 'pass', official });
    const before = JSON.stringify(envelope);
    const projected = projectFootballStatsForEvents(envelope);
    const players = buildFootballPlayerStats(envelope, envelope.events, projected);
    expect(players.find(p => p.playerId === 'runner')).toMatchObject({ passYards: 2, passLong: 2 });
    expect(players.find(p => p.playerId === 'receiver')).toMatchObject({ receivingYards: 2, receivingLong: 2, yac: 1 });
    const offense = buildFootballIndividualOffenseReport(envelope).teamReports.H;
    expect(offense.passing.players[0]).toMatchObject({ passYards: 2, passLong: 2 });
    expect(offense.receiving.players[0]).toMatchObject({ receivingYards: 2, receivingLong: 2, yac: 1 });
    expect(buildFootballTeamStatsReport(envelope).teamStats.H).toMatchObject({ passYards: 2, totalYards: 2, penaltyYards: 9 });
    const quick = buildFootballQuickieStatsReport(envelope);
    expect(quick.individual.H.passing[0].passYards).toBe(2);
    expect(quick.rows.find(r => r.id === 'passing-yards').values.H).toBe('2');
    const projection = applyFootballEventToEnvelope(envelope, event);
    expect(projection.yardsGained).toBe(2);
    expect(projection.liveState.yardLine).toBe('H08');
    expect(JSON.stringify(envelope)).toBe(before);
    expect(event.result.endYardLine).toBe('H28');
  });

  it.each([
    { start: 'H15', end: 'H28', spot: 'H17', final: 'H08', yards: 13, expected: 2 },
    { start: 'H43', end: 'V22', spot: 'V47', final: 'H43', yards: 35, expected: 10 },
    { start: 'H27', end: 'H35', spot: 'H24', final: 'H14', yards: 8, expected: -3 },
    { start: 'H15', end: 'H28', spot: 'H15', final: 'H08', yards: 13, expected: 0 },
  ])('keeps gained/lost/long consistent with net at $spot', (data) => {
    const { envelope } = fixture({ ...data, official: true });
    const player = buildFootballIndividualOffenseReport(envelope).teamReports.H.rushing.players[0];
    expect(player).toMatchObject({ rushYards: data.expected, rushGain: Math.max(0, data.expected), rushLoss: Math.max(0, -data.expected), rushLong: Math.max(0, data.expected) });
    const team = buildFootballTeamStatsReport(envelope).teamStats.H;
    expect(team.rushYards).toBe(data.expected);
    expect(team.rushing).toEqual({ gained: Math.max(0, data.expected), lost: Math.max(0, -data.expected) });
  });

  it.each(['declined', 'offsetting'])('preserves ordinary recorded yardage for a %s foul', (status) => {
    const { envelope } = fixture({ status });
    const player = buildFootballIndividualOffenseReport(envelope).teamReports.H.rushing.players[0];
    expect(player).toMatchObject({ rushYards: 13, rushGain: 13, rushLong: 13 });
  });

  it('uses the cutoff for team-charged plays and first-down classification', () => {
    const { envelope, event } = fixture();
    event.result.teamCharged = true;
    envelope.stats = projectFootballStatsForEvents(envelope);
    expect(buildFootballIndividualOffenseReport(envelope).teamReports.H.rushing.players[0]).toMatchObject({ teamEntry: true, rushYards: 2, rushLong: 2 });
    expect(firstDownBreakdown(envelope, [event], 'H', 1)).toEqual({ rushing: 0, passing: 0, penalty: 1 });
  });

  it('adjusts explicit YAC when no catch spot was supplied, without changing stored YAC', () => {
    const { event } = fixture({ type: 'pass' });
    delete event.result.pass.catchYardLine;
    expect(footballStatisticalYardsAfterCatch(event)).toBe(1);
    expect(event.result.pass.yardsAfterCatch).toBe(12);
    delete event.result.pass.yardsAfterCatch;
    expect(footballStatisticalYardsAfterCatch(event)).toBeNull();
  });

  it('preserves offensive yardage when the foul is confirmed after a possession change', () => {
    const { event } = fixture({ type: 'pass' });
    event.result.penaltyContext = { confirmed: true, decision: 'afterChange' };
    expect(footballStatisticalYardsAfterCatch(event)).toBe(12);
  });
  it('refreshes stale report totals without writing the envelope or unrelated fields', () => {
    const { envelope } = fixture({ type: 'pass', official: true });
    envelope.stats.teams.H.pass.yds = -7;
    envelope.stats.teams.H.yards = -7;
    envelope.stats.teams.H.timeOfPossession = 35;
    envelope.stats.players.runner.passYards = -7;
    envelope.stats.players.receiver.receivingYards = -7;
    const before = JSON.stringify(envelope);
    const refreshed = withFootballReportYardage(envelope);
    expect(refreshed.stats.teams.H).toMatchObject({ pass: { yds: 2 }, yards: 2, timeOfPossession: 35, penalties: { yds: 9 } });
    expect(refreshed.stats.players.runner.passYards).toBe(2);
    expect(refreshed.stats.players.receiver.receivingYards).toBe(2);
    expect(buildFootballTeamStatsReport(envelope).teamStats.H).toMatchObject({ passYards: 2, totalYards: 2 });
    expect(withFootballReportYardage(refreshed)).toEqual(refreshed);
    expect(JSON.stringify(envelope)).toBe(before);
    envelope.events[0].sequence = 2;
    expect(withFootballReportYardage(envelope)).toBe(envelope);
  });

});
