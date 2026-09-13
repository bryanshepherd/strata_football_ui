import { describe, expect, it } from 'vitest';
import baseline from '../data/footballCompletedBaselineGameRecord.json';
import { applyFootballPlayEditToEnvelope, repairFootballEditedActorsInEnvelope } from './footballPlayEditEnvelope';
import { buildFootballPlayByPlayReport } from '../reports/footballPlayByPlay';
import { normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';

const player = (playerId, jersey, displayName, team = 'V') => ({ playerId, team, jersey, displayName, position: 'P' });
const oldPlayer = player('OLD', '48', 'Hezekiah Adams');
const newPlayer = player('NEW', '82', 'Wesley Oxce');
const other = player('OTHER', '48', 'Different Player');
const actor = (playerId, role, team = 'V') => ({ playerId, role, team });
const fixture = (type = 'punt', subtype = 'fairCatch') => {
  const envelope = structuredClone(baseline.envelope);
  Object.assign(envelope.rosters.teams.V.players, { OLD: oldPlayer, NEW: newPlayer, OTHER: other });
  const event = {
    eventId: 'ACTOR-EDIT', clientEventId: 'actor-edit', sequence: 1, status: 'accepted',
    type, subtype, period: 1, clock: '12:04', possession: 'V',
    preState: { possession: 'V', down: 4, distance: 8, yardLine: 'V30', lineToGain: 'V38', driveNumber: 1, driveId: 'ACTOR-DRIVE' },
    participants: { primary: actor('OLD', 'punter'), punter: actor('OLD', 'punter'), defenders: [] },
    result: { code: 'fairCatch', endYardLine: 'H35', kick: { kickYards: 35, catchYardLine: 'H35' } },
    penalties: [], description: 'Old description.', confirmation: { summaryText: 'Old description.' },
  };
  envelope.events = [event]; envelope.stats = { sourceEventSequence: 1, teams: {}, players: {} };
  return envelope;
};
const edit = (envelope, update) => {
  const next = structuredClone(envelope.events[0]); update(next);
  return applyFootballPlayEditToEnvelope(envelope, next);
};

describe('edited actor reference consistency', () => {
  it.each([['punt', 'fairCatch', 'punter'], ['kickoff', 'touchback', 'kicker'], ['fieldGoal', 'missed', 'kicker'], ['try', 'kick', 'kicker']])('saves %s actors to both named and primary fields', (type, subtype, slot) => {
    const envelope = fixture(type, subtype);
    envelope.events[0].participants = { primary: actor('OLD', slot), [slot]: actor('OLD', slot), defenders: [] };
    envelope.events[0].result.code = type === 'punt' ? 'fairCatch' : subtype === 'touchback' ? 'touchback' : 'missed';
    const before = JSON.stringify(envelope);
    const updated = edit(envelope, event => { event.participants[slot] = { ...newPlayer, role: slot }; });
    const saved = updated.events[0];
    expect(saved.participants.primary.playerId).toBe('NEW');
    expect(saved.participants[slot].playerId).toBe('NEW');
    expect(saved.description).toContain('#82 Wesley Oxce');
    expect(saved.description).not.toContain('Hezekiah Adams');
    expect(saved.confirmation.summaryText).toBe(saved.description);
    expect(saved.preState).toEqual(envelope.events[0].preState);
    expect(saved.result).toEqual(envelope.events[0].result);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('updates receiver aliases, play-by-play, and receiving stats without changing the passer', () => {
    const envelope = fixture('pass', 'complete');
    Object.assign(envelope.events[0], {
      participants: { primary: actor('OTHER', 'passer'), secondary: actor('OLD', 'intendedReceiver'), receiver: actor('OLD', 'receiver'), target: actor('OLD', 'intendedReceiver'), defenders: [] },
      result: { code: 'complete', yards: 7, endYardLine: 'V37', pass: { outcome: 'complete', targetPlayerId: 'OLD', passingYards: 7, receivingYards: 7 } },
    });
    const updated = edit(envelope, event => { event.participants.secondary = { ...newPlayer, role: 'receiver' }; event.result.pass.targetPlayerId = 'NEW'; });
    const saved = updated.events[0];
    for (const role of ['secondary', 'receiver', 'target']) expect(saved.participants[role].playerId).toBe('NEW');
    expect(saved.participants.primary.playerId).toBe('OTHER');
    expect(saved.description).toContain('pass complete to #82 Wesley Oxce');
    const normalized = normalizeFootballScoringSetupEnvelope(updated);
    expect(normalized.stats.players.NEW).toMatchObject({ receptions: 1, receivingYards: 7 });
    expect(normalized.stats.players.OLD?.receptions || 0).toBe(0);
    expect(JSON.stringify(buildFootballPlayByPlayReport(normalized))).toContain('Wesley Oxce');
  });

  it('updates a returner selected through its result field', () => {
    const envelope = fixture('punt', 'returned');
    envelope.events[0].participants.returner = actor('OLD', 'returner');
    envelope.events[0].result.return = { returnerPlayerId: 'OLD', returnYards: 5 };
    const updated = edit(envelope, event => { event.result.return.returnerPlayerId = 'NEW'; });
    expect(updated.events[0].participants.returner).toMatchObject({ playerId: 'NEW', displayName: 'Wesley Oxce' });
    expect(updated.events[0].participants.primary.playerId).toBe('OLD');
  });

  it('changes fumble actors by role, preserving a separate initial runner and lateral', () => {
    const envelope = fixture('rush', null);
    envelope.events[0].participants = { primary: actor('OTHER', 'rusher'), fumbler: actor('OLD', 'fumbler'), forcedBy: actor('OTHER', 'forcedFumble'), recoveredBy: actor('OTHER', 'fumbleRecovery'), defenders: [] };
    envelope.events[0].result = { code: 'fumble', yards: 5, endYardLine: 'V35', fumble: { fumblerPlayerId: 'OLD', forcedByPlayerId: 'OTHER', recoveredByPlayerId: 'OTHER', recoveredByTeam: 'V', spot: 'V35' }, laterals: [{ fromPlayerId: 'OTHER', toPlayerId: 'OLD', spot: 'V33' }] };
    const updated = edit(envelope, event => { event.result.fumble.fumblerPlayerId = 'NEW'; });
    expect(updated.events[0].participants.fumbler.playerId).toBe('NEW');
    expect(updated.events[0].participants.primary.playerId).toBe('OTHER');
    expect(updated.events[0].result.laterals).toEqual(envelope.events[0].result.laterals);
  });

  it('clears every reference to a removed optional receiver', () => {
    const envelope = fixture('pass', 'incomplete');
    envelope.events[0].participants = { primary: actor('OTHER', 'passer'), secondary: actor('OLD', 'intendedReceiver'), target: actor('OLD', 'intendedReceiver'), defenders: [] };
    envelope.events[0].result = { code: 'incomplete', pass: { targetPlayerId: 'OLD' } };
    const updated = edit(envelope, event => { event.participants.secondary = null; event.result.pass.targetPlayerId = null; });
    expect(updated.events[0].participants.target).toBeNull();
    expect(updated.events[0].description).not.toContain('Hezekiah');
  });

  it('keeps a fumble recovery and its return aligned when no lateral separates them', () => {
    const envelope = fixture('rush', null);
    envelope.events[0].participants = { primary: actor('OTHER', 'rusher'), recoveredBy: actor('OLD', 'fumbleRecovery'), returner: actor('OLD', 'returner'), defenders: [] };
    envelope.events[0].result = { code: 'fumble', yards: 3, endYardLine: 'V33', fumble: { fumblerPlayerId: 'OTHER', recoveredByPlayerId: 'OLD', recoveredByTeam: 'V', spot: 'V33', recoverySpot: 'V33' }, return: { returnerPlayerId: 'OLD', returnYards: 0 } };
    const updated = edit(envelope, event => { event.participants.returner = { ...newPlayer, role: 'returner' }; });
    expect(updated.events[0].participants.recoveredBy.playerId).toBe('NEW');
    expect(updated.events[0].result.fumble.recoveredByPlayerId).toBe('NEW');
    expect(updated.events[0].participants.primary.playerId).toBe('OTHER');
  });

  it('repairs old partial edits on load and in play-by-play without modifying the supplied game', () => {
    const envelope = fixture();
    envelope.events[0].participants.punter = { ...newPlayer, role: 'punter' };
    const before = JSON.stringify(envelope);
    const repaired = repairFootballEditedActorsInEnvelope(envelope);
    expect(repaired.events[0].participants.primary.playerId).toBe('NEW');
    expect(repaired.events[0].description).toContain('#82 Wesley Oxce punt 35 yards');
    expect(JSON.stringify(buildFootballPlayByPlayReport(envelope))).toContain('#82 Wesley Oxce punt 35 yards');
    expect(repairFootballEditedActorsInEnvelope(repaired)).toBe(repaired);
    expect(JSON.stringify(envelope)).toBe(before);
  });

  it('does not guess when two fully named actors disagree', () => {
    const envelope = fixture();
    envelope.events[0].participants = { primary: { ...oldPlayer, role: 'punter' }, punter: { ...newPlayer, role: 'punter' }, defenders: [] };
    expect(repairFootballEditedActorsInEnvelope(envelope)).toBe(envelope);
    const updated = edit(envelope, event => { event.participants.punter = { ...other, role: 'punter' }; });
    expect(updated.events[0].participants.primary.playerId).toBe('OTHER');
  });

  it('clears a removed blocker without reassigning another defender or inserting null actors', () => {
    const envelope = fixture();
    envelope.events[0].participants.defenders = [actor('OLD', 'blocker'), actor('OTHER', 'tackler')];
    envelope.events[0].result.kick.blockedByPlayerId = 'OLD';
    const updated = edit(envelope, event => { event.participants.defenders.shift(); });
    expect(updated.events[0].participants.defenders).toEqual([actor('OTHER', 'tackler')]);
    expect(updated.events[0].result.kick.blockedByPlayerId).toBeNull();
  });
});
