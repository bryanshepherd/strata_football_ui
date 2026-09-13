import { describe, expect, it } from 'vitest';
import { footballPointsOffTurnovers } from './footballTurnoverScoring';
import { buildFootballDriveChartReport } from '../reports/footballDriveChart';
import { buildFootballTeamStatsReport } from '../reports/footballTeamStats';
import { buildFootballReportPacket } from '../reports/footballReportPacket';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope, recalculateFootballDriveTotals } from '../services/footballDashboardService';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';

const score = (team, type = 'touchdown', points = 6) => ({ team, type, points });
const tryEvent = (team = 'V', points = 1) => ({ type: 'try', subtype: 'kick', result: { code: points ? 'made' : 'missed', ...(points ? { scoring: score(team, 'patKick', points) } : {}) } });
const fixture = () => {
  const game = structuredClone(getGameEnvelopeFixture('normal'));
  game.game.status = 'final';
  game.drives = { current: null, completed: ['fumble', 'interception', 'punt'].map((kind, index) => ({
    driveId: kind, driveNumber: index + 1, team: 'H', startYardLine: 'H25', startReason: 'kickoff',
    startPeriod: 2, startClock: '14:01', endPeriod: 2, endClock: '10:57', result: 'touchdown', plays: 1, yards: 75,
  })) };
  const pre = (driveId, yardLine, down) => ({ possession: 'H', driveId, driveNumber: 1, yardLine, down, distance: 8, lineToGain: 'V04' });
  game.events = [
    { type: 'rush', possession: 'H', preState: pre('fumble', 'V11', 4), result: {
      code: 'touchdown', yards: 11, scoring: score('V'), nextPossession: 'V',
      fumble: { turnover: true, spot: 'V08', recoverySpot: 'V08', recoveredByTeam: 'V', recoveredByPlayerId: 'V-1', returnYards: 92 },
      turnover: { type: 'fumble', team: 'H', recoveredBy: 'V', spot: 'V08' },
    } }, tryEvent(),
    { type: 'pass', subtype: 'interception', possession: 'H', preState: pre('interception', 'V12', 3), result: {
      code: 'interception', endYardLine: 'goal', scoring: score('V'), nextPossession: 'V',
      pass: { outcome: 'interception', interceptionYardLine: 'V05' },
      turnover: { type: 'interception', team: 'V', spot: 'V05', returnYards: 95 },
    } }, tryEvent(),
    { type: 'punt', subtype: 'returned', possession: 'H', preState: pre('punt', 'H29', 4), result: {
      code: 'touchdown', endYardLine: 'goal', scoring: score('V'), nextPossession: 'V',
      return: { type: 'Punt', returnerPlayerId: 'V-1', returnYards: 65 },
    } }, tryEvent(),
  ].map((event, index) => ({ eventId: `EVENT-${index}`, clientEventId: `event-${index}`, sequence: index + 1, status: 'accepted', period: 2, clock: '10:57', penalties: [], participants: {}, ...event }));
  return game;
};

describe('turnover-return touchdowns and drive ownership', () => {
  it('ends the original offense drive via fumble or interception, credits the opponent and sets up its try', () => {
    const game = fixture();
    for (const index of [0, 2]) {
      const event = game.events[index];
      const projection = applyFootballEventToEnvelope(game, event);
      expect(projection.driveTransition).toMatchObject({ driveResult: 'turnover', shouldEndCurrent: true, shouldStartNew: false });
      expect(projection.scoringUpdate).toEqual(score('V'));
      expect(projection.liveState).toMatchObject({ possession: null, pendingTryTeam: 'V', nextPlayContext: 'awaitingTry' });
      const starting = { ...game, events: [], drives: { current: { ...game.drives.completed[index / 2], result: null, plays: 0, yards: 0 }, completed: [] } };
      const saved = applyFootballScorerEventToEnvelope(starting, event).envelope;
      expect(saved.drives.current).toBeNull();
      expect(saved.drives.completed[0]).toMatchObject({ team: 'H', result: 'turnover', yards: index === 0 ? 67 : 63 });
      expect(JSON.parse(JSON.stringify(saved)).events[0].result.scoring).toEqual(score('V'));
    }
  });

  it('repairs existing drive endings and yards in the report, packet and reload without changing recorded plays or clocks', () => {
    const game = fixture();
    const before = JSON.stringify(game);
    const assertChart = envelope => expect(buildFootballDriveChartReport(envelope).chronological.map(drive => ({ howLost: drive.howLost, endSpot: drive.endSpot, yards: drive.yards }))).toEqual([
      { howLost: 'Fumble', endSpot: 'V08', yards: 67 },
      { howLost: 'Interception', endSpot: 'V12', yards: 63 },
      { howLost: 'Punt', endSpot: 'H29', yards: 4 },
    ]);
    assertChart(game);
    const normalized = normalizeFootballScoringSetupEnvelope(game);
    assertChart(normalized);
    expect(normalized.drives.completed.map(drive => drive.result)).toEqual(['turnover', 'turnover', 'punt']);
    expect(normalized.drives.completed.map(drive => drive.endClock)).toEqual(['10:57', '10:57', '10:57']);
    expect(recalculateFootballDriveTotals(game).completed.map(drive => drive.result)).toEqual(['turnover', 'turnover', 'punt']);
    expect(buildFootballReportPacket(normalized).sections.find(section => section.id === 'drive-chart').report.chronological)
      .toEqual(buildFootballDriveChartReport(normalized).chronological);
    expect(buildFootballTeamStatsReport(game).teamStats.H.redZone).toMatchObject({ touchdowns: 0 });
    expect(JSON.stringify(game)).toBe(before);
  });

  it('counts both turnover returns and their extra points once, excluding the punt return and its try', () => {
    const game = fixture();
    expect(footballPointsOffTurnovers(game, game.events)).toEqual({ V: 14, H: 0 });
    expect(buildFootballTeamStatsReport(game).rows.find(row => row.id === 'points-off-turnover').values).toEqual({ V: '14', H: '0' });
    game.events[1] = { ...game.events[1], result: { code: 'missed' } };
    game.events[3] = { ...game.events[3], result: { code: 'good', scoring: score('V', 'twoPointTry', 2) } };
    expect(footballPointsOffTurnovers(game, game.events)).toEqual({ V: 14, H: 0 });
  });

  it('counts a subsequent offensive scoring drive, including a current drive, without charging an opponent return to it', () => {
    const game = fixture();
    game.drives.completed[0].startReason = 'interception';
    // H took possession on a turnover, then fumbled for a V touchdown: H earns no points.
    game.drives.current = { driveId: 'after-takeaway', team: 'H', startReason: 'fumbleRecovery' };
    game.events.push({ type: 'rush', possession: 'H', preState: { driveId: 'after-takeaway' }, result: { scoring: score('H') } }, tryEvent('H'));
    expect(footballPointsOffTurnovers(game, game.events)).toEqual({ V: 14, H: 7 });
    game.events[6] = { ...game.events[6], type: 'fieldGoal', result: { scoring: score('H', 'fieldGoal', 3) } };
    game.events.pop();
    expect(footballPointsOffTurnovers(game, game.events)).toEqual({ V: 14, H: 3 });
  });

  it('does not include scoring after a punt or turnover on downs, or a defensive conversion for the other team', () => {
    for (const reason of ['punt', 'kickoff', 'missedFieldGoal', 'turnoverOnDowns']) {
      const game = { drives: { completed: [{ driveId: 'drive', team: 'V', startReason: reason }] } };
      const events = [{ type: 'rush', possession: 'V', preState: { driveId: 'drive' }, result: { scoring: score('V') } }, tryEvent()];
      expect(footballPointsOffTurnovers(game, events)).toEqual({ H: 0, V: 0 });
    }
    const game = fixture();
    game.events[1] = { ...tryEvent('H', 2), result: { scoring: score('H', 'defensiveConversion', 2) } };
    expect(footballPointsOffTurnovers(game, game.events)).toEqual({ H: 0, V: 13 });
  });

  it('ignores removed and nullified returns, retains try retries, and never attaches a later try to an old score', () => {
    const game = fixture();
    const nullified = { ...game.events[0], penalties: [{ status: 'accepted', enforcedFrom: 'previousSpot', replayDown: true }] };
    expect(footballPointsOffTurnovers(game, [nullified, tryEvent()])).toEqual({ H: 0, V: 0 });
    expect(footballPointsOffTurnovers(game, [{ ...game.events[0], status: 'deleted' }, tryEvent()])).toEqual({ H: 0, V: 0 });
    const replay = { ...tryEvent(), penalties: [{ status: 'accepted', enforcedFrom: 'previousSpot', replayDown: true }] };
    expect(footballPointsOffTurnovers(game, [game.events[0], { type: 'gameControl' }, replay, tryEvent()])).toEqual({ H: 0, V: 7 });
    expect(footballPointsOffTurnovers(game, [game.events[0], { type: 'kickoff' }, tryEvent()])).toEqual({ H: 0, V: 6 });
  });
});
