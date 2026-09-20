import { describe, expect, it } from 'vitest';
import {
  applyFootballPlayEditToEnvelope,
  buildFootballEditedPlaySummary,
  repairFootballPlayReadoutsInEnvelope,
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
  it('restores the ejected checkbox from an older explicit ejection note, preserving saved No decisions', () => {
    const source = structuredClone(envelope);
    source.events[0].penalties[0] = { ...source.events[0].penalties[0], code: 'TH', name: 'Targeting', notes: 'EJECTION: H-8 ejected from the game.' };
    const repaired = repairFootballPlayReadoutsInEnvelope(source);
    expect(repaired.events[0].penalties[0]).toMatchObject({ ejected: true, ejectedPlayerId: 'H-8' });
    expect(repaired.events[0].description).toContain('#8 Mike Wilson ejected from the game');
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
    source.events[0].penalties[0].ejected = false;
    expect(repairFootballPlayReadoutsInEnvelope(source).events[0].penalties[0].ejected).toBe(false);
    delete source.events[0].penalties[0].ejected;
    delete source.events[0].penalties[0].notes;
    expect(repairFootballPlayReadoutsInEnvelope(source).events[0].penalties[0].ejected).toBeUndefined();
  });

  it('recounts fouls after edits or removal while preserving the operator ejection decision', () => {
    const source = structuredClone(envelope);
    const event = (sequence, ejected) => ({ ...structuredClone(baseEvent), sequence, eventId: `uns-${sequence}`,
      penalties: [{ ...baseEvent.penalties[0], code: 'UC', name: 'Unsportsmanlike Conduct',
        ...(ejected !== undefined ? { ejected, ejectedPlayerId: 'H-8' } : {}) }],
    });
    source.events = [event(1), event(2, true)];
    const repaired = repairFootballPlayReadoutsInEnvelope(source);
    expect(repaired.events.map(e => e.penalties[0].unsportsmanlikeCount)).toEqual([1, 2]);
    expect(repaired.events[0].description).toContain('Wilson’s first unsportsmanlike foul of the game.');
    expect(repaired.events[1].description).toContain('Wilson’s second unsportsmanlike foul of the game.');
    expect(repaired.events[1].description).toContain('#8 Mike Wilson ejected from the game');
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
    const oldWording = structuredClone(repaired);
    oldWording.events[0].description = 'PENALTY WVSU Unsportsmanlike Conduct (#8 Mike Wilson), unsportsmanlike foul 1 for this player, 15 yards to the H27.';
    const refreshed = repairFootballPlayReadoutsInEnvelope(oldWording);
    expect(refreshed.events[0].description).toMatch(/\. Wilson’s first unsportsmanlike foul of the game\.$/);
    expect(refreshed.events[0].penalties).toEqual(oldWording.events[0].penalties);
    const removed = repairFootballPlayReadoutsInEnvelope({ ...repaired, events: [repaired.events[1]] });
    expect(removed.events[0].penalties[0]).toMatchObject({ unsportsmanlikeCount: 1, ejected: true });
    expect(removed.events[0].description).not.toContain('second unsportsmanlike foul');
    const edited = structuredClone(repaired);
    edited.events[0].penalties[0] = { ...edited.events[0].penalties[0], code: 'PF', name: 'Personal Foul' };
    const recounted = repairFootballPlayReadoutsInEnvelope(edited);
    expect(recounted.events[0].penalties[0].unsportsmanlikeCount).toBeUndefined();
    expect(recounted.events[0].description).not.toContain('unsportsmanlike foul');
    expect(recounted.events[1].penalties[0].unsportsmanlikeCount).toBe(1);
  });

  it('resolves a changed penalty code instead of retaining its previous name', () => {
    const edited = structuredClone(baseEvent);
    edited.penalties[0].code = 'RTK';
    const saved = applyFootballPlayEditToEnvelope(envelope, edited).events[0];
    expect(saved.penalties[0]).toMatchObject({ code: 'RTK', name: 'Roughing the Kicker', yards: 15 });
    expect(saved.description).toContain('PENALTY WVSU Roughing the Kicker');
    expect(saved.description).not.toContain('Personal Foul');
    expect(saved.preState).toEqual(baseEvent.preState);
    expect(saved.postState).toEqual(baseEvent.postState);
    edited.penalties[0].code = 'NEWCODE';
    expect(applyFootballPlayEditToEnvelope(envelope, edited).events[0].description).toContain('PENALTY WVSU NEWCODE');
    edited.penalties[0].name = 'Operator wording';
    expect(applyFootballPlayEditToEnvelope(envelope, edited).events[0].description).toContain('Operator wording');
  });

  it('keeps historical custom penalty names when an actor is edited', () => {
    const source = structuredClone(envelope);
    source.events[0].penalties[0] = { ...baseEvent.penalties[0], code: 'XYZ', name: undefined };
    source.events[0].description = 'Run, PENALTY WVSU Custom recorded foul, 15 yards to the H27.';
    const edited = structuredClone(source.events[0]);
    edited.penalties[0].notes = 'Confirmed';
    const saved = applyFootballPlayEditToEnvelope(source, edited).events[0];
    expect(saved.penalties[0].name).toBe('Custom recorded foul');
    expect(saved.description).toContain('Custom recorded foul');
  });

  it('updates existing challenge descriptions and confirmations without changing the ruling or context', () => {
    const source = structuredClone(envelope);
    source.events = [{
      ...baseEvent, type: 'gameControl', subtype: 'challenge', possession: 'H', penalties: [],
      participants: {}, description: 'FAIR challenge call Confirmed.',
      confirmation: { summaryText: 'FAIR challenge call Confirmed.' },
      result: { code: 'noPlay', gameControl: { action: 'challenge', teamSide: 'V', challengeStatus: 'callConfirmed' } },
    }];
    const before = JSON.stringify(source);
    const repaired = repairFootballPlayReadoutsInEnvelope(source);
    expect(repaired.events[0].description).toBe('Challenge by FAIR: the ruling on the field is confirmed.');
    expect(repaired.events[0].confirmation.summaryText).toBe(repaired.events[0].description);
    expect(repaired.events[0].result).toEqual(source.events[0].result);
    expect(repaired.events[0].preState).toEqual(source.events[0].preState);
    expect(repaired.events[0].postState).toEqual(source.events[0].postState);
    expect(JSON.stringify(source)).toBe(before);
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
  });

  it('repairs missing kickoff penalty yards and clearly describes the replay without changing its ball context', () => {
    const source = structuredClone(envelope);
    const kickoff = {
      ...baseEvent, type: 'kickoff', subtype: 'returned', possession: null,
      preState: { possession: null, down: null, distance: null, yardLine: 'V35' },
      participants: { primary: { playerId: 'V-11', team: 'V', role: 'kicker' }, kicker: { playerId: 'V-11', team: 'V', role: 'kicker' }, returner: { playerId: 'H-8', team: 'H', role: 'returner' }, defenders: [] },
      result: { code: 'returned', endYardLine: 'H20', nextPossession: 'H', kick: { kickYards: 55, catchYardLine: 'H10' }, return: { returnerPlayerId: 'H-8', returnYards: 10, returnEndYardLine: 'H20' }, penaltyContext: { setupContext: 'awaitingKickoff', startNewDrive: false } },
      penalties: [{ penaltyId: 'K-OFF', code: 'OFF', team: 'V', status: 'accepted', yards: null, enforcedFrom: 'previousSpot', finalSpot: 'V30', replayDown: true }],
      description: 'Kickoff, yards pending, replay down.',
    };
    source.events = [kickoff];
    const before = JSON.stringify(source);
    const repaired = repairFootballPlayReadoutsInEnvelope(source);
    expect(repaired.events[0].penalties[0].yards).toBe(5);
    expect(repaired.events[0].description).toContain('No play. PENALTY FAIR Offsides, 5 yards from the V35 to the V30. Re-kick from the V30.');
    expect(repaired.events[0].confirmation.summaryText).toBe(repaired.events[0].description);
    expect(repaired.events[0].preState).toEqual(kickoff.preState);
    expect(repaired.events[0].postState).toEqual(kickoff.postState);
    expect(repaired.events[0].result).toEqual(kickoff.result);
    expect(JSON.stringify(source)).toBe(before);
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);

    kickoff.penalties[0] = { ...kickoff.penalties[0], yards: 5, status: 'declined' };
    expect(buildFootballEditedPlaySummary(source, kickoff)).not.toMatch(/No play|Re-kick/);
    kickoff.penalties[0] = { ...kickoff.penalties[0], status: 'accepted', enforcedFrom: 'endOfPlay', replayDown: false };
    expect(buildFootballEditedPlaySummary(source, kickoff)).not.toMatch(/No play|Re-kick/);
  });

  it('keeps roster names when a saved pass contains only participant IDs', () => {
    const source = structuredClone(envelope);
    source.rosters.teams.V.players['V-7'] = { playerId: 'V-7', team: 'V', jersey: '7', displayName: 'Davyn Reid' };
    const play = {
      ...baseEvent, type: 'pass', subtype: 'complete', penalties: [],
      participants: {
        primary: { playerId: 'V-11', team: 'V', role: 'passer' },
        secondary: { playerId: 'V-7', team: 'V', role: 'intendedReceiver' },
        receiver: { playerId: 'V-7', team: 'V', role: 'receiver' },
      },
      result: { code: 'complete', yards: 39, endYardLine: 'goal', scoring: { team: 'V', type: 'touchdown', points: 6 }, pass: { outcome: 'complete', catchYardLine: 'V14', receivingYards: 39 } },
    };
    source.events = [play];
    const before = JSON.stringify(source);
    const edited = structuredClone(play);
    edited.result.pass.catchYardLine = 'H14';
    const updated = applyFootballPlayEditToEnvelope(source, edited);
    expect(updated.events[0].description).toBe('FAIR #11 Nino Marzullo pass complete to #7 Davyn Reid for 39 yards for a touchdown.');
    expect(updated.events[0].participants).toEqual(play.participants);
    expect(JSON.stringify(source)).toBe(before);
  });

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
