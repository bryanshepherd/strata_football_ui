import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { footballContextEventKey, recalculateFootballPlayContext, reviewFootballPlayContexts } from './footballPlayContext';

const context = (patch = {}) => ({ possession: 'H', down: 1, distance: 10, yardLine: 'V43', lineToGain: 'V33', goalToGo: false, driveId: 'DRV-0001', driveNumber: 1, ...patch });
const play = (sequence, preState, yards, endYardLine, extra = {}) => ({
  sequence, eventId: `LOCAL-${sequence}`, clientEventId: `client-${sequence}`, status: 'accepted',
  type: 'rush', period: 1, clock: '11:36', possession: preState.possession,
  preState, participants: { primary: { team: preState.possession, playerId: `${preState.possession}-RUNNER`, jersey: '2', role: 'rusher' } },
  penalties: [], result: { code: 'tackle', yards, endYardLine }, ...extra,
});
const base = () => {
  const game = structuredClone(getGameEnvelopeFixture('normal'));
  game.events = [];
  game.game.status = 'final';
  game.game.wrapUp = { completedAt: '2026-09-12T06:00:00Z' };
  game.liveState = context({ timeouts: { H: 1, V: 2 }, challenges: { H: 0, V: 0 } });
  game.drives = { current: null, completed: [{ driveId: 'DRV-0001', driveNumber: 1, team: 'H', startYardLine: 'H25', startClock: '12:00', startPeriod: 1, endPeriod: 1, endClock: '09:00', result: 'punt', plays: 3, yards: 13 }] };
  return game;
};
const chain = () => {
  const game = base();
  game.events = [
    play(1, context({ down: 2, distance: 5, yardLine: 'H44', lineToGain: 'H49' }), 8, 'V48', {
      postState: context(),
      penalties: [{ code: 'FMB', team: 'V', status: 'accepted', yards: 5, enforcedFrom: 'endOfPlay', finalSpot: 'V43', replayDown: true }],
    }),
    play(2, context({ distance: 5, lineToGain: 'V38' }), 2, 'V41'),
    play(3, context({ down: 2, distance: 3, yardLine: 'V41', lineToGain: 'V38' }), 3, 'V38', {
      result: { code: 'tackle', yards: 3, endYardLine: 'V38', firstDown: true },
    }),
  ];
  return game;
};
const review = (game, index) => reviewFootballPlayContexts(game).reviews.get(footballContextEventKey(game.events[index]));
const control = (sequence, action, extra = {}) => ({
  sequence, eventId: `CONTROL-${sequence}`, clientEventId: `control-${sequence}`,
  type: 'gameControl', status: 'accepted', period: 1, clock: '09:00', preState: context({ distance: 99 }),
  result: { code: 'noPlay', gameControl: { action, ...extra } },
});

describe('football play context continuity and repair', () => {
  it('flags a stale start, recalculates both sides, then exposes the following mismatch without changing that play', () => {
    const game = chain();
    game.events[1].description = 'Winfield #8 Levi Craigo rush for 2 yards, tackled by #25 David Hill.';
    const original = structuredClone(game);
    expect(review(game, 1).fields).toEqual(['distance', 'lineToGain']);
    expect(review(game, 2).fields).toEqual([]);
    const repaired = recalculateFootballPlayContext(game, game.events[1]);
    expect(repaired.events[1].preState).toMatchObject(context());
    expect(repaired.events[1].postState).toMatchObject({ down: 2, distance: 8, yardLine: 'V41', lineToGain: 'V33' });
    expect(review(repaired, 1).fields).toEqual([]);
    expect(review(repaired, 2).fields).toContain('distance');
    expect(repaired.events[2]).toEqual(game.events[2]);
    expect(repaired.events[1].description).toBe(game.events[1].description);
    expect(repaired.liveState).toEqual(game.liveState);
    expect(repaired.game).toEqual(game.game);
    expect(repaired.clock).toEqual(game.clock);
    const final = recalculateFootballPlayContext(repaired, repaired.events[2]);
    expect(final.events[2].preState).toMatchObject({ down: 2, distance: 8, yardLine: 'V41' });
    expect(final.events[2].postState).toMatchObject({ down: 3, distance: 5, yardLine: 'V38', lineToGain: 'V33' });
    expect(final.events[2].result.firstDown).toBe(false);
    expect(final.liveState).toMatchObject({ down: 3, distance: 5, timeouts: { H: 1, V: 2 } });
    expect(final.stats.teams.H.firstDowns).toBe(1);
    // Drive yardage includes the net field position from its recorded H25 start.
    expect(final.drives.completed[0]).toMatchObject({ plays: 3, yards: 37 });
    expect(game).toEqual(original);
  });

  it('repairs the first snap after a confirmed kickoff penalty from 1st and 20 to 1st and 10', () => {
    const game = base();
    game.game.rules.kickoffSpot = 'H40';
    game.game.teams.V.score = 6;
    const kickoff = play(1, { possession: null, down: null, distance: null, yardLine: 'H40', lineToGain: null, driveNumber: 0 }, 0, 'V40', {
      type: 'kickoff', possession: 'H',
      penalties: [{ code: 'HOLD', team: 'V', status: 'accepted', yards: 10, enforcedFrom: 'spotOfFoul', spotOfFoul: 'V31', finalSpot: 'V21' }],
      result: { code: 'returned', endYardLine: 'V40', nextPossession: 'V', penaltyContext: {
        decision: 'afterChange', possession: 'V', down: 1, distance: 10, yardLine: 'V21', startNewDrive: true, confirmed: true,
      } },
      postState: context({ possession: 'V', yardLine: 'V21', lineToGain: 'V31', driveNumber: 27 }),
    });
    game.events = [kickoff, play(2, context({ possession: 'V', distance: 20, yardLine: 'V21', lineToGain: 'V41' }), 79, 'H00', {
      result: { code: 'touchdown', yards: 79, endYardLine: 'H00', scoring: { team: 'V', points: 6, type: 'touchdown' } },
    })];
    const result = recalculateFootballPlayContext(game, game.events[1]);
    expect(result.events[1].preState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'V21', lineToGain: 'V31', driveNumber: 1 });
    expect(result.events[1].postState).toMatchObject({ possession: null, pendingTryTeam: 'V', nextPlayContext: 'awaitingTry' });
    expect(result.game.teams.V.score).toBe(6);
    expect(result.events[1].result.yards).toBe(79);
    expect(result.events[0]).toEqual(kickoff);
  });

  it('derives missing ending contexts and ignores formatting, drive counters and clocks', () => {
    const game = chain();
    delete game.events[0].postState;
    expect(review(game, 1).expected).toMatchObject(context());
    game.events[1].preState = context({ down: '1', distance: '10', yardLine: 'v43', driveNumber: 99 });
    game.events[1].clock = '10:03';
    expect(review(game, 1).fields).toEqual([]);
  });

  it('carries the corrected result through clock and timeout records without treating the timeout team as possession', () => {
    const game = chain();
    game.events.splice(1, 0, control(2, 'timeout', { possession: 'V' }), control(3, 'setClock', { clock: '09:01' }));
    game.events.forEach((event, i) => { event.sequence = i + 1; });
    expect(review(game, 3).expected).toMatchObject(context());
    const repaired = recalculateFootballPlayContext(game, game.events[3]);
    expect(repaired.events[3].postState).toMatchObject({ possession: 'H', down: 2, distance: 8 });
    expect(repaired.events[1]).toEqual(game.events[1]);
  });

  it.each(['setBallContext', 'setPossession', 'startDrive'])('honors an explicit %s correction before comparing the next play', (action) => {
    const game = chain();
    game.events.splice(1, 0, control(2, action, { possession: 'V', down: 3, distance: 7, spot: 'V43', lineToGain: '50' }));
    game.events.forEach((event, i) => { event.sequence = i + 1; });
    const expected = review(game, 2).expected;
    expect(expected.possession).toBe('V');
    expect(expected.down).toBe(action === 'setBallContext' ? 3 : 1);
    expect(expected.distance).toBe(action === 'setBallContext' ? 7 : 10);
    expect(reviewFootballPlayContexts(game).reviews.has('CONTROL-2')).toBe(false);
  });

  it('preserves a confirmed penalty ending context while rebuilding its start', () => {
    const game = chain();
    game.events[1].penalties = [{ code: 'HOLD', team: 'H', status: 'accepted', finalSpot: 'V49', yards: 10, replayDown: true }];
    game.events[1].result.officialOutcome = { source: 'penaltyEnforcement', operatorVerified: true, verified: {
      possession: 'H', down: 1, distance: 16, yardLine: 'V49', lineToGain: 'V33', firstDownAwarded: false,
    } };
    const result = recalculateFootballPlayContext(game, game.events[1]);
    expect(result.events[1].postState).toMatchObject({ down: 1, distance: 16, yardLine: 'V49' });
    expect(result.events[1].result.officialOutcome).toEqual(game.events[1].result.officialOutcome);
  });

  it('discards unconfirmed cached penalty calculations during a forced repair', () => {
    const game = chain();
    game.events[1].result.officialOutcome = { source: 'penaltyEnforcement', operatorVerified: false, calculated: {
      possession: 'H', down: 2, distance: 3, yardLine: 'V41', lineToGain: 'V38',
    } };
    game.events[1].postState = context({ down: 2, distance: 3, yardLine: 'V41', lineToGain: 'V38' });
    const result = recalculateFootballPlayContext(game, game.events[1]);
    expect(result.events[1].postState).toMatchObject({ down: 2, distance: 8, lineToGain: 'V33' });
    expect(result.events[1].result.officialOutcome).toBeUndefined();
  });

  it('retains a valid goal-to-go start and a penalty-adjusted first down', () => {
    const game = chain();
    for (const ctx of [context({ distance: 6, yardLine: 'V06', lineToGain: 'goal', goalToGo: true }), context({ distance: 20, lineToGain: 'V23' })]) {
      game.events[0].postState = ctx;
      game.events[1].preState = structuredClone(ctx);
      expect(review(game, 1).fields).toEqual([]);
    }
  });

  it('recalculates simple yardage when the repaired starting spot moves', () => {
    const game = chain();
    game.events[1].preState.yardLine = 'V44';
    game.events[1].result.yards = 3;
    const result = recalculateFootballPlayContext(game, game.events[1]);
    expect(result.events[1].result.yards).toBe(2);
    expect(result.events[1].postState).toMatchObject({ down: 2, distance: 8 });
  });

  it('repairs a previous-spot penalty after a corrected play and stale timeout, keeping its final spot', () => {
    const game = base();
    const corrected = context({ down: 3, distance: 10, yardLine: 'H15', lineToGain: 'H25' });
    const stale = context({ down: 2, distance: 5, yardLine: 'H20', lineToGain: 'H25' });
    game.events = [
      play(1, { ...corrected, down: 2 }, 0, 'H15', { type: 'pass', result: { code: 'incomplete', yards: 0, endYardLine: 'H15' }, postState: corrected }),
      { ...control(2, 'timeout', { teamSide: 'V' }), preState: stale },
      play(3, stale, 0, 'H10', {
        type: 'penalty', participants: {},
        penalties: [{ penaltyId: 'dog-1', code: 'DOG', name: 'Delay of Game', team: 'H', timing: 'deadBall', status: 'accepted', yards: 10, enforcedFrom: 'previousSpot', finalSpot: 'H10', replayDown: true }],
        result: { code: 'accepted', endYardLine: 'H10', officialOutcome: { operatorVerified: false, calculated: { ...stale, yardLine: 'H10', distance: 15 } } },
        confirmation: { summaryText: 'old ten-yard text' },
      }),
      play(4, { ...corrected, down: 2 }, 12, 'H27'),
    ];
    const before = structuredClone(game);
    const result = recalculateFootballPlayContext(game, game.events[2]);
    const repaired = result.events[2];
    expect(repaired.preState).toMatchObject(corrected);
    expect(repaired.postState).toMatchObject({ down: 3, distance: 15, yardLine: 'H10', lineToGain: 'H25' });
    expect(repaired.penalties[0]).toEqual({ ...game.events[2].penalties[0], yards: 5 });
    expect(repaired.result.officialOutcome).toBeUndefined();
    expect(repaired.description).toContain('5 yards from the H15 to the H10');
    expect(repaired.confirmation.summaryText).toBe(repaired.description);
    expect(result.events.filter((_, i) => i !== 2)).toEqual(game.events.filter((_, i) => i !== 2));
    expect(result.liveState).toEqual(game.liveState);
    expect(result.game).toEqual(game.game);
    expect(review(result, 3).fields).toEqual(expect.arrayContaining(['down', 'distance', 'yardLine']));
    expect(game).toEqual(before);
    // A later recalculation remains an explicit operator action.
    const following = recalculateFootballPlayContext(result, result.events[3]);
    expect(following.events[3].result.yards).toBe(17);
    expect(following.events[3].postState).toMatchObject({ down: 1, distance: 10, yardLine: 'H27' });
  });

  it.each(['multiple', 'carryover', 'verified', 'spotFoul', 'wrongDirection', 'missingSpot'])('requires replacement for ambiguous moved-spot penalty enforcement: %s', (kind) => {
    const game = chain();
    game.events[1].preState.yardLine = 'V44';
    game.events[1].type = 'penalty';
    game.events[1].result = { code: 'accepted', endYardLine: 'V49' };
    const penalty = { code: 'DOG', team: 'H', status: 'accepted', yards: 5, enforcedFrom: 'previousSpot', finalSpot: 'V49', replayDown: true };
    game.events[1].penalties = [penalty];
    if (kind === 'multiple') game.events[1].penalties.push({ ...penalty });
    if (kind === 'carryover') penalty.carryOverToKickoff = true;
    if (kind === 'verified') game.events[1].result.officialOutcome = { operatorVerified: true };
    if (kind === 'spotFoul') penalty.enforcedFrom = 'spotOfFoul';
    if (kind === 'wrongDirection') penalty.finalSpot = 'V40';
    if (kind === 'missingSpot') delete penalty.finalSpot;
    expect(() => recalculateFootballPlayContext(game, game.events[1])).toThrow('Use Replace This Play');
  });

  it('requires replacement when correcting possession conflicts with recorded players', () => {
    const game = chain();
    game.events[0].postState.possession = 'V';
    expect(() => recalculateFootballPlayContext(game, game.events[1])).toThrow('recorded players');
  });

  it('does not repair a removed or changed target, a missing previous result, or an incomplete log', () => {
    const game = chain();
    expect(() => recalculateFootballPlayContext(game, { ...game.events[1], eventId: 'removed' })).toThrow('no longer');
    expect(() => recalculateFootballPlayContext(game, { ...game.events[1], clock: '00:01' })).toThrow('changed while');
    expect(() => recalculateFootballPlayContext(game, game.events[0])).toThrow('No preceding');
    game.events[1].sequence = 7;
    expect(review(game, 1).expected).toBeNull();
    expect(() => recalculateFootballPlayContext(game, game.events[1])).toThrow('complete sequential');
  });

  it('updates the current ball context through trailing administrative records while preserving final status and timeouts', () => {
    const game = chain();
    game.events.pop();
    game.events.push(control(3, 'timeout', { possession: 'V' }), control(4, 'endQuarter', { period: 4 }));
    const result = recalculateFootballPlayContext(game, game.events[1]);
    expect(result.liveState).toMatchObject({ down: 2, distance: 8, timeouts: game.liveState.timeouts });
    expect(result.game).toEqual(game.game);
    expect(result.clock).toEqual(game.clock);
    expect(result.events.slice(2)).toEqual(game.events.slice(2));
  });

  it('accounts for second-half kickoff setup across a quarter boundary', () => {
    const game = chain();
    game.events.push(control(4, 'startQuarter', { period: 3, secondHalf: { kickingTeam: 'V' } }));
    game.events.push(play(5, { possession: null, down: null, distance: null, yardLine: 'V35', lineToGain: null }, 0, 'H25', {
      type: 'kickoff', possession: 'V', result: { code: 'returned', endYardLine: 'H25', nextPossession: 'H' },
    }));
    expect(review(game, 4).expected).toMatchObject({ possession: null, kickoffTeam: 'V', nextPlayContext: 'awaitingKickoff' });
    expect(review(game, 4).fields).toEqual([]);
  });
});
