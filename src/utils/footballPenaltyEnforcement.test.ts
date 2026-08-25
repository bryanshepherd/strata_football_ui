import { describe, expect, it } from 'vitest';
import { calculateFootballPenaltyFinalSpot } from './footballPenaltyEnforcement';

describe('calculateFootballPenaltyFinalSpot', () => {
  it.each([
    ['V35', 15, 'V20', false],
    ['V35', 10, 'V25', false],
    ['V35', 5, 'V30', false],
    ['V28', 15, 'V14', true],
    ['V28', 10, 'V18', false],
    ['V28', 5, 'V23', false],
    ['V16', 15, 'V08', true],
    ['V16', 10, 'V08', true],
    ['V16', 5, 'V11', false],
    ['V08', 15, 'V04', true],
    ['V08', 10, 'V04', true],
    ['V08', 5, 'V04', true],
  ] as const)('enforces from %s with %i yards to %s', (enforcementSpot, yards, expectedSpot, halfDistanceApplied) => {
    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot,
      possession: 'H',
      penaltyTeam: 'V',
      yards,
    })).toMatchObject({ spot: expectedSpot, halfDistanceApplied });
  });

  it('uses the full distance at the exact half-distance threshold', () => {
    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot: 'V20',
      possession: 'H',
      penaltyTeam: 'V',
      yards: 10,
    })).toMatchObject({ spot: 'V10', halfDistanceApplied: false });
  });

  it('rounds a fractional half-distance spot up in possession-relative notation', () => {
    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot: 'V29',
      possession: 'H',
      penaltyTeam: 'V',
      yards: 15,
    })).toMatchObject({
      spot: 'V14',
      unroundedPosition: 85.5,
      roundedPosition: 86,
    });

    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot: 'H29',
      possession: 'H',
      penaltyTeam: 'H',
      yards: 15,
    })).toMatchObject({ spot: 'H15', unroundedPosition: 14.5, roundedPosition: 15 });
  });

  it('caps a non-touchdown auto-filled result at the one-yard line', () => {
    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot: 'V00',
      possession: 'H',
      penaltyTeam: 'V',
      yards: 0,
    })).toMatchObject({ spot: 'V01', roundedPosition: 99 });

    expect(calculateFootballPenaltyFinalSpot({
      enforcementSpot: 'V00',
      possession: 'H',
      penaltyTeam: 'V',
      yards: 0,
      touchdown: true,
    })).toMatchObject({ spot: 'goal', roundedPosition: 100 });
  });
});
