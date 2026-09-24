import { describe, expect, it } from 'vitest';
import { formatFootballPlayText } from './footballPlayByPlay';

const teams = { H: { abbr: 'MID' }, V: { abbr: 'BU' } };
const lead = '#19 Jaime Jones pass incomplete intended for #24 Robert Oates, broken up by #31 Israel Caldwell, ';
const penaltyText = 'PENALTY MID Defensive Pass Interference (#31 Israel Caldwell), enforced 11 yards from the H15 to the H15, automatic first down.';
const penalty = { status: 'accepted', enforcedFrom: 'SPOT', spotOfFoul: 'H15', finalSpot: 'H15', yards: 11, automaticFirstDown: true };
const event = { type: 'pass', subtype: 'incomplete', description: lead + penaltyText, penalties: [penalty] };

describe('spot foul readout', () => {
  it('uses the approved wording and preserves the stored event and calculation', () => {
    const before = JSON.stringify(event);
    const expected = lead + 'PENALTY MID Defensive Pass Interference (#31 Israel Caldwell), spot foul at the MID 15 (11 yards), automatic first down.';
    expect(formatFootballPlayText(event, teams)).toBe(expected);
    expect(JSON.stringify(event)).toBe(before);
    expect(formatFootballPlayText({ ...event, description: expected }, teams)).toBe(expected);
    expect(formatFootballPlayText({ ...event, description: event.description.replaceAll('H15', 'MID 15') }, teams)).toBe(expected);
  });

  it('leaves other enforcement and unaccepted penalties alone', () => {
    for (const overrides of [{ finalSpot: 'H20' }, { enforcedFrom: 'PREVIOUS' }, { status: 'declined' }, { status: 'offsetting' }, { status: 'pending' }, { spotOfFoul: '' }]) {
      expect(formatFootballPlayText({ ...event, penalties: [{ ...penalty, ...overrides }] }, teams)).toBe(event.description.replaceAll('H15', 'MID 15'));
    }
    // Do not replace coincident spots in stale text that disagrees with recorded enforcement.
    expect(formatFootballPlayText({ ...event, description: event.description.replaceAll('H15', 'H20') }, teams)).toContain('enforced 11 yards from the MID 20 to the MID 20');
  });

  it('matches the correct clause in a multiple-penalty play', () => {
    const other = 'PENALTY BU Holding, enforced 10 yards from the V25 to the V15, replay down, ';
    const result = formatFootballPlayText({ ...event, description: lead + other + penaltyText, penalties: [{ status: 'accepted', enforcedFrom: 'SPOT', spotOfFoul: 'V25', finalSpot: 'V15' }, penalty] }, teams);
    expect(result).toContain('enforced 10 yards from the BU 25 to the BU 15, replay down');
    expect(result).toContain('spot foul at the MID 15 (11 yards), automatic first down.');
  });

  it('retains zero and singular yardage and accepts canonical aliases and padding', () => {
    for (const yards of ['0 yards', '1 yard']) {
      const play = { ...event, description: event.description.replace('11 yards', yards), penalties: [{ ...penalty, enforcedFrom: 'spotOfFoul', spotOfFoul: 'H05', finalSpot: 'H5' }] };
      play.description = play.description.replaceAll('H15', 'H05');
      expect(formatFootballPlayText(play, teams)).toContain(`spot foul at the MID 5 (${yards})`);
    }
  });
});
