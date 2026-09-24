import { describe, expect, it } from 'vitest';
import { deleteFootballPlayFromEnvelope } from '../play-editor/footballPlayDeletion';
import { applyFootballScorerEventToEnvelope, projectFootballStatsForEvents } from '../services/footballDashboardService';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { firstDownBreakdown } from '../reports/footballTeamStats';
import type { FootballDraftIntent } from '../quick-input/footballIntentSchema';
import { activeFootballPenaltyOfficialState, resolveFootballDraftPenaltyOutcome } from './footballPenaltyOutcome';

describe('football penalty outcome authority', () => {
  const twoFouls = () => makeDraft({
    family: 'rush',
    prePlay: { down: 1, distance: 17, yardLine: 'H08', lineToGain: 'H25' },
    result: { code: 'tackle', yards: 3, endYardLine: 'H11' },
    penalties: [
      { penaltyId: 'face-mask', team: 'V', name: 'Face Mask', status: 'accepted', liveBall: true, deadBall: false,
        enforcedFrom: 'END', tableYards: 15, finalSpot: 'H26', automaticFirstDown: true, downConsequence: 'AUTO_FIRST' },
      { penaltyId: 'unsportsmanlike', team: 'V', name: 'Unsportsmanlike Conduct', status: 'accepted', liveBall: false, deadBall: true,
        enforcedFrom: 'END', tableYards: 15, finalSpot: 'H41', automaticFirstDown: true, downConsequence: 'AUTO_FIRST' },
    ],
  });

  it('credits both sequential first downs while preserving 1st and 10 at H41', () => {
    const draft = twoFouls();
    const resolved = resolveFootballDraftPenaltyOutcome(draft);
    expect(draft.result.officialOutcome).toBeUndefined();
    expect(resolved.result.officialOutcome?.calculated).toMatchObject({
      down: 1, distance: 10, yardLine: 'H41', lineToGain: 'V49', firstDownAwarded: true,
      firstDownAwards: [
        { id: 'penalty:face-mask', team: 'H', source: 'penalty', penaltyId: 'face-mask' },
        { id: 'penalty:unsportsmanlike', team: 'H', source: 'penalty', penaltyId: 'unsportsmanlike' },
      ],
    });
    const verified = resolveFootballDraftPenaltyOutcome(resolved, { verified: { down: 1, distance: 10, yardLine: 'H41', firstDownAwarded: true } });
    expect(activeFootballPenaltyOfficialState(verified.result)?.firstDownAwards).toHaveLength(2);
    expect(resolveFootballDraftPenaltyOutcome(verified).result.officialOutcome?.calculated.firstDownAwards).toHaveLength(2);
    expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(resolved, {
      verified: { down: 2, distance: 4, yardLine: 'H21', firstDownAwarded: false },
    }).result)?.firstDownAwards).toEqual([]);
  });

  it('does not independently credit multiple live-ball penalties or declined/offsetting fouls', () => {
    for (const status of ['declined', 'offsetting']) {
      const draft = twoFouls();
      draft.penalties[1].status = status as any;
      expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards).toHaveLength(1);
    }
    const draft = twoFouls();
    draft.penalties[1].deadBall = false;
    draft.penalties[1].liveBall = true;
    expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards).toHaveLength(1);
  });

  it('measures later enforcement against the newly awarded series', () => {
    const draft = twoFouls();
    Object.assign(draft.penalties[1], { automaticFirstDown: false, tableYards: 5, downConsequence: 'DOWN_COUNTS' });
    expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards).toHaveLength(1);
    draft.penalties[1].automaticFirstDown = true;
    expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards).toHaveLength(2);
    draft.penalties[1].team = 'H';
    draft.penalties[1].automaticFirstDown = false;
    expect(activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards).toHaveLength(1);
  });

  it('credits an earned rushing first down and a subsequent deadball automatic first down separately', () => {
    const draft = twoFouls();
    draft.penalties.shift();
    Object.assign(draft.result, { yards: 20, endYardLine: 'H28', firstDown: true });
    draft.penalties[0].finalSpot = 'H43';
    const awards = activeFootballPenaltyOfficialState(resolveFootballDraftPenaltyOutcome(draft).result)?.firstDownAwards;
    expect(awards?.map((award) => award.source)).toEqual(['play', 'penalty']);
  });

  it('rebuilds stats without duplicate credit after replay, deletion, or replacement and preserves legacy totals', () => {
    const draft = resolveFootballDraftPenaltyOutcome(twoFouls());
    const envelope = structuredClone(getGameEnvelopeFixture('normal'));
    const event = { eventId: 'two-fouls', sequence: 1, status: 'accepted', type: 'rush', subtype: 'tackle',
      possession: 'H', period: 3, clock: '05:22', preState: draft.prePlay, result: draft.result,
      penalties: draft.penalties.map((p) => ({ ...p, enforcedFrom: 'endOfPlay', timing: p.deadBall ? 'deadBall' : 'liveBall' })),
      participants: { primary: { playerId: 'H-30', team: 'H' }, defenders: [] },
    };
    envelope.events = [event];
    const stats = () => projectFootballStatsForEvents(envelope).teams.H?.firstDowns ?? 0;
    expect(stats()).toBe(2);
    expect(stats()).toBe(2);
    expect(firstDownBreakdown(envelope, envelope.events, 'H', stats())).toEqual({ rushing: 0, passing: 0, penalty: 2 });
    const deleted = deleteFootballPlayFromEnvelope(envelope, event);
    expect(deleted.events).toEqual([]);
    expect(deleted.stats.teams.H?.firstDowns ?? 0).toBe(0);
    expect(deleted.liveState).toMatchObject({ down: 1, distance: 17, yardLine: 'H08' });
    const rescored = applyFootballScorerEventToEnvelope(deleted, { ...event, eventId: undefined, clientEventId: 'replacement' }).envelope;
    expect(rescored.stats.teams.H.firstDowns).toBe(2);
    expect(rescored.liveState).toMatchObject({ down: 1, distance: 10, yardLine: 'H41' });
    expect(rescored.events).toHaveLength(1);
    event.result.officialOutcome!.calculated.firstDownAwards!.push(event.result.officialOutcome!.calculated.firstDownAwards![0]);
    expect(stats()).toBe(2);
    delete event.result.officialOutcome!.calculated.firstDownAwards;
    expect(stats()).toBe(1);
  });

  it('replays the down for an accepted dead-ball Delay of Game foul', () => {
    const resolved = resolveFootballDraftPenaltyOutcome(makeDraft({
      family: 'penalty',
      prePlay: { down: 3, distance: 4, yardLine: 'H42', lineToGain: 'H46' },
      result: { code: 'accepted', endYardLine: 'H37' },
      penalties: [{
        penaltyId: 'dog-1',
        team: 'H',
        name: 'Delay of Game',
        code: 'DOG',
        status: 'accepted',
        resolution: 'accepted',
        accepted: true,
        liveBall: false,
        deadBall: true,
        enforcedFrom: 'PREVIOUS',
        tableYards: 5,
        yards: -5,
        finalSpot: 'H37',
        source: 'immediate',
      }],
    }));

    expect(activeFootballPenaltyOfficialState(resolved.result)).toMatchObject({
      possession: 'H',
      down: 3,
      distance: 9,
      yardLine: 'H37',
      lineToGain: 'H46',
      firstDownAwarded: false,
    });
  });

  it('keeps a roughing-the-kicker punt with the kicking team and awards the enforced first down', () => {
    const resolved = resolveFootballDraftPenaltyOutcome(makeDraft({
      family: 'punt',
      prePlay: { down: 4, distance: 6, yardLine: 'H42', lineToGain: 'H48' },
      result: { code: 'fairCatch', endYardLine: 'V25', nextPossession: 'V', driveEnds: true },
      penalties: [{
        penaltyId: 'rtk-1',
        team: 'V',
        name: 'Roughing the Kicker',
        code: 'RTK',
        status: 'accepted',
        resolution: 'accepted',
        accepted: true,
        liveBall: true,
        enforcedFrom: 'PREVIOUS',
        tableYards: 15,
        yards: 15,
        finalSpot: 'V43',
        automaticFirstDown: true,
        replayDown: true,
        downConsequence: 'AUTO_FIRST',
        source: 'queued',
      }],
    }));

    expect(activeFootballPenaltyOfficialState(resolved.result)).toMatchObject({
      possession: 'H',
      down: 1,
      distance: 10,
      yardLine: 'V43',
      lineToGain: 'V33',
      firstDownAwarded: true,
      firstDownAwardedTo: 'H',
      firstDownSource: 'penalty',
    });
    expect(resolved.result).toMatchObject({ code: 'fairCatch', nextPossession: 'V' });
  });

  it('enforces multiple fouls sequentially in operator-selected order', () => {
    const draft = makeDraft({
      family: 'rush',
      prePlay: { down: 2, distance: 10, yardLine: 'H40', lineToGain: '50' },
      result: { code: 'tackle', yards: 8, endYardLine: 'H48' },
      penalties: [
        {
          penaltyId: 'hold-1', team: 'H', name: 'Holding', code: 'HOLD', status: 'accepted', resolution: 'accepted', accepted: true,
          liveBall: true, deadBall: false, enforcedFrom: 'PREVIOUS', tableYards: 10, yards: -10, finalSpot: 'H30', replayDown: true,
          downConsequence: 'REPEAT', source: 'queued',
        },
        {
          penaltyId: 'pf-2', team: 'V', name: 'Personal Foul', code: 'PF', status: 'accepted', resolution: 'accepted', accepted: true,
          liveBall: false, deadBall: true, enforcedFrom: 'END', tableYards: 15, yards: 15, finalSpot: 'V37', downCounts: true,
          downConsequence: 'DOWN_COUNTS', source: 'queued',
        },
      ],
    });

    const enteredOrder = resolveFootballDraftPenaltyOutcome(draft);
    expect(enteredOrder.penalties.map((penalty) => penalty.penaltyId)).toEqual(['hold-1', 'pf-2']);
    expect(enteredOrder.penalties[1].finalSpot).toBe('H45');
    expect(activeFootballPenaltyOfficialState(enteredOrder.result)).toMatchObject({
      possession: 'H', down: 2, distance: 5, yardLine: 'H45', firstDownAwarded: false,
    });

    const reversed = resolveFootballDraftPenaltyOutcome(draft, { enforcementOrder: ['pf-2', 'hold-1'] });
    expect(reversed.penalties.map((penalty) => penalty.penaltyId)).toEqual(['pf-2', 'hold-1']);
    expect(activeFootballPenaltyOfficialState(reversed.result)).toMatchObject({ yardLine: 'H30' });
  });

  it('stores the operator-verified down, distance, spot, and first-down decision', () => {
    const draft = makeDraft({
      family: 'rush',
      prePlay: { down: 2, distance: 10, yardLine: 'H40', lineToGain: '50' },
      result: { code: 'tackle', yards: 8, endYardLine: 'H48' },
      penalties: [
        { penaltyId: 'one', team: 'H', name: 'Holding', code: 'HOLD', status: 'accepted', resolution: 'accepted', accepted: true, liveBall: true, enforcedFrom: 'PREVIOUS', yards: -10, finalSpot: 'H30', replayDown: true, source: 'queued' },
        { penaltyId: 'two', team: 'V', name: 'Personal Foul', code: 'PF', status: 'accepted', resolution: 'accepted', accepted: true, deadBall: true, liveBall: false, enforcedFrom: 'END', yards: 15, finalSpot: 'H45', downCounts: true, source: 'queued' },
      ],
    });
    const resolved = resolveFootballDraftPenaltyOutcome(draft, {
      enforcementOrder: ['one', 'two'],
      verified: { down: 1, distance: 10, yardLine: 'V45', firstDownAwarded: true },
    });

    expect(resolved.result.officialOutcome).toMatchObject({
      operatorVerified: true,
      operatorAdjusted: true,
      verified: {
        possession: 'H', down: 1, distance: 10, yardLine: 'V45', firstDownAwarded: true, firstDownAwardedTo: 'H',
      },
    });
  });
});

function makeDraft({ family, prePlay, result, penalties }): FootballDraftIntent {
  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: 'intent-1',
    clientEventId: 'client-1',
    revision: 1,
    status: 'summaryGenerated',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    game: {
      gameId: 'GAME-1',
      homeTeamId: 'H-ID',
      visitorTeamId: 'V-ID',
      teams: {
        H: { team: 'H', teamId: 'H-ID', name: 'Home', abbr: 'HOM' },
        V: { team: 'V', teamId: 'V-ID', name: 'Visitor', abbr: 'VIS' },
      },
      rules: { downs: 4, yardsToFirstDown: 10 },
    },
    source: { kind: 'fcqi', startedBy: 'button', startedAt: '2026-08-29T00:00:00.000Z', baseEventSequence: 0 },
    play: { family, subtype: family === 'punt' ? 'fairCatch' : 'tackle', actionTeam: 'H', possession: 'H', period: 2, clock: '01:20' },
    prePlay: { possession: 'H', driveId: 'DRV-0010', driveNumber: 10, ...prePlay },
    participants: { defenders: [], penalizedPlayers: [], others: [] },
    result,
    penalties,
    warnings: [],
  } as FootballDraftIntent;
}
