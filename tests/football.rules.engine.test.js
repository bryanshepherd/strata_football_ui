import { describe, expect, it } from 'vitest';
import { gameEnvelopeFixtures } from '../src/data/footballGameEnvelopeFixtures';
import {
  applyFootballEventToEnvelope,
  calculateLineToGain,
  calculateYardsGained,
  calculateYardsToGain,
  isGoalToGo,
  isRedZone,
  parseSpot,
  possessionRelativeToSpot,
  spotToPossessionRelative,
} from '../src/utils/footballRulesEngine';

const normalEnvelope = gameEnvelopeFixtures.normal;

describe('footballRulesEngine field math', () => {
  it.each([
    ['h25', 'H25', 'H', 25],
    ['v00', 'V00', 'V', 0],
    ['H00', 'H00', 'H', 0],
    ['h5', 'H05', 'H', 5],
  ])('normalizes yard-line input %s to %s', (input, canonical, side, yard) => {
    expect(parseSpot(input)).toMatchObject({ raw: canonical, valid: true, side, yard });
  });

  it('calculates possession-relative spots for H and V in both field directions', () => {
    expect(spotToPossessionRelative('H25', 'H')).toBe(25);
    expect(spotToPossessionRelative('V25', 'H')).toBe(75);
    expect(spotToPossessionRelative('V25', 'V')).toBe(25);
    expect(spotToPossessionRelative('H25', 'V')).toBe(75);
    expect(spotToPossessionRelative('50', 'H')).toBe(50);
    expect(spotToPossessionRelative('50', 'V')).toBe(50);
    expect(spotToPossessionRelative('goal', 'H')).toBe(100);
    expect(spotToPossessionRelative('goal', 'V')).toBe(100);
  });

  it('converts relative spots back to canonical yard-line strings', () => {
    expect(possessionRelativeToSpot(25, 'H')).toBe('H25');
    expect(possessionRelativeToSpot(75, 'H')).toBe('V25');
    expect(possessionRelativeToSpot(25, 'V')).toBe('V25');
    expect(possessionRelativeToSpot(75, 'V')).toBe('H25');
    expect(possessionRelativeToSpot(50, 'H')).toBe('50');
  });

  it('calculates yards gained in either possession direction', () => {
    expect(calculateYardsGained('H44', 'V46', 'H')).toBe(10);
    expect(calculateYardsGained('V44', 'H46', 'V')).toBe(10);
    expect(calculateYardsGained('V20', 'V15', 'V')).toBe(-5);
  });

  it('defines line-to-gain, red zone, and goal-to-go from canonical state', () => {
    expect(calculateLineToGain('H44', 'H')).toBe('V46');
    expect(calculateYardsToGain('H44', '50', 'H')).toBe(6);
    expect(calculateLineToGain('H05', 'V')).toBe('goal');
    expect(calculateYardsToGain('H05', 'goal', 'V')).toBe(5);
    expect(isRedZone('H18', 'V')).toBe(true);
    expect(isGoalToGo('H05', 'goal', 'V')).toBe(true);
  });
});

describe('footballRulesEngine event application', () => {
  it('treats a completed pass ending at goal as a touchdown without requiring an explicit scoring object', () => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-pass-goal-touchdown',
      type: 'pass',
      subtype: 'complete',
      period: 1,
      clock: '08:42',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: { code: 'complete', yards: 56, endYardLine: 'goal' },
      penalties: [],
    });

    expect(result.driveTransition.driveResult).toBe('touchdown');
    expect(result.liveState).toMatchObject({
      possession: null,
      yardLine: 'V03',
      pendingTryTeam: 'H',
      nextPlayContext: 'awaitingTry',
    });
    expect(result.scoringUpdate).toEqual({ team: 'H', points: 6, type: 'touchdown' });
  });

  it('keeps a try pending after a standalone pre-snap penalty', () => {
    const awaitingTryEnvelope = {
      ...normalEnvelope,
      liveState: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'V03',
        lineToGain: null,
        goalToGo: false,
        redZone: false,
        driveId: null,
        driveNumber: 3,
        pendingTryTeam: 'H',
        kickoffTeam: null,
        nextPlayContext: 'awaitingTry',
      },
    };
    const result = applyFootballEventToEnvelope(awaitingTryEnvelope, {
      clientEventId: 'test-pending-try-penalty',
      type: 'penalty',
      subtype: 'accepted',
      possession: null,
      preState: awaitingTryEnvelope.liveState,
      result: { code: 'accepted', endYardLine: 'V01' },
      penalties: [{
        penaltyId: 'pen-try-offside',
        team: 'V',
        status: 'accepted',
        enforcedFrom: 'previousSpot',
        finalSpot: 'V01',
        replayDown: true,
      }],
    });

    expect(result.liveState).toEqual({
      possession: null,
      down: null,
      distance: null,
      yardLine: 'V01',
      lineToGain: null,
      goalToGo: false,
      redZone: false,
      driveId: null,
      driveNumber: 3,
      pendingTryTeam: 'H',
      kickoffTeam: null,
      nextPlayContext: 'awaitingTry',
    });
    expect(result.driveTransition).toMatchObject({
      shouldEndCurrent: false,
      shouldStartNew: false,
      reason: 'penaltyDuringSetup',
    });
    expect(result.yardsGained).toBeNull();
    expect(result.firstDown).toBe(false);
  });

  it('calculates a normal first down without mutating the envelope', () => {
    const event = {
      clientEventId: 'test-first-down',
      type: 'rush',
      period: 1,
      clock: '08:42',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'tackle',
        endYardLine: 'V46',
      },
      penalties: [],
    };

    const result = applyFootballEventToEnvelope(normalEnvelope, event);

    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 1,
      distance: 10,
      yardLine: 'V46',
      lineToGain: 'V36',
      goalToGo: false,
      redZone: false,
      driveId: 'DRV-0002',
    });
    expect(result.firstDown).toBe(true);
    expect(result.driveTransition.shouldEndCurrent).toBe(false);
    expect(normalEnvelope.liveState.yardLine).toBe('H44');
  });

  it('keeps lineToGain explicit when a drive continues', () => {
    const event = {
      clientEventId: 'test-short-gain',
      type: 'rush',
      period: 1,
      clock: '08:42',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'tackle',
        endYardLine: 'H48',
      },
      penalties: [],
    };

    const result = applyFootballEventToEnvelope(normalEnvelope, event);

    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 3,
      distance: 2,
      yardLine: 'H48',
      lineToGain: '50',
      driveId: 'DRV-0002',
    });
  });

  it('sets goal-to-go and red-zone after a first down inside the 10', () => {
    const envelope = gameEnvelopeFixtures.redzone;
    const event = {
      clientEventId: 'test-goal-to-go',
      type: 'pass',
      period: 2,
      clock: '04:11',
      possession: 'H',
      preState: envelope.liveState,
      result: {
        code: 'complete',
        endYardLine: 'V05',
      },
      penalties: [],
    };

    const result = applyFootballEventToEnvelope(envelope, event);

    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 1,
      distance: 5,
      yardLine: 'V05',
      lineToGain: 'goal',
      goalToGo: true,
      redZone: true,
    });
  });

  it('ends the drive and starts a receiving drive on kickoff without bogus result text', () => {
    const event = gameEnvelopeFixtures.kickoffDrive.events[0];
    const result = applyFootballEventToEnvelope(gameEnvelopeFixtures.pregame, event);

    expect(result.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'V25',
      lineToGain: 'V35',
      goalToGo: false,
      redZone: false,
    });
    expect(result.driveTransition).toMatchObject({
      shouldEndCurrent: false,
      shouldStartNew: true,
      driveResult: null,
      reason: 'kickoff',
    });
    expect(result.driveTransition.startedDrive).toMatchObject({
      team: 'V',
      startYardLine: 'V25',
      startReason: 'kickoff',
      result: null,
    });
    expect(JSON.stringify(result.driveTransition)).not.toMatch(/returned|received/i);
  });

  it('keeps the kicking team in kickoff context after an accepted Free Kick Infraction rekick', () => {
    const result = applyFootballEventToEnvelope(gameEnvelopeFixtures.pregame, {
      clientEventId: 'test-free-kick-infraction-rekick',
      type: 'kickoff',
      subtype: 'outOfBounds',
      period: 1,
      clock: '15:00',
      possession: null,
      preState: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'H35',
        lineToGain: null,
        driveId: null,
        driveNumber: 0,
      },
      participants: {
        primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-9', team: 'H', role: 'kicker' },
      },
      result: {
        code: 'outOfBounds',
        endYardLine: 'H30',
        nextPossession: 'V',
        kick: { receiveResultCode: 'O' },
      },
      penalties: [{
        penaltyId: 'test-fki',
        code: 'FKI',
        team: 'H',
        playerId: 'H-9',
        timing: 'liveBall',
        status: 'accepted',
        yards: 5,
        enforcedFrom: 'previousSpot',
        finalSpot: 'H30',
        replayDown: true,
      }],
    });

    expect(result.liveState).toMatchObject({
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H30',
      lineToGain: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    });
    expect(result.driveTransition).toMatchObject({
      shouldEndCurrent: false,
      shouldStartNew: false,
      driveResult: 'rekick',
      reason: 'freeKickInfraction',
    });
  });

  it('starts the receiving drive at the operator-entered spot after an out-of-bounds free kick', () => {
    const result = applyFootballEventToEnvelope(gameEnvelopeFixtures.pregame, {
      clientEventId: 'test-free-kick-out-of-bounds-spot',
      type: 'kickoff',
      subtype: 'outOfBounds',
      period: 1,
      clock: '15:00',
      possession: null,
      preState: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'H35',
        lineToGain: null,
        driveId: null,
        driveNumber: 0,
      },
      participants: {
        primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-9', team: 'H', role: 'kicker' },
      },
      result: {
        code: 'outOfBounds',
        endYardLine: 'V35',
        nextPossession: 'V',
        kick: { receiveResultCode: 'O', catchYardLine: 'V35', kickYards: 30 },
      },
      penalties: [],
    });

    expect(result.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      yardLine: 'V35',
      lineToGain: 'V45',
    });
    expect(result.driveTransition).toMatchObject({
      shouldStartNew: true,
      startedDrive: { team: 'V', startYardLine: 'V35', startReason: 'kickoff' },
    });
  });

  it('starts a kicking-team drive by fumble recovery when it recovers the kickoff return', () => {
    const result = applyFootballEventToEnvelope(gameEnvelopeFixtures.pregame, {
      clientEventId: 'test-kickoff-return-fumble',
      type: 'kickoff',
      subtype: 'returned',
      period: 2,
      clock: '06:46',
      possession: null,
      preState: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'H35',
        lineToGain: null,
        driveId: null,
        driveNumber: 9,
      },
      participants: {
        primary: { playerId: 'H-36', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-36', team: 'H', role: 'kicker' },
        returner: { playerId: 'V-85', team: 'V', role: 'returner' },
        fumbler: { playerId: 'V-85', team: 'V', role: 'returner' },
        recoveredBy: { playerId: 'H-31', team: 'H', role: 'recoverer' },
      },
      result: {
        code: 'returned',
        endYardLine: 'V28',
        nextPossession: 'H',
        fumble: {
          fumblerPlayerId: 'V-85',
          spot: 'V26',
          recoveredByPlayerId: 'H-31',
          recoveredByTeam: 'H',
          recoverySpot: 'V28',
          turnover: true,
        },
        turnover: {
          type: 'fumble',
          team: 'H',
          playerId: 'H-31',
          spot: 'V28',
          recoveredBy: 'H',
          returnEndYardLine: 'V28',
        },
      },
      penalties: [],
    });

    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 1,
      yardLine: 'V28',
      lineToGain: 'V18',
    });
    expect(result.driveTransition).toMatchObject({
      shouldEndCurrent: false,
      shouldStartNew: true,
      driveResult: null,
      reason: 'fumbleRecovery',
      startedDrive: {
        team: 'H',
        startYardLine: 'V28',
        startReason: 'fumbleRecovery',
      },
    });
  });

  it('ends punts and starts the receiving team drive', () => {
    const event = {
      clientEventId: 'test-punt',
      type: 'punt',
      subtype: 'fairCatch',
      period: 2,
      clock: '11:02',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 4,
        distance: 8,
        yardLine: 'H32',
        lineToGain: 'H40',
        driveId: 'DRV-0003',
        driveNumber: 3,
      },
      result: {
        code: 'fairCatch',
        endYardLine: 'V26',
        driveEnds: true,
        nextPossession: 'V',
      },
      penalties: [],
    };

    const result = applyFootballEventToEnvelope(normalEnvelope, event);

    expect(result.driveTransition).toMatchObject({
      shouldEndCurrent: true,
      shouldStartNew: true,
      endedDriveId: 'DRV-0003',
      driveResult: 'punt',
    });
    expect(result.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'V26',
      lineToGain: 'V36',
    });
  });

  it('handles turnovers and turnover on downs', () => {
    const turnoverEvent = gameEnvelopeFixtures.possessionChange.events[0];
    const turnover = applyFootballEventToEnvelope(gameEnvelopeFixtures.normal, turnoverEvent);

    expect(turnover.driveTransition).toMatchObject({
      shouldEndCurrent: true,
      shouldStartNew: true,
      driveResult: 'turnover',
    });
    expect(turnover.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'V31',
      lineToGain: 'V41',
    });

    const turnoverOnDowns = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-turnover-on-downs',
      type: 'rush',
      period: 4,
      clock: '02:00',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 4,
        distance: 2,
        yardLine: 'V40',
        lineToGain: 'V38',
        driveId: 'DRV-0010',
        driveNumber: 10,
      },
      result: {
        code: 'tackle',
        endYardLine: 'V39',
      },
      penalties: [],
    });

    expect(turnoverOnDowns.driveTransition).toMatchObject({
      shouldEndCurrent: true,
      shouldStartNew: true,
      endedDriveId: 'DRV-0010',
      driveResult: 'turnoverOnDowns',
    });
    expect(turnoverOnDowns.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      yardLine: 'V39',
      lineToGain: 'V49',
    });
  });

  it('handles scoring, safeties, field goals, and try context as drive-ending or inactive states', () => {
    const touchdown = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-td',
      type: 'rush',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'touchdown',
        endYardLine: 'V00',
        scoring: { team: 'H', points: 6, type: 'touchdown' },
      },
      penalties: [],
    });
    expect(touchdown.driveTransition.driveResult).toBe('touchdown');
    expect(touchdown.liveState).toMatchObject({
      possession: null,
      yardLine: 'V03',
      lineToGain: null,
      pendingTryTeam: 'H',
      nextPlayContext: 'awaitingTry',
    });
    expect(touchdown.scoringUpdate).toEqual({ team: 'H', points: 6, type: 'touchdown' });

    const safety = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-safety',
      type: 'rush',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'safety',
        endYardLine: 'H00',
        scoring: { team: 'V', points: 2, type: 'safety' },
      },
      penalties: [],
    });
    expect(safety.driveTransition.driveResult).toBe('safety');
    expect(safety.liveState).toMatchObject({
      possession: null,
      yardLine: 'H20',
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingSafetyKick',
    });

    const fieldGoal = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-fg',
      type: 'fieldGoal',
      subtype: 'made',
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'made',
        endYardLine: 'V18',
        points: 3,
        scoring: { team: 'H', points: 3, type: 'fieldGoal' },
      },
      penalties: [],
    });
    expect(fieldGoal.driveTransition.driveResult).toBe('fieldGoal');
    expect(fieldGoal.liveState).toMatchObject({
      possession: null,
      down: null,
      yardLine: 'H35',
      pendingTryTeam: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    });

    const tryResult = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-try',
      type: 'try',
      subtype: 'kick',
      possession: 'H',
      preState: {
        possession: 'H',
        down: null,
        distance: null,
        yardLine: 'V03',
        lineToGain: null,
        driveId: null,
        driveNumber: 3,
      },
      result: {
        code: 'made',
        points: 1,
        scoring: { team: 'H', points: 1, type: 'patKick' },
      },
      participants: { primary: { playerId: 'H-09', team: 'H', role: 'kicker' } },
      penalties: [],
    });
    expect(tryResult.driveTransition.driveResult).toBe('try');
    expect(tryResult.liveState).toMatchObject({
      possession: null,
      yardLine: 'H35',
      pendingTryTeam: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    });
  });

  it.each([
    ['fumble recovery return', 'rush'],
    ['interception return', 'pass'],
    ['kickoff return', 'kickoff'],
    ['punt return', 'punt'],
  ])('%s touchdown schedules the scoring team PAT', (_label, type) => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: `test-${type}-return-touchdown`,
      type,
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'touchdown',
        endYardLine: 'H00',
        nextPossession: 'V',
        turnover: type === 'rush' || type === 'pass'
          ? { type: type === 'pass' ? 'interception' : 'fumble', team: 'V', returnEndYardLine: 'H00' }
          : undefined,
        scoring: { team: 'V', points: 6, type: 'touchdown' },
      },
      penalties: [],
    });

    expect(result.driveTransition.driveResult).toBe('touchdown');
    expect(result.liveState).toMatchObject({
      possession: null,
      yardLine: 'H03',
      pendingTryTeam: 'V',
      nextPlayContext: 'awaitingTry',
    });
    expect(result.scoringUpdate).toEqual({ team: 'V', points: 6, type: 'touchdown' });
  });

  it.each([
    ['fumble recovery return', 'rush', 'V20'],
    ['interception return', 'pass', 'V20'],
    ['kickoff return', 'kickoff', 'V25'],
    ['punt return', 'punt', 'V20'],
  ])('%s touchback starts the return team possession at its touchback spot', (_label, type, touchbackSpot) => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: `test-${type}-return-touchback`,
      type,
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'touchback',
        endYardLine: touchbackSpot,
        nextPossession: 'V',
        turnover: type === 'rush' || type === 'pass'
          ? { type: type === 'pass' ? 'interception' : 'fumble', team: 'V', returnEndYardLine: 'V00' }
          : undefined,
      },
      penalties: [],
    });

    expect(result.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      yardLine: touchbackSpot,
    });
    expect(result.scoringUpdate).toBeNull();
  });

  it.each([
    ['fumble recovery return', 'rush'],
    ['interception return', 'pass'],
    ['kickoff return', 'kickoff'],
    ['punt return', 'punt'],
  ])('%s safety schedules the return team safety kick', (_label, type) => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: `test-${type}-return-safety`,
      type,
      possession: 'H',
      preState: normalEnvelope.liveState,
      result: {
        code: 'safety',
        endYardLine: 'V00',
        nextPossession: 'V',
        turnover: type === 'rush' || type === 'pass'
          ? { type: type === 'pass' ? 'interception' : 'fumble', team: 'V', returnEndYardLine: 'V00' }
          : undefined,
        scoring: { team: 'H', points: 2, type: 'safety' },
      },
      penalties: [],
    });

    expect(result.driveTransition.driveResult).toBe('safety');
    expect(result.liveState).toMatchObject({
      possession: null,
      yardLine: 'V20',
      kickoffTeam: 'V',
      nextPlayContext: 'awaitingSafetyKick',
    });
    expect(result.scoringUpdate).toEqual({ team: 'H', points: 2, type: 'safety' });
  });

  it('orients the PAT and kickoff setup spots for the visitor', () => {
    const touchdown = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-v-td',
      type: 'rush',
      possession: 'V',
      preState: {
        possession: 'V', down: 1, distance: 5, yardLine: 'H05', lineToGain: 'goal', driveId: 'DRV-0012', driveNumber: 12,
      },
      result: { code: 'touchdown', yards: 5, endYardLine: 'H00' },
      penalties: [],
    });
    expect(touchdown.liveState).toMatchObject({ yardLine: 'H03', pendingTryTeam: 'V' });
    expect(touchdown.scoringUpdate).toEqual({ team: 'V', points: 6, type: 'touchdown' });

    const pat = applyFootballEventToEnvelope({ ...normalEnvelope, liveState: touchdown.liveState }, {
      clientEventId: 'test-v-pat',
      type: 'try',
      subtype: 'kick',
      possession: null,
      preState: touchdown.liveState,
      participants: { primary: { playerId: 'V-30', team: 'V', role: 'kicker' } },
      result: { code: 'missed' },
      penalties: [],
    });
    expect(pat.liveState).toMatchObject({
      yardLine: 'V35',
      pendingTryTeam: null,
      kickoffTeam: 'V',
      nextPlayContext: 'awaitingKickoff',
    });
  });

  it('does not score a touchdown when previous-spot enforcement erases the play', () => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-nullified-td',
      type: 'rush',
      possession: 'V',
      preState: {
        possession: 'V', down: 4, distance: 5, yardLine: 'H05', lineToGain: 'goal', driveId: 'DRV-0012', driveNumber: 12,
      },
      result: {
        code: 'touchdown',
        yards: 5,
        endYardLine: 'H00',
        scoring: { team: 'V', points: 6, type: 'touchdown' },
      },
      penalties: [{
        penaltyId: 'pen-nullified-td',
        team: 'V',
        status: 'accepted',
        enforcedFrom: 'previousSpot',
        finalSpot: 'H15',
        replayDown: true,
      }],
    });

    expect(result.scoringUpdate).toBeNull();
    expect(result.driveTransition.shouldEndCurrent).toBe(false);
    expect(result.liveState).toMatchObject({ possession: 'V', down: 4, yardLine: 'H15', driveId: 'DRV-0012' });
    expect(result.yardsGained).toBe(0);
  });

  it('uses typed penalty flags without placeholder enforcement', () => {
    const event = {
      clientEventId: 'test-auto-first',
      type: 'penalty',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 3,
        distance: 8,
        yardLine: 'H30',
        lineToGain: 'H38',
        driveId: 'DRV-0006',
        driveNumber: 6,
      },
      result: {
        code: 'accepted',
        endYardLine: 'H35',
      },
      penalties: [
        {
          penaltyId: 'pen-1',
          status: 'accepted',
          automaticFirstDown: true,
          lossOfDown: false,
          replayDown: false,
        },
      ],
    };

    const result = applyFootballEventToEnvelope(normalEnvelope, event);

    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 1,
      distance: 10,
      yardLine: 'H35',
      lineToGain: 'H45',
    });
    expect(result.firstDown).toBe(true);

    const replayDown = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-replay-down',
      type: 'penalty',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 2,
        distance: 6,
        yardLine: 'H44',
        lineToGain: '50',
        driveId: 'DRV-0006',
        driveNumber: 6,
      },
      result: {
        code: 'accepted',
        endYardLine: 'H44',
      },
      penalties: [{ penaltyId: 'pen-2', status: 'accepted', replayDown: true }],
    });
    expect(replayDown.liveState).toMatchObject({
      down: 2,
      distance: 6,
      lineToGain: '50',
    });

    const declinedImmediate = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-declined-immediate',
      type: 'penalty',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 3,
        distance: 4,
        yardLine: 'H42',
        lineToGain: 'H46',
        driveId: 'DRV-0006',
        driveNumber: 6,
      },
      result: { code: 'declined', endYardLine: 'H42' },
      penalties: [{ penaltyId: 'pen-declined', status: 'declined', replayDown: true }],
    });
    expect(declinedImmediate.liveState).toMatchObject({
      down: 3,
      distance: 4,
      yardLine: 'H42',
      lineToGain: 'H46',
    });

    const lossOfDown = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-loss-of-down',
      type: 'penalty',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 2,
        distance: 6,
        yardLine: 'H44',
        lineToGain: '50',
        driveId: 'DRV-0006',
        driveNumber: 6,
      },
      result: {
        code: 'accepted',
        endYardLine: 'H44',
      },
      penalties: [{ penaltyId: 'pen-3', status: 'accepted', lossOfDown: true }],
    });
    expect(lossOfDown.liveState).toMatchObject({
      down: 3,
      distance: 6,
      lineToGain: '50',
    });
  });

  it('uses the spot of foul for play yardage while enforcing the ball to the final spot', () => {
    const result = applyFootballEventToEnvelope(normalEnvelope, {
      clientEventId: 'test-spot-foul-statistical-end',
      type: 'rush',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 1,
        distance: 10,
        yardLine: 'H27',
        lineToGain: 'H37',
        driveId: 'DRV-0002',
        driveNumber: 2,
      },
      result: { code: 'tackle', yards: 8, endYardLine: 'H35' },
      penalties: [{
        penaltyId: 'pen-spot-stat',
        status: 'accepted',
        enforcedFrom: 'spotOfFoul',
        spotOfFoul: 'H24',
        finalSpot: 'H14',
        replayDown: true,
      }],
    });

    expect(result.yardsGained).toBe(-3);
    expect(result.liveState).toMatchObject({
      possession: 'H',
      down: 1,
      yardLine: 'H14',
      lineToGain: 'H37',
    });
  });
});
