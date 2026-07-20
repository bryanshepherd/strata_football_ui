import type { Penalty, PlayWithPenalties } from '../types/penalties';
import { getPenaltyDef } from './penaltyTable';

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
  // Parse yard line (format: H25, V30, 50)
  const parseYardLine = (yl: string): { team: 'H' | 'V' | '50', yards: number } => {
    if (yl === '50') return { team: '50', yards: 50 };
    
    const team = yl[0] as 'H' | 'V';
    const yards = parseInt(yl.substring(1));
    return { team, yards };
  };

  const formatYardLine = (team: 'H' | 'V' | '50', yards: number): string => {
    if (team === '50' || yards === 50) return '50';
    if (yards <= 0) return `${team}00`; // Goal line
    if (yards > 50) {
      // Flip to other side
      const oppositeTeam = team === 'H' ? 'V' : 'H';
      return `${oppositeTeam}${String(100 - yards).padStart(2, '0')}`;
    }
    return `${team}${String(yards).padStart(2, '0')}`;
  };

  const start = parseYardLine(startYardLine);
  
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

  const enforcement = parseYardLine(enforcementSpot);
  
  // Calculate field position (0-100, where 0 is own goal, 100 is opponent goal)
  const getFieldPosition = (yl: { team: 'H' | 'V' | '50', yards: number }, perspective: 'H' | 'V'): number => {
    if (yl.team === '50') return 50;
    if (yl.team === perspective) return yl.yards;
    return 100 - yl.yards;
  };

  // Determine which team benefits from the penalty
  const benefitingTeam = penaltyTeam === 'H' ? 'V' : 'H';
  let fieldPos = getFieldPosition(enforcement, benefitingTeam);

  // Apply penalty yardage
  if (penaltyTeam === state.possession) {
    // Offensive penalty - move back
    fieldPos -= yards;
  } else {
    // Defensive penalty - move forward
    fieldPos += yards;
  }

  // Apply half-the-distance rule
  if (fieldPos >= 90 && penaltyTeam !== state.possession) {
    // Half the distance to goal when enforcing toward opponent's goal
    const distanceToGoal = 100 - getFieldPosition(enforcement, benefitingTeam);
    fieldPos = getFieldPosition(enforcement, benefitingTeam) + (distanceToGoal / 2);
  } else if (fieldPos <= 10 && penaltyTeam === state.possession) {
    // Half the distance when enforcing toward own goal
    const distanceToGoal = getFieldPosition(enforcement, benefitingTeam);
    fieldPos = distanceToGoal / 2;
  }

  // Clamp field position
  fieldPos = Math.max(1, Math.min(99, fieldPos));

  // Convert back to yard line format
  if (fieldPos === 50) {
    return '50';
  } else if (fieldPos < 50) {
    return formatYardLine(benefitingTeam, Math.round(fieldPos));
  } else {
    const oppositeTeam = benefitingTeam === 'H' ? 'V' : 'H';
    return formatYardLine(oppositeTeam, Math.round(100 - fieldPos));
  }
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