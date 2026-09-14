const resolvedReviews = new Set(['successful', 'unsuccessful', 'callStands', 'callConfirmed', 'callOverturned']);

// Reviews are saved events; opening Review Plays or an editor is not a review.
export function footballReviewActive(envelope) {
  if (envelope?.game?.status === 'final') return false;
  const pending = new Map();
  for (const event of envelope?.events || []) {
    if (event.status && event.status !== 'accepted') continue;
    const control = event.result?.gameControl;
    if (event.type !== 'gameControl' || control?.action !== 'challenge') continue;
    const team = [control.teamSide, control.possession].find(side => side === 'H' || side === 'V')
      || ['H', 'V'].find(side => control.teamId && envelope.game?.teams?.[side]?.teamId === control.teamId)
      || 'officials';
    const status = control.challengeStatus || 'initiated';
    if (status === 'initiated') pending.set(team, control.challengedEventId || null);
    else if (resolvedReviews.has(status)) {
      const target = pending.get(team);
      if (!target || !control.challengedEventId || target === control.challengedEventId) pending.delete(team);
    }
  }
  return pending.size > 0;
}

export function withFootballReviewIndicator(envelope) {
  if (!envelope?.liveState) return envelope;
  const reviewActive = footballReviewActive(envelope);
  return Boolean(envelope.liveState.reviewActive) === reviewActive ? envelope : {
    ...envelope, liveState: { ...envelope.liveState, reviewActive },
  };
}

// Keep the flag up through the completed penalty's summary, until submission.
export function footballPenaltyPendingForInput(state) {
  if (!state || state.status === 'idle') return false;
  return Boolean(state.queuedPenaltyRequested || state.flow === 'penalty' || state.draft?.penalties?.length);
}

export function withFootballPenaltyIndicator(envelope, pending, updatedAt = envelope?.updatedAt) {
  if (!envelope?.liveState) return envelope;
  const penaltyPending = envelope.game?.status !== 'final' && Boolean(pending);
  return Boolean(envelope.liveState.penaltyPending) === penaltyPending ? envelope : {
    ...envelope, updatedAt, liveState: { ...envelope.liveState, penaltyPending },
  };
}
