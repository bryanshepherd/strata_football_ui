/**
 * Drive Rules & Invariants for Football Game State
 * 
 * This module handles the logic for when drives should start/end
 * and maintains drive-related game state consistency.
 */

import debug from './debug.js';

/**
 * Determine if a new drive should start based on the play result
 * @param {object} prevState - Previous game state
 * @param {object} play - Current play data
 * @returns {boolean} - True if a new drive should start
 */
export function shouldStartNewDrive(prevState, play) {
  // Start on possession changes
  if (play.possession_changed === true) {
    debug.log('[DRIVE RULES] New drive: possession changed');
    return true;
  }
  
  // Start on kickoffs (beginning of game, after scores)
  if (play.is_kickoff || play.play_type === 'kick' && play.sub_type === 'kickoff') {
    debug.log('[DRIVE RULES] New drive: kickoff');
    return true;
  }
  
  // Start on turnovers (interceptions, fumbles)
  if (play.is_turnover) {
    debug.log('[DRIVE RULES] New drive: turnover');
    return true;
  }
  
  // Start after punts (change of possession)
  if (play.play_type === 'punt' && !play.is_blocked) {
    debug.log('[DRIVE RULES] New drive: punt');
    return true;
  }
  
  // Start after failed 4th down conversion (implied turnover on downs)
  if (prevState.down === 4 && play.post_down === 1 && play.possession !== prevState.possession) {
    debug.log('[DRIVE RULES] New drive: turnover on downs');
    return true;
  }
  
  return false;
}

/**
 * Determine if the current drive should end based on the play result
 * @param {object} play - Current play data
 * @param {object} gameState - Current game state
 * @returns {boolean} - True if the drive should end
 */
export function shouldEndDrive(play, gameState) {
  // End on touchdowns
  if (play.is_touchdown) {
    debug.log('[DRIVE RULES] End drive: touchdown');
    return true;
  }
  
  // End on safeties
  if (play.is_safety) {
    debug.log('[DRIVE RULES] End drive: safety');
    return true;
  }
  
  // End on turnovers
  if (play.is_turnover) {
    debug.log('[DRIVE RULES] End drive: turnover');
    return true;
  }
  
  // End on punts
  if (play.play_type === 'punt' && !play.is_blocked) {
    debug.log('[DRIVE RULES] End drive: punt');
    return true;
  }
  
  // End on failed 4th down attempts (turnover on downs)
  if (gameState.down === 4 && play.post_down === 1 && play.possession !== gameState.possession) {
    debug.log('[DRIVE RULES] End drive: failed 4th down');
    return true;
  }
  
  // End on field goal attempts (regardless of result)
  if (play.play_type === 'kick' && (play.sub_type === 'field_goal' || play.sub_type === 'extra_point')) {
    debug.log('[DRIVE RULES] End drive: field goal attempt');
    return true;
  }
  
  return false;
}

/**
 * Calculate drive statistics from a series of plays
 * @param {Array} plays - Array of play objects in the drive
 * @returns {object} - Drive statistics
 */
export function calculateDriveStats(plays) {
  if (!plays || plays.length === 0) {
    return {
      play_count: 0,
      total_yards: 0,
      time_of_possession: 0,
      first_downs: 0,
      penalties: 0,
      penalty_yards: 0,
      result: 'incomplete'
    };
  }
  
  let totalYards = 0;
  let firstDowns = 0;
  let penalties = 0;
  let penaltyYards = 0;
  let timeOfPossession = 0;
  
  plays.forEach(play => {
    // Add yards gained (handle negative yards)
    totalYards += play.yards_gained || 0;
    
    // Count first downs
    if (play.is_first_down) {
      firstDowns++;
    }
    
    // Count penalties
    if (play.penalties && play.penalties.length > 0) {
      penalties += play.penalties.length;
      penaltyYards += play.penalties.reduce((sum, penalty) => 
        sum + (penalty.yards || 0), 0);
    }
    
    // Estimate time of possession (simplified)
    if (play.play_type === 'rush' || play.play_type === 'pass') {
      timeOfPossession += 25; // Average seconds per play
    }
  });
  
  // Determine drive result
  const lastPlay = plays[plays.length - 1];
  let result = 'incomplete';
  
  if (lastPlay.is_touchdown) {
    result = 'touchdown';
  } else if (lastPlay.is_safety) {
    result = 'safety';
  } else if (lastPlay.play_type === 'kick' && lastPlay.sub_type === 'field_goal') {
    result = lastPlay.is_good ? 'field_goal' : 'missed_fg';
  } else if (lastPlay.is_turnover) {
    result = 'turnover';
  } else if (lastPlay.play_type === 'punt') {
    result = 'punt';
  } else if (lastPlay.post_down === 1 && plays.length > 1) {
    // Check if this was a turnover on downs
    const previousPlay = plays[plays.length - 2];
    if (previousPlay && previousPlay.down === 4) {
      result = 'turnover_on_downs';
    }
  }
  
  return {
    play_count: plays.length,
    total_yards: totalYards,
    time_of_possession: timeOfPossession,
    first_downs: firstDowns,
    penalties: penalties,
    penalty_yards: penaltyYards,
    result: result
  };
}

/**
 * Handle special cases for drive rules
 * @param {object} play - Play data
 * @param {object} gameState - Current game state
 * @returns {object} - Drive rule decisions and notes
 */
export function analyzeDriveTransition(play, gameState) {
  const analysis = {
    shouldStartNew: false,
    shouldEndCurrent: false,
    notes: [],
    driveResult: null
  };
  
  // Handle onside kicks (keep possession, don't start new drive)
  if (play.play_type === 'kick' && play.sub_type === 'onside_kick') {
    if (play.is_recovered_by_kicking_team) {
      analysis.notes.push('Onside kick recovered - possession retained');
      analysis.shouldStartNew = false;
      analysis.shouldEndCurrent = false;
    } else {
      analysis.notes.push('Onside kick failed - change of possession');
      analysis.shouldStartNew = true;
      analysis.shouldEndCurrent = true;
    }
    return analysis;
  }
  
  // Handle penalty-only plays (no drive change unless specifically noted)
  if (play.play_type === 'penalty' && !play.is_turnover) {
    analysis.notes.push('Penalty-only play - drive continues');
    return analysis;
  }
  
  // Handle blocked punts/kicks (special possession rules)
  if (play.is_blocked) {
    if (play.is_recovered_by_kicking_team) {
      analysis.notes.push('Blocked kick recovered by kicking team - drive continues');
    } else {
      analysis.notes.push('Blocked kick recovered by defense - change of possession');
      analysis.shouldStartNew = true;
      analysis.shouldEndCurrent = true;
    }
    return analysis;
  }
  
  // Standard drive rule evaluation
  analysis.shouldStartNew = shouldStartNewDrive(gameState, play);
  analysis.shouldEndCurrent = shouldEndDrive(play, gameState);
  
  // Determine drive result for statistics
  if (analysis.shouldEndCurrent) {
    if (play.is_touchdown) {
      analysis.driveResult = 'touchdown';
    } else if (play.is_safety) {
      analysis.driveResult = 'safety';
    } else if (play.is_turnover) {
      analysis.driveResult = 'turnover';
    } else if (play.play_type === 'punt') {
      analysis.driveResult = 'punt';
    } else if (play.play_type === 'kick') {
      analysis.driveResult = play.is_good ? 'field_goal' : 'missed_fg';
    }
  }
  
  return analysis;
}

/**
 * Validate drive consistency (for debugging/testing)
 * @param {object} drive - Drive data
 * @param {Array} plays - Plays in the drive
 * @returns {object} - Validation results
 */
export function validateDriveConsistency(drive, plays) {
  const validation = {
    valid: true,
    issues: []
  };
  
  // Check play count consistency
  if (drive.play_count !== plays.length) {
    validation.valid = false;
    validation.issues.push(`Play count mismatch: drive=${drive.play_count}, plays=${plays.length}`);
  }
  
  // Check possession consistency
  const possessions = [...new Set(plays.map(p => p.possession))];
  if (possessions.length > 1) {
    validation.valid = false;
    validation.issues.push(`Multiple possessions in single drive: ${possessions.join(', ')}`);
  }
  
  // Check yard line progression
  let currentYardLine = drive.starting_yard_line;
  plays.forEach((play, index) => {
    if (play.start_yard_line !== currentYardLine) {
      validation.issues.push(`Play ${index + 1}: yard line discontinuity ${currentYardLine} -> ${play.start_yard_line}`);
    }
    currentYardLine = play.end_yard_line;
  });
  
  return validation;
}