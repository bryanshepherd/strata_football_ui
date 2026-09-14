import { describe, expect, it } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope } from '../services/footballDashboardService';
import { footballPenaltyPendingForInput, footballReviewActive, withFootballPenaltyIndicator } from './footballLiveIndicators';

const base = () => structuredClone(getGameEnvelopeFixture('normal'));
const challenge = (envelope, status, extra = {}) => applyFootballScorerEventToEnvelope(envelope, {
  eventId: `review-${envelope.events.length}`, clientEventId: `review-${envelope.events.length}`,
  type: 'gameControl', subtype: 'challenge', status: 'accepted', period: envelope.game.period,
  clock: envelope.clock.clock, acceptedAt: '2026-09-14T16:00:00Z',
  result: { code: 'noPlay', gameControl: { action: 'challenge', teamSide: 'V', challengeStatus: status, ...extra } },
}).envelope;

describe('live XML indicators', () => {
  it.each(['callConfirmed', 'callStands', 'callOverturned', 'successful', 'unsuccessful'])('turns review on at initiation and off for %s, including after reload', status => {
    const start = base();
    const reviewing = challenge(start, 'initiated');
    expect(reviewing.liveState.reviewActive).toBe(true);
    expect(normalizeFootballScoringSetupEnvelope(JSON.parse(JSON.stringify(reviewing))).liveState.reviewActive).toBe(true);
    const resolved = challenge(reviewing, status);
    expect(resolved.liveState.reviewActive).toBe(false);
    expect(normalizeFootballScoringSetupEnvelope(JSON.parse(JSON.stringify(resolved))).liveState.reviewActive).toBe(false);
    expect(resolved.events).toHaveLength(start.events.length + 2);
    expect(resolved.game.teams).toEqual(start.game.teams);
  });

  it('rebuilds review after removing or editing its outcome and ignores deleted and historical events', () => {
    const reviewing = challenge(base(), 'initiated');
    const resolved = challenge(reviewing, 'callConfirmed');
    const corrected = { ...resolved, events: resolved.events.slice(0, -1) };
    expect(normalizeFootballScoringSetupEnvelope(corrected).liveState.reviewActive).toBe(true);
    corrected.events.at(-1).status = 'deleted';
    corrected.playHistory = [{ originalEvent: reviewing.events.at(-1) }];
    expect(footballReviewActive(corrected)).toBe(false);
    resolved.liveState.reviewActive = true;
    expect(normalizeFootballScoringSetupEnvelope(resolved).liveState.reviewActive).toBe(false);
  });

  it('does not resolve a different team or a different challenged play', () => {
    const reviewing = challenge(base(), 'initiated', { challengedEventId: 'play-1' });
    expect(challenge(reviewing, 'callConfirmed', { teamSide: 'H', challengedEventId: 'play-1' }).liveState.reviewActive).toBe(true);
    expect(challenge(reviewing, 'callConfirmed', { challengedEventId: 'play-2' }).liveState.reviewActive).toBe(true);
    expect(challenge(reviewing, 'callConfirmed', { challengedEventId: 'play-1' }).liveState.reviewActive).toBe(false);
    reviewing.game.status = 'final';
    expect(normalizeFootballScoringSetupEnvelope(reviewing).liveState.reviewActive).toBe(false);
  });

  it('keeps queued and immediate penalties pending until submission or cancellation, including a resolved draft', () => {
    for (const state of [
      { status: 'token.awaiting', queuedPenaltyRequested: true },
      { status: 'token.awaiting', flow: 'penalty' },
      { status: 'summary.reviewing', queuedPenaltyRequested: false, draft: { penalties: [{ status: 'declined' }] } },
    ]) expect(footballPenaltyPendingForInput(state)).toBe(true);
    expect(footballPenaltyPendingForInput({ status: 'idle' })).toBe(false);
    expect(footballPenaltyPendingForInput({ status: 'token.awaiting', flow: 'rush', queuedPenaltyRequested: false })).toBe(false);
  });

  it('changes only pending state and timestamp, clears on submission, and does not flag final games', () => {
    const start = base();
    const before = JSON.stringify(start);
    const pending = withFootballPenaltyIndicator(start, true, '2026-09-14T16:00:00Z');
    expect(pending.liveState.penaltyPending).toBe(true);
    expect(pending.events).toBe(start.events);
    expect(pending.stats).toBe(start.stats);
    expect(pending.game).toBe(start.game);
    expect(pending.drives).toBe(start.drives);
    expect(withFootballPenaltyIndicator(pending, true)).toBe(pending);
    const accepted = challenge(pending, 'initiated');
    expect(accepted.liveState.penaltyPending).toBe(false);
    expect(accepted.liveState.reviewActive).toBe(true);
    expect(JSON.stringify(start)).toBe(before);
    expect(withFootballPenaltyIndicator({ ...pending, game: { ...pending.game, status: 'final' } }, true).liveState.penaltyPending).toBe(false);
  });
});
