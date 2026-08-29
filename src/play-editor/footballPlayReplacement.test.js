import { describe, expect, it } from 'vitest';
import {
  buildFootballPlayReplacementEnvelope,
  replaceFootballPlayInEnvelope,
} from './footballPlayReplacement';

const clone = (value) => JSON.parse(JSON.stringify(value));

const participant = (playerId, team, role) => ({
  playerId,
  team,
  role,
  jersey: playerId.split('-')[1],
  displayName: playerId,
});

const series = (overrides = {}) => ({
  possession: 'H',
  down: 1,
  distance: 10,
  yardLine: 'H25',
  lineToGain: 'H35',
  goalToGo: false,
  redZone: false,
  driveId: 'DRV-0001',
  driveNumber: 1,
  ...overrides,
});

const baseEnvelope = () => ({
  schemaVersion: 'football.gameEnvelope.v1',
  gameId: 'FB-FINAL-REPLACE',
  updatedAt: '2026-08-29T01:00:00.000Z',
  game: {
    status: 'final',
    period: 4,
    teams: {
      H: { teamId: 'TEAM-H', name: 'Home', abbr: 'HOM', score: 0 },
      V: { teamId: 'TEAM-V', name: 'Visitor', abbr: 'VIS', score: 0 },
    },
    rules: {
      periods: 4,
      minutesPerPeriod: 12,
      downs: 4,
      yardsToFirstDown: 10,
      kickoffSpot: 'H35',
      patSpot: 'V03',
    },
    wrapUp: { completedAt: '2026-08-29T01:00:00.000Z' },
  },
  pregame: { gamePhase: 'final' },
  rosters: {
    teams: {
      H: { players: {} },
      V: { players: {} },
    },
  },
  clock: { period: 4, clock: '00:00', clockTenths: 0, isRunning: false },
  liveState: series({ down: 3, distance: 2, yardLine: 'H33' }),
  drives: {
    current: null,
    completed: [{
      driveId: 'DRV-0001',
      driveNumber: 1,
      team: 'H',
      startYardLine: 'H25',
      startPeriod: 4,
      startClock: '01:00',
      endPeriod: 4,
      endClock: '00:00',
      plays: 2,
      yards: 8,
      result: 'endGame',
    }],
  },
  events: [
    {
      eventId: 'EVT-000001',
      clientEventId: 'rush-1-client',
      sequence: 1,
      type: 'rush',
      subtype: null,
      status: 'accepted',
      createdAt: '2026-08-29T00:59:00.000Z',
      acceptedAt: '2026-08-29T00:59:00.000Z',
      period: 4,
      clock: '01:00',
      possession: 'H',
      preState: series(),
      participants: { primary: participant('H-22', 'H', 'rusher') },
      result: { code: 'tackle', yards: 5, endYardLine: 'H30' },
      description: 'Home rush for 5 yards.',
    },
    {
      eventId: 'EVT-000002',
      clientEventId: 'rush-2-client',
      sequence: 2,
      type: 'rush',
      subtype: null,
      status: 'accepted',
      createdAt: '2026-08-29T00:59:30.000Z',
      acceptedAt: '2026-08-29T00:59:30.000Z',
      period: 4,
      clock: '00:30',
      possession: 'H',
      preState: series({ down: 2, distance: 5, yardLine: 'H30' }),
      participants: { primary: participant('H-22', 'H', 'rusher') },
      result: { code: 'tackle', yards: 3, endYardLine: 'H33' },
      description: 'Home rush for 3 yards.',
    },
  ],
  stats: {
    sourceEventSequence: 2,
    teams: { H: { rushAttempts: 2, rushYards: 8, plays: 2, yards: 8 }, V: {} },
    players: { 'H-22': { playerId: 'H-22', team: 'H', rushAttempts: 2, rushYards: 8 } },
  },
  locks: {},
});

const passReplacement = (endYardLine = 'H30', yards = 5) => ({
  clientEventId: 'replacement-pass-client',
  type: 'pass',
  subtype: 'complete',
  period: 4,
  clock: '01:00',
  possession: 'H',
  preState: series(),
  participants: {
    primary: participant('H-12', 'H', 'passer'),
    secondary: participant('H-88', 'H', 'receiver'),
  },
  result: {
    code: 'complete',
    yards,
    endYardLine,
    pass: { outcome: 'complete', passingYards: yards, startYardLine: 'H25', terminalYardLine: endYardLine },
  },
  description: `Home pass complete for ${yards} yards.`,
  source: { kind: 'fcqi', draftIntentId: 'replacement-pass-intent' },
  confirmation: { summaryText: `Home pass complete for ${yards} yards.` },
});

describe('football historical play replacement', () => {
  it('builds a live historical input context without reopening the saved final envelope', () => {
    const envelope = baseEnvelope();
    const working = buildFootballPlayReplacementEnvelope(envelope, envelope.events[0]);

    expect(envelope.game.status).toBe('final');
    expect(working.game.status).toBe('inProgress');
    expect(working.pregame.gamePhase).toBe('live');
    expect(working.events).toEqual([]);
    expect(working.stats.sourceEventSequence).toBe(0);
    expect(working.clock).toMatchObject({ period: 4, clock: '01:00', isRunning: false });
    expect(working.liveState).toEqual(envelope.events[0].preState);
  });

  it('replaces one final-game event in place and recalculates its statistics', () => {
    const envelope = baseEnvelope();
    const result = replaceFootballPlayInEnvelope(
      envelope,
      envelope.events[0],
      passReplacement(),
      { editedAt: '2026-08-29T02:00:00.000Z' },
    );

    expect(result.ok).toBe(true);
    expect(result.envelope.game.status).toBe('final');
    expect(result.envelope.game.wrapUp.completedAt).toBe('2026-08-29T01:00:00.000Z');
    expect(result.envelope.events).toHaveLength(2);
    expect(result.envelope.events[0]).toMatchObject({
      eventId: 'EVT-000001',
      clientEventId: 'rush-1-client',
      sequence: 1,
      type: 'pass',
      subtype: 'complete',
      period: 4,
      clock: '01:00',
      preState: series(),
      postState: series({ down: 2, distance: 5, yardLine: 'H30' }),
      source: {
        replacement: {
          replacedEventId: 'EVT-000001',
          replacementDraftClientEventId: 'replacement-pass-client',
          previousType: 'rush',
        },
      },
    });
    expect(result.envelope.events[1]).toEqual(envelope.events[1]);
    expect(result.envelope.drives).toEqual(envelope.drives);
    expect(result.envelope.stats.teams.H).toMatchObject({
      rushAttempts: 1,
      rushYards: 3,
      pass: { att: 1, cmp: 1, int: 0, yds: 5 },
      plays: 2,
      yards: 8,
    });
    expect(result.envelope.stats.players['H-12']).toMatchObject({ passAttempts: 1, passCompletions: 1, passYards: 5 });
    expect(result.envelope.stats.players['H-88']).toMatchObject({ targets: 1, receptions: 1, receivingYards: 5 });
    expect(result.envelope.stats.players['H-22']).toMatchObject({ rushAttempts: 1, rushYards: 3 });
  });

  it('blocks a replacement that would contradict the next recorded play context', () => {
    const envelope = baseEnvelope();
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], passReplacement('H31', 6));

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: 'REPLACEMENT_CONTEXT_MISMATCH' });
    expect(result.errors[0].details.fields).toEqual(expect.arrayContaining(['distance', 'yardLine']));
    expect(result.errors[0].message).toContain('play #2');
    expect(envelope.events[0].type).toBe('rush');
  });

  it('updates the final score by the scoring delta while preserving kickoff context', () => {
    const envelope = baseEnvelope();
    envelope.game.teams.H.score = 7;
    envelope.events = [
      {
        ...clone(envelope.events[0]),
        eventId: 'EVT-TRY',
        clientEventId: 'try-client',
        type: 'try',
        subtype: 'kickGood',
        possession: null,
        preState: series({ possession: null, down: null, distance: null, yardLine: 'V03', lineToGain: null, driveId: null }),
        result: { code: 'good', scoring: { team: 'H', points: 1, type: 'patKick' } },
      },
      {
        ...clone(envelope.events[1]),
        eventId: 'EVT-KICKOFF',
        clientEventId: 'kickoff-client',
        type: 'kickoff',
        subtype: 'returned',
        possession: null,
        preState: series({ possession: null, down: null, distance: null, yardLine: 'H35', lineToGain: null, driveId: null }),
      },
    ];
    envelope.stats.sourceEventSequence = 2;

    const replacement = {
      ...clone(envelope.events[0]),
      clientEventId: 'two-point-client',
      subtype: 'rushGood',
      result: { code: 'good', scoring: { team: 'H', points: 2, type: 'patRush' } },
    };
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], replacement);

    expect(result.ok).toBe(true);
    expect(result.envelope.game.teams.H.score).toBe(8);
    expect(result.envelope.game.status).toBe('final');
    expect(result.envelope.events).toHaveLength(2);
  });

  it('rejects Game Control as a structural play replacement', () => {
    const envelope = baseEnvelope();
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], {
      ...passReplacement(),
      type: 'gameControl',
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_REPLACEMENT_TYPE');
  });

  it('does not guess when the following play lacks a recorded context checkpoint', () => {
    const envelope = baseEnvelope();
    delete envelope.events[1].preState;

    expect(() => buildFootballPlayReplacementEnvelope(envelope, envelope.events[0]))
      .toThrow('does not contain a recorded starting context');
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], passReplacement());
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('REPLACEMENT_CHECKPOINT_UNAVAILABLE');
  });

  it('does not guess when the selected play lacks its starting context', () => {
    const envelope = baseEnvelope();
    delete envelope.events[0].preState;

    expect(() => buildFootballPlayReplacementEnvelope(envelope, envelope.events[0]))
      .toThrow('does not contain a recorded starting context');
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], passReplacement());
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('REPLACEMENT_PRESTATE_UNAVAILABLE');
  });

  it('does not replace when the accepted event log is incomplete', () => {
    const envelope = baseEnvelope();
    envelope.events[1].sequence = 3;

    expect(() => buildFootballPlayReplacementEnvelope(envelope, envelope.events[0]))
      .toThrow('complete sequential event log');
    const result = replaceFootballPlayInEnvelope(envelope, envelope.events[0], passReplacement());
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('REPLACEMENT_EVENT_LOG_INCOMPLETE');
  });
});
