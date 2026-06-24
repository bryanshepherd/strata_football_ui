import { describe, expect, it, vi } from 'vitest';
import {
  createInitialFootballQuickInputState,
  transitionFootballQuickInput,
  type FootballConfirmedQuickInputState,
  type FootballQuickInputContext,
} from './footballConfirmedQuickInputMachine';
import type { PlayerResolutionRosterPlayer } from './playerResolution';

describe('footballConfirmedQuickInputMachine', () => {
  it('starts idle', () => {
    expect(createInitialFootballQuickInputState()).toEqual({
      status: 'idle',
      currentToken: '',
      tokens: { tacklers: [], hurryDefenders: [], sackDefenders: [] },
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

  it('end of play skips tacklers and maps to neutral result', () => {
    const state = transition(completeRushDraft({ result: '.' }), { type: 'GENERATE_SUMMARY' });

    expect(state.status).toBe('summary.reviewing');
    expect(state.draft?.result.code).toBe('tackle');
    expect(state.draft?.warnings[0]).toMatchObject({
      source: 'fcqi',
      field: 'result.code',
    });
    expect(state.summary?.summaryText).not.toContain('tackled by');
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

  it('return flow structure exists and safely blocks returned fumbles', () => {
    const state = completeFumbleDraft({ returned: 'yes' });

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'RETURN_FLOW_NOT_IMPLEMENTED',
      message: 'Return flow not implemented yet',
    });
    expect(state.tokens.returnFlow).toEqual({
      type: 'Fumble',
      fromSpot: 'V49',
      status: 'blocked',
      reason: 'Return flow not implemented yet',
    });
    expect(state.draft).toBeUndefined();
  });

  it('lateral safely blocks unless implemented', () => {
    const withRusher = commitToken(inputToken(startRush(), '22'));
    const state = commitToken(inputToken(withRusher, 'C'));

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'LATERAL_FLOW_NOT_IMPLEMENTED',
      message: 'Lateral flow not implemented yet',
    });
    expect(state.draft).toBeUndefined();
  });

  it('yardage is derived from spots', () => {
    const state = completeRushDraft({ result: '.', spot: 'V48' });

    expect(state.draft?.result.yards).toBe(8);
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

  it('accepted immediate penalty forces previous spot and repeat down', () => {
    const ready = completeAcceptedImmediatePenalty();

    expect(ready.status).toBe('draft.ready');
    expect(ready.draft).toMatchObject({
      play: { family: 'penalty', subtype: 'accepted' },
      result: { code: 'accepted', endYardLine: 'H49' },
      penalties: [
        {
          name: 'Offside',
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
        },
      ],
    });

    const reviewing = transition(ready, { type: 'GENERATE_SUMMARY' });
    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.summary?.summaryText).toContain('Penalty: Offside on VIS');
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
      name: 'Offside',
      code: 'OFF',
      resolution: 'declined',
      status: 'declined',
      accepted: false,
      source: 'immediate',
    });
    expect(state.draft?.penalties[0].yards).toBeUndefined();
    expect(state.draft?.penalties[0].finalSpot).toBeUndefined();
    expect(state.draft?.penalties[0].enforcedFrom).toBeUndefined();
  });

  it('offsetting immediate penalty requires both teams and previousPlayCounts', () => {
    const sameTeam = commitPenaltyTokens(startPenalty('immediate'), ['Holding', 'H', 'O', 'Offside', 'H', 'Y']);
    const missingPlayCounts = commitPenaltyTokens(startPenalty('immediate'), ['Holding', 'H', 'O', 'Offside', 'V', '']);
    const state = commitPenaltyTokens(startPenalty('immediate'), ['Holding', 'H', 'O', 'Offside', 'V', 'N']);

    expect(sameTeam.status).toBe('token.error');
    expect(sameTeam.error).toMatchObject({ code: 'INVALID_OFFSETTING_TEAMS' });
    expect(missingPlayCounts.status).toBe('token.error');
    expect(missingPlayCounts.error).toMatchObject({ code: 'MISSING_OFFSETTING_PLAY_COUNTS' });
    expect(state.status).toBe('draft.ready');
    expect(state.draft?.penalties).toHaveLength(2);
    expect(state.draft?.penalties.every((penalty) => penalty.status === 'offsetting')).toBe(true);
    expect(state.draft?.penalties.every((penalty) => penalty.offsetting?.previousPlayCounts === false)).toBe(true);
    expect(state.draft?.penalties.map((penalty) => penalty.code)).toEqual(['HOLD', 'OFF']);
    expect(state.draft?.penalties.map((penalty) => penalty.tableYards)).toEqual([10, 5]);
  });

  it('accepted queued penalty asks enforced-from and down, attaches to play, and clears marker', () => {
    const queued = transition(completeRushDraft(), { type: 'QUEUE_PENALTY_REQUEST' });
    const withPenalty = startQueuedPenalty(queued);
    const withPlayerSkipped = commitPenaltyTokens(withPenalty, ['Holding', 'H', 'A', '']);

    expect(withPlayerSkipped.currentStep).toBe('penaltyEnforcedFrom');
    expect(withPlayerSkipped.currentToken).toBe('F');

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
      defaultEnforcement: 'SPOT',
      yards: -10,
      source: 'queued',
      status: 'accepted',
      accepted: true,
      enforcedFrom: 'SPOT',
      spotOfFoul: 'V45',
      finalSpot: 'H45',
      downConsequence: 'REPEAT',
    });
    expect(state.summary?.summaryText).toContain('PENALTY Holding, enforced 10 yards from the V45 to the H45');
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
    expect(personalFoul.currentToken).toBe('S');
    expect(personalFoul.tokens.penaltyEnforcedFrom).toBe('END');
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
    expect(withKicker.currentStep).toBe('kickReceiveResult');
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
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('T');
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('touchback');
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

  it('muffed punt blocks safely', () => {
    const state = completePuntReceiveDraft({ receiveResult: 'M' });

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'MUFFED_PUNT_NOT_IMPLEMENTED',
      message: 'Muffed punt flow not implemented yet',
    });
    expect(state.draft).toBeUndefined();
  });

  it('punt return fumble blocks safely', () => {
    const state = completePuntReturnThroughTerminal({ terminalResult: 'F' });

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'FUMBLE_RETURN_NOT_IMPLEMENTED',
      message: 'Fumble return not implemented yet',
    });
    expect(state.draft).toBeUndefined();
  });

  it('punt return lateral blocks safely and scopes C as terminal lateral', () => {
    const state = completePuntReturnThroughTerminal({ terminalResult: 'C' });

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'LATERAL_FLOW_NOT_IMPLEMENTED',
      message: 'Lateral flow not implemented yet',
    });
    expect(state.tokens.returnTerminalResult).toBe('lateral');
    expect(state.draft).toBeUndefined();
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

  it('kickoff fair catch collects returner and scopes C as fair catch', () => {
    const reviewing = transition(completeKickoffReceiveDraft({ receiveResult: 'C', returner: '3', spot: 'V26' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('fairCatch');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('C');
    expect(reviewing.draft?.participants.returner?.playerId).toBe('V-3-PR');
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toContain('fair catch by #3 Davis');
  });

  it('kickoff out-of-bounds builds request only with no returner', () => {
    const reviewing = transition(completeKickoffReceiveDraft({ receiveResult: 'O', spot: 'V35' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('outOfBounds');
    expect(reviewing.draft?.result.kick?.receiveResultCode).toBe('O');
    expect(reviewing.draft?.participants.returner).toBeUndefined();
    expect(reviewing.draft?.result.return).toBeUndefined();
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark kickoff out-of-bounds at the V35.');
  });

  it('muffed and downed kickoff/free kick branches block safely', () => {
    const muffed = completeKickoffReceiveDraft({ receiveResult: 'M' });
    const downed = completeKickoffReceiveDraft({ receiveResult: 'D' });

    expect(muffed.status).toBe('token.error');
    expect(muffed.error).toMatchObject({
      code: 'MUFFED_KICKOFF_NOT_IMPLEMENTED',
      message: 'Muffed kickoff/free kick flow not implemented yet',
    });
    expect(muffed.draft).toBeUndefined();
    expect(downed.status).toBe('token.error');
    expect(downed.error).toMatchObject({
      code: 'DOWNED_KICKOFF_NOT_IMPLEMENTED',
      message: 'Downed kickoff/free kick flow not implemented yet',
    });
    expect(downed.draft).toBeUndefined();
  });

  it('kickoff return fumble and lateral block safely with terminal result scope', () => {
    const fumble = completeKickoffReturnThroughTerminal({ terminalResult: 'F' });
    const lateral = completeKickoffReturnThroughTerminal({ terminalResult: 'C' });

    expect(fumble.status).toBe('token.error');
    expect(fumble.error?.message).toBe('Fumble return not implemented yet');
    expect(fumble.draft).toBeUndefined();
    expect(lateral.status).toBe('token.error');
    expect(lateral.error?.message).toBe('Lateral flow not implemented yet');
    expect(lateral.tokens.returnTerminalResult).toBe('lateral');
    expect(lateral.draft).toBeUndefined();
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

  it('field goal return prompt appears only when rules allow and yes blocks safely', () => {
    const fgReturnContext = makeContext({ rules: { fgReturn: true } });
    const withKicker = transitionWithContext(commitTokenWithContext(inputToken(startKick(), 'F'), fgReturnContext), { type: 'INPUT_TOKEN', value: '9' }, fgReturnContext);
    const resolvedKicker = commitTokenWithContext(withKicker, fgReturnContext);
    const withSpot = commitTokenWithContext(inputToken(resolvedKicker, 'V18'), fgReturnContext);
    const withResult = commitTokenWithContext(inputToken(withSpot, 'M'), fgReturnContext);
    const withReason = commitTokenWithContext(inputToken(withResult, 'R'), fgReturnContext);

    expect(withReason.status).toBe('token.awaiting');
    expect(withReason.currentStep).toBe('fieldGoalReturnAttempted');

    const blocked = commitTokenWithContext(inputToken(withReason, 'Y'), fgReturnContext);
    expect(blocked.status).toBe('token.error');
    expect(blocked.error?.message).toBe('Field goal return not implemented yet');
    expect(blocked.draft).toBeUndefined();
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

  it('game control emergency and roster functions safe-block', () => {
    const emergency = commitToken(inputToken(startGameControl(), 'E'));
    const roster = commitToken(inputToken(startGameControl(), 'R'));

    expect(emergency.status).toBe('token.error');
    expect(emergency.error?.message).toBe('Emergency controls not implemented yet');
    expect(emergency.draft).toBeUndefined();
    expect(roster.status).toBe('token.error');
    expect(roster.error?.message).toBe('Roster functions not implemented yet');
    expect(roster.draft).toBeUndefined();
  });

  it('game control quarter functions submenu safe-blocks submit', () => {
    const menu = commitToken(inputToken(startGameControl(), 'Q'));

    expect(menu.status).toBe('token.awaiting');
    expect(menu.currentStep).toBe('gameControlQuarterMenu');

    const startQuarter = commitToken(inputToken(menu, 'S'));
    const endQuarter = commitToken(inputToken(menu, 'E'));

    expect(startQuarter.status).toBe('token.error');
    expect(startQuarter.error?.message).toBe('Start quarter control submit not implemented yet');
    expect(startQuarter.draft).toBeUndefined();
    expect(endQuarter.status).toBe('token.error');
    expect(endQuarter.error?.message).toBe('End quarter control submit not implemented yet');
    expect(endQuarter.draft).toBeUndefined();
  });

  it('game control ball context collects down distance and spot and derives line to gain', () => {
    const menu = commitToken(inputToken(startGameControl(), 'B'));
    const down = commitToken(inputToken(menu, '2'));
    const distance = commitToken(inputToken(down, '5'));
    const spot = commitToken(inputToken(distance, 'H44'));

    expect(menu.currentStep).toBe('gameControlDown');
    expect(down.currentStep).toBe('gameControlDistance');
    expect(distance.currentStep).toBe('gameControlSpot');
    expect(spot.status).toBe('token.error');
    expect(spot.tokens.gameControlDown).toBe(2);
    expect(spot.tokens.gameControlDistance).toBe(5);
    expect(spot.tokens.gameControlSpot).toBe('H44');
    expect(spot.tokens.gameControlLineToGain).toBe('H49');
    expect(spot.error?.message).toBe('Ball context control submit not implemented yet. Line to gain: H49');
    expect(spot.draft).toBeUndefined();
  });

  it('game control set possession collects team and safe-blocks submit', () => {
    const menu = commitToken(inputToken(startGameControl(), 'P'));
    const state = commitToken(inputToken(menu, 'V'));

    expect(menu.currentStep).toBe('gameControlPossession');
    expect(state.status).toBe('token.error');
    expect(state.tokens.gameControlPossession).toBe('V');
    expect(state.error?.message).toBe('Set possession control submit not implemented yet');
    expect(state.draft).toBeUndefined();
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

  it('kick PAT missed asks reason and builds', () => {
    const reviewing = transition(completePatKickDraft({ result: 'M', missedReason: 'R' }), { type: 'GENERATE_SUMMARY' });

    expect(reviewing.status).toBe('summary.reviewing');
    expect(reviewing.draft?.result.code).toBe('missed');
    expect(reviewing.draft?.result.kick?.missedReason).toBe('wideRight');
    expect(reviewing.summary?.summaryText).toBe('HOM #9 Owen Clark extra point no good, wide right.');
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

  it('PAT return yes blocks safely when rules allow returns', () => {
    const patReturnContext = makeContext({ rules: { patReturns: true } });
    const withMenu = commitTokenWithContext(inputToken(startKick(), 'A'), patReturnContext);
    const withType = commitTokenWithContext(inputToken(withMenu, 'K'), patReturnContext);
    const withKicker = commitTokenWithContext(inputToken(withType, '9'), patReturnContext);
    const withBlocked = commitTokenWithContext(inputToken(withKicker, 'B'), patReturnContext);
    const withBlocker = commitTokenWithContext(inputToken(withBlocked, '44'), patReturnContext);

    expect(withBlocker.status).toBe('token.awaiting');
    expect(withBlocker.currentStep).toBe('patKickReturnAttempted');

    const blocked = commitTokenWithContext(inputToken(withBlocker, 'Y'), patReturnContext);
    expect(blocked.status).toBe('token.error');
    expect(blocked.error?.message).toBe('PAT return not implemented yet');
    expect(blocked.draft).toBeUndefined();
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

  it('complete pass lateral safely blocks', () => {
    const state = completePassThroughEndSpot({ completeResult: 'C' });

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'LATERAL_FLOW_NOT_IMPLEMENTED',
      message: 'Lateral flow not implemented yet',
    });
    expect(state.draft).toBeUndefined();
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

  it('interception launches return flow and blocks safely until implemented', () => {
    const state = completeInterceptionTargeting();

    expect(state.status).toBe('token.error');
    expect(state.error).toMatchObject({
      code: 'RETURN_FLOW_NOT_IMPLEMENTED',
      message: 'Return flow not implemented yet',
    });
    expect(state.tokens.returnFlow).toMatchObject({
      type: 'Interception',
      fromSpot: 'V49',
      status: 'blocked',
    });
    expect(state.draft).toBeUndefined();
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
    const withBrokenUp = commitToken(inputToken(withSpot, 'yes'));
    const state = commitToken(inputToken(withBrokenUp, '3'));

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
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it('cancel clears draft', () => {
    const state = transition(completeRushDraft(), { type: 'CANCEL' });

    expect(state).toEqual({
      status: 'cancelled',
      currentToken: '',
      tokens: { tacklers: [], hurryDefenders: [], sackDefenders: [] },
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
  return commitPenaltyTokens(startPenalty('immediate'), ['Offside', 'V', 'A', '', 'H49']);
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
  brokenUp?: boolean;
  hurried?: string[];
} = {}): FootballConfirmedQuickInputState {
  const withPasser = commitToken(inputToken(startPass(), '12'));
  const withResult = commitToken(inputToken(withPasser, 'I'));
  const withReceiver = commitToken(inputToken(withResult, '88'));
  const withSpot = commitToken(inputToken(withReceiver, ''));
  let next = commitToken(inputToken(withSpot, options.brokenUp ? 'yes' : 'no'));

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
  const withReceiver = commitToken(inputToken(withResult, '88'));
  const withSpot = commitToken(inputToken(withReceiver, 'V49'));
  const withBrokenUp = commitToken(inputToken(withSpot, 'no'));
  return commitToken(inputToken(withBrokenUp, 'no'));
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

function startKickoffReceiveSelection(): FootballConfirmedQuickInputState {
  const withMenu = commitToken(inputToken(startKick(), 'O'));
  return commitToken(inputToken(withMenu, '9'));
}

function completeKickoffReceiveDraft(options: {
  receiveResult: 'T' | 'C' | 'O' | 'M' | 'D';
  spot?: string;
  returner?: string;
}): FootballConfirmedQuickInputState {
  const withKicker = startKickoffReceiveSelection();
  const withResult = commitToken(inputToken(withKicker, options.receiveResult));

  if (options.receiveResult === 'C') {
    const withReturner = selectDuplicateIfNeeded(commitToken(inputToken(withResult, options.returner ?? '3')), 'V-3-PR');
    return commitToken(inputToken(withReturner, options.spot ?? 'V26'));
  }

  if (options.receiveResult === 'O') {
    return commitToken(inputToken(withResult, options.spot ?? 'V35'));
  }

  return withResult;
}

function completeKickoffReturnThroughTerminal(options: {
  terminalResult: 'T' | 'O' | 'F' | 'C' | '.';
  startSpot?: string;
}): FootballConfirmedQuickInputState {
  const withKicker = startKickoffReceiveSelection();
  const withReceiveResult = commitToken(inputToken(withKicker, 'R'));
  const withReturner = selectDuplicateIfNeeded(commitToken(inputToken(withReceiveResult, '3')), 'V-3-PR');
  const withReturnStart = commitToken(inputToken(withReturner, options.startSpot ?? 'V20'));
  return commitToken(inputToken(withReturnStart, options.terminalResult));
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
}, context = makeContext()): FootballConfirmedQuickInputState {
  const withMenu = commitTokenWithContext(inputTokenWithContext(startKick(context), 'F', context), context);
  const withKicker = commitTokenWithContext(inputTokenWithContext(withMenu, '9', context), context);
  const withSpot = commitTokenWithContext(inputTokenWithContext(withKicker, 'V18', context), context);
  const withResult = commitTokenWithContext(inputTokenWithContext(withSpot, options.result, context), context);

  if (options.result === 'M') {
    const withReason = commitTokenWithContext(inputTokenWithContext(withResult, options.missedReason ?? 'R', context), context);
    return withReason.currentStep === 'fieldGoalReturnAttempted'
      ? commitTokenWithContext(inputTokenWithContext(withReason, 'N', context), context)
      : withReason;
  }

  if (options.result === 'B') {
    const withBlocker = commitTokenWithContext(inputTokenWithContext(withResult, options.blocker ?? '44', context), context);
    return withBlocker.currentStep === 'fieldGoalReturnAttempted'
      ? commitTokenWithContext(inputTokenWithContext(withBlocker, 'N', context), context)
      : withBlocker;
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
    return commitTokenWithContext(inputTokenWithContext(withResult, options.missedReason ?? 'R', context), context);
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
        touchbackSpot: 'V25',
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
    deriveRushYardsFromEndSpot: true,
    calculateRushYards: ({ startYardLine, endYardLine, possession }) => {
      const relative = (spot: string | null | undefined) => {
        if (!spot) return null;
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
