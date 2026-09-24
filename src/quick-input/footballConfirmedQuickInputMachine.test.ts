import { projectFootballStatsForEvents } from '../services/footballDashboardService';
import { footballScoringPlayText } from '../scoring/footballDriveSummary';
import { footballUnsportsmanlikeKey } from '../utils/footballUnsportsmanlike';
import { describe, expect, it, vi } from 'vitest';
import {
  createInitialFootballQuickInputState,
  transitionFootballQuickInput,
  type FootballConfirmedQuickInputState,
  type FootballQuickInputContext,
} from './footballConfirmedQuickInputMachine';
import type { PlayerResolutionRosterPlayer } from './playerResolution';
import { applyFootballScorerEventToEnvelope, saveDashboardSeededFootballEnvelope, getDashboardSeededFootballEnvelopeRecord } from '../services/footballDashboardService';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { validateFootballDraftIntent } from './footballIntentSchema';
import { footballPossessionChanges } from '../utils/footballPenaltyPossession';
import { buildFootballIndividualOffenseReport } from '../reports/footballIndividualOffense';
import { buildFootballEditedPlaySummary } from '../play-editor/footballPlayEditEnvelope';
import { buildFootballDefensiveStatsReport } from '../reports/footballDefensiveStats';

describe('footballConfirmedQuickInputMachine', () => {
  it('starts idle', () => {
    expect(createInitialFootballQuickInputState()).toEqual({
      status: 'idle',
      currentToken: '',
      tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
    });
  });

  it('R starts rush flow', () => {
    const state = startRush();

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'rush',
      currentStep: 'rusherJersey',
      currentToken: '',
    });
  });

  it('Enter commits rusher jersey, not submit', () => {
    const state = commitToken(inputToken(startRush(), '22'));

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.tokens.rusher?.playerId).toBe('H-22');
    expect(state.draft).toBeUndefined();
    expect(state.buildResult).toBeUndefined();
  });

  it('single jersey match advances', () => {
    const state = commitToken(inputToken(startRush(), '#22'));

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.tokens.rusher).toMatchObject({
      playerId: 'H-22',
      team: 'H',
      role: 'rusher',
      jersey: '22',
      displayName: 'Jordan Smith',
    });
    expect(state.tokens.rusher?.resolution.source).toBe('singleMatch');
  });

  it('duplicate jersey opens disambiguation', () => {
    const state = commitToken(inputToken(startRush(), '3'));

    expect(state.status).toBe('jersey.disambiguating');
    expect(state.duplicate?.recommendedPlayerId).toBe('H-3-RB');
    expect(state.duplicate?.candidates.map((candidate) => candidate.playerId)).toEqual(['H-3-RB', 'H-3-LB']);
    expect(state.tokens.rusher).toBeUndefined();
  });

  it('selecting duplicate candidate advances', () => {
    const duplicate = commitToken(inputToken(startRush(), '3'));
    const state = transition(duplicate, { type: 'SELECT_DUPLICATE_PLAYER', playerId: 'H-3-LB' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.tokens.rusher?.playerId).toBe('H-3-LB');
    expect(state.tokens.rusher?.resolution).toMatchObject({
      source: 'duplicateConfirmed',
      recommendedPlayerId: 'H-3-RB',
      selectedRecommended: false,
      duplicateCandidateIds: ['H-3-RB', 'H-3-LB'],
    });
  });

  it('cancel duplicate returns to jersey token', () => {
    const duplicate = commitToken(inputToken(startRush(), '3'));
    const state = transition(duplicate, { type: 'CANCEL_DUPLICATE' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('rusherJersey');
    expect(state.currentToken).toBe('3');
    expect(state.tokens.rusher).toBeUndefined();
  });

  it('tackle requires at least one tackler', () => {
    const withResult = commitToken(inputToken(commitToken(inputToken(startRush(), '22')), 'T'));
    const state = commitToken(inputToken(withResult, ''));

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'MISSING_TACKLER',
      field: 'participants.defenders',
    });
  });

  it('tackle result with tackler and end spot reaches draft.ready', () => {
    const state = completeRushDraft();

    expect(state.error).toBeUndefined();
    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      schemaVersion: 'football.draftIntent.v1',
      clientEventId: 'fcqi-rush-client-100',
      status: 'readyForSummary',
      play: { family: 'rush', subtype: null },
      result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
    });
    expect(state.draft?.participants.primary?.playerId).toBe('H-22');
    expect(state.draft?.participants.defenders.map((player) => player.playerId)).toEqual(['V-44']);
  });

  it('jumping to the Rush result step preserves rusher and clears tacklers and spot', () => {
    const ready = completeRushDraft();
    const state = transition(ready, { type: 'JUMP_TO_STEP', stepId: 'rush.result' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.currentToken).toBe('T');
    expect(state.tokens.rusher?.playerId).toBe('H-22');
    expect(state.tokens.result).toBe('tackle');
    expect(state.tokens.tacklers).toEqual([]);
    expect(state.tokens.endYardLine).toBeUndefined();
    expect(state.draft).toBeUndefined();
    expect(state.summary).toBeUndefined();
  });

  it('jumping to the Rush rusher step clears dependent Rush data', () => {
    const ready = completeRushDraft();
    const state = transition(ready, { type: 'JUMP_TO_STEP', stepId: 'rush.rusher' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('rusherJersey');
    expect(state.currentToken).toBe('22');
    expect(state.tokens.rusher?.playerId).toBe('H-22');
    expect(state.tokens.result).toBeUndefined();
    expect(state.tokens.tacklers).toEqual([]);
    expect(state.tokens.endYardLine).toBeUndefined();
    expect(state.draft).toBeUndefined();
    expect(state.summary).toBeUndefined();
  });

  it('out of bounds allows zero tacklers and adds OOB wording', () => {
    const state = transition(completeRushDraft({ result: 'O', tacklers: [] }), { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.draft?.result.code).toBe('outOfBounds');
    expect(state.summary?.summaryText).toContain('out-of-bounds');
    expect(state.summary?.summaryText).not.toContain('tackled by');
  });

  it('out of bounds can include tacklers', () => {
    const state = transition(completeRushDraft({ result: 'O', tacklers: ['44'] }), { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.draft?.result.code).toBe('outOfBounds');
    expect(state.summary?.summaryText).toContain('out-of-bounds');
    expect(state.summary?.summaryText).toContain('tackled by #44 Caleb Moss');
  });

  it('end of play skips tacklers and maps to a neutral result without a schema warning', () => {
    const state = transition(completeRushDraft({ result: '.' }), { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.draft?.result.code).toBe('tackle');
    expect(state.draft?.warnings).toEqual([]);
    expect(state.summary?.summaryText).not.toContain('tackled by');
  });

  it('classifies an opponent goal-line rush as a touchdown and preserves the goal-line wording', () => {
    const context = makeContext({
      play: { actionTeam: 'V', possession: 'V' },
      prePlay: { possession: 'V', yardLine: 'H05', lineToGain: 'goal', distance: 5 },
    });
    const started = transitionWithContext(createInitialFootballQuickInputState(), {
      type: 'START_RUSH',
      startedBy: 'hotkey',
      hotkey: 'R',
    }, context);
    const withRusher = commitTokenWithContext(inputTokenWithContext(started, '44', context), context);
    const withResult = commitTokenWithContext(inputTokenWithContext(withRusher, '.', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(withResult, 'H00', context), context);
    expect(ready.error).toBeUndefined();
    expect(ready.status).toBe('draft.ready');
    const state = transitionWithContext(ready, { type: 'GENERATE_SUMMARY' }, context);

    expect(state.draft?.result).toMatchObject({
      code: 'touchdown',
      yards: 5,
      endYardLine: 'H00',
      scoring: { team: 'V', points: 6, type: 'touchdown' },
    });
    expect(state.draft?.warnings).toEqual([]);
    expect(state.summary?.summaryText).toContain('to the H goal line for a touchdown');
  });

  it('accepts TD as the opponent goal-line shorthand', () => {
    const context = makeContext({
      play: { actionTeam: 'V', possession: 'V' },
      prePlay: { possession: 'V', yardLine: 'H05', lineToGain: 'goal', distance: 5 },
    });
    const started = transitionWithContext(createInitialFootballQuickInputState(), {
      type: 'START_RUSH',
      startedBy: 'hotkey',
      hotkey: 'R',
    }, context);
    const withRusher = commitTokenWithContext(inputTokenWithContext(started, '44', context), context);
    const withResult = commitTokenWithContext(inputTokenWithContext(withRusher, '.', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(withResult, 'td', context), context);

    expect(ready.error).toBeUndefined();
    expect(ready.tokens.endYardLine).toBe('goal');
    expect(ready.draft?.result).toMatchObject({
      code: 'touchdown',
      yards: 5,
      endYardLine: 'goal',
      scoring: { team: 'V', points: 6, type: 'touchdown' },
    });
    const summary = transitionWithContext(ready, { type: 'GENERATE_SUMMARY' }, context);
    expect(summary.summary?.summaryText).toContain('to the goal line for a touchdown');
  });

  it('classifies an own goal-line rush as a safety', () => {
    const context = makeContext({ prePlay: { yardLine: 'H05', lineToGain: 'H15', distance: 10 } });
    const started = transitionWithContext(createInitialFootballQuickInputState(), {
      type: 'START_RUSH',
      startedBy: 'hotkey',
      hotkey: 'R',
    }, context);
    const withRusher = commitTokenWithContext(inputTokenWithContext(started, '22', context), context);
    const withResult = commitTokenWithContext(inputTokenWithContext(withRusher, '.', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(withResult, 'H00', context), context);

    expect(ready.draft?.result).toMatchObject({
      code: 'safety',
      yards: -5,
      endYardLine: 'H00',
      scoring: { team: 'V', points: 2, type: 'safety' },
    });
  });

  it('fumble path collects forced and recovery fields', () => {
    const state = completeFumbleDraft({ returned: 'no' });

    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      result: {
        code: 'fumble',
        yards: 7,
        endYardLine: 'V49',
        fumble: {
          fumblerPlayerId: 'H-22',
          forcedByPlayerId: 'V-44',
          recoveredByPlayerId: 'H-22',
          recoveredByTeam: 'H',
          recoverySpot: 'V49',
          turnover: false,
        },
      },
    });
  });

  it.each(['T', 'TM'])('credits a team recovery with %s and retains the offense without a player return', (token) => {
    let state = startRush();
    for (const value of ['22', 'F', '', 'H', token, 'H40']) state = commitToken(inputToken(state, value));
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.participants.recoveredBy).toBeUndefined();
    expect(state.draft?.result.fumble).toMatchObject({ recoveredByPlayerId: 'TM', recoveredByTeam: 'H', recoverySpot: 'H40', turnover: false });
    expect(state.draft?.result.return).toBeUndefined();
    const ready = transition(state, { type: 'GENERATE_SUMMARY' });
    expect(ready.summary?.summaryText).toContain('recovered by HOM team at the H40');
    expect(ready.summary?.summaryText).not.toMatch(/unknown player|#TM/);
    const built = transition(ready, { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) throw new Error(JSON.stringify(built.buildResult));
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.buildResult.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'H', yardLine: 'H40', down: 3, distance: 10 });
    expect(projected.projection.driveTransition.shouldStartNew).toBe(false);
    expect(projected.envelope.stats.teams.H?.fumbles).toMatchObject({ num: 1, lost: 0, teamRecoveries: 1 });
    expect(projected.envelope.stats.players['H-22']).toMatchObject({ fumbles: 1, fumblesLost: 0 });
    expect(projected.envelope.stats.players.TM).toBeUndefined();
  });

  it('recovered fumbles can be returned through a terminal result', () => {
    const returned = completeFumbleDraft({ returned: 'yes' });
    const terminal = commitToken(inputToken(returned, 'T'));
    const tackleA = commitToken(inputToken(terminal, '44'));
    const tackleB = commitToken(inputToken(tackleA, ''));
    const state = commitToken(inputToken(tackleB, 'V40'));

    expect(state.status).toBe('draft.ready');
    expect(state.tokens.returnFlow).toEqual({ type: 'Fumble', fromSpot: 'V49', status: 'active' });
    expect(state.draft?.result).toMatchObject({
      endYardLine: 'V40',
      fumble: { recoverySpot: 'V49', returnYards: 9, returnEndYardLine: 'V40' },
      return: { type: 'Fumble', returnerPlayerId: 'H-22', resultCode: 'T' },
    });
  });

  it.each([
    ['fumble recovery return', completeDefensiveFumbleReturnAt],
    ['interception return', completeInterceptionReturnAt],
    ['kickoff return', (spot: string) => completeKickoffReturnDraft({ terminalResult: '.', endSpot: spot })],
    ['punt return', completePuntReturnAt],
  ])('%s emits a touchdown at the return team opponent goal line', (_label, completeReturn) => {
    const state = completeReturn('H00');

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      code: 'touchdown',
      scoring: { team: 'V', points: 6, type: 'touchdown' },
    });
    const reviewing = transition(state, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toContain('for a touchdown');
    const submitting = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
    expect(submitting.buildResult?.ok).toBe(true);
    if (submitting.buildResult?.ok) {
      expect(submitting.buildResult.event.result.scoring).toEqual({ team: 'V', points: 6, type: 'touchdown' });
    }
  });

  it.each([
    ['fumble recovery return', completeDefensiveFumbleReturnAt, 'V20'],
    ['interception return', completeInterceptionReturnAt, 'V20'],
    ['kickoff return', (spot: string) => completeKickoffReturnDraft({ terminalResult: '.', endSpot: spot }), 'V25'],
    ['punt return', completePuntReturnAt, 'V20'],
  ])('%s asks Touchback or Safety at the return team own goal line and applies T/S', (_label, completeReturn, touchbackSpot) => {
    const pendingTouchback = completeReturn('V00');
    expect(pendingTouchback).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'returnOwnGoalDecision',
      tokens: { returnEndSpot: 'V00' },
    });

    const touchback = commitToken(inputToken(pendingTouchback, 'T'));
    expect(touchback.draft?.result).toMatchObject({
      code: 'touchback',
      endYardLine: touchbackSpot,
      nextPossession: 'V',
    });
    expect(touchback.draft?.result.scoring).toBeUndefined();
    const touchbackSubmitting = transition(
      transition(touchback, { type: 'GENERATE_SUMMARY' }),
      { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' },
    );
    expect(touchbackSubmitting.buildResult?.ok).toBe(true);
    if (touchbackSubmitting.buildResult?.ok) {
      expect(touchbackSubmitting.buildResult.event.result.endYardLine).toBe(touchbackSpot);
    }

    const safety = commitToken(inputToken(completeReturn('V00'), 'S'));
    expect(safety.draft?.result).toMatchObject({
      code: 'safety',
      endYardLine: 'V00',
      scoring: { team: 'H', points: 2, type: 'safety' },
    });
    const safetySubmitting = transition(
      transition(safety, { type: 'GENERATE_SUMMARY' }),
      { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' },
    );
    expect(safetySubmitting.buildResult?.ok).toBe(true);
    if (safetySubmitting.buildResult?.ok) {
      expect(safetySubmitting.buildResult.event.result.scoring).toEqual({ team: 'H', points: 2, type: 'safety' });
    }
  });

  it.each([
    ['fumble recovery return', completeDefensiveFumbleReturnAt],
    ['interception return', completeInterceptionReturnAt],
  ])('%s uses touchbackSpot rather than kickoffTouchbackSpot', (_label, completeReturn) => {
    const context = makeContext({
      rules: { touchbackSpot: 'H22', kickoffTouchbackSpot: 'H30' },
    });
    const pending = completeReturn('V00', context);

    expect(pending).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'returnOwnGoalDecision',
    });

    const touchback = commitTokenWithContext(inputTokenWithContext(pending, 'T', context), context);
    expect(touchback.draft?.result).toMatchObject({
      code: 'touchback',
      endYardLine: 'V22',
      nextPossession: 'V',
    });

    const submitting = transitionWithContext(
      transitionWithContext(touchback, { type: 'GENERATE_SUMMARY' }, context),
      { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' },
      context,
    );
    expect(submitting.buildResult?.ok).toBe(true);
    if (submitting.buildResult?.ok) {
      expect(submitting.buildResult.event.result.endYardLine).toBe('V22');
    }
  });

  it('uses kickoffTouchbackSpot for a kickoff return ruled a touchback', () => {
    const context = makeContext({ rules: { touchbackSpot: 'H25', kickoffTouchbackSpot: 'H20' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V20', context), context);
    const withReturn = commitTokenWithContext(inputTokenWithContext(withDestination, 'R', context), context);
    const duplicateReturner = commitTokenWithContext(inputTokenWithContext(withReturn, '3', context), context);
    const withReturner = transitionWithContext(
      duplicateReturner,
      { type: 'SELECT_DUPLICATE_PLAYER', playerId: 'V-3-PR' },
      context,
    );
    const withTerminal = commitTokenWithContext(inputTokenWithContext(withReturner, '.', context), context);
    const atOwnGoal = commitTokenWithContext(inputTokenWithContext(withTerminal, 'V00', context), context);
    const touchback = commitTokenWithContext(inputTokenWithContext(atOwnGoal, 'T', context), context);

    expect(touchback.draft?.result).toMatchObject({
      code: 'touchback',
      endYardLine: 'V20',
      nextPossession: 'V',
    });
  });

  it('applies the same opponent/own goal rules when a defensive fumble recovery is not returned', () => {
    const touchdown = completeDefensiveFumbleRecoveryAt('H00');
    expect(touchdown.draft?.result).toMatchObject({
      code: 'touchdown',
      scoring: { team: 'V', points: 6, type: 'touchdown' },
    });

    const pending = completeDefensiveFumbleRecoveryAt('V00');
    expect(pending).toMatchObject({ status: 'token.awaiting', currentStep: 'returnOwnGoalDecision' });
    expect(commitToken(inputToken(pending, 'T')).draft?.result).toMatchObject({ code: 'touchback', endYardLine: 'V20' });
    expect(commitToken(inputToken(completeDefensiveFumbleRecoveryAt('V00'), 'S')).draft?.result).toMatchObject({
      code: 'safety',
      scoring: { team: 'H', points: 2, type: 'safety' },
    });
  });

  it('rush lateral continues to a new carrier and terminal result', () => {
    const withRusher = commitToken(inputToken(startRush(), '22'));
    const lateral = commitToken(inputToken(withRusher, 'C'));
    const recipient = commitToken(inputToken(lateral, '88'));
    const lateralSpot = commitToken(inputToken(recipient, 'V49'));
    const terminal = commitToken(inputToken(lateralSpot, 'T'));
    const tackleA = commitToken(inputToken(terminal, '44'));
    const tackleB = commitToken(inputToken(tackleA, ''));
    const state = commitToken(inputToken(tackleB, 'V40'));

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      endYardLine: 'V40',
      laterals: [{ fromPlayerId: 'H-22', toPlayerId: 'H-88', spot: 'V49' }],
    });
  });

  it('yardage is derived from spots', () => {
    const state = completeRushDraft({ result: '.', spot: 'V48' });

    expect(state.draft?.result.yards).toBe(8);
  });

  it.each([
    ['h00', 'H00'],
    ['v00', 'V00'],
  ])('normalizes lowercase end-zone yard line %s to %s', (input, expected) => {
    const state = completeRushDraft({ result: '.', spot: input });

    expect(state.status).toBe('draft.ready');
    expect(state.tokens.endYardLine).toBe(expected);
    expect(state.draft?.result.endYardLine).toBe(expected);
  });

  it('queues a penalty marker during an active flow', () => {
    const withRusher = commitToken(inputToken(startRush(), '22'));
    const state = transition(withRusher, { type: 'QUEUE_PENALTY_REQUEST' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.queuedPenaltyRequested).toBe(true);
    expect(state.draft).toBeUndefined();
    expect(state.buildResult).toBeUndefined();
  });

  it('toggles an unresolved queued penalty marker off', () => {
    const withRusher = commitToken(inputToken(startRush(), '22'));
    const queued = transition(withRusher, { type: 'QUEUE_PENALTY_REQUEST' });
    const state = transition(queued, { type: 'QUEUE_PENALTY_REQUEST' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.queuedPenaltyRequested).toBe(false);
    expect(state.draft).toBeUndefined();
    expect(state.buildResult).toBeUndefined();
  });

  it('adds a nonblocking miscellaneous fumble to a Rush and can remove it from the summary', () => {
    const reviewing = transition(completeRushDraft(), { type: 'GENERATE_SUMMARY' });
    const marked = transition(reviewing, { type: 'TOGGLE_MISC_FUMBLE' });

    expect(marked).toMatchObject({
      status: 'summary.reviewing',
      miscFumbleRequested: true,
      draft: {
        result: {
          code: 'tackle',
          yards: 7,
          endYardLine: 'V49',
          fumble: {
            fumblerPlayerId: 'H-22',
            spot: 'H44',
            recoveredByPlayerId: 'H-22',
            recoveredByTeam: 'H',
            recoverySpot: 'H44',
            turnover: false,
          },
        },
      },
    });
    expect(marked.summary?.summaryText).toContain('misc. fumble');

    const confirmed = transition(marked, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:10Z' });
    expect(confirmed.status).toBe('submitting.confirmed');
    expect(confirmed.buildResult).toMatchObject({
      ok: true,
      event: {
        result: {
          code: 'tackle',
          yards: 7,
          endYardLine: 'V49',
          fumble: { fumblerPlayerId: 'H-22', recoveredByPlayerId: 'H-22', turnover: false },
        },
      },
    });

    const removed = transition(marked, { type: 'TOGGLE_MISC_FUMBLE' });
    expect(removed.miscFumbleRequested).toBe(false);
    expect(removed.draft?.result.fumble).toBeUndefined();
    expect(removed.summary?.summaryText).not.toContain('misc. fumble');
  });

  it('adds a miscellaneous fumble to an incomplete Pass without changing its outcome', () => {
    const ready = completeIncompletePassDraft();
    const marked = transition(ready, { type: 'TOGGLE_MISC_FUMBLE' });
    const reviewing = transition(marked, { type: 'GENERATE_SUMMARY' });
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:10Z' });

    expect(reviewing.summary?.summaryText).toContain('pass incomplete');
    expect(reviewing.summary?.summaryText).toContain('misc. fumble');
    expect(confirmed.status).toBe('submitting.confirmed');
    expect(confirmed.buildResult).toMatchObject({
      ok: true,
      event: {
        type: 'pass',
        subtype: 'incomplete',
        result: {
          code: 'incomplete',
          fumble: { fumblerPlayerId: 'H-12', recoveredByPlayerId: 'H-12', turnover: false },
        },
      },
    });
  });

  it('adds a miscellaneous fumble to a Punt without changing the kick or possession result', () => {
    const ready = completePuntReturnDraft({ terminalResult: '.', tacklers: [] });
    const marked = transition(ready, { type: 'TOGGLE_MISC_FUMBLE' });
    const reviewing = transition(marked, { type: 'GENERATE_SUMMARY' });
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:10Z' });

    expect(reviewing.summary?.summaryText).toContain('misc. fumble');
    expect(confirmed.buildResult).toMatchObject({
      ok: true,
      event: {
        type: 'punt',
        result: {
          endYardLine: 'V31',
          nextPossession: 'V',
          fumble: { fumblerPlayerId: 'H-9', recoveredByPlayerId: 'H-9', turnover: false },
        },
      },
    });
  });

  it('ignores the miscellaneous-fumble modifier outside Rush, Pass, and Punt flows', () => {
    const kick = transition(startKick(), { type: 'TOGGLE_MISC_FUMBLE' });
    const teamPlay = transition(startTeamPlay(), { type: 'TOGGLE_MISC_FUMBLE' });

    expect(kick.miscFumbleRequested).toBeUndefined();
    expect(teamPlay.miscFumbleRequested).toBeUndefined();
  });

  it('unresolved queued penalty keeps summary visible but blocks confirmation', () => {
    const ready = completeRushDraft();
    const queued = transition(ready, { type: 'QUEUE_PENALTY_REQUEST' });
    const state = transition(queued, { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.queuedPenaltyRequested).toBe(true);
    expect(state.summary?.summaryText).toContain('Jordan Smith rush');
    expect(state.draft?.penalties).toEqual([]);
    expect(state.buildResult).toBeUndefined();

    const confirmed = transition(state, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:10Z' });
    expect(confirmed.status).toBe('summary.reviewing');
    expect(confirmed.error).toMatchObject({
      code: 'UNRESOLVED_QUEUED_PENALTY',
      message: 'Penalty queued — resolve before submitting',
      field: 'penalties',
    });
    expect(confirmed.draft).toEqual(state.draft);
    expect(confirmed.summary).toEqual(state.summary);
    expect(confirmed.buildResult).toBeUndefined();
  });

  it('toggling a queued penalty off allows normal summary generation', () => {
    const ready = completeRushDraft();
    const queued = transition(ready, { type: 'QUEUE_PENALTY_REQUEST' });
    const blocked = transition(queued, { type: 'GENERATE_SUMMARY' });
    const unqueued = transition(blocked, { type: 'QUEUE_PENALTY_REQUEST' });
    const state = transition(unqueued, { type: 'GENERATE_SUMMARY' });

    expect(unqueued.queuedPenaltyRequested).toBe(false);
    expect(unqueued.error).toBeUndefined();
    expect(state.status).toBe('summary.reviewing');
    expect(state.summary?.summaryText).toBe('HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.');
    expect(state.draft?.penalties).toEqual([]);
  });

  it('E starts immediate penalty flow', () => {
    const state = startPenalty('immediate');

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'penalty',
      currentStep: 'penaltyName',
      currentToken: '',
    });
    expect(state.tokens.penaltySource).toBe('immediate');
  });

  it('normalizes configured operator team aliases to canonical H and V', () => {
    const context = makeContext({ teamAliases: { H: 'W', V: 'F' } });
    const homePenalty = commitPenaltyTokens(startPenalty('immediate', context), ['Offside', 'w'], context);
    const visitorPenalty = commitPenaltyTokens(startPenalty('immediate', context), ['Offside', 'f'], context);

    expect(homePenalty.tokens.penaltyTeam).toBe('H');
    expect(visitorPenalty.tokens.penaltyTeam).toBe('V');
    expect(homePenalty.currentStep).toBe('penaltyResolution');
    expect(visitorPenalty.currentStep).toBe('penaltyResolution');
  });

  it('skips the first-down question for an offensive immediate deadball foul', () => {
    const ready = commitPenaltyTokens(startPenalty('immediate'), ['UC', 'H', 'A', '', 'H29']);
    expect(ready.status).toBe('draft.ready');
    expect(ready.draft?.penalties[0]).toMatchObject({ automaticFirstDown: false, replayDown: true });
  });

  it.each(['afterChange', 'multipleChanges'] as const)('uses the possession team after %s for deadball questions', (decision) => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    for (const team of ['H', 'V'] as const) {
      const entry = commitPenaltyTokens(startQueuedPenalty(queued), ['UC', team, 'A', '', 'S']);
      entry.tokens.penaltyTiming = 'deadBall';
      entry.tokens.penaltyPossessionDecision = decision;
      entry.tokens.penaltyPossessionTeam = 'V';
      const next = commitPenaltyTokens(entry, ['V30']);
      expect(next.currentStep).toBe(team === 'V' ? 'penaltyConfirmContext' : 'penaltyDeadBallFirstDown');
      if (team === 'V') expect(next.tokens.penaltyDownConsequence).toBe('NEW_SERIES');
    }
  });

  it('skips the first-down question for an offensive deadball foul attached to a play', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const entry = commitPenaltyTokens(startQueuedPenalty(queued), ['UC', 'H', 'A', '', 'S']);
    entry.tokens.penaltyTiming = 'deadBall';
    const ready = commitPenaltyTokens(entry, ['H36']);
    expect(ready.status).toBe('summary.reviewing');
    expect(ready.draft?.penalties[0]).toMatchObject({ automaticFirstDown: false, downCounts: true });
  });

  it.each([['Y', true], ['N', false]])('asks explicitly whether an accepted deadball awards a first down (%s)', (answer, automaticFirstDown) => {
    const question = commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'A', '', 'H49']);
    expect(question.currentStep).toBe('penaltyDeadBallFirstDown');
    expect(question.currentToken).toBe('');
    expect(commitPenaltyTokens(question, ['']).error?.code).toBe('MISSING_DEAD_BALL_FIRST_DOWN');
    const ready = commitPenaltyTokens(question, [String(answer)]);
    expect(ready.status).toBe('draft.ready');
    expect(ready.draft?.penalties[0]).toMatchObject({ automaticFirstDown, replayDown: !automaticFirstDown });
    const confirmed = transition(transition(ready, { type: 'GENERATE_SUMMARY' }), { type: 'CONFIRM_SUMMARY' });
    expect(confirmed.buildResult?.ok).toBe(true);
  });

  it('accepted immediate penalty forces previous spot and repeat down', () => {
    const ready = completeAcceptedImmediatePenalty();

    expect(ready.status).toBe('draft.ready');
    expect(ready.draft).toMatchObject({
      play: { family: 'penalty', subtype: 'accepted' },
      result: { code: 'accepted', endYardLine: 'H49' },
      penalties: [
        {
          name: 'Offsides',
          code: 'OFF',
          team: 'V',
          tableYards: 5,
          defaultEnforcement: 'PREVIOUS',
          yards: 5,
          source: 'immediate',
          status: 'accepted',
          accepted: true,
          enforcedFrom: 'PREVIOUS',
          finalSpot: 'H49',
          downConsequence: 'REPEAT',
          replayDown: true,
        },
      ],
    });

    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.summary?.summaryText).toContain('PENALTY VIS Offsides');
  });

  it('builds an immediate penalty from a pending try setup', () => {
    const context = makeContext({
      play: { actionTeam: 'H', possession: null },
      prePlay: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'V03',
        lineToGain: null,
        setupContext: 'awaitingTry',
        driveId: null,
        driveNumber: 3,
      },
    });
    const ready = commitPenaltyTokens(
      startPenalty('immediate', context),
      ['Offside', 'V', 'A', '', 'V01', 'N'],
      context,
    );

    expect(ready.status).toBe('draft.ready');
    expect(ready.draft).toMatchObject({
      play: { family: 'penalty', possession: null },
      prePlay: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'V03',
        lineToGain: null,
        setupContext: 'awaitingTry',
      },
      result: { endYardLine: 'V01' },
      penalties: [{ yards: 2, finalSpot: 'V01', downConsequence: 'REPEAT' }],
    });

    const reviewing = transitionWithContext(ready, { type: 'GENERATE_SUMMARY' }, context);
    expect(reviewing.summary?.summaryText).toBe('Deadball foul, PENALTY VIS Offsides, 2 yards from the V3 to the V1.');
  });

  it('retains a queued penalized player who was not otherwise in the play', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const accepted = commitPenaltyTokens(
      startQueuedPenalty(queued),
      ['Holding', 'H', 'A', '44', 'F', 'V45', 'H45', 'R'],
    );

    expect(accepted.status).toBe('summary.reviewing');
    expect(accepted.draft?.participants.penalizedPlayers).toEqual([
      expect.objectContaining({ playerId: 'H-44', role: 'penalizedPlayer' }),
    ]);
    expect(accepted.summary?.summaryText).toContain('PENALTY HOM Holding (#44 Home Moss)');
  });

  it('accepted immediate penalty does not ask for yards', () => {
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'A', '']);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
  });

  it('accepted penalty missing final spot blocks', () => {
    const withPlayerSkipped = commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'A', '']);
    const state = commitToken(inputToken(withPlayerSkipped, ''));

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'INVALID_PENALTY_FINAL_SPOT',
      field: 'penalties.finalSpot',
    });
  });

  it('prefills previous-spot final spot backward for offensive table penalties', () => {
    const context = makeContext({ prePlay: { yardLine: 'H35' } });
    const state = commitPenaltyTokens(startPenalty('immediate', context), ['FS', 'H', 'A', ''], context);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
    expect(state.currentToken).toBe('H30');
  });

  it('prefills previous-spot final spot forward for defensive table penalties', () => {
    const context = makeContext({ prePlay: { yardLine: 'H35' } });
    const state = commitPenaltyTokens(startPenalty('immediate', context), ['OFF', 'V', 'A', ''], context);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
    expect(state.currentToken).toBe('H40');
  });

  it('declined immediate penalty builds without enforcement fields', () => {
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'D']);

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.penalties[0]).toMatchObject({
      name: 'Offsides',
      code: 'OFF',
      resolution: 'declined',
      status: 'declined',
      accepted: false,
      source: 'immediate',
      downConsequence: 'REPEAT',
      replayDown: true,
    });
    expect(state.draft?.penalties[0].yards).toBeUndefined();
    expect(state.draft?.penalties[0].finalSpot).toBeUndefined();
    expect(state.draft?.penalties[0].enforcedFrom).toBeUndefined();
  });

  it('records offsetting immediate penalties as no-play repeat-down fouls', () => {
    const sameTeam = commitPenaltyTokens(startPenalty('immediate'), ['Holding', 'H', 'O', 'Offside', 'H']);
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Holding', 'H', 'O', 'Offside', 'V']);

    expect(sameTeam.status).toBe('token.error');
    expect(sameTeam.error).toMatchObject({ code: 'INVALID_OFFSETTING_TEAMS' });
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.penalties).toHaveLength(2);
    expect(state.draft?.penalties.every((penalty) => penalty.status === 'offsetting')).toBe(true);
    expect(state.draft?.penalties.every((penalty) => penalty.offsetting?.previousPlayCounts === false)).toBe(true);
    expect(state.draft?.penalties.every((penalty) => penalty.replayDown === true)).toBe(true);
    expect(state.draft?.penalties.every((penalty) => penalty.downConsequence === 'REPEAT')).toBe(true);
    expect(state.draft?.penalties.map((penalty) => penalty.code)).toEqual(['HOLD', 'OFF']);
    expect(state.draft?.penalties.map((penalty) => penalty.tableYards)).toEqual([10, 5]);
  });

  it('still asks whether a queued offsetting play counts', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const awaitingDecision = commitPenaltyTokens(
      startQueuedPenalty(queued),
      ['Holding', 'H', 'O', 'Offside', 'V'],
    );

    expect(awaitingDecision.currentStep).toBe('offsettingPlayCounts');
    const missingPlayCounts = commitToken(inputToken(awaitingDecision, ''));
    expect(missingPlayCounts.status).toBe('token.error');
    expect(missingPlayCounts.error).toMatchObject({ code: 'MISSING_OFFSETTING_PLAY_COUNTS' });
  });

  it('accepted queued penalty asks enforced-from and down, attaches to play, and clears marker', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const withPenalty = startQueuedPenalty(queued);
    const withPlayerSkipped = commitPenaltyTokens(withPenalty, ['Holding', 'H', 'A', '']);

    expect(withPlayerSkipped.currentStep).toBe('penaltyEnforcedFrom');
    expect(withPlayerSkipped.currentToken).toBe('P');

    const missingFoulSpot = commitPenaltyTokens(withPlayerSkipped, ['F', '']);
    expect(missingFoulSpot.status).toBe('token.error');
    expect(missingFoulSpot.error).toMatchObject({
      code: 'INVALID_SPOT_OF_FOUL',
      field: 'penalties.spotOfFoul',
    });

    const state = commitPenaltyTokens(withPlayerSkipped, ['F', 'V45', 'H45', 'R']);

    expect(state.status).toBe('summary.reviewing');
    expect(state.queuedPenaltyRequested).toBe(false);
    expect(state.draft?.play.family).toBe('rush');
    expect(state.draft?.penalties[0]).toMatchObject({
      name: 'Holding',
      code: 'HOLD',
      team: 'H',
      tableYards: 10,
      defaultEnforcement: 'PREVIOUS',
      yards: -10,
      source: 'queued',
      status: 'accepted',
      accepted: true,
      enforcedFrom: 'SPOT',
      spotOfFoul: 'V45',
      finalSpot: 'H45',
      downConsequence: 'REPEAT',
    });
    expect(state.summary?.summaryText).toContain('PENALTY HOM Holding, enforced 10 yards from the V45 to the H45');
  });

  it('accepted queued previous-spot penalty derives yards from previous spot', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['Offside', 'V', 'A', '', 'P', 'V01', 'A']);

    expect(state.status).toBe('summary.reviewing');
    expect(state.draft?.penalties[0]).toMatchObject({
      yards: 55,
      enforcedFrom: 'PREVIOUS',
      finalSpot: 'V01',
      downConsequence: 'AUTO_FIRST',
    });
  });

  it('spot-of-foul penalty waits for foul spot before prefilling final spot', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'A', '', 'F']);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltySpotOfFoul');
    expect(state.currentToken).toBe('');
  });

  it('spot-of-foul offensive holding prefills final spot from foul spot', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'A', '', 'F', 'V45']);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
    expect(state.currentToken).toBe('H45');
  });

  it('succeeding-spot penalty prefills final spot from play end spot', () => {
    const queued = transition(completeRushDraft({ spot: 'V39' }), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['PF', 'V', 'A', '', 'S']);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
    expect(state.currentToken).toBe('V24');
  });

  it('overriding suggested final spot updates derived signed yards', () => {
    const context = makeContext({ prePlay: { yardLine: 'H35' } });
    const state = commitPenaltyTokens(startPenalty('immediate', context), ['FS', 'H', 'A', '', 'H28'], context);

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.penalties[0]).toMatchObject({
      code: 'FS',
      finalSpot: 'H28',
      yards: -7,
    });
  });

  it('queued accepted penalty defaults enforcement from table', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const offside = commitPenaltyTokens(startQueuedPenalty(queued), ['OFF', 'V', 'A', '']);
    const personalFoul = commitPenaltyTokens(startQueuedPenalty(queued), ['PF', 'V', 'A', '']);

    expect(offside.status).toBe('token.awaiting');
    expect(offside.currentStep).toBe('penaltyEnforcedFrom');
    expect(offside.currentToken).toBe('P');
    expect(offside.tokens.penaltyEnforcedFrom).toBe('PREVIOUS');
    expect(personalFoul.status).toBe('token.awaiting');
    expect(personalFoul.currentStep).toBe('penaltyEnforcedFrom');
    expect(personalFoul.currentToken).toBe('P');
    expect(personalFoul.tokens.penaltyEnforcedFrom).toBe('PREVIOUS');
  });

  it('prefills the catalog half-distance spot and statistical rounding near the goal line', () => {
    const context = makeContext({ prePlay: { yardLine: 'V29' } });
    const state = commitPenaltyTokens(
      startPenalty('immediate', context),
      ['Personal Foul', 'V', 'A', ''],
      context,
    );

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyFinalSpot');
    expect(state.currentToken).toBe('V14');
  });

  it('prefills NCAA defensive holding from the previous spot with its restored 10-yard value', () => {
    const context = makeContext({
      play: { actionTeam: 'V', possession: 'V' },
      prePlay: { possession: 'V', yardLine: 'V41', lineToGain: 'H49', distance: 8 },
    });
    const state = commitPenaltyTokens(
      startPenalty('immediate', context),
      ['Defensive Holding', 'H', 'A', ''],
      context,
    );

    expect(state).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'penaltyFinalSpot',
      currentToken: 'H49',
    });
    expect(state.tokens.penaltyDefinition?.yards).toBe(10);

    const ready = commitPenaltyTokens(state, ['H49', 'N'], context);
    expect(ready.draft?.penalties[0]).toMatchObject({
      tableYards: 10,
      yards: 10,
      enforcedFrom: 'PREVIOUS',
      finalSpot: 'H49',
    });
  });

  it('calculates NCAA DPI from the foul spot with the 15-yard maximum and two-yard-line cap', () => {
    const context = makeContext({
      play: { actionTeam: 'H', possession: 'H' },
      prePlay: { possession: 'H', yardLine: 'V31', lineToGain: 'V21', distance: 10 },
    });
    const queued = transitionWithContext(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' }, context);
    const atLeastFifteenYards = commitPenaltyTokens(
      startQueuedPenalty(queued, context),
      ['Defensive Pass Interference', 'V', 'A', '', 'F', 'V10'],
      context,
    );

    expect(atLeastFifteenYards).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'penaltyFinalSpot',
      currentToken: 'V16',
    });
    const completedFifteenYards = commitPenaltyTokens(atLeastFifteenYards, ['V16', 'A'], context);
    expect(completedFifteenYards.draft?.penalties[0]).toMatchObject({
      tableYards: 15,
      yards: 15,
      enforcedFrom: 'PREVIOUS',
      spotOfFoul: 'V10',
      finalSpot: 'V16',
    });

    const shortFoul = commitPenaltyTokens(
      startQueuedPenalty(queued, context),
      ['Defensive Pass Interference', 'V', 'A', '', 'F', 'V25'],
      context,
    );
    expect(shortFoul.currentToken).toBe('V25');
    const completedShortFoul = commitPenaltyTokens(shortFoul, ['V25', 'A'], context);
    expect(completedShortFoul.draft?.penalties[0]).toMatchObject({
      tableYards: 15,
      yards: 6,
      enforcedFrom: 'SPOT',
      spotOfFoul: 'V25',
      finalSpot: 'V25',
    });

    const goalLineContext = makeContext({
      play: { actionTeam: 'H', possession: 'H' },
      prePlay: { possession: 'H', yardLine: 'V05', lineToGain: 'goal', distance: 5 },
    });
    const goalLineQueued = transitionWithContext(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' }, goalLineContext);
    const endZoneFoul = commitPenaltyTokens(
      startQueuedPenalty(goalLineQueued, goalLineContext),
      ['Defensive Pass Interference', 'V', 'A', '', 'F', 'goal'],
      goalLineContext,
    );

    expect(endZoneFoul).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'penaltyFinalSpot',
      currentToken: 'V02',
    });
    const completedEndZoneFoul = commitPenaltyTokens(endZoneFoul, ['V02', 'A'], goalLineContext);
    expect(completedEndZoneFoul.draft?.penalties[0]).toMatchObject({
      tableYards: 15,
      yards: 3,
      enforcedFrom: 'PREVIOUS',
      spotOfFoul: 'goal',
      finalSpot: 'V02',
    });
  });

  it('records the first unsportsmanlike foul without an ejection prompt', () => {
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Unsportsmanlike Conduct', 'H', 'A', '22']);
    expect(state.currentStep).toBe('penaltyFinalSpot');
    const ready = commitPenaltyTokens(state, ['H29']);
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.draft?.penalties[0]).toMatchObject({ unsportsmanlikeCount: 1, playerId: 'H-22' });
    expect(reviewing.summary?.summaryText).toContain('Smith’s first unsportsmanlike foul of the game.');
    expect(reviewing.summary?.summaryText).not.toContain('ejected');
  });

  it.each([['Y', true], ['N', false]] as const)('requires a second-foul decision and saves %s as ejected=%s', (answer, ejected) => {
    const context = { ...makeContext(), unsportsmanlikeCounts: { [footballUnsportsmanlikeKey('H', 'H-22')]: 1 } };
    const question = commitPenaltyTokens(startPenalty('immediate'), ['Unsportsmanlike Conduct', 'H', 'A', '22'], context);
    expect(question.currentStep).toBe('penaltyEjected');
    expect(question.currentToken).toBe('');
    expect(commitPenaltyTokens(question, [''], context).status).toBe('token.error');
    const ready = commitPenaltyTokens(question, [answer, 'H29'], context);
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' }, context);
    expect(reviewing.summary?.summaryText).toContain('Smith’s second unsportsmanlike foul of the game.');
    expect(reviewing.summary?.summaryText.includes('ejected from the game')).toBe(ejected);
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY' }, context);
    expect(confirmed.buildResult?.ok).toBe(true);
    if (!confirmed.buildResult?.ok) throw new Error('Penalty must build');
    expect(JSON.parse(JSON.stringify(confirmed.buildResult.event.penalties[0]))).toMatchObject({ unsportsmanlikeCount: 2, ejected });
  });

  it('collects the player on a declined unsportsmanlike foul and still asks on the second charge', () => {
    const context = { ...makeContext(), unsportsmanlikeCounts: { [footballUnsportsmanlikeKey('H', 'H-22')]: 1 } };
    const question = commitPenaltyTokens(startPenalty('immediate'), ['Unsportsmanlike Conduct', 'H', 'D', '22'], context);
    expect(question.currentStep).toBe('penaltyEjected');
    const ready = commitPenaltyTokens(question, ['N'], context);
    expect(ready.status).toBe('draft.ready');
    expect(ready.draft?.penalties[0]).toMatchObject({ status: 'declined', unsportsmanlikeCount: 2, ejected: false });
  });

  it('tracks separate players and ejection decisions on both offsetting unsportsmanlike fouls', () => {
    const context = { ...makeContext(), unsportsmanlikeCounts: { [footballUnsportsmanlikeKey('V', 'V-44')]: 1 } };
    const first = commitPenaltyTokens(startPenalty('immediate'), ['Unsportsmanlike Conduct', 'H', 'O', 'Unsportsmanlike Conduct', 'V'], context);
    expect(first.currentStep).toBe('penaltyPlayerJersey');
    const second = commitPenaltyTokens(first, ['22'], context);
    expect(second.tokens.penaltyDisciplineSlot).toBe('second');
    const question = commitPenaltyTokens(second, ['44'], context);
    expect(question.currentStep).toBe('penaltyEjected');
    const ready = commitPenaltyTokens(question, ['Y'], context);
    expect(ready.draft?.penalties).toMatchObject([
      { playerId: 'H-22', unsportsmanlikeCount: 1 },
      { playerId: 'V-44', unsportsmanlikeCount: 2, ejected: true },
    ]);
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' }, context);
    expect(reviewing.summary?.summaryText).toContain('#44 Caleb Moss ejected from the game');
    expect(transition(reviewing, { type: 'CONFIRM_SUMMARY' }, context).buildResult?.ok).toBe(true);
  });

  it('counts an earlier foul attached to the same play before prompting for the next one', () => {
    const reviewing = commitPenaltyTokens(startQueuedPenalty(completeRushDraft()), ['Unsportsmanlike Conduct', 'H', 'D', '22']);
    expect(reviewing.status).toBe('summary.reviewing');
    const second = commitPenaltyTokens(startQueuedPenalty(reviewing), ['Unsportsmanlike Conduct', 'H', 'L', 'D', '22']);
    expect(second.currentStep).toBe('penaltyEjected');
    expect(second.tokens.penaltyUnsportsmanlikeCount).toBe(2);
  });

  it('prefills Yes for catalog entries with automatic ejection', () => {
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Targeting', 'V', 'A', '']);

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('penaltyEjected');
    expect(state.currentToken).toBe('Y');
  });

  it('infers live-ball and dead-ball timing from the penalty entry flow', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const liveBall = commitPenaltyTokens(
      startQueuedPenalty(queued),
      ['Holding', 'H', 'A', '', 'F', 'V45', 'H45', 'R'],
    );
    const deadBall = completeAcceptedImmediatePenalty();

    expect(liveBall.draft?.penalties[0]).toMatchObject({ liveBall: true, deadBall: false });
    expect(deadBall.draft?.penalties[0]).toMatchObject({ liveBall: false, deadBall: true });
  });

  it('records an ejection and adds it to penalty play-by-play wording', () => {
    const state = commitPenaltyTokens(
      startPenalty('immediate'),
      ['TH', 'H', 'A', '22', 'Y', 'H30'],
    );

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.penalties[0]).toMatchObject({
      code: 'TH',
      ejectionable: true,
      ejected: true,
      ejectedPlayerId: 'H-22',
      liveBall: false,
      deadBall: true,
    });
    expect(state.draft?.penalties[0].notes).toContain('EJECTION: H-22');
    const reviewing = transition(state, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toContain('#22 Jordan Smith ejected from the game');
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY' });
    expect(confirmed.buildResult?.ok).toBe(true);
    if (!confirmed.buildResult?.ok) throw new Error('Targeting must build');
    expect(confirmed.buildResult.event.penalties[0]).toMatchObject({ ejected: true, ejectedPlayerId: 'H-22' });
  });

  it('queued accepted penalty defaults down consequence from table', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const autoFirst = commitPenaltyTokens(startQueuedPenalty(queued), ['DPI', 'V', 'A', '', 'F', 'V45', 'V30']);
    const lossOfDown = commitPenaltyTokens(startQueuedPenalty(queued), ['IG', 'H', 'A', '', 'F', 'V45', 'H45']);

    expect(autoFirst.status).toBe('token.awaiting');
    expect(autoFirst.currentStep).toBe('penaltyDown');
    expect(autoFirst.currentToken).toBe('A');
    expect(autoFirst.tokens.penaltyDownConsequence).toBe('AUTO_FIRST');
    expect(lossOfDown.status).toBe('token.awaiting');
    expect(lossOfDown.currentStep).toBe('penaltyDown');
    expect(lossOfDown.currentToken).toBe('L');
    expect(lossOfDown.tokens.penaltyDownConsequence).toBe('LOSS_OF_DOWN');
  });

  it('accepted queued succeeding-spot penalty derives yards from play end spot', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const negative = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'A', '', 'S', 'H41', 'R']);
    const positive = commitPenaltyTokens(startQueuedPenalty(queued), ['Interference', 'V', 'A', '', 'S', 'V40', 'A']);

    expect(negative.status).toBe('summary.reviewing');
    expect(negative.draft?.penalties[0]).toMatchObject({
      yards: -10,
      enforcedFrom: 'END',
      finalSpot: 'H41',
    });
    expect(positive.status).toBe('summary.reviewing');
    expect(positive.draft?.penalties[0]).toMatchObject({
      yards: 9,
      enforcedFrom: 'END',
      finalSpot: 'V40',
    });
  });

  it('derives a kickoff end-of-return penalty from the receiving team field direction', () => {
    const kickoff = completeKickoffReturnDraft({
      terminalResult: '.',
      startSpot: 'V20',
      endSpot: 'V26',
    });
    const queued = transition(kickoff, { type: 'QUEUE_PENALTY_REQUEST' });
    const accepted = commitPenaltyTokens(
      startQueuedPenalty(queued),
      ['Offside', 'H', 'A', '', 'S', 'Y', 'V31', 'Y'],
    );

    expect(accepted.status).toBe('summary.reviewing');
    expect(accepted.draft?.penalties[0]).toMatchObject({
      team: 'H',
      yards: 5,
      enforcedFrom: 'END',
      finalSpot: 'V31',
      downConsequence: 'NEW_SERIES',
      downCounts: false,
    });

    const nestedEndOnly: FootballConfirmedQuickInputState = {
      ...kickoff,
      draft: kickoff.draft
        ? {
            ...kickoff.draft,
            result: { ...kickoff.draft.result, endYardLine: undefined },
          }
        : undefined,
    };
    const acceptedWithNestedEnd = commitPenaltyTokens(
      startQueuedPenalty(transition(nestedEndOnly, { type: 'QUEUE_PENALTY_REQUEST' })),
      ['Offside', 'H', 'A', '', 'S', 'Y', 'V31', 'Y'],
    );

    expect(acceptedWithNestedEnd.status).toBe('summary.reviewing');
    expect(acceptedWithNestedEnd.draft?.penalties[0].yards).toBe(5);
  });

  it('preserves a completed succeeding-spot play without a Down Counts menu', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const accepted = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'A', '', 'S', 'H41']);
    expect(accepted.status).toBe('summary.reviewing');
    expect(accepted.draft?.penalties[0]).toMatchObject({ downCounts: true, replayDown: false });
    const defensive = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'V', 'A', '', 'S', 'V40', 'D']);
    expect(defensive).toMatchObject({ status: 'token.error', error: { code: 'INVALID_DOWN_CONSEQUENCE' } });
  });

  it('accepted queued spot-of-foul penalty preserves signed derived yardage', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const negative = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'A', '', 'F', 'V45', 'H45', 'R']);
    const positive = commitPenaltyTokens(startQueuedPenalty(queued), ['Interference', 'V', 'A', '', 'F', 'V45', 'V30', 'A']);

    expect(negative.status).toBe('summary.reviewing');
    expect(negative.draft?.penalties[0].yards).toBe(-10);
    expect(positive.status).toBe('summary.reviewing');
    expect(positive.draft?.penalties[0].yards).toBe(15);
  });

  it('declined queued penalty attaches and returns to summary', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'D']);

    expect(state.status).toBe('summary.reviewing');
    expect(state.queuedPenaltyRequested).toBe(false);
    expect(state.draft?.penalties[0]).toMatchObject({
      name: 'Holding',
      status: 'declined',
      accepted: false,
      source: 'queued',
    });
    expect(state.summary?.summaryText).toContain('declined');
  });

  it('offsetting queued penalty stores explicit play-count decision', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const state = commitPenaltyTokens(startQueuedPenalty(queued), ['Holding', 'H', 'O', 'Offside', 'V', 'Y']);

    expect(state.status).toBe('summary.reviewing');
    expect(state.queuedPenaltyRequested).toBe(false);
    expect(state.draft?.penalties).toHaveLength(2);
    expect(state.draft?.penalties.every((penalty) => penalty.offsetting?.previousPlayCounts === true)).toBe(true);
    expect(state.summary?.summaryText).toContain('Previous play counts');
  });

  it('summary generation reaches summary.reviewing', () => {
    const state = transition(completeRushDraft(), { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.summary?.summaryText).toBe('HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.');
    expect(state.draft?.status).toBe('summaryGenerated');
    expect(state.buildResult).toBeUndefined();
  });

  it('confirm builds submit request', () => {
    const reviewing = transition(completeRushDraft(), { type: 'GENERATE_SUMMARY' });
    const state = transition(reviewing, {
      type: 'CONFIRM_SUMMARY',
      confirmedAt: '2026-06-20T00:00:05Z',
      confirmedByUserId: 'user-123',
    });

    expect(state.status).toBe('submitting.confirmed');
    expect(state.buildResult?.ok).toBe(true);
    if (state.buildResult?.ok) {
      expect(state.buildResult.submitRequest.schemaVersion).toBe('football.submitEventRequest.v1');
      expect(state.buildResult.submitRequest.clientContext.clientEventId).toBe('fcqi-rush-client-100');
      expect(state.buildResult.event.description).toBe('HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.');
      expect(state.buildResult.event.type).toBe('rush');
    }
  });

  it('edit play returns from summary review to editable rush result step', () => {
    const reviewing = transition(completeRushDraft(), { type: 'GENERATE_SUMMARY' });
    const state = transition(reviewing, { type: 'EDIT_PLAY' });

    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.tokens.rusher?.playerId).toBe('H-22');
    expect(state.tokens.result).toBeUndefined();
    expect(state.tokens.tacklers).toEqual([]);
    expect(state.draft).toBeUndefined();
    expect(state.summary).toBeUndefined();
    expect(state.buildResult).toBeUndefined();
  });

  it('confirm does not call network/submit', () => {
    const submit = vi.fn();
    const reviewing = transition(completeRushDraft(), { type: 'GENERATE_SUMMARY' });

    transition(reviewing, {
      type: 'CONFIRM_SUMMARY',
      confirmedAt: '2026-06-20T00:00:05Z',
    });

    expect(submit).not.toHaveBeenCalled();
  });

  it('P starts pass flow', () => {
    const state = startPass();

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'pass',
      currentStep: 'passerJersey',
      currentToken: '',
    });
  });

  it('prefills retained primary specialists while leaving rush, penalty, and two-point personnel blank', () => {
    const context = {
      ...makeContext(),
      retainedPrimaryJerseys: {
        passer: '10',
        punter: '9',
        kickoffKicker: '6',
        fieldGoalKicker: '7',
        patKicker: '8',
      },
    };
    const start = (type: 'START_PASS' | 'START_PUNT' | 'START_KICK' | 'START_RUSH' | 'START_PENALTY') => transitionWithContext(
      createInitialFootballQuickInputState(),
      { type, startedBy: 'button', ...(type === 'START_PENALTY' ? { source: 'immediate' as const } : {}) },
      context,
    );

    expect(start('START_PASS')).toMatchObject({ currentStep: 'passerJersey', currentToken: '10', selectCurrentToken: true });
    expect(start('START_PUNT')).toMatchObject({ currentStep: 'punterJersey', currentToken: '9', selectCurrentToken: true });

    const kickoff = commitTokenWithContext(inputTokenWithContext(start('START_KICK'), 'O', context), context);
    const fieldGoal = commitTokenWithContext(inputTokenWithContext(start('START_KICK'), 'F', context), context);
    const patMenu = commitTokenWithContext(inputTokenWithContext(start('START_KICK'), 'A', context), context);
    const kickPat = commitTokenWithContext(inputTokenWithContext(patMenu, 'K', context), context);
    const rushPat = commitTokenWithContext(inputTokenWithContext(patMenu, 'R', context), context);
    const passPat = commitTokenWithContext(inputTokenWithContext(patMenu, 'P', context), context);

    expect(kickoff).toMatchObject({ currentStep: 'kickerJersey', currentToken: '6', selectCurrentToken: true });
    expect(fieldGoal).toMatchObject({ currentStep: 'kickerJersey', currentToken: '7', selectCurrentToken: true });
    expect(kickPat).toMatchObject({ currentStep: 'kickerJersey', currentToken: '8', selectCurrentToken: true });
    expect(rushPat).toMatchObject({ currentStep: 'patRusherJersey', currentToken: '' });
    expect(passPat).toMatchObject({ currentStep: 'patPasserJersey', currentToken: '' });
    expect(start('START_RUSH')).toMatchObject({ currentStep: 'rusherJersey', currentToken: '' });
    expect(start('START_PENALTY')).toMatchObject({ currentStep: 'penaltyName', currentToken: '' });
  });

  it('prefills and selects the editable field-goal kick spot seven yards behind the line', () => {
    const context = makeContext({ prePlay: { yardLine: 'V13' } });
    const menu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'F', context), context);
    const kicker = commitTokenWithContext(inputTokenWithContext(menu, '9', context), context);

    expect(kicker).toMatchObject({
      currentStep: 'fieldGoalSpot',
      currentToken: 'V20',
      selectCurrentToken: true,
    });
  });

  it('U starts punt flow', () => {
    const state = startPunt();

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'punt',
      currentStep: 'punterJersey',
      currentToken: '',
    });
  });

  it('K starts kick menu', () => {
    const state = startKick();

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'kick',
      currentStep: 'kickMenu',
      currentToken: '',
    });
  });

  it('F starts field goal flow and A starts PAT flow', () => {
    const fieldGoal = commitToken(inputToken(startKick(), 'F'));
    const pat = commitToken(inputToken(startKick(), 'A'));

    expect(fieldGoal.status).toBe('token.awaiting');
    expect(fieldGoal.currentStep).toBe('kickerJersey');
    expect(fieldGoal.tokens.kickMenuSelection).toBe('fieldGoal');
    expect(pat.status).toBe('token.awaiting');
    expect(pat.currentStep).toBe('patType');
    expect(pat.tokens.kickMenuSelection).toBe('pat');
  });

  it('O starts kickoff/free-kick flow and kicker jersey resolves', () => {
    const withMenu = commitToken(inputToken(startKick(), 'O'));
    const withKicker = commitToken(inputToken(withMenu, '9'));

    expect(withMenu.status).toBe('token.awaiting');
    expect(withMenu.currentStep).toBe('kickerJersey');
    expect(withMenu.tokens.kickMenuSelection).toBe('kickoff');
    expect(withKicker.status).toBe('token.awaiting');
    expect(withKicker.currentStep).toBe('kickReturnStartSpot');
    expect(withKicker.tokens.kicker?.playerId).toBe('H-9');
  });

  it('punter jersey resolves and punt shows kick receive result step', () => {
    const withPunter = commitToken(inputToken(startPunt(), '9'));
    const state = commitToken(inputToken(withPunter, 'V26'));

    expect(withPunter.status).toBe('token.awaiting');
    expect(withPunter.currentStep).toBe('puntSpot');
    expect(withPunter.tokens.punter?.playerId).toBe('H-9');
    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('puntReceiveResult');
  });

  it('punt return T builds request only and scopes T as terminal tackle', () => {
    const reviewing = transition(completePuntReturnDraft({ terminalResult: 'T' }), { type: 'GENERATE_SUMMARY' });
    const state = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });

    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark punt 30 yards to the V26, #3 Davis return for 5 yards to the V31, tackled by #44 Home Moss.');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('R');
    expect(reviewing.draft?.result.return?.resultCode).toBe('T');
    expect(state.status).toBe('submitting.confirmed');
    expect(state.buildResult?.ok).toBe(true);
    if (state.buildResult?.ok) {
      expect(state.buildResult.event.type).toBe('punt');
      expect(state.buildResult.event.result.return).toBeDefined();
    }
  });

  it('punt return O builds request only', () => {
    const reviewing = transition(completePuntReturnDraft({ terminalResult: 'O', tacklers: [] }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.draft?.result.return?.resultCode).toBe('O');
    expect(reviewing.summary?.summaryText).toContain('return for 5 yards to the V31, out-of-bounds');
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('punt return . builds request only', () => {
    const reviewing = transition(completePuntReturnDraft({ terminalResult: '.' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.return?.resultCode).toBe('.');
    expect(reviewing.draft?.participants.defenders).toEqual([]);
    expect(reviewing.summary?.summaryText).toContain('#3 Davis return for 5 yards to the V31');
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('punt touchback builds request only and scopes T as touchback', () => {
    const reviewing = transition(completePuntReceiveDraft({ receiveResult: 'T' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('touchback');
    expect(reviewing.draft?.result.endYardLine).toBe('V20');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('T');
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('touchback');
  });

  it('uses touchbackSpot for punts and never shows the kickoff advance modal', () => {
    const context = makeContext({
      rules: {
        touchbackSpot: 'H22',
        kickoffTouchbackSpot: 'H30',
      },
    });
    const withPunter = commitTokenWithContext(inputTokenWithContext(startPunt(), '9', context), context);
    const withSpot = commitTokenWithContext(inputTokenWithContext(withPunter, 'V05', context), context);
    const touchback = commitTokenWithContext(inputTokenWithContext(withSpot, 'T', context), context);

    expect(touchback).toMatchObject({ status: 'draft.ready' });
    expect(touchback.currentStep).toBeUndefined();
    expect(touchback.draft?.result).toMatchObject({ code: 'touchback', endYardLine: 'V22' });
  });

  it('does not offer the kickoff advance modal when a punt is downed short', () => {
    const context = makeContext({
      rules: { touchbackSpot: 'H20', kickoffTouchbackSpot: 'H30' },
    });
    const withPunter = commitTokenWithContext(inputTokenWithContext(startPunt(), '9', context), context);
    const withSpot = commitTokenWithContext(inputTokenWithContext(withPunter, 'V10', context), context);
    const downed = commitTokenWithContext(inputTokenWithContext(withSpot, 'D', context), context);

    expect(downed).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'downingPlayerJersey',
      tokens: { puntReceiveResult: 'downed' },
    });
  });

  it('punt fair catch requires returner and scopes C as fair catch', () => {
    const reviewing = transition(completePuntReceiveDraft({ receiveResult: 'C', returner: '3' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('fairCatch');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('C');
    expect(reviewing.draft?.participants.returner?.playerId).toBe('V-3-PR');
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('fair catch by #3 Davis');
  });

  it('punt out-of-bounds builds request only with no returner', () => {
    const reviewing = transition(completePuntReceiveDraft({ receiveResult: 'O', spot: 'V31' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('O');
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark punt 25 yards out-of-bounds at the V31.');
  });

  it('punt downed builds request only', () => {
    const reviewing = transition(completePuntReceiveDraft({ receiveResult: 'D', spot: 'V12', downingPlayer: '22' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('downed');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('D');
    expect(reviewing.draft?.participants.others[0]?.playerId).toBe('H-22');
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark punt 44 yards to the V12, downed by #22 Jordan Smith.');
  });

  it('blocked punt collects the blocker, then returns to terminal result choices without allowing a second block', () => {
    const withPunter = commitToken(inputToken(startPunt(), '9'));
    const withSpot = commitToken(inputToken(withPunter, 'V26'));
    const blocked = commitToken(inputToken(withSpot, 'B'));
    const withBlocker = commitToken(inputToken(blocked, '44'));
    const blockedAgain = commitToken(inputToken(withBlocker, 'B'));
    const outOfBounds = commitToken(inputToken(withBlocker, 'O'));
    const reviewing = transition(outOfBounds, { type: 'GENERATE_SUMMARY' });

    expect(blocked.currentStep).toBe('puntBlockedByJersey');
    expect(withBlocker).toMatchObject({ currentStep: 'puntReceiveResult', tokens: { puntBlocked: true } });
    expect(blockedAgain).toMatchObject({ status: 'token.error', error: { code: 'INVALID_PUNT_RECEIVE_RESULT' } });
    expect(reviewing.draft?.result.kick?.blockedByPlayerId).toBe('V-44');
    expect(reviewing.draft?.participants.defenders).toContainEqual(expect.objectContaining({ playerId: 'V-44', role: 'blocker' }));
    expect(reviewing.summary?.summaryText).toContain('blocked by #44 Caleb Moss');
    const submitting = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
    expect(submitting.buildResult?.ok).toBe(true);
    if (submitting.buildResult?.ok) {
      expect(submitting.buildResult.event).toMatchObject({
        type: 'punt',
        result: { kick: { blockedByPlayerId: 'V-44' } },
      });
    }
  });

  it('muffed punt records the muffer and recovery', () => {
    const state = completeMuffedPuntDraft();

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      code: 'muffed',
      endYardLine: 'V24',
      nextPossession: 'H',
      fumble: { fumblerPlayerId: 'V-3-PR', recoveredByPlayerId: 'H-22', recoveredByTeam: 'H' },
      turnover: { type: 'muffedKick', team: 'H' },
    });
  });

  it('punt return fumble continues through recovery', () => {
    const terminal = completePuntReturnThroughTerminal({ terminalResult: 'F' });
    const fumbleSpot = commitToken(inputToken(terminal, 'V31'));
    const forcedBy = commitToken(inputToken(fumbleSpot, '22'));
    const recoverTeam = commitToken(inputToken(forcedBy, 'H'));
    const recoverPlayer = commitToken(inputToken(recoverTeam, '12'));
    const recoverSpot = commitToken(inputToken(recoverPlayer, 'V31'));
    const state = commitToken(inputToken(recoverSpot, 'N'));

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      endYardLine: 'V31',
      nextPossession: 'H',
      fumble: { fumblerPlayerId: 'V-3-PR', forcedByPlayerId: 'H-22', recoveredByPlayerId: 'H-12' },
      turnover: { type: 'fumble', team: 'H' },
    });
  });

  it('punt return lateral continues to a teammate', () => {
    const lateral = completePuntReturnThroughTerminal({ terminalResult: 'C' });
    const recipient = commitToken(inputToken(lateral, '90'));
    const lateralSpot = commitToken(inputToken(recipient, 'V30'));
    const terminal = commitToken(inputToken(lateralSpot, '.'));
    const state = commitToken(inputToken(terminal, 'V35'));

    expect(state.error).toBeUndefined();
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      endYardLine: 'V35',
      laterals: [{ fromPlayerId: 'V-3-PR', toPlayerId: 'V-90', spot: 'V30' }],
    });
  });

  it('kickoff return T builds request only and scopes T as terminal tackle', () => {
    const reviewing = transition(completeKickoffReturnDraft({ terminalResult: 'T' }), { type: 'GENERATE_SUMMARY' });
    const state = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });

    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark kickoff 45 yards to the V20, #3 Davis return for 11 yards to the V31, tackled by #44 Home Moss.');
    expect(reviewing.draft?.play.family).toBe('kickoff');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('R');
    expect(reviewing.draft?.result.return?.resultCode).toBe('T');
    expect(state.status).toBe('submitting.confirmed');
    expect(state.buildResult?.ok).toBe(true);
    if (state.buildResult?.ok) {
      expect(state.buildResult.event.type).toBe('kickoff');
      expect(state.buildResult.event.result.return).toBeDefined();
    }
  });

  it('keeps duplicate kickoff return tacklers on the return final-spot path', () => {
    const terminal = completeKickoffReturnThroughTerminal({ terminalResult: 'T', startSpot: 'V20' });
    const duplicatePrimary = commitToken(inputToken(terminal, '3'));
    const withPrimary = transition(duplicatePrimary, {
      type: 'SELECT_DUPLICATE_PLAYER',
      playerId: 'H-3-LB',
    });

    expect(duplicatePrimary.status).toBe('jersey.disambiguating');
    expect(withPrimary).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'returnTackleBJersey',
      tokens: { tacklers: [expect.objectContaining({ playerId: 'H-3-LB' })] },
    });

    const awaitingEndSpot = commitToken(inputToken(withPrimary, ''));
    expect(awaitingEndSpot.currentStep).toBe('returnEndSpot');

    const ready = commitToken(inputToken(awaitingEndSpot, 'V26'));
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    expect(ready.tokens.endYardLine).toBeUndefined();
    expect(ready.tokens.returnEndSpot).toBe('V26');
    expect(ready.draft?.result).toMatchObject({
      endYardLine: 'V26',
      return: { returnEndYardLine: 'V26', returnYards: 6 },
    });
    expect(reviewing.summary?.summaryText).not.toContain('pending');

    const withUniquePrimary = commitToken(inputToken(terminal, '44'));
    const duplicateSecondary = commitToken(inputToken(withUniquePrimary, '3'));
    const withSecondary = transition(duplicateSecondary, {
      type: 'SELECT_DUPLICATE_PLAYER',
      playerId: 'H-3-LB',
    });
    expect(withSecondary.currentStep).toBe('returnEndSpot');
  });

  it('kickoff yard calculations use receiving-team orientation and signed return yards', () => {
    const reviewing = transition(
      completeKickoffReturnDraft({ terminalResult: '.', startSpot: 'V15', endSpot: 'V10' }),
      { type: 'GENERATE_SUMMARY' },
    );

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.kick?.kickYards).toBe(50);
    expect(reviewing.draft?.result.return?.returnStartYardLine).toBe('V15');
    expect(reviewing.draft?.result.return?.returnEndYardLine).toBe('V10');
    expect(reviewing.draft?.result.return?.returnYards).toBe(-5);
    expect(reviewing.summary?.summaryText).toContain('kickoff 50 yards to the V15');
    expect(reviewing.summary?.summaryText).toContain('return for loss of 5 yards to the V10');
  });

  it('accepts numeric kickoff rule spots without losing W/F team aliases', () => {
    const context = makeContext({
      rules: {
        kickoffSpot: 35 as unknown as FootballQuickInputContext['game']['rules']['kickoffSpot'],
      },
      teamAliases: { H: 'W', V: 'F' },
    });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);

    expect(() => commitTokenWithContext(
      inputTokenWithContext(withKicker, 'F20', context),
      context,
    )).not.toThrow();
    const withCatchSpot = commitTokenWithContext(
      inputTokenWithContext(withKicker, 'F20', context),
      context,
    );
    expect(withCatchSpot).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickReceiveResult',
      tokens: { kickReturnStartSpot: 'V20' },
    });
  });

  it('kickoff return O builds request only', () => {
    const reviewing = transition(completeKickoffReturnDraft({ terminalResult: 'O', tacklers: [] }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.draft?.result.return?.resultCode).toBe('O');
    expect(reviewing.summary?.summaryText).toContain('return for 11 yards to the V31, out-of-bounds');
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('kickoff return . builds request only', () => {
    const reviewing = transition(completeKickoffReturnDraft({ terminalResult: '.' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.return?.resultCode).toBe('.');
    expect(reviewing.draft?.participants.defenders).toEqual([]);
    expect(reviewing.summary?.summaryText).toContain('#3 Davis return for 11 yards to the V31');
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('kickoff touchback builds request only and scopes T as touchback', () => {
    const reviewing = transition(completeKickoffReceiveDraft({ receiveResult: 'T' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('touchback');
    expect(reviewing.draft?.result.endYardLine).toBe('V25');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('T');
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('touchback');
  });

  it.each([
    ['NCAA', 'H25', 'V25'],
    ['NFHS', 'H20', 'V20'],
    ['custom', 'H30', 'V30'],
  ])('uses the configured %s kickoff touchback spot', (_ruleset, kickoffTouchbackSpot, expectedSpot) => {
    const context = makeContext({
      rules: {
        touchbackSpot: 'H20',
        kickoffTouchbackSpot,
      },
    });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V00', context), context);
    const touchback = commitTokenWithContext(inputTokenWithContext(withDestination, 'T', context), context);

    expect(touchback.draft?.result).toMatchObject({
      code: 'touchback',
      endYardLine: expectedSpot,
      nextPossession: 'V',
    });
  });

  it('does not borrow the general touchback spot when the kickoff setting is missing', () => {
    const context = makeContext({
      rules: {
        touchbackSpot: 'H20',
        kickoffTouchbackSpot: undefined,
      },
    });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V00', context), context);
    const touchback = commitTokenWithContext(inputTokenWithContext(withDestination, 'T', context), context);

    expect(touchback).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickTouchbackSpot',
    });
  });

  it.each([
    ['W00', 'H00'],
    ['f00', 'V00'],
    ['W5', 'H05'],
  ])('normalizes kickoff yard-line alias %s to canonical %s', (input, expected) => {
    const context = makeContext({ teamAliases: { H: 'W', V: 'F' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V20', context), context);
    const withReturn = commitTokenWithContext(inputTokenWithContext(withDestination, 'R', context), context);
    const duplicateReturner = commitTokenWithContext(inputTokenWithContext(withReturn, '3', context), context);
    const withReturner = transitionWithContext(duplicateReturner, { type: 'SELECT_DUPLICATE_PLAYER', playerId: 'V-3-PR' }, context);
    const withTerminalResult = commitTokenWithContext(inputTokenWithContext(withReturner, '.', context), context);
    const state = commitTokenWithContext(inputTokenWithContext(withTerminalResult, input, context), context);

    expect(state.tokens.returnEndSpot).toBe(expected);
    if (expected === 'V00') {
      expect(state.status).toBe('token.awaiting');
      expect(state.currentStep).toBe('returnOwnGoalDecision');
      const touchback = commitTokenWithContext(inputTokenWithContext(state, 'T', context), context);
      expect(touchback.status).toBe('draft.ready');
      expect(touchback.draft?.result.return?.returnEndYardLine).toBe(expected);
      return;
    }
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result.return?.returnEndYardLine).toBe(expected);
  });

  it('kickoff fair catch collects returner and scopes C as fair catch', () => {
    const reviewing = transition(completeKickoffReceiveDraft({ receiveResult: 'C', returner: '3', spot: 'V26' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('fairCatch');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('C');
    expect(reviewing.draft?.participants.returner?.playerId).toBe('V-3-PR');
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('fair catch by #3 Davis');
  });

  it('offers to advance a kickoff fair catch inside the configured kickoff touchback spot', () => {
    const context = makeContext({
      rules: { touchbackSpot: 'H25', kickoffTouchbackSpot: 'H20' },
    });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V10', context), context);
    const withFairCatch = commitTokenWithContext(inputTokenWithContext(withDestination, 'C', context), context);
    const duplicateReturner = commitTokenWithContext(inputTokenWithContext(withFairCatch, '3', context), context);
    const decision = transitionWithContext(duplicateReturner, {
      type: 'SELECT_DUPLICATE_PLAYER',
      playerId: 'V-3-PR',
    }, context);

    expect(decision).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickFairCatchTouchbackDecision',
      tokens: {
        kickFairCatchSpot: 'V10',
        kickFairCatchTouchbackTargetSpot: 'V20',
        returner: { playerId: 'V-3-PR' },
      },
    });

    const ready = commitTokenWithContext(inputTokenWithContext(decision, 'Y', context), context);
    expect(ready).toMatchObject({
      status: 'draft.ready',
      tokens: { kickAdvanceFairCatchToTouchback: true },
      draft: {
        result: {
          code: 'fairCatch',
          endYardLine: 'V20',
          nextPossession: 'V',
          kick: { catchYardLine: 'V10', kickYards: 55, receiveResultCode: 'C' },
        },
      },
    });

    const reviewing = transitionWithContext(ready, { type: 'GENERATE_SUMMARY' }, context);
    expect(reviewing.summary?.summaryText).toContain('kickoff 55 yards to the V10');
    expect(reviewing.summary?.summaryText).toContain('fair catch by #3 Davis');
    expect(reviewing.summary?.summaryText).toContain('ball spotted at the V20');
  });

  it('preserves the actual kickoff fair catch spot when the operator declines advancement', () => {
    const context = makeContext({ rules: { kickoffTouchbackSpot: 'H30' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V12', context), context);
    const withFairCatch = commitTokenWithContext(inputTokenWithContext(withDestination, 'C', context), context);
    const decision = commitTokenWithContext(inputTokenWithContext(withFairCatch, '44', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(decision, 'N', context), context);

    expect(ready.tokens).toMatchObject({
      kickFairCatchSpot: 'V12',
      kickFairCatchTouchbackTargetSpot: 'V30',
      kickAdvanceFairCatchToTouchback: false,
    });
    expect(ready.draft?.result).toMatchObject({
      code: 'fairCatch',
      endYardLine: 'V12',
      kick: { catchYardLine: 'V12' },
      nextPossession: 'V',
    });
  });

  it.each(['V20', 'V31'])('does not prompt when a kickoff is fair caught at or beyond the configured spot (%s)', (spot) => {
    const context = makeContext({ rules: { kickoffTouchbackSpot: 'H20' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, spot, context), context);
    const withFairCatch = commitTokenWithContext(inputTokenWithContext(withDestination, 'C', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(withFairCatch, '44', context), context);

    expect(ready.status).toBe('draft.ready');
    expect(ready.tokens.kickFairCatchTouchbackTargetSpot).toBeUndefined();
    expect(ready.draft?.result.endYardLine).toBe(spot);
  });

  it('kickoff out-of-bounds builds request only with no returner', () => {
    const reviewing = transition(completeKickoffReceiveDraft({ receiveResult: 'O', outOfBoundsSpot: 'V08', spot: 'V35' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('O');
    expect(reviewing.draft?.result).toMatchObject({
      endYardLine: 'V35',
      kick: {
        outOfBoundsYardLine: 'V08',
        catchYardLine: 'V08',
        kickYards: 57,
      },
    });
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark kickoff out-of-bounds at the V08, ball spotted at the V35.');
  });

  it('kickoff out-of-bounds collects the actual spot before asking Rekick or Spot the Ball', () => {
    const withKicker = startKickoffReceiveSelection('V08');
    const decision = commitToken(inputToken(withKicker, 'O'));

    expect(decision).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickOutOfBoundsDecision',
      tokens: { kickReceiveResult: 'outOfBounds', kickOutOfBoundsSpot: 'V08' },
    });

    const awardedSpot = commitToken(inputToken(decision, 'S'));
    expect(awardedSpot).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickOutOfBoundsAwardedSpot',
      tokens: { kickOutOfBoundsDecision: 'spotBall' },
    });

    const ready = commitToken(inputToken(awardedSpot, 'V35'));
    expect(ready.draft).toMatchObject({
      result: {
        code: 'outOfBounds',
        endYardLine: 'V35',
        kick: { outOfBoundsYardLine: 'V08', catchYardLine: 'V08', kickYards: 57 },
      },
      penalties: [],
    });
  });

  it('kickoff out-of-bounds Rekick prefills and attaches the accepted Free Kick Infraction', () => {
    const withKicker = startKickoffReceiveSelection('V08');
    const decision = commitToken(inputToken(withKicker, 'O'));
    const review = commitToken(inputToken(decision, 'R'));

    expect(review).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickRekickPenaltyReview',
      tokens: {
        kickOutOfBoundsDecision: 'rekick',
        kickRekickSpot: 'H30',
      },
    });

    const ready = transition(inputToken(review, 'A'), { type: 'COMMIT_TOKEN' }, makeContext({ prePlay: { yardLine: 'H35' } }));
    expect(ready).toMatchObject({ status: 'draft.ready' });
    expect(ready.draft?.result).toMatchObject({
      code: 'outOfBounds',
      endYardLine: 'H30',
      nextPossession: 'V',
      kick: { receiveResultCode: 'O', outOfBoundsYardLine: 'V08' },
    });
    expect(ready.draft?.result.kick?.kickYards).toBeUndefined();
    expect(ready.draft?.participants.penalizedPlayers).toEqual([
      expect.objectContaining({ playerId: 'H-9', role: 'kicker' }),
    ]);
    expect(ready.draft?.penalties).toEqual([
      expect.objectContaining({
        code: 'FKI',
        name: 'Free Kick Infraction',
        team: 'H',
        playerId: 'H-9',
        yards: -5,
        status: 'accepted',
        enforcedFrom: 'PREVIOUS',
        finalSpot: 'H30',
        replayDown: true,
      }),
    ]);

    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark kickoff out-of-bounds at the V08. No play. PENALTY HOM Free Kick Infraction (#9 Owen Clark), 5 yards from the H35 to the H30. Re-kick from the H30.');
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
    expect(confirmed.buildResult?.ok).toBe(true);
    if (confirmed.buildResult?.ok) {
      expect(confirmed.buildResult.event.penalties).toEqual([
        expect.objectContaining({
          code: 'FKI',
          team: 'H',
          playerId: 'H-9',
          yards: 5,
          enforcedFrom: 'previousSpot',
          finalSpot: 'H30',
          replayDown: true,
        }),
      ]);
    }
  });

  it('muffed and downed kickoff/free kick branches build', () => {
    const muffed = completeMuffedKickoffDraft();
    const downedStart = completeKickoffReceiveDraft({ receiveResult: 'D', spot: 'V30' });
    const downed = commitToken(inputToken(downedStart, '22'));

    expect(muffed.status).toBe('draft.ready');
    expect(muffed.draft?.result).toMatchObject({
      code: 'muffed',
      nextPossession: 'H',
      fumble: { fumblerPlayerId: 'V-3-PR', recoveredByPlayerId: 'H-22' },
      return: {
        type: 'Kickoff',
        returnerPlayerId: 'V-3-PR',
        returnYards: 4,
        returnStartYardLine: 'V20',
        returnEndYardLine: 'V24',
      },
    });
    expect(downed.status).toBe('draft.ready');
    expect(downed.draft?.result).toMatchObject({ code: 'downed', endYardLine: 'V30', nextPossession: 'V' });
  });

  it('offers to advance a kickoff downed before the configured kickoff touchback spot', () => {
    const context = makeContext({
      rules: { touchbackSpot: 'H25', kickoffTouchbackSpot: 'H20' },
    });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V10', context), context);
    const decision = commitTokenWithContext(inputTokenWithContext(withDestination, 'D', context), context);

    expect(decision).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'kickDownedTouchbackDecision',
      tokens: {
        downedSpot: 'V10',
        kickDownedTouchbackTargetSpot: 'V20',
      },
    });

    const downingPlayer = commitTokenWithContext(inputTokenWithContext(decision, 'Y', context), context);
    expect(downingPlayer).toMatchObject({
      currentStep: 'downingPlayerJersey',
      tokens: { downedSpot: 'V10', kickAdvanceDownedToTouchback: true },
    });
    const ready = commitTokenWithContext(inputTokenWithContext(downingPlayer, '', context), context);
    expect(ready.draft?.result).toMatchObject({
      code: 'downed',
      endYardLine: 'V20',
      nextPossession: 'V',
      kick: { catchYardLine: 'V10', kickYards: 55 },
    });
  });

  it('measures a penalized kickoff from the actual pre-play spot', () => {
    const context = makeContext({ prePlay: { possession: null, yardLine: 'H20' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V27', context), context);
    const withReturn = commitTokenWithContext(inputTokenWithContext(withDestination, 'R', context), context);

    expect(withReturn.tokens.kickReturnStartSpot).toBe('V27');
    expect(withReturn.currentStep).toBe('returnerJersey');

    const withReturner = selectDuplicateIfNeeded(
      commitTokenWithContext(inputTokenWithContext(withReturn, '3', context), context),
      'V-3-PR',
    );
    const terminal = commitTokenWithContext(inputTokenWithContext(withReturner, '.', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(terminal, 'V30', context), context);

    expect(ready.draft?.result.kick).toMatchObject({ catchYardLine: 'V27', kickYards: 53 });
  });

  it('preserves the actual kickoff downed spot when the operator declines advancement', () => {
    const context = makeContext({ rules: { kickoffTouchbackSpot: 'H30' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, 'V12', context), context);
    const decision = commitTokenWithContext(inputTokenWithContext(withDestination, 'D', context), context);
    const downingPlayer = commitTokenWithContext(inputTokenWithContext(decision, 'N', context), context);
    const ready = commitTokenWithContext(inputTokenWithContext(downingPlayer, '', context), context);

    expect(ready.tokens).toMatchObject({
      downedSpot: 'V12',
      kickDownedTouchbackTargetSpot: 'V30',
      kickAdvanceDownedToTouchback: false,
    });
    expect(ready.draft?.result).toMatchObject({ code: 'downed', endYardLine: 'V12', nextPossession: 'V' });
  });

  it.each(['V20', 'V31'])('does not prompt when a kickoff is downed at or beyond the configured spot (%s)', (spot) => {
    const context = makeContext({ rules: { kickoffTouchbackSpot: 'H20' } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'O', context), context);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
    const withDestination = commitTokenWithContext(inputTokenWithContext(withKicker, spot, context), context);
    const downingPlayer = commitTokenWithContext(inputTokenWithContext(withDestination, 'D', context), context);

    expect(downingPlayer.currentStep).toBe('downingPlayerJersey');
    expect(downingPlayer.tokens.kickDownedTouchbackTargetSpot).toBeUndefined();
  });

  it('kickoff return fumble and lateral continue to terminal states', () => {
    const fumbleTerminal = completeKickoffReturnThroughTerminal({ terminalResult: 'F' });
    const fumbleSpot = commitToken(inputToken(fumbleTerminal, 'V31'));
    const recoverTeam = commitToken(inputToken(fumbleSpot, ''));
    expect(recoverTeam).toMatchObject({ status: 'token.awaiting', currentStep: 'recoverTeam' });
    const recoverPlayer = commitToken(inputToken(recoverTeam, 'H'));
    expect(recoverPlayer).toMatchObject({ status: 'token.awaiting', currentStep: 'recoverPlayerJersey' });
    const recoverSpot = commitToken(inputToken(recoverPlayer, '12'));
    expect(recoverSpot).toMatchObject({ status: 'token.awaiting', currentStep: 'recoverSpot' });
    const recoverySpotEntered = commitToken(inputToken(recoverSpot, 'V31'));
    const fumble = commitToken(inputToken(recoverySpotEntered, 'N'));
    const fumbleSummary = transition(fumble, { type: 'GENERATE_SUMMARY' });

    const lateralTerminal = completeKickoffReturnThroughTerminal({ terminalResult: 'C' });
    const lateralRecipient = commitToken(inputToken(lateralTerminal, '90'));
    const lateralSpot = commitToken(inputToken(lateralRecipient, 'V28'));
    const lateralEnd = commitToken(inputToken(lateralSpot, '.'));
    const lateral = commitToken(inputToken(lateralEnd, 'V35'));

    expect(fumble.status).toBe('draft.ready');
    expect(fumble.draft?.result).toMatchObject({ nextPossession: 'H', fumble: { fumblerPlayerId: 'V-3-PR' } });
    expect(fumble.draft?.result.fumble?.forcedByPlayerId).toBeUndefined();
    expect(fumbleSummary.summary?.summaryText).toContain('fumbled at the V31');
    expect(fumbleSummary.summary?.summaryText).toContain('recovered by #12 Mason Reed for HOM at the V31');
    expect(lateral.error).toBeUndefined();
    expect(lateral.status).toBe('draft.ready');
    expect(lateral.draft?.result.laterals).toEqual([{ fromPlayerId: 'V-3-PR', toPlayerId: 'V-90', spot: 'V28' }]);
  });

  it('field goal good builds +3 only', () => {
    const reviewing = transition(completeFieldGoalDraft({ result: 'G' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft).toMatchObject({
      play: { family: 'fieldGoal', subtype: 'made' },
      result: {
        code: 'made',
        kick: { kickSpot: 'V18', attemptYards: 28 },
        scoring: { team: 'H', points: 3, type: 'fieldGoal' },
      },
    });
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark 28-yard field goal good.');
  });

  it.each([
    ['R', 'wideRight', 'wide right'],
    ['L', 'wideLeft', 'wide left'],
    ['S', 'short', 'short'],
    ['E', 'leftUpright', 'left upright'],
    ['I', 'rightUpright', 'right upright'],
    ['C', 'crossbar', 'crossbar'],
  ])('field goal missed %s builds with missed reason', (reasonToken, reasonValue, phrase) => {
    const reviewing = transition(completeFieldGoalDraft({ result: 'M', missedReason: reasonToken }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.play.subtype).toBe('missed');
    expect(reviewing.draft?.result.code).toBe('missed');
    expect(reviewing.draft?.result.kick?.missedReason).toBe(reasonValue);
    expect(reviewing.summary?.summaryText).toBe(`HOM #9 Owen Clark 28-yard field goal no good, ${phrase}.`);
  });

  it('field goal blocked collects blocker and builds', () => {
    const reviewing = transition(completeFieldGoalDraft({ result: 'B', blocker: '44' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.play.subtype).toBe('blocked');
    expect(reviewing.draft?.result.code).toBe('blocked');
    expect(reviewing.draft?.participants.defenders[0]).toMatchObject({ playerId: 'V-44', role: 'blocker' });
    expect(reviewing.draft?.result.kick?.blockedByPlayerId).toBe('V-44');
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark 28-yard field goal blocked by #44 Caleb Moss.');
  });

  it.each([undefined, false, true])('field goal offers a return regardless of legacy fgReturn=%s', (fgReturn) => {
    const fgReturnContext = makeContext({ rules: { fgReturn } });
    const withKicker = transitionWithContext(commitTokenWithContext(inputToken(startKick(), 'F'), fgReturnContext), { type: 'INPUT_TOKEN', value: '9' }, fgReturnContext);
    const resolvedKicker = commitTokenWithContext(withKicker, fgReturnContext);
    const withSpot = commitTokenWithContext(inputToken(resolvedKicker, 'V18'), fgReturnContext);
    const withResult = commitTokenWithContext(inputToken(withSpot, 'M'), fgReturnContext);
    const withReason = commitTokenWithContext(inputToken(withResult, 'R'), fgReturnContext);

    expect(withReason.status).toBe('token.awaiting');
    expect(withReason.currentStep).toBe('fieldGoalReturnAttempted');

    const returnPrompt = commitTokenWithContext(inputToken(withReason, 'R'), fgReturnContext);
    const returner = selectDuplicateIfNeeded(commitTokenWithContext(inputToken(returnPrompt, '3'), fgReturnContext), 'V-3-PR');
    const startSpot = commitTokenWithContext(inputToken(returner, 'V05'), fgReturnContext);
    const terminal = commitTokenWithContext(inputToken(startSpot, '.'), fgReturnContext);
    const state = commitTokenWithContext(inputToken(terminal, 'V30'), fgReturnContext);

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.play.subtype).toBe('returned');
    expect(state.draft?.result).toMatchObject({
      code: 'returned',
      endYardLine: 'V30',
      return: { type: 'Field Goal', returnerPlayerId: 'V-3-PR', returnYards: 25 },
    });
    const reviewed = transitionWithContext(state, { type: 'GENERATE_SUMMARY' }, fgReturnContext);
    const built = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, fgReturnContext);
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.buildResult.event);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'V30', lineToGain: 'V40' });
    expect(projected.envelope.events.at(-1).type).toBe('fieldGoal');
  });

  it.each([
    ['R', 'V20', 'V30'],
    ['L', 'V22', 'V32'],
    ['S', 'V07', 'V17'],
    ['S', '50', 'H40'],
    ['C', 'H05', 'goal'],
  ])('spots a missed FGA (%s) at %s without using the kick spot or adding a correction', (reason, spot, lineToGain) => {
    const context = makeContext({
      rules: { fgReturn: false },
      prePlay: { down: 4, distance: 8, yardLine: 'V22', lineToGain: 'V14' },
    });
    const draft = completeFieldGoalDraft({ result: 'M', missedReason: reason, kickSpot: 'V29', nextSpot: spot }, context);
    expect(draft.status).toBe('draft.ready');
    expect(draft.draft?.result).toMatchObject({ code: 'missed', endYardLine: spot, nextPossession: 'V', kick: { kickSpot: 'V29', attemptYards: 39 } });
    const reviewed = transitionWithContext(draft, { type: 'GENERATE_SUMMARY' }, context);
    const built = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, context);
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const envelope = getGameEnvelopeFixture('normal');
    const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: spot === 'H05' ? 5 : 10, yardLine: spot, lineToGain });
    expect(projected.envelope.drives.current).toMatchObject({ team: 'V', startYardLine: spot, plays: 0 });
    expect(projected.envelope.events).toHaveLength(envelope.events.length + 1);
    expect(projected.envelope.events.at(-1)).toMatchObject({ type: 'fieldGoal', subtype: 'missed', result: { endYardLine: spot } });
    const serialized = JSON.parse(JSON.stringify(projected.envelope));
    expect(serialized.events.at(-1).result.kick).toMatchObject({ kickSpot: 'V29', attemptYards: 39 });
    expect(serialized.liveState.yardLine).toBe(spot);
  });

  it.each(['V22', 'H34', '50'])('prefills the previous scrimmage spot %s and requires confirmation', (yardLine) => {
    const context = makeContext({ rules: { rulesPresetId: 'ncaa' }, prePlay: { yardLine } });
    let state = startKick(context);
    for (const token of ['F', '9', 'V29', 'M', 'S', 'S']) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
    expect(state).toMatchObject({ currentStep: 'fieldGoalNextSpot', currentToken: yardLine, selectCurrentToken: true });
    expect(state.draft).toBeUndefined();
    const ready = commitTokenWithContext(state, context);
    expect(ready.draft?.result).toMatchObject({ endYardLine: yardLine, nextPossession: 'V', kick: { kickSpot: 'V29', attemptYards: 39 } });
  });

  it('requires an explicit R/S outcome and a valid spot before a missed field goal is ready', () => {
    const context = makeContext({ teamAliases: { H: 'W', V: 'S' } });
    let state = startKick(context);
    for (const token of ['F', '9', 'V29', 'M', 'S']) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
    expect(state.currentStep).toBe('fieldGoalReturnAttempted');
    expect(state.draft).toBeUndefined();
    expect(commitTokenWithContext(inputTokenWithContext(state, 'N', context), context).status).toBe('token.error');
    const spotting = commitTokenWithContext(inputTokenWithContext(state, 's', context), context);
    expect(spotting.currentStep).toBe('fieldGoalNextSpot');
    expect(spotting.draft).toBeUndefined();
    for (const invalid of ['', 'goal', 'TD', 'V00', 'H00', 'V51']) {
      expect(commitTokenWithContext(inputTokenWithContext(spotting, invalid, context), context).status).toBe('token.error');
    }
    const ready = commitTokenWithContext(inputTokenWithContext(spotting, 's20', context), context);
    expect(ready.status).toBe('draft.ready');
    expect(ready.draft?.result.endYardLine).toBe('V20');
    const edited = transitionWithContext(transitionWithContext(ready, { type: 'GENERATE_SUMMARY' }, context), { type: 'EDIT_PLAY' }, context);
    expect(edited.tokens.fieldGoalNextSpot).toBeUndefined();
    expect(edited.tokens.fieldGoalReturnAttempted).toBeUndefined();
  });

  it('G starts game control flow', () => {
    const state = startGameControl();

    expect(state).toMatchObject({
      status: 'token.awaiting',
      flow: 'gameControl',
      currentStep: 'gameControlMenu',
      currentToken: '',
    });
  });

  it('game control emergency stops the clock while roster remains modal-owned', () => {
    const emergency = commitToken(inputToken(startGameControl(), 'E'));
    const roster = commitToken(inputToken(startGameControl(), 'R'));
    const editPenalties = commitToken(inputToken(startGameControl(), 'F'));

    expect(emergency.status).toBe('draft.ready');
    expect(emergency.draft).toMatchObject({
      play: { family: 'gameControl', subtype: 'emergency' },
      result: { code: 'clockUpdate', isRunning: false, gameControl: { action: 'emergency' } },
    });
    expect(roster.status).toBe('token.error');
    expect(roster.error?.message).toBe('Roster functions not implemented yet');
    expect(roster.draft).toBeUndefined();
    expect(editPenalties).toMatchObject({
      status: 'token.error',
      tokens: { gameControlSelection: 'editPenalties' },
      error: { code: 'PENALTY_CODE_EDITOR_MODAL_OWNED' },
    });
  });

  it('game control quarter functions build period updates', () => {
    const menu = commitToken(inputToken(startGameControl(), 'Q'));

    expect(menu.status).toBe('token.awaiting');
    expect(menu.currentStep).toBe('gameControlQuarterMenu');

    const startQuarter = commitToken(inputToken(menu, 'S'));
    const endQuarter = commitToken(inputToken(menu, 'E'));

    expect(startQuarter.status).toBe('draft.ready');
    expect(startQuarter.draft).toMatchObject({ play: { subtype: 'startQuarter' }, result: { code: 'periodUpdate', gameControl: { action: 'startQuarter' } } });
    expect(endQuarter.status).toBe('draft.ready');
    expect(endQuarter.draft).toMatchObject({ play: { subtype: 'endQuarter' }, result: { code: 'periodUpdate', gameControl: { action: 'endQuarter' } } });
  });

  it('game control ball context collects down distance and spot and derives line to gain', () => {
    const menu = commitToken(inputToken(startGameControl(), 'B'));
    const down = commitToken(inputToken(menu, '2'));
    const distance = commitToken(inputToken(down, '5'));
    const spot = commitToken(inputToken(distance, 'H44'));

    expect(menu.currentStep).toBe('gameControlDown');
    expect(down.currentStep).toBe('gameControlDistance');
    expect(distance.currentStep).toBe('gameControlSpot');
    expect(spot.status).toBe('draft.ready');
    expect(spot.tokens.gameControlDown).toBe(2);
    expect(spot.tokens.gameControlDistance).toBe(5);
    expect(spot.tokens.gameControlSpot).toBe('H44');
    expect(spot.tokens.gameControlLineToGain).toBe('H49');
    expect(spot.draft).toMatchObject({ result: { gameControl: { action: 'setBallContext', down: 2, distance: 5, spot: 'H44', lineToGain: 'H49' } } });
  });

  it('game control set possession collects team and builds', () => {
    const menu = commitToken(inputToken(startGameControl(), 'P'));
    const state = commitToken(inputToken(menu, 'V'));

    expect(menu.currentStep).toBe('gameControlPossession');
    expect(state.status).toBe('draft.ready');
    expect(state.tokens.gameControlPossession).toBe('V');
    expect(state.draft).toMatchObject({ play: { subtype: 'setPossession', actionTeam: 'V' }, result: { gameControl: { action: 'setPossession', possession: 'V' } } });
  });

  it('game control supports clock, timeout, challenge, and drive start', () => {
    const clockMenu = commitToken(inputToken(startGameControl(), 'K'));
    const clock = commitToken(inputToken(clockMenu, '907'));
    expect(clock.draft).toMatchObject({ result: { code: 'clockUpdate', clock: '09:07', clockTenths: 5470, gameControl: { action: 'setClock' } } });

    const timeoutMenu = commitToken(inputToken(startGameControl(), 'T'));
    const timeoutClock = commitToken(inputToken(timeoutMenu, 'H'));
    expect(timeoutClock).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'gameControlClock',
      currentToken: '08:42',
      selectCurrentToken: true,
      tokens: { gameControlPossession: 'H' },
    });
    expect(timeoutClock.draft).toBeUndefined();
    const timeout = commitToken(inputToken(timeoutClock, '634'));
    expect(timeout.draft).toMatchObject({
      play: { subtype: 'timeout', actionTeam: 'H', clock: '06:34' },
      result: {
        code: 'noPlay',
        clock: '06:34',
        clockTenths: 3940,
        isRunning: false,
        gameControl: { action: 'timeout', teamSide: 'H', clock: '06:34' },
      },
    });
    const officialsClock = commitToken(inputToken(timeoutMenu, 'O'));
    const mediaClock = commitToken(inputToken(timeoutMenu, 'M'));
    expect(officialsClock).toMatchObject({ currentStep: 'gameControlClock', tokens: { gameControlTimeoutType: 'officials' } });
    expect(mediaClock).toMatchObject({ currentStep: 'gameControlClock', tokens: { gameControlTimeoutType: 'media' } });
    const officialsTimeout = commitToken(inputToken(officialsClock, '156'));
    const mediaTimeout = commitToken(inputToken(mediaClock, '1234'));
    expect(officialsTimeout.draft).toMatchObject({
      play: { subtype: 'timeout', clock: '01:56' },
      result: { clock: '01:56', gameControl: { action: 'timeout', timeoutType: 'officials', clock: '01:56' } },
    });
    expect(mediaTimeout.draft).toMatchObject({
      play: { subtype: 'timeout', clock: '12:34' },
      result: { clock: '12:34', gameControl: { action: 'timeout', timeoutType: 'media', clock: '12:34' } },
    });
    expect(transition(timeout, { type: 'GENERATE_SUMMARY' }).summary?.summaryText).toBe('(6:34) Timeout called by Home State.');
    expect(transition(officialsTimeout, { type: 'GENERATE_SUMMARY' }).summary?.summaryText).toBe('(1:56) Officials Timeout.');
    expect(transition(mediaTimeout, { type: 'GENERATE_SUMMARY' }).summary?.summaryText).toBe('(12:34) Media Timeout.');

    const challengeMenu = commitToken(inputToken(startGameControl(), 'C'));
    const challengeTeam = commitToken(inputToken(challengeMenu, 'V'));
    const challenge = commitToken(inputToken(challengeTeam, 'ST'));
    expect(challenge.draft).toMatchObject({ play: { subtype: 'challenge', actionTeam: 'V' }, result: { gameControl: { action: 'challenge', teamSide: 'V', challengeStatus: 'callStands' } } });

    const driveMenu = commitToken(inputToken(startGameControl(), 'D'));
    const driveTeam = commitToken(inputToken(driveMenu, 'H'));
    const drive = commitToken(inputToken(driveTeam, 'H25'));
    expect(drive.draft).toMatchObject({ play: { subtype: 'startDrive', actionTeam: 'H' }, result: { gameControl: { action: 'startDrive', possession: 'H', spot: 'H25' } } });
  });

  it('kick PAT good builds +1', () => {
    const reviewing = transition(completePatKickDraft({ result: 'G' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft).toMatchObject({
      play: { family: 'try', subtype: 'kick' },
      result: {
        code: 'made',
        scoring: { team: 'H', points: 1, type: 'patKick' },
      },
    });
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark extra point good.');
  });

  it('uses the enforced pending-try spot for a repeated kick PAT', () => {
    const context = makeContext({
      play: { actionTeam: 'H', possession: null },
      prePlay: {
        possession: null,
        down: null,
        distance: null,
        yardLine: 'V01',
        lineToGain: null,
        setupContext: 'awaitingTry',
        driveId: null,
        driveNumber: 3,
      },
    });
    const ready = completePatKickDraft({ result: 'G' }, context);

    expect(ready.draft).toMatchObject({
      prePlay: { yardLine: 'V01' },
      result: { kick: { kickSpot: 'V01' } },
    });
  });

  it('kick PAT missed asks reason and builds', () => {
    const reviewing = transition(completePatKickDraft({ result: 'M', missedReason: 'R' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('missed');
    expect(reviewing.draft?.result.kick?.missedReason).toBe('wideRight');
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark extra point no good, wide right.');
  });

  it('missed kick PAT asks whether the defense attempted a return when the rules allow returns', () => {
    const patReturnContext = makeContext({ rules: { patReturns: true } });
    const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(patReturnContext), 'A', patReturnContext), patReturnContext);
    const withType = commitTokenWithContext(inputTokenWithContext(withMenu, 'K', patReturnContext), patReturnContext);
    const withKicker = commitTokenWithContext(inputTokenWithContext(withType, '9', patReturnContext), patReturnContext);
    const withMiss = commitTokenWithContext(inputTokenWithContext(withKicker, 'M', patReturnContext), patReturnContext);
    const returnPrompt = commitTokenWithContext(inputTokenWithContext(withMiss, 'R', patReturnContext), patReturnContext);

    expect(returnPrompt).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'patKickReturnAttempted',
      tokens: { patKickResult: 'missed', patKickMissedReason: 'wideRight' },
    });

    const noReturn = commitTokenWithContext(inputTokenWithContext(returnPrompt, 'N', patReturnContext), patReturnContext);
    expect(noReturn).toMatchObject({
      status: 'draft.ready',
      draft: { result: { code: 'missed' } },
    });
  });

  it.each([
    [{ rulesPresetId: 'ncaa' }, true],
    [{ rulesPresetId: 'ncaa', patReturns: false }, true],
    [{ penaltyRuleset: 'NCAA' }, true],
    [{ rulesPresetId: 'nfhs', patReturns: true }, false],
    [{ patReturns: true }, true],
    [{}, false],
  ])('uses the try rules for missed and blocked PAT return prompts: %j', (rules, expected) => {
    const context = makeContext({ rules });
    for (const [result, detail] of [['M', 'S'], ['B', '44']]) {
      let state = startKick(context);
      for (const token of ['A', 'K', '9', result, detail]) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
      expect(state.currentStep === 'patKickReturnAttempted').toBe(expected);
      if (expected) {
        expect(state.draft).toBeUndefined();
        const ready = commitTokenWithContext(inputTokenWithContext(state, 'N', context), context);
        expect(ready.status).toBe('draft.ready');
        expect(ready.draft?.result.scoring).toBeUndefined();
      } else expect(state.status).toBe('draft.ready');
    }
  });

  it.each(['V30', 'goal'])('records an NCAA missed-PAT return to %s and keeps the original kicking team for kickoff', (endSpot) => {
    const context = makeContext({ rules: { rulesPresetId: 'ncaa' } });
    let state = startKick(context);
    for (const token of ['A', 'K', '9', 'M', 'S', 'Y', '3']) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
    state = selectDuplicateIfNeeded(state, 'V-3-PR');
    for (const token of ['V03', '.', endSpot]) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result.return).toMatchObject({ type: 'Try', returnerPlayerId: 'V-3-PR', returnEndYardLine: endSpot });
    expect(state.draft?.result.scoring).toEqual(endSpot === 'goal' ? { team: 'V', points: 2, type: 'defensiveConversion' } : undefined);
    const reviewed = transitionWithContext(state, { type: 'GENERATE_SUMMARY' }, context);
    const built = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, context);
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const envelope = getGameEnvelopeFixture('normal');
    const oldVisitorScore = envelope.game.teams.V.score;
    const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
    expect(projected.diagnostics).toEqual([]);
    expect(projected.envelope.game.teams.V.score).toBe(oldVisitorScore + (endSpot === 'goal' ? 2 : 0));
    expect(projected.envelope.liveState).toMatchObject({ possession: null, down: null, kickoffTeam: 'H', nextPlayContext: 'awaitingKickoff', yardLine: 'H35' });
  });

  it('kick PAT blocked collects blocker and builds', () => {
    const reviewing = transition(completePatKickDraft({ result: 'B', blocker: '44' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('blocked');
    expect(reviewing.draft?.participants.defenders[0]).toMatchObject({ playerId: 'V-44', role: 'blocker' });
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark extra point blocked by #44 Caleb Moss.');
  });

  it('rush PAT good missed and fumbled build expected tries', () => {
    const good = transition(completePatRushDraft({ result: 'G' }), { type: 'GENERATE_SUMMARY' });
    const missed = transition(completePatRushDraft({ result: 'M' }), { type: 'GENERATE_SUMMARY' });
    const fumbled = transition(completePatRushDraft({ result: 'F' }), { type: 'GENERATE_SUMMARY' });

    expect(good.draft?.result.scoring).toMatchObject({ points: 2, type: 'twoPoint' });
    expect(good.summary?.summaryText).toBe('HOM two-point rush by #22 Jordan Smith good.');
    expect(missed.draft?.result.code).toBe('failed');
    expect(missed.summary?.summaryText).toBe('HOM two-point rush by #22 Jordan Smith failed.');
    expect(fumbled.draft?.result.code).toBe('fumble');
    expect(fumbled.summary?.summaryText).toBe('HOM two-point rush by #22 Jordan Smith fumbled.');
  });

  it('pass PAT good missed incomplete intercepted and fumbled build expected tries', () => {
    const good = transition(completePatPassDraft({ result: 'G' }), { type: 'GENERATE_SUMMARY' });
    const missed = transition(completePatPassDraft({ result: 'M' }), { type: 'GENERATE_SUMMARY' });
    const incomplete = transition(completePatPassDraft({ result: 'I' }), { type: 'GENERATE_SUMMARY' });
    const intercepted = transition(completePatPassDraft({ result: 'X' }), { type: 'GENERATE_SUMMARY' });
    const fumbled = transition(completePatPassDraft({ result: 'F' }), { type: 'GENERATE_SUMMARY' });

    expect(good.draft?.result.scoring).toMatchObject({ points: 2, type: 'twoPoint' });
    expect(good.summary?.summaryText).toBe('HOM two-point pass from #12 Mason Reed to #88 Eli Grant good.');
    expect(missed.draft?.result.code).toBe('failed');
    expect(missed.summary?.summaryText).toBe('HOM two-point pass from #12 Mason Reed to #88 Eli Grant failed.');
    expect(incomplete.draft?.result.code).toBe('incomplete');
    expect(incomplete.summary?.summaryText).toBe('HOM two-point pass from #12 Mason Reed to #88 Eli Grant incomplete.');
    expect(intercepted.draft?.result.code).toBe('interception');
    expect(intercepted.summary?.summaryText).toBe('HOM two-point pass from #12 Mason Reed intercepted.');
    expect(fumbled.draft?.result.code).toBe('fumble');
    expect(fumbled.summary?.summaryText).toBe('HOM two-point pass from #12 Mason Reed to #88 Eli Grant fumbled.');
  });

  it('PAT return can record a defensive conversion', () => {
    const patReturnContext = makeContext({ rules: { patReturns: true } });
    const withMenu = commitTokenWithContext(inputToken(startKick(), 'A'), patReturnContext);
    const withType = commitTokenWithContext(inputToken(withMenu, 'K'), patReturnContext);
    const withKicker = commitTokenWithContext(inputToken(withType, '9'), patReturnContext);
    const withBlocked = commitTokenWithContext(inputToken(withKicker, 'B'), patReturnContext);
    const withBlocker = commitTokenWithContext(inputToken(withBlocked, '44'), patReturnContext);

    expect(withBlocker.status).toBe('token.awaiting');
    expect(withBlocker.currentStep).toBe('patKickReturnAttempted');

    const returnPrompt = commitTokenWithContext(inputToken(withBlocker, 'Y'), patReturnContext);
    const returner = selectDuplicateIfNeeded(commitTokenWithContext(inputToken(returnPrompt, '3'), patReturnContext), 'V-3-PR');
    const startSpot = commitTokenWithContext(inputToken(returner, 'V03'), patReturnContext);
    const terminal = commitTokenWithContext(inputToken(startSpot, '.'), patReturnContext);
    const state = commitTokenWithContext(inputToken(terminal, 'goal'), patReturnContext);

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      scoring: { team: 'V', points: 2, type: 'defensiveConversion' },
      return: { type: 'Try', returnerPlayerId: 'V-3-PR', returnEndYardLine: 'goal' },
    });
  });

  it('complete pass tackle reaches draft.ready with derived yardage', () => {
    const state = completePassDraft({ completeResult: 'T' });

    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      play: { family: 'pass', subtype: 'complete' },
      participants: {
        primary: { playerId: 'H-12', role: 'passer' },
        secondary: { playerId: 'H-88', role: 'receiver' },
      },
      result: {
        code: 'complete',
        yards: 7,
        endYardLine: 'V49',
        pass: {
          targetPlayerId: 'H-88',
          completed: true,
          completeResultCode: 'T',
        },
      },
    });
    expect(state.draft?.participants.defenders.map((player) => player.playerId)).toEqual(['V-44']);
  });

  it('classifies a completed pass to the end zone as a touchdown', () => {
    const state = completePassDraft({ completeResult: '.', spot: 'goal' });

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      code: 'touchdown',
      endYardLine: 'goal',
      driveEnds: true,
      scoring: { team: 'H', points: 6, type: 'touchdown' },
    });
    const reviewing = transition(state, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toContain('for a touchdown');
  });

  it('records an own-end-zone sack as two points and explicitly names the safety in its summary', () => {
    const context = makeContext({ prePlay: { yardLine: 'H03', down: 1, distance: 10, lineToGain: 'H13' } });
    let state = transitionWithContext(createInitialFootballQuickInputState(), { type: 'START_PASS' }, context);
    for (const token of ['12', 'S', '44', '', 'H00']) state = commitTokenWithContext(inputTokenWithContext(state, token, context), context);
    expect(state.draft?.result).toMatchObject({ code: 'sack', yards: -3, driveEnds: true, scoring: { team: 'V', points: 2, type: 'safety' } });
    const reviewed = transitionWithContext(state, { type: 'GENERATE_SUMMARY' }, context);
    expect(reviewed.summary?.summaryText).toMatch(/sacked by #44 Caleb Moss.*for a safety\./);
    const built = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, context);
    expect(built.buildResult?.ok).toBe(true);
    if (built.buildResult?.ok) expect(built.buildResult.event.result.scoring).toEqual({ team: 'V', points: 2, type: 'safety' });
  });

  it('classifies a completed pass ending at its own goal line as a safety without return clarification', () => {
    const context = makeContext({ prePlay: { yardLine: 'H05', lineToGain: 'H15', distance: 10 } });
    const started = transitionWithContext(createInitialFootballQuickInputState(), {
      type: 'START_PASS',
      startedBy: 'hotkey',
      hotkey: 'P',
    }, context);
    const passer = commitTokenWithContext(inputTokenWithContext(started, '12', context), context);
    const complete = commitTokenWithContext(inputTokenWithContext(passer, 'C', context), context);
    const receiver = commitTokenWithContext(inputTokenWithContext(complete, '88', context), context);
    const caughtAt = commitTokenWithContext(inputTokenWithContext(receiver, '', context), context);
    const endOfPlay = commitTokenWithContext(inputTokenWithContext(caughtAt, '.', context), context);
    const state = commitTokenWithContext(inputTokenWithContext(endOfPlay, 'H00', context), context);

    expect(state.status).toBe('draft.ready');
    expect(state.currentStep).toBeUndefined();
    expect(state.draft?.result).toMatchObject({
      code: 'safety',
      scoring: { team: 'V', points: 2, type: 'safety' },
    });
  });

  it('complete pass out of bounds allows zero tacklers', () => {
    const reviewing = transition(completePassDraft({ completeResult: 'O', tacklers: [] }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.summary?.summaryText).toContain('out-of-bounds');
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('complete pass fumble launches fumble flow and can build after recovery', () => {
    const state = completePassFumbleDraft();

    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      play: { family: 'pass', subtype: 'complete' },
      result: {
        code: 'complete',
        fumble: {
          fumblerPlayerId: 'H-88',
          forcedByPlayerId: 'V-44',
          recoveredByPlayerId: 'H-22',
          recoveredByTeam: 'H',
          recoverySpot: 'V49',
          turnover: false,
        },
      },
    });
  });

  it('complete pass lateral continues through the new carrier', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const withResult = commitToken(inputToken(withPasser, 'C'));
    const withReceiver = commitToken(inputToken(withResult, '88'));
    const withCaughtAt = commitToken(inputToken(withReceiver, 'V49'));
    const lateral = commitToken(inputToken(withCaughtAt, 'C'));
    const recipient = commitToken(inputToken(lateral, '22'));
    const lateralSpot = commitToken(inputToken(recipient, 'V45'));
    const terminal = commitToken(inputToken(lateralSpot, '.'));
    const state = commitToken(inputToken(terminal, 'V40'));

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.result).toMatchObject({
      endYardLine: 'V40',
      laterals: [{ fromPlayerId: 'H-88', toPlayerId: 'H-22', spot: 'V45' }],
    });
  });

  it('complete pass end of play has no tacklers', () => {
    const reviewing = transition(completePassDraft({ completeResult: '.' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.participants.defenders).toEqual([]);
    expect(reviewing.summary?.summaryText).not.toContain('tackled by');
  });

  it('incomplete pass reaches summary', () => {
    const reviewing = transition(completeIncompletePassDraft(), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result).toMatchObject({
      code: 'incomplete',
      pass: {
        targetPlayerId: 'H-88',
        completed: false,
      },
    });
    expect(reviewing.summary?.summaryText).toContain('pass incomplete intended for #88 Eli Grant');
  });

  it.each(['', '   '])('saves an incomplete pass with a blank target (%j)', (target) => {
    const reviewing = transition(completeIncompletePassDraft({ target }), { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toBe('HOM #12 Mason Reed pass incomplete.');
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY' });
    expect(confirmed.buildResult?.ok).toBe(true);
    if (!confirmed.buildResult?.ok) throw new Error('Pass must build');
    expect(confirmed.buildResult.event.participants.secondary).toBeNull();
    expect(confirmed.buildResult.event.result.code).toBe('incomplete');
  });

  it.each(['D', 'd', 'Dropped'])('accepts %s for a dropped pass and skips breakup', (result) => {
    let next = startPass();
    for (const token of ['12', result, '88', '']) next = commitToken(inputToken(next, token));
    expect(next.currentStep).toBe('hurried');
    next = commitToken(inputToken(next, 'N'));
    const reviewing = transition(next, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.summary?.summaryText).toBe('HOM #12 Mason Reed pass dropped by #88 Eli Grant.');
    expect(reviewing.draft?.result.pass).toMatchObject({ outcome: 'incomplete', dropped: true, completed: false });
  });

  it('persists a drop with hurry credit and the same stats and ball context as an incomplete', () => {
    const build = (dropped: boolean) => {
      const reviewing = transition(completeIncompletePassDraft({ dropped, hurried: ['44', '90'] }), { type: 'GENERATE_SUMMARY' });
      const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY' });
      if (!confirmed.buildResult?.ok) throw new Error('Pass must build');
      return JSON.parse(JSON.stringify(confirmed.buildResult.event));
    };
    const drop = { ...build(true), sequence: 1, acceptedAt: '2026-06-20T00:00:02Z' };
    const incomplete = { ...build(false), sequence: 1, acceptedAt: '2026-06-20T00:00:02Z' };
    expect(drop).toMatchObject({ type: 'pass', subtype: 'incomplete', result: { code: 'incomplete', pass: {
      dropped: true, outcome: 'incomplete', brokenUpByPlayerId: null, hurriedByPlayerIds: ['V-44', 'V-90'],
    } } });
    const envelope = structuredClone(getGameEnvelopeFixture());
    envelope.events = [drop];
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.V.totals).toMatchObject({ breakups: 0, hurries: 2 });
    expect(buildFootballIndividualOffenseReport(envelope).teamReports.H.passing.totals).toMatchObject({ passAttempts: 1, passCompletions: 0, passYards: 0 });
    expect(buildFootballEditedPlaySummary(envelope, drop)).toContain('pass dropped by');
    const projectedDrop = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), drop);
    const projectedIncomplete = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), incomplete);
    expect(projectedDrop.diagnostics).toEqual([]);
    expect(projectedIncomplete.diagnostics).toEqual([]);
    expect(projectedDrop.envelope.liveState).toMatchObject({ down: 3, distance: 6, yardLine: 'H44' });
    expect(projectedDrop.envelope.liveState).toEqual(projectedIncomplete.envelope.liveState);
    expect(projectedDrop.envelope.stats).toEqual(projectedIncomplete.envelope.stats);
  });

  it('incomplete pass asks whether it was broken up before asking about a hurry', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const withResult = commitToken(inputToken(withPasser, 'I'));
    const withReceiver = commitToken(inputToken(withResult, '88'));
    const afterSpot = commitToken(inputToken(withReceiver, ''));

    expect(afterSpot.currentStep).toBe('passBreakup');
    const noBreakup = commitToken(inputToken(afterSpot, 'N'));
    expect(noBreakup.currentStep).toBe('hurried');
    expect(noBreakup.tokens.brokenUp).toBe(false);
  });

  it('does not accept broken up as a primary pass result', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const state = commitToken(inputToken(withPasser, 'B'));

    expect(state.status).toBe('token.error');
    expect(state.error?.code).toBe('INVALID_PASS_RESULT');
    expect(state.currentStep).toBe('passResult');
  });

  it('broken up pass allows exactly one defender', () => {
    const reviewing = transition(completeIncompletePassDraft({ brokenUp: true }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.pass?.brokenUpByPlayerId).toBe('V-44');
    expect(reviewing.summary?.summaryText).toContain('broken up by #44 Caleb Moss');
  });

  it('hurried pass allows up to three defenders', () => {
    const reviewing = transition(completeIncompletePassDraft({ hurried: ['44', '90'] }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.pass?.hurriedByPlayerIds).toEqual(['V-44', 'V-90']);
    expect(reviewing.summary?.summaryText).toContain('hurried by #44 Caleb Moss and #90 Omar King');
  });

  it('saves breakup and hurry actors through confirmation and credits the serialized event once per role', () => {
    const reviewing = transition(completeIncompletePassDraft({ brokenUp: true, hurried: ['44', '90'] }), { type: 'GENERATE_SUMMARY' });
    const confirmed = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-09-13T06:00:00Z' });
    expect(confirmed.buildResult?.ok).toBe(true);
    if (!confirmed.buildResult?.ok) throw new Error('Pass must build');
    const event = JSON.parse(JSON.stringify(confirmed.buildResult.event));
    expect(event.result.pass).toMatchObject({ brokenUpByPlayerId: 'V-44', hurriedByPlayerIds: ['V-44', 'V-90'] });
    expect(event.participants.defenders).toEqual([
      { playerId: 'V-44', team: 'V', role: 'passBreakup' },
      { playerId: 'V-44', team: 'V', role: 'qbHurry' },
      { playerId: 'V-90', team: 'V', role: 'qbHurry' },
    ]);
    const envelope = structuredClone(getGameEnvelopeFixture());
    envelope.events = [event];
    const report = buildFootballDefensiveStatsReport(envelope);
    expect(report.teamReports.V.totals).toMatchObject({ breakups: 1, hurries: 2, total: 0 });
  });

  it('interception collects interceptor and return terminal state', () => {
    const state = completeInterceptionTargeting();

    expect(state.status).toBe('draft.ready');
    expect(state.draft?.participants.defenders).toContainEqual(expect.objectContaining({ playerId: 'V-44', role: 'interceptor' }));
    expect(state.draft?.result).toMatchObject({
      code: 'interception',
      endYardLine: 'V40',
      nextPossession: 'V',
      turnover: { type: 'interception', team: 'V', playerId: 'V-44', spot: 'V49' },
      return: { type: 'Interception', returnerPlayerId: 'V-44', returnEndYardLine: 'V40' },
    });
  });

  it('sack requires defender and sack yardline', () => {
    const state = completeSackDraft();

    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      play: { family: 'pass', subtype: 'sack' },
      participants: {
        primary: { playerId: 'H-12', role: 'sackVictim' },
      },
      result: {
        code: 'sack',
        yards: -7,
        endYardLine: 'H37',
      },
    });
    expect(state.draft?.participants.defenders.map((player) => player.playerId)).toEqual(['V-44']);
  });

  it('sack fumble launches fumble flow using sack spot', () => {
    const state = completeSackFumbleDraft();

    expect(state.status).toBe('draft.ready');
    expect(state.draft).toMatchObject({
      play: { family: 'pass', subtype: 'sack' },
      result: {
        code: 'sack',
        endYardLine: 'H37',
        fumble: {
          fumblerPlayerId: 'H-12',
          forcedByPlayerId: 'V-44',
          spot: 'H37',
          recoveredByTeam: 'H',
          recoverySpot: 'H37',
        },
      },
    });
  });

  it('rush conversion relaunches rush flow with passer as default rusher', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const state = commitToken(inputToken(withPasser, 'R'));

    expect(state.flow).toBe('rush');
    expect(state.status).toBe('token.awaiting');
    expect(state.currentStep).toBe('result');
    expect(state.tokens.rusher).toMatchObject({
      playerId: 'H-12',
      role: 'rusher',
      displayName: 'Mason Reed',
    });
    expect(state.draft).toBeUndefined();
  });

  it('duplicate receiver resolution uses duplicate modal path', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const withResult = commitToken(inputToken(withPasser, 'C'));
    const state = commitToken(inputToken(withResult, '3'));

    expect(state.status).toBe('jersey.disambiguating');
    expect(state.duplicate?.role).toBe('receiver');
    expect(state.duplicate?.recommendedPlayerId).toBe('H-3-RB');
  });

  it('duplicate defender resolution uses duplicate modal path', () => {
    const withPasser = commitToken(inputToken(startPass(), '12'));
    const withResult = commitToken(inputToken(withPasser, 'I'));
    const withReceiver = commitToken(inputToken(withResult, '88'));
    const withSpot = commitToken(inputToken(withReceiver, ''));
    const withBreakup = commitToken(inputToken(withSpot, 'B'));
    const state = commitToken(inputToken(withBreakup, '3'));

    expect(state.status).toBe('jersey.disambiguating');
    expect(state.duplicate?.role).toBe('passBreakup');
    expect(state.duplicate?.recommendedPlayerId).toBe('V-3-LB');
  });

  it('pass confirm builds request only', () => {
    const submit = vi.fn();
    const reviewing = transition(completePassDraft({ completeResult: 'T' }), { type: 'GENERATE_SUMMARY' });
    const state = transition(reviewing, {
      type: 'CONFIRM_SUMMARY',
      confirmedAt: '2026-06-20T00:00:05Z',
    });

    expect(state.status).toBe('submitting.confirmed');
    expect(state.buildResult?.ok).toBe(true);
    if (state.buildResult?.ok) {
      expect(state.buildResult.event.type).toBe('pass');
      expect(state.buildResult.event.description).toContain('pass complete');
      expect(state.buildResult.event.result).toMatchObject({
        yards: 7,
        endYardLine: 'V49',
        pass: { terminalYardLine: 'V49', passingYards: 7, receivingYards: 7 },
      });
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it('cancel clears draft', () => {
    const state = transition(completeRushDraft(), { type: 'CANCEL' });

    expect(state).toEqual({
      status: 'cancelled',
      currentToken: '',
      tokens: { laterals: [], tacklers: [], hurryDefenders: [], sackDefenders: [] },
    });
  });

  it('records a spike player for play-by-play while charging the incomplete pass to the team', () => {
    const selected = commitToken(inputToken(startTeamPlay(), 'S'));
    const ready = commitToken(inputToken(selected, '10'));
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    const submitting = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });

    expect(ready).toMatchObject({
      status: 'draft.ready',
      flow: 'teamPlay',
      draft: {
        play: { family: 'pass', subtype: 'spike' },
        participants: { primary: { playerId: 'H-10', role: 'passer' } },
        result: { code: 'incomplete', teamCharged: true, pass: { outcome: 'incomplete' } },
      },
    });
    expect(reviewing.summary?.summaryText).toBe('Spike by James Barbor.');
    expect(submitting.buildResult).toMatchObject({
      ok: true,
      event: { type: 'pass', subtype: 'spike', result: { code: 'incomplete', teamCharged: true } },
    });
  });

  it('uses the named kneeling player only for the exact play-by-play wording', () => {
    const selected = commitToken(inputToken(startTeamPlay(), 'K'));
    const withPlayer = commitToken(inputToken(selected, '10'));
    const ready = commitToken(inputToken(withPlayer, 'H43'));
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    const submitting = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });

    expect(ready.draft).toMatchObject({
      play: { family: 'rush', subtype: 'kneel' },
      participants: { primary: { playerId: 'H-10', role: 'rusher' } },
      result: { code: 'tackle', yards: -1, endYardLine: 'H43', teamCharged: true },
    });
    expect(reviewing.summary?.summaryText).toBe('Kneel down by James Barbor.');
    expect(submitting.buildResult).toMatchObject({
      ok: true,
      event: { type: 'rush', subtype: 'kneel', result: { teamCharged: true } },
    });
  });

  it('runs an aborted play through team fumble recovery without an individual fumbler', () => {
    const selected = commitToken(inputToken(startTeamPlay(), 'A'));
    expect(selected).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'teamPlayFumbleSpot',
    });
    const withFumbleSpot = commitToken(inputToken(selected, 'H42'));
    const forcedBySkipped = commitToken(inputToken(withFumbleSpot, ''));
    const withTeam = commitToken(inputToken(forcedBySkipped, 'H'));
    const withRecoverer = commitToken(inputToken(withTeam, '22'));
    const withSpot = commitToken(inputToken(withRecoverer, 'H43'));
    const ready = commitToken(inputToken(withSpot, 'N'));
    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    const submitting = transition(reviewing, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });

    expect(ready).toMatchObject({
      status: 'draft.ready',
      flow: 'teamPlay',
      draft: {
        play: { family: 'rush', subtype: 'aborted' },
        result: {
          teamCharged: true,
          yards: -2,
          fumble: {
            fumblerPlayerId: 'TM',
            spot: 'H42',
            recoveredByPlayerId: 'H-22',
            recoveredByTeam: 'H',
            recoverySpot: 'H43',
          },
        },
      },
    });
    expect(ready.draft?.participants.primary).toBeUndefined();
    expect(ready.draft?.participants.fumbler).toBeUndefined();
    expect(submitting.buildResult).toMatchObject({
      ok: true,
      event: {
        type: 'rush',
        subtype: 'aborted',
        participants: { primary: null },
        result: {
          yards: -2,
          teamCharged: true,
          fumble: { fumblerPlayerId: 'TM', spot: 'H42', recoverySpot: 'H43' },
        },
      },
    });
  });

  it('submits the three-yard rush with two independently awarded penalty first downs', () => {
    const context = makeContext({ prePlay: { down: 1, distance: 17, yardLine: 'H08', lineToGain: 'H25' } });
    const rush = completeRushDraft({ spot: 'H11' });
    rush.draft!.prePlay = { ...rush.draft!.prePlay, ...context.prePlay };
    rush.draft!.result.yards = 3;
    const queued = transitionWithContext(rush, { type: 'QUEUE_PENALTY_REQUEST' }, context);
    const first = commitPenaltyTokens(startQueuedPenalty(queued, context), ['FMB', 'V', 'A', '', 'S', 'H26', 'A'], context);
    expect(first.draft?.penalties[0]).toMatchObject({ automaticFirstDown: true });
    const question = commitPenaltyTokens(startQueuedPenalty(first, context), ['UC', 'V', 'D', 'A', '', 'S', 'H41'], context);
    expect(question.currentStep).toBe('penaltyDeadBallFirstDown');
    const two = commitPenaltyTokens(question, ['Y'], context);
    expect(two.draft?.penalties[1]).toMatchObject({ automaticFirstDown: true, downCounts: false });
    const reviewed = transitionWithContext(two, {
      type: 'VERIFY_PENALTY_ENFORCEMENT', enforcementOrder: two.draft!.penalties.map((penalty) => penalty.penaltyId),
      down: 1, distance: 10, yardLine: 'H41', firstDownAwarded: true,
    }, context);
    const confirmed = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, context);
    expect(confirmed.buildResult?.ok).toBe(true);
    if (!confirmed.buildResult?.ok) throw new Error('Two-foul rush must build');
    expect(confirmed.buildResult.event.result.officialOutcome?.verified?.firstDownAwards).toHaveLength(2);
    expect(confirmed.buildResult.event.description).not.toContain('down counts');
  });

  it('requires ordered official-state verification before submitting multiple accepted fouls', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const firstFoul = commitPenaltyTokens(
      startQueuedPenalty(queued),
      ['Holding', 'H', 'A', '', 'F', 'V45', 'H45', 'R'],
    );
    const secondEntry = startQueuedPenalty(firstFoul);
    const selectedSecondTeam = commitPenaltyTokens(secondEntry, ['Offside', 'V']);

    expect(selectedSecondTeam).toMatchObject({
      status: 'token.awaiting',
      currentStep: 'penaltyTiming',
      currentToken: 'L',
    });

    const twoFouls = commitPenaltyTokens(
      selectedSecondTeam,
      ['D', 'A', '', 'S', 'V44', 'N'],
    );
    expect(twoFouls.error).toBeUndefined();
    expect(twoFouls.status).toBe('summary.reviewing');
    expect(twoFouls.draft?.penalties).toHaveLength(2);
    expect(twoFouls.draft?.penalties.map((penalty) => penalty.penaltyId)).toEqual([
      'fcqi-rush-client-100-pen-1',
      'fcqi-rush-client-100-pen-2',
    ]);
    expect(twoFouls.draft?.penalties[1]).toMatchObject({ liveBall: false, deadBall: true });

    const blocked = transition(twoFouls, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
    expect(blocked.error).toMatchObject({ code: 'MULTIPLE_PENALTY_REVIEW_REQUIRED' });

    const reviewed = transition(twoFouls, {
      type: 'VERIFY_PENALTY_ENFORCEMENT',
      enforcementOrder: twoFouls.draft!.penalties.map((penalty) => penalty.penaltyId),
      down: 2,
      distance: 6,
      yardLine: 'V44',
      firstDownAwarded: false,
    });
    const confirmed = transition(reviewed, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
    expect(confirmed.buildResult).toMatchObject({
      ok: true,
      event: {
        result: {
          officialOutcome: {
            source: 'penaltyEnforcement',
            operatorVerified: true,
            verified: { down: 2, distance: 6, yardLine: 'V44', firstDownAwarded: false },
          },
        },
      },
    });
  });

  it('does not mutate state/input', () => {
    const state = completeRushDraft();
    const beforeState = clone(state);
    const context = makeContext();
    const beforeContext = clone({ ...context, calculateRushYards: undefined });
    const beforeCalculator = context.calculateRushYards;

    transitionFootballQuickInput(state, { type: 'GENERATE_SUMMARY' }, context);

    expect(state).toEqual(beforeState);
    expect({ ...context, calculateRushYards: undefined }).toEqual(beforeContext);
    expect(context.calculateRushYards).toBe(beforeCalculator);
  });
});

describe('penalties on possession-change plays', () => {
  const cases = [
    ['kickoff', () => completeKickoffReturnDraft({ terminalResult: '.', startSpot: 'V20', endSpot: 'V31' })],
    ['fumble', () => completeDefensiveFumbleReturnAt('V31')],
    ['punt', () => completePuntReturnAt('V31')],
    ['interception', () => completeInterceptionReturnAt('V31')],
  ] as const;

  for (const [label, makePlay] of cases) {
    for (const team of ['H', 'V']) {
      it.each(['P', 'F', 'S'])(`${label}, foul on ${team}, enforcement %s asks timing and confirms a new drive`, (enforcement) => {
        const base = makePlay();
        const question = commitPenaltyTokens(startQueuedPenalty(base), ['Holding', team, 'A', '', enforcement]);
        expect(question.currentStep).toBe('penaltyAfterPossession');
        expect(question.buildResult).toBeUndefined();
        const spotTokens = enforcement === 'F' ? ['V31', 'V21'] : ['V21'];
        const confirmation = commitPenaltyTokens(question, ['Y', ...spotTokens]);
        expect(confirmation).toMatchObject({
          currentStep: 'penaltyConfirmContext',
          tokens: { penaltyContext: { possession: 'V', down: 1, distance: 10, yardLine: 'V21', confirmed: false } },
        });
        expect(confirmation.draft?.penalties).toHaveLength(0);
        const review = commitPenaltyTokens(confirmation, ['Y']);
        expect(review.status).toBe('summary.reviewing');
        expect(validateFootballDraftIntent(review.draft).ok).toBe(true);
        expect(review.draft?.penalties[0]).toMatchObject({ replayDown: false, automaticFirstDown: false, downCounts: false, downConsequence: 'NEW_SERIES' });
        const built = transition(review, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-09-12T00:00:00Z' });
        expect(built.buildResult?.ok).toBe(true);
        if (!built.buildResult?.ok) return;
        expect(built.buildResult.event.result.penaltyContext).toMatchObject({ confirmed: true });
        expect(built.buildResult.event.result.officialOutcome).toMatchObject({
          operatorVerified: true,
          verified: { possession: 'V', down: 1, distance: 10, yardLine: 'V21', lineToGain: 'V31', firstDownAwarded: false },
        });
        const envelope = getGameEnvelopeFixture('normal');
        const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
        expect(projected.diagnostics).toEqual([]);
        expect(projected.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'V21', lineToGain: 'V31' });
        expect(projected.envelope.drives.current).toMatchObject({ team: 'V', startYardLine: 'V21', plays: 0 });
        expect(projected.envelope.events.at(-1).result.penaltyContext).toMatchObject({ confirmed: true });
        expect(projected.envelope.stats.teams[team].penalties.num).toBeGreaterThan(0);
        if (label === 'interception') expect(projected.envelope.stats.players['H-12'].passAttempts).toBeGreaterThan(0);
      });
    }

    it(`${label} also asks for a declined foul`, () => {
      const question = commitPenaltyTokens(startQueuedPenalty(makePlay()), ['Holding', 'V', 'D']);
      expect(question.currentStep).toBe('penaltyAfterPossession');
      const confirmation = commitPenaltyTokens(question, ['Y']);
      expect(confirmation.currentStep).toBe('penaltyConfirmContext');
      expect(confirmation.tokens.penaltyContext).toMatchObject({ possession: 'V', yardLine: 'V31' });
      expect(commitPenaltyTokens(confirmation, ['Y']).draft?.penalties[0].status).toBe('declined');
    });
  }

  it('allows the operator to correct every ball-context field and requires another confirmation', () => {
    const question = commitPenaltyTokens(startQueuedPenalty(completePuntReturnAt('V31')), ['Holding', 'V', 'A', '', 'S', 'Y', 'V21']);
    const corrected = commitPenaltyTokens(question, ['N', 'H', '2', '7', 'H33']);
    expect(corrected.currentStep).toBe('penaltyConfirmContext');
    expect(corrected.tokens.penaltyContext).toMatchObject({ possession: 'H', down: 2, distance: 7, yardLine: 'H33', confirmed: false });
    const review = commitPenaltyTokens(corrected, ['Y']);
    expect(review.draft?.penalties[0].finalSpot).toBe('H33');
    const built = transition(review, { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.buildResult.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'H', down: 2, distance: 7, yardLine: 'H33', lineToGain: 'H40' });
    saveDashboardSeededFootballEnvelope(projected.envelope.gameId, projected.envelope);
    expect(getDashboardSeededFootballEnvelopeRecord(projected.envelope.gameId).envelope.liveState).toMatchObject({ possession: 'H', down: 2, distance: 7, yardLine: 'H33' });
  });

  it('uses the original series when the foul preceded an interception and the down is replayed', () => {
    const question = commitPenaltyTokens(startQueuedPenalty(completeInterceptionReturnAt('V31')), ['Holding', 'H', 'A', '', 'P']);
    const confirmation = commitPenaltyTokens(question, ['N', 'H34', 'R']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ possession: 'H', down: 2, distance: 16, yardLine: 'H34', startNewDrive: false });
    const review = commitPenaltyTokens(confirmation, ['Y']);
    const built = transition(review, { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const envelope = getGameEnvelopeFixture('normal');
    const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'H', down: 2, distance: 16, yardLine: 'H34' });
    expect(projected.projection.driveTransition.shouldStartNew).toBe(false);
  });

  it.each(['punt', 'kickoff'])('%s returned and fumbled back asks who has the ball, even though the starting team recovered it', (family) => {
    const terminal = family === 'punt' ? completePuntReturnThroughTerminal({ terminalResult: 'F' }) : completeKickoffReturnThroughTerminal({ terminalResult: 'F' });
    const base = commitPenaltyTokens(terminal, ['V31', '22', 'H', '12', 'V31', 'N']);
    expect(footballPossessionChanges(base.draft)).toMatchObject({ count: 2, teams: ['H', 'V', 'H'], finalTeam: 'H' });
    const question = commitPenaltyTokens(startQueuedPenalty(base), ['Holding', 'H', 'A', '', 'F']);
    expect(question.currentStep).toBe('penaltyPossessionTeam');
    const confirmation = commitPenaltyTokens(question, ['H', 'V31', 'V41']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ decision: 'multipleChanges', possession: 'H', down: 1, distance: 10, yardLine: 'V41', startNewDrive: true });
    const built = transition(commitPenaltyTokens(confirmation, ['Y']), { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.buildResult.event);
    expect(projected.envelope.drives.current).toMatchObject({ team: 'H', startYardLine: 'V41' });
    expect(projected.projection.driveTransition.shouldStartNew).toBe(true);
  });

  it.each(['interception', 'fumble'])('%s returned and fumbled back is also detected as multiple changes', (family) => {
    const base = family === 'interception'
      ? commitPenaltyTokens(startPass(), ['12', 'X', '44', 'V49', 'F', 'V31', '22', 'H', '12', 'V31', 'N'])
      : commitPenaltyTokens(startRush(), ['22', 'F', '44', 'V', '44', 'V20', 'Y', 'F', 'V31', '22', 'H', '12', 'V31', 'N']);
    expect(base.status).toBe('draft.ready');
    expect(footballPossessionChanges(base.draft)).toMatchObject({ count: 2, finalTeam: 'H' });
    const question = commitPenaltyTokens(startQueuedPenalty(base), ['Holding', 'H', 'A', '', 'S']);
    expect(question.currentStep).toBe('penaltyPossessionTeam');
  });

  it('does not ask about a fumble recovered by the same team without a possession change', () => {
    const base = completeFumbleDraft({ returned: 'no' });
    const next = commitPenaltyTokens(startQueuedPenalty(base), ['Holding', 'H', 'A', '', 'P']);
    expect(next.currentStep).toBe('penaltyFinalSpot');
  });

  it('preserves offensive yards when the foul occurred after a lost fumble', () => {
    const base = completeDefensiveFumbleReturnAt('V31');
    const review = commitPenaltyTokens(startQueuedPenalty(base), ['Holding', 'V', 'A', '', 'F', 'Y', 'V31', 'V21', 'Y']);
    const built = transition(review, { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const envelope = getGameEnvelopeFixture('normal');
    const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
    expect(projected.envelope.stats.players['H-22'].rushYards).toBe(base.draft?.result.yards);
  });

  it('asks again when another foul is attached and replaces the earlier confirmation', () => {
    const first = commitPenaltyTokens(startQueuedPenalty(completeInterceptionReturnAt('V31')), ['Holding', 'V', 'A', '', 'S', 'Y', 'V21', 'Y']);
    const second = commitPenaltyTokens(startQueuedPenalty(first), ['Offside', 'H', 'L', 'A', '', 'S']);
    expect(second.currentStep).toBe('penaltyAfterPossession');
    const review = commitPenaltyTokens(second, ['Y', 'V26', 'Y']);
    expect(review.draft?.penalties).toHaveLength(2);
    expect(new Set(review.draft?.penalties.map(p => p.penaltyId)).size).toBe(2);
    expect(review.draft?.result.penaltyContext?.yardLine).toBe('V26');
    const built = transition(review, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-09-12T00:00:00Z' });
    expect(built.buildResult?.ok).toBe(true);
    expect(review.draft?.result.officialOutcome).toMatchObject({
      operatorVerified: true, verified: { possession: 'V', down: 1, distance: 10, yardLine: 'V26' },
    });
  });

  it('asks for offsetting fouls and still requires confirmation', () => {
    const question = commitPenaltyTokens(startQueuedPenalty(completeInterceptionReturnAt('V31')), ['Holding', 'H', 'O', 'Offside', 'V', 'Y']);
    expect(question.currentStep).toBe('penaltyAfterPossession');
    const confirmation = commitPenaltyTokens(question, ['Y']);
    expect(confirmation.currentStep).toBe('penaltyConfirmContext');
    expect(commitPenaltyTokens(confirmation, ['Y']).draft?.penalties).toHaveLength(2);
  });

  it('No preserves a previous-spot kickoff replay without creating a receiving drive', () => {
    const confirmation = commitPenaltyTokens(startQueuedPenalty(completeKickoffReturnDraft({ terminalResult: '.' })), ['Holding', 'H', 'A', '', 'P', 'N', 'H34', 'R']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ possession: 'H', setupContext: 'awaitingKickoff', startNewDrive: false, yardLine: 'H34' });
    const built = transition(commitPenaltyTokens(confirmation, ['Y']), { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.buildResult.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: null, down: null, kickoffTeam: 'H', nextPlayContext: 'awaitingKickoff', yardLine: 'H34' });
    expect(projected.projection.driveTransition.shouldStartNew).toBe(false);
  });

  it('a declined foul does not erase a standing interception-return touchdown', () => {
    const confirmation = commitPenaltyTokens(startQueuedPenalty(completeInterceptionReturnAt('H00')), ['Holding', 'V', 'D', 'Y']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ setupContext: 'awaitingTry', possession: 'V' });
    const built = transition(commitPenaltyTokens(confirmation, ['Y']), { type: 'CONFIRM_SUMMARY' });
    expect(built.buildResult?.ok).toBe(true);
    if (!built.buildResult?.ok) return;
    const envelope = getGameEnvelopeFixture('normal');
    const projected = applyFootballScorerEventToEnvelope(envelope, built.buildResult.event);
    expect(projected.envelope.liveState.nextPlayContext).toBe('awaitingTry');
    expect(projected.envelope.game.teams.V.score).toBe(envelope.game.teams.V.score + 6);
    expect(projected.projection.driveTransition.shouldStartNew).toBe(false);
  });

  it('also asks on turnover on downs and missed field goals', () => {
    const context = makeContext({ prePlay: { down: 4, distance: 6, yardLine: 'H44', lineToGain: '50' } });
    const start = transitionWithContext(createInitialFootballQuickInputState(), { type: 'START_RUSH', startedBy: 'button' }, context);
    const rush = commitPenaltyTokens(start, ['22', '.', 'H45'], context);
    expect(footballPossessionChanges(rush.draft)).toMatchObject({ count: 1, finalTeam: 'V' });
    const question = commitPenaltyTokens(startQueuedPenalty(rush, context), ['Holding', 'V', 'A', '', 'S'], context);
    expect(question.currentStep).toBe('penaltyAfterPossession');
    const missed = completeFieldGoalDraft({ result: 'M', missedReason: 'R' });
    expect(footballPossessionChanges(missed.draft)).toMatchObject({ count: 1, finalTeam: 'V' });
    expect(commitPenaltyTokens(startQueuedPenalty(missed), ['Holding', 'V', 'A', '', 'S']).currentStep).toBe('penaltyAfterPossession');
  });

  it('defaults to first and goal when the enforced spot is inside the ten', () => {
    const confirmation = commitPenaltyTokens(startQueuedPenalty(completeInterceptionReturnAt('V31')), ['Holding', 'H', 'A', '', 'S', 'Y', 'H05']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ possession: 'V', down: 1, distance: 5, yardLine: 'H05' });
  });

  it('rejects invalid or unconfirmed next-play contexts', () => {
    const confirmation = commitPenaltyTokens(startQueuedPenalty(completePuntReturnAt('V31')), ['Holding', 'V', 'A', '', 'S', 'Y', 'V21']);
    const invalid = commitPenaltyTokens(confirmation, ['N', 'V', '5']);
    expect(invalid.error?.code).toBe('INVALID_DOWN');
    const review = commitPenaltyTokens(confirmation, ['Y']);
    const draft = clone(review.draft!);
    draft.result.penaltyContext!.confirmed = false;
    expect(validateFootballDraftIntent(draft).ok).toBe(false);
  });
});

function startRush(): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_RUSH',
    startedBy: 'hotkey',
    hotkey: 'R',
  });
}

function startPass(): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_PASS',
    startedBy: 'hotkey',
    hotkey: 'P',
  });
}

function startTeamPlay(): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_TEAM_PLAY',
    startedBy: 'hotkey',
    hotkey: 'T',
  });
}

function startPunt(): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_PUNT',
    startedBy: 'hotkey',
    hotkey: 'U',
  });
}

function startKick(context = makeContext()): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_KICK',
    startedBy: 'hotkey',
    hotkey: 'K',
  }, context);
}

function startPenalty(
  source: 'immediate' | 'queued' = 'immediate',
  context: FootballQuickInputContext = makeContext(),
): FootballConfirmedQuickInputState {
  return transitionWithContext(createInitialFootballQuickInputState(), {
    type: 'START_PENALTY',
    startedBy: 'hotkey',
    hotkey: 'E',
    source,
  }, context);
}

function startGameControl(): FootballConfirmedQuickInputState {
  return transition(createInitialFootballQuickInputState(), {
    type: 'START_GAME_CONTROL',
    startedBy: 'hotkey',
    hotkey: 'G',
  });
}

function startQueuedPenalty(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext = makeContext(),
): FootballConfirmedQuickInputState {
  return transitionWithContext(state, {
    type: 'START_PENALTY',
    startedBy: 'button',
    source: 'queued',
  }, context);
}

function commitPenaltyTokens(
  state: FootballConfirmedQuickInputState,
  tokens: string[],
  context: FootballQuickInputContext = makeContext(),
): FootballConfirmedQuickInputState {
  return tokens.reduce((next, token) => commitTokenWithContext(inputTokenWithContext(next, token, context), context), state);
}

function completeAcceptedImmediatePenalty(): FootballConfirmedQuickInputState {
  return commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'A', '', 'H49', 'N']);
}

function completeRushDraft(options: {
  result?: 'T' | 'O' | '.';
  tacklers?: string[];
  spot?: string;
} = {}): FootballConfirmedQuickInputState {
  const result = options.result ?? 'T';
  const tacklers = options.tacklers ?? (result === 'T' ? ['44'] : []);
  const spot = options.spot ?? 'V49';
  const withRusher = commitToken(inputToken(startRush(), '22'));
  const withResult = commitToken(inputToken(withRusher, result));

  if (result === '.') {
    return commitToken(inputToken(withResult, spot));
  }

  let next = withResult;
  if (tacklers[0]) {
    next = commitToken(inputToken(next, tacklers[0]));
    next = commitToken(inputToken(next, tacklers[1] ?? ''));
  } else {
    next = commitToken(inputToken(next, ''));
  }

  return commitToken(inputToken(next, spot));
}

function completeFumbleDraft(options: { returned: 'yes' | 'no' }): FootballConfirmedQuickInputState {
  const withRusher = commitToken(inputToken(startRush(), '22'));
  const withResult = commitToken(inputToken(withRusher, 'F'));
  const withForcedBy = commitToken(inputToken(withResult, '44'));
  const withRecoverTeam = commitToken(inputToken(withForcedBy, 'H'));
  const withRecoverPlayer = commitToken(inputToken(withRecoverTeam, '22'));
  const withRecoverSpot = commitToken(inputToken(withRecoverPlayer, 'V49'));
  return commitToken(inputToken(withRecoverSpot, options.returned));
}

function completeDefensiveFumbleReturnAt(
  endSpot: string,
  context: FootballQuickInputContext = makeContext(),
): FootballConfirmedQuickInputState {
  const withRusher = commitTokenWithContext(inputTokenWithContext(startRush(), '22', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withRusher, 'F', context), context);
  const withForcedBy = commitTokenWithContext(inputTokenWithContext(withResult, '44', context), context);
  const withRecoverTeam = commitTokenWithContext(inputTokenWithContext(withForcedBy, 'V', context), context);
  const withRecoverPlayer = commitTokenWithContext(inputTokenWithContext(withRecoverTeam, '44', context), context);
  const withRecoverSpot = commitTokenWithContext(inputTokenWithContext(withRecoverPlayer, 'V20', context), context);
  const returned = commitTokenWithContext(inputTokenWithContext(withRecoverSpot, 'Y', context), context);
  const terminal = commitTokenWithContext(inputTokenWithContext(returned, '.', context), context);
  return commitTokenWithContext(inputTokenWithContext(terminal, endSpot, context), context);
}

function completeDefensiveFumbleRecoveryAt(recoverySpot: string): FootballConfirmedQuickInputState {
  const withRusher = commitToken(inputToken(startRush(), '22'));
  const withResult = commitToken(inputToken(withRusher, 'F'));
  const withForcedBy = commitToken(inputToken(withResult, '44'));
  const withRecoverTeam = commitToken(inputToken(withForcedBy, 'V'));
  const withRecoverPlayer = commitToken(inputToken(withRecoverTeam, '44'));
  const withRecoverSpot = commitToken(inputToken(withRecoverPlayer, recoverySpot));
  return commitToken(inputToken(withRecoverSpot, 'N'));
}

function completePassDraft(options: {
  completeResult?: 'T' | 'O' | '.';
  tacklers?: string[];
  spot?: string;
} = {}): FootballConfirmedQuickInputState {
  return completePassThroughEndSpot({
    ...options,
    completeResult: options.completeResult ?? 'T',
  });
}

function completePassThroughEndSpot(options: {
  completeResult: 'T' | 'O' | 'F' | 'C' | '.';
  tacklers?: string[];
  spot?: string;
}): FootballConfirmedQuickInputState {
  const completeResult = options.completeResult;
  const tacklers = options.tacklers ?? (completeResult === 'T' ? ['44'] : []);
  const spot = options.spot ?? 'V49';
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withPassResult = commitToken(inputToken(withPasser, 'C'));
  const withReceiver = commitToken(inputToken(withPassResult, '88'));
  const withCaughtAt = commitToken(inputToken(withReceiver, ''));
  const withCompleteResult = commitToken(inputToken(withCaughtAt, completeResult));

  if (completeResult === '.') {
    return commitToken(inputToken(withCompleteResult, spot));
  }

  if (completeResult === 'F' || completeResult === 'C') {
    return commitToken(inputToken(withCompleteResult, spot));
  }

  let next = withCompleteResult;
  if (tacklers[0]) {
    next = commitToken(inputToken(next, tacklers[0]));
    next = commitToken(inputToken(next, tacklers[1] ?? ''));
  } else {
    next = commitToken(inputToken(next, ''));
  }

  return commitToken(inputToken(next, spot));
}

function completePassFumbleDraft(): FootballConfirmedQuickInputState {
  const withEndSpot = completePassThroughEndSpot({ completeResult: 'F' });
  const withForcedBy = commitToken(inputToken(withEndSpot, '44'));
  const withRecoverTeam = commitToken(inputToken(withForcedBy, 'H'));
  const withRecoverPlayer = commitToken(inputToken(withRecoverTeam, '22'));
  const withRecoverSpot = commitToken(inputToken(withRecoverPlayer, 'V49'));
  return commitToken(inputToken(withRecoverSpot, 'no'));
}

function completeIncompletePassDraft(options: {
  dropped?: boolean;
  target?: string;
  brokenUp?: boolean;
  hurried?: string[];
} = {}): FootballConfirmedQuickInputState {
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withResult = commitToken(inputToken(withPasser, options.dropped ? 'D' : 'I'));
  const withReceiver = commitToken(inputToken(withResult, options.target ?? '88'));
  let next = commitToken(inputToken(withReceiver, ''));

  if (!options.dropped) next = commitToken(inputToken(next, options.brokenUp ? 'B' : 'N'));

  if (options.brokenUp) {
    next = commitToken(inputToken(next, '44'));
  }

  next = commitToken(inputToken(next, options.hurried ? 'yes' : 'no'));

  if (options.hurried) {
    next = commitToken(inputToken(next, options.hurried[0] ?? ''));
    next = commitToken(inputToken(next, options.hurried[1] ?? ''));
    if (options.hurried[1]) {
      next = commitToken(inputToken(next, options.hurried[2] ?? ''));
    }
  }

  return next;
}

function completeInterceptionTargeting(): FootballConfirmedQuickInputState {
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withResult = commitToken(inputToken(withPasser, 'X'));
  const withInterceptor = commitToken(inputToken(withResult, '44'));
  const withSpot = commitToken(inputToken(withInterceptor, 'V49'));
  const withTerminal = commitToken(inputToken(withSpot, '.'));
  return commitToken(inputToken(withTerminal, 'V40'));
}

function completeInterceptionReturnAt(
  endSpot: string,
  context: FootballQuickInputContext = makeContext(),
): FootballConfirmedQuickInputState {
  const withPasser = commitTokenWithContext(inputTokenWithContext(startPass(), '12', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withPasser, 'X', context), context);
  const withInterceptor = commitTokenWithContext(inputTokenWithContext(withResult, '44', context), context);
  const withSpot = commitTokenWithContext(inputTokenWithContext(withInterceptor, 'V49', context), context);
  const withTerminal = commitTokenWithContext(inputTokenWithContext(withSpot, '.', context), context);
  return commitTokenWithContext(inputTokenWithContext(withTerminal, endSpot, context), context);
}

function completeSackDraft(): FootballConfirmedQuickInputState {
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withResult = commitToken(inputToken(withPasser, 'S'));
  const withSackA = commitToken(inputToken(withResult, '44'));
  const withSackB = commitToken(inputToken(withSackA, ''));
  return commitToken(inputToken(withSackB, 'H37'));
}

function completeSackFumbleDraft(): FootballConfirmedQuickInputState {
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withResult = commitToken(inputToken(withPasser, 'F'));
  const withSackA = commitToken(inputToken(withResult, '44'));
  const withSackB = commitToken(inputToken(withSackA, ''));
  const withSackSpot = commitToken(inputToken(withSackB, 'H37'));
  const withRecoverTeam = commitToken(inputToken(withSackSpot, 'H'));
  const withRecoverPlayer = commitToken(inputToken(withRecoverTeam, '12'));
  const withRecoverSpot = commitToken(inputToken(withRecoverPlayer, 'H37'));
  return commitToken(inputToken(withRecoverSpot, 'no'));
}

function completePuntReceiveDraft(options: {
  receiveResult: 'T' | 'C' | 'O' | 'M' | 'D';
  spot?: string;
  returner?: string;
  downingPlayer?: string;
}): FootballConfirmedQuickInputState {
  const withPunter = commitToken(inputToken(startPunt(), '9'));
  const withSpot = commitToken(inputToken(withPunter, options.spot ?? 'V26'));
  const withResult = commitToken(inputToken(withSpot, options.receiveResult));

  if (options.receiveResult === 'C') {
    return selectDuplicateIfNeeded(commitToken(inputToken(withResult, options.returner ?? '3')), 'V-3-PR');
  }

  if (options.receiveResult === 'D') {
    const withDowningPlayer = commitToken(inputToken(withResult, options.downingPlayer ?? ''));
    return commitToken(inputToken(withDowningPlayer, options.spot ?? 'V12'));
  }

  return withResult;
}

function completePuntReturnThroughTerminal(options: {
  terminalResult: 'T' | 'O' | 'F' | 'C' | '.';
}): FootballConfirmedQuickInputState {
  const withPunter = commitToken(inputToken(startPunt(), '9'));
  const withSpot = commitToken(inputToken(withPunter, 'V26'));
  const withReceiveResult = commitToken(inputToken(withSpot, 'R'));
  const withReturner = selectDuplicateIfNeeded(commitToken(inputToken(withReceiveResult, '3')), 'V-3-PR');
  return commitToken(inputToken(withReturner, options.terminalResult));
}

function completeMuffedPuntDraft(): FootballConfirmedQuickInputState {
  const withPunter = commitToken(inputToken(startPunt(), '9'));
  const withSpot = commitToken(inputToken(withPunter, 'V26'));
  const withMuff = commitToken(inputToken(withSpot, 'M'));
  const withMuffer = selectDuplicateIfNeeded(commitToken(inputToken(withMuff, '3')), 'V-3-PR');
  const withTeam = commitToken(inputToken(withMuffer, 'H'));
  const withRecoverer = commitToken(inputToken(withTeam, '22'));
  const withRecoverySpot = commitToken(inputToken(withRecoverer, 'V24'));
  return commitToken(inputToken(withRecoverySpot, 'N'));
}

function completePuntReturnDraft(options: {
  terminalResult: 'T' | 'O' | '.';
  tacklers?: string[];
}): FootballConfirmedQuickInputState {
  const terminal = completePuntReturnThroughTerminal({ terminalResult: options.terminalResult });

  if (options.terminalResult === '.') {
    return commitToken(inputToken(terminal, 'V31'));
  }

  let next = terminal;
  const tacklers = options.tacklers ?? (options.terminalResult === 'T' ? ['44'] : []);
  if (tacklers[0]) {
    next = commitToken(inputToken(next, tacklers[0]));
    next = commitToken(inputToken(next, tacklers[1] ?? ''));
  } else {
    next = commitToken(inputToken(next, ''));
  }

  return commitToken(inputToken(next, 'V31'));
}

function completePuntReturnAt(endSpot: string): FootballConfirmedQuickInputState {
  const terminal = completePuntReturnThroughTerminal({ terminalResult: '.' });
  return commitToken(inputToken(terminal, endSpot));
}

function startKickoffReceiveSelection(kickedToSpot = 'V20'): FootballConfirmedQuickInputState {
  const withMenu = commitToken(inputToken(startKick(), 'O'));
  const withKicker = commitToken(inputToken(withMenu, '9'));
  return commitToken(inputToken(withKicker, kickedToSpot));
}

function completeKickoffReceiveDraft(options: {
  receiveResult: 'T' | 'C' | 'O' | 'M' | 'D';
  spot?: string;
  outOfBoundsSpot?: string;
  returner?: string;
}): FootballConfirmedQuickInputState {
  const withKicker = startKickoffReceiveSelection(options.outOfBoundsSpot ?? options.spot ?? 'V20');
  const withResult = commitToken(inputToken(withKicker, options.receiveResult));

  if (options.receiveResult === 'C') {
    return selectDuplicateIfNeeded(commitToken(inputToken(withResult, options.returner ?? '3')), 'V-3-PR');
  }

  if (options.receiveResult === 'O') {
    const spotTheBall = commitToken(inputToken(withResult, 'S'));
    return commitToken(inputToken(spotTheBall, options.spot ?? 'V35'));
  }

  return withResult;
}

function completeKickoffReturnThroughTerminal(options: {
  terminalResult: 'T' | 'O' | 'F' | 'C' | '.';
  startSpot?: string;
}): FootballConfirmedQuickInputState {
  const withKicker = startKickoffReceiveSelection(options.startSpot ?? 'V20');
  const withReceiveResult = commitToken(inputToken(withKicker, 'R'));
  const withReturner = selectDuplicateIfNeeded(commitToken(inputToken(withReceiveResult, '3')), 'V-3-PR');
  return commitToken(inputToken(withReturner, options.terminalResult));
}

function completeMuffedKickoffDraft(): FootballConfirmedQuickInputState {
  const withKicker = startKickoffReceiveSelection();
  const withMuff = commitToken(inputToken(withKicker, 'M'));
  const withMuffer = selectDuplicateIfNeeded(commitToken(inputToken(withMuff, '3')), 'V-3-PR');
  const withTeam = commitToken(inputToken(withMuffer, 'H'));
  const withRecoverer = commitToken(inputToken(withTeam, '22'));
  const withRecoverySpot = commitToken(inputToken(withRecoverer, 'V24'));
  return commitToken(inputToken(withRecoverySpot, 'N'));
}

function completeKickoffReturnDraft(options: {
  terminalResult: 'T' | 'O' | '.';
  tacklers?: string[];
  startSpot?: string;
  endSpot?: string;
}): FootballConfirmedQuickInputState {
  const terminal = completeKickoffReturnThroughTerminal({
    terminalResult: options.terminalResult,
    startSpot: options.startSpot,
  });
  const endSpot = options.endSpot ?? 'V31';

  if (options.terminalResult === '.') {
    return commitToken(inputToken(terminal, endSpot));
  }

  let next = terminal;
  const tacklers = options.tacklers ?? (options.terminalResult === 'T' ? ['44'] : []);
  if (tacklers[0]) {
    next = commitToken(inputToken(next, tacklers[0]));
    next = commitToken(inputToken(next, tacklers[1] ?? ''));
  } else {
    next = commitToken(inputToken(next, ''));
  }

  return commitToken(inputToken(next, endSpot));
}

function completeFieldGoalDraft(options: {
  result: 'G' | 'M' | 'B';
  missedReason?: string;
  blocker?: string;
  kickSpot?: string;
  nextSpot?: string;
}, context = makeContext()): FootballConfirmedQuickInputState {
  const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'F', context), context);
  const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
  const withSpot = commitTokenWithContext(inputTokenWithContext(withKicker, options.kickSpot ?? 'V18', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withSpot, options.result, context), context);

  if (options.result === 'M') {
    const withReason = commitTokenWithContext(inputTokenWithContext(withResult, options.missedReason ?? 'R', context), context);
    const spotting = commitTokenWithContext(inputTokenWithContext(withReason, 'S', context), context);
    return commitTokenWithContext(inputTokenWithContext(spotting, options.nextSpot ?? 'V20', context), context);
  }

  if (options.result === 'B') {
    const withBlocker = commitTokenWithContext(inputTokenWithContext(withResult, options.blocker ?? '44', context), context);
    const spotting = commitTokenWithContext(inputTokenWithContext(withBlocker, 'S', context), context);
    return commitTokenWithContext(inputTokenWithContext(spotting, options.nextSpot ?? 'V20', context), context);
  }

  return withResult;
}

function completePatKickDraft(options: {
  result: 'G' | 'M' | 'B';
  missedReason?: string;
  blocker?: string;
}, context = makeContext()): FootballConfirmedQuickInputState {
  const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'A', context), context);
  const withType = commitTokenWithContext(inputTokenWithContext(withMenu, 'K', context), context);
  const withKicker = commitTokenWithContext(inputTokenWithContext(withType, '9', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withKicker, options.result, context), context);

  if (options.result === 'M') {
    const withReason = commitTokenWithContext(inputTokenWithContext(withResult, options.missedReason ?? 'R', context), context);
    return withReason.currentStep === 'patKickReturnAttempted'
      ? commitTokenWithContext(inputTokenWithContext(withReason, 'N', context), context)
      : withReason;
  }

  if (options.result === 'B') {
    const withBlocker = commitTokenWithContext(inputTokenWithContext(withResult, options.blocker ?? '44', context), context);
    return withBlocker.currentStep === 'patKickReturnAttempted'
      ? commitTokenWithContext(inputTokenWithContext(withBlocker, 'N', context), context)
      : withBlocker;
  }

  return withResult;
}

function completePatRushDraft(options: {
  result: 'G' | 'M' | 'F';
}, context = makeContext()): FootballConfirmedQuickInputState {
  const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'A', context), context);
  const withType = commitTokenWithContext(inputTokenWithContext(withMenu, 'R', context), context);
  const withRusher = commitTokenWithContext(inputTokenWithContext(withType, '22', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withRusher, options.result, context), context);
  return withResult.currentStep === 'patRushReturnAttempted'
    ? commitTokenWithContext(inputTokenWithContext(withResult, 'N', context), context)
    : withResult;
}

function completePatPassDraft(options: {
  result: 'G' | 'M' | 'I' | 'X' | 'F';
}, context = makeContext()): FootballConfirmedQuickInputState {
  const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'A', context), context);
  const withType = commitTokenWithContext(inputTokenWithContext(withMenu, 'P', context), context);
  const withPasser = commitTokenWithContext(inputTokenWithContext(withType, '12', context), context);
  const withReceiver = commitTokenWithContext(inputTokenWithContext(withPasser, '88', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withReceiver, options.result, context), context);
  return withResult.currentStep === 'patPassReturnAttempted'
    ? commitTokenWithContext(inputTokenWithContext(withResult, 'N', context), context)
    : withResult;
}

function inputToken(state: FootballConfirmedQuickInputState, value: string): FootballConfirmedQuickInputState {
  return transition(state, { type: 'INPUT_TOKEN', value });
}

function inputTokenWithContext(
  state: FootballConfirmedQuickInputState,
  value: string,
  context: FootballQuickInputContext,
): FootballConfirmedQuickInputState {
  return transitionWithContext(state, { type: 'INPUT_TOKEN', value }, context);
}

function commitToken(state: FootballConfirmedQuickInputState): FootballConfirmedQuickInputState {
  return transition(state, { type: 'COMMIT_TOKEN' });
}

function commitTokenWithContext(
  state: FootballConfirmedQuickInputState,
  context: FootballQuickInputContext,
): FootballConfirmedQuickInputState {
  return transitionWithContext(state, { type: 'COMMIT_TOKEN' }, context);
}

function selectDuplicateIfNeeded(state: FootballConfirmedQuickInputState, playerId: string): FootballConfirmedQuickInputState {
  if (state.status !== 'jersey.disambiguating') return state;
  return transition(state, { type: 'SELECT_DUPLICATE_PLAYER', playerId });
}

function transition(
  state: FootballConfirmedQuickInputState,
  event: Parameters<typeof transitionFootballQuickInput>[1],
  context = makeContext(),
): FootballConfirmedQuickInputState {
  return transitionFootballQuickInput(state, event, context).state;
}

function transitionWithContext(
  state: FootballConfirmedQuickInputState,
  event: Parameters<typeof transitionFootballQuickInput>[1],
  context: FootballQuickInputContext,
): FootballConfirmedQuickInputState {
  return transitionFootballQuickInput(state, event, context).state;
}

function makeContext(options: {
  rules?: Partial<FootballQuickInputContext['game']['rules']>;
  play?: Partial<FootballQuickInputContext['play']>;
  prePlay?: Partial<FootballQuickInputContext['prePlay']>;
  teamAliases?: FootballQuickInputContext['teamAliases'];
} = {}): FootballQuickInputContext {
  return {
    intentId: 'fcqi-rush-draft-100',
    clientEventId: 'fcqi-rush-client-100',
    now: '2026-06-20T00:00:01Z',
    game: {
      gameId: 'FB-1001',
      teams: {
        H: { team: 'H', teamId: 'TEAM-H', name: 'Home State', abbr: 'HOM' },
        V: { team: 'V', teamId: 'TEAM-V', name: 'Visitor Tech', abbr: 'VIS' },
      },
      rules: {
        kickoffSpot: 'H35',
        touchbackSpot: 'V20',
        kickoffTouchbackSpot: 'V25',
        patSpot: 'V03',
        ...options.rules,
      },
    },
    source: {
      kind: 'fcqi',
      startedBy: 'hotkey',
      hotkey: 'R',
      startedAt: '2026-06-20T00:00:00Z',
      baseEnvelopeVersion: '2026-06-20T00:00:00Z',
      baseEventSequence: 41,
      sessionId: 'scorer-session-1',
      userId: 'user-123',
    },
    play: {
      actionTeam: 'H',
      possession: 'H',
      period: 1,
      clock: '08:42',
      ...options.play,
    },
    prePlay: {
      possession: 'H',
      down: 2,
      distance: 6,
      yardLine: 'H44',
      lineToGain: '50',
      driveId: 'DRV-0002',
      driveNumber: 2,
      ...options.prePlay,
    },
    roster: roster(),
    teamAliases: options.teamAliases,
    deriveRushYardsFromEndSpot: true,
    calculateRushYards: ({ startYardLine, endYardLine, possession }) => {
      const relative = (spot: string | null | undefined) => {
        if (!spot) return null;
        if (spot === 'goal') return 100;
        if (spot === '50') return 50;
        const side = spot.slice(0, 1);
        const yard = Number(spot.slice(1));
        if (!Number.isFinite(yard)) return null;
        return side === possession ? yard : 100 - yard;
      };
      const start = relative(startYardLine);
      const end = relative(endYardLine);
      return typeof start === 'number' && typeof end === 'number' ? end - start : null;
    },
  };
}

function roster(): PlayerResolutionRosterPlayer[] {
  return [
    player('H-10', 'H', '10', 'James Barbor', { position: 'QB', off_position: 'QB' }),
    player('H-22', 'H', '22', 'Jordan Smith', { position: 'RB', off_position: 'RB' }),
    player('H-9', 'H', '9', 'Owen Clark', { position: 'P', off_position: 'P' }),
    player('H-44', 'H', '44', 'Home Moss', { position: 'LB', def_position: 'LB' }),
    player('H-12', 'H', '12', 'Mason Reed', { position: 'QB', off_position: 'QB' }),
    player('H-88', 'H', '88', 'Eli Grant', { position: 'TE', off_position: 'TE' }),
    player('H-3-RB', 'H', '3', 'Jones', { position: 'RB', off_position: 'RB' }),
    player('H-3-LB', 'H', '3', 'Smith', { position: 'OLB', def_position: 'OLB' }),
    player('V-44', 'V', '44', 'Caleb Moss', { position: 'LB', def_position: 'LB' }),
    player('V-90', 'V', '90', 'Omar King', { position: 'DE', def_position: 'DE' }),
    player('V-3-PR', 'V', '3', 'Davis', { position: 'PR' }),
    player('V-3-LB', 'V', '3', 'Vince Lane', { position: 'LB', def_position: 'LB' }),
    player('V-3-WR', 'V', '3', 'Victor West', { position: 'WR', off_position: 'WR' }),
  ];
}

function player(
  playerId: string,
  team: 'H' | 'V',
  jersey: string,
  displayName: string,
  positions: { position: string; off_position?: string; def_position?: string },
): PlayerResolutionRosterPlayer {
  return {
    playerId,
    team,
    jersey,
    displayName,
    ...positions,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


describe('onside kickoff', () => {
  function enter(team: 'H' | 'V', touched: string, returned: boolean) {
    let state = startKickoffReceiveSelection('H45');
    const push = (value: string) => { state = commitToken(inputToken(state, value)); expect(state.error).toBeUndefined(); };
    push('N'); expect(state.currentStep).toBe('onsideTeam');
    push(team); expect(state.currentStep).toBe('onsideSpot');
    push('H45');
    if (team === 'H') { expect(state.currentStep).toBe('onsideTouched'); push(touched ? 'Y' : 'N'); if (touched) { expect(state.currentStep).toBe('onsideToucher'); push(touched); } }
    expect(state.currentStep).toBe('onsideRecoverer'); push(team === 'H' ? '22' : '44');
    expect(state.currentStep).toBe('onsideReturned'); push(returned ? 'Y' : 'N');
    if (returned) { push('.'); push(team === 'H' ? 'V40' : 'H30'); }
    return state;
  }
  it('preserves onside steps through duplicate-player selection', () => {
    let state = startKickoffReceiveSelection('H45');
    for (const value of ['N', 'H', 'H45', 'Y', '3']) state = commitToken(inputToken(state, value));
    expect(state.status).toBe('jersey.disambiguating');
    state = transition(state, { type: 'SELECT_DUPLICATE_PLAYER', playerId: 'V-3-WR' });
    expect(state.currentStep).toBe('onsideRecoverer');
    expect(state.tokens.onsideToucher?.playerId).toBe('V-3-WR');
    state = commitToken(inputToken(state, '3'));
    state = transition(state, { type: 'SELECT_DUPLICATE_PLAYER', playerId: 'H-3-LB' });
    expect(state.currentStep).toBe('onsideReturned');
    expect(state.tokens.onsideRecoverer?.playerId).toBe('H-3-LB');
  });
  it.each(['H', 'V'] as const)('scores a %s onside return in the correct return category', team => {
    let state = startKickoffReceiveSelection('H45');
    for (const value of ['N', team, 'H45', ...(team === 'H' ? ['N'] : []), team === 'H' ? '22' : '44', 'Y', '.', 'goal']) state = commitToken(inputToken(state, value));
    expect(state.draft?.result.scoring).toMatchObject({ team, points: 6 });
    const reviewed = transition(state, { type: 'GENERATE_SUMMARY' });
    expect(reviewed.summary?.summaryText).toContain('for a touchdown');
    const built = transition(reviewed, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' }).buildResult;
    expect(built?.ok).toBe(true);
    if (built?.ok) expect(footballScoringPlayText({}, built.event)).toContain(team === 'H' ? 'fumble return' : 'kickoff return');
  });
  it('keeps the initial touched onside recovery when the return is fumbled', () => {
    let state = startKickoffReceiveSelection('H45');
    for (const value of ['N', 'H', 'H45', 'Y', '44', '22', 'Y', 'F', 'V40', '', 'V', '90', 'V40', 'N']) state = commitToken(inputToken(state, value));
    expect(state.error).toBeUndefined();
    expect(state.draft?.result.kick?.onside).toMatchObject({ touchedByPlayerId: 'V-44', recoveredByPlayerId: 'H-22', recoveredByTeam: 'H' });
    expect(state.draft?.result.fumble).toMatchObject({ fumblerPlayerId: 'H-22', recoveredByTeam: 'V', recoveredByPlayerId: 'V-90' });
    expect(state.draft?.result.nextPossession).toBe('V');
    expect(state.draft?.result.return?.returnYards).toBe(15);
  });
  for (const team of ['H', 'V'] as const) for (const touch of team === 'H' ? ['', '44', 'T'] : ['']) for (const returned of [false, true]) {
    it(`${team} recovery, touch=${touch || 'no'}, returned=${returned}`, () => {
      const ready = enter(team, touch, returned);
      expect(ready.status).toBe('draft.ready');
      expect(validateFootballDraftIntent(ready.draft).ok).toBe(true);
      const reviewed = transition(ready, { type: 'GENERATE_SUMMARY' });
      expect(reviewed.summary?.summaryText).toContain('onside kickoff');
      expect(reviewed.summary?.summaryText).toContain('recovered by');
      if (touch) expect(reviewed.summary?.summaryText).toContain('touched by');
      const submitted = transition(reviewed, { type: 'CONFIRM_SUMMARY', confirmedAt: '2026-06-20T00:00:05Z' });
      expect(submitted.buildResult?.ok, JSON.stringify(submitted.buildResult)).toBe(true);
      if (!submitted.buildResult?.ok) return;
      const event = { ...submitted.buildResult.event, status: 'accepted', sequence: 1 };
      const context = makeContext();
      const envelope = { gameId: 'onside-test', game: context.game, events: [event],
        rosters: { teams: Object.fromEntries(['H', 'V'].map(side => [side, { players: Object.fromEntries(context.roster.filter(p => p.team === side).map(p => [p.playerId, p])) }])) } };
      const stats = projectFootballStatsForEvents(envelope);
      expect(stats.teams.V?.fumbles?.num || 0).toBe(touch ? 1 : 0);
      expect(stats.teams.V?.fumbles?.lost || 0).toBe(touch ? 1 : 0);
      expect(stats.teams.H?.fumbles?.num || 0).toBe(0);
      expect(stats.teams.V?.kickReturns?.num || 0).toBe(team === 'V' && returned ? 1 : 0);
      expect(stats.teams.H?.kickReturns?.num || 0).toBe(0);
      const defense = buildFootballDefensiveStatsReport(envelope);
      expect(defense.teamReports.H.totals.recoveries).toBe(team === 'H' ? 1 : 0);
      expect(defense.teamReports.H.totals.recoveryYards).toBe(team === 'H' && returned ? 15 : 0);
      const offense = buildFootballIndividualOffenseReport(envelope);
      expect(offense.teamReports.V.fumbles.totals.fumbles).toBe(touch ? 1 : 0);
      expect(buildFootballEditedPlaySummary(envelope, event)).toContain('onside kickoff');
      if (returned) expect(event.result.return?.type).toBe(team === 'H' ? 'Fumble' : 'Kickoff');
      else expect(event.result.return).toBeUndefined();
    });
  }
});

describe('onside kicks shorter than ten yards', () => {
  function enter(values: string[], context = makeContext(), kickedTo = 'H40') {
    let state = commitPenaltyTokens(startKick(context), ['O', context.play.actionTeam === 'H' ? '9' : '44', kickedTo, 'N'], context);
    expect(state.error).toBeUndefined();
    return commitPenaltyTokens(state, values, context);
  }
  function submit(state: FootballConfirmedQuickInputState, context = makeContext()) {
    expect(state.error).toBeUndefined();
    expect(validateFootballDraftIntent(state.draft).ok).toBe(true);
    const reviewed = transitionWithContext(state, { type: 'GENERATE_SUMMARY' }, context);
    const built = transitionWithContext(reviewed, { type: 'CONFIRM_SUMMARY' }, context).buildResult;
    expect(built?.ok, JSON.stringify(built)).toBe(true);
    if (!built?.ok) throw new Error('Failed to build short onside kick');
    return { event: { ...built.event, status: 'accepted', sequence: 1 }, summary: reviewed.summary?.summaryText || '' };
  }
  it.each([
    ['H', 'H35', 'H44', true], ['H', 'H35', 'H45', false], ['H', 'H35', 'H46', false],
    ['V', 'V35', 'V44', true], ['V', 'V35', 'V45', false],
    ['H', 'H47', 'V45', true], ['V', 'V47', 'H43', false],
    ['H', 'H30', 'H39', true],
  ] as const)('measures %s kick from %s to %s in field direction', (team, from, to, short) => {
    const context = makeContext({ play: { actionTeam: team, possession: null }, prePlay: { possession: null, yardLine: from } });
    expect(enter([], context, to).currentStep).toBe(short ? 'onsideTouched' : 'onsideTeam');
  });
  it('offers recovery after no touch without asking the touch question again', () => {
    expect(enter(['N']).currentStep).toBe('onsideShortChoice');
    expect(enter(['N', 'R', 'H', 'H40']).currentStep).toBe('onsideRecoverer');
    const { event } = submit(enter(['N', 'R', 'H', 'H40', '22', 'N']));
    const envelope = { game: makeContext().game, events: [event] };
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.H.totals.recoveries).toBe(1);
    expect(projectFootballStatsForEvents(envelope).teams.V?.fumbles?.num || 0).toBe(0);
  });
  it('spots the ball without recovery, fumble, or return statistics', () => {
    const selected = enter(['N', 'S']);
    expect(selected).toMatchObject({ currentStep: 'onsideAwardedSpot', currentToken: 'H40' });
    const { event, summary } = submit(commitPenaltyTokens(selected, ['H40']));
    expect(event.result).toMatchObject({ nextPossession: 'V', endYardLine: 'H40', kick: { kickYards: 5, onside: { disposition: 'spotBall' } } });
    expect(event.result.return).toBeUndefined();
    expect(summary).toContain('ball spotted at the H40 for VIS');
    expect(summary).not.toContain('recovered');
    const envelope = { game: makeContext().game, events: [event] };
    const stats = projectFootballStatsForEvents(envelope);
    expect(stats.teams.V?.fumbles?.num || 0).toBe(0);
    expect(stats.teams.V?.kickReturns?.num || 0).toBe(0);
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.H.totals.recoveries).toBe(0);
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), event);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'H40' });
  });
  it.each(['Y', 'N'])('offers the fair-catch-style touchback advancement: %s', answer => {
    const context = makeContext({ prePlay: { possession: null, yardLine: 'V10' } });
    const state = enter(['N', 'S', 'V05'], context, 'V05');
    expect(state.currentStep).toBe('onsideAdvanceSpot');
    const { event } = submit(commitPenaltyTokens(state, [answer], context), context);
    expect(event.result.endYardLine).toBe(answer === 'Y' ? 'V25' : 'V05');
    expect(event.result.return).toBeUndefined();
  });
  it.each(['H', 'V'] as const)('records an initial touch followed by %s recovery', team => {
    expect(enter(['Y', '44']).currentStep).toBe('onsideTeam');
    const { event } = submit(enter(['Y', '44', team, 'H40', team === 'H' ? '22' : '44', 'N']));
    const stats = projectFootballStatsForEvents({ game: makeContext().game, events: [event] });
    expect(stats.teams.V.fumbles).toMatchObject({ num: 1, lost: team === 'H' ? 1 : 0 });
  });
  it('enters a penalty directly and can require a rekick', () => {
    const penalty = enter(['N', 'E']);
    expect(penalty).toMatchObject({ flow: 'penalty', currentStep: 'penaltyName', draft: { play: { family: 'kickoff', subtype: 'onside' } } });
    const confirmation = commitPenaltyTokens(penalty, ['Free Kick Infraction', 'H', 'A', '', 'P', 'N', 'H30', 'R']);
    expect(confirmation.tokens.penaltyContext).toMatchObject({ setupContext: 'awaitingKickoff', startNewDrive: false, yardLine: 'H30' });
    const ready = commitPenaltyTokens(confirmation, ['Y']);
    // Penalty confirmation already generates the summary.
    const built = transition(ready, { type: 'CONFIRM_SUMMARY' }).buildResult;
    expect(built?.ok, JSON.stringify(ready.error)).toBe(true);
    if (!built?.ok) return;
    expect(ready.summary?.summaryText).toMatch(/rekick|Re-kick/);
    expect(ready.summary?.summaryText).not.toContain('replay down');
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: null, down: null, kickoffTeam: 'H', nextPlayContext: 'awaitingKickoff', yardLine: 'H30' });
    const stats = projectFootballStatsForEvents({ game: makeContext().game, events: [built.event] });
    expect(stats.teams.H?.kickoffs?.num || 0).toBe(0);
  });
  it('can enforce from the end of the kick with receiving-team possession', () => {
    const confirmation = commitPenaltyTokens(enter(['N', 'E']), ['Free Kick Infraction', 'H', 'A', '', 'S', 'Y', 'H35']);
    expect(confirmation.currentStep, JSON.stringify(confirmation.error)).toBe('penaltyConfirmContext');
    expect(confirmation.tokens.penaltyContext).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'H35', startNewDrive: true });
    const ready = commitPenaltyTokens(confirmation, ['Y']);
    const built = transition(ready, { type: 'CONFIRM_SUMMARY' }).buildResult;
    expect(built?.ok, JSON.stringify(ready.error)).toBe(true);
    if (!built?.ok) return;
    const projected = applyFootballScorerEventToEnvelope(getGameEnvelopeFixture('normal'), built.event);
    expect(projected.envelope.liveState).toMatchObject({ possession: 'V', down: 1, distance: 10, yardLine: 'H35' });
    expect(ready.summary?.summaryText).not.toMatch(/rekick|Re-kick/);
  });
});
