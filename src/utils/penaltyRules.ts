import type { Penalty, PlayWithPenalties } from '../types/penalties';
import { getPenaltyDef } from './penaltyTable';
import { calculateFootballPenaltyFinalSpot } from './footballPenaltyEnforcement';

export type PenaltyAnalysis = {
  kind: 'NONE' | 'OFFSET' | 'ENFORCED';
  messages: string[];
  suggested: {
    yardLine?: string;
    down?: number;
    distance?: number;
    resultTag?: string;
    carryTo?: 'TRY' | 'KICKOFF' | null;
  };
};

/**
 * Analyze penalties and provide suggestions (assistive only, never blocking)
 */
export function analyzePenalties(play: PlayWithPenalties, state: any): PenaltyAnalysis {
  const analysis: PenaltyAnalysis = {
    kind: 'NONE',
    messages: [],
    suggested: {}
  };

  if (!play.penalties || play.penalties.length === 0) {
    analysis.messages.push('No penalties on this play');
    return analysis;
  }

  const acceptedPenalties = play.penalties.filter(p => p.accepted);
  const declinedPenalties = play.penalties.filter(p => !p.accepted);

  // Check for offsetting penalties
  const homeAccepted = acceptedPenalties.filter(p => p.team === 'H' && p.liveBall);
  const visitorAccepted = acceptedPenalties.filter(p => p.team === 'V' && p.liveBall);

  if (homeAccepted.length > 0 && visitorAccepted.length > 0) {
    // Offsetting live-ball penalties
    analysis.kind = 'OFFSET';
    analysis.messages.push('Offsetting live-ball penalties detected');
    analysis.messages.push('Suggestion: Replay the down');
    analysis.suggested = {
      down: state.down,
      distance: state.distance,
      yardLine: state.yard_line,
      resultTag: 'Offsetting Penalties'
    };
    return analysis;
  }

  // Handle declined penalties
  if (declinedPenalties.length > 0 && acceptedPenalties.length === 0) {
    analysis.kind = 'NONE';
    analysis.messages.push(`${declinedPenalties.length} penalty(ies) declined`);
    analysis.messages.push('Play result stands');
    analysis.suggested.resultTag = 'Penalties Declined';
    return analysis;
  }

  // Process accepted penalties
  if (acceptedPenalties.length > 0) {
    analysis.kind = 'ENFORCED';
    
    // Sort penalties: live ball first, then by enforcement order
    const sortedPenalties = [...acceptedPenalties].sort((a, b) => {
      if (a.liveBall && !b.liveBall) return -1;
      if (!a.liveBall && b.liveBall) return 1;
      return 0;
    });

    let currentYardLine = play.end_yard_line;
    let totalYards = 0;
    let hasAFD = false;
    let hasLOD = false;

    sortedPenalties.forEach(penalty => {
      const def = getPenaltyDef(penalty.code);
      const penaltyYards = penalty.yards || def?.yards || 0;
      
      analysis.messages.push(
        `${penalty.team === 'H' ? 'Home' : 'Visitor'} - ${penalty.code}: ${penaltyYards} yards from ${penalty.enforcedFrom}`
      );

      // Calculate enforcement
      currentYardLine = enforceYardage(
        currentYardLine,
        penaltyYards,
        penalty.team,
        penalty.enforcedFrom,
        state
      );

      totalYards += penaltyYards;
      
      if (penalty.automaticFirstDown) hasAFD = true;
      if (penalty.lossOfDown) hasLOD = true;
    });

    // Apply AFD/LOD logic
    let suggestedDown = state.down;
    let suggestedDistance = state.distance;

    if (hasAFD) {
      suggestedDown = 1;
      suggestedDistance = 10;
      analysis.messages.push('Automatic first down');
    } else if (hasLOD) {
      suggestedDown = Math.min(state.down + 1, 4);
      analysis.messages.push('Loss of down');
    }

    // Check for defensive foul on scoring play
    const isScoring = play.is_touchdown || play.is_field_goal;
    const hasDefensiveFoul = acceptedPenalties.some(p => 
      p.team !== state.possession && p.accepted
    );

    if (isScoring && hasDefensiveFoul) {
      analysis.messages.push('Defensive foul on scoring play');
      analysis.messages.push('Score stands, penalty may be enforced on try or kickoff');
      analysis.suggested.carryTo = 'TRY';
    }

    analysis.suggested = {
      yardLine: currentYardLine,
      down: suggestedDown,
      distance: suggestedDistance,
      resultTag: `${acceptedPenalties.length} Penalty(ies) Enforced`,
      ...(analysis.suggested.carryTo ? { carryTo: analysis.suggested.carryTo } : {})
    };
  }

  return analysis;
}

/**
 * Apply suggestions to play data (called in assisted mode or when user chooses to apply)
 */
export function applySuggestions(
  play: PlayWithPenalties,
  analysis: PenaltyAnalysis,
  state: any
): PlayWithPenalties {
  if (!analysis.suggested) {
    return play;
  }

  const updatedPlay = { ...play };

  // Apply suggested yard line
  if (analysis.suggested.yardLine) {
    updatedPlay.end_yard_line = analysis.suggested.yardLine;
  }

  // Apply down/distance (these would typically be in the parent play data)
  if (analysis.suggested.down !== undefined) {
    (updatedPlay as any).postDown = analysis.suggested.down;
  }
  if (analysis.suggested.distance !== undefined) {
    (updatedPlay as any).postDistance = analysis.suggested.distance;
  }

  // Add result tag to play description
  if (analysis.suggested.resultTag) {
    (updatedPlay as any).resultTag = analysis.suggested.resultTag;
  }

  // Handle carry-over to kickoff/try
  if (analysis.suggested.carryTo) {
    play.penalties?.forEach(p => {
      if (p.accepted && p.team !== state.possession) {
        p.carryOverToKO = analysis.suggested.carryTo === 'KICKOFF';
      }
    });
  }

  return updatedPlay;
}

/**
 * Enforce yardage with half-the-distance logic
 */
function enforceYardage(
  startYardLine: string,
  yards: number,
  penaltyTeam: 'H' | 'V',
  enforcementPoint: string,
  state: any
): string {
  // Determine enforcement spot based on enforcement point
  let enforcementSpot = startYardLine;
  switch (enforcementPoint) {
    case 'PREVIOUS':
      enforcementSpot = state.yard_line || startYardLine;
      break;
    case 'SPOT':
    case 'END':
      enforcementSpot = startYardLine;
      break;
    default:
      enforcementSpot = startYardLine;
  }

  const possession = state.possession === 'V' ? 'V' : 'H';
  return calculateFootballPenaltyFinalSpot({
    enforcementSpot: enforcementSpot as any,
    possession,
    penaltyTeam,
    yards: Math.abs(yards),
  })?.spot ?? startYardLine;
}

/**
 * Check if penalties should offset
 */
export function shouldOffsettingApply(penalties: Penalty[]): boolean {
  const acceptedLiveBall = penalties.filter(p => p.accepted && p.liveBall);
  const homeCount = acceptedLiveBall.filter(p => p.team === 'H').length;
  const visitorCount = acceptedLiveBall.filter(p => p.team === 'V').length;
  
  return homeCount > 0 && visitorCount > 0;
}

/**
 * Get enforcement order for multiple penalties
 */
export function getEnforcementOrder(penalties: Penalty[]): Penalty[] {
  return penalties
    .filter(p => p.accepted)
    .sort((a, b) => {
      // Live ball penalties first
      if (a.liveBall && !b.liveBall) return -1;
      if (!a.liveBall && b.liveBall) return 1;
      
      // Then by enforcement point priority
      const enforcementPriority = {
        'PREVIOUS': 1,
        'SPOT': 2,
        'END': 3,
        'TRY': 4,
        'FREE_KICK': 5,
        'SUCCESSFUL_TD': 6
      };
      
      const aPriority = enforcementPriority[a.enforcedFrom] || 99;
      const bPriority = enforcementPriority[b.enforcedFrom] || 99;
      
      return aPriority - bPriority;
    });
}
