import { afterEach, describe, expect, it } from 'vitest';
import { footballPenaltyDisplayName, resetFootballPenaltyTableForTests, saveFootballPenaltyDefinition } from '../quick-input/penaltyTable';
import { mapDraftPenaltyToCanonicalEvent } from '../quick-input/footballPenaltyMapper';
import { repairFootballPenaltyNames } from './footballPenaltyNames';

afterEach(() => resetFootballPenaltyTableForTests());
const envelope = { game: { teams: { H: { abbr: 'BSTATE' }, V: { abbr: 'LIV' } } } };

describe('football penalty names', () => {
  it.each(['NCAA', 'NFHS'])('resolves RTK and BSB from the %s catalog, including code-only names', ruleset => {
    expect(footballPenaltyDisplayName({ code: ' rtk ', name: 'RTK' }, ruleset)).toBe('Roughing the Kicker');
    expect(footballPenaltyDisplayName({ code: 'BSB' }, ruleset)).toBe('Illegal Blind-Side Block');
  });

  it('saves selected and custom names with the canonical penalty so another browser can display them', () => {
    const saved = mapDraftPenaltyToCanonicalEvent({ penaltyId: 'custom', code: 'XYZ', name: 'Operator-defined foul', team: 'H', status: 'declined' });
    expect(saved).toMatchObject({ code: 'XYZ', name: 'Operator-defined foul' });
    expect(footballPenaltyDisplayName(JSON.parse(JSON.stringify(saved)))).toBe('Operator-defined foul');
    expect(mapDraftPenaltyToCanonicalEvent({ code: 'RTK', team: 'H', status: 'accepted' }).name).toBe('Roughing the Kicker');
  });

  it('preserves custom definitions and does not guess unknown codes', () => {
    saveFootballPenaltyDefinition({ code: 'BSB', name: 'Custom blindside wording', liveBall: true });
    expect(footballPenaltyDisplayName({ code: 'BSB' })).toBe('Custom blindside wording');
    expect(footballPenaltyDisplayName({ code: 'BSB', name: 'Saved name' })).toBe('Saved name');
    expect(footballPenaltyDisplayName({ code: 'UNKNOWN' })).toBe('UNKNOWN');
  });

  it('repairs each coded clause and confirmation without rewriting players, enforcement, or context', () => {
    const event = {
      preState: { down: 2, distance: 8 }, result: { yards: 3 },
      penalties: [{ code: 'BSB', team: 'V', yards: 15 }, { code: 'RTK', name: 'RTK', team: 'H', status: 'declined' }],
      description: 'LIV #4 Runner rush for 3 yards, PENALTY LIV BSB (#8 Receiver), 15 yards to the V42; PENALTY BSTATE RTK, declined.',
    };
    event.confirmation = { summaryText: event.description };
    const before = structuredClone(event);
    const repaired = repairFootballPenaltyNames(envelope, event);
    expect(repaired.description).toBe('LIV #4 Runner rush for 3 yards, PENALTY LIV Illegal Blind-Side Block (#8 Receiver), 15 yards to the V42; PENALTY BSTATE Roughing the Kicker, declined.');
    expect(repaired.confirmation.summaryText).toBe(repaired.description);
    expect(repaired.preState).toBe(event.preState);
    expect(repaired.result).toBe(event.result);
    expect(event).toEqual(before);
    expect(repairFootballPenaltyNames(envelope, repaired)).toBe(repaired);
  });

  it('supports immediate penalties and preserves historical full names', () => {
    const immediate = { penalties: [{ code: 'RTK' }], description: 'Penalty: RTK on BSTATE, 15 yards.' };
    expect(repairFootballPenaltyNames(envelope, immediate).description).toBe('Penalty: Roughing the Kicker on BSTATE, 15 yards.');
    const custom = { penalties: [{ code: 'XYZ' }], description: 'PENALTY LIV Custom saved foul, declined.' };
    expect(repairFootballPenaltyNames(envelope, custom).penalties[0].name).toBe('Custom saved foul');
    expect(repairFootballPenaltyNames(envelope, custom).description).toBe(custom.description);
  });
});
