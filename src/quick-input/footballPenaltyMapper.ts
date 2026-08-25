import type { Penalty as CanonicalPenalty } from '../contracts/football/SubmitEventRequest';
import type { DraftPenalty, DraftPenaltyEnforcementSpot } from './footballIntentSchema';

const ENFORCEMENT_SPOTS: Record<DraftPenaltyEnforcementSpot, NonNullable<CanonicalPenalty['enforcedFrom']>> = {
  PREVIOUS: 'previousSpot',
  SPOT: 'spotOfFoul',
  END: 'endOfPlay',
  TRY: 'trySpot',
  FREE_KICK: 'freeKickSpot',
  SUCCESSFUL_TD: 'succeedingSpot',
};

/** Converts FCQI penalty detail into the public submit-event contract. */
export function mapDraftPenaltyToCanonicalEvent(penalty: DraftPenalty): CanonicalPenalty {
  const playerId = penalty.playerId ?? penalty.penalizedPlayerId;
  const replayDown = penalty.replayDown || penalty.downConsequence === 'REPEAT' ||
    (penalty.status === 'offsetting' && penalty.offsetting?.previousPlayCounts === false);

  const ejectionNote = penalty.ejected
    ? `EJECTION: ${penalty.ejectedPlayerId || playerId || 'penalized person'} ejected from the game.`
    : '';
  const notes = [penalty.notes, ejectionNote]
    .map((note) => note?.trim())
    .filter(Boolean)
    .filter((note, index, all) => all.indexOf(note) === index)
    .join(' ');

  return {
    penaltyId: penalty.penaltyId,
    code: penalty.code,
    team: penalty.team,
    ...(playerId !== undefined ? { playerId } : {}),
    ...(typeof penalty.liveBall === 'boolean' ? { timing: penalty.liveBall ? 'liveBall' : 'deadBall' } : {}),
    status: penalty.status,
    ...(typeof penalty.yards === 'number' ? { yards: Math.abs(penalty.yards) } : {}),
    ...(penalty.enforcedFrom ? { enforcedFrom: ENFORCEMENT_SPOTS[penalty.enforcedFrom] } : {}),
    ...(penalty.spotOfFoul ? { spotOfFoul: penalty.spotOfFoul } : {}),
    ...(penalty.finalSpot ? { finalSpot: penalty.finalSpot } : {}),
    ...(penalty.automaticFirstDown || penalty.downConsequence === 'AUTO_FIRST' ? { automaticFirstDown: true } : {}),
    ...(penalty.lossOfDown || penalty.downConsequence === 'LOSS_OF_DOWN' ? { lossOfDown: true } : {}),
    ...(replayDown ? { replayDown: true } : {}),
    ...(penalty.downCounts || penalty.downConsequence === 'DOWN_COUNTS' ? { downCounts: true } : {}),
    ...(notes ? { notes } : {}),
  };
}
