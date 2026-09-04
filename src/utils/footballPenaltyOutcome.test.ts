import { describe, expect, it } from 'vitest';
import type { FootballDraftIntent } from '../quick-input/footballIntentSchema';
import { activeFootballPenaltyOfficialState, resolveFootballDraftPenaltyOutcome } from './footballPenaltyOutcome';

describe('football penalty outcome authority', () => {
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
