import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { buildFootballPlayByPlayReport } from '../reports/footballPlayByPlay';
import { recalculateFootballPlayContext, reviewFootballPlayContexts, saveFootballPlayEditToEnvelope } from './footballPlayContext';

const context = (patch = {}) => ({ possession: 'V', down: 1, distance: 10, yardLine: 'V21', lineToGain: 'V31', goalToGo: false, redZone: false, driveId: 'DRV-0001', driveNumber: 1, ...patch });
const fixture = () => {
  const game = structuredClone(getGameEnvelopeFixture('normal'));
  game.game.status = 'inProgress';
  game.game.teams.H.score = 0; game.game.teams.V.score = 0;
  game.pregame = { ...game.pregame, gamePhase: 'live' };
  game.events = [{ eventId: 'rush-1', clientEventId: 'client-1', sequence: 1, type: 'rush', status: 'accepted',
    period: 1, clock: '11:00', possession: 'V', preState: context(),
    participants: { primary: { playerId: 'runner', team: 'V', role: 'rusher' }, defenders: [] },
    result: { code: 'tackle', yards: 5, endYardLine: 'V26' }, penalties: [], description: 'Rush for 5 yards.' }];
  game.rosters.teams.V.players.runner = { playerId: 'runner', team: 'V', jersey: '41', firstName: 'George', lastName: 'Bush', displayName: 'George Bush', active: true };
  game.liveState = { ...game.liveState, ...context({ down: 2, distance: 5, yardLine: 'V26' }), nextPlayContext: 'V,2,5,V26' };
  game.drives = { completed: [], current: { driveId: 'DRV-0001', driveNumber: 1, team: 'V', startYardLine: 'V21', startClock: '12:00', startPeriod: 1, plays: 1, yards: 5 } };
  return normalizeFootballScoringSetupEnvelope(game);
};
const editSix = game => { const e = structuredClone(game.events[0]); Object.assign(e.result, { yards: 6, endYardLine: 'V27' }); return e; };
const control = (sequence, action, extra = {}) => ({ sequence, eventId: `control-${sequence}`, status: 'accepted', type: 'gameControl', period: 1, clock: '10:00', preState: context({ down: 2, distance: 5, yardLine: 'V26' }), result: { code: 'noPlay', gameControl: { action, ...extra } } });

describe('saved play edits refresh the live ball context', () => {
  it.each([false, true])('corrects a five-yard run to six with saved postState=%s and keeps the next run at three yards', hasPostState => {
    const game = fixture(); const before = structuredClone(game);
    if (hasPostState) game.events[0].postState = structuredClone(game.liveState);
    const saved = saveFootballPlayEditToEnvelope(game, editSix(game));
    expect(saved.events[0].preState).toEqual(game.events[0].preState);
    expect(saved.events[0].eventId).toBe('rush-1');
    expect(saved.events[0].postState).toMatchObject({ down: 2, distance: 4, yardLine: 'V27', lineToGain: 'V31' });
    expect(saved.liveState).toMatchObject({ down: 2, distance: 4, yardLine: 'V27', nextPlayContext: 'V,2,4,V27' });
    expect(saved.drives.current).toMatchObject({ plays: 1, yards: 6 });
    expect(saved.stats.teams.V.rushYards).toBe(6);
    const second = { ...structuredClone(saved.events[0]), eventId: 'rush-2', clientEventId: 'client-2', sequence: 2,
      preState: structuredClone(saved.liveState), postState: undefined, description: '#41 George Bush rush for 3 yards to the V30.', result: { code: 'tackle', yards: 3, endYardLine: 'V30' } };
    const result = applyFootballScorerEventToEnvelope(saved, second);
    expect(result.diagnostics).toEqual([]);
    const final = normalizeFootballScoringSetupEnvelope(result.envelope);
    expect(final.liveState).toMatchObject({ down: 3, distance: 1, yardLine: 'V30' });
    expect(final.stats.teams.V).toMatchObject({ rushAttempts: 2, rushYards: 9, yards: 9 });
    expect(final.drives.current).toMatchObject({ plays: 2, yards: 9 });
    const report = buildFootballPlayByPlayReport(final);
    expect(report.quarters[0].rows.find(row => row.id === 'play-2')).toMatchObject({ downAndDistance: '2nd & 4' });
    expect(game.events[0].result).toEqual(before.events[0].result);
  });

  it('rebuilds a completed pass ending context and its passing and receiving statistics', () => {
    const game = fixture(); const e = game.events[0];
    Object.assign(e, { type: 'pass', subtype: 'complete', result: { code: 'complete', yards: 5, endYardLine: 'V26', pass: { outcome: 'complete', passingYards: 5, receivingYards: 5 } } });
    e.participants.primary.role = 'passer';
    e.participants.receiver = { playerId: 'receiver', team: 'V', role: 'receiver' };
    const edited = editSix(game); edited.result.pass.passingYards = 6; edited.result.pass.receivingYards = 6;
    const saved = saveFootballPlayEditToEnvelope(game, edited);
    expect(saved.liveState).toMatchObject({ down: 2, distance: 4, yardLine: 'V27' });
    expect(saved.stats.players.runner.passYards).toBe(6);
    expect(saved.stats.players.receiver.receivingYards).toBe(6);
  });

  it('keeps older following plays unchanged and flagged until the operator recalculates them', () => {
    const game = fixture();
    game.events.push({ ...structuredClone(game.events[0]), eventId: 'rush-2', sequence: 2,
      preState: structuredClone(game.liveState), result: { code: 'tackle', yards: 4, endYardLine: 'V30' } });
    game.liveState = { ...game.liveState, down: 3, distance: 1, yardLine: 'V30' };
    const saved = saveFootballPlayEditToEnvelope(game, editSix(game));
    expect(saved.events[1]).toEqual(game.events[1]);
    expect(saved.liveState).toMatchObject({ down: 3, distance: 1, yardLine: 'V30' });
    expect(reviewFootballPlayContexts(saved).reviews.get('rush-2').fields).toEqual(expect.arrayContaining(['yardLine', 'distance']));
    const repaired = recalculateFootballPlayContext(saved, saved.events[1]);
    expect(repaired.events[1].result.yards).toBe(3);
    expect(repaired.stats.teams.V.rushYards).toBe(9);
  });

  it('honors later operator ball and possession corrections even with stale preState on controls', () => {
    const game = fixture();
    game.events.push(control(2, 'setBallContext', { possession: 'H', down: 3, distance: 6, spot: 'H40' }), control(3, 'timeout', { possession: 'V' }));
    const saved = saveFootballPlayEditToEnvelope(game, editSix(game));
    expect(saved.events[0].postState).toMatchObject({ down: 2, distance: 4, yardLine: 'V27' });
    expect(saved.liveState).toMatchObject({ possession: 'H', down: 3, distance: 6, yardLine: 'H40' });
    expect(saved.events.slice(1)).toEqual(game.events.slice(1));
  });

  it('carries the corrected ending through administrative records without changing clocks or timeout counts', () => {
    const game = fixture(); game.events.push(control(2, 'timeout', { possession: 'H' }), control(3, 'setClock', { clock: '09:15' }));
    const saved = saveFootballPlayEditToEnvelope(game, editSix(game));
    expect(saved.liveState).toMatchObject({ possession: 'V', down: 2, distance: 4, yardLine: 'V27' });
    expect(saved.clock).toEqual(game.clock);
    expect(saved.liveState.timeouts).toEqual(game.liveState.timeouts);
  });

  it('clears a stale calculated first down when an end-spot correction falls short', () => {
    const game = fixture(); Object.assign(game.events[0].result, { yards: 10, endYardLine: 'V31', firstDown: true });
    const saved = saveFootballPlayEditToEnvelope(game, editSix(game));
    expect(saved.events[0].result.firstDown).toBe(false);
    expect(saved.liveState).toMatchObject({ down: 2, distance: 4, yardLine: 'V27' });
  });

  it('preserves an explicit first-down correction and final-game metadata', () => {
    const game = fixture(); game.game.status = 'final'; game.game.wrapUp = { completedAt: '2026-09-19T00:00:00Z' }; game.pregame.gamePhase = 'final';
    const edit = structuredClone(game.events[0]); edit.result.firstDown = true;
    const saved = saveFootballPlayEditToEnvelope(game, edit);
    expect(saved.events[0].result.firstDown).toBe(true);
    expect(saved.liveState).toMatchObject({ down: 1, distance: 10, yardLine: 'V26' });
    expect(saved.game).toEqual(game.game); expect(saved.clock).toEqual(game.clock); expect(saved.pregame).toEqual(game.pregame);
  });

  it('refreshes the latest recorded context even when only a player changes', () => {
    const game = fixture(); game.liveState.distance = 99;
    const edit = structuredClone(game.events[0]); edit.participants.defenders = [{ team: 'H', playerId: 'tackler', role: 'tackler' }];
    const saved = saveFootballPlayEditToEnvelope(game, edit);
    expect(saved.liveState).toMatchObject({ down: 2, distance: 5, yardLine: 'V26' });
    expect(saved.stats.teams.V.rushYards).toBe(5);
  });
});
