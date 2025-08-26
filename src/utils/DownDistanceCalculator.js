/**
 * DOWN-DISTANCE CALCULATOR
 * Uses Possession-Relative Field Positioning and LineToGain approach
 * 
 * CORE PRINCIPLES:
 * 1. LineToGain in game_state is authoritative for distance calculation
 * 2. Distance = calculateYardsToGain(currentYardLine, lineToGain)
 * 3. LineToGain only changes when distance < 1 or possession changes
 * 4. Uses Possession-Relative algorithm for consistent yard calculations
 */

class DownDistanceCalculator {
  
  /**
   * Convert field position to possession-relative position (0-100)
   * 0 = own goal line, 100 = opponent goal line
   * 
   * @param {string} position - Field position (H25, V35, etc.)
   * @param {string} possession - Team with possession ('H', 'V', 'HOME', 'VISITOR')
   * @return {number} Relative position 0-100
   */
  static toPossessionRelative(position, possession) {
    if (!position || !possession) return 0;
    
    const side = position.charAt(0).toUpperCase();
    const yard = parseInt(position.substring(1));
    const possessionTeam = possession.charAt(0).toUpperCase(); // H or V
    
    if (side === possessionTeam) {
      // Own side: V20 for V team = 20, H20 for H team = 20
      return yard;
    } else {
      // Opponent side: H20 for V team = 80 (100-20), V20 for H team = 80 (100-20)
      return 100 - yard;
    }
  }
  
  /**
   * Calculate net yards gained using possession-relative algorithm
   * 
   * @param {string} startPosition - Starting field position
   * @param {string} endPosition - Ending field position  
   * @param {string} possession - Team with possession
   * @return {number} Net yards gained (positive = toward goal)
   */
  static calculateNetYards(startPosition, endPosition, possession) {
    const startRelative = this.toPossessionRelative(startPosition, possession);
    const endRelative = this.toPossessionRelative(endPosition, possession);
    
    return endRelative - startRelative;
  }
  
  /**
   * Calculate yards to gain for first down
   * Uses LineToGain field from game_state as authoritative source
   * 
   * @param {string} currentPosition - Current field position
   * @param {string} lineToGain - Target line to gain (from game_state.LineToGain)
   * @param {string} possession - Team with possession
   * @return {number} Yards needed for first down
   */
  static calculateYardsToGain(currentPosition, lineToGain, possession) {
    if (!lineToGain) return 10; // Default if no LineToGain set
    
    const currentRelative = this.toPossessionRelative(currentPosition, possession);
    const gainRelative = this.toPossessionRelative(lineToGain, possession);
    
    return Math.max(1, gainRelative - currentRelative);
  }
  
  /**
   * Determine new LineToGain after first down or possession change
   * 
   * @param {string} currentPosition - Current field position
   * @param {string} possession - Team with possession
   * @return {string} New LineToGain position
   */
  static calculateNewLineToGain(currentPosition, possession) {
    const currentRelative = this.toPossessionRelative(currentPosition, possession);
    const gainRelative = Math.min(100, currentRelative + 10);
    
    return this.relativeToFieldPosition(gainRelative, possession);
  }
  
  /**
   * Convert relative position back to field position
   * 
   * @param {number} relativePosition - Position 0-100 from own goal
   * @param {string} possession - Team with possession
   * @return {string} Field position (H25, V35, etc.)
   */
  static relativeToFieldPosition(relativePosition, possession) {
    const possessionTeam = possession.charAt(0).toUpperCase();
    const clamped = Math.max(0, Math.min(100, relativePosition));
    
    if (clamped <= 50) {
      // On possessing team's side of field
      return `${possessionTeam}${clamped.toString().padStart(2, '0')}`;
    } else {
      // On opponent's side of field
      const opponentYard = 100 - clamped;
      const opponentTeam = possessionTeam === 'H' ? 'V' : 'H';
      return `${opponentTeam}${opponentYard.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Check if position is goal-to-go (LineToGain is at or past goal line)
   * Uses LineToGain field to determine if next first down would be touchdown
   */
  static isGoalToGo(currentPosition, lineToGain, possession) {
    if (!lineToGain) return false;
    
    const gainRelative = this.toPossessionRelative(lineToGain, possession);
    return gainRelative >= 100; // LineToGain is at or past goal line
  }
  
  /**
   * Check if position is in red zone (within 20 yards of goal)
   */
  static isRedZone(currentPosition, possession) {
    const relative = this.toPossessionRelative(currentPosition, possession);
    return relative >= 80; // Within 20 yards of goal (80-100)
  }
  
  /**
   * MAIN CALCULATION: Determine post-play down and distance
   * 
   * @param {Object} playData - Play information
   * @param {Object} currentGameState - Current game state
   * @return {Object} New down, distance, lineToGain, and flags
   */
  static calculatePostPlayState(playData, currentGameState) {
    const {
      startPosition = currentGameState.YardLinePosition,
      endPosition = playData.finalYardLine || playData.endYardLine,
      possession = currentGameState.Possession,
      isFirstDown = false,
      isTouchdown = false,
      isTurnover = false,
      isSafety = false,
      hasAcceptedPenalty = false,
      penaltyData = null,
      is_kickoff = false,  // NEW: Flag to identify kickoffs
      play_type = null,
      sub_type = null
    } = playData;
    
    const currentDown = currentGameState.CurrentDown || 1;
    const currentLineToGain = currentGameState.LineToGain;
    
    // CRITICAL FIX: Don't calculate drive results for kickoffs
    // Kickoffs start new drives, they don't end them
    if (is_kickoff || (play_type === 'kick' && sub_type === 'kickoff')) {
      // For kickoffs, just return the new field position without drive logic
      return {
        postDown: 1,  // New drive starts with 1st down
        postDistance: 10,  // 10 yards to go
        postYardLine: endPosition,
        lineToGain: this.calculateNewLineToGain(endPosition, possession),
        isGoalToGo: this.isGoalToGo(endPosition, this.calculateNewLineToGain(endPosition, possession), possession),
        isRedZone: this.isRedZone(endPosition, possession),
        driveEnds: false,  // Kickoffs don't end drives, they start them
        driveResult: null  // NEVER set driveResult for kickoffs
      };
    }
    
    // Handle scoring plays - drive ends
    if (isTouchdown || isSafety) {
      // Calculate goal-to-go status based on pre-play state
      const wasGoalToGo = this.isGoalToGo(startPosition, currentLineToGain, possession);
      
      return {
        postDown: null, // Drive ends
        postDistance: null,
        postYardLine: endPosition,
        lineToGain: null,
        isGoalToGo: wasGoalToGo, // Preserve pre-play goal-to-go status
        isRedZone: this.isRedZone(startPosition, possession), // Pre-play red zone status
        driveEnds: true,
        driveResult: isTouchdown ? 'TOUCHDOWN' : 'SAFETY'
      };
    }
    
    // Handle turnovers - drive ends
    if (isTurnover) {
      // Calculate goal-to-go status based on pre-play state
      const wasGoalToGo = this.isGoalToGo(startPosition, currentLineToGain, possession);
      
      return {
        postDown: null, // Drive ends
        postDistance: null,
        postYardLine: endPosition,
        lineToGain: null,
        isGoalToGo: wasGoalToGo, // Preserve pre-play goal-to-go status
        isRedZone: this.isRedZone(startPosition, possession), // Pre-play red zone status
        driveEnds: true,
        driveResult: this.determineTurnoverType(playData)
      };
    }
    
    // Determine final position after penalties
    let finalPosition = endPosition;
    if (hasAcceptedPenalty && penaltyData) {
      finalPosition = this.applyPenaltyEnforcement(endPosition, penaltyData, possession);
    }
    
    // Check for first down (play result, penalty, or yards gained)
    const yardsGained = this.calculateNetYards(startPosition, finalPosition, possession);
    const yardsNeededForFirstDown = this.calculateYardsToGain(startPosition, currentLineToGain, possession);
    const achievedFirstDownByYardage = yardsGained >= yardsNeededForFirstDown;
    
    const hasFirstDown = isFirstDown || achievedFirstDownByYardage || (penaltyData && penaltyData.automaticFirstDown);
    
    if (hasFirstDown) {
      // First down achieved - reset to 1st and 10
      const newLineToGain = this.calculateNewLineToGain(finalPosition, possession);
      const newDistance = this.calculateYardsToGain(finalPosition, newLineToGain, possession);
      
      return {
        postDown: 1,
        postDistance: newDistance,
        postYardLine: finalPosition,
        lineToGain: newLineToGain,
        isGoalToGo: this.isGoalToGo(finalPosition, newLineToGain, possession),
        isRedZone: this.isRedZone(finalPosition, possession),
        driveEnds: false
      };
    }
    
    // No first down - increment down
    const newDown = currentDown + 1;
    
    // Check for turnover on downs
    if (newDown > 4) {
      // Calculate goal-to-go status based on pre-play state
      const wasGoalToGo = this.isGoalToGo(startPosition, currentLineToGain, possession);
      
      return {
        postDown: null, // Drive ends
        postDistance: null,
        postYardLine: finalPosition,
        lineToGain: null,
        isGoalToGo: wasGoalToGo, // Preserve pre-play goal-to-go status
        isRedZone: this.isRedZone(startPosition, possession), // Pre-play red zone status
        driveEnds: true,
        driveResult: 'TURNOVER_ON_DOWNS'
      };
    }
    
    // Continue drive with same LineToGain
    const newDistance = this.calculateYardsToGain(finalPosition, currentLineToGain, possession);
    
    return {
      postDown: newDown,
      postDistance: newDistance,
      postYardLine: finalPosition,
      lineToGain: currentLineToGain, // Unchanged
      isGoalToGo: this.isGoalToGo(finalPosition, currentLineToGain, possession),
      isRedZone: this.isRedZone(finalPosition, possession),
      driveEnds: false
    };
  }
  
  /**
   * Determine turnover type based on play data
   */
  static determineTurnoverType(playData) {
    if (playData.playType === 'punt') return 'PUNT';
    if (playData.playResult === 'INTERCEPTION') return 'INTERCEPTION';
    if (playData.playType === 'pass' && playData.isTurnover) return 'INTERCEPTION';
    if (playData.hasFumble && playData.recoveringTeam !== playData.possession) return 'FUMBLE';
    return 'TURNOVER_ON_DOWNS';
  }
  
  /**
   * Apply penalty enforcement to determine final position
   */
  static applyPenaltyEnforcement(playEndPosition, penaltyData, possession) {
    // This would integrate with the penalty enforcement logic
    // For now, return the play end position
    return playEndPosition;
  }
}

// Legacy export functions for backward compatibility
export function calculateNextDownDistance(currentState, playResult) {
  const gameState = {
    YardLinePosition: currentState.yardLine,
    CurrentDown: currentState.down,
    LineToGain: currentState.lineToGain,
    Possession: currentState.possession
  };
  
  const playData = {
    finalYardLine: playResult.endYardLine,
    isFirstDown: playResult.isFirstDown,
    isTouchdown: playResult.isTouchdown,
    isTurnover: playResult.isTurnover,
    isSafety: playResult.isSafety,
    playType: playResult.playType
  };
  
  return DownDistanceCalculator.calculatePostPlayState(playData, gameState);
}

export function applyPenaltyToDownDistance(currentState, penaltyData) {
  // Implement penalty logic using new calculator
  return currentState; // Placeholder
}

export function shouldEndDrive(gameState, playResult) {
  const { isTouchdown, isSafety, isTurnover, playType } = playResult;
  return isTouchdown || isSafety || isTurnover || playType === 'punt';
}

export function formatGameTime(timeInput) {
  const cleaned = timeInput.replace(/[^0-9:]/g, '');
  
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      const minutes = parts[0].padStart(2, '0');
      const seconds = parts[1].padStart(2, '0');
      return `${minutes}:${seconds}`;
    }
  }
  
  const digits = cleaned.padStart(4, '0');
  const minutes = digits.slice(0, -2);
  const seconds = digits.slice(-2);
  
  return `${minutes}:${seconds}`;
}

export async function promptForGameTime(context = 'drive start/end') {
  return new Promise((resolve) => {
    const timeInput = prompt(`Enter game time for ${context} (MMSS or MM:SS format):`);
    if (timeInput) {
      resolve(formatGameTime(timeInput));
    } else {
      resolve('15:00');
    }
  });
}

export default DownDistanceCalculator;
export const toPossessionRelative = DownDistanceCalculator.toPossessionRelative;
