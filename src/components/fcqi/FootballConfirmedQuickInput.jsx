import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createInitialFootballQuickInputState,
  transitionFootballQuickInput,
} from '../../quick-input/footballConfirmedQuickInputMachine';
import { submitFootballFcqiEvent } from '../../quick-input/footballSubmitAdapter';
import { calculateYardsGained } from '../../utils/footballRulesEngine';
import FootballDuplicatePlayerModal from './FootballDuplicatePlayerModal';
import FootballFlowModal from './FootballFlowModal';
import { buildFootballFlowProgressSteps } from './FootballFlowProgress';
import FootballPlaySummaryModal from './FootballPlaySummaryModal';

const PLAY_BUTTONS = [
  { label: 'Rush', hotkey: 'R', enabled: true },
  { label: 'Pass', hotkey: 'P', enabled: true },
  { label: 'Punt', hotkey: 'U', enabled: true },
  { label: 'Kick', hotkey: 'K', enabled: true },
  { label: 'Penalty', hotkey: 'E', enabled: true },
  { label: 'Game Control', hotkey: 'G', enabled: true },
];

const editableSelector = 'input, textarea, select, [contenteditable="true"]';

export const getFootballFcqiAssistantMessage = (state) => {
  if (!state || state.status === 'idle' || state.status === 'cancelled') return 'Choose a play type.';
  if (state.queuedPenaltyRequested) return 'Penalty queued — resolve before submitting';
  if (state.status === 'jersey.disambiguating') return 'Multiple players found. Confirm the correct player.';
  if (state.status === 'summary.reviewing') return 'Review play summary before confirming.';
  if (state.status === 'submitting.confirmed') return 'Submit request built.';
  if (state.status === 'draft.ready') return 'Review play summary before confirming.';
  if (state.currentStep === 'rusherJersey') return 'Enter rusher jersey number.';
  if (state.currentStep === 'result') return 'Choose rush result.';
  if (state.currentStep === 'passerJersey') return 'Enter passer jersey number.';
  if (state.currentStep === 'passResult') return 'Choose pass result.';
  if (state.currentStep === 'receiverJersey') return 'Enter receiver jersey number.';
  if (state.currentStep === 'caughtAtSpot') return 'Enter caught-at yardline or skip.';
  if (state.currentStep === 'completeResult') return 'Choose complete pass result.';
  if (state.currentStep === 'intendedReceiverJersey') return 'Enter intended receiver jersey number.';
  if (state.currentStep === 'passYardLine') return 'Enter pass yardline or skip.';
  if (state.currentStep === 'brokenUp') return 'Was the pass broken up?';
  if (state.currentStep === 'brokenUpDefenderJersey') return 'Enter pass breakup defender jersey.';
  if (state.currentStep === 'hurried') return 'Was the passer hurried?';
  if (state.currentStep === 'hurryDefender1Jersey') return 'Enter hurry defender jersey.';
  if (state.currentStep === 'hurryDefender2Jersey') return 'Enter another hurry defender or skip.';
  if (state.currentStep === 'hurryDefender3Jersey') return 'Enter third hurry defender or skip.';
  if (state.currentStep === 'sackDefenderAJersey') return 'Enter sack defender jersey.';
  if (state.currentStep === 'sackDefenderBJersey') return 'Enter second sack defender or skip.';
  if (state.currentStep === 'sackSpot') return 'Enter sack yardline.';
  if (state.currentStep === 'punterJersey') return 'Enter punter jersey number.';
  if (state.currentStep === 'puntSpot') return 'Enter punt receive or dead-ball spot.';
  if (state.currentStep === 'puntReceiveResult') return 'Choose kick receive result.';
  if (state.currentStep === 'returnerJersey') return 'Enter returner jersey number.';
  if (state.currentStep === 'returnTerminalResult') return 'Choose return result.';
  if (state.currentStep === 'returnTackleAJersey') return 'Enter return tackler jersey.';
  if (state.currentStep === 'returnTackleBJersey') return 'Enter second return tackler or skip.';
  if (state.currentStep === 'returnEndSpot') return 'Enter return final spot.';
  if (state.currentStep === 'downingPlayerJersey') return 'Enter downing player jersey or skip.';
  if (state.currentStep === 'downedSpot') return 'Enter downed spot.';
  if (state.currentStep === 'kickMenu') return 'Choose kick type.';
  if (state.currentStep === 'kickerJersey') return 'Enter kicker jersey number.';
  if (state.currentStep === 'kickReceiveResult') return 'Choose kick receive result.';
  if (state.currentStep === 'kickReturnStartSpot') return 'Enter kick return start spot.';
  if (state.currentStep === 'kickTouchbackSpot') return 'Enter touchback spot.';
  if (state.currentStep === 'kickFairCatchSpot') return 'Enter fair catch spot.';
  if (state.currentStep === 'kickOutOfBoundsSpot') return 'Enter out-of-bounds spot.';
  if (state.currentStep === 'fieldGoalSpot') return 'Enter yardline kicked from.';
  if (state.currentStep === 'fieldGoalResult') return 'Choose field goal result.';
  if (state.currentStep === 'fieldGoalMissedReason') return 'Choose missed field goal reason.';
  if (state.currentStep === 'fieldGoalBlockedByJersey') return 'Enter field goal blocker jersey.';
  if (state.currentStep === 'fieldGoalReturnAttempted') return 'Was the field goal returned?';
  if (state.currentStep === 'patType') return 'Choose PAT type.';
  if (state.currentStep === 'patKickResult') return 'Choose kick PAT result.';
  if (state.currentStep === 'patKickMissedReason') return 'Choose missed PAT reason.';
  if (state.currentStep === 'patKickBlockedByJersey') return 'Enter PAT blocker jersey.';
  if (state.currentStep === 'patKickReturnAttempted') return 'Was the PAT returned?';
  if (state.currentStep === 'patRusherJersey') return 'Enter two-point rusher jersey.';
  if (state.currentStep === 'patRushResult') return 'Choose rush PAT result.';
  if (state.currentStep === 'patRushReturnAttempted') return 'Was the PAT returned?';
  if (state.currentStep === 'patPasserJersey') return 'Enter two-point passer jersey.';
  if (state.currentStep === 'patReceiverJersey') return 'Enter two-point receiver jersey.';
  if (state.currentStep === 'patPassResult') return 'Choose pass PAT result.';
  if (state.currentStep === 'patPassReturnAttempted') return 'Was the PAT returned?';
  if (state.currentStep === 'penaltyName') return 'Enter penalty name.';
  if (state.currentStep === 'penaltyTeam') return 'Choose penalty team.';
  if (state.currentStep === 'penaltyResolution') return 'Choose penalty resolution.';
  if (state.currentStep === 'penaltyPlayerJersey') return 'Enter penalized player or skip.';
  if (state.currentStep === 'penaltyEnforcedFrom') return 'Choose enforcement spot.';
  if (state.currentStep === 'penaltySpotOfFoul') return 'Enter spot of foul.';
  if (state.currentStep === 'penaltyFinalSpot') return 'Enter penalty final spot.';
  if (state.currentStep === 'penaltyDown') return 'Choose down consequence.';
  if (state.currentStep === 'offsettingSecondName') return 'Enter matching offsetting penalty.';
  if (state.currentStep === 'offsettingSecondTeam') return 'Choose matching penalty team.';
  if (state.currentStep === 'offsettingPlayCounts') return 'Does the previous play count?';
  if (state.currentStep === 'gameControlMenu') return 'Choose game control function.';
  if (state.currentStep === 'gameControlQuarterMenu') return 'Choose quarter function.';
  if (state.currentStep === 'gameControlDown') return 'Enter down.';
  if (state.currentStep === 'gameControlDistance') return 'Enter distance.';
  if (state.currentStep === 'gameControlSpot') return 'Enter ball spot.';
  if (state.currentStep === 'gameControlPossession') return 'Choose possession team.';
  if (state.currentStep === 'endSpot') return 'Enter final ball spot.';
  if (state.currentStep === 'tackleAJersey') return state.tokens?.result === 'tackle'
    ? 'Enter tackler jersey number.'
    : 'Enter tackler jersey or skip.';
  if (state.currentStep === 'tackleBJersey') return 'Enter second tackler jersey or skip.';
  if (state.currentStep === 'tacklerJersey') return 'Enter tackler jersey or skip.';
  if (state.currentStep === 'forcedByJersey') return 'Enter forced fumble player jersey.';
  if (state.currentStep === 'recoverTeam') return 'Enter recovering team.';
  if (state.currentStep === 'recoverPlayerJersey') return 'Enter recovery player jersey.';
  if (state.currentStep === 'recoverSpot') return 'Enter recovery spot.';
  if (state.currentStep === 'fumbleReturned') return 'Was the fumble returned?';
  return 'Choose a play type.';
};

export default function FootballConfirmedQuickInput({
  debug = false,
  envelope,
  onSubmitAccepted,
  onStateChange,
  state,
  submitAdapter = submitFootballFcqiEvent,
}) {
  const fallbackState = useMemo(() => createInitialFootballQuickInputState(), []);
  const currentState = state || fallbackState;
  const [startMeta, setStartMeta] = useState({
    startedBy: 'programmatic',
    hotkey: undefined,
    seed: 'fcqi-rush-1',
    startedAt: envelope.updatedAt,
  });
  const [penaltyMessage, setPenaltyMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState({
    status: 'idle',
    message: '',
    error: '',
    result: null,
  });
  const startCounter = useRef(0);
  const submitInFlightRef = useRef(false);
  const context = useMemo(
    () => buildQuickInputContext(envelope, startMeta),
    [envelope, startMeta],
  );

  const publishState = (nextState) => {
    onStateChange?.(nextState);
  };

  const clearSubmitStatus = () => {
    setSubmitStatus({
      status: 'idle',
      message: '',
      error: '',
      result: null,
    });
  };

  const applyEvent = (event, activeContext = context, baseState = currentState) =>
    transitionFootballQuickInput(baseState, event, activeContext).state;

  const startRush = (startedBy) => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'R' : undefined,
      seed: `fcqi-rush-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_RUSH', startedBy, hotkey: startedBy === 'hotkey' ? 'R' : undefined },
      nextContext,
    ));
  };

  const startPass = (startedBy) => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'P' : undefined,
      seed: `fcqi-pass-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_PASS', startedBy, hotkey: startedBy === 'hotkey' ? 'P' : undefined },
      nextContext,
    ));
  };

  const startPunt = (startedBy) => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'U' : undefined,
      seed: `fcqi-punt-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_PUNT', startedBy, hotkey: startedBy === 'hotkey' ? 'U' : undefined },
      nextContext,
    ));
  };

  const startKick = (startedBy) => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'K' : undefined,
      seed: `fcqi-kick-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_KICK', startedBy, hotkey: startedBy === 'hotkey' ? 'K' : undefined },
      nextContext,
    ));
  };

  const startPenalty = (startedBy, source = 'immediate') => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'E' : undefined,
      seed: `fcqi-penalty-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_PENALTY', startedBy, hotkey: startedBy === 'hotkey' ? 'E' : undefined, source },
      nextContext,
    ));
  };

  const startGameControl = (startedBy) => {
    startCounter.current += 1;
    const nextStartMeta = {
      startedBy,
      hotkey: startedBy === 'hotkey' ? 'G' : undefined,
      seed: `fcqi-game-control-${startCounter.current}`,
      startedAt: new Date().toISOString(),
    };
    const nextContext = buildQuickInputContext(envelope, nextStartMeta);
    setStartMeta(nextStartMeta);
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent(
      { type: 'START_GAME_CONTROL', startedBy, hotkey: startedBy === 'hotkey' ? 'G' : undefined },
      nextContext,
    ));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.shiftKey && event.key.toLowerCase() === 'e' && isActiveFcqiPlayFlow(currentState)) {
        event.preventDefault();
        publishState(applyEvent({ type: 'QUEUE_PENALTY_REQUEST' }));
        return;
      }
      if (event.target?.closest?.(editableSelector)) return;
      const key = event.key.toLowerCase();
      if (key !== 'r' && key !== 'p' && key !== 'u' && key !== 'k' && key !== 'e' && key !== 'g') return;
      event.preventDefault();
      if (key === 'k') {
        startKick('hotkey');
      } else if (key === 'g') {
        startGameControl('hotkey');
      } else if (key === 'u') {
        startPunt('hotkey');
      } else if (key === 'p') {
        startPass('hotkey');
      } else if (key === 'e') {
        startPenalty('hotkey', 'immediate');
      } else {
        startRush('hotkey');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (currentState.status !== 'draft.ready') return;
    publishState(applyEvent({ type: 'GENERATE_SUMMARY' }));
  }, [currentState.status, currentState.draft]);

  const commitToken = (value) => {
    setPenaltyMessage('');
    clearSubmitStatus();
    let nextState = applyEvent({ type: 'INPUT_TOKEN', value });
    nextState = transitionFootballQuickInput(nextState, { type: 'COMMIT_TOKEN' }, context).state;
    publishState(nextState);
  };

  const selectDuplicatePlayer = (playerId) => {
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent({ type: 'SELECT_DUPLICATE_PLAYER', playerId }));
  };

  const confirmSummary = async () => {
    if (submitInFlightRef.current) return;

    setPenaltyMessage('');
    const confirmedState = applyEvent({ type: 'CONFIRM_SUMMARY', confirmedAt: new Date().toISOString() });
    const nextBuildResult = confirmedState.buildResult;

    if (!nextBuildResult?.ok) {
      setSubmitStatus({
        status: 'error',
        message: '',
        error: formatBuildErrors(nextBuildResult?.errors),
        result: null,
      });
      return;
    }

    submitInFlightRef.current = true;
    setSubmitStatus({
      status: 'submitting',
      message: 'Submitting play...',
      error: '',
      result: null,
    });

    try {
      const result = await submitAdapter(nextBuildResult.submitRequest);
      if (!result.ok) {
        setSubmitStatus({
          status: 'error',
          message: '',
          error: formatSubmitErrors(result.errors),
          result,
        });
        return;
      }

      onSubmitAccepted?.(result);
      publishState(createInitialFootballQuickInputState());
      setPenaltyMessage('');
      setSubmitStatus({
        status: 'success',
        message: result.status === 'duplicateAccepted'
          ? 'Submit accepted as duplicate.'
          : 'Submitted play.',
        error: '',
        result,
      });
    } catch (error) {
      setSubmitStatus({
        status: 'error',
        message: '',
        error: error instanceof Error ? error.message : 'Football submit failed.',
        result: null,
      });
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const editPlay = () => {
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent({ type: 'EDIT_PLAY' }));
  };

  const enterPenalty = () => {
    clearSubmitStatus();
    startPenalty('button', currentState.draft ? 'queued' : 'immediate');
  };

  const cancelFlow = () => {
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent({ type: 'CANCEL' }));
  };

  const buildResult = currentState.buildResult;
  const progressSteps = buildFootballFlowProgressSteps(currentState);
  const jumpToStep = (stepId) => {
    setPenaltyMessage('');
    clearSubmitStatus();
    publishState(applyEvent({ type: 'JUMP_TO_STEP', stepId }));
  };

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Play Entry</h2>
          <p className="mt-1 text-sm text-zinc-600">Football Confirmed Quick Input</p>
        </div>
        {submitStatus.status === 'submitting' && (
          <span className="rounded border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
            Submitting play...
          </span>
        )}
        {submitStatus.status === 'success' && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
            {submitStatus.message}
          </span>
        )}
        {submitStatus.status === 'error' && (
          <span className="rounded border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800">
            Submit failed
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLAY_BUTTONS.map((button) => (
            <button
              key={button.label}
              className={`flex min-h-12 items-center justify-between gap-3 rounded border px-3 py-3 text-sm font-semibold ${
                button.enabled
                  ? 'border-emerald-700 bg-white text-zinc-950 hover:bg-emerald-50'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-500'
              }`}
              disabled={!button.enabled}
              onClick={() => {
                if (!button.enabled) return;
                if (button.label === 'Pass') {
                  startPass('button');
                } else if (button.label === 'Punt') {
                  startPunt('button');
                } else if (button.label === 'Kick') {
                  startKick('button');
                } else if (button.label === 'Penalty') {
                  startPenalty('button', 'immediate');
                } else if (button.label === 'Game Control') {
                  startGameControl('button');
                } else {
                  startRush('button');
                }
              }}
              type="button"
            >
              <span>{button.label}</span>
              <span className="grid h-7 min-w-7 place-items-center rounded border border-zinc-300 bg-white px-2 text-xs font-black text-zinc-700">
                {button.hotkey}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <span className="font-semibold text-zinc-950">Assistant:</span>{' '}
          {getFootballFcqiAssistantMessage(currentState)}
        </div>

        {currentState.queuedPenaltyRequested && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <span>Penalty queued — resolve before submitting</span>
            {currentState.draft && (
              <button
                className="rounded border border-amber-400 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                onClick={() => startPenalty('button', 'queued')}
                type="button"
              >
                Resolve Penalty
              </button>
            )}
          </div>
        )}

        {currentState.error && currentState.error.code === 'UNRESOLVED_QUEUED_PENALTY' && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {currentState.error.message}
          </div>
        )}

        {submitStatus.status === 'success' && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {submitStatus.message}
          </div>
        )}

        {submitStatus.status === 'error' && submitStatus.error && currentState.status !== 'summary.reviewing' && (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {submitStatus.error}
          </div>
        )}

        {buildResult?.ok && debug && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Pending built event</h3>
            <p className="mt-2 text-sm text-emerald-900">
              {buildResult.event.description}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-800">
              Client event: {buildResult.event.clientEventId}
            </p>
            <details className="mt-3 rounded border border-emerald-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Built request JSON
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto text-xs text-zinc-800">
                {JSON.stringify(buildResult.submitRequest, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      <FootballFlowModal
        onCancel={cancelFlow}
        onStepClick={jumpToStep}
        onTokenCommit={commitToken}
        prePlaySpot={envelope.liveState.yardLine}
        progressSteps={progressSteps}
        state={currentState}
      />
      <FootballDuplicatePlayerModal
        duplicate={currentState.status === 'jersey.disambiguating' ? currentState.duplicate : null}
        onCancel={() => publishState(applyEvent({ type: 'CANCEL_DUPLICATE' }))}
        onSelect={selectDuplicatePlayer}
      />
      <FootballPlaySummaryModal
        isSubmitting={submitStatus.status === 'submitting'}
        onCancel={cancelFlow}
        onEdit={editPlay}
        onEnterPenalty={enterPenalty}
        onStepClick={jumpToStep}
        onConfirm={confirmSummary}
        penaltyMessage={penaltyMessage}
        progressSteps={progressSteps}
        submitError={submitStatus.status === 'error' ? submitStatus.error : ''}
        unresolvedQueuedPenalty={Boolean(currentState.queuedPenaltyRequested)}
        summary={currentState.status === 'summary.reviewing' ? currentState.summary : null}
      />
    </section>
  );
}

function formatBuildErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'Unable to build football submit request.';
  }

  return errors.map((error) => error.message || error.code).join(' ');
}

function formatSubmitErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'Football submit was rejected.';
  }

  return errors.map((error) => error.message || error.code).join(' ');
}

function buildQuickInputContext(envelope, startMeta) {
  const possession = envelope.liveState.possession || 'H';
  const baseEventSequence = envelope.events.at(-1)?.sequence ?? 0;

  return {
    game: {
      gameId: envelope.gameId,
      homeTeamId: envelope.game.teams.H.teamId,
      visitorTeamId: envelope.game.teams.V.teamId,
      teams: {
        H: teamSummary('H', envelope.game.teams.H),
        V: teamSummary('V', envelope.game.teams.V),
      },
      rules: envelope.game.rules,
    },
    source: {
      kind: 'fcqi',
      startedBy: startMeta.startedBy,
      hotkey: startMeta.hotkey,
      startedAt: startMeta.startedAt,
      baseEnvelopeVersion: envelope.updatedAt,
      baseEventSequence,
    },
    play: {
      actionTeam: possession,
      possession,
      period: envelope.clock.period || envelope.game.period || 1,
      clock: envelope.clock.clock || null,
    },
    prePlay: {
      possession: envelope.liveState.possession,
      down: envelope.liveState.down,
      distance: envelope.liveState.distance,
      yardLine: envelope.liveState.yardLine,
      lineToGain: envelope.liveState.lineToGain,
      goalToGo: envelope.liveState.goalToGo,
      redZone: envelope.liveState.redZone,
      driveId: envelope.liveState.driveId,
      driveNumber: envelope.liveState.driveNumber || 0,
    },
    roster: flattenRoster(envelope),
    intentId: `${startMeta.seed}-intent`,
    clientEventId: `${startMeta.seed}-client`,
    now: startMeta.startedAt,
    deriveRushYardsFromEndSpot: true,
    calculateRushYards: ({ startYardLine, endYardLine, possession: possessionTeam }) =>
      calculateYardsGained(startYardLine, endYardLine, possessionTeam),
  };
}

function teamSummary(teamCode, team) {
  return {
    team: teamCode,
    teamId: team.teamId,
    name: team.name,
    abbr: team.abbr,
  };
}

function flattenRoster(envelope) {
  return Object.values(envelope.rosters?.teams || {}).flatMap((team) =>
    Object.values(team.players || {}),
  );
}

function isActiveFcqiPlayFlow(state) {
  return Boolean(
    state?.flow
    && state.status !== 'idle'
    && state.status !== 'cancelled'
    && state.status !== 'submitted'
    && state.status !== 'submitting.confirmed',
  );
}
