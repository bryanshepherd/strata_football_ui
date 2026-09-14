import { expect, it } from 'vitest';
import { splitFootballDefensiveYards } from './footballDefensiveCredit';

it('splits even and odd losses once while preserving the team yardage', () => {
  const defenders = [{ playerId: 'a' }, { playerId: 'b' }];
  expect(defenders.map(d => splitFootballDefensiveYards(4, defenders, d))).toEqual([2, 2]);
  expect(defenders.map(d => splitFootballDefensiveYards(3, defenders, d))).toEqual([2, 1]);
  expect(splitFootballDefensiveYards(7, [defenders[0]], defenders[0])).toBe(7);
  expect(splitFootballDefensiveYards(4, defenders, {})).toBe(0);
});
