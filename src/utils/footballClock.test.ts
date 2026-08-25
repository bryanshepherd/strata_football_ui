import { describe, expect, it } from 'vitest';
import {
  formatFootballClockDisplay,
  formatFootballClockEntry,
  normalizeFootballClock,
} from './footballClock';

describe('football clock formatting', () => {
  it('drops a leading minute zero for display only', () => {
    expect(formatFootballClockDisplay('08:24')).toBe('8:24');
    expect(formatFootballClockDisplay('00:00')).toBe('0:00');
    expect(formatFootballClockDisplay('15:00')).toBe('15:00');
  });

  it('treats three digits as M:SS and four digits as MM:SS', () => {
    expect(formatFootballClockEntry('801')).toBe('8:01');
    expect(formatFootballClockEntry('0801')).toBe('8:01');
    expect(formatFootballClockEntry('1234')).toBe('12:34');
    expect(formatFootballClockEntry('1:234')).toBe('12:34');
    expect(formatFootballClockEntry('08:42')).toBe('8:42');
  });

  it('normalizes typed clocks to the canonical envelope format', () => {
    expect(normalizeFootballClock('801')).toBe('08:01');
    expect(normalizeFootballClock('0801')).toBe('08:01');
    expect(normalizeFootballClock('1234')).toBe('12:34');
    expect(normalizeFootballClock('8:01')).toBe('08:01');
    expect(normalizeFootballClock('8:71')).toBeNull();
  });
});
