import { applyFootballScorerEventToEnvelope, normalizeFootballScoringSetupEnvelope, recalculateFootballDriveTotals } from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { footballChallengeEventKey, isOverturnedFootballChallenge, FOOTBALL_CHALLENGE_PLAY_TYPES } from '../utils/footballChallengeRescore';
import { buildFootballPlayReplacementEnvelope, replaceFootballPlayInEnvelope } from './footballPlayReplacement';
import { recalculateFootballPlayContext } from './footballPlayContext';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const fail = message => ({ ok: false, errors: [{ code: 'CHALLENGE_RESCORE_FAILED', message }] });
const findIndex = (events, target) => events.findIndex(event => footballChallengeEventKey(event) === footballChallengeEventKey(target));

export function buildFootballChallengeRescoreEnvelope(envelope, target) {
  const input = buildFootballPlayReplacementEnvelope(envelope, target);
  const recorded = target.source?.challengeContext;
  if (recorded?.liveState) input.liveState = clone(recorded.liveState);
  if (recorded?.scores) for (const team of ['H', 'V']) input.game.teams[team].score = recorded.scores[team];
  // Older overtime plays predate the stored restore context. The last series
  // start identifies the round/team even if the overturned result ended it.
  if (!input.liveState.overtime && Number(target.period) > Number(envelope.game.rules?.periods || 4)) {
    const start = [...input.events].reverse().find(event => event.result?.gameControl?.overtime);
    if (start) {
      const sameRound = input.events.filter(event => event.result?.gameControl?.overtime && event.period === start.period);
      input.liveState.overtime = { round: start.period - Number(envelope.game.rules?.periods || 4), series: sameRound.length,
        phase: 'active', possessionTeam: start.result.gameControl.possession,
        firstTeam: sameRound[0].result.gameControl.possession, nextTeam: null };
    }
  }
  return input;
}

export function rescoreOverturnedFootballPlay(envelope, challenge, target, replacement, { editedAt = new Date().toISOString() } = {}) {
  try {
    const challengeIndex = findIndex(envelope.events, challenge);
    const index = findIndex(envelope.events, target);
    if (!FOOTBALL_CHALLENGE_PLAY_TYPES.has(target?.type)) return fail('Select a recorded play to rescore.');
    if (challengeIndex < 0 || !isOverturnedFootballChallenge(envelope.events[challengeIndex])) return fail('Select a successful or overturned challenge.');
    if (envelope.events[challengeIndex].result.gameControl.rescore?.status === 'complete') return fail('This challenge has already been rescored.');
    if (index < 0 || index >= challengeIndex && !envelope.events[index]?.source?.challengeRescorePending) return fail('Select the play before this challenge.');
    if (JSON.stringify(envelope.events[index]) !== JSON.stringify(target)) return fail('The selected play changed. Reopen the challenge before rescoring.');
    const result = replaceFootballPlayInEnvelope(envelope, target, replacement, { editedAt });
    if (!result.ok) return result;
    const working = clone(result.envelope);
    const challengeId = footballChallengeEventKey(challenge);
    const historyId = `challenge-${challengeId}-${footballChallengeEventKey(target)}-${editedAt}`;
    working.playHistory = [...(working.playHistory || []), {
      historyId, reason: 'challenge', status: target.source?.challengeRescorePending ? 'recalculated' : 'overturned',
      recordedAt: editedAt, challengeEventId: challengeId, replacementEventId: result.event.eventId,
      originalEvent: clone(target.source?.challengeRescorePending?.originalEvent || target),
    }];
    working.events[index].source = { ...working.events[index].source, challengeCorrection: { historyId, challengeEventId: challengeId } };
    delete working.events[index].source.challengeRescorePending;

    let replay = buildFootballChallengeRescoreEnvelope(envelope, target);
    // Start scores at the recorded moment, including legacy games that have no
    // restore snapshot. This keeps a reversed touchdown from surviving on top.
    if (!target.source?.challengeContext?.scores) {
      for (const old of envelope.events.slice(index)) {
        if (!FOOTBALL_CHALLENGE_PLAY_TYPES.has(old.type)) continue;
        const score = applyFootballEventToEnvelope({ ...envelope, liveState: old.preState }, old).scoringUpdate;
        if (score?.team) replay.game.teams[score.team].score -= Number(score.points || 0);
      }
    }
    const currentId = replay.liveState.driveId;
    const driveNumber = Number(replay.liveState.driveNumber || 0);
    const drives = [...(envelope.drives?.completed || []), envelope.drives?.current].filter(Boolean);
    const current = clone(drives.find(drive => drive.driveId === currentId)) || null;
    if (current) { delete current.endClock; delete current.endPeriod; current.result = null; }
    replay.drives = { current, completed: clone(drives.filter(drive => drive.driveId !== currentId && Number(drive.driveNumber) <= driveNumber)) };
    replay.drives = recalculateFootballDriveTotals(replay);
    const calculated = [];
    for (let i = index; i < working.events.length; i += 1) {
      let event = clone(working.events[i]);
      const beforeState = clone(replay.liveState);
      if (i > index && FOOTBALL_CHALLENGE_PLAY_TYPES.has(event.type)) {
        try {
          working.drives = clone(replay.drives);
          const rebased = recalculateFootballPlayContext(working, event, { editedAt, expectedContext: beforeState });
          event = rebased.events[i];
          calculated.push(event.sequence);
        } catch (error) {
          // Keep the entire batch local until the operator confirms actors or
          // enforcement that cannot safely be inferred from a new start spot.
          working.events[i] = { ...event, preState: beforeState, possession: beforeState.possession,
            source: { ...event.source, challengeRescorePending: { originalEvent: clone(event) },
              challengeContext: { liveState: beforeState, scores: { H: replay.game.teams.H.score, V: replay.game.teams.V.score } } } };
          return { ok: true, envelope: working, event: working.events[index], needsRescore: { target: working.events[i], message: error.message }, warnings: [] };
        }
      }
      event.preState = beforeState;
      event.source = { ...event.source, challengeContext: { liveState: beforeState, scores: { H: replay.game.teams.H.score, V: replay.game.teams.V.score } } };
      replay.game.period = event.period;
      replay.clock = { ...replay.clock, period: event.period, clock: event.clock, isRunning: false };
      const applied = applyFootballScorerEventToEnvelope(replay, event);
      if (applied.diagnostics.length) return fail(applied.diagnostics[0].message);
      replay = applied.envelope;
      event.postState = clone(replay.liveState);
      working.events[i] = event;
    }
    const counts = Object.fromEntries(['timeouts', 'challenges', 'challengeLog'].filter(key => key in envelope.liveState).map(key => [key, clone(envelope.liveState[key])]));
    working.liveState = { ...replay.liveState, ...counts };
    working.drives = replay.drives;
    working.game.teams = replay.game.teams;
    if (replay.liveState.overtime && !envelope.game.wrapUp?.completedAt) {
      working.game.status = replay.game.status;
      working.game.period = replay.game.period;
      working.clock = { ...replay.clock, isRunning: false };
      working.pregame = { ...working.pregame, gamePhase: replay.game.status === 'final' ? 'final' : 'live' };
    }
    const resolution = working.events[challengeIndex];
    const firstCorrection = working.playHistory.find(record => record.challengeEventId === challengeId);
    resolution.result.gameControl.rescore = { status: 'complete', targetEventId: footballChallengeEventKey(firstCorrection.originalEvent), replacementEventId: firstCorrection.replacementEventId, completedAt: editedAt };
    working.updatedAt = editedAt;
    working.drives = recalculateFootballDriveTotals(working);
    const normalized = normalizeFootballScoringSetupEnvelope(working, { rebuildEmptyStats: true });
    return { ok: true, envelope: normalized, event: normalized.events[index], recalculatedSequences: calculated, warnings: [] };
  } catch (error) { return fail(error.message || 'The challenge correction could not be calculated.'); }
}
