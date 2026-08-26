import { describe, expect, it } from 'vitest';
import {
  classifyPlayEdit,
  getDirectResultCodeOptions,
  isTurnoverPlay,
  normalizePlayResultCode,
} from './footballPlayEditPolicy';

const play = (code, overrides = {}) => ({
  type: 'rush',
  subtype: null,
  result: { code },
  ...overrides,
});

describe('footballPlayEditPolicy', () => {
  it('normalizes canonical and display result-code variants', () => {
    expect(normalizePlayResultCode('OUT_OF_BOUNDS')).toBe('outofbounds');
    expect(normalizePlayResultCode('endOfPlay')).toBe('endofplay');
  });

  it('allows Tackle and Out of Bounds to be exchanged directly', () => {
    expect(classifyPlayEdit(play('tackle'), play('outOfBounds')).mode).toBe('update');
    expect(classifyPlayEdit(play('outOfBounds'), play('tackle')).mode).toBe('update');
  });

  it('allows a non-turnover result to become End of Play directly', () => {
    expect(classifyPlayEdit(play('touchdown'), play('endOfPlay')).mode).toBe('update');
  });

  it('requires replacement for other result-code changes', () => {
    const decision = classifyPlayEdit(play('outOfBounds'), play('fumble'));
    expect(decision.mode).toBe('replace');
    expect(decision.reasons).toContain('This result-code change requires replacing the play.');
  });

  it('does not allow a turnover to become End of Play through a direct edit', () => {
    const interception = play('interception', {
      type: 'pass',
      subtype: 'interception',
      result: {
        code: 'interception',
        turnover: { type: 'interception', team: 'H' },
      },
    });
    const edited = {
      ...interception,
      result: { ...interception.result, code: 'endOfPlay' },
    };

    expect(isTurnoverPlay(interception)).toBe(true);
    expect(classifyPlayEdit(interception, edited).mode).toBe('replace');
  });

  it('requires replacement when the play family changes', () => {
    expect(classifyPlayEdit(play('tackle'), play('tackle', { type: 'pass' })).mode).toBe('replace');
  });

  it('requires replacement when penalty presence changes', () => {
    const original = play('tackle', { penalties: [] });
    const edited = play('tackle', { penalties: [{ code: 'HOLD' }] });

    expect(classifyPlayEdit(original, edited)).toMatchObject({
      mode: 'replace',
      reasons: ['Adding or removing a penalty requires replacing the play.'],
    });
  });

  it('returns only result codes permitted for direct editing', () => {
    expect(getDirectResultCodeOptions(play('outOfBounds'))).toEqual([
      'outOfBounds',
      'tackle',
      'endOfPlay',
    ]);

    const interception = play('interception', {
      type: 'pass',
      subtype: 'interception',
      result: { code: 'interception', turnover: { type: 'interception' } },
    });
    expect(getDirectResultCodeOptions(interception)).toEqual(['interception']);
  });
});
