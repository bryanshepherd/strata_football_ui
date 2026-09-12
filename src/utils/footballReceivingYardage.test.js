import { describe, expect, it } from 'vitest';
import { footballReceivingYardageWarning, footballYardsAfterCatch } from './footballReceivingYardage';

const completion = (pass = {}) => ({
  type: 'pass', subtype: 'complete', possession: 'H',
  preState: { yardLine: 'H30' },
  result: { yards: 20, endYardLine: '50', pass: { outcome: 'complete', receivingYards: 20, catchYardLine: 'H20', terminalYardLine: '50', ...pass } },
});

describe('receiving yardage review', () => {
  it('warns at exactly 10 extra YAC, but allows a catch 9 yards behind the line', () => {
    expect(footballReceivingYardageWarning(completion())).toMatchObject({ receivingYards: 20, yac: 30, excess: 10 });
    expect(footballReceivingYardageWarning(completion({ catchYardLine: 'H21' }))).toBeNull();
  });

  it('reproduces Play 63 and clears the warning when the catch side is corrected', () => {
    const play = completion({ receivingYards: 39, catchYardLine: 'V14', terminalYardLine: 'goal' });
    play.possession = 'V';
    expect(footballReceivingYardageWarning(play)).toMatchObject({ yac: 86, receivingYards: 39, excess: 47 });
    play.result.pass.catchYardLine = 'H14';
    expect(footballYardsAfterCatch(play)).toBe(14);
    expect(footballReceivingYardageWarning(play)).toBeNull();
  });

  it('uses legacy catch fields and explicit YAC consistently', () => {
    expect(footballYardsAfterCatch(completion({ catchYardLine: undefined, caughtAtYardLine: 'H20' }))).toBe(30);
    expect(footballReceivingYardageWarning(completion({ catchYardLine: undefined, yardsAfterCatch: 31 }))).toMatchObject({ yac: 31, excess: 11 });
    expect(footballYardsAfterCatch(completion({ yardsAfterCatch: 0 }))).toBe(0);
  });

  it('does not invent yardage from missing or invalid catch spots', () => {
    for (const catchYardLine of [undefined, null, '', 'H99', 'garbage']) {
      expect(footballReceivingYardageWarning(completion({ catchYardLine }))).toBeNull();
    }
    expect(footballReceivingYardageWarning(completion({ receivingYards: '' }))).toBeNull();
    expect(footballReceivingYardageWarning(completion({ outcome: 'incomplete' }))).toBeNull();
    expect(footballReceivingYardageWarning({ ...completion(), type: 'rush' })).toBeNull();
  });

  it('preserves negative YAC and computes across midfield for either possession', () => {
    expect(footballYardsAfterCatch(completion({ catchYardLine: 'H40', terminalYardLine: 'H37' }))).toBe(-3);
    expect(footballYardsAfterCatch(completion({ catchYardLine: 'H40', terminalYardLine: 'V40' }))).toBe(20);
    const visitor = completion({ catchYardLine: 'V40', terminalYardLine: 'H40' });
    visitor.possession = 'V';
    expect(footballYardsAfterCatch(visitor)).toBe(20);
  });
});
