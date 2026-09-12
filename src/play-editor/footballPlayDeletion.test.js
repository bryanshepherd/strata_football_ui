import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope, submitFootballEventLocally } from '../services/footballDashboardService';
import { deleteFootballPlayFromEnvelope } from './footballPlayDeletion';

const context = (patch = {}) => ({ possession: 'H', down: 1, distance: 10, yardLine: 'H25', lineToGain: 'H35', driveId: 'DRV-0001', driveNumber: 1, ...patch });
const base = () => {
  const game = structuredClone(getGameEnvelopeFixture('normal'));
  game.events = [];
  game.gameId = 'FB-DELETE';
  game.game.status = 'inProgress';
  game.game.teams.H.score = 0;
  game.game.teams.V.score = 0;
  game.liveState = context();
  game.drives = { current: { driveId: 'DRV-0001', driveNumber: 1, team: 'H', startYardLine: 'H25', startPeriod: 1, startClock: '12:00', plays: 0, yards: 0 }, completed: [] };
  game.stats = { sourceEventSequence: 0, teams: {}, players: {} };
  return game;
};
const append = (game, type, result, extra = {}) => applyFootballScorerEventToEnvelope(game, {
  clientEventId: `test-${game.events.length + 1}`, type, period: 1, clock: '11:00',
  possession: game.liveState.possession, preState: structuredClone(game.liveState),
  participants: { primary: { playerId: 'H-RUNNER', team: 'H', jersey: '22', role: 'rusher' } },
  result, ...extra,
}).envelope;
const rush = (game, yards, endYardLine) => append(game, 'rush', { code: 'tackle', yards, endYardLine });
const penalty = (game) => append(game, 'penalty', { code: 'noPlay', endYardLine: 'H20' }, {
  penalties: [{ penaltyId: 'EXTRA-HOLD', code: 'HOLD', name: 'Holding', team: 'H', status: 'accepted', yards: 10, enforcedFrom: 'previousSpot', finalSpot: 'H20', replayDown: true }],
});
const revision = (game, spot = 'H20') => append(game, 'gameControl', {
  code: 'noPlay', gameControl: { action: 'setBallContext', possession: 'H', down: 1, distance: 10, spot, lineToGain: 'H30' },
}, { subtype: 'setBallContext' });

describe('football play deletion', () => {
  it('removes a historical penalty and its totals while keeping later contexts, IDs, clock and final status', () => {
    let game = rush(base(), 5, 'H30');
    game = penalty(game);
    game = revision(game);
    game = rush(game, 3, 'H23');
    game.game.status = 'final';
    game.game.wrapUp = { completedAt: '2026-09-12T06:00:00Z' };
    const original = structuredClone(game);
    const result = deleteFootballPlayFromEnvelope(game, game.events[1]);
    expect(result.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(result.events.map((event) => event.eventId)).toEqual(['LOCAL-000001', 'LOCAL-000003', 'LOCAL-000004']);
    expect(result.events[2].preState).toEqual(game.events[3].preState);
    expect(result.stats.teams.H.penalties?.count || 0).toBe(0);
    expect(result.stats.teams.H.rushAttempts).toBe(2);
    expect(result.stats.teams.H.rushYards).toBe(8);
    expect(result.drives.current.plays).toBe(2);
    expect(result.liveState).toEqual(game.liveState);
    expect(result.game).toEqual(game.game);
    expect(result.clock).toEqual(game.clock);
    expect(game).toEqual(original);
  });

  it('deletes an obsolete penalty and final revision after a corrected kickoff and restores the kickoff result', () => {
    let game = base();
    game.liveState = { possession: null, kickoffTeam: 'H', yardLine: 'H40', nextPlayContext: 'awaitingKickoff' };
    game.drives = { current: null, completed: [] };
    game = append(game, 'kickoff', { code: 'returned', endYardLine: 'V21', nextPossession: 'V', return: { returnYards: 16, returnStartYardLine: 'V05', returnEndYardLine: 'V21' } }, {
      possession: 'H', subtype: 'returned', participants: { kicker: { playerId: 'H-K', team: 'H' }, returner: { playerId: 'V-R', team: 'V' } },
    });
    const kickoffContext = structuredClone(game.liveState);
    game = penalty(game);
    game = revision(game);
    const revisionTarget = game.events[2];
    game = deleteFootballPlayFromEnvelope(game, game.events[1]);
    game = deleteFootballPlayFromEnvelope(game, revisionTarget);
    expect(game.events).toHaveLength(1);
    expect(game.events[0].type).toBe('kickoff');
    expect(game.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'V21' });
    expect(game.liveState).toEqual(kickoffContext);
  });

  it('removes scoring credit and all projected stats when deleting the only scoring play', () => {
    let game = base();
    game.liveState = context({ yardLine: 'V05', lineToGain: 'goal', distance: 5 });
    game = append(game, 'rush', { code: 'touchdown', endYardLine: 'goal', yards: 5, scoring: { type: 'touchdown', team: 'H', points: 6 } });
    expect(game.game.teams.H.score).toBe(6);
    const result = deleteFootballPlayFromEnvelope(game, game.events[0]);
    expect(result.game.teams.H.score).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.stats.sourceEventSequence).toBe(0);
    expect(result.stats.teams.H.rushAttempts || 0).toBe(0);
    expect(result.stats.players['H-RUNNER'].rushYards || 0).toBe(0);
    expect(result.liveState).toMatchObject({ possession: 'H', down: 1, distance: 5, yardLine: 'V05' });
    expect(result.drives.current.plays).toBe(0);
  });

  it('removes a middle rush from drive and player totals without changing the next recorded start', () => {
    let game = rush(base(), 5, 'H30');
    game = rush(game, 3, 'H33');
    const result = deleteFootballPlayFromEnvelope(game, game.events[0]);
    expect(result.stats.teams.H.rushAttempts).toBe(1);
    expect(result.stats.players['H-RUNNER'].rushYards).toBe(3);
    expect(result.drives.current.plays).toBe(1);
    expect(result.events[0].preState).toEqual(game.events[1].preState);
    expect(normalizeFootballScoringSetupEnvelope(result).stats).toEqual(result.stats);
  });

  it('can append another play after renumbering without reusing a retained event ID', async () => {
    let game = rush(base(), 5, 'H30');
    game = rush(game, 3, 'H33');
    game = deleteFootballPlayFromEnvelope(game, game.events[0]);
    const response = await submitFootballEventLocally(game, { event: {
      clientEventId: 'after-delete', type: 'rush', possession: 'H', period: 1, clock: '10:00', preState: game.liveState,
      result: { code: 'tackle', yards: 2, endYardLine: 'H35' },
    } });
    expect(response.envelope.events).toHaveLength(2);
    expect(response.envelope.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(new Set(response.envelope.events.map((event) => event.eventId)).size).toBe(2);
    expect(response.envelope.events.at(-1).clientEventId).toBe('after-delete');
  });

  it('rejects a deleted target instead of deleting the play now at its former sequence', () => {
    let game = rush(base(), 5, 'H30');
    game = rush(game, 3, 'H33');
    const target = game.events[0];
    const deleted = deleteFootballPlayFromEnvelope(game, target);
    expect(() => deleteFootballPlayFromEnvelope(deleted, target)).toThrow('no longer in the game log');
    expect(deleted.events).toHaveLength(1);
  });

  it('does not delete from an incomplete historical log', () => {
    const game = rush(base(), 5, 'H30');
    game.events[0].sequence = 12;
    expect(() => deleteFootballPlayFromEnvelope(game, game.events[0])).toThrow('complete sequential event log');
  });
});
