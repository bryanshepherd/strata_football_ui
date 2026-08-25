import { afterEach, describe, expect, it } from 'vitest';
import {
  findFootballPenaltyDefinition,
  listFootballPenaltyCatalog,
  listFootballPenaltyTable,
  resetFootballPenaltyTableForTests,
  saveFootballPenaltyDefinition,
  searchFootballPenaltyTable,
} from './penaltyTable';

afterEach(() => resetFootballPenaltyTableForTests());

describe('penaltyTable', () => {
  it('loads the agreed catalog schema without inventing pending codes', () => {
    const catalog = listFootballPenaltyCatalog();
    const allowedEntryKeys = ['code', 'name', 'team', 'NFHS', 'NCAA'];
    const allowedRuleKeys = ['yards', 'down', 'enforcement', 'eject'];

    expect(catalog).toHaveLength(59);
    expect(catalog.filter((entry) => entry.NCAA)).toHaveLength(58);
    expect(catalog.filter((entry) => entry.NFHS)).toHaveLength(54);
    expect(catalog.every((entry) => entry.code === '')).toBe(true);
    expect(catalog.some((entry) => entry.name === 'Sideline Warning')).toBe(false);
    catalog.forEach((entry) => {
      expect(Object.keys(entry).every((key) => allowedEntryKeys.includes(key))).toBe(true);
      expect(['offense', 'defense', 'both']).toContain(entry.team);
      for (const ruleset of ['NFHS', 'NCAA'] as const) {
        const rule = entry[ruleset];
        if (!rule) continue;
        expect(Object.keys(rule).sort()).toEqual(allowedRuleKeys.slice().sort());
        expect(['repeat', 'loss', 'auto']).toContain(rule.down);
        expect(['previous', 'spot', 'succeeding']).toContain(rule.enforcement);
        expect(typeof rule.eject).toBe('boolean');
      }
    });
  });

  it('adapts the selected ruleset to quick-input defaults', () => {
    const table = listFootballPenaltyTable();

    expect(table).toHaveLength(58);
    expect(listFootballPenaltyTable('NFHS')).toHaveLength(54);
    expect(table).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HOLD',
          name: 'Holding',
          defaultEnforcement: 'PREVIOUS',
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

    expect(findFootballPenaltyDefinition('Intentional Grounding', 'NCAA')).toMatchObject({
      yards: 0,
      lossOfDown: true,
      defaultEnforcement: 'SPOT',
    });
    expect(findFootballPenaltyDefinition('Intentional Grounding', 'NFHS')).toMatchObject({
      yards: 5,
      lossOfDown: true,
      defaultEnforcement: 'SPOT',
    });
    expect(findFootballPenaltyDefinition('Incidental Face Mask', 'NCAA')).toBeNull();
    expect(findFootballPenaltyDefinition('Incidental Face Mask', 'NFHS')).toMatchObject({ yards: 5 });
  });

  it('selects penalties by code or name', () => {
    expect(findFootballPenaltyDefinition('OFF')).toMatchObject({
      code: 'OFF',
      name: 'Offsides',
    });
    expect(findFootballPenaltyDefinition('offside')).toMatchObject({
      code: 'OFF',
      name: 'Offsides',
    });
    expect(findFootballPenaltyDefinition('missing')).toBeNull();
  });

  it('keeps conditional offense and defense defaults distinct', () => {
    expect(findFootballPenaltyDefinition('Unsportsmanlike Conduct', {
      ruleset: 'NCAA',
      teamRole: 'offense',
    })).toMatchObject({ team: 'offense', automaticFirstDown: false });
    expect(findFootballPenaltyDefinition('Unsportsmanlike Conduct', {
      ruleset: 'NCAA',
      teamRole: 'defense',
    })).toMatchObject({ team: 'defense', automaticFirstDown: true });

    expect(findFootballPenaltyDefinition('Targeting', 'NCAA')).toMatchObject({
      autoEjection: true,
      ejectionable: true,
    });
    expect(findFootballPenaltyDefinition('Targeting', 'NFHS')).toMatchObject({
      autoEjection: false,
      ejectionable: false,
    });
  });

  it('selects pending-code entries by their internal lookup key while keeping the catalog code blank', () => {
    const entry = searchFootballPenaltyTable('Helping Ball Carrier')[0];

    expect(entry).toMatchObject({ code: '', name: 'Helping Ball Carrier' });
    expect(findFootballPenaltyDefinition(entry.lookupKey)).toMatchObject({
      code: '',
      name: 'Helping Ball Carrier',
    });
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
