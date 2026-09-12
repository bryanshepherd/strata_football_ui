import { describe, expect, it } from 'vitest';
import { formatFootballFumbleReadout } from './footballFumbleReadout';
import { formatFootballPlayText } from '../reports/footballPlayByPlay';

describe('recorded fumble return readout', () => {
  it('repairs Play 50 in both the game log and report without changing the saved event', () => {
    const event = {
      type: 'rush', possession: 'H', preState: { possession: 'H', yardLine: 'V11' },
      result: { code: 'touchdown', yards: 11, scoring: { type: 'touchdown', team: 'V', points: 6 },
        fumble: { spot: 'V08', recoveredByTeam: 'V', recoverySpot: 'V08', returnYards: 92, returnEndYardLine: 'goal' } },
      description: 'BSTATE #16 Savan Briggs rush for 11 yards to the goal line for a touchdown, fumbled at the V8, recovered by #6 Malachi Adkins for LIV at the V8.',
    };
    const before = JSON.stringify(event);
    const log = formatFootballFumbleReadout(event, event.description);
    expect(log).toBe('BSTATE #16 Savan Briggs rush for 3 yards to the V08, fumbled at the V8, recovered by #6 Malachi Adkins for LIV at the V8, returned 92 yards for a touchdown.');
    expect(formatFootballPlayText(event, { H: { abbr: 'BSTATE' }, V: { abbr: 'LIV' } })).toBe('#16 Savan Briggs rush for 3 yards to the LIV 8, fumbled at the LIV 8, recovered by #6 Malachi Adkins for LIV at the LIV 8, returned 92 yards for a touchdown.');
    expect(formatFootballFumbleReadout(event, log)).toBe(log);
    expect(JSON.stringify(event)).toBe(before);
    expect(formatFootballFumbleReadout({ ...event, result: {} }, event.description)).toBe(event.description);
  });
});
