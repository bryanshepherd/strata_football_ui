import { describe, expect, it } from 'vitest';
import { buildFootballEvent } from './footballEventBuilder';
import { generateFootballPlaySummary } from './footballPlaySummaryGrammar';
import type {
  DraftParticipant,
  DraftParticipantRole,
  FootballDraftIntent,
} from './footballIntentSchema';

describe('footballEventBuilder', () => {
  it('builds valid rush event', () => {
    const result = expectBuilt(makeRushIntent());

    expect(result.event).toMatchObject({
      clientEventId: 'client-rush-base',
      type: 'rush',
      subtype: null,
      possession: 'H',
      preState: {
        possession: 'H',
        down: 2,
        distance: 6,
        yardLine: 'H44',
        lineToGain: '50',
        driveId: 'DRV-0002',
        driveNumber: 2,
      },
      participants: {
        primary: { playerId: 'H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [{ playerId: 'V-44', team: 'V', role: 'tackler' }],
      },
      result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
      penalties: [],
      description: 'HOM #22 Jordan Smith rush for 7 yards to the V49, for a first down, tackled by #44 Caleb Moss.',
    });
    expect(result.event).not.toHaveProperty('eventId');
    expect(result.event).not.toHaveProperty('sequence');
    expect(result.event).not.toHaveProperty('status');
    expect(result.event).not.toHaveProperty('acceptedAt');
    expect(result.event).not.toHaveProperty('postState');
    expect(result.event).not.toHaveProperty('source');
    expect(result.event).not.toHaveProperty('confirmation');
    expect(result.event).not.toHaveProperty('warnings');
  });

  it.each([
    ['normal', { code: 'tackle' as const, yards: 4, endYardLine: 'H48' as const }],
    ['loss', { code: 'tackle' as const, yards: -2, endYardLine: 'H42' as const }],
    ['out of bounds', { code: 'outOfBounds' as const, yards: 5, endYardLine: 'H49' as const }],
  ])('builds canonical %s Rush outcome', (_label, resultShape) => {
    const result = expectBuilt(baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: resultShape,
    }));

    expect(result.event.result).toMatchObject(resultShape);
  });

  it('builds complete pass', () => {
    const result = expectBuilt(
      baseIntent({
        family: 'pass',
        subtype: 'complete',
        primary: participant('passer', 'H', 'H-12', '12', 'Mason Reed'),
        secondary: participant('receiver', 'H', 'H-88', '88', 'Eli Grant'),
        result: {
          code: 'complete',
          yards: 12,
          endYardLine: 'V37',
          pass: { targetPlayerId: 'H-88', completed: true },
        },
      }),
    );

    expect(result.event.type).toBe('pass');
    expect(result.event.subtype).toBe('complete');
    expect(result.event.participants.primary).toEqual({ playerId: 'H-12', team: 'H', role: 'passer' });
    expect(result.event.participants.secondary).toEqual({ playerId: 'H-88', team: 'H', role: 'receiver' });
    expect(result.event.result.pass).toEqual({ targetPlayerId: 'H-88', completed: true });
  });

  it('builds incomplete pass', () => {
    const result = expectBuilt(
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
    );

    expect(result.event.result.code).toBe('incomplete');
    expect(result.event.participants.secondary?.role).toBe('intendedReceiver');
  });

  it('builds sack', () => {
    const result = expectBuilt(
      baseIntent({
        family: 'pass',
        subtype: 'sack',
        primary: participant('sackVictim', 'H', 'H-12', '12', 'Mason Reed'),
        defenders: [participant('sack', 'V', 'V-44', '44', 'Caleb Moss')],
        result: { code: 'sack', yards: -6, endYardLine: 'V43' },
      }),
    );

    expect(result.event.type).toBe('pass');
    expect(result.event.subtype).toBe('sack');
    expect(result.event.participants.defenders).toEqual([{ playerId: 'V-44', team: 'V', role: 'sack' }]);
  });

  it('builds interception with turnover metadata', () => {
    const result = expectBuilt(makeInterceptionIntent());

    expect(result.event.result.turnover).toEqual({
      type: 'interception',
      team: 'V',
      playerId: 'V-03',
      spot: 'H42',
      returnYards: 18,
      returnEndYardLine: 'H24',
      recoveredBy: 'V',
    });
    expect(result.event.result.nextPossession).toBe('V');
    expect(result.event.participants.defenders[0]).toEqual({ playerId: 'V-03', team: 'V', role: 'interceptor' });
  });

  it('builds fumble lost', () => {
    const result = expectBuilt(makeFumbleLostIntent());

    expect(result.event.type).toBe('rush');
    expect(result.event.result.fumble).toEqual({
      fumblerPlayerId: 'H-22',
      forcedByPlayerId: 'V-44',
      spot: 'H35',
      recoveredByPlayerId: 'V-04',
      recoveredByTeam: 'V',
      recoverySpot: 'H35',
      turnover: true,
    });
    expect(result.event.result.turnover).toEqual({ type: 'fumble', team: 'H', playerId: 'H-22', spot: 'H35', recoveredBy: 'V' });
  });

  it('builds a Rush touchdown with backend-projectable scoring metadata', () => {
    const result = expectBuilt(baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      result: { code: 'touchdown', yards: 56, scoring: { team: 'H', points: 6, type: 'touchdown' } },
    }));

    expect(result.event.result).toEqual({
      code: 'touchdown',
      yards: 56,
      scoring: { team: 'H', points: 6, type: 'touchdown' },
    });
    expect(result.event.description).toBe('HOM #22 Jordan Smith rush for 56 yards for a touchdown.');
  });

  it('builds an offensive fumble recovery without turnover metadata', () => {
    const result = expectBuilt(baseIntent({
      family: 'rush',
      subtype: null,
      primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
      fumbler: participant('fumbler', 'H', 'H-22', '22', 'Jordan Smith'),
      recoveredBy: participant('recoverer', 'H', 'H-70', '70', 'Avery Cole'),
      result: {
        code: 'fumble', yards: 5, endYardLine: 'H49',
        fumble: {
          fumblerPlayerId: 'H-22', recoveredByPlayerId: 'H-70', recoveredByTeam: 'H',
          recoverySpot: 'H49', turnover: false,
        },
      },
    }));

    expect(result.event.result.fumble).toMatchObject({ recoveredByPlayerId: 'H-70', recoveredByTeam: 'H', turnover: false });
    expect(result.event.result).not.toHaveProperty('turnover');
  });

  it('rejects a Rush fumble with an unresolved recovery identity', () => {
    const intent = makeFumbleLostIntent();
    delete intent.participants.recoveredBy;

    const result = buildFootballEvent(intent);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('UNRESOLVED_PLAYER');
  });

  it('blocks a duplicate jersey until the rusher has a stable selected identity', () => {
    const intent = makeRushIntent();
    delete intent.participants.primary;

    const result = buildFootballEvent(intent);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('MISSING_REQUIRED_PARTICIPANT');
  });

  it('keeps non-blocking Rush warnings separate from the canonical event', () => {
    const intent = makeRushIntent();
    intent.warnings = [{
      code: 'MISSING_OPTIONAL_DEFENDER', severity: 'warning', message: 'Second tackler omitted.', source: 'fcqi',
    }];

    const result = expectBuilt(intent);

    expect(result.warnings).toEqual(intent.warnings);
    expect(result.event).not.toHaveProperty('warnings');
  });

  it('builds punt return', () => {
    const result = expectBuilt(makePuntReturnIntent());

    expect(result.event.type).toBe('punt');
    expect(result.event.subtype).toBe('returned');
    expect(result.event.participants.primary).toEqual({ playerId: 'H-09', team: 'H', role: 'punter' });
    expect(result.event.participants.returner).toEqual({ playerId: 'V-03', team: 'V', role: 'returner' });
    expect(result.event.result.return).toEqual({
      returnerPlayerId: 'V-03',
      returnYards: 5,
      returnStartYardLine: 'V26',
      returnEndYardLine: 'V31',
    });
  });

  it('builds kickoff touchback', () => {
    const result = expectBuilt(makeKickoffTouchbackIntent());

    expect(result.event.type).toBe('kickoff');
    expect(result.event.possession).toBeNull();
    expect(result.event.preState).toEqual(possessionFreePrePlay());
    expect(result.event.result).toMatchObject({ code: 'touchback', endYardLine: 'V25', nextPossession: 'V' });
  });

  it('builds kickoff return with scoped terminal result metadata', () => {
    const result = expectBuilt(makeKickoffReturnIntent());

    expect(result.event.type).toBe('kickoff');
    expect(result.event.subtype).toBe('returned');
    expect(result.event.participants.primary).toEqual({ playerId: 'H-09', team: 'H', role: 'kicker' });
    expect(result.event.participants.returner).toEqual({ playerId: 'V-03', team: 'V', role: 'returner' });
    expect(result.event.result.kick).toEqual({ kickYards: 45, catchYardLine: 'V20', receiveResultCode: 'R' });
    expect(result.event.result.return).toEqual({
      type: 'Kickoff',
      returnerPlayerId: 'V-03',
      returnYards: 11,
      returnStartYardLine: 'V20',
      returnEndYardLine: 'V31',
      resultCode: 'T',
      tackledByPlayerIds: ['H-22'],
    });
  });

  it('builds field goal good', () => {
    const result = expectBuilt(makeFieldGoalIntent());

    expect(result.event.type).toBe('fieldGoal');
    expect(result.event.subtype).toBe('made');
    expect(result.event.result.kick).toEqual({ attemptYards: 28, kickSpot: 'V18' });
    expect(result.event.result.scoring).toEqual({ team: 'H', points: 3, type: 'fieldGoal' });
  });

  it('builds PAT good', () => {
    const result = expectBuilt(makePatIntent());

    expect(result.event.type).toBe('try');
    expect(result.event.subtype).toBe('kick');
    expect(result.event.result.scoring).toEqual({ team: 'H', points: 1, type: 'patKick' });
  });

  it('builds penalty-only accepted', () => {
    const result = expectBuilt(makePenaltyOnlyIntent());

    expect(result.event.type).toBe('penalty');
    expect(result.event.result.code).toBe('accepted');
    expect(result.event.penalties).toEqual([
      {
        penaltyId: 'pen-1',
        team: 'V',
        code: 'OFF',
        name: 'Offside',
        yards: 5,
        resolution: 'accepted',
        enforcedFrom: 'PREVIOUS',
        finalSpot: 'H49',
        downConsequence: 'REPEAT',
        source: 'immediate',
        status: 'accepted',
        accepted: true,
      },
    ]);
  });

  it('rejects unconfirmed draft', () => {
    const intent = makeRushIntent();
    intent.status = 'readyForSummary';
    delete intent.confirmation;

    const result = buildFootballEvent(intent);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toContain('UNCONFIRMED_DRAFT');
    }
  });

  it('rejects stale summary revision', () => {
    const intent = makeRushIntent();
    intent.confirmation!.summaryRevision = intent.revision - 1;

    const result = buildFootballEvent(intent);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toContain('SUMMARY_STALE');
    }
  });

  it('preserves clientEventId', () => {
    const result = expectBuilt(makeRushIntent());

    expect(result.event.clientEventId).toBe('client-rush-base');
    expect(result.submitRequest.clientContext.clientEventId).toBe('client-rush-base');
    expect(result.submitRequest.event.clientEventId).toBe('client-rush-base');
  });

  it('rejects a confirmation whose text no longer matches regenerated Rush grammar', () => {
    const intent = makeRushIntent();
    intent.confirmation!.summaryText = 'Operator-confirmed custom summary.';

    const result = buildFootballEvent(intent);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain('SUMMARY_STALE');
  });

  it('does not mutate input', () => {
    const intent = makeInterceptionIntent();
    const before = clone(intent);

    buildFootballEvent(intent);

    expect(intent).toEqual(before);
  });
});

function expectBuilt(intent: FootballDraftIntent): Extract<ReturnType<typeof buildFootballEvent>, { ok: true }> {
  const result = buildFootballEvent(intent);
  if (!result.ok) {
    throw new Error(`Expected build to succeed: ${result.errors.map((error) => `${error.code}:${error.field ?? ''}`).join(', ')}`);
  }
  expect(result.ok).toBe(true);
  expect(result.submitRequest.schemaVersion).toBe('football.submitEventRequest.v1');
  expect(result.submitRequest.gameId).toBe('FB-1001');
  expect(result.submitRequest.event).toBe(result.event);
  expect(result.submitRequest.clientContext).toMatchObject({
    clientEventId: intent.clientEventId,
    sessionId: 'scorer-session-1',
    userId: 'user-123',
    submittedAt: '2026-06-20T00:00:05Z',
    baseEnvelopeVersion: '2026-06-20T00:00:00Z',
    baseEventSequence: 41,
  });
  if (intent.play.family === 'rush') {
    expect(result.event).not.toHaveProperty('source');
    expect(result.event).not.toHaveProperty('confirmation');
    expect(result.event).not.toHaveProperty('warnings');
  } else {
    expect(result.event.source).toEqual({
      kind: 'fcqi',
      draftIntentId: intent.intentId,
      draftRevision: intent.revision,
      summaryRevision: intent.confirmation!.summaryRevision,
      confirmedAt: '2026-06-20T00:00:05Z',
    });
  }
  expect(result.warnings).toEqual(intent.warnings);
  return result;
}

function makeRushIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'rush',
    subtype: null,
    primary: participant('rusher', 'H', 'H-22', '22', 'Jordan Smith'),
    defenders: [participant('tackler', 'V', 'V-44', '44', 'Caleb Moss')],
    result: { code: 'tackle', yards: 7, endYardLine: 'V49', firstDown: true, driveEnds: false },
  });
}

function makeInterceptionIntent(): FootballDraftIntent {
  return baseIntent({
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
      nextPossession: 'V',
      driveEnds: true,
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
  });
}

function makeFumbleLostIntent(): FootballDraftIntent {
  return baseIntent({
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
      nextPossession: 'V',
      driveEnds: true,
      fumble: {
        fumblerPlayerId: 'H-22',
        forcedByPlayerId: 'V-44',
        spot: 'H35',
        recoveredByPlayerId: 'V-04',
        recoveredByTeam: 'V',
        recoverySpot: 'H35',
        turnover: true,
      },
      turnover: { type: 'fumble', team: 'V', playerId: 'V-04', spot: 'H35', recoveredBy: 'V' },
    },
  });
}

function makePuntReturnIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'punt',
    subtype: 'returned',
    primary: participant('punter', 'H', 'H-09', '9', 'Owen Clark'),
    returner: participant('returner', 'V', 'V-03', '3', 'Davis'),
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
  });
}

function makeKickoffTouchbackIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'kickoff',
    subtype: 'touchback',
    primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
    prePlay: possessionFreePrePlay(),
    result: { code: 'touchback', endYardLine: 'V25', nextPossession: 'V' },
  });
}

function makeKickoffReturnIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'kickoff',
    subtype: 'returned',
    primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
    returner: participant('returner', 'V', 'V-03', '3', 'Davis'),
    defenders: [participant('tackler', 'H', 'H-22', '22', 'Jordan Smith')],
    prePlay: possessionFreePrePlay(),
    result: {
      code: 'returned',
      endYardLine: 'V31',
      nextPossession: 'V',
      driveEnds: false,
      kick: { kickYards: 45, catchYardLine: 'V20', receiveResultCode: 'R' },
      return: {
        type: 'Kickoff',
        returnerPlayerId: 'V-03',
        returnYards: 11,
        returnStartYardLine: 'V20',
        returnEndYardLine: 'V31',
        resultCode: 'T',
        tackledByPlayerIds: ['H-22'],
      },
    },
  });
}

function makeFieldGoalIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'fieldGoal',
    subtype: 'made',
    primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
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
  });
}

function makePatIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'try',
    subtype: 'kick',
    primary: participant('kicker', 'H', 'H-09', '9', 'Owen Clark'),
    prePlay: possessionFreePrePlay('V03'),
    result: {
      code: 'made',
      kick: { kickSpot: 'V03' },
      scoring: { team: 'H', points: 1, type: 'patKick' },
    },
  });
}

function makePenaltyOnlyIntent(): FootballDraftIntent {
  return baseIntent({
    family: 'penalty',
    subtype: 'accepted',
    actionTeam: 'V',
    primary: undefined,
    result: { code: 'accepted', endYardLine: 'H49' },
    penalties: [
      {
        penaltyId: 'pen-1',
        team: 'V',
        code: 'OFF',
        name: 'Offside',
        yards: 5,
        resolution: 'accepted',
        enforcedFrom: 'PREVIOUS',
        finalSpot: 'H49',
        downConsequence: 'REPEAT',
        source: 'immediate',
        status: 'accepted',
        accepted: true,
      },
    ],
  });
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
  prePlay?: FootballDraftIntent['prePlay'];
  result: FootballDraftIntent['result'];
  penalties?: FootballDraftIntent['penalties'];
}): FootballDraftIntent {
  const revision = 2;
  const intent: FootballDraftIntent = {
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
      startedBy: 'hotkey',
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
      penalizedPlayers: [],
      others: [],
    },
    result: options.result,
    penalties: options.penalties ?? [],
    warnings: [],
    confirmation: {
      summaryText: '',
      summaryRevision: revision,
      confirmedAt: '2026-06-20T00:00:05Z',
      confirmedByUserId: 'user-123',
      operatorAction: 'confirmSubmit',
      penaltiesReviewed: true,
      warningsAcknowledged: [],
    },
  };

  intent.confirmation!.summaryText = generateFootballPlaySummary(intent).summaryText;
  return intent;
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
      actionContext: actionContextForRole(role, team),
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

function actionContextForRole(role: DraftParticipantRole, team: 'H' | 'V'): DraftParticipant['resolution']['actionContext'] {
  if (role === 'kicker' || role === 'punter' || role === 'returner' || role === 'holder') return 'specialTeams';
  if (team === 'V' || ['tackler', 'assistTackler', 'sack', 'passBreakup', 'interceptor', 'forcedFumble', 'recoverer', 'blocker'].includes(role)) {
    return 'defense';
  }
  return 'offense';
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
