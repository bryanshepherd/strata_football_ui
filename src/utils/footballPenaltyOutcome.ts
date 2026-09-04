import type {
  DraftPenalty,
  FootballDraftIntent,
  Spot,
  TeamCode,
} from '../quick-input/footballIntentSchema';
import { calculateFootballPenaltyFinalSpot } from './footballPenaltyEnforcement';

export type FootballPenaltyOfficialState = {
  possession: TeamCode;
  down: number;
  distance: number;
  yardLine: Spot;
  lineToGain: Spot;
  firstDownAwarded: boolean;
  firstDownAwardedTo?: TeamCode;
  firstDownSource?: 'play' | 'penalty';
};

export type FootballPenaltyEnforcementReview = {
  source: 'penaltyEnforcement';
  enforcementOrder: string[];
  calculated: FootballPenaltyOfficialState;
  verified?: FootballPenaltyOfficialState;
  operatorVerified: boolean;
  operatorAdjusted: boolean;
};

type ResolveOptions = {
  enforcementOrder?: string[];
  verified?: Pick<FootballPenaltyOfficialState, 'down' | 'distance' | 'yardLine' | 'firstDownAwarded'>;
};

/**
 * Resolves the official state after all accepted fouls have been enforced.
 * The observed play remains intact; this result is the authority for the
 * next possession, series, spot, and first-down credit.
 */
export function resolveFootballDraftPenaltyOutcome(
  draft: FootballDraftIntent,
  options: ResolveOptions = {},
): FootballDraftIntent {
  if (!Array.isArray(draft.penalties) || draft.penalties.length === 0) return draft;

  const penalties = orderPenalties(draft.penalties, options.enforcementOrder).map(clonePenalty);
  const accepted = penalties.filter((penalty) => penalty.status === 'accepted');
  if (accepted.length === 0) {
    return {
      ...draft,
      penalties,
      result: { ...draft.result, officialOutcome: undefined },
    };
  }

  const prePossession = draft.prePlay.possession ?? draft.play.possession ?? draft.play.actionTeam;
  const observedPossession = draft.result.nextPossession
    ?? draft.result.turnover?.recoveredBy
    ?? draft.result.turnover?.team
    ?? draft.result.fumble?.recoveredByTeam
    ?? prePossession;
  const observedEnd = draft.result.return?.returnEndYardLine
    ?? draft.result.fumble?.returnEndYardLine
    ?? draft.result.turnover?.returnEndYardLine
    ?? draft.result.fumble?.recoverySpot
    ?? draft.result.turnover?.spot
    ?? draft.result.endYardLine
    ?? draft.prePlay.yardLine;

  if (!observedEnd) return draft;

  const immediateNoPlay = draft.play.family === 'penalty'
    || accepted.some((penalty) => penalty.source === 'immediate');
  const retainedByEnforcement = immediateNoPlay || accepted.some((penalty) => (
    penalty.automaticFirstDown || penalty.replayDown
  ));
  let possession = retainedByEnforcement ? prePossession : observedPossession;
  let currentSpot = observedEnd;

  for (const penalty of accepted) {
    const basis = penaltyBasisSpot(penalty, draft, currentSpot, observedEnd);
    const penaltyDistance = penalty.tableYards ?? (typeof penalty.yards === 'number' ? Math.abs(penalty.yards) : undefined);
    const sequentialDeadBall = penalty.deadBall === true && accepted.length > 1;
    const calculated = basis && typeof penaltyDistance === 'number'
      ? calculateFootballPenaltyFinalSpot({
          enforcementSpot: basis,
          possession,
          penaltyTeam: penalty.team,
          yards: penaltyDistance,
        })
      : null;
    const finalSpot = (sequentialDeadBall ? calculated?.spot : penalty.finalSpot ?? calculated?.spot) ?? currentSpot;
    penalty.finalSpot = finalSpot;
    if (sequentialDeadBall || typeof penalty.yards !== 'number') {
      penalty.yards = signedYards(basis, finalSpot, possession) ?? penalty.yards;
    }
    currentSpot = finalSpot;
  }

  const rules = draft.game.rules ?? {};
  const downs = rules.downs ?? 4;
  const yardsToFirst = rules.yardsToFirstDown ?? 10;
  const preDown = draft.prePlay.down ?? 1;
  const originalLineToGain = draft.prePlay.lineToGain
    ?? lineToGainFromDistance(draft.prePlay.yardLine, prePossession, yardsToFirst);
  const liveAccepted = accepted.filter((penalty) => penalty.liveBall !== false);
  const playNullified = liveAccepted.some((penalty) => (
    penalty.enforcedFrom === 'PREVIOUS'
    || penalty.enforcedFrom === 'SPOT'
  ));
  const playEarnedFirstDown = !playNullified && Boolean(
    draft.result.firstDown
    || reachedLineToGain(observedEnd, originalLineToGain, prePossession)
    || draft.result.scoring?.type === 'touchdown'
  );
  const automaticFirstDown = accepted.some((penalty) => penalty.automaticFirstDown);
  const enforcementEarnedFirstDown = possession === prePossession
    && reachedLineToGain(currentSpot, originalLineToGain, prePossession);
  let firstDownAwarded = possession === prePossession
    && (automaticFirstDown || playEarnedFirstDown || enforcementEarnedFirstDown);
  // An immediate penalty is its own no-play entry, so it cannot advance the
  // down. Explicit replay flags remain authoritative for penalties attached
  // to a play.
  const replayDown = immediateNoPlay || accepted.some((penalty) => penalty.replayDown);
  let down = possession !== prePossession
    ? 1
    : firstDownAwarded
      ? 1
      : replayDown
        ? preDown
        : preDown + 1;

  if (possession === prePossession && down > downs) {
    possession = oppositeTeam(prePossession);
    down = 1;
    firstDownAwarded = false;
  }

  const lineToGain = firstDownAwarded || possession !== prePossession
    ? lineToGainFromDistance(currentSpot, possession, yardsToFirst)
    : originalLineToGain ?? lineToGainFromDistance(currentSpot, possession, yardsToFirst);
  const distance = Math.max(0, yardsBetween(currentSpot, lineToGain, possession) ?? yardsToFirst);
  const calculated: FootballPenaltyOfficialState = {
    possession,
    down,
    distance,
    yardLine: currentSpot,
    lineToGain,
    firstDownAwarded,
    ...(firstDownAwarded ? { firstDownAwardedTo: possession } : {}),
    ...(firstDownAwarded
      ? { firstDownSource: automaticFirstDown || enforcementEarnedFirstDown ? 'penalty' as const : 'play' as const }
      : {}),
  };

  const verified = options.verified
    ? verifiedOfficialState(calculated, options.verified, yardsToFirst)
    : undefined;
  if (verified && verified.yardLine !== currentSpot) {
    const lastAccepted = [...penalties].reverse().find((penalty) => penalty.status === 'accepted');
    if (lastAccepted) lastAccepted.finalSpot = verified.yardLine;
  }

  const officialOutcome: FootballPenaltyEnforcementReview = {
    source: 'penaltyEnforcement',
    enforcementOrder: penalties.map((penalty) => penalty.penaltyId),
    calculated,
    ...(verified ? { verified } : {}),
    operatorVerified: Boolean(verified),
    operatorAdjusted: Boolean(verified && !sameOfficialState(calculated, verified)),
  };

  return {
    ...draft,
    penalties,
    result: {
      ...draft.result,
      officialOutcome,
    },
  };
}

export function activeFootballPenaltyOfficialState(result: FootballDraftIntent['result'] | undefined): FootballPenaltyOfficialState | null {
  const review = result?.officialOutcome;
  if (!review || review.source !== 'penaltyEnforcement') return null;
  return review.verified ?? review.calculated ?? null;
}

function verifiedOfficialState(
  calculated: FootballPenaltyOfficialState,
  verified: ResolveOptions['verified'] & {},
  yardsToFirst: number,
): FootballPenaltyOfficialState {
  const firstDownAwarded = Boolean(verified.firstDownAwarded);
  const lineToGain = firstDownAwarded
    ? lineToGainFromDistance(verified.yardLine, calculated.possession, yardsToFirst)
    : lineToGainFromDistance(verified.yardLine, calculated.possession, verified.distance);
  return {
    possession: calculated.possession,
    down: verified.down,
    distance: verified.distance,
    yardLine: verified.yardLine,
    lineToGain,
    firstDownAwarded,
    ...(firstDownAwarded ? { firstDownAwardedTo: calculated.possession } : {}),
    ...(firstDownAwarded ? { firstDownSource: calculated.firstDownSource ?? 'penalty' } : {}),
  };
}

function orderPenalties(penalties: DraftPenalty[], requested: string[] | undefined): DraftPenalty[] {
  if (!requested?.length) return penalties;
  const byId = new Map(penalties.map((penalty) => [penalty.penaltyId, penalty]));
  const ordered = requested.map((id) => byId.get(id)).filter((penalty): penalty is DraftPenalty => Boolean(penalty));
  const used = new Set(ordered.map((penalty) => penalty.penaltyId));
  return [...ordered, ...penalties.filter((penalty) => !used.has(penalty.penaltyId))];
}

function penaltyBasisSpot(
  penalty: DraftPenalty,
  draft: FootballDraftIntent,
  currentSpot: Spot,
  observedEnd: Spot,
): Spot | null {
  if (penalty.enforcedFrom === 'PREVIOUS') return draft.prePlay.yardLine;
  if (penalty.enforcedFrom === 'SPOT') return penalty.spotOfFoul ?? null;
  if (penalty.enforcedFrom === 'END') return penalty.deadBall ? currentSpot : observedEnd;
  return currentSpot;
}

function reachedLineToGain(spot: Spot | null | undefined, lineToGain: Spot | null | undefined, possession: TeamCode): boolean {
  const spotYard = relativeYard(spot, possession);
  const targetYard = relativeYard(lineToGain, possession);
  return typeof spotYard === 'number' && typeof targetYard === 'number' && spotYard >= targetYard;
}

function lineToGainFromDistance(spot: Spot | null | undefined, possession: TeamCode, distance: number): Spot {
  const start = relativeYard(spot, possession) ?? 0;
  return spotFromRelative(Math.min(100, start + Math.max(0, distance)), possession);
}

function yardsBetween(start: Spot | null | undefined, end: Spot | null | undefined, possession: TeamCode): number | null {
  const startYard = relativeYard(start, possession);
  const endYard = relativeYard(end, possession);
  return typeof startYard === 'number' && typeof endYard === 'number' ? endYard - startYard : null;
}

function signedYards(start: Spot | null | undefined, end: Spot | null | undefined, possession: TeamCode): number | undefined {
  const yards = yardsBetween(start, end, possession);
  return typeof yards === 'number' ? yards : undefined;
}

function relativeYard(spot: Spot | null | undefined, possession: TeamCode): number | null {
  if (!spot) return null;
  if (spot === 'goal') return 100;
  if (spot === '50') return 50;
  const match = String(spot).match(/^([HV])(\d{1,2})$/);
  if (!match) return null;
  const yard = Number(match[2]);
  return match[1] === possession ? yard : 100 - yard;
}

function spotFromRelative(relative: number, possession: TeamCode): Spot {
  const rounded = Math.max(0, Math.min(100, Math.round(relative)));
  if (rounded === 100) return 'goal';
  if (rounded === 50) return '50';
  if (rounded < 50) return `${possession}${String(rounded).padStart(2, '0')}` as Spot;
  const opponent = oppositeTeam(possession);
  return `${opponent}${String(100 - rounded).padStart(2, '0')}` as Spot;
}

function oppositeTeam(team: TeamCode): TeamCode {
  return team === 'H' ? 'V' : 'H';
}

function sameOfficialState(left: FootballPenaltyOfficialState, right: FootballPenaltyOfficialState): boolean {
  return left.possession === right.possession
    && left.down === right.down
    && left.distance === right.distance
    && left.yardLine === right.yardLine
    && left.lineToGain === right.lineToGain
    && left.firstDownAwarded === right.firstDownAwarded;
}

function clonePenalty(penalty: DraftPenalty): DraftPenalty {
  return {
    ...penalty,
    offsetting: penalty.offsetting ? { ...penalty.offsetting } : undefined,
  };
}
