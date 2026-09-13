import { describe, expect, it } from 'vitest';
import { footballSafetyScoring, formatFootballSafetyReadout, withFootballSafetyScoring } from './footballSafety';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { buildFootballScoringSummary } from '../reports/footballScoringSummary';
import { buildFootballPlayByPlayReport } from '../reports/footballPlayByPlay';
import { buildFootballQuickieStatsReport } from '../reports/footballQuickieStats';
import { applyFootballScorerEventToEnvelope, submitFootballEventLocally } from '../services/footballDashboardService';

const sack = () => ({
  eventId: 'safety-sack', clientEventId: 'safety-sack-client', sequence: 115, status: 'accepted',
  type: 'pass', subtype: 'sack', period: 3, clock: '05:53', possession: 'V',
  preState: { possession: 'V', down: 1, distance: 10, yardLine: 'V03', lineToGain: 'V13', driveId: 'DRV-0014', driveNumber: 14 },
  participants: { primary: { playerId: 'QB', team: 'V', role: 'sackVictim' }, defenders: [{ playerId: 'DEF', team: 'H', role: 'sack' }] },
  result: { code: 'sack', yards: -3, endYardLine: 'V00', driveEnds: false }, penalties: [],
  description: 'LIV #5 Andrew McClain sacked by #44 Donovan Leaks for loss of 3 yards to the V goal line.',
});

const fixture = () => {
  const envelope = getGameEnvelopeFixture('normal');
  envelope.game.period = 3;
  envelope.game.teams.H.score = 2;
  envelope.game.teams.V.score = 0;
  envelope.events = [sack()];
  envelope.rosters.teams.H.players.DEF = { playerId: 'DEF', displayName: 'Donovan Leaks', firstName: 'Donovan', lastName: 'Leaks', jersey: '44' };
  envelope.rosters.teams.V.players.QB = { playerId: 'QB', displayName: 'Andrew McClain', firstName: 'Andrew', lastName: 'McClain', jersey: '5' };
  return envelope;
};

describe('safety scoring and readout', () => {
  it('recovers a saved sack safety without modifying the accepted event or counting it twice', () => {
    const event = sack();
    const before = JSON.stringify(event);
    const normalized = withFootballSafetyScoring(event);
    expect(normalized.result).toMatchObject({ code: 'sack', yards: -3, scoring: { team: 'H', points: 2, type: 'safety' }, driveEnds: true });
    expect(withFootballSafetyScoring(normalized)).toBe(normalized);
    expect(JSON.stringify(event)).toBe(before);
    const text = formatFootballSafetyReadout(event, event.description);
    expect(text).toContain('Donovan Leaks');
    expect(text).toMatch(/Safety\.$/);
    expect(formatFootballSafetyReadout(normalized, text)).toBe(text);
  });

  it.each([
    { result: { endYardLine: 'V01' } },
    { result: { endYardLine: 'H00' } },
    { result: { fumble: { turnover: false } } },
    { result: { code: 'touchback', scoring: { team: 'V', points: 6, type: 'touchdown' } } },
    { penalties: [{ status: 'accepted', timing: 'liveBall', enforcedFrom: 'previousSpot' }] },
    { penalties: [{ status: 'offsetting' }] },
  ])('does not invent safety scoring for an ambiguous or different outcome: %j', (overrides) => {
    const event = sack();
    const candidate = { ...event, ...overrides, result: { ...event.result, ...overrides.result } };
    expect(footballSafetyScoring(candidate)).toBeNull();
    expect(withFootballSafetyScoring(candidate)).toBe(candidate);
  });

  it('includes the two points in the correct quarter, scoring row, Quickie and play-by-play', () => {
    const envelope = fixture();
    const before = JSON.stringify(envelope);
    const scoring = buildFootballScoringSummary(envelope);
    expect(scoring.scoreByQuarter.H).toEqual({ periods: { 1: 0, 2: 0, 3: 2, 4: 0 }, total: 2 });
    expect(scoring.scoreByQuarter.V.total).toBe(0);
    expect(scoring.scoring).toEqual([expect.objectContaining({ sequence: 115, quarter: '3', time: '05:53', description: 'Donovan Leaks safety', score: '0-2', drive: '—' })]);
    const quickie = buildFootballQuickieStatsReport(envelope, { mode: 'quarter', quarter: 3 });
    expect(quickie.teamStats.H.score).toBe(2);
    expect(quickie.teamStats.V.score).toBe(0);
    const pbp = buildFootballPlayByPlayReport(envelope);
    expect(pbp.quarters.find((quarter) => quarter.period === 3).rows.find((row) => row.sequence === 115 && row.kind === 'play').text).toMatch(/Safety\.$/);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('accepts a retry of a legacy sack without adding safety points twice', async () => {
    const envelope = fixture();
    envelope.gameId = 'FB-SAFETY-IDEMPOTENCY';
    envelope.events = [];
    envelope.game.teams.H.score = 0;
    const request = { event: sack() };
    const first = await submitFootballEventLocally(envelope, request);
    expect(first.ok).toBe(true);
    expect(first.envelope.game.teams.H.score).toBe(2);
    const retry = await submitFootballEventLocally(first.envelope, request);
    expect(retry).toMatchObject({ ok: true, status: 'duplicateAccepted' });
    expect(retry.envelope.game.teams.H.score).toBe(2);
    expect(retry.envelope.events).toHaveLength(1);
  });

  it('retains rules-engine safety metadata on newly accepted legacy sacks without changing the supplied event', () => {
    const envelope = fixture();
    envelope.events = [];
    envelope.game.teams.H.score = 0;
    const event = sack();
    const before = JSON.stringify(event);
    const result = applyFootballScorerEventToEnvelope(envelope, event);
    expect(result.diagnostics).toEqual([]);
    expect(result.envelope.game.teams.H.score).toBe(2);
    expect(result.envelope.events.at(-1).result.scoring).toEqual({ team: 'H', points: 2, type: 'safety' });
    expect(result.envelope.liveState).toMatchObject({ possession: null, kickoffTeam: 'V', nextPlayContext: 'awaitingSafetyKick', yardLine: 'V20' });
    expect(JSON.stringify(event)).toBe(before);
  });
});
