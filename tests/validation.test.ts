import { describe, it, expect } from 'vitest';
import { 
  validateYardLine, 
  normalizeYardLine, 
  validateJerseyNumber,
  validateClock,
  validateDown,
  validateDistance,
  validatePossession,
  normalizePossession,
  validatePlayType,
  validateField
} from '../src/utils/validation';

describe('Validation utilities', () => {
  describe('validateYardLine', () => {
    it('should validate correct yard line formats', () => {
      expect(validateYardLine('H25')).toBe(true);
      expect(validateYardLine('V03')).toBe(true);
      expect(validateYardLine('50')).toBe(true);
      expect(validateYardLine('H01')).toBe(true);
      expect(validateYardLine('V50')).toBe(true);
      expect(validateYardLine('H00')).toBe(true); // End zone
      expect(validateYardLine('V00')).toBe(true); // End zone
    });

    it('should reject invalid yard line formats', () => {
      expect(validateYardLine('H5')).toBe(false); // Not padded
      expect(validateYardLine('V')).toBe(false);  // No number
      expect(validateYardLine('51')).toBe(false); // Invalid number
      expect(validateYardLine('H51')).toBe(false);  // Out of range (01–50 only; 50 is midfield)
      expect(validateYardLine('')).toBe(false);    // Empty
      expect(validateYardLine(null)).toBe(false);  // Null
    });
  });

  describe('normalizeYardLine', () => {
    it('should normalize yard lines to consistent format', () => {
      expect(normalizeYardLine('h5')).toBe('H05');
      expect(normalizeYardLine('V7')).toBe('V07');
      expect(normalizeYardLine('50')).toBe('50');
      expect(normalizeYardLine('H25')).toBe('H25');
      expect(normalizeYardLine('v03')).toBe('V03');
    });

    it('should handle edge cases', () => {
      expect(normalizeYardLine('h0')).toBe('H00');
      expect(normalizeYardLine('V50')).toBe('V50');
      expect(normalizeYardLine(' H25 ')).toBe('H25'); // Trimmed
      expect(normalizeYardLine('v0')).toBe('V00'); // End zone normalization
    });

    it('should return original for invalid input', () => {
      expect(normalizeYardLine('invalid')).toBe('INVALID');
      expect(normalizeYardLine('H51')).toBe('H51'); // Out of range preserved
      expect(normalizeYardLine('')).toBe('');
    });
  });

  describe('validateJerseyNumber', () => {
    it('should validate correct jersey numbers', () => {
      expect(validateJerseyNumber('0')).toBe(true);
      expect(validateJerseyNumber('1')).toBe(true);
      expect(validateJerseyNumber('99')).toBe(true);
      expect(validateJerseyNumber('12')).toBe(true);
      expect(validateJerseyNumber(23)).toBe(true); // Number input
    });

    it('should reject invalid jersey numbers', () => {
      expect(validateJerseyNumber('100')).toBe(false); // Too high
      expect(validateJerseyNumber('-1')).toBe(false);  // Negative
      expect(validateJerseyNumber('abc')).toBe(false); // Non-numeric
      expect(validateJerseyNumber('')).toBe(false);    // Empty
      expect(validateJerseyNumber(null)).toBe(false);  // Null
    });
  });

  describe('validateClock', () => {
    it('should validate correct clock formats', () => {
      expect(validateClock('15:00')).toBe(true);
      expect(validateClock('0:30')).toBe(true);
      expect(validateClock('12:45')).toBe(true);
      expect(validateClock('5:59')).toBe(true);
    });

    it('should reject invalid clock formats', () => {
      expect(validateClock('25:00')).toBe(false); // Invalid minutes
      expect(validateClock('15:60')).toBe(false); // Invalid seconds
      expect(validateClock('15')).toBe(false);    // Missing seconds
      expect(validateClock('15:5')).toBe(false);  // Single digit seconds
      expect(validateClock('')).toBe(false);      // Empty
    });
  });

  describe('validateDown', () => {
    it('should validate correct downs', () => {
      expect(validateDown(1)).toBe(true);
      expect(validateDown(2)).toBe(true);
      expect(validateDown(3)).toBe(true);
      expect(validateDown(4)).toBe(true);
      expect(validateDown('3')).toBe(true); // String number
    });

    it('should reject invalid downs', () => {
      expect(validateDown(0)).toBe(false);
      expect(validateDown(5)).toBe(false);
      expect(validateDown(-1)).toBe(false);
      expect(validateDown('abc')).toBe(false);
    });
  });

  describe('validateDistance', () => {
    it('should validate correct distances', () => {
      expect(validateDistance(0)).toBe(true);
      expect(validateDistance(10)).toBe(true);
      expect(validateDistance(99)).toBe(true);
      expect(validateDistance('5')).toBe(true);
    });

    it('should reject invalid distances', () => {
      expect(validateDistance(-1)).toBe(false);
      expect(validateDistance(100)).toBe(false);
      expect(validateDistance('abc')).toBe(false);
    });
  });

  describe('validatePossession', () => {
    it('should validate correct possession values', () => {
      expect(validatePossession('home')).toBe(true);
      expect(validatePossession('visitor')).toBe(true);
      expect(validatePossession('H')).toBe(true);
      expect(validatePossession('V')).toBe(true);
      expect(validatePossession('HOME')).toBe(true); // Case insensitive
    });

    it('should reject invalid possession values', () => {
      expect(validatePossession('')).toBe(false);
      expect(validatePossession('invalid')).toBe(false);
      expect(validatePossession(null)).toBe(false);
    });
  });

  describe('normalizePossession', () => {
    it('should normalize possession to home/visitor', () => {
      expect(normalizePossession('H')).toBe('home');
      expect(normalizePossession('V')).toBe('visitor');
      expect(normalizePossession('home')).toBe('home');
      expect(normalizePossession('visitor')).toBe('visitor');
      expect(normalizePossession('away')).toBe('visitor');
      expect(normalizePossession('1')).toBe('home');
      expect(normalizePossession('2')).toBe('visitor');
    });

    it('should default to home for invalid input', () => {
      expect(normalizePossession('')).toBe('home');
      expect(normalizePossession('invalid')).toBe('home');
      expect(normalizePossession(null)).toBe('home');
    });
  });

  describe('validatePlayType', () => {
    it('should validate correct play types', () => {
      expect(validatePlayType('rush')).toBe(true);
      expect(validatePlayType('pass')).toBe(true);
      expect(validatePlayType('punt')).toBe(true);
      expect(validatePlayType('kick')).toBe(true);
      expect(validatePlayType('penalty')).toBe(true);
      expect(validatePlayType('timeout')).toBe(true);
      expect(validatePlayType('gamecontrol')).toBe(true);
    });

    it('should reject invalid play types', () => {
      expect(validatePlayType('invalid')).toBe(false);
      expect(validatePlayType('')).toBe(false);
      expect(validatePlayType(null)).toBe(false);
    });
  });

  describe('validateField', () => {
    it('should validate yard line fields', () => {
      const result = validateField('yardLine', 'H25');
      expect(result.valid).toBe(true);
    });

    it('should return error for invalid yard line', () => {
      const result = validateField('yardLine', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid format. Use H25, V03, or 50');
    });

    it('should validate jersey number fields', () => {
      const result = validateField('jerseyNumber', '23');
      expect(result.valid).toBe(true);
    });

    it('should return error for invalid jersey number', () => {
      const result = validateField('jerseyNumber', '100');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Jersey number must be 0-99');
    });

    it('should validate clock fields', () => {
      const result = validateField('clock', '12:30');
      expect(result.valid).toBe(true);
    });

    it('should pass unknown fields by default', () => {
      const result = validateField('unknownField', 'anything');
      expect(result.valid).toBe(true);
    });
  });
});