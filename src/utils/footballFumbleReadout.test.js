import { buildFootballScoringSummary } from '../reports/footballScoringSummary';
import { footballScoringPlayText } from '../scoring/footballDriveSummary';
import { repairFootballPlayReadoutsInEnvelope } from '../play-editor/footballPlayEditEnvelope';
import { describe, expect, it } from 'vitest';
import { formatFootballFumbleReadout, isFootballEndZoneFumbleRecovery } from './footballFumbleReadout';
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


describe('end zone fumble recovery readout', () => {
  const player = { playerId: 'H-6', team: 'H', jersey: '6', displayName: 'Byron Wallace' };
  const event = {
    eventId: 'LOCAL-000058', sequence: 58, status: 'accepted', type: 'rush', subtype: 'aborted',
    possession: 'V', period: 1, clock: '03:39', preState: { possession: 'V', yardLine: 'V42' },
    participants: { defenders: [{ ...player, role: 'recoverer' }] }, penalties: [],
    result: { code: 'touchdown', yards: -15, teamCharged: true, nextPossession: 'H',
      scoring: { team: 'H', points: 6, type: 'touchdown' },
      fumble: { fumblerPlayerId: 'TM', spot: 'V27', recoveredByPlayerId: 'H-6', recoveredByTeam: 'H', recoverySpot: 'goal', turnover: true } },
    description: 'Aborted play, fumbled at the V27, recovered by #6 Byron Wallace for MID at the goal line.',
  };
  const envelope = { game: { teams: { H: { abbr: 'MID' }, V: { abbr: 'BU' } }, rules: {} },
    rosters: { teams: { H: { players: { 'H-6': player } }, V: { players: {} } } }, events: [event] };
  it.each(['goal', 'V00', 'V0'])('uses recovery wording for touchdown recovery at %s without changing play facts', (spot) => {
    const play = structuredClone(event);
    play.result.fumble.recoverySpot = spot;
    play.result.fumble.returnYards = 0;
    const before = JSON.stringify(play);
    const text = formatFootballFumbleReadout(play, play.description);
    expect(text).toBe('Aborted play, fumbled at the V27, fumble recovery in the end zone by #6 Byron Wallace for MID.');
    expect(formatFootballFumbleReadout(play, text)).toBe(text);
    expect(formatFootballPlayText(play, envelope.game.teams)).toContain('fumble recovery in the end zone by #6 Byron Wallace for MID');
    expect(footballScoringPlayText(envelope, play)).toBe('Byron Wallace fumble recovery in the end zone');
    expect(buildFootballScoringSummary({ ...envelope, events: [play] }).scoring[0].description).toBe('Byron Wallace fumble recovery in the end zone');
    expect(JSON.stringify(play)).toBe(before);
  });
  it('refreshes an existing saved description and confirmation once while preserving scoring and fumble data', () => {
    const source = structuredClone(envelope);
    source.events[0].confirmation = { summaryText: event.description };
    const repaired = repairFootballPlayReadoutsInEnvelope(source);
    expect(repaired.events[0].description).toBe('Aborted play, fumbled at the V27, fumble recovery in the end zone by #6 Byron Wallace for MID.');
    expect(repaired.events[0].confirmation.summaryText).toBe(repaired.events[0].description);
    expect(repaired.events[0].result).toEqual(event.result);
    expect(source.events[0].description).toBe(event.description);
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
  });
  it('does not relabel returns, the opposite end zone, or non-scoring recoveries', () => {
    for (const patch of [{ recoverySpot: 'V02', returnYards: 2 }, { recoverySpot: 'H00' }, { returnYards: 27 }]) {
      const play = { ...event, result: { ...event.result, fumble: { ...event.result.fumble, ...patch } } };
      expect(isFootballEndZoneFumbleRecovery(play)).toBe(false);
    }
    expect(isFootballEndZoneFumbleRecovery({ ...event, result: { ...event.result, scoring: undefined } })).toBe(false);
  });
});
