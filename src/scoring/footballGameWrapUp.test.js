import { describe, expect, it } from 'vitest';
import {
  applyFootballGameWrapUp,
  calculateFootballGameDurationMinutes,
  createFootballGameWrapUpDraft,
  formatFootballGameDuration,
} from './footballGameWrapUp';

const envelope = {
  gameId: 'FB-WRAP-1',
  updatedAt: '2026-08-26T02:30:00Z',
  game: {
    status: 'final',
    scheduledAt: '2026-08-25T23:00:00Z',
    rules: { periods: 4 },
    teamRecords: {
      H: { overall: '2-1', conference: '1-0' },
      V: { overall: '2-1', conference: '0-1' },
    },
    officials: [
      { role: 'Referee', name: 'Alex Referee' },
      { role: 'Umpire', name: 'Casey Umpire' },
    ],
  },
  pregame: { gamePhase: 'final' },
  events: [
    { sequence: 1, type: 'kickoff', acceptedAt: '2026-08-25T23:04:00Z', status: 'accepted' },
    { sequence: 199, type: 'rush', acceptedAt: '2026-08-26T02:14:00Z', status: 'accepted' },
    { sequence: 200, type: 'gameControl', subtype: 'endQuarter', period: 4, acceptedAt: '2026-08-26T02:16:00Z', status: 'accepted' },
  ],
};

describe('footballGameWrapUp', () => {
  it('prepopulates records, officials, and actual event timestamps', () => {
    const draft = createFootballGameWrapUpDraft(envelope);

    expect(draft).toMatchObject({
      previousRecords: {
        H: { overall: '2-1', conference: '1-0' },
        V: { overall: '2-1', conference: '0-1' },
      },
      startedAt: '2026-08-25T23:04:00.000Z',
      endedAt: '2026-08-26T02:16:00.000Z',
      durationMinutes: 192,
      officials: [
        { role: 'Referee', name: 'Alex Referee' },
        { role: 'Umpire', name: 'Casey Umpire' },
      ],
    });
  });

  it('calculates and formats elapsed time', () => {
    expect(calculateFootballGameDurationMinutes('2026-08-25T23:04:00Z', '2026-08-26T02:16:00Z')).toBe(192);
    expect(formatFootballGameDuration(192)).toBe('3:12');
    expect(calculateFootballGameDurationMinutes('2026-08-26T02:16:00Z', '2026-08-25T23:04:00Z')).toBeNull();
  });

  it('saves normalized wrap-up data in the authoritative envelope', () => {
    const next = applyFootballGameWrapUp(envelope, {
      ...createFootballGameWrapUpDraft(envelope),
      attendance: '4200',
      weather: { temperatureF: '72', wind: 'NW 8 mph', conditions: 'Clear' },
      notes: '  Senior night.  ',
    }, '2026-08-26T02:20:00Z');

    expect(next.updatedAt).toBe('2026-08-26T02:20:00.000Z');
    expect(next.game.wrapUp).toMatchObject({
      durationMinutes: 192,
      attendance: 4200,
      weather: { temperatureF: 72, wind: 'NW 8 mph', conditions: 'Clear' },
      notes: 'Senior night.',
      completedAt: '2026-08-26T02:20:00.000Z',
      updatedAt: '2026-08-26T02:20:00.000Z',
    });
  });

  it('rejects an end time before the start and invalid attendance', () => {
    const draft = createFootballGameWrapUpDraft(envelope);
    expect(() => applyFootballGameWrapUp(envelope, {
      ...draft,
      endedAt: '2026-08-25T22:00:00Z',
    })).toThrow(/end time cannot be before/i);
    expect(() => applyFootballGameWrapUp(envelope, {
      ...draft,
      attendance: '-1',
    })).toThrow(/attendance/i);
  });
});
