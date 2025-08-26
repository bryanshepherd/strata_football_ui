import { describe, it, expect } from 'vitest';
import { DataTransformer } from '../src/utils/apiDataContract';

describe('DataTransformer', () => {
  describe('Clock conversion utilities', () => {
    it('should convert MM:SS to seconds', () => {
      expect(DataTransformer.clockToSeconds('15:00')).toBe(900);
      expect(DataTransformer.clockToSeconds('12:34')).toBe(754);
      expect(DataTransformer.clockToSeconds('0:30')).toBe(30);
    });

    it('should convert seconds to MM:SS', () => {
      expect(DataTransformer.secondsToClock(900)).toBe('15:00');
      expect(DataTransformer.secondsToClock(754)).toBe('12:34');
      expect(DataTransformer.secondsToClock(30)).toBe('0:30');
    });

    it('should handle invalid clock values', () => {
      expect(DataTransformer.clockToSeconds('')).toBe(900);
      expect(DataTransformer.clockToSeconds('invalid')).toBe(900);
      expect(DataTransformer.secondsToClock(NaN)).toBe('15:00');
    });
  });

  describe('Possession conversion utilities', () => {
    it('should convert frontend possession to backend', () => {
      expect(DataTransformer.possessionToBackend('home')).toBe('H');
      expect(DataTransformer.possessionToBackend('visitor')).toBe('V');
      expect(DataTransformer.possessionToBackend('away')).toBe('V');
      expect(DataTransformer.possessionToBackend('H')).toBe('H');
      expect(DataTransformer.possessionToBackend('V')).toBe('V');
    });

    it('should convert backend possession to frontend', () => {
      expect(DataTransformer.possessionToFrontend('H')).toBe('home');
      expect(DataTransformer.possessionToFrontend('V')).toBe('visitor');
      expect(DataTransformer.possessionToFrontend('home')).toBe('home');
      expect(DataTransformer.possessionToFrontend('visitor')).toBe('visitor');
    });

    it('should handle invalid possession values', () => {
      expect(DataTransformer.possessionToBackend('')).toBe('H');
      expect(DataTransformer.possessionToBackend('invalid')).toBe('H');
      expect(DataTransformer.possessionToFrontend('')).toBe('home');
    });
  });

  describe('Frontend to Backend transformation', () => {
    it('should transform play data correctly', () => {
      const frontendData = {
        playType: 'rush',
        primaryPlayerID: 123,
        yardsGained: 5,
        endYardLine: 'H35',
        isTouchdown: false,
        isFirstDown: true
      };

      const result = DataTransformer.frontendToBackend(frontendData);

      expect(result.play_type).toBe('rush');
      expect(result.primary_player_id).toBe(123);
      expect(result.yards).toBe(5);
      expect(result.post_yard_line).toBe('H35');
      expect(result.is_touchdown).toBe(false);
      expect(result.is_first_down).toBe(true);
    });

    it('should transform game state correctly', () => {
      const frontendData = {
        quarter: 2,
        clock: '12:34',
        possession: 'home',
        yardsToGo: 7,
        yardLinePosition: 'V42'
      };

      const result = DataTransformer.frontendToBackend(frontendData);

      expect(result.period).toBe(2);
      expect(result.time_remaining).toBe(754); // 12:34 in seconds
      expect(result.possession).toBe('H');
      expect(result.distance).toBe(7);
      expect(result.yard_line).toBe('V42');
    });
  });

  describe('Backend to Frontend transformation', () => {
    it('should transform play data correctly', () => {
      const backendData = {
        play_type: 'pass',
        primary_player_id: 456,
        yards: 12,
        post_yard_line: 'V20',
        is_touchdown: true,
        is_first_down: true
      };

      const result = DataTransformer.backendToFrontend(backendData);

      expect(result.playType).toBe('pass');
      expect(result.primaryPlayerID).toBe(456);
      expect(result.yardsGained).toBe(12);
      expect(result.endYardLine).toBe('V20');
      expect(result.isTouchdown).toBe(true);
      expect(result.isFirstDown).toBe(true);
    });

    it('should transform game state correctly', () => {
      const backendData = {
        period: 3,
        time_remaining: 450, // 7:30
        possession: 'V',
        distance: 3,
        yard_line: 'H15'
      };

      const result = DataTransformer.backendToFrontend(backendData);

      expect(result.quarter).toBe(3);
      expect(result.clock).toBe('7:30');
      expect(result.possession).toBe('visitor');
      expect(result.yardsToGo).toBe(3);
      expect(result.yardLinePosition).toBe('H15');
    });
  });

  describe('Bidirectional transformation consistency', () => {
    it('should preserve data through frontend->backend->frontend', () => {
      const originalData = {
        playType: 'punt',
        primaryPlayerID: 789,
        yardsGained: -2,
        quarter: 4,
        clock: '5:47',
        possession: 'visitor',
        isTouchdown: false,
        isFirstDown: false
      };

      const backendData = DataTransformer.frontendToBackend(originalData);
      const restoredData = DataTransformer.backendToFrontend(backendData);

      expect(restoredData.playType).toBe(originalData.playType);
      expect(restoredData.primaryPlayerID).toBe(originalData.primaryPlayerID);
      expect(restoredData.yardsGained).toBe(originalData.yardsGained);
      expect(restoredData.quarter).toBe(originalData.quarter);
      expect(restoredData.clock).toBe(originalData.clock);
      expect(restoredData.possession).toBe(originalData.possession);
      expect(restoredData.isTouchdown).toBe(originalData.isTouchdown);
      expect(restoredData.isFirstDown).toBe(originalData.isFirstDown);
    });

    it('should preserve data through backend->frontend->backend', () => {
      const originalData = {
        play_type: 'kick',
        primary_player_id: 321,
        yards: 45,
        period: 1,
        time_remaining: 200, // 3:20
        possession: 'H',
        is_touchdown: false,
        is_first_down: false
      };

      const frontendData = DataTransformer.backendToFrontend(originalData);
      const restoredData = DataTransformer.frontendToBackend(frontendData);

      expect(restoredData.play_type).toBe(originalData.play_type);
      expect(restoredData.primary_player_id).toBe(originalData.primary_player_id);
      expect(restoredData.yards).toBe(originalData.yards);
      expect(restoredData.period).toBe(originalData.period);
      expect(restoredData.time_remaining).toBe(originalData.time_remaining);
      expect(restoredData.possession).toBe(originalData.possession);
      expect(restoredData.is_touchdown).toBe(originalData.is_touchdown);
      expect(restoredData.is_first_down).toBe(originalData.is_first_down);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undefined values gracefully', () => {
      const result = DataTransformer.frontendToBackend({});
      
      // Should not contain undefined values
      Object.values(result).forEach(value => {
        expect(value).not.toBe(undefined);
      });
    });

    it('should handle mixed field naming conventions', () => {
      const mixedData = {
        // Frontend naming
        playType: 'rush',
        primaryPlayerID: 123,
        yardsGained: 8,
        isFirstDown: true
      };

      const result = DataTransformer.frontendToBackend(mixedData);
      
      expect(result.play_type).toBe('rush');
      expect(result.primary_player_id).toBe(123);
      expect(result.yards).toBe(8);
      expect(result.is_first_down).toBe(true);
    });
  });

  describe('Mixed field handling with backend precedence', () => {
    it('handles mixed FE/BE fields with BE precedence', () => {
      const mixed = {
        // FE fields
        quarter: 2,
        clock: '12:34',
        yardsGained: 8,
        isFirstDown: true,
        possession: 'home',
        primaryPlayerID: 123,
        // BE fields present (should take precedence where overlapping)
        period: 3,
        time_remaining: 754, // 12:34
        yards: 9,
        is_first_down: false
      };

      const be = DataTransformer.frontendToBackend(mixed);
      // precedence checks
      expect(be.period).toBe(3);
      expect(be.time_remaining).toBe(754);
      expect(be.yards).toBe(9);
      expect(be.is_first_down).toBe(false);
      // non-overlapping FE fields still mapped
      expect(be.possession).toBe('H');
      expect(be.primary_player_id).toBe(123);
    });

    it('maps back to FE with proper shapes', () => {
      const fe = DataTransformer.backendToFrontend({ 
        period: 4, 
        time_remaining: 90, 
        yards: 5, 
        is_first_down: true, 
        possession: 'V', 
        primary_player_id: 7 
      });
      expect(fe.quarter).toBe(4);
      expect(fe.clock).toBe('1:30');
      expect(fe.yardsGained).toBe(5);
      expect(fe.isFirstDown).toBe(true);
      expect(fe.possession).toBe('visitor');
      expect(fe.primaryPlayerID).toBe(7);
    });
  });
});