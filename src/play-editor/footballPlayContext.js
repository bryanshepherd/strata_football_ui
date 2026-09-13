import {
  applyFootballScorerEventToEnvelope,
  normalizeFootballScoringSetupEnvelope,
  recalculateFootballDriveTotals,
} from '../services/footballDashboardService';
import { applyFootballEventToEnvelope, calculateYardsGained } from '../utils/footballRulesEngine';
import { normalizeFootballSpot } from '../utils/footballSpotNormalization';
import { buildFootballEditedPlaySummary } from './footballPlayEditEnvelope';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const PLAY_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
const FIELDS = ['possession', 'down', 'distance', 'yardLine', 'lineToGain', 'goalToGo'];
const CONTEXT_FIELDS = [...FIELDS, 'redZone', 'driveId', 'driveNumber', 'pendingTryTeam', 'kickoffTeam', 'nextPlayContext'];
const accepted = (event) => !event.status || event.status === 'accepted';
export const footballContextEventKey = (event) => event?.eventId || event?.clientEventId || `sequence-${event?.sequence}`;

const comparable = (field, value) => {
  if (field === 'goalToGo') return Boolean(value);
  if (value == null || value === '') return null;
  if (field === 'down' || field === 'distance') return Number(value);
  if (field === 'yardLine' || field === 'lineToGain') return normalizeFootballSpot(value) || value;
  return String(value).toUpperCase();
};
const differences = (left, right) => FIELDS.filter((field) => (
  comparable(field, left?.[field]) !== comparable(field, right?.[field])
));

// Historical projections must not inherit the final game's drive count or setup.
const historicalBase = (envelope, event, state) => {
  const drives = [...(envelope.drives?.completed || []), envelope.drives?.current].filter(Boolean);
  return {
    ...envelope,
    events: [],
    liveState: clone(state),
    clock: { ...envelope.clock, period: event.period, clock: event.clock },
    drives: {
      current: clone(drives.find((drive) => drive.driveId === state?.driveId)) || null,
      completed: [],
    },
  };
};

const canonicalDriveContext = (envelope, state) => {
  if (!state) return null;
  const drive = [...(envelope.drives?.completed || []), envelope.drives?.current]
    .find((candidate) => candidate?.driveId && candidate.driveId === state.driveId);
  const context = {
    ...Object.fromEntries(CONTEXT_FIELDS.filter((field) => field in state).map((field) => [field, clone(state[field])])),
    ...(drive?.driveNumber ? { driveNumber: drive.driveNumber } : {}),
  };
  for (const field of ['possession', 'down', 'distance', 'yardLine', 'lineToGain']) {
    if (field in context) context[field] = comparable(field, context[field]);
  }
  return context;
};

const projectPlay = (envelope, event, state) => applyFootballEventToEnvelope(
  historicalBase(envelope, event, state), event,
  { nextDriveId: event.postState?.driveId || undefined },
);

/** Read-only continuity audit. Plays keep their recorded starts; controls act on
 * the preceding result, so a timeout cannot reintroduce its stale preState and
 * an explicit ball/possession correction becomes the next authoritative state. */
export function reviewFootballPlayContexts(envelope) {
  const reviews = new Map();
  let state = null;
  let previous = null;
  for (const event of envelope?.events || []) {
    if (!accepted(event)) continue;
    const contiguous = previous && Number(event.sequence) === Number(previous.sequence) + 1;
    if (!contiguous) state = null;
    if (PLAY_TYPES.has(event.type)) {
      const expected = canonicalDriveContext(envelope, state);
      reviews.set(footballContextEventKey(event), {
        recorded: clone(event.preState), expected,
        previousSequence: previous?.sequence,
        fields: expected && event.preState ? differences(event.preState, expected) : [],
        unavailable: !event.preState ? 'This play has no recorded starting context.'
          : !expected ? 'No preceding ending context is available for this play.' : '',
      });
      try {
        // Earlier records often omit postState; derive it from that play's own
        // recorded start, never from the following play's potentially stale start.
        state = event.postState && FIELDS.slice(0, 5).every((field) => field in event.postState)
          ? clone(event.postState)
          : event.preState ? projectPlay(envelope, event, { ...state, ...event.preState }).liveState : null;
      } catch {
        state = null;
      }
    } else if (event.type === 'gameControl') {
      const control = event.result?.gameControl;
      const explicit = ['setBallContext', 'setPossession', 'startDrive'].includes(control?.action);
      const start = state || (explicit ? event.preState : null);
      if (start) {
        try {
          const result = applyFootballScorerEventToEnvelope(historicalBase(envelope, event, start), event);
          state = result.diagnostics.length ? null : result.envelope.liveState;
        } catch {
          state = null;
        }
      }
    } else {
      state = null;
    }
    previous = event;
  }
  return { reviews, endingContext: canonicalDriveContext(envelope, state) };
}

export function recalculateFootballPlayContext(envelope, target, { editedAt = new Date().toISOString(), expectedContext } = {}) {
  const events = envelope?.events || [];
  const index = events.findIndex((event) => footballContextEventKey(event) === footballContextEventKey(target));
  if (index < 0) throw new Error('The selected play is no longer in the game log.');
  const original = events[index];
  if (!PLAY_TYPES.has(original.type) || !accepted(original)) throw new Error('Only a recorded play can be recalculated here.');
  if (JSON.stringify(original) !== JSON.stringify(target)) throw new Error('This play changed while the editor was open. Close and reopen it before recalculating.');
  if (events.some((event, i) => !accepted(event) || Number(event.sequence) !== i + 1)) {
    throw new Error('This game needs a complete sequential event log before recalculating a play.');
  }
  const review = expectedContext ? { expected: expectedContext, previousSequence: events[index - 1]?.sequence }
    : reviewFootballPlayContexts(envelope).reviews.get(footballContextEventKey(original));
  if (review.unavailable) throw new Error(review.unavailable);
  const event = clone(original);
  event.preState = { ...event.preState, ...review.expected };
  if (event.preState.possession) event.possession = event.preState.possession;
  const actorTeam = event.participants?.primary?.team || event.participants?.punter?.team;
  if (['rush', 'pass', 'punt', 'fieldGoal'].includes(event.type) && actorTeam && actorTeam !== event.possession) {
    throw new Error('The expected possession does not match this play’s recorded players. Use Replace This Play to correct the team and participants.');
  }

  // Context-derived shortcuts must not override this explicit recalculation.
  // Confirmed officiating decisions remain authoritative.
  delete event.postState;
  delete event.result.firstDown;
  const official = event.result.officialOutcome;
  if (official && !official.operatorVerified && !official.operatorAdjusted) delete event.result.officialOutcome;

  const moved = comparable('yardLine', original.preState.yardLine) !== comparable('yardLine', event.preState.yardLine);
  if (moved) {
    const simpleScrimmage = ['rush', 'pass'].includes(event.type)
      && !event.result.turnover && !event.result.fumble && !event.result.laterals?.length
      && !event.penalties?.length && !['interception', 'fumble'].includes(event.result.code);
    if (!simpleScrimmage) throw new Error('The starting spot changed on a kick, penalty, or possession-change play. Use Replace This Play to confirm its yardage and enforcement.');
    const yards = event.result.code === 'incomplete' ? 0
      : calculateYardsGained(event.preState.yardLine, event.result.endYardLine, event.possession);
    if (yards == null) throw new Error('This play needs a recorded ending spot before its yardage can be recalculated.');
    event.result.yards = yards;
    if (event.result.code === 'incomplete') event.result.endYardLine = event.preState.yardLine;
    if (event.result.pass) {
      event.result.pass.startYardLine = event.preState.yardLine;
      for (const field of ['passingYards', 'receivingYards']) {
        if (field in event.result.pass) event.result.pass[field] = yards;
      }
    }
  }
  const projection = projectPlay(envelope, event, event.preState);
  event.postState = canonicalDriveContext(envelope, projection.liveState);
  event.result.firstDown = projection.firstDown;
  event.source = { ...event.source, contextRecalculation: {
    recalculatedAt: editedAt, previousEventId: events[index - 1]?.eventId || null,
    previousSequence: review.previousSequence,
    previousPreState: clone(original.preState), previousPostState: clone(original.postState),
  } };
  if (moved) {
    // Older events store participant IDs only. Resolve labels for the summary
    // without changing their recorded identities or replacing names with unknown.
    const summaryEvent = clone(event);
    const hydrate = (participant) => {
      if (!participant) return participant;
      const player = envelope.rosters?.teams?.[participant.team]?.players?.[participant.playerId];
      return { ...player, ...participant };
    };
    summaryEvent.participants = Object.fromEntries(Object.entries(summaryEvent.participants || {}).map(([key, value]) => (
      [key, Array.isArray(value) ? value.map(hydrate) : hydrate(value)]
    )));
    event.description = buildFootballEditedPlaySummary(envelope, summaryEvent);
    if (event.confirmation) event.confirmation.summaryText = event.description;
  }
  const amended = clone(envelope);
  amended.updatedAt = editedAt;
  amended.events[index] = event;
  const oldScoring = projectPlay(envelope, original, original.preState).scoringUpdate;
  for (const [scoring, sign] of [[oldScoring, -1], [projection.scoringUpdate, 1]]) {
    if (scoring?.team && Number.isFinite(Number(scoring.points))) {
      amended.game.teams[scoring.team].score = Number(amended.game.teams[scoring.team].score || 0) + sign * Number(scoring.points);
    }
  }
  if (!events.slice(index + 1).some((candidate) => accepted(candidate) && PLAY_TYPES.has(candidate.type))) {
    const ending = reviewFootballPlayContexts(amended).endingContext;
    if (ending) amended.liveState = { ...amended.liveState, ...ending };
  }
  amended.drives = recalculateFootballDriveTotals(amended);
  return normalizeFootballScoringSetupEnvelope(amended);
}
