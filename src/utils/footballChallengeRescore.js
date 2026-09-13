const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
export const FOOTBALL_CHALLENGE_PLAY_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
export const footballChallengeEventKey = event => event?.eventId || event?.clientEventId;
export const isOverturnedFootballChallenge = event => event?.type === 'gameControl'
  && event.result?.gameControl?.action === 'challenge'
  && ['successful', 'callOverturned'].includes(event.result.gameControl.challengeStatus);

export function footballChallengeTarget(envelope, challenge) {
  const events = envelope?.events || [];
  const index = events.findIndex(event => footballChallengeEventKey(event) === footballChallengeEventKey(challenge));
  const preceding = index < 0 ? events : events.slice(0, index);
  const control = challenge?.result?.gameControl || {};
  const selected = control.rescore?.targetEventId || control.challengedEventId;
  return preceding.find(event => footballChallengeEventKey(event) === selected && FOOTBALL_CHALLENGE_PLAY_TYPES.has(event.type))
    || [...preceding].reverse().find(event => FOOTBALL_CHALLENGE_PLAY_TYPES.has(event.type) && (!event.status || event.status === 'accepted'))
    || null;
}

// Attach the review to a play before subsequent administrative events obscure it.
// This metadata also lets an unfinished correction resume after a refresh.
export function prepareFootballChallengeEvent(envelope, event) {
  const existing = envelope.events?.find(candidate => candidate.clientEventId === event.clientEventId);
  if (existing) return { ...event, ...(existing.source?.challengeContext ? { source: { ...event.source, challengeContext: existing.source.challengeContext } } : {}),
    ...(existing.result?.gameControl?.rescore || existing.result?.gameControl?.challengedEventId
      ? { result: { ...event.result, gameControl: { ...event.result?.gameControl, challengedEventId: existing.result.gameControl.challengedEventId, ...(existing.result.gameControl.rescore ? { rescore: existing.result.gameControl.rescore } : {}) } } } : {}) };
  if (FOOTBALL_CHALLENGE_PLAY_TYPES.has(event.type)) return {
    ...event, source: { ...event.source, challengeContext: {
      liveState: clone(envelope.liveState), scores: { H: envelope.game.teams.H.score || 0, V: envelope.game.teams.V.score || 0 },
    } },
  };
  const control = event.result?.gameControl;
  if (event.type !== 'gameControl' || control?.action !== 'challenge') return event;
  const team = control.teamSide || control.possession;
  const lastReview = [...(envelope.events || [])].reverse().find(candidate => candidate.result?.gameControl?.action === 'challenge'
    && (candidate.result.gameControl.teamSide || candidate.result.gameControl.possession) === team);
  const target = control.challengeStatus !== 'initiated' && lastReview?.result.gameControl.challengeStatus === 'initiated'
    ? footballChallengeTarget(envelope, lastReview) : footballChallengeTarget(envelope, event);
  const targetEventId = footballChallengeEventKey(target) || null;
  return { ...event, result: { ...event.result, gameControl: { ...control, challengedEventId: targetEventId,
    ...(isOverturnedFootballChallenge(event) ? { rescore: { status: 'pending', targetEventId } } : {}),
  } } };
}

export const pendingFootballChallengeRescore = envelope => (envelope?.events || []).find(event =>
  isOverturnedFootballChallenge(event) && event.result.gameControl.rescore?.status === 'pending') || null;
