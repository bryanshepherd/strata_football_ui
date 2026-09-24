import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { buildFootballPlayInsertionEnvelope, previewFootballPlayInsertion } from './footballPlayInsertion';

const context = (patch = {}) => ({ possession: 'H', down: 1, distance: 10, yardLine: 'H20', lineToGain: 'H30', goalToGo: false, redZone: false, driveId: 'DRV-1', driveNumber: 1, ...patch });
const event = (n, patch = {}) => ({ eventId: `LOCAL-${String(n).padStart(6,'0')}`, clientEventId: `client-${n}`, sequence: n, status: 'accepted', type: 'pass', subtype: 'incomplete', period: 1, clock: '10:00', possession: 'H', preState: context(), participants: { primary: { playerId: 'qb', team: 'H', role: 'passer' } }, result: { code: 'incomplete', pass: { outcome: 'incomplete' } }, penalties: [], description: 'Pass incomplete.', source: { baseEventSequence: n - 1 }, ...patch });
const fixture = () => {
  const e = structuredClone(getGameEnvelopeFixture('normal'));
  e.game.status = 'final'; e.game.period = 4; e.pregame = { ...e.pregame, gamePhase: 'final' };
  e.game.teams.H.score = 0; e.game.teams.V.score = 0;
  e.events = [event(1, {clock:'11:00'}),event(2, { preState: context({down:2}) })];
  e.liveState = context({down:3});
  e.drives = { current: null, completed: [{ driveId:'DRV-1',driveNumber:1,team:'H',startYardLine:'H20',startPeriod:1,startClock:'11:00',endPeriod:1,endClock:'09:00',result:'endOfHalf' }] };
  return normalizeFootballScoringSetupEnvelope(e);
};
const incomplete = () => event(99);
const preview = (e, p = incomplete(), opts = {}) => previewFootballPlayInsertion(e,e.events[1],p,{insertionId:'test-unique',...opts});

describe('historical play insertion', () => {
  it('inserts a pass without rewriting later identities, starts, results, final status or live context', () => {
    const e=fixture(), before=structuredClone(e), result=preview(e);
    expect(result.envelope.events.map(p=>p.sequence)).toEqual([1,2,3]);
    expect(result.event).toMatchObject({eventId:'INSERT-test-unique',clientEventId:'insert-test-unique',period:1,clock:'10:00',preState:e.events[1].preState});
    expect(result.envelope.events[2]).toEqual({...e.events[1],sequence:3,source:{baseEventSequence:2}});
    expect(result.envelope.game).toEqual(e.game);
    expect(result.envelope.liveState).toEqual(e.liveState);
    expect(result.envelope.clock).toEqual(e.clock);
    expect(result.envelope.pregame).toEqual(e.pregame);
    expect(result.envelope.stats.teams.H.pass.att).toBe(3);
    expect(result.affected).toEqual([expect.objectContaining({sequence:3,originalSequence:2,fields:expect.arrayContaining(['down'])})]);
    expect(e).toEqual(before);
    expect(normalizeFootballScoringSetupEnvelope(result.envelope).stats).toEqual(result.envelope.stats);
  });
  it('adds the missing retained fumble and previews the changed spot without moving the existing pass', () => {
    const e=fixture();
    const fumble=event(99,{type:'rush',subtype:null,participants:{primary:{playerId:'qb',team:'H',role:'rusher'}},result:{code:'fumble',yards:-5,endYardLine:'H15',fumble:{fumblerPlayerId:'qb',spot:'H20',recoveredByPlayerId:'qb',recoveredByTeam:'H',recoverySpot:'H15',turnover:false}},description:'Carter rush and fumble, recovered at H15.'});
    const result=preview(e,fumble);
    expect(result.envelope.stats.teams.H).toMatchObject({rushAttempts:1,rushYards:-5,fumbles:{num:1,lost:0}});
    expect(result.affected[0]).toMatchObject({recorded:{yardLine:'H20',down:2},expected:{yardLine:'H15',down:3}});
    expect(result.envelope.events[2].preState).toEqual(e.events[1].preState);
  });
  it('restores historical input scores and stats, and uses a paused clock in a finalized game', () => {
    const e=fixture();e.game.teams.H.score=6;
    e.events[1]=event(2,{type:'rush',subtype:null,result:{code:'touchdown',yards:80,scoring:{team:'H',points:6,type:'touchdown'}}});
    const input=buildFootballPlayInsertionEnvelope(e,e.events[1],'10:30');
    expect(input.game).toMatchObject({status:'inProgress',period:1,teams:{H:{score:0}}});
    expect(input.stats.teams.H.pass.att).toBe(1);
    expect(input.clock).toMatchObject({clock:'10:30',clockTenths:6300,isRunning:false});
    expect(input.events).toHaveLength(1);
    expect(e.game.status).toBe('final');
  });
  it('keeps scoring changes explicit in the preview and retains existing scoring plays', () => {
    const e=fixture();
    const result=preview(e,event(99,{type:'rush',subtype:null,result:{code:'touchdown',yards:80,scoring:{team:'H',points:6,type:'touchdown'}}}));
    expect(result.scoreBefore.H).toBe(0);expect(result.scoreAfter.H).toBe(6);
    expect(result.envelope.game.status).toBe('final');
    expect(result.envelope.events[2].result).toEqual(e.events[1].result);
    expect(result.affected).toHaveLength(1);
  });
  it('inserts before the first play and chooses IDs that cannot collide with later local IDs', () => {
    const e=fixture();
    const result=previewFootballPlayInsertion(e,e.events[0],incomplete(),{insertionId:'first'});
    expect(result.event.sequence).toBe(1);expect(result.envelope.events[1].eventId).toBe(e.events[0].eventId);
    expect(new Set(result.envelope.events.map(p=>p.eventId)).size).toBe(3);
  });
  it.each(['09:59','11:01','99:99','garbage'])('rejects an invalid or out-of-order clock %s', clock => {
    const e=fixture();expect(()=>preview(e,incomplete(),{clock})).toThrow('clock time between');
  });
  it('rejects a clock beyond the period length even before the first play', () => {
    const e = fixture();
    expect(() => buildFootballPlayInsertionEnvelope(e, e.events[0], '16:00')).toThrow('outside the selected period');
    e.events[0].period = 5;
    e.game.rules.overtimeStyle = 'possessionSeries';
    expect(() => buildFootballPlayInsertionEnvelope(e, e.events[0], '11:00')).toThrow('outside the selected period');
  });
  it('rejects stale targets, incomplete logs, control entries and duplicate insertion IDs', () => {
    const e=fixture(), target=structuredClone(e.events[1]);
    e.events[1].description='Changed';
    expect(()=>previewFootballPlayInsertion(e,target,incomplete())).toThrow('selected play changed');
    e.events[1].eventId='new-id';expect(()=>buildFootballPlayInsertionEnvelope(e,target)).toThrow('no longer');
    e.events[1].sequence=8;expect(()=>preview(e)).toThrow('complete sequential');
    const clean=fixture();expect(()=>preview(clean,{type:'gameControl'})).toThrow('not Game Control');
    clean.events[0].eventId='INSERT-test-unique';expect(()=>preview(clean)).toThrow('already');
  });
});
