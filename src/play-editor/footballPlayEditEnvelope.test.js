import { describe, expect, it } from 'vitest';
import {
  applyFootballPlayEditToEnvelope,
  buildFootballEditedPlaySummary,
} from './footballPlayEditEnvelope';

const participant = (playerId, team, jersey, displayName, role) => ({
  playerId, team, jersey, displayName, role,
});

const baseEvent = {
  eventId: 'LOCAL-000129',
  clientEventId: 'edit-test-129',
  sequence: 129,
  type: 'rush',
  subtype: null,
  createdAt: '2026-08-26T04:07:53.131Z',
  acceptedAt: '2026-08-26T04:07:53.131Z',
  status: 'accepted',
  period: 3,
  clock: '06:55',
  possession: 'V',
  preState: { possession: 'V', down: 1, distance: 10, yardLine: 'H46', lineToGain: 'H36', driveId: 'DRV-17', driveNumber: 17 },
  postState: { possession: 'V', down: 1, distance: 10, yardLine: 'H27', lineToGain: 'H17', driveId: 'DRV-17', driveNumber: 17 },
  participants: {
    primary: participant('V-11', 'V', '11', 'Nino Marzullo', 'rusher'),
    defenders: [],
    penalizedPlayers: [],
    others: [],
  },
  result: { code: 'outOfBounds', yards: 4, endYardLine: 'H42', firstDown: true, driveEnds: false },
  penalties: [{
    penaltyId: 'PEN-1', code: 'PF', name: 'Personal Foul', team: 'H', playerId: 'H-8',
    status: 'accepted', yards: 15, enforcedFrom: 'endOfPlay', finalSpot: 'H27', automaticFirstDown: true,
  }],
  description: 'Original description.',
  confirmation: { summaryText: 'Original description.' },
};

const envelope = {
  gameId: 'FB-EDIT',
  updatedAt: '2026-08-26T04:07:53.131Z',
  game: {
    teams: {
      H: { name: 'West Virginia State', abbr: 'WVSU' },
      V: { name: 'Fairmont State', abbr: 'FAIR' },
    },
    rules: {},
  },
  rosters: {
    teams: {
      H: { players: { 'H-8': { playerId: 'H-8', team: 'H', jersey: '8', displayName: 'Mike Wilson', position: 'LB' } } },
      V: { players: { 'V-11': { playerId: 'V-11', team: 'V', jersey: '11', displayName: 'Nino Marzullo', position: 'QB' } } },
    },
  },
  events: [baseEvent],
};

describe('football play edit envelope', () => {
  it('rebuilds the natural description and keeps contextual fields locked', () => {
    const edited = JSON.parse(JSON.stringify(baseEvent));
    edited.result.endYardLine = 'H41';
    edited.result.yards = 5;
    edited.penalties[0].finalSpot = 'H26';
    edited.penalties[0].yards = 15;

    const updated = applyFootballPlayEditToEnvelope(envelope, edited, { editedAt: '2026-08-26T08:00:00Z' });

    expect(updated.updatedAt).toBe('2026-08-26T08:00:00Z');
    expect(updated.events[0].preState).toEqual(baseEvent.preState);
    expect(updated.events[0].postState).toEqual(baseEvent.postState);
    expect(updated.events[0].description).toContain('FAIR #11 Nino Marzullo rush for 5 yards to the H41');
    expect(updated.events[0].description).toContain('PENALTY WVSU Personal Foul (#8 Mike Wilson), 15 yards to the H26');
    expect(updated.events[0].confirmation.summaryText).toBe(updated.events[0].description);
  });

  it('rejects changes to locked clock context', () => {
    expect(() => applyFootballPlayEditToEnvelope(envelope, { ...baseEvent, clock: '06:54' }))
      .toThrow('clock is locked context and cannot be edited.');
  });

  it('rejects a structural result-code change', () => {
    const edited = { ...baseEvent, result: { ...baseEvent.result, code: 'fumble' } };
    expect(() => applyFootballPlayEditToEnvelope(envelope, edited))
      .toThrow('This result-code change requires replacing the play.');
  });

  it('can regenerate a penalty-only summary with the penalized player', () => {
    const penaltyEvent = {
      ...baseEvent,
      type: 'penalty',
      subtype: 'accepted',
      result: { code: 'accepted' },
      participants: { defenders: [], penalizedPlayers: [], others: [] },
    };
    expect(buildFootballEditedPlaySummary(envelope, penaltyEvent))
      .toContain('PENALTY WVSU Personal Foul (#8 Mike Wilson)');
  });
});
