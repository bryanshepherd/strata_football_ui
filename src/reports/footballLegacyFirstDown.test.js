import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { normalizeFootballScoringSetupEnvelope, projectFootballStatsForEvents } from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { buildFootballTeamStatsReport } from './footballTeamStats';
import { buildFootballQuickieStatsReport } from './footballQuickieStats';
import { withFootballReportYardage } from './footballReportYardage';

const fixture = (type = 'rush', yards = 3) => {
  const envelope = structuredClone(getGameEnvelopeFixture('normal'));
  const end = `H${34 + yards}`;
  const event = {
    eventId: 'legacy-targeting', sequence: 1, status: 'accepted', type,
    subtype: type === 'pass' ? 'complete' : 'tackle', possession: 'H', period: 1, clock: '15:00',
    preState: { possession: 'H', down: 1, distance: 10, yardLine: 'H34', lineToGain: 'H44', driveId: 'DRV-0001', driveNumber: 1 },
    participants: { primary: { playerId: 'H-15', team: 'H' }, receiver: { playerId: 'H-24', team: 'H' }, defenders: [] },
    result: { code: type === 'pass' ? 'complete' : 'tackle', yards, endYardLine: end, firstDown: true,
      ...(type === 'pass' ? { pass: { outcome: 'complete', passingYards: yards, terminalYardLine: end } } : {}),
    },
    penalties: [{ penaltyId: 'targeting', code: 'TH', name: 'Targeting', team: 'V', timing: 'liveBall', status: 'accepted', yards: 15, enforcedFrom: 'endOfPlay', finalSpot: 'V48', automaticFirstDown: true, ejected: true }],
    postState: { possession: 'H', down: 1, distance: 10, yardLine: 'V48', lineToGain: 'V38' },
  };
  envelope.events = [event];
  envelope.stats = { teams: { H: { firstDowns: 2, rushAttempts: 1, rushYards: 3, plays: 1, yards: 3, timeOfPossession: 35 }, V: { penalties: { num: 1, yds: 15 } } }, players: {} };
  return { envelope, event };
};

describe('legacy penalty first-down flags', () => {
  it.each(['rush', 'pass'])('does not count an extra %s first down when the play was short', type => {
    const { envelope, event } = fixture(type);
    const before = JSON.stringify(envelope);
    const stats = projectFootballStatsForEvents(envelope);
    expect(stats.teams.H.firstDowns).toBe(1);
    expect(stats.teams.H.yards).toBe(3);
    expect(stats.teams.V.penalties).toEqual({ num: 1, yds: 15 });
    expect(applyFootballEventToEnvelope(envelope, event).liveState).toMatchObject(event.postState);
    expect(normalizeFootballScoringSetupEnvelope(envelope).stats.teams.H.firstDowns).toBe(1);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it.each(['rush', 'pass'])('retains a genuinely earned %s first down plus the penalty award', type => {
    const { envelope } = fixture(type, 10);
    expect(projectFootballStatsForEvents(envelope).teams.H.firstDowns).toBe(2);
  });

  it('uses the foul cutoff, not the raw endpoint, to establish a separate earned first down', () => {
    const { envelope, event } = fixture('rush', 13);
    Object.assign(event.penalties[0], { enforcedFrom: 'SPOT', spotOfFoul: 'H37' });
    expect(projectFootballStatsForEvents(envelope).teams.H).toMatchObject({ firstDowns: 1, rushYards: 3 });
  });

  it('preserves separate explicit penalty awards and does not duplicate them from the legacy flag', () => {
    const { envelope, event } = fixture();
    event.result.officialOutcome = { source: 'penaltyEnforcement', calculated: {
      ...event.postState, firstDownAwarded: true, firstDownAwardedTo: 'H', firstDownAwards: [
        { id: 'penalty:one', source: 'penalty', team: 'H' },
        { id: 'penalty:two', source: 'penalty', team: 'H' },
      ],
    } };
    expect(projectFootballStatsForEvents(envelope).teams.H.firstDowns).toBe(2);
  });

  it('refreshes old cached first downs in reports without changing other totals or recorded inputs', () => {
    const { envelope } = fixture();
    const before = JSON.stringify(envelope);
    const reportEnvelope = withFootballReportYardage(envelope);
    expect(reportEnvelope.stats.teams.H).toEqual({ ...envelope.stats.teams.H, firstDowns: 1 });
    expect(reportEnvelope.stats.teams.V).toEqual(envelope.stats.teams.V);
    expect(reportEnvelope.events).toBe(envelope.events);
    expect(buildFootballTeamStatsReport(envelope).teamStats.H).toMatchObject({ firstDowns: 1, firstDownTypes: { rushing: 0, passing: 0, penalty: 1 } });
    expect(buildFootballQuickieStatsReport(envelope).rows.find(row => row.id === 'first-downs').values.H).toBe('1');
    expect(withFootballReportYardage(reportEnvelope)).toEqual(reportEnvelope);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('leaves cached totals intact when historical events are missing', () => {
    const { envelope, event } = fixture();
    event.sequence = 2;
    expect(withFootballReportYardage(envelope)).toBe(envelope);
  });
});
