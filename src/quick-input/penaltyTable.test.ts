import { describe, expect, it } from 'vitest';
import {
  findFootballPenaltyDefinition,
  listFootballPenaltyTable,
  searchFootballPenaltyTable,
} from './penaltyTable';

describe('penaltyTable', () => {
  it('loads expected seed entries', () => {
    const table = listFootballPenaltyTable();

    expect(table.length).toBeGreaterThan(10);
    expect(table).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HOLD',
          name: 'Holding',
          defaultEnforcement: 'SPOT',
          yards: 10,
        }),
        expect.objectContaining({
          code: 'DPI',
          name: 'Defensive Pass Interference',
          automaticFirstDown: true,
        }),
        expect.objectContaining({
          code: 'IG',
          name: 'Intentional Grounding',
          lossOfDown: true,
        }),
      ]),
    );
  });

  it('selects penalties by code or name', () => {
    expect(findFootballPenaltyDefinition('OFF')).toMatchObject({
      code: 'OFF',
      name: 'Offside',
    });
    expect(findFootballPenaltyDefinition('offside')).toMatchObject({
      code: 'OFF',
      name: 'Offside',
    });
    expect(findFootballPenaltyDefinition('missing')).toBeNull();
  });

  it('filters penalties by code or name', () => {
    expect(searchFootballPenaltyTable('hold').map((entry) => entry.code)).toContain('HOLD');
    expect(searchFootballPenaltyTable('DPI')[0]).toMatchObject({
      code: 'DPI',
      name: 'Defensive Pass Interference',
    });
  });
});
