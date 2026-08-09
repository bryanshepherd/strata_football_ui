import { afterEach, describe, expect, it } from 'vitest';
import {
  findFootballPenaltyDefinition,
  listFootballPenaltyTable,
  resetFootballPenaltyTableForTests,
  saveFootballPenaltyDefinition,
  searchFootballPenaltyTable,
} from './penaltyTable';

afterEach(() => resetFootballPenaltyTableForTests());

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
        expect.objectContaining({
          code: 'PF',
          liveBall: true,
          deadBall: true,
        }),
        expect.objectContaining({
          code: 'FKI',
          name: 'Free Kick Infraction',
          yards: 5,
          defaultEnforcement: 'PREVIOUS',
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

  it('adds and revises operator penalty codes for immediate lookup', () => {
    saveFootballPenaltyDefinition({
      code: 'new1',
      name: 'New Test Penalty',
      liveBall: true,
      deadBall: false,
      ejectionable: true,
      yards: 7,
      requiresYards: false,
      requiresSpot: true,
      defaultEnforcement: 'SPOT',
      automaticFirstDown: false,
      lossOfDown: false,
    });

    expect(findFootballPenaltyDefinition('NEW1')).toMatchObject({
      name: 'New Test Penalty',
      yards: 7,
      defaultEnforcement: 'SPOT',
      deadBall: false,
      ejectionable: true,
    });

    saveFootballPenaltyDefinition({
      ...findFootballPenaltyDefinition('NEW1'),
      code: 'NEW2',
      name: 'Revised Test Penalty',
    }, { previousCode: 'NEW1' });

    expect(findFootballPenaltyDefinition('NEW1')).toBeNull();
    expect(findFootballPenaltyDefinition('NEW2')).toMatchObject({ name: 'Revised Test Penalty' });
  });

  it('does not save a penalty with no valid timing', () => {
    expect(() => saveFootballPenaltyDefinition({
      code: 'NONE',
      name: 'No Timing',
      liveBall: false,
      deadBall: false,
      ejectionable: false,
      requiresYards: false,
      requiresSpot: false,
      defaultEnforcement: 'PREVIOUS',
      automaticFirstDown: false,
      lossOfDown: false,
    })).toThrow('Choose Live-Ball Penalty, Dead-Ball Penalty, or both.');
  });
});
