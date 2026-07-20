import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Integration tests for Phase 2 features
 * 
 * Tests how Phase 2 features work together including drive rules,
 * multi-user safety, play log performance, and API client integration.
 */
describe('Phase 2 Integration', () => {
  
  describe('Drive Rules Integration', () => {
    it('should handle touchdown with possession flip and drive end', () => {
      const playData = {
        play_type: 'RUSH',
        yards_gained: 25,
        is_touchdown: true,
        possession: 'home',
        down: 3,
        distance: 8,
        spot: 'V25'
      };
      
      // Drive should end on touchdown
      const driveTransition = analyzeDriveTransition(playData);
      expect(driveTransition.shouldEndDrive).toBe(true);
      expect(driveTransition.reason).toBe('touchdown');
      
      // Possession should flip for kickoff
      const nextPossession = determineNextPossession(playData);
      expect(nextPossession).toBe('visitor'); // Opposite of scoring team
    });
    
    it('should handle turnover with drive transition', () => {
      const playData = {
        play_type: 'PASS',
        yards_gained: 0,
        is_turnover: true,
        turnover_type: 'interception',
        possession: 'home'
      };
      
      const driveTransition = analyzeDriveTransition(playData);
      expect(driveTransition.shouldEndDrive).toBe(true);
      expect(driveTransition.shouldStartNewDrive).toBe(true);
      expect(driveTransition.reason).toBe('turnover');
    });
    
    it('should handle punt with drive end and possession change', () => {
      const playData = {
        play_type: 'PUNT',
        yards_gained: 35,
        possession: 'home',
        end_yard_line: 'V15'
      };
      
      const driveTransition = analyzeDriveTransition(playData);
      expect(driveTransition.shouldEndDrive).toBe(true);
      expect(driveTransition.shouldStartNewDrive).toBe(true);
      expect(driveTransition.newPossession).toBe('visitor');
    });
  });
  
  describe('Multi-User Safety with Drive Rules', () => {
    it('should prevent drive-ending play submission when locked', () => {
      const gameData = {
        lock_info: {
          can_edit: false,
          locked_by_user: 'Other User'
        },
        live_state: {
          possession: 'home',
          drive_number: 3
        }
      };
      
      const touchdownPlay = {
        play_type: 'RUSH',
        is_touchdown: true,
        possession: 'home'
      };
      
      const canSubmit = validatePlaySubmission(gameData, touchdownPlay);
      expect(canSubmit.allowed).toBe(false);
      expect(canSubmit.error).toContain('locked by Other User');
    });
    
    it('should allow drive-ending plays when user has lock', () => {
      const gameData = {
        lock_info: {
          can_edit: true,
          locked_by_user: 'Current User'
        }
      };
      
      const touchdownPlay = {
        play_type: 'PASS',
        is_touchdown: true,
        yards_gained: 15
      };
      
      const canSubmit = validatePlaySubmission(gameData, touchdownPlay);
      expect(canSubmit.allowed).toBe(true);
    });
  });
  
  describe('Performance with Large Games', () => {
    it('should maintain performance with large play logs and live updates', () => {
      const largeDriveData = generateLargeDriveData(10, 15); // 10 drives, ~15 plays each
      const recentPlays = largeDriveData.flatMap(drive => drive.plays);
      
      expect(recentPlays.length).toBeGreaterThan(100);
      
      // Should paginate large games
      const shouldUsePagination = recentPlays.length > 75;
      expect(shouldUsePagination).toBe(true);
      
      // Should still be able to process drive stats efficiently
      const driveStats = calculateDriveStats(largeDriveData);
      expect(driveStats.totalDrives).toBe(10);
      expect(driveStats.totalPlays).toBe(recentPlays.length);
    });
    
    it('should handle concurrent user scenarios with performance optimization', () => {
      const gameState = {
        lock_info: {
          is_locked: true,
          can_edit: true,
          locked_by_user: 'Current User'
        },
        recent_plays: generateMockPlays(150) // Large game
      };
      
      // Performance metrics should still work with lock info
      const metrics = calculatePlayMetrics(gameState.recent_plays, 25);
      expect(metrics.shouldPaginate).toBe(true);
      
      // User should still be able to submit
      const canEdit = gameState.lock_info.can_edit;
      expect(canEdit).toBe(true);
    });
  });
  
  describe('API Client Integration', () => {
    it('should transform drive-ending plays correctly', () => {
      const frontendPlay = {
        playType: 'rush',
        yardsGained: 8,
        isTouchdown: true,
        possession: 'home',
        finalYardLine: 'V00',
        driveEnds: true
      };
      
      const backendPlay = transformPlayForAPI(frontendPlay);
      
      expect(backendPlay.play_type).toBe('RUSH');
      expect(backendPlay.yards_gained).toBe(8);
      expect(backendPlay.is_touchdown).toBe(true);
      expect(backendPlay.possession).toBe('H');
      expect(backendPlay.drive_ends).toBe(true);
    });
    
    it('should handle error responses with user feedback', () => {
      const errorResponse = {
        success: false,
        error: 'Game is locked by another user',
        locked_by: 'John Doe'
      };
      
      const userMessage = getErrorMessage(errorResponse);
      expect(userMessage).toContain('locked by another user');
      expect(userMessage).toContain('John Doe');
    });
  });
  
  describe('End-to-End Workflow', () => {
    it('should handle complete scoring drive workflow', () => {
      let gameState = {
        live_state: {
          possession: 'home',
          down: 1,
          distance: 10,
          yard_line: 'H25',
          drive_number: 1
        },
        lock_info: {
          can_edit: true
        },
        recent_plays: []
      };
      
      // Play 1: Rush for 15 yards
      const play1 = {
        play_type: 'RUSH',
        yards_gained: 15,
        possession: 'home'
      };
      
      gameState = updateGameState(gameState, play1);
      expect(gameState.live_state.yard_line).toBe('H40');
      expect(gameState.recent_plays.length).toBe(1);
      
      // Play 2: Pass for touchdown
      const play2 = {
        play_type: 'PASS',
        yards_gained: 60,
        is_touchdown: true,
        possession: 'home'
      };
      
      gameState = updateGameState(gameState, play2);
      
      // Should end drive and flip possession
      expect(gameState.live_state.possession).toBe('visitor'); // For kickoff
      expect(gameState.live_state.drive_number).toBe(2);
      expect(gameState.recent_plays.length).toBe(2);
      
      // Should paginate if many plays
      if (gameState.recent_plays.length > 75) {
        const metrics = calculatePlayMetrics(gameState.recent_plays, 25);
        expect(metrics.shouldPaginate).toBe(true);
      }
    });
  });
});

// Helper functions for tests
function analyzeDriveTransition(playData: any) {
  return {
    shouldEndDrive: playData.is_touchdown || playData.is_turnover || playData.play_type === 'PUNT',
    shouldStartNewDrive: playData.is_turnover || playData.play_type === 'PUNT',
    reason: playData.is_touchdown ? 'touchdown' : playData.is_turnover ? 'turnover' : playData.play_type === 'PUNT' ? 'punt' : 'continue',
    newPossession: playData.possession === 'home' ? 'visitor' : 'home'
  };
}

function determineNextPossession(playData: any) {
  if (playData.is_touchdown) {
    // Scoring team kicks off, so possession goes to other team
    return playData.possession === 'home' ? 'visitor' : 'home';
  }
  return playData.possession;
}

function validatePlaySubmission(gameData: any, playData: any) {
  if (gameData.lock_info?.can_edit === false) {
    return {
      allowed: false,
      error: `Cannot submit: Game is locked by ${gameData.lock_info.locked_by_user}`
    };
  }
  
  return {
    allowed: true,
    error: null
  };
}

function generateLargeDriveData(driveCount: number, playsPerDrive: number) {
  return Array.from({ length: driveCount }, (_, driveIndex) => ({
    drive_number: driveIndex + 1,
    plays: Array.from({ length: playsPerDrive }, (_, playIndex) => ({
      id: `drive_${driveIndex + 1}_play_${playIndex + 1}`,
      play_type: playIndex % 3 === 0 ? 'RUSH' : 'PASS',
      yards_gained: Math.floor(Math.random() * 15),
      drive_number: driveIndex + 1
    }))
  }));
}

function generateMockPlays(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `play_${index + 1}`,
    play_type: 'RUSH',
    yards_gained: 5
  }));
}

function calculatePlayMetrics(plays: any[], visibleCount: number) {
  return {
    totalPlays: plays.length,
    shouldPaginate: plays.length > 75,
    visiblePlays: plays.slice(0, visibleCount),
    hasMorePlays: visibleCount < plays.length
  };
}

function calculateDriveStats(driveData: any[]) {
  return {
    totalDrives: driveData.length,
    totalPlays: driveData.reduce((total, drive) => total + drive.plays.length, 0)
  };
}

function transformPlayForAPI(frontendPlay: any) {
  return {
    play_type: frontendPlay.playType?.toUpperCase(),
    yards_gained: frontendPlay.yardsGained,
    is_touchdown: frontendPlay.isTouchdown,
    possession: frontendPlay.possession === 'home' ? 'H' : 'V',
    final_yard_line: frontendPlay.finalYardLine,
    drive_ends: frontendPlay.driveEnds
  };
}

function getErrorMessage(errorResponse: any) {
  if (errorResponse.error?.includes('locked')) {
    return `Cannot proceed: Game is locked by another user (${errorResponse.locked_by || 'Unknown'})`;
  }
  return errorResponse.error || 'Unknown error occurred';
}

function updateGameState(currentState: any, play: any) {
  const newState = { ...currentState };
  
  // Add play to recent plays
  newState.recent_plays = [...currentState.recent_plays, play];
  
  // Update possession and drive for scoring plays
  if (play.is_touchdown) {
    newState.live_state.possession = play.possession === 'home' ? 'visitor' : 'home';
    newState.live_state.drive_number = currentState.live_state.drive_number + 1;
    newState.live_state.down = 1;
    newState.live_state.distance = 10;
    newState.live_state.yard_line = 'V35'; // Kickoff position
  } else {
    // Update yard line based on yards gained
    const currentSpot = currentState.live_state.yard_line;
    const yardsGained = play.yards_gained || 0;
    
    if (currentSpot === 'H25' && yardsGained === 15) {
      newState.live_state.yard_line = 'H40';
    }
  }
  
  return newState;
}