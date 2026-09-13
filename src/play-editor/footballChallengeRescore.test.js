import { describe, it, expect } from 'vitest';
import { rescoreOverturnedFootballPlay } from './footballChallengeRescore';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { prepareFootballChallengeEvent, pendingFootballChallengeRescore, footballChallengeTarget } from '../utils/footballChallengeRescore';
import { buildFootballPlayByPlayReport } from '../reports/footballPlayByPlay';

const state = { possession: 'H', down: 1, distance: 10, yardLine: 'H40', lineToGain: '50', goalToGo: false, driveId: 'DRV-0001', driveNumber: 1 };
const actor = (id, team, role) => ({ playerId: id, team, role, jersey: id.slice(2), displayName: id });
const base = () => ({
  schemaVersion: 'football.gameEnvelope.v1', gameId: 'FB-CHALLENGE', updatedAt: '2026-09-13T00:00:00Z',
  game: { status: 'inProgress', period: 1, teams: { H: { teamId: 'H', name: 'Home', abbr: 'HOM', score: 0 }, V: { teamId: 'V', name: 'Visitor', abbr: 'VIS', score: 0 } }, rules: { periods: 4, minutesPerPeriod: 15, downs: 4, yardsToFirstDown: 10, challenge: { allowChallenges: true, numberOfChallenges: 2 } } },
  pregame: { gamePhase: 'live' }, clock: { period: 1, clock: '10:00', isRunning: false },
  liveState: { ...state, timeouts: { H: 3, V: 3 }, challenges: { H: 2, V: 2 } },
  drives: { current: { driveId: 'DRV-0001', driveNumber: 1, team: 'H', startYardLine: 'H40', startPeriod: 1, startClock: '10:00', plays: 0, yards: 0 }, completed: [] },
  events: [], stats: { teams: {}, players: {}, sourceEventSequence: 0 },
  rosters: { teams: { H: { players: { 'H-12': actor('H-12', 'H', 'passer'), 'H-88': actor('H-88', 'H', 'receiver') } }, V: { players: {} } } },
});
const pass = (touchdown = false) => ({ type: 'pass', subtype: 'complete', period: 1, clock: '10:00', possession: 'H', preState: { ...state }, participants: { primary: actor('H-12', 'H', 'passer'), secondary: actor('H-88', 'H', 'receiver'), defenders: [] }, penalties: [], description: touchdown ? 'HOM completed pass for a touchdown.' : 'HOM complete for 10 yards.', result: { code: touchdown ? 'touchdown' : 'complete', yards: touchdown ? 60 : 10, endYardLine: touchdown ? 'V00' : '50', pass: { completed: true, targetPlayerId: 'H-88' }, ...(touchdown ? { scoring: { team: 'H', type: 'touchdown', points: 6 } } : {}) } });
const incomplete = () => ({ ...pass(), clientEventId: 'new-pass', subtype: 'incomplete', description: 'HOM pass incomplete.', result: { code: 'incomplete', yards: 0, endYardLine: 'H40', pass: { completed: false, targetPlayerId: 'H-88' } } });
const add = (env, event) => {
  const next = { ...event, clientEventId: event.clientEventId || `event-${env.events.length + 1}`, preState: structuredClone(env.liveState) };
  const out = applyFootballScorerEventToEnvelope(env, prepareFootballChallengeEvent(env, next));
  expect(out.diagnostics).toEqual([]);
  return out.envelope;
};
const review = (env, status = 'initiated', teamSide = 'V') => add(env, { type: 'gameControl', subtype: 'challenge', period: env.game.period, clock: '10:00', possession: null, participants: {}, penalties: [], description: 'Challenge.', result: { code: 'noPlay', gameControl: { action: 'challenge', teamSide, challengeStatus: status } } });
const challenged = (touchdown = false) => review(review(add(base(), pass(touchdown))), 'callOverturned');

describe('overturned challenge rescoring', () => {
  it('links initiation and outcome to the original play and only requests successful challenge corrections', () => {
    const env = challenged();
    expect(pendingFootballChallengeRescore(env)).toBe(env.events[2]);
    expect(footballChallengeTarget(env, env.events[2])).toBe(env.events[0]);
    expect(env.events[1].result.gameControl.challengedEventId).toBe(env.events[0].eventId);
    for (const status of ['callConfirmed', 'callStands', 'unsuccessful']) expect(pendingFootballChallengeRescore(review(review(add(base(), pass())), status))).toBeNull();
    expect(pendingFootballChallengeRescore(review(review(add(base(), pass())), 'successful'))).not.toBeNull();
  });
  it('reverses a touchdown, saves an immutable original, and restores the next down without recharging the challenge', () => {
    const env = challenged(true); const before = JSON.stringify(env);
    const corrected = rescoreOverturnedFootballPlay(env, env.events[2], env.events[0], incomplete());
    expect(corrected.ok, JSON.stringify(corrected.errors)).toBe(true);
    expect(corrected.needsRescore).toBeUndefined();
    const next = corrected.envelope;
    expect(next.game.teams.H.score).toBe(0);
    expect(next.liveState).toMatchObject({ possession: 'H', down: 2, distance: 10, yardLine: 'H40' });
    expect(next.liveState.timeouts).toEqual(env.liveState.timeouts);
    expect(next.liveState.challenges).toEqual(env.liveState.challenges);
    expect(next.events).toHaveLength(3);
    expect(next.events[0].subtype).toBe('incomplete');
    expect(next.events[1].preState).toMatchObject({ possession: 'H', down: 2, yardLine: 'H40' });
    expect(next.playHistory[0].originalEvent).toEqual(env.events[0]);
    expect(next.playHistory[0].status).toBe('overturned');
    expect(next.playHistory[0].replacementEventId).toBe(next.events[0].eventId);
    expect(pendingFootballChallengeRescore(next)).toBeNull();
    expect(JSON.stringify(env)).toBe(before);
    expect(next.stats.players['H-12']).toMatchObject({ passAttempts: 1, passCompletions: 0, passYards: 0 });
    expect(next.stats.players['H-88']).toMatchObject({ receptions: 0, receivingYards: 0 });
    const again = normalizeFootballScoringSetupEnvelope(JSON.parse(JSON.stringify(next)));
    expect(again.game.teams.H.score).toBe(0);
    expect(again.playHistory).toEqual(next.playHistory);
    expect(JSON.stringify(buildFootballPlayByPlayReport(again))).not.toContain('completed pass for a touchdown');
    expect(rescoreOverturnedFootballPlay(next, next.events[2], next.events[0], incomplete()).ok).toBe(false);
  });
  it('recalculates the following scrimmage play and stops at explicit operator context corrections', () => {
    let env = challenged();
    env = add(env, { ...pass(), type: 'rush', subtype: null, participants: { primary: actor('H-12', 'H', 'rusher') }, result: { code: 'tackle', yards: 2, endYardLine: 'V48' }, description: 'rush 2 yards' });
    env = add(env, { type: 'gameControl', subtype: 'setBallContext', period: 1, clock: '09:30', result: { code: 'noPlay', gameControl: { action: 'setBallContext', possession: 'V', down: 1, distance: 10, spot: 'V25' } }, participants: {}, penalties: [] });
    const result = rescoreOverturnedFootballPlay(env, env.events[2], env.events[0], incomplete());
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    expect(result.needsRescore).toBeUndefined();
    expect(result.envelope.events[3].preState).toMatchObject({ down: 2, distance: 10, yardLine: 'H40' });
    expect(result.envelope.events[3].result.yards).toBe(12);
    expect(result.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'V25' });
  });
  it('stages complex dependent plays for operator input without changing the source game', () => {
    let env = challenged();
    env = add(env, { type: 'punt', subtype: 'downed', period: 1, clock: '09:30', possession: 'H', participants: { primary: actor('H-12', 'H', 'punter'), punter: actor('H-12', 'H', 'punter') }, result: { code: 'downed', endYardLine: 'V20', kick: { kickYards: 30, catchYardLine: 'V20' } }, penalties: [], description: 'punt 30 yards' });
    const before = JSON.stringify(env);
    const result = rescoreOverturnedFootballPlay(env, env.events[2], env.events[0], incomplete());
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    expect(result.needsRescore.target.eventId).toBe(env.events[3].eventId);
    expect(result.needsRescore.target.preState.yardLine).toBe('H40');
    expect(JSON.stringify(env)).toBe(before);
    const correctedPunt = { ...env.events[3], clientEventId: 'corrected-punt', result: { ...env.events[3].result, kick: { kickYards: 40, catchYardLine: 'V20' } } };
    const done = rescoreOverturnedFootballPlay(result.envelope, env.events[2], result.needsRescore.target, correctedPunt);
    expect(done.ok, JSON.stringify(done.errors)).toBe(true);
    expect(done.needsRescore).toBeUndefined();
    expect(done.envelope.playHistory).toHaveLength(2);
    expect(pendingFootballChallengeRescore(done.envelope)).toBeNull();
  });
  it('restores an active overtime series when a winning touchdown is overturned', () => {
    const seed = base();
    seed.game.period = 5;
    seed.game.rules = { ...seed.game.rules, overtimeEnabled: true, overtimeStyle: 'alternatingPossessions', rulesPresetId: 'ncaa' };
    seed.clock.period = 5;
    seed.liveState.overtime = { round: 1, series: 2, phase: 'active', possessionTeam: 'H', firstTeam: 'V' };
    let env = add(seed, { ...pass(true), period: 5 });
    expect(env.game.status).toBe('final');
    env = review(review(env), 'callOverturned');
    const result = rescoreOverturnedFootballPlay(env, env.events[2], env.events[0], { ...incomplete(), period: 5 });
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    expect(result.envelope.game).toMatchObject({ status: 'inProgress', period: 5 });
    expect(result.envelope.liveState).toMatchObject({ possession: 'H', down: 2, overtime: { phase: 'active', series: 2 } });
  });
});
