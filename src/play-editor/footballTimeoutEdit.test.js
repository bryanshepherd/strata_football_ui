import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { reviewFootballPlayContexts } from './footballPlayContext';
import { updateFootballTimeout } from './footballTimeoutEdit';
import { footballTimeoutValues } from '../utils/footballTimeout';

const correct = { possession: 'H', down: 3, distance: 10, yardLine: 'H15', lineToGain: 'H25', goalToGo: false, driveId: 'DRV-0002', driveNumber: 2 };
const fixture = () => {
  const game = structuredClone(getGameEnvelopeFixture('normal'));
  game.clock.period = 1;
  game.liveState.timeouts = { H: 3, V: 2 };
  game.events = [
    { eventId: 'pass', sequence: 1, type: 'pass', status: 'accepted', period: 1, clock: '06:00', possession: 'H', preState: { ...correct, down: 2 }, postState: correct, result: { code: 'incomplete', yards: 0, endYardLine: 'H15' } },
    { eventId: 'timeout', clientEventId: 'timeout-client', sequence: 2, type: 'gameControl', subtype: 'timeout', status: 'accepted', period: 1, clock: '05:59', possession: 'H', preState: { ...correct, down: 2, distance: 5, yardLine: 'H20' }, result: { code: 'noPlay', clock: '05:59', clockTenths: 3590, gameControl: { action: 'timeout', teamSide: 'V', possession: 'V', clock: '05:59' } }, confirmation: { summaryText: 'old text' } },
    { eventId: 'next', sequence: 3, type: 'rush', status: 'accepted', period: 1, clock: '05:50', possession: 'H', preState: correct, result: { code: 'tackle', yards: 0, endYardLine: 'H15' } },
  ];
  return game;
};
const save = (game, patch = {}, options = { recalculateContext: true }) => updateFootballTimeout(game, game.events[1], { ...footballTimeoutValues(game.events[1]), ...patch }, options);

describe('timeout editing and context repair', () => {
  it('flags and repairs the timeout start without changing caller, later plays, counts or clock', () => {
    const game = fixture();
    const before = structuredClone(game);
    expect(reviewFootballPlayContexts(game).reviews.get('timeout').fields).toEqual(['down', 'distance', 'yardLine']);
    const saved = save(game);
    expect(saved.events[1].preState).toMatchObject(correct);
    expect(saved.events[1].postState).toMatchObject(correct);
    expect(saved.events[1].possession).toBe('H');
    expect(saved.events[1].result.gameControl.teamSide).toBe('V');
    expect(saved.events[1].result.gameControl.possession).toBe('V');
    expect(reviewFootballPlayContexts(saved).reviews.get('timeout').fields).toEqual([]);
    expect(saved.events.filter((_, i) => i !== 1)).toEqual(game.events.filter((_, i) => i !== 1));
    expect(saved.liveState).toEqual(game.liveState);
    expect(saved.clock).toEqual(game.clock);
    expect(saved.game).toEqual(game.game);
    expect(game).toEqual(before);
  });

  it('updates clock, caller, text and current-half timeout charges once', () => {
    const game = fixture();
    const saved = save(game, { teamSide: 'H', clock: '5:55' });
    expect(saved.events[1]).toMatchObject({ eventId: 'timeout', clientEventId: 'timeout-client', sequence: 2, period: 1, clock: '05:55', possession: 'H', result: { clock: '05:55', clockTenths: 3550, gameControl: { teamSide: 'H', possession: 'H', teamId: game.game.teams.H.teamId, clock: '05:55' } } });
    expect(saved.events[1].description).toBe(`(5:55) Timeout called by ${game.game.teams.H.name}.`);
    expect(saved.events[1].confirmation.summaryText).toBe(saved.events[1].description);
    expect(saved.liveState.timeouts).toEqual({ H: 2, V: 3 });
    expect(save(saved).liveState.timeouts).toEqual({ H: 2, V: 3 });
    expect(saved.clock).toEqual(game.clock);
  });

  it('does not transfer timeout charges from a previous half or regulation into overtime', () => {
    for (const period of [3, 5]) {
      const game = fixture();
      game.game.rules.overtimeEnabled = true;
      game.game.rules.overtimeStyle = 'ncaa';
      game.clock.period = period;
      expect(save(game, { teamSide: 'H' }).liveState.timeouts).toEqual(game.liveState.timeouts);
    }
  });

  it('preserves final status and uses the preceding context for a trailing timeout', () => {
    const game = fixture(); game.events.pop(); game.game.status = 'final';
    const saved = save(game, { clock: '5:55' });
    expect(saved.game).toEqual(game.game);
    expect(saved.liveState).toMatchObject({ ...correct, timeouts: game.liveState.timeouts });
    expect(saved.clock).toMatchObject({ clock: '05:55', clockTenths: 3550, isRunning: false });
  });

  it.each([{clock:'5:99'}, {clock:'16:00'}, {clock:'06:01'}, {clock:'05:49'}, {teamSide:'X'}])('rejects invalid timeout details %j', patch => {
    expect(() => save(fixture(), patch)).toThrow();
  });

  it('requires a current target and a complete log, and never invents preceding context', () => {
    const game = fixture();
    const target = game.events[1];
    expect(() => updateFootballTimeout(game, {...target, eventId:'removed'}, footballTimeoutValues(target))).toThrow('no longer');
    expect(() => updateFootballTimeout(game, {...target, clock:'05:58'}, footballTimeoutValues(target))).toThrow('changed while');
    game.events[0].sequence = 0;
    expect(() => save(game)).toThrow('complete sequential');
    const first = fixture(); first.events = [{...first.events[1], sequence:1}];
    expect(() => updateFootballTimeout(first, first.events[0], footballTimeoutValues(first.events[0]), {recalculateContext:true})).toThrow('No preceding');
    expect(updateFootballTimeout(first, first.events[0], {teamSide:'V',clock:'05:58'}).events[0].preState).toEqual(first.events[0].preState);
  });
});
