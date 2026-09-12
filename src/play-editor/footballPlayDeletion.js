import {
  applyFootballScorerEventToEnvelope,
  normalizeFootballScoringSetupEnvelope,
  recalculateFootballDriveTotals,
} from '../services/footballDashboardService';
import { applyFootballEventToEnvelope } from '../utils/footballRulesEngine';
import { buildFootballPlayReplacementEnvelope } from './footballPlayReplacement';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const PLAY_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
const accepted = (event) => !event.status || event.status === 'accepted';
const ballRevision = (event) => event.type === 'gameControl'
  && event.result?.gameControl?.action === 'setBallContext';

export function deleteFootballPlayFromEnvelope(envelope, target, { editedAt = new Date().toISOString() } = {}) {
  if (!envelope || !Array.isArray(envelope.events) || !target) {
    throw new Error('A game envelope and selected play are required.');
  }
  // Never fall back to a recycled sequence when the selected ID disappeared.
  const eventIndex = envelope.events.findIndex((event) => target.eventId
    ? event.eventId === target.eventId
    : target.clientEventId ? event.clientEventId === target.clientEventId
      : event.sequence === target.sequence);
  if (eventIndex < 0) throw new Error('The selected play is no longer in the game log.');
  const original = envelope.events[eventIndex];
  if (!accepted(original) || (!PLAY_TYPES.has(original.type) && !ballRevision(original))) {
    throw new Error('Only a recorded play, penalty, or ball context revision can be deleted here.');
  }
  if (envelope.events.some((event, index) => !accepted(event) || Number(event.sequence) !== index + 1)) {
    throw new Error('This game needs a complete sequential event log before a play can be deleted.');
  }
  if (!original.preState) throw new Error('This play is missing its recorded starting context.');

  const amended = clone(envelope);
  amended.updatedAt = editedAt;
  amended.events = amended.events.filter((_event, index) => index !== eventIndex).map((event, index) => {
    event.sequence = index + 1;
    if (Number.isFinite(Number(event.source?.baseEventSequence))
      && Number(event.source.baseEventSequence) >= Number(original.sequence)) {
      event.source.baseEventSequence = Math.max(0, Number(event.source.baseEventSequence) - 1);
    }
    return event;
  });
  amended.stats = { ...amended.stats, sourceEventSequence: amended.events.length };

  if (original.type !== 'gameControl') {
    const projection = applyFootballEventToEnvelope({ ...envelope, liveState: original.preState }, original);
    const scoring = projection.scoringUpdate;
    if (scoring?.team && Number.isFinite(scoring.points)) {
      amended.game.teams[scoring.team].score = Math.max(0,
        Number(amended.game.teams[scoring.team].score || 0) - scoring.points);
    }
  }

  if (eventIndex === envelope.events.length - 1) {
    // A deleted correction's preState may itself contain an obsolete penalty.
    // Restore the last retained result, including an earlier replaced play.
    const initialDrive = clone([...(envelope.drives?.completed || []), envelope.drives?.current]
      .find((drive) => drive?.driveId && drive.driveId === envelope.events[0].preState?.driveId));
    if (initialDrive) {
      delete initialDrive.endClock;
      delete initialDrive.endPeriod;
      Object.assign(initialDrive, { result: null, plays: 0, yards: 0 });
    }
    let replay = {
      ...clone(envelope), drives: { current: initialDrive || null, completed: [] }, events: [], stats: { teams: {}, players: {}, sourceEventSequence: 0 },
      liveState: clone(envelope.events[0].preState),
    };
    for (const event of amended.events) {
      if (event.type !== 'gameControl') replay.liveState = clone(event.preState || replay.liveState);
      const result = applyFootballScorerEventToEnvelope(replay, event);
      if (result.diagnostics.length) throw new Error(result.diagnostics[0].message);
      replay = result.envelope;
    }
    amended.liveState = amended.events.length ? clone(replay.liveState)
      : ballRevision(original) ? clone(original.preState)
        : buildFootballPlayReplacementEnvelope(envelope, original).liveState;

    if (envelope.game?.status !== 'final' && envelope.pregame?.gamePhase !== 'halftime') {
      const restoreId = amended.liveState?.driveId;
      const drives = [...(amended.drives?.completed || []), amended.drives?.current].filter(Boolean);
      const restoredDrive = drives.find((drive) => drive.driveId === restoreId);
      if (restoredDrive) {
        delete restoredDrive.endClock;
        delete restoredDrive.endPeriod;
        restoredDrive.result = null;
      }
      amended.drives = {
        ...amended.drives,
        current: restoredDrive || null,
        completed: drives.filter((drive) => drive.driveId !== restoreId
          && amended.events.some((event) => event.preState?.driveId === drive.driveId)),
      };
    }
  }
  amended.drives = recalculateFootballDriveTotals(amended);
  return normalizeFootballScoringSetupEnvelope(amended, { rebuildEmptyStats: true });
}
