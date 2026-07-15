import { describe, expect, it } from 'vitest';
import {
  awaitingKickoffState,
  createCoinTossRecord,
  isConsequentialTossEdit,
  isPlayFamilyAvailable,
  resolveCompleteToss,
  resolveToss,
  validateCoinToss,
} from './footballPregame';

const complete = (patch: Record<string, unknown>) => resolveCompleteToss({
  ...createCoinTossRecord(),
  status: 'inProgress',
  winnerTeam: 'H',
  ...patch,
} as any, '2026-07-15T12:00:00.000Z');

describe('football pregame coin toss domain', () => {
  it.each([
    ['winner kicks', { winnerInitialChoice: 'kick', direction: 'north' }, 'H', 'V', 'V', 'V'],
    ['winner receives', { winnerInitialChoice: 'receive', direction: 'north' }, 'V', 'H', 'V', 'V'],
    ['winner takes side and loser kicks', { winnerInitialChoice: 'side', loserChoice: 'kick', direction: 'north' }, 'V', 'H', 'H', 'V'],
    ['winner takes side and loser receives', { winnerInitialChoice: 'side', loserChoice: 'receive', direction: 'north' }, 'H', 'V', 'H', 'V'],
    ['winner defers, loser kicks', { winnerInitialChoice: 'defer', loserChoice: 'kick', winnerSecondaryChoice: 'side', direction: 'north' }, 'V', 'H', 'H', 'H'],
    ['winner defers, loser receives', { winnerInitialChoice: 'defer', loserChoice: 'receive', winnerSecondaryChoice: 'side', direction: 'north' }, 'H', 'V', 'H', 'H'],
    ['winner defers, loser takes side, winner kicks', { winnerInitialChoice: 'defer', loserChoice: 'side', winnerSecondaryChoice: 'kick', direction: 'north' }, 'H', 'V', 'V', 'H'],
    ['winner defers, loser takes side, winner receives', { winnerInitialChoice: 'defer', loserChoice: 'side', winnerSecondaryChoice: 'receive', direction: 'north' }, 'V', 'H', 'V', 'H'],
  ])('%s', (_label, patch, kicking, receiving, directionTeam, secondHalfTeam) => {
    const record = complete(patch);
    expect(record.firstHalfKickingTeam).toBe(kicking);
    expect(record.firstHalfReceivingTeam).toBe(receiving);
    expect(record.directionChoiceTeam).toBe(directionTeam);
    expect(record.secondHalfChoiceTeam).toBe(secondHalfTeam);
  });

  it('permits side as the defer winner secondary choice', () => {
    expect(complete({ winnerInitialChoice: 'defer', loserChoice: 'kick', winnerSecondaryChoice: 'side', direction: 'east' }).winnerSecondaryChoice).toBe('side');
  });

  it('rejects incomplete and contradictory tosses', () => {
    expect(resolveToss({ winnerTeam: 'H', winnerInitialChoice: 'defer', loserChoice: 'kick', winnerSecondaryChoice: 'kick', direction: 'north' })).toBeNull();
    const invalid = { ...createCoinTossRecord(), status: 'complete' as const, winnerTeam: 'H' as const, loserTeam: 'H' as const };
    expect(validateCoinToss(invalid)).toEqual(expect.objectContaining({ ok: false }));
  });

  it('does not require captains or starters for toss completion', () => {
    expect(validateCoinToss(complete({ winnerInitialChoice: 'kick', direction: 'south' }))).toEqual({ ok: true });
  });

  it('initializes awaiting kickoff from configured rules without possession or drive', () => {
    const toss = complete({ winnerInitialChoice: 'receive', direction: 'north' });
    expect(awaitingKickoffState({ minutesPerPeriod: 12, kickoffSpot: 'V35' }, toss)).toMatchObject({
      gamePhase: 'awaitingKickoff',
      clock: { clock: '12:00', period: 1, isRunning: false },
      liveState: { possession: null, down: null, distance: null, yardLine: 'V35', driveId: null },
      kickingTeam: 'V',
      receivingTeam: 'H',
    });
  });

  it('gates FCQI play families by phase and flags consequential post-kick edits', () => {
    expect(isPlayFamilyAvailable('pregame', 'rush')).toBe(false);
    expect(isPlayFamilyAvailable('awaitingKickoff', 'kickoff')).toBe(true);
    expect(isPlayFamilyAvailable('awaitingKickoff', 'rush')).toBe(false);
    const before = complete({ winnerInitialChoice: 'kick', direction: 'north' });
    expect(isConsequentialTossEdit(before, { ...before, direction: 'south' }, true)).toBe(true);
  });
});
