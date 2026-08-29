import { describe, expect, it } from 'vitest';
import {
  deleteFootballBallContextRevision,
  isFootballBallContextRevision,
  updateFootballBallContextRevision,
} from './footballBallContextRevision';

const context = (overrides = {}) => ({
  possession: 'H',
  down: 2,
  distance: 18,
  yardLine: 'V32',
  lineToGain: 'V14',
  goalToGo: false,
  redZone: false,
  driveId: 'DRV-0001',
  driveNumber: 1,
  ...overrides,
});

const envelope = () => ({
  schemaVersion: 'football.gameEnvelope.v1',
  gameId: 'FB-CONTEXT-REVISION',
  updatedAt: '2026-08-29T15:00:00.000Z',
  game: {
    status: 'final',
    period: 4,
    teams: {
      H: { name: 'Sissonville', abbr: 'SIS', score: 32 },
      V: { name: 'Ripley', abbr: 'RIP', score: 27 },
    },
    rules: { downs: 4, yardsToFirstDown: 10, periods: 4, minutesPerPeriod: 12 },
  },
  clock: { period: 4, clock: '00:00', clockTenths: 0, isRunning: false },
  liveState: context({ down: 3, distance: 4, yardLine: 'V17' }),
  rosters: { teams: { H: { players: {} }, V: { players: {} } } },
  drives: { current: null, completed: [] },
  events: [
    {
      eventId: 'EVT-1', clientEventId: 'play-1', sequence: 1, status: 'accepted', type: 'rush',
      period: 4, clock: '04:12', possession: 'H', preState: context(),
      result: { code: 'tackle', yards: 11, endYardLine: 'V21' },
      description: 'SIS rush to the RIP 21.',
    },
    {
      eventId: 'EVT-2', clientEventId: 'context-2', sequence: 2, status: 'accepted', type: 'gameControl', subtype: 'setBallContext',
      period: 4, clock: '04:12', possession: 'H', preState: context({ down: 3, distance: 7, yardLine: 'V21', lineToGain: 'V14' }),
      result: { code: 'noPlay', gameControl: { action: 'setBallContext', possession: 'H', down: 2, distance: 7, spot: 'V21', lineToGain: 'V14' } },
      description: 'SIS ball context set to 2 and 7 at the V21, line to gain the V14.',
      source: { kind: 'fcqi', baseEventSequence: 1 },
    },
    {
      eventId: 'EVT-3', clientEventId: 'play-3', sequence: 3, status: 'accepted', type: 'rush',
      period: 4, clock: '03:50', possession: 'H', preState: context({ down: 2, distance: 7, yardLine: 'V21', lineToGain: 'V14' }),
      result: { code: 'tackle', yards: 4, endYardLine: 'V17' },
      description: 'SIS rush for 4 yards.',
      source: { kind: 'fcqi', baseEventSequence: 2 },
    },
  ],
  stats: { sourceEventSequence: 3, teams: {}, players: {} },
  locks: {},
});

describe('football ball context revisions', () => {
  it('recognizes only set-ball-context Game Control events', () => {
    const game = envelope();
    expect(isFootballBallContextRevision(game.events[1])).toBe(true);
    expect(isFootballBallContextRevision(game.events[0])).toBe(false);
  });

  it('edits revision-owned context without rewriting the following play checkpoint', () => {
    const game = envelope();
    const nextCheckpoint = structuredClone(game.events[2].preState);
    const updated = updateFootballBallContextRevision(game, game.events[1], {
      down: 3,
      distance: 6,
      spot: 'R20',
      lineToGain: 'R13',
    }, { editedAt: '2026-08-29T15:05:00.000Z' });

    expect(updated.game.status).toBe('final');
    expect(updated.events[1].result.gameControl).toMatchObject({
      action: 'setBallContext', down: 3, distance: 6, spot: 'V20', lineToGain: 'V13',
    });
    expect(updated.events[1].description).toBe('SIS ball context set to 3 and 6 at the V20, line to gain the V13.');
    expect(updated.events[2].preState).toEqual(nextCheckpoint);
    expect(updated.liveState).toEqual(game.liveState);
  });

  it('deletes a redundant revision, resequences later events, and preserves their checkpoints', () => {
    const game = envelope();
    const nextCheckpoint = structuredClone(game.events[2].preState);
    const deleted = deleteFootballBallContextRevision(
      game,
      game.events[1],
      { editedAt: '2026-08-29T15:06:00.000Z' },
    );

    expect(deleted.game.status).toBe('final');
    expect(deleted.events).toHaveLength(2);
    expect(deleted.events.map((event) => event.eventId)).toEqual(['EVT-1', 'EVT-3']);
    expect(deleted.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(deleted.events[1].preState).toEqual(nextCheckpoint);
    expect(deleted.events[1].source.baseEventSequence).toBe(1);
    expect(deleted.stats.sourceEventSequence).toBe(2);
    expect(deleted.liveState).toEqual(game.liveState);
    expect(game.events).toHaveLength(3);
  });
});
