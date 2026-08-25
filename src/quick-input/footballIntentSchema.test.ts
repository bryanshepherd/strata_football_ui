import { describe, expect, it } from 'vitest';
import {
  type DraftParticipant,
  type DraftParticipantRole,
  type FootballDraftIntent,
  type FootballIntentValidationErrorCode,
  isCanonicalSpot,
  validateFootballDraftIntent,
} from './footballIntentSchema';

describe('footballIntentSchema', () => {
  it.each(['H00', 'V00'])('accepts %s as a canonical end-zone spot', (spot) => {
    expect(isCanonicalSpot(spot)).toBe(true);
  });

  it('accepts a valid rush intent', () => {
    expect(validateFootballDraftIntent(makeRushIntent()).ok).toBe(true);
  });

  it('accepts a valid pass complete intent', () => {
    const intent = baseIntent({
      family: 'pass',
      subtype: 'complete',
      hotkey: 'P',
      primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
      secondary: participant('receiver', 'H', 'H-88', '88', 'Eli Grant'),
      result: {
        code: 'complete',
        yards: 12,
        endYardLine: 'V37',
        firstDown: true,
        pass: { targetPlayerId: 'H-88', completed: true },
      },
      summary: 'HOM #12 Mason Reed pass complete to #88 Eli Grant for 12 yards to the V37.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid pass incomplete intent', () => {
    const intent = baseIntent({
      family: 'pass',
      subtype: 'incomplete',
      hotkey: 'P',
      primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
      secondary: participant('intendedReceiver', 'H', 'H-04', '4', 'Andre Lane'),
      result: {
        code: 'incomplete',
        endYardLine: 'V37',
        pass: { targetPlayerId: 'H-04', completed: false },
      },
      summary: 'HOM #12 Mason Reed pass incomplete intended for #4 Andre Lane.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid sack intent', () => {
    const intent = baseIntent({
      family: 'pass',
      subtype: 'sack',
      primary: participant('sackVictim', 'H', 'H-12', '12', 'Mason Reed'),
      defenders: [participant('sack', 'V', 'V-44', '44', 'Caleb Moss')],
      result: { code: 'sack', yards: -6, endYardLine: 'V43' },
      summary: 'HOM #12 Mason Reed sacked by #44 Caleb Moss for loss of 6 yards to the V43.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid interception intent', () => {
    const intent = baseIntent({
      family: 'pass',
      subtype: 'interception',
      primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
      secondary: participant('intendedReceiver', 'H', 'H-88', '88', 'Eli Grant'),
      defenders: [
        participant('interceptor', 'V', 'V-03', '3', 'Smith', {
          resolutionSource: 'duplicateConfirmed',
          actionContext: 'defense',
        }),
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
        nextPossession: 'V',
      },
      summary: 'HOM #12 Mason Reed pass intended for #88 Eli Grant intercepted by #3 Smith at the H42, returned for 18 yards to the H24.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid fumble intent', () => {
    const rusher = participant('rusher', 'H', 'H-22', '22', 'Jordan Smith');
    const recoverer = participant('recoverer', 'V', 'V-44', '44', 'Caleb Moss', {
      actionContext: 'defense',
    });
    const intent = baseIntent({
      family: 'rush',
      subtype: null,
      primary: rusher,
      recoveredBy: recoverer,
      fumbler: { ...rusher, role: 'fumbler' },
      result: {
        code: 'fumble',
        yards: 5,
        endYardLine: 'H35',
        fumble: {
          fumblerPlayerId: 'H-22',
          spot: 'H35',
          recoveredByPlayerId: 'V-44',
          recoveredByTeam: 'V',
          recoverySpot: 'H35',
          turnover: true,
        },
        turnover: { type: 'fumble', team: 'V', playerId: 'V-44', spot: 'H35', recoveredBy: 'V' },
        nextPossession: 'V',
      },
      summary: 'HOM #22 Jordan Smith fumbled at the H35, recovered by #44 Caleb Moss for VIS at the H35.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid punt intent', () => {
    const intent = baseIntent({
      family: 'punt',
      subtype: 'returned',
      hotkey: 'U',
      primary: participant('punter', 'H', 'H-09', '9', 'Owen Clark', {
        actionContext: 'specialTeams',
      }),
      returner: participant('returner', 'V', 'V-03', '3', 'Davis', {
        resolutionSource: 'duplicateConfirmed',
        actionContext: 'specialTeams',
      }),
      prePlay: {
        possession: 'H',
        down: 4,
        distance: 8,
        yardLine: 'H32',
        lineToGain: 'H40',
        driveId: 'DRV-0003',
        driveNumber: 3,
      },
      result: {
        code: 'returned',
        endYardLine: 'V31',
        nextPossession: 'V',
        driveEnds: true,
        kick: { kickYards: 42, catchYardLine: 'V26' },
        return: { returnerPlayerId: 'V-03', returnYards: 5, returnStartYardLine: 'V26', returnEndYardLine: 'V31' },
      },
      summary: 'HOM #9 Owen Clark punt 42 yards to the V26, #3 Davis return for 5 yards to the V31.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid kickoff intent', () => {
    const intent = baseIntent({
      family: 'kickoff',
      subtype: 'touchback',
      hotkey: 'K',
      primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark', {
        actionContext: 'specialTeams',
      }),
      prePlay: {
        possession: null,
        down: null,
        distance: null,
        yardLine: null,
        lineToGain: null,
        driveId: null,
        driveNumber: 0,
      },
      result: { code: 'touchback', endYardLine: 'V25', nextPossession: 'V' },
      summary: 'HOM #9 Owen Clark kickoff into the end zone, touchback.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid field goal intent', () => {
    const intent = baseIntent({
      family: 'fieldGoal',
      subtype: 'made',
      hotkey: 'K',
      primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark', {
        actionContext: 'specialTeams',
      }),
      prePlay: {
        possession: 'H',
        down: 4,
        distance: 5,
        yardLine: 'V18',
        lineToGain: 'V13',
        driveId: 'DRV-0004',
        driveNumber: 4,
      },
      result: {
        code: 'made',
        endYardLine: 'V18',
        driveEnds: true,
        kick: { attemptYards: 28, kickSpot: 'V18' },
        scoring: { team: 'H', points: 3, type: 'fieldGoal' },
      },
      summary: 'HOM #9 Owen Clark 28-yard field goal good.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid PAT intent', () => {
    const intent = baseIntent({
      family: 'try',
      subtype: 'kick',
      startedBy: 'button',
      primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark', {
        actionContext: 'specialTeams',
      }),
      prePlay: {
        possession: 'H',
        down: null,
        distance: null,
        yardLine: 'V03',
        lineToGain: null,
        driveId: null,
        driveNumber: 4,
      },
      result: {
        code: 'made',
        kick: { kickSpot: 'V03' },
        scoring: { team: 'H', points: 1, type: 'patKick' },
      },
      summary: 'HOM #9 Owen Clark extra point good.',
    });

    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('accepts a valid penalty-only intent', () => {
    const intent = makePenaltyOnlyIntent();
    expect(validateFootballDraftIntent(intent).ok).toBe(true);
  });

  it('rejects invalid team codes', () => {
    const intent = makeRushIntent();
    intent.play.actionTeam = 'HOME' as never;

    expectInvalidCode(intent, 'INVALID_TEAM_CODE');
  });

  it('rejects invalid spots', () => {
    const intent = makeRushIntent();
    intent.prePlay.yardLine = 'H5' as never;

    expectInvalidCode(intent, 'INVALID_SPOT');
  });

  it('requires the kickoff touchback rule to use canonical spot format', () => {
    const intent = makeRushIntent();
    intent.game.rules = { kickoffTouchbackSpot: 'H25' };
    expect(validateFootballDraftIntent(intent).ok).toBe(true);

    intent.game.rules.kickoffTouchbackSpot = '25' as never;
    expectInvalidCode(intent, 'INVALID_SPOT');
  });

  it('rejects unresolved required players', () => {
    const intent = makeRushIntent();
    intent.participants.primary!.playerId = '';

    expectInvalidCode(intent, 'UNRESOLVED_PLAYER');
  });

  it('blocks confirmation when a penalty is pending', () => {
    const intent = makePenaltyOnlyIntent();
    intent.penalties[0].status = 'pending';
    intent.penalties[0].accepted = false;

    expectInvalidCode(intent, 'PENALTY_PENDING');
  });

  it('accepts offsetting penalties with both teams and explicit play-count decision', () => {
    const playCounts = makeOffsettingPenaltyIntent(true);
    const playCancelled = makeOffsettingPenaltyIntent(false);

    expect(validateFootballDraftIntent(playCounts).ok).toBe(true);
    expect(validateFootballDraftIntent(playCancelled).ok).toBe(true);
  });

  it('rejects offsetting penalties without explicit play-count decision', () => {
    const intent = makeOffsettingPenaltyIntent(false);
    delete intent.penalties[0].offsetting;

    expectInvalidCode(intent, 'INVALID_PENALTY');
  });

  it('rejects offsetting penalties without one penalty on each team', () => {
    const intent = makeOffsettingPenaltyIntent(false);
    intent.penalties[1].team = 'H';

    expectInvalidCode(intent, 'INVALID_PENALTY');
  });

  it('rejects stale summary revisions', () => {
    const intent = makeRushIntent();
    intent.confirmation!.summaryRevision = intent.revision - 1;

    expectInvalidCode(intent, 'SUMMARY_STALE');
  });

  it('does not mutate the input object', () => {
    const intent = makeRushIntent();
    const before = clone(intent);

    validateFootballDraftIntent(intent);

    expect(intent).toEqual(before);
  });
});

function expectInvalidCode(intent: FootballDraftIntent, code: FootballIntentValidationErrorCode) {
  const result = validateFootballDraftIntent(intent);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.map((error) => error.code)).toContain(code);
  }
}

function makeRushIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'rush',
    subtype: null,
    hotkey: 'R',
    primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
    defenders: [participant('tackler', 'V', 'V-44', '44', 'Caleb Moss', { actionContext: 'defense' })],
    result: { code: 'tackle', yards: 7, endYardLine: 'V49', firstDown: true, driveEnds: false },
    summary: 'HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.',
  });
}

function makePenaltyOnlyIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'penalty',
    subtype: 'accepted',
    hotkey: 'E',
    actionTeam: 'V',
    primary: undefined,
    result: { code: 'accepted', endYardLine: 'H48', firstDown: false },
    penalties: [
      {
        penaltyId: 'pen-1',
        team: 'V',
        code: 'OFF',
        name: 'Offside',
        yards: 5,
        resolution: 'accepted',
        enforcedFrom: 'PREVIOUS',
        finalSpot: 'H48',
        downConsequence: 'REPEAT',
        source: 'immediate',
        status: 'accepted',
        accepted: true,
        automaticFirstDown: false,
        lossOfDown: false,
        replayDown: false,
        liveBall: true,
      },
    ],
    summary: 'Penalty: Offside on VIS, 5 yards from the previous spot, accepted.',
  });
}

function makeOffsettingPenaltyIntent(previousPlayCounts: boolean): FootballDraftIntent {
  return baseIntent({
    family: 'penalty',
    subtype: 'offsetting',
    hotkey: 'E',
    actionTeam: 'H',
    primary: undefined,
    result: { code: 'offsetting', endYardLine: 'H44', firstDown: false },
    penalties: [
      offsettingPenalty('pen-h', 'H', previousPlayCounts),
      offsettingPenalty('pen-v', 'V', previousPlayCounts),
    ],
    summary: previousPlayCounts
      ? 'Offsetting penalties after the play. Previous play counts.'
      : 'Offsetting penalties. Previous play does not count.',
  });
}

function offsettingPenalty(
  penaltyId: string,
  team: 'H' | 'V',
  previousPlayCounts: boolean,
): FootballDraftIntent['penalties'][number] {
  return {
    penaltyId,
    team,
    code: team === 'H' ? 'OH' : 'DH',
    name: team === 'H' ? 'Offensive Holding' : 'Defensive Holding',
    yards: 0,
    enforcedFrom: 'PREVIOUS',
    status: 'offsetting',
    accepted: false,
    automaticFirstDown: false,
    lossOfDown: false,
    replayDown: true,
    liveBall: true,
    offsetting: { previousPlayCounts },
  };
}

function baseIntent(options: {
  family: FootballDraftIntent['play']['family'];
  subtype: FootballDraftIntent['play']['subtype'];
  hotkey?: string;
  startedBy?: FootballDraftIntent['source']['startedBy'];
  actionTeam?: 'H' | 'V';
  primary?: DraftParticipant;
  secondary?: DraftParticipant;
  defenders?: DraftParticipant[];
  returner?: DraftParticipant;
  fumbler?: DraftParticipant;
  recoveredBy?: DraftParticipant;
  prePlay?: FootballDraftIntent['prePlay'];
  result: FootballDraftIntent['result'];
  penalties?: FootballDraftIntent['penalties'];
  summary: string;
}): FootballDraftIntent {
  const revision = 2;
  return {
    schemaVersion: 'football.draftIntent.v1',
    intentId: `intent-${options.family}-${options.subtype ?? 'base'}`,
    clientEventId: `client-${options.family}-${options.subtype ?? 'base'}`,
    status: 'confirmed',
    createdAt: '2026-06-20T00:00:00Z',
    updatedAt: '2026-06-20T00:00:05Z',
    revision,
    game: {
      gameId: 'FB-1001',
      teams: {
        H: { team: 'H', teamId: 'TEAM-H', name: 'Home State', abbr: 'HOM' },
        V: { team: 'V', teamId: 'TEAM-V', name: 'Visitor Tech', abbr: 'VIS' },
      },
    },
    source: {
      kind: 'fcqi',
      startedBy: options.startedBy ?? 'hotkey',
      hotkey: options.hotkey,
      startedAt: '2026-06-20T00:00:00Z',
      baseEnvelopeVersion: '2026-06-20T00:00:00Z',
      baseEventSequence: 41,
      sessionId: 'scorer-session-1',
      userId: 'user-123',
    },
    play: {
      family: options.family,
      subtype: options.subtype,
      actionTeam: options.actionTeam ?? 'H',
      possession: 'H',
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
      ...(options.recoveredBy ? { recoveredBy: options.recoveredBy } : {}),
      defenders: options.defenders ?? [],
      penalizedPlayers: [],
      others: [],
    },
    result: options.result,
    penalties: options.penalties ?? [],
    warnings: [],
    confirmation: {
      summaryText: options.summary,
      summaryRevision: revision,
      confirmedAt: '2026-06-20T00:00:05Z',
      confirmedByUserId: 'user-123',
      operatorAction: 'confirmSubmit',
      penaltiesReviewed: true,
      warningsAcknowledged: [],
    },
  };
}

function participant(
  role: DraftParticipantRole,
  team: 'H' | 'V',
  playerId: string,
  jersey: string,
  displayName: string,
  options: {
    position?: string;
    resolutionSource?: DraftParticipant['resolution']['source'];
    actionContext?: DraftParticipant['resolution']['actionContext'];
  } = {},
): DraftParticipant {
  return {
    participantId: `${role}-${playerId}`,
    playerId,
    team,
    role,
    jersey,
    displayName,
    position: options.position ?? defaultPosition(role),
    resolution: {
      source: options.resolutionSource ?? 'singleMatch',
      jerseyToken: jersey,
      teamScope: team,
      duplicateCandidateIds: options.resolutionSource === 'duplicateConfirmed' ? [`${playerId}-A`, `${playerId}-B`] : undefined,
      recommendedPlayerId: options.resolutionSource === 'duplicateConfirmed' ? playerId : undefined,
      selectedRecommended: options.resolutionSource === 'duplicateConfirmed' ? true : undefined,
      actionContext: options.actionContext ?? (team === 'H' ? 'offense' : 'defense'),
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
  return 'LB';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
