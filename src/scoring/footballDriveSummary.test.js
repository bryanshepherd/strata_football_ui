import { describe, expect, it } from 'vitest';
import {
  buildFootballDriveSummary,
  footballPlayerLastName,
  isFootballDriveSummaryTerminalEvent,
} from './footballDriveSummary';

const players = {
  'V-2': { playerId: 'V-2', displayName: 'LeJay Hatcher' },
  'V-10': { playerId: 'V-10', displayName: 'Kaleb Jackson' },
  'V-93': { playerId: 'V-93', displayName: 'Emmanuel Richardson' },
  'V-1': { playerId: 'V-1', displayName: 'Amare Ary' },
  'H-44': { playerId: 'H-44', displayName: 'Todd Gregory, Jr.' },
};

const punt = {
  eventId: 'EVT-1',
  sequence: 1,
  type: 'punt',
  period: 1,
  clock: '13:32',
  possession: 'H',
  result: { code: 'returned', nextPossession: 'V' },
};

const rushTouchdown = {
  eventId: 'EVT-2',
  sequence: 2,
  type: 'rush',
  subtype: 'touchdown',
  period: 1,
  clock: '12:01',
  possession: 'V',
  preState: { driveId: 'DRV-2', possession: 'V', yardLine: 'H05' },
  participants: { primary: { playerId: 'V-2', team: 'V', role: 'rusher' } },
  result: { code: 'touchdown', yards: 5, scoring: { team: 'V', points: 6, type: 'touchdown' } },
};

const envelopeFor = (events, drive = {}) => ({
  game: {
    teams: { H: { name: 'West Virginia St.' }, V: { name: 'Fairmont St.' } },
    rules: { minutesPerPeriod: 15 },
  },
  rosters: {
    teams: {
      H: { players: { 'H-44': players['H-44'] } },
      V: { players: Object.fromEntries(Object.entries(players).filter(([id]) => id.startsWith('V-'))) },
    },
  },
  events,
  drives: {
    current: null,
    completed: [{
      driveId: 'DRV-2',
      team: 'V',
      startYardLine: 'V47',
      startClock: '13:32',
      startPeriod: 1,
      endClock: '12:01',
      endPeriod: 1,
      plays: 8,
      yards: 53,
      result: 'touchdown',
      ...drive,
    }],
  },
});

const tryEvent = (subtype, result, participants = {}) => ({
  eventId: `TRY-${subtype}-${result.code}`,
  sequence: 3,
  type: 'try',
  subtype,
  period: 1,
  clock: '12:01',
  possession: null,
  participants,
  result,
});

describe('football drive summary', () => {
  it('waits through the touchdown and summarizes the completed drive after a successful kick', () => {
    const pat = tryEvent('kick', {
      code: 'made',
      scoring: { team: 'V', points: 1, type: 'patKick' },
    }, {
      primary: { playerId: 'V-93' },
      kicker: { playerId: 'V-93' },
    });
    const envelope = envelopeFor([punt, rushTouchdown, pat]);

    expect(isFootballDriveSummaryTerminalEvent(rushTouchdown)).toBe(false);
    expect(isFootballDriveSummaryTerminalEvent(pat)).toBe(true);
    expect(buildFootballDriveSummary(envelope, pat)).toEqual({
      driveId: 'DRV-2',
      team: 'V',
      teamName: 'Fairmont St.',
      plays: 8,
      yards: 53,
      timeOfPossession: '1:31',
      scoringPlay: 'Hatcher 5 yard rush (Richardson Kick)',
      startInfo: 'Start: 13:32 at V47 by Punt',
    });
  });

  it.each([
    ['kick', 'missed', 'Kick Failed'],
    ['rush', 'failed', 'Rush Failed'],
    ['pass', 'incomplete', 'Pass Failed'],
  ])('uses the requested failure wording for a failed %s try', (subtype, code, expected) => {
    const pat = tryEvent(subtype, { code });
    const summary = buildFootballDriveSummary(envelopeFor([punt, rushTouchdown, pat]), pat);
    expect(summary.scoringPlay).toBe(`Hatcher 5 yard rush (${expected})`);
  });

  it('describes a defensive conversion with the failed try and returner', () => {
    const pat = tryEvent('rush', {
      code: 'fumble',
      fumble: { fumblerPlayerId: 'V-2' },
      return: { returnerPlayerId: 'H-44', returnEndYardLine: 'goal' },
      scoring: { team: 'H', points: 2, type: 'defensiveConversion' },
    }, {
      primary: { playerId: 'V-2' },
      returner: { playerId: 'H-44' },
    });

    const summary = buildFootballDriveSummary(envelopeFor([punt, rushTouchdown, pat]), pat);
    expect(summary.scoringPlay).toBe('Hatcher 5 yard rush (Rush fumbled - Gregory Def. Conversion)');
  });

  it('summarizes made field goals without waiting for a try', () => {
    const fieldGoal = {
      eventId: 'EVT-FG',
      type: 'fieldGoal',
      subtype: 'made',
      period: 1,
      clock: '12:01',
      possession: 'V',
      preState: { driveId: 'DRV-2', possession: 'V' },
      participants: { primary: { playerId: 'V-2' }, kicker: { playerId: 'V-2' } },
      result: {
        code: 'made',
        kick: { attemptYards: 30 },
        scoring: { team: 'V', points: 3, type: 'fieldGoal' },
      },
    };
    const summary = buildFootballDriveSummary(
      envelopeFor([punt, fieldGoal], { result: 'fieldGoal' }),
      fieldGoal,
    );
    expect(summary.scoringPlay).toBe('Hatcher 30 yd. field goal');
  });

  it('treats a safety as a completed scoring sequence', () => {
    const safety = {
      ...rushTouchdown,
      eventId: 'EVT-SAFETY',
      result: {
        code: 'safety',
        yards: -2,
        scoring: { team: 'H', points: 2, type: 'safety' },
      },
    };
    const summary = buildFootballDriveSummary(
      envelopeFor([punt, safety], { result: 'safety', yards: -2 }),
      safety,
    );

    expect(isFootballDriveSummaryTerminalEvent(safety)).toBe(true);
    expect(summary.teamName).toBe('West Virginia St.');
    expect(summary.scoringPlay).toBe('Hatcher rush for safety');
  });

  it('summarizes touchdown passes with passer, yardage, and receiver', () => {
    const passTouchdown = {
      ...rushTouchdown,
      eventId: 'EVT-PASS-TD',
      type: 'pass',
      participants: {
        primary: { playerId: 'V-10' },
        secondary: { playerId: 'V-1' },
        receiver: { playerId: 'V-1' },
      },
      result: {
        code: 'complete',
        yards: 20,
        pass: { passingYards: 20, targetPlayerId: 'V-1' },
        scoring: { team: 'V', points: 6, type: 'touchdown' },
      },
    };
    const pat = tryEvent('rush', { code: 'failed' });
    const summary = buildFootballDriveSummary(envelopeFor([punt, passTouchdown, pat]), pat);
    expect(summary.scoringPlay).toBe('Jackson 20 yd. pass to Ary (Rush Failed)');
  });

  it('labels a kickoff-return fumble recovery as the scoring drive acquisition', () => {
    const kickoffFumble = {
      eventId: 'EVT-KO-FUMBLE',
      sequence: 1,
      type: 'kickoff',
      subtype: 'returned',
      period: 2,
      clock: '06:46',
      participants: {
        kicker: { playerId: 'V-93', team: 'V', role: 'kicker' },
        returner: { playerId: 'H-44', team: 'H', role: 'returner' },
      },
      result: {
        code: 'returned',
        endYardLine: 'V28',
        nextPossession: 'V',
        fumble: { turnover: true, recoveredByTeam: 'V', recoverySpot: 'V28' },
        turnover: { type: 'fumble', recoveredBy: 'V', spot: 'V28' },
      },
    };
    const touchdown = {
      ...rushTouchdown,
      eventId: 'EVT-KO-FUMBLE-TD',
      sequence: 2,
      period: 2,
      clock: '05:41',
      preState: { driveId: 'DRV-2', possession: 'V', yardLine: 'H26' },
    };
    const pat = {
      ...tryEvent('kick', {
        code: 'made',
        scoring: { team: 'V', points: 1, type: 'patKick' },
      }, {
        primary: { playerId: 'V-93' },
        kicker: { playerId: 'V-93' },
      }),
      period: 2,
      clock: '05:41',
    };
    const summary = buildFootballDriveSummary(
      envelopeFor([kickoffFumble, touchdown, pat], {
        startYardLine: 'V28',
        startClock: '06:38',
        startPeriod: 2,
        endClock: '05:41',
        endPeriod: 2,
        startReason: 'kickoff',
      }),
      pat,
    );

    expect(summary.startInfo).toBe('Start: 6:38 at V28 by Fumble Recovery');
  });

  it('keeps suffixes out of the last-name display', () => {
    expect(footballPlayerLastName('Larrey Williams III')).toBe('Williams');
    expect(footballPlayerLastName('Todd Gregory, Jr.')).toBe('Gregory');
  });
});
