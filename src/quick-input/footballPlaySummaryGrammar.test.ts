import { describe, expect, it } from 'vitest';
import {
  generateFootballPlaySummary,
  type FootballPlaySummaryResult,
} from './footballPlaySummaryGrammar';
import type {
  DraftParticipant,
  DraftParticipantRole,
  FootballDraftIntent,
} from './footballIntentSchema';

describe('footballPlaySummaryGrammar', () => {
  it('generates a rush summary', () => {
    expectSummary(
      baseIntent({
        family: 'rush',
        subtype: null,
        primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
        defenders: [participant('tackler', 'V', 'V-44', '44', 'Caleb Moss')],
        result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
      }),
      'HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.',
    );
  });

  it('generates a pass complete summary', () => {
    expectSummary(
      baseIntent({
        family: 'pass',
        subtype: 'complete',
        primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
        secondary: participant('receiver', 'H', 'H-88', '88', 'Eli Grant'),
        defenders: [participant('tackler', 'V', 'V-44', '44', 'Caleb Moss')],
        result: {
          code: 'complete',
          yards: 12,
          endYardLine: 'V37',
          pass: { targetPlayerId: 'H-88', completed: true },
        },
      }),
      'HOM #12 Mason Reed pass complete to #88 Eli Grant for 12 yards to the V37, tackled by #44 Caleb Moss.',
    );
  });

  it('generates a pass incomplete summary', () => {
    expectSummary(
      baseIntent({
        family: 'pass',
        subtype: 'incomplete',
        primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
        secondary: participant('intendedReceiver', 'H', 'H-88', '88', 'Eli Grant'),
        result: {
          code: 'incomplete',
          pass: { targetPlayerId: 'H-88', completed: false },
        },
      }),
      'HOM #12 Mason Reed pass incomplete intended for #88 Eli Grant.',
    );
  });

  it('generates a sack summary', () => {
    expectSummary(
      baseIntent({
        family: 'pass',
        subtype: 'sack',
        primary: participant('sackVictim', 'H', 'H-12', '12', 'Mason Reed'),
        defenders: [participant('sack', 'V', 'V-44', '44', 'Caleb Moss')],
        result: { code: 'sack', yards: -6, endYardLine: 'V43' },
      }),
      'HOM #12 Mason Reed sacked by #44 Caleb Moss for loss of 6 yards to the V43.',
    );
  });

  it('generates an interception summary', () => {
    expectSummary(
      baseIntent({
        family: 'pass',
        subtype: 'interception',
        primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
        secondary: participant('intendedReceiver', 'H', 'H-88', '88', 'Eli Grant'),
        defenders: [
          participant('interceptor', 'V', 'V-03', '3', 'Smith'),
          participant('tackler', 'H', 'H-22', '22', 'Jordan Smith'),
        ],
        result: {
          code: 'interception',
          endYardLine: 'H24',
          turnover: {
            type: 'interception',
            team: 'V',
            playerId: 'V-03',
            spot: 'H42',
            returnYards: 18,
            returnEndYardLine: 'H24',
            recoveredBy: 'V',
          },
        },
      }),
      'HOM #12 Mason Reed pass intended for #88 Eli Grant intercepted by #3 Smith at the H42, returned for 18 yards to the H24, tackled by #22 Jordan Smith.',
    );
  });

  it('generates a fumble summary', () => {
    expectSummary(
      baseIntent({
        family: 'rush',
        subtype: null,
        primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
        fumbler: participant('fumbler', 'H', 'H-22', '22', 'Jordan Smith'),
        forcedBy: participant('forcedFumble', 'V', 'V-44', '44', 'Caleb Moss'),
        recoveredBy: participant('recoverer', 'V', 'V-04', '4', 'Noah Reed'),
        result: {
          code: 'fumble',
          yards: 5,
          endYardLine: 'H35',
          fumble: {
            fumblerPlayerId: 'H-22',
            forcedByPlayerId: 'V-44',
            spot: 'H35',
            recoveredByPlayerId: 'V-04',
            recoveredByTeam: 'V',
            recoverySpot: 'H35',
            turnover: true,
          },
        },
      }),
      'HOM #22 Jordan Smith rush for 5 yards to the H35, fumbled at the H35, forced by #44 Caleb Moss, recovered by #4 Noah Reed for VIS at the H35.',
    );
  });

  it('generates a punt summary', () => {
    expectSummary(
      baseIntent({
        family: 'punt',
        subtype: 'returned',
        primary: participant('punter', 'H', 'H-09', '9', 'Owen Clark'),
        returner: participant('returner', 'V', 'V-03', '3', 'Davis'),
        result: {
          code: 'returned',
          endYardLine: 'V31',
          kick: { kickYards: 42, catchYardLine: 'V26' },
          return: { returnerPlayerId: 'V-03', returnYards: 5, returnStartYardLine: 'V26', returnEndYardLine: 'V31' },
        },
      }),
      'HOM #9 Owen Clark punt 42 yards to the V26, #3 Davis return for 5 yards to the V31.',
    );
  });

  it('generates a kickoff summary', () => {
    expectSummary(
      baseIntent({
        family: 'kickoff',
        subtype: 'touchback',
        primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
        prePlay: possessionFreePrePlay(),
        result: { code: 'touchback', endYardLine: 'V25' },
      }),
      'HOM #9 Owen Clark kickoff into the end zone, touchback.',
    );
  });

  it('generates a kickoff return out-of-bounds summary', () => {
    expectSummary(
      baseIntent({
        family: 'kickoff',
        subtype: 'returned',
        primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
        returner: participant('returner', 'V', 'V-03', '3', 'Davis'),
        prePlay: possessionFreePrePlay(),
        result: {
          code: 'outOfBounds',
          endYardLine: 'V31',
          kick: { kickYards: 45, catchYardLine: 'V20', receiveResultCode: 'R' },
          return: {
            type: 'Kickoff',
            returnerPlayerId: 'V-03',
            returnYards: 11,
            returnStartYardLine: 'V20',
            returnEndYardLine: 'V31',
            resultCode: 'O',
          },
        },
      }),
      'HOM #9 Owen Clark kickoff 45 yards to the V20, #3 Davis return for 11 yards to the V31, out-of-bounds.',
    );
  });

  it('generates a field goal summary', () => {
    expectSummary(
      baseIntent({
        family: 'fieldGoal',
        subtype: 'made',
        primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
        result: {
          code: 'made',
          kick: { attemptYards: 28, kickSpot: 'V18' },
          scoring: { team: 'H', points: 3, type: 'fieldGoal' },
        },
      }),
      'HOM #9 Owen Clark 28-yard field goal good.',
    );
  });

  it('generates a PAT summary', () => {
    expectSummary(
      baseIntent({
        family: 'try',
        subtype: 'kick',
        primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
        prePlay: possessionFreePrePlay('V03'),
        result: {
          code: 'made',
          kick: { kickSpot: 'V03' },
          scoring: { team: 'H', points: 1, type: 'patKick' },
        },
      }),
      'HOM #9 Owen Clark extra point good.',
    );
  });

  it('generates a penalty-only summary', () => {
    expectSummary(
      baseIntent({
        family: 'penalty',
        subtype: 'accepted',
        actionTeam: 'V',
        primary: undefined,
        penalizedPlayers: [participant('penalizedPlayer', 'V', 'V-44', '44', 'Caleb Moss')],
        result: { code: 'accepted', endYardLine: 'H49' },
        penalties: [
          {
            penaltyId: 'pen-1',
            team: 'V',
            code: 'OFF',
            name: 'Offside',
            yards: 5,
            enforcedFrom: 'PREVIOUS',
            finalSpot: 'H49',
            downConsequence: 'REPEAT',
            status: 'accepted',
            accepted: true,
            playerId: 'V-44',
            penalizedPlayerId: 'V-44',
          },
        ],
      }),
      'PENALTY VIS Offside (#44 Caleb Moss), 5 yards from the H44 to the H49, replay down.',
    );
  });

  it('formats a post-touchdown setup penalty as one natural enforcement phrase', () => {
    expectSummary(
      baseIntent({
        family: 'penalty',
        subtype: 'accepted',
        actionTeam: 'H',
        primary: undefined,
        penalizedPlayers: [participant('penalizedPlayer', 'H', 'H-44', '44', 'Home Moss')],
        prePlay: {
          ...possessionFreePrePlay('H35'),
          setupContext: 'awaitingKickoff',
        },
        result: { code: 'accepted', endYardLine: 'H20' },
        penalties: [
          {
            penaltyId: 'pen-post-touchdown',
            team: 'H',
            code: 'UC',
            name: 'Unsportsmanlike Conduct',
            yards: -15,
            enforcedFrom: 'PREVIOUS',
            finalSpot: 'H20',
            downConsequence: 'REPEAT',
            replayDown: true,
            status: 'accepted',
            accepted: true,
            playerId: 'H-44',
            penalizedPlayerId: 'H-44',
          },
        ],
      }),
      'PENALTY HOM Unsportsmanlike Conduct (#44 Home Moss), 15 yards from the H35 to the H20.',
    );
  });

  it('formats attached spot-of-foul penalties with explicit foul spot enforcement', () => {
    expectSummary(
      baseIntent({
        family: 'rush',
        subtype: null,
        primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
        penalizedPlayers: [participant('penalizedPlayer', 'H', 'H-44', '44', 'Home Moss')],
        result: { code: 'tackle', yards: 19, endYardLine: 'V39' },
        penalties: [
          {
            penaltyId: 'pen-spot',
            team: 'H',
            code: 'HLD',
            name: 'holding',
            yards: -10,
            enforcedFrom: 'SPOT',
            spotOfFoul: 'V46',
            finalSpot: 'H44',
            status: 'accepted',
            accepted: true,
            playerId: 'H-44',
            penalizedPlayerId: 'H-44',
          },
        ],
      }),
      'HOM #22 Jordan Smith rush for 19 yards to the V39, PENALTY HOM holding (#44 Home Moss), enforced 10 yards from the V46 to the H44.',
    );
  });

  it('formats attached previous-spot penalties without verbalizing previous spot', () => {
    const result = generateFootballPlaySummary(baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
      penalties: [
        {
          penaltyId: 'pen-prev',
          team: 'H',
          code: 'FS',
          name: 'false start',
          yards: -5,
          enforcedFrom: 'PREVIOUS',
          finalSpot: 'H39',
          status: 'accepted',
          accepted: true,
        },
      ],
    }));

    expect(result.summaryText).toContain('PENALTY HOM false start, 5 yards to the H39');
    expect(result.summaryText).not.toMatch(/previous spot/i);
    expect(result.warnings).toEqual([]);
  });

  it('formats attached succeeding-spot penalties without verbalizing end or succeeding spot', () => {
    const result = generateFootballPlaySummary(baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
      penalties: [
        {
          penaltyId: 'pen-end',
          team: 'V',
          code: 'UNS',
          name: 'unsportsmanlike conduct',
          yards: 15,
          enforcedFrom: 'END',
          finalSpot: 'V34',
          status: 'accepted',
          accepted: true,
        },
      ],
    }));

    expect(result.summaryText).toContain('PENALTY VIS unsportsmanlike conduct, 15 yards to the V34');
    expect(result.summaryText).not.toMatch(/succeeding spot|end spot|end of the run/i);
    expect(result.warnings).toEqual([]);
  });

  it('preserves signed penalty yards while displaying absolute yardage', () => {
    const intent = baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: { code: 'tackle', yards: 19, endYardLine: 'V39' },
      penalties: [
        {
          penaltyId: 'pen-signed',
          team: 'H',
          code: 'HLD',
          name: 'holding',
          yards: -10,
          enforcedFrom: 'SPOT',
          spotOfFoul: 'V46',
          finalSpot: 'H44',
          status: 'accepted',
          accepted: true,
        },
      ],
    });

    const result = generateFootballPlaySummary(intent);

    expect(result.summaryText).toContain('PENALTY HOM holding, enforced 10 yards from the V46 to the H44');
    expect(intent.penalties[0].yards).toBe(-10);
  });

  it('returns FPSG warnings without mutating the intent', () => {
    const intent = baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: { code: 'tackle' },
    });
    const before = clone(intent);

    const result = generateFootballPlaySummary(intent);

    expect(result.summaryText).toBe('HOM #22 Jordan Smith rush yards pending to spot pending.');
    expect(result.warnings.map((warning) => warning.code)).toEqual(['MISSING_YARDS', 'MISSING_SPOT']);
    expect(intent).toEqual(before);
  });
});

function expectSummary(intent: FootballDraftIntent, expected: string): FootballPlaySummaryResult {
  const result = generateFootballPlaySummary(intent);
  expect(result.summaryText).toBe(expected);
  expect(result.warnings).toEqual([]);
  return result;
}

function baseIntent(options: {
  family: FootballDraftIntent['play']['family'];
  subtype: FootballDraftIntent['play']['subtype'];
  actionTeam?: 'H' | 'V';
  primary?: DraftParticipant;
  secondary?: DraftParticipant;
  defenders?: DraftParticipant[];
  returner?: DraftParticipant;
  fumbler?: DraftParticipant;
  forcedBy?: DraftParticipant;
  recoveredBy?: DraftParticipant;
  penalizedPlayers?: DraftParticipant[];
  prePlay?: FootballDraftIntent['prePlay'];
  result: FootballDraftIntent['result'];
  penalties?: FootballDraftIntent['penalties'];
}): FootballDraftIntent {
  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: `intent-${options.family}-${options.subtype ?? 'base'}`,
    clientEventId: `client-${options.family}-${options.subtype ?? 'base'}`,
    status: 'readyForSummary',
    createdAt: '2026-06-20T00:00:00Z',
    updatedAt: '2026-06-20T00:00:05Z',
    revision: 2,
    game: {
      gameId: 'FB-1001',
      teams: {
        H: { team: 'H', teamId: 'TEAM-H', name: 'Home State', abbr: 'HOM' },
        V: { team: 'V', teamId: 'TEAM-V', name: 'Visitor Tech', abbr: 'VIS' },
      },
    },
    source: {
      kind: 'fcqi',
      startedBy: 'hotkey',
      startedAt: '2026-06-20T00:00:00Z',
      baseEventSequence: 41,
    },
    play: {
      family: options.family,
      subtype: options.subtype,
      actionTeam: options.actionTeam ?? 'H',
      possession: options.family === 'kickoff' ? null : 'H',
      period: 1,
      clock: '08:42',
    },
    prePlay: options.prePlay ?? {
      possession: 'H',
      down: 2,
      distance: 6,
      yardLine: 'H44',
      lineToGain: '50',
      driveId: 'DRV-0002',
      driveNumber: 2,
    },
    participants: {
      ...(options.primary ? { primary: options.primary } : {}),
      ...(options.secondary ? { secondary: options.secondary } : {}),
      ...(options.returner ? { returner: options.returner } : {}),
      ...(options.fumbler ? { fumbler: options.fumbler } : {}),
      ...(options.forcedBy ? { forcedBy: options.forcedBy } : {}),
      ...(options.recoveredBy ? { recoveredBy: options.recoveredBy } : {}),
      defenders: options.defenders ?? [],
      penalizedPlayers: options.penalizedPlayers ?? [],
      others: [],
    },
    result: options.result,
    penalties: options.penalties ?? [],
    warnings: [],
  };
}

function participant(
  role: DraftParticipantRole,
  team: 'H' | 'V',
  playerId: string,
  jersey: string,
  displayName: string,
): DraftParticipant {
  return {
    participantId: `${role}-${playerId}`,
    playerId,
    team,
    role,
    jersey,
    displayName,
    position: defaultPosition(role),
    resolution: {
      source: 'singleMatch',
      jerseyToken: jersey,
      teamScope: team,
      actionContext: team === 'H' ? 'offense' : 'defense',
    },
  };
}

function defaultPosition(role: DraftParticipantRole): string {
  if (role === 'passer' || role === 'sackVictim') return 'QB';
  if (role === 'rusher') return 'RB';
  if (role === 'receiver' || role === 'intendedReceiver') return 'WR';
  if (role === 'kicker') return 'K';
  if (role === 'punter') return 'P';
  if (role === 'returner') return 'PR';
  if (role === 'interceptor') return 'CB';
  return 'LB';
}

function possessionFreePrePlay(yardLine: FootballDraftIntent['prePlay']['yardLine'] = null): FootballDraftIntent['prePlay'] {
  return {
    possession: null,
    down: null,
    distance: null,
    yardLine,
    lineToGain: null,
    driveId: null,
    driveNumber: 0,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
