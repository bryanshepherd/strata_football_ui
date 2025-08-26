import { describe, it, expect } from 'vitest';
import {
  shouldStartNewDrive,
  shouldEndDrive,
  analyzeDriveTransition,
  calculateDriveStats,
  validateDriveConsistency
} from '../src/utils/driveRules';

describe('Drive Rules', () => {
  describe('shouldStartNewDrive', () => {
    it('should start new drive on possession change', () => {
      const prevState = { possession: 'home' };
      const play = { possession_changed: true };
      
      expect(shouldStartNewDrive(prevState, play)).toBe(true);
    });

    it('should start new drive on kickoff', () => {
      const prevState = {};
      const kickoffPlay = { is_kickoff: true };
      const kickPlay = { play_type: 'kick', sub_type: 'kickoff' };
      
      expect(shouldStartNewDrive(prevState, kickoffPlay)).toBe(true);
      expect(shouldStartNewDrive(prevState, kickPlay)).toBe(true);
    });

    it('should start new drive on turnover', () => {
      const prevState = {};
      const play = { is_turnover: true };
      
      expect(shouldStartNewDrive(prevState, play)).toBe(true);
    });

    it('should start new drive after punt', () => {
      const prevState = {};
      const play = { play_type: 'punt', is_blocked: false };
      
      expect(shouldStartNewDrive(prevState, play)).toBe(true);
    });

    it('should start new drive on turnover on downs', () => {
      const prevState = { down: 4, possession: 'home' };
      const play = { post_down: 1, possession: 'visitor' };
      
      expect(shouldStartNewDrive(prevState, play)).toBe(true);
    });

    it('should not start new drive on regular play', () => {
      const prevState = { possession: 'home' };
      const play = { play_type: 'rush', yards: 5 };
      
      expect(shouldStartNewDrive(prevState, play)).toBe(false);
    });
  });

  describe('shouldEndDrive', () => {
    it('should end drive on touchdown', () => {
      const play = { is_touchdown: true };
      const gameState = {};
      
      expect(shouldEndDrive(play, gameState)).toBe(true);
    });

    it('should end drive on safety', () => {
      const play = { is_safety: true };
      const gameState = {};
      
      expect(shouldEndDrive(play, gameState)).toBe(true);
    });

    it('should end drive on turnover', () => {
      const play = { is_turnover: true };
      const gameState = {};
      
      expect(shouldEndDrive(play, gameState)).toBe(true);
    });

    it('should end drive on punt', () => {
      const play = { play_type: 'punt', is_blocked: false };
      const gameState = {};
      
      expect(shouldEndDrive(play, gameState)).toBe(true);
    });

    it('should end drive on field goal attempt', () => {
      const fgPlay = { play_type: 'kick', sub_type: 'field_goal' };
      const epPlay = { play_type: 'kick', sub_type: 'extra_point' };
      const gameState = {};
      
      expect(shouldEndDrive(fgPlay, gameState)).toBe(true);
      expect(shouldEndDrive(epPlay, gameState)).toBe(true);
    });

    it('should end drive on failed 4th down', () => {
      const play = { post_down: 1, possession: 'visitor' };
      const gameState = { down: 4, possession: 'home' };
      
      expect(shouldEndDrive(play, gameState)).toBe(true);
    });

    it('should not end drive on regular play', () => {
      const play = { play_type: 'rush', yards: 5 };
      const gameState = { down: 2 };
      
      expect(shouldEndDrive(play, gameState)).toBe(false);
    });
  });

  describe('analyzeDriveTransition', () => {
    it('should handle onside kick recovery by kicking team', () => {
      const play = {
        play_type: 'kick',
        sub_type: 'onside_kick',
        is_recovered_by_kicking_team: true
      };
      const gameState = {};
      
      const result = analyzeDriveTransition(play, gameState);
      
      expect(result.shouldStartNew).toBe(false);
      expect(result.shouldEndCurrent).toBe(false);
      expect(result.notes[0]).toContain('possession retained');
    });

    it('should handle failed onside kick', () => {
      const play = {
        play_type: 'kick',
        sub_type: 'onside_kick',
        is_recovered_by_kicking_team: false
      };
      const gameState = {};
      
      const result = analyzeDriveTransition(play, gameState);
      
      expect(result.shouldStartNew).toBe(true);
      expect(result.shouldEndCurrent).toBe(true);
      expect(result.notes[0]).toContain('change of possession');
    });

    it('should handle penalty-only plays', () => {
      const play = {
        play_type: 'penalty',
        is_turnover: false
      };
      const gameState = {};
      
      const result = analyzeDriveTransition(play, gameState);
      
      expect(result.shouldStartNew).toBe(false);
      expect(result.shouldEndCurrent).toBe(false);
      expect(result.notes[0]).toContain('drive continues');
    });

    it('should handle blocked kicks recovered by kicking team', () => {
      const play = {
        is_blocked: true,
        is_recovered_by_kicking_team: true
      };
      const gameState = {};
      
      const result = analyzeDriveTransition(play, gameState);
      
      expect(result.shouldStartNew).toBe(false);
      expect(result.shouldEndCurrent).toBe(false);
      expect(result.notes[0]).toContain('drive continues');
    });

    it('should determine correct drive result', () => {
      const touchdownPlay = { is_touchdown: true };
      const gameState = {};
      
      const result = analyzeDriveTransition(touchdownPlay, gameState);
      
      expect(result.driveResult).toBe('touchdown');
    });
  });

  describe('calculateDriveStats', () => {
    it('should handle empty plays array', () => {
      const stats = calculateDriveStats([]);
      
      expect(stats.play_count).toBe(0);
      expect(stats.total_yards).toBe(0);
      expect(stats.first_downs).toBe(0);
      expect(stats.result).toBe('incomplete');
    });

    it('should calculate drive statistics correctly', () => {
      const plays = [
        {
          yards_gained: 5,
          is_first_down: true,
          play_type: 'rush',
          penalties: []
        },
        {
          yards_gained: 8,
          is_first_down: false,
          play_type: 'pass',
          penalties: [{ yards: 5 }]
        },
        {
          yards_gained: 2,
          is_first_down: false,
          play_type: 'rush',
          is_touchdown: true,
          penalties: []
        }
      ];
      
      const stats = calculateDriveStats(plays);
      
      expect(stats.play_count).toBe(3);
      expect(stats.total_yards).toBe(15);
      expect(stats.first_downs).toBe(1);
      expect(stats.penalties).toBe(1);
      expect(stats.penalty_yards).toBe(5);
      expect(stats.result).toBe('touchdown');
      expect(stats.time_of_possession).toBe(75); // 3 plays * 25 seconds
    });

    it('should determine correct drive results', () => {
      const touchdownDrive = [{ is_touchdown: true }];
      const puntDrive = [{ play_type: 'punt' }];
      const fieldGoalDrive = [{ play_type: 'kick', sub_type: 'field_goal', is_good: true }];
      const missedFgDrive = [{ play_type: 'kick', sub_type: 'field_goal', is_good: false }];
      const turnoverDrive = [{ is_turnover: true }];
      
      expect(calculateDriveStats(touchdownDrive).result).toBe('touchdown');
      expect(calculateDriveStats(puntDrive).result).toBe('punt');
      expect(calculateDriveStats(fieldGoalDrive).result).toBe('field_goal');
      expect(calculateDriveStats(missedFgDrive).result).toBe('missed_fg');
      expect(calculateDriveStats(turnoverDrive).result).toBe('turnover');
    });
  });

  describe('validateDriveConsistency', () => {
    it('should validate consistent drive', () => {
      const drive = { play_count: 2, starting_yard_line: 'H25' };
      const plays = [
        { start_yard_line: 'H25', end_yard_line: 'H30', possession: 'home' },
        { start_yard_line: 'H30', end_yard_line: 'H35', possession: 'home' }
      ];
      
      const validation = validateDriveConsistency(drive, plays);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect play count mismatch', () => {
      const drive = { play_count: 3 };
      const plays = [{ possession: 'home' }, { possession: 'home' }];
      
      const validation = validateDriveConsistency(drive, plays);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues[0]).toContain('Play count mismatch');
    });

    it('should detect possession inconsistency', () => {
      const drive = { play_count: 2 };
      const plays = [
        { possession: 'home' },
        { possession: 'visitor' }
      ];
      
      const validation = validateDriveConsistency(drive, plays);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues[0]).toContain('Multiple possessions');
    });

    it('should detect yard line discontinuity', () => {
      const drive = { play_count: 2, starting_yard_line: 'H25' };
      const plays = [
        { start_yard_line: 'H25', end_yard_line: 'H30', possession: 'home' },
        { start_yard_line: 'H35', end_yard_line: 'H40', possession: 'home' } // Should start at H30
      ];
      
      const validation = validateDriveConsistency(drive, plays);
      
      expect(validation.issues.some(issue => issue.includes('yard line discontinuity'))).toBe(true);
    });
  });
});