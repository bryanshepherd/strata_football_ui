import type { Spot, TeamCode } from '../quick-input/footballIntentSchema';

export type FootballPenaltyFinalSpotResult = {
  spot: Spot;
  halfDistanceApplied: boolean;
  unroundedPosition: number;
  roundedPosition: number;
};

/**
 * Calculates an auto-filled penalty spot in possession-relative 0-100 notation.
 * Fractional positions always round toward the opponent's goal, and a
 * non-touchdown result is capped between the one-yard lines.
 */
export function calculateFootballPenaltyFinalSpot({
  enforcementSpot,
  possession,
  penaltyTeam,
  yards,
  touchdown = false,
}: {
  enforcementSpot: Spot | null | undefined;
  possession: TeamCode;
  penaltyTeam: TeamCode;
  yards: number;
  touchdown?: boolean;
}): FootballPenaltyFinalSpotResult | null {
  const start = spotToRelativePosition(enforcementSpot, possession);
  if (start === null || !Number.isFinite(yards) || yards < 0) return null;

  const towardOwnGoal = penaltyTeam === possession;
  const direction = towardOwnGoal ? -1 : 1;
  const distanceToOffendingGoal = towardOwnGoal ? start : 100 - start;
  const halfDistanceApplied = yards > 0 && (yards * 2 > distanceToOffendingGoal);
  const enforcedDistance = halfDistanceApplied ? distanceToOffendingGoal / 2 : yards;
  const unroundedPosition = start + (direction * enforcedDistance);
  const roundedPosition = Math.max(
    touchdown ? 0 : 1,
    Math.min(touchdown ? 100 : 99, Math.ceil(unroundedPosition)),
  );

  return {
    spot: relativePositionToSpot(roundedPosition, possession),
    halfDistanceApplied,
    unroundedPosition,
    roundedPosition,
  };
}

function spotToRelativePosition(spot: Spot | null | undefined, possession: TeamCode): number | null {
  if (!spot) return null;
  if (spot === 'goal') return 100;
  if (spot === '50') return 50;
  const match = String(spot).toUpperCase().match(/^([HV])(\d{1,2})$/);
  if (!match) return null;
  const yard = Number(match[2]);
  if (yard < 0 || yard > 50) return null;
  return match[1] === possession ? yard : 100 - yard;
}

function relativePositionToSpot(position: number, possession: TeamCode): Spot {
  if (position === 100) return 'goal';
  if (position === 50) return '50';
  if (position < 50) return `${possession}${String(position).padStart(2, '0')}` as Spot;
  const opponent: TeamCode = possession === 'H' ? 'V' : 'H';
  return `${opponent}${String(100 - position).padStart(2, '0')}` as Spot;
}
