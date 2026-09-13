import { describe, it, expect } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { footballOvertimePending } from './footballOvertime';
import { createInitialFootballQuickInputState, transitionFootballQuickInput } from '../quick-input/footballConfirmedQuickInputMachine';
const now = '2026-09-13T00:30:00Z';
function base() {
  const e = structuredClone(getGameEnvelopeFixture('normal'));
  e.events = []; e.stats = { teams: {}, players: {} }; e.drives = { current: null, completed: [] };
  e.game = { ...e.game, status: 'inProgress', period: 4, rules: { ...e.game.rules, periods: 4, rulesPresetId: 'ncaa', overtimeEnabled: true, overtimeStyle: 'possessionSeries' }, teams: { H: { ...e.game.teams.H, score: 14 }, V: { ...e.game.teams.V, score: 14 } } };
  e.clock = { ...e.clock, period: 4, clock: '00:00', clockTenths: 0 }; e.pregame = { ...e.pregame, gamePhase: 'live' };
  e.liveState = { ...e.liveState, timeouts: { H: 0, V: 2 }, pendingTryTeam: null };
  return e;
}
function play(e, fields) {
  const n = e.events.length + 1;
  const result = applyFootballScorerEventToEnvelope(e, { eventId: `OT-${n}`, clientEventId: `OT-${n}`, sequence: n, status: 'accepted', createdAt: now, acceptedAt: now, period: e.game.period, clock: '00:00', possession: e.liveState.possession, preState: { ...e.liveState }, participants: { primary: null, defenders: [] }, penalties: [], ...fields });
  expect(result.diagnostics).toEqual([]); return result.envelope;
}
const control = (e, action, fields = {}) => play(e, { type: 'gameControl', subtype: action, result: { code: 'noPlay', gameControl: { action, ...fields } } });
const begin = () => control(base(), 'endQuarter', { period: 4 });
const start = (e, team = 'H', spot = `${team === 'H' ? 'V' : 'H'}${e.liveState.overtime.round >= 3 ? '03' : '25'}`) => control(e, 'startDrive', { overtime: true, possession: team, spot });
const fg = (e, made = true) => play(e, { type: 'fieldGoal', subtype: made ? 'made' : 'missed', result: { code: made ? 'made' : 'missed', endYardLine: e.liveState.yardLine, ...(made ? { scoring: { team: e.liveState.possession, type: 'fieldGoal', points: 3 } } : {}) } });
const td = e => play(e, { type: 'rush', result: { code: 'touchdown', yards: 25, endYardLine: 'goal', scoring: { team: e.liveState.possession, type: 'touchdown', points: 6 } } });
const attempt = (e, good = true, kick = false) => play(e, { type: 'try', subtype: kick ? 'kick' : 'rush', participants: { primary: { team: e.liveState.pendingTryTeam, playerId: 'try-player' }, defenders: [] }, result: { code: good ? 'made' : 'missed', ...(good ? { scoring: { team: e.liveState.pendingTryTeam, type: kick ? 'patKick' : 'patRush', points: kick ? 1 : 2 } } : {}) } });
function roundTwo() { let e = fg(start(begin())); e = fg(start(e, 'V')); return e; }
function roundThree() { let e = fg(start(roundTwo())); e = fg(start(e, 'V')); return e; }
describe('NCAA overtime operator lifecycle', () => {
  it('keeps tied regulation live and starts a fresh untimed series with one timeout', () => {
    const e = begin(); expect(e.game).toMatchObject({ status: 'inProgress', period: 5, periodType: 'overtime' });
    expect(footballOvertimePending(e)).toMatchObject({ round: 1, series: 1 });
    const s = start(e); expect(s.liveState).toMatchObject({ possession: 'H', down: 1, distance: 10, yardLine: 'V25', timeouts: { H: 1, V: 1 }, overtime: { phase: 'active' } });
    expect(s.clock.clock).toBe('00:00'); expect(s.drives.current.startReason).toBe('overtime');
  });
  it('keeps a regulation winner final and recovers an old tied-final envelope', () => {
    const e = base(); e.game.teams.H.score = 17; expect(control(e, 'endQuarter', { period: 4 }).game.status).toBe('final');
    const old = base(); old.game.status = 'final'; expect(footballOvertimePending(old)).toMatchObject({ round: 1 }); expect(start(old, 'V', 'H25').game.status).toBe('inProgress');
  });
  it('allows the start-quarter operator path to reach OT1', () => {
    const e = base(); const ctx = { gamePhase: 'live', game: { gameId: e.gameId, teams: e.game.teams, rules: e.game.rules }, play: { period: 4, clock: '00:00', possession: 'H', actionTeam: 'H' }, prePlay: e.liveState, roster: [], source: { kind: 'fcqi', startedAt: now } };
    let s = transitionFootballQuickInput(createInitialFootballQuickInputState(), { type: 'START_GAME_CONTROL', startedBy: 'hotkey', hotkey: 'G' }, ctx).state;
    for (const value of ['Q','S']) { s = transitionFootballQuickInput(s, { type: 'INPUT_TOKEN', value }, ctx).state; s = transitionFootballQuickInput(s, { type: 'COMMIT_TOKEN' }, ctx).state; }
    expect(s.draft.result.gameControl.period).toBe(5);
  });
  it.each([true, false])('advances made/missed field goal to opponent confirmation, not kickoff (%s)', made => {
    const e = fg(start(begin()), made); expect(e.liveState).toMatchObject({ kickoffTeam: null, overtime: { series: 2, nextTeam: 'V', phase: 'awaitingSeries' } });
    expect(start(e, 'V').liveState.yardLine).toBe('H25');
    expect(normalizeFootballScoringSetupEnvelope(JSON.parse(JSON.stringify(e))).liveState.nextPlayContext).toBe('overtimeReady');
  });
  it('completes a touchdown and try then grants the other possession', () => {
    const t = td(start(begin())); expect(t.liveState.pendingTryTeam).toBe('H');
    const e = attempt(t, true, true); expect(e.game.teams.H.score).toBe(21); expect(e.liveState.overtime.phase).toBe('awaitingSeries'); expect(e.liveState.kickoffTeam).toBeNull();
  });
  it('requires both teams to possess before declaring a field-goal winner', () => {
    let e = fg(start(begin())); expect(e.game.status).toBe('inProgress'); e = fg(start(e, 'V'), false); expect(e.game.status).toBe('final');
  });
  it('ends on a winning second-series touchdown without an unnecessary try', () => {
    const e = td(start(fg(start(begin())), 'V')); expect(e.game.status).toBe('final'); expect(e.liveState.pendingTryTeam).toBeNull();
  });
  it('ends on a defensive touchdown or safety with no try or free kick', () => {
    for (const score of [{ type: 'touchdown', points: 6 }, { type: 'safety', points: 2 }]) {
      const e = play(start(begin()), { type: 'pass', subtype: 'interception', result: { code: 'interception', endYardLine: 'H00', turnover: { type: 'interception', recoveredBy: 'V' }, scoring: { team: 'V', ...score } } });
      expect(e.game.status).toBe('final'); expect(e.liveState.kickoffTeam).toBeNull(); expect(e.liveState.pendingTryTeam).toBeNull();
    }
  });
  it.each(['downs', 'interception', 'fumble'])('ends the series after %s and starts opponent at its attacking 25', kind => {
    let e = start(begin()); if (kind === 'downs') e.liveState.down = 4;
    e = play(e, { type: kind === 'fumble' ? 'rush' : 'pass', subtype: kind, result: { code: kind === 'downs' ? 'incomplete' : kind, yards: 0, endYardLine: 'V20', ...(kind === 'downs' ? {} : { turnover: { type: kind, recoveredBy: 'V' }, nextPossession: 'V' }) } });
    expect(e.liveState.overtime.phase).toBe('awaitingSeries'); expect(start(e, 'V').liveState.yardLine).toBe('H25');
  });
  it('requires two points in OT2 and starts alternating tries in OT3', () => {
    const second = roundTwo(); expect(second.game.period).toBe(6); expect(() => attempt(td(start(second)), true, true)).toThrow(/two-point/);
    const third = start(roundThree()); expect(third.liveState).toMatchObject({ yardLine: 'V03', pendingTryTeam: 'H', nextPlayContext: 'awaitingTry', timeouts: { H: 1, V: 1 } });
    const afterFirst = attempt(third); expect(afterFirst.game.status).toBe('inProgress');
    const afterSecond = attempt(start(afterFirst, 'V'), false); expect(afterSecond.game.status).toBe('final'); expect(afterSecond.game.teams.H.score - afterSecond.game.teams.V.score).toBe(2);
  });
  it('shares the one remaining timeout across OT3 and subsequent rounds', () => {
    let e = start(roundThree()); e = control(e, 'timeout', { teamSide: 'H' }); e = attempt(e, false); e = attempt(start(e, 'V'), false);
    expect(e.liveState.overtime.round).toBe(4); expect(start(e).liveState.timeouts).toEqual({ H: 0, V: 1 });
  });
  it('keeps a replayed try active and permits a penalty-adjusted start spot', () => {
    let e = start(roundThree(), 'H', 'V08'); expect(e.liveState.yardLine).toBe('V08');
    e = play(e, { type: 'try', subtype: 'rush', result: { code: 'missed', endYardLine: 'V08' }, penalties: [{ status: 'accepted', replayDown: true, team: 'V', yards: 4, enforcedFrom: 'previous', finalSpot: 'V04' }] });
    expect(e.liveState.overtime.phase).toBe('active'); expect(e.liveState.nextPlayContext).toBe('awaitingTry'); expect(e.liveState.kickoffTeam).toBeNull();
  });
  it('blocks kickoff and premature period changes in overtime', () => {
    const e = start(begin()); expect(() => play(e, { type: 'kickoff', result: {} })).toThrow(/no kickoffs/); expect(() => control(e, 'endQuarter', { period: 5 })).toThrow(/possession/);
  });
});
