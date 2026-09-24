import { describe, expect, it } from 'vitest';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import penaltyCatalog from '../data/penaltyTable.json';
import { hasAcceptedDpiSpotPenalty, repairDpiSpotDrivePlayCounts } from '../utils/footballPenaltyStatistics';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { projectFootballStatsForEvents, normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { buildFootballQuickieStatsReport } from './footballQuickieStats';
import { buildFootballIndividualOffenseReport } from './footballIndividualOffense';
import { buildFootballDefensivePlayerStats } from './footballMaxPrepsExport';
import { buildFootballTeamStatsReport } from './footballTeamStats';
import { buildFootballScoringSummary } from './footballScoringSummary';
import { withFootballReportYardage } from './footballReportYardage';

const fixture = (penaltyChanges = {}, outcome = 'incomplete') => {
  const envelope = structuredClone(baselineRecord.envelope);
  envelope.gameId = 'FB-dpi-spot';
  const event = {
    eventId: 'dpi-spot', sequence: 1, period: 1, clock: '10:00', status: 'accepted',
    type: 'pass', subtype: outcome, possession: 'H',
    preState: { possession: 'H', down: 3, distance: 10, yardLine: 'H15', lineToGain: 'H25', driveId: 'test-drive', driveNumber: 1 },
    participants: { primary: { playerId: 'passer', team: 'H' }, receiver: { playerId: 'receiver', team: 'H' }, defenders: [{ playerId: 'defender', team: 'V', role: 'passBreakup' }] },
    result: { code: outcome, firstDown: true, yards: outcome === 'complete' ? 13 : 0,
      endYardLine: outcome === 'complete' ? 'H28' : 'H15',
      pass: { outcome, brokenUpByPlayerId: 'defender', ...(outcome === 'complete' ? { passingYards: 13, terminalYardLine: 'H28', catchYardLine: 'H16' } : {}) },
    },
    penalties: [{ code: 'DPI', name: 'Defensive Pass Interference', status: 'accepted', team: 'V', timing: 'liveBall', enforcedFrom: 'SPOT', spotOfFoul: 'H17', finalSpot: 'H17', yards: 2, automaticFirstDown: true, ...penaltyChanges }],
  };
  envelope.events = [event];
  envelope.drives = { completed: [], current: { driveId: 'test-drive', driveNumber: 1, team: 'H', plays: 1, yards: 2, startYardLine: 'H15', startPeriod: 1, startClock: '10:00' } };
  // An old mirror still contains the attempt, target, conversion and duplicate first down.
  envelope.stats = { teams: { H: { pass: { att: 1, cmp: Number(outcome === 'complete'), int: 0, yds: outcome === 'complete' ? 2 : 0 }, plays: 1, yards: outcome === 'complete' ? 2 : 0, firstDowns: 2, thirdDown: { att: 1, made: 1 } } },
    players: { passer: { playerId: 'passer', team: 'H', passAttempts: 1 }, receiver: { playerId: 'receiver', team: 'H', targets: 1 } } };
  return { envelope, event };
};

describe('accepted DPI with SPOT is NOPLAY', () => {
  it.each(['SPOT', 'spotOfFoul'])('suppresses play statistics with %s while preserving enforcement', (enforcedFrom) => {
    const { envelope, event } = fixture({ enforcedFrom });
    const before = JSON.stringify(envelope);
    const stats = projectFootballStatsForEvents(envelope);
    expect(stats.teams.H).toMatchObject({ firstDowns: 1 });
    expect(stats.teams.H.pass).toBeUndefined();
    expect(stats.teams.H.plays).toBeUndefined();
    expect(stats.teams.H.thirdDown).toBeUndefined();
    expect(stats.players.passer).toBeUndefined();
    expect(stats.players.receiver).toBeUndefined();
    expect(stats.teams.V.penalties).toEqual({ num: 1, yds: 2 });
    expect(buildFootballDefensivePlayerStats(envelope).some(p => Number(p.values.PassesDefensed) > 0)).toBe(false);
    const result = applyFootballEventToEnvelope(envelope, event);
    expect(result.liveState).toMatchObject({ possession: 'H', down: 1, yardLine: 'H17' });
    expect(result.firstDown).toBe(true);
    const team = buildFootballTeamStatsReport(envelope).teamStats.H;
    expect(team).toMatchObject({ passAttempts: 0, passCompletions: 0, passYards: 0, plays: 0, firstDowns: 1, firstDownTypes: { rushing: 0, passing: 0, penalty: 1 } });
    expect(buildFootballQuickieStatsReport(envelope).individual.H.passing).toEqual([]);
    expect(buildFootballIndividualOffenseReport(envelope).teamReports.H.receiving.players).toEqual([]);
    const refreshed = withFootballReportYardage(envelope);
    expect(refreshed.drives.current).toMatchObject({ plays: 0, yards: 2, startYardLine: 'H15' });
    expect(normalizeFootballScoringSetupEnvelope(envelope).drives.current.plays).toBe(0);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('suppresses a recorded completion when the DPI is accepted, including YAC', () => {
    const { envelope } = fixture({}, 'complete');
    const report = buildFootballIndividualOffenseReport(envelope).teamReports.H;
    expect(report.passing.players).toEqual([]);
    expect(report.receiving.players).toEqual([]);
    expect(buildFootballTeamStatsReport(envelope).teamStats.H).toMatchObject({ passAttempts: 0, passCompletions: 0, passYards: 0, totalYards: 0 });
  });

  it('retains penalty awards but discards a legacy play-earned first down', () => {
    const { envelope, event } = fixture();
    event.result.officialOutcome = { source: 'penaltyEnforcement', calculated: {
      possession: 'H', down: 1, distance: 10, yardLine: 'H17',
      firstDownAwards: [{ id: 'play', source: 'play', team: 'H' }, { id: 'penalty:dpi', source: 'penalty', team: 'H' }],
    } };
    expect(projectFootballStatsForEvents(envelope).teams.H.firstDowns).toBe(1);
  });

  it('does not include a nullified touchdown in scoring report rows or period totals', () => {
    const { envelope, event } = fixture({}, 'complete');
    event.result.scoring = { type: 'touchdown', points: 6, team: 'H' };
    const report = buildFootballScoringSummary(envelope);
    expect(report.scoring).toEqual([]);
    expect(report.scoreByQuarter.H.periods[1]).toBe(0);
  });

  it.each(['declined', 'offsetting'])('does not apply the new rule to %s DPI', (status) => {
    const { envelope, event } = fixture({ status }, 'complete');
    expect(hasAcceptedDpiSpotPenalty(event)).toBe(false);
    expect(projectFootballStatsForEvents(envelope).teams.H.pass).toMatchObject({ att: 1, cmp: 1, yds: 13 });
    expect(buildFootballIndividualOffenseReport(envelope).teamReports.H.receiving.players[0]).toMatchObject({ receptions: 1, receivingYards: 13 });
  });

  it.each(['END', 'endOfPlay'])('does not add suppression to DPI with %s enforcement', (enforcedFrom) => {
    const { envelope, event } = fixture({ enforcedFrom }, 'complete');
    expect(hasAcceptedDpiSpotPenalty(event)).toBe(false);
    expect(projectFootballStatsForEvents(envelope).teams.H.pass).toMatchObject({ att: 1, cmp: 1, yds: 13 });
  });

  it('preserves existing previous-spot NOPLAY and supports canonical name-only DPI', () => {
    const { envelope, event } = fixture({ enforcedFrom: 'PREVIOUS' });
    expect(hasAcceptedDpiSpotPenalty(event)).toBe(false);
    expect(projectFootballStatsForEvents(envelope).teams.H.pass).toBeUndefined();
    event.penalties[0] = { ...event.penalties[0], code: '', enforcedFrom: 'SPOT' };
    expect(hasAcceptedDpiSpotPenalty(event)).toBe(true);
  });

  it.each(penaltyCatalog.penalties.filter(p => p.name !== 'Defensive Pass Interference'))('retains spot statistics for $name even with identical foul/final spots', (penalty) => {
    const { envelope, event } = fixture({ code: penalty.code, name: penalty.name }, 'complete');
    expect(hasAcceptedDpiSpotPenalty(event)).toBe(false);
    expect(projectFootballStatsForEvents(envelope).teams.H.pass).toMatchObject({ att: 1, cmp: 1, yds: 2 });
    expect(buildFootballIndividualOffenseReport(envelope).teamReports.H.receiving.players[0]).toMatchObject({ receptions: 1, receivingYards: 2, yac: 1 });
  });

  it('refreshes only affected drive counters and preserves partial histories', () => {
    const { envelope } = fixture();
    envelope.drives.completed = [{ driveId: 'other', driveNumber: 2, plays: 5 }];
    expect(repairDpiSpotDrivePlayCounts(envelope).drives.completed).toEqual(envelope.drives.completed);
    envelope.events[0].sequence = 2;
    expect(repairDpiSpotDrivePlayCounts(envelope)).toBe(envelope);
    expect(withFootballReportYardage(envelope)).toBe(envelope);
  });
});
