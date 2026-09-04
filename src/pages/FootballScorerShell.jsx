import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FootballDebugTracePanel from '../components/FootballDebugTracePanel';
import FootballBallContextRevisionModal from '../components/editor/FootballBallContextRevisionModal';
import FootballPlayEditorModal from '../components/editor/FootballPlayEditorModal';
import FootballConfirmedQuickInput, {
  getFootballFcqiAssistantMessage,
} from '../components/fcqi/FootballConfirmedQuickInput';
import FootballScoreboard from '../components/scorer/FootballScoreboard';
import FootballDriveSummaryModal from '../components/scorer/FootballDriveSummaryModal';
import FootballGameWrapUpModal from '../components/scorer/FootballGameWrapUpModal';
import FootballPossessionClockModal from '../components/scorer/FootballPossessionClockModal';
import FootballPenaltyCodeEditorModal from '../components/scorer/FootballPenaltyCodeEditorModal';
import FootballTeamStats from '../components/scorer/FootballTeamStats';
import FootballPregameWorkspace from '../components/pregame/FootballPregameWorkspace';
import FootballRosterEditorModal from '../components/pregame/FootballRosterEditorModal';
import FootballStartersModal from '../components/pregame/FootballStartersModal';
import FootballSecondHalfChoiceModal from '../components/pregame/FootballSecondHalfChoiceModal';
import ScorerLayoutShell from '../components/scorer/ScorerLayoutShell';
import {
  defaultFixtureKey,
  fixtureOptions,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';
import { createInitialFootballQuickInputState } from '../quick-input/footballConfirmedQuickInputMachine';
import { applyFootballPlayEditToEnvelope } from '../play-editor/footballPlayEditEnvelope';
import {
  deleteFootballBallContextRevision,
  isFootballBallContextRevision,
  updateFootballBallContextRevision,
} from '../play-editor/footballBallContextRevision';
import {
  buildFootballPlayReplacementEnvelope,
  replaceFootballPlayInEnvelope,
} from '../play-editor/footballPlayReplacement';
import { gamePhaseForEnvelope, pregameForEnvelope } from '../pregame/footballPregame';
import {
  buildFootballDriveSummary,
  isFootballDriveSummaryTerminalEvent,
} from '../scoring/footballDriveSummary';
import { applyFootballGameWrapUp } from '../scoring/footballGameWrapUp';
import {
  buildFootballReportHref,
  FOOTBALL_REPORT_OPTIONS,
} from '../reports/footballReportCatalog';
import {
  enqueueFootballEnvelopeMirror,
  fetchFootballEnvelope,
  flushFootballServerSync,
  getDashboardSeededFootballEnvelopeRecord,
  getPendingFootballSyncCount,
  migratePendingFootballSyncToEnvelopeMirror,
  normalizeFootballScoringSetupEnvelope,
  persistFootballPregameEnvelope,
  persistFootballWrapUpEnvelope,
  recoverFootballEnvelopeFromServer,
  saveDashboardSeededFootballEnvelope,
  submitFootballEventLocally,
  recordFootballPossessionClock,
} from '../services/footballDashboardService';
import { buildFootballFixtureDebugTrace } from '../utils/footballDebugTrace';
import { formatFootballClockDisplay } from '../utils/footballClock';

const formatStatus = (status) =>
  String(status || 'unknown')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getTeam = (envelope, code) => envelope.game.teams[code];

const getPossessionTeam = (envelope) => {
  const possession = envelope.liveState.possession;
  return possession ? getTeam(envelope, possession) : null;
};

const formatDownDistance = (liveState) => {
  if (!liveState.down || !liveState.distance) {
    return 'Not set';
  }

  if (liveState.goalToGo) {
    return `${liveState.down} and goal`;
  }

  return `${liveState.down} and ${liveState.distance}`;
};

const formatSpot = (liveState) => liveState.yardLine || 'Not set';

const isKickoffReturnTouchdown = (event) => Boolean(
  event?.type === 'kickoff'
  && (event?.result?.scoring?.type === 'touchdown' || event?.result?.code === 'touchdown')
  && (event?.subtype === 'returned' || event?.result?.return),
);

const rosterPlayersForEnvelope = (envelope) => ['V', 'H'].flatMap((team) => (
  Object.values(envelope?.rosters?.teams?.[team]?.players || {})
));

const isDebugEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

export const shouldUseLocalFootballEnvelope = (envelope) => {
  if (!envelope) return false;
  const pregame = pregameForEnvelope(envelope);
  return pregame.gamePhase !== 'pregame' || pregame.coinToss.status === 'complete';
};

const isThirdQuarterStartFromHalftime = (envelope, submitRequest) => (
  gamePhaseForEnvelope(envelope) === 'halftime'
  && submitRequest?.event?.result?.gameControl?.action === 'startQuarter'
  && Number(submitRequest.event.result.gameControl.period) === 3
);

const withSecondHalfInitialization = (submitRequest, initialization, envelope) => {
  const kickingTeam = envelope.game.teams[initialization.kickingTeam];
  const receivingTeam = envelope.game.teams[initialization.receivingTeam];
  const directionTeam = envelope.game.teams[initialization.directionChoiceTeam];
  return {
    ...submitRequest,
    event: {
      ...submitRequest.event,
      description: `Start quarter 3. ${kickingTeam.name} will kick to ${receivingTeam.name}; ${directionTeam.name} chose ${initialization.direction}.`,
      result: {
        ...submitRequest.event.result,
        gameControl: {
          ...submitRequest.event.result.gameControl,
          secondHalf: initialization,
        },
      },
    },
  };
};

const getRequestedGameId = (searchParams) =>
  searchParams.get('envelopeGameId')
  || searchParams.get('gameId')
  || searchParams.get('game_id')
  || searchParams.get('id')
  || '';

const getDashboardGameId = (searchParams) => searchParams.get('dashboardGameId') || '';

const setScorerSearchParams = (setSearchParams, { fixture, debug }) => {
  const next = {};
  if (fixture && fixture !== defaultFixtureKey) {
    next.fixture = fixture;
  }
  if (debug) {
    next.debug = '1';
  }
  setSearchParams(next);
};

export default function FootballScorerShell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedGameId = getRequestedGameId(searchParams);
  const dashboardGameId = getDashboardGameId(searchParams);
  const requestedFixture = searchParams.get('fixture') || defaultFixtureKey;
  const debugMode = isDebugEnabled(searchParams.get('debug'));
  const fixtureEnvelope = getGameEnvelopeFixture(requestedFixture);
  const [loadedGameState, setLoadedGameState] = useState(() => ({
    status: requestedGameId ? 'loading' : 'idle',
    envelope: null,
    source: '',
    error: '',
  }));
  const [fcqiState, setFcqiState] = useState(() => createInitialFootballQuickInputState());
  const [fcqiResetKey, setFcqiResetKey] = useState(0);
  const [acceptedScorerState, setAcceptedScorerState] = useState(() => createEmptyAcceptedScorerState());
  const [localUndoStack, setLocalUndoStack] = useState([]);
  const [rosterEditorOpen, setRosterEditorOpen] = useState(false);
  const [startersEditorOpen, setStartersEditorOpen] = useState(false);
  const [starterTeam, setStarterTeam] = useState(null);
  const [pregameEditorError, setPregameEditorError] = useState('');
  const [possessionClockChange, setPossessionClockChange] = useState(null);
  const [driveSummary, setDriveSummary] = useState(null);
  const [penaltyCodeEditorOpen, setPenaltyCodeEditorOpen] = useState(false);
  const [pendingSecondHalfStart, setPendingSecondHalfStart] = useState(null);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [wrapUpSaveState, setWrapUpSaveState] = useState({ saving: false, error: '' });
  const [editingPlay, setEditingPlay] = useState(null);
  const [replacementPlay, setReplacementPlay] = useState(null);
  const [playEditFeedback, setPlayEditFeedback] = useState(null);
  const [syncState, setSyncState] = useState(() => ({ pending: 0, error: '' }));
  const [recoveryState, setRecoveryState] = useState(() => ({ recovering: false, error: '' }));
  const baseEnvelope = requestedGameId ? loadedGameState.envelope : fixtureEnvelope;
  const envelope = useMemo(
    () => buildActiveScorerEnvelope(baseEnvelope, acceptedScorerState),
    [acceptedScorerState, baseEnvelope],
  );
  const inputEnvelope = useMemo(() => (
    envelope && replacementPlay
      ? buildFootballPlayReplacementEnvelope(envelope, replacementPlay)
      : envelope
  ), [envelope, replacementPlay]);
  const traceEntries = useMemo(
    () => (debugMode && envelope ? buildFootballFixtureDebugTrace(envelope) : []),
    [debugMode, envelope],
  );
  const editorRoster = useMemo(() => rosterPlayersForEnvelope(envelope), [envelope]);
  const editorPregame = useMemo(() => pregameForEnvelope(envelope), [envelope]);

  useEffect(() => {
    setAcceptedScorerState(createEmptyAcceptedScorerState());
    setLocalUndoStack([]);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey((current) => current + 1);
    setRosterEditorOpen(false);
    setStartersEditorOpen(false);
    setStarterTeam(null);
    setPregameEditorError('');
    setPossessionClockChange(null);
    setDriveSummary(null);
    setPenaltyCodeEditorOpen(false);
    setPendingSecondHalfStart(null);
    setWrapUpOpen(false);
    setWrapUpSaveState({ saving: false, error: '' });
    setEditingPlay(null);
    setReplacementPlay(null);
    setPlayEditFeedback(null);
    setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
    setRecoveryState({ recovering: false, error: '' });
  }, [requestedFixture, requestedGameId]);

  useEffect(() => {
    if (envelope?.game?.status !== 'final' || envelope.game.wrapUp?.completedAt) return;
    setWrapUpOpen(true);
  }, [envelope?.game?.status, envelope?.game?.wrapUp?.completedAt, envelope?.gameId]);

  useEffect(() => {
    if (!requestedGameId) {
      setLoadedGameState({ status: 'idle', envelope: null, source: '', error: '' });
      return undefined;
    }

    const seededRecord = getDashboardSeededFootballEnvelopeRecord(requestedGameId);
    if (shouldUseLocalFootballEnvelope(seededRecord?.envelope)) {
      setLoadedGameState({
        status: 'ready',
        envelope: seededRecord.envelope,
        source: 'dashboard-seed',
        error: '',
      });
      return undefined;
    }

    const controller = new AbortController();
    setLoadedGameState({ status: 'loading', envelope: null, source: 'server', error: '' });
    fetchFootballEnvelope(requestedGameId, { dashboardGameId, signal: controller.signal })
      .then((loadedEnvelope) => {
        const localEnvelope = saveDashboardSeededFootballEnvelope(loadedEnvelope.gameId || requestedGameId, loadedEnvelope)
          || loadedEnvelope;
        setLoadedGameState({
          status: 'ready',
          envelope: localEnvelope,
          source: 'server-seed',
          error: '',
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setLoadedGameState({
          status: 'error',
          envelope: null,
          source: 'server',
          error: error?.message || 'Failed to load football game envelope.',
        });
      });

    return () => controller.abort();
  }, [dashboardGameId, requestedGameId]);

  const flushServerSync = useCallback(async () => {
    if (!requestedGameId || !dashboardGameId) return;
    const result = await flushFootballServerSync({ gameId: requestedGameId });
    setSyncState({
      pending: getPendingFootballSyncCount(requestedGameId),
      error: result.error || '',
    });
  }, [dashboardGameId, requestedGameId]);

  const handleFetchFromServer = useCallback(async () => {
    if (!requestedGameId || recoveryState.recovering) return;
    const confirmed = window.confirm(
      'Fetch the server envelope and replace this browser\'s local envelope? Any local changes or pending sync items for this game that are not on the server will be discarded.',
    );
    if (!confirmed) return;

    setRecoveryState({ recovering: true, error: '' });
    try {
      const recoveredEnvelope = await recoverFootballEnvelopeFromServer(requestedGameId, {
        dashboardGameId,
      });
      setAcceptedScorerState(createEmptyAcceptedScorerState());
      setLocalUndoStack([]);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey((current) => current + 1);
      setEditingPlay(null);
      setReplacementPlay(null);
      setPlayEditFeedback(null);
      setWrapUpOpen(false);
      setLoadedGameState({
        status: 'ready',
        envelope: recoveredEnvelope,
        source: 'server-recovery',
        error: '',
      });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      setRecoveryState({ recovering: false, error: '' });
    } catch (error) {
      setRecoveryState({
        recovering: false,
        error: error instanceof Error
          ? `Server recovery failed: ${error.message}`
          : 'Server recovery failed.',
      });
    }
  }, [dashboardGameId, recoveryState.recovering, requestedGameId]);

  useEffect(() => {
    if (!requestedGameId || !dashboardGameId || !baseEnvelope) return undefined;
    const authoritativeEnvelope = getDashboardSeededFootballEnvelopeRecord(requestedGameId)?.envelope
      || baseEnvelope;
    const migratedSync = migratePendingFootballSyncToEnvelopeMirror({
      gameId: requestedGameId,
      dashboardGameId,
      envelope: authoritativeEnvelope,
    });
    if (!migratedSync && getPendingFootballSyncCount(requestedGameId) === 0) {
      enqueueFootballEnvelopeMirror({
        gameId: requestedGameId,
        dashboardGameId,
        envelope: authoritativeEnvelope,
      });
    }
    setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
    void flushServerSync();
    const retry = window.setInterval(() => void flushServerSync(), 15_000);
    const onOnline = () => void flushServerSync();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(retry);
      window.removeEventListener('online', onOnline);
    };
  }, [baseEnvelope, dashboardGameId, flushServerSync, requestedGameId]);

  const handleSubmitAccepted = useCallback((result) => {
    setAcceptedScorerState((current) => reduceAcceptedScorerState(current, result));
    const acceptedEnvelope = result?.gameEnvelope ?? result?.envelope ?? (
      result?.projection ? applyProjectionToEnvelope(envelope, result.projection) : null
    );
    const previousPossession = envelope?.liveState?.possession ?? null;
    const nextPossession = acceptedEnvelope?.liveState && Object.prototype.hasOwnProperty.call(acceptedEnvelope.liveState, 'possession')
      ? acceptedEnvelope.liveState.possession
      : previousPossession;
    const responseEvent = result?.acceptedEvent || null;
    const acceptedEvent = acceptedEnvelope?.events?.find((event) => (
      (responseEvent?.eventId && event.eventId === responseEvent.eventId)
      || (responseEvent?.clientEventId && event.clientEventId === responseEvent.clientEventId)
    )) || acceptedEnvelope?.events?.[acceptedEnvelope.events.length - 1] || responseEvent;
    const isPossessionCorrection = acceptedEvent?.type === 'gameControl'
      && acceptedEvent?.result?.gameControl?.action === 'setPossession';
    const isPeriodInitialization = acceptedEvent?.type === 'gameControl'
      && acceptedEvent?.result?.gameControl?.action === 'startQuarter';
    const driveSummaryEvent = result?.status !== 'duplicateAccepted'
      && isFootballDriveSummaryTerminalEvent(acceptedEvent)
      ? acceptedEvent
      : null;
    const kickoffReturnTouchdown = result?.status !== 'duplicateAccepted'
      && isKickoffReturnTouchdown(acceptedEvent);
    if (acceptedEnvelope?.game?.status === 'final' && !acceptedEnvelope.game.wrapUp?.completedAt) {
      setWrapUpSaveState({ saving: false, error: '' });
      setWrapUpOpen(true);
    }
    if (acceptedEnvelope && (kickoffReturnTouchdown || (
      !isPossessionCorrection
      && !isPeriodInitialization
      && previousPossession !== nextPossession
      && (previousPossession || nextPossession)
    ))) {
      setPossessionClockChange({
        previousPossession: kickoffReturnTouchdown ? null : previousPossession,
        nextPossession: kickoffReturnTouchdown ? null : nextPossession,
        period: acceptedEnvelope.clock?.period || acceptedEnvelope.game?.period || 1,
        defaultClock: acceptedEnvelope.clock?.clock || envelope.clock?.clock || '',
        envelope: acceptedEnvelope,
        endedDriveId: kickoffReturnTouchdown
          ? null
          : result?.projection?.driveTransition?.endedDriveId || acceptedEvent?.preState?.driveId || null,
        driveSummaryEvent,
        clockOnly: kickoffReturnTouchdown,
      });
    } else if (acceptedEnvelope && driveSummaryEvent) {
      setDriveSummary(buildFootballDriveSummary(acceptedEnvelope, driveSummaryEvent));
    }
  }, [envelope]);

  const forceLocalTestGame = searchParams.get('local') === '1';
  const useLocalTestGame = import.meta.env.MODE !== 'test' || forceLocalTestGame || Boolean(requestedGameId);
  const submitLocalRequest = useCallback(async (submitRequest) => {
    const previousEnvelope = envelope;
    const result = await submitFootballEventLocally(envelope, submitRequest);
    if (result?.ok && result?.status !== 'duplicateAccepted') {
      setLocalUndoStack((current) => [...current, previousEnvelope]);
      if (requestedGameId && dashboardGameId) {
        enqueueFootballEnvelopeMirror({
          gameId: requestedGameId,
          dashboardGameId,
          envelope: result.gameEnvelope,
        });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    }
    return result;
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

  const localSubmitAdapter = useCallback(async (submitRequest) => {
    if (!isThirdQuarterStartFromHalftime(envelope, submitRequest)) {
      return submitLocalRequest(submitRequest);
    }
    const coinToss = pregameForEnvelope(envelope).coinToss;
    if (coinToss.status !== 'complete' || !coinToss.secondHalfChoiceTeam) {
      throw new Error('Complete the coin toss before initializing the second half.');
    }
    return new Promise((resolve, reject) => {
      setPendingSecondHalfStart({ coinToss, reject, resolve, submitRequest });
    });
  }, [envelope, submitLocalRequest]);

  const confirmSecondHalfStart = useCallback(async (initialization) => {
    if (!pendingSecondHalfStart) return;
    const { resolve, reject, submitRequest } = pendingSecondHalfStart;
    try {
      const result = await submitLocalRequest(withSecondHalfInitialization(submitRequest, initialization, envelope));
      setPendingSecondHalfStart(null);
      resolve(result);
    } catch (error) {
      setPendingSecondHalfStart(null);
      reject(error);
      throw error;
    }
  }, [envelope, pendingSecondHalfStart, submitLocalRequest]);

  const cancelSecondHalfStart = useCallback(() => {
    if (!pendingSecondHalfStart) return;
    const { reject } = pendingSecondHalfStart;
    setPendingSecondHalfStart(null);
    reject(new Error('Second-half initialization was canceled.'));
  }, [pendingSecondHalfStart]);

  const undoLastLocalEvent = useCallback(() => {
    const previousEnvelope = localUndoStack[localUndoStack.length - 1];
    if (!previousEnvelope) return;
    const restoredEnvelope = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, previousEnvelope) || previousEnvelope
      : previousEnvelope;
    setLocalUndoStack((current) => current.slice(0, -1));
    setAcceptedScorerState({ gameEnvelope: restoredEnvelope, projection: null, acceptedEvents: [] });
    setPossessionClockChange(null);
    setDriveSummary(null);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey((current) => current + 1);
    if (requestedGameId && dashboardGameId) {
      enqueueFootballEnvelopeMirror({
        gameId: requestedGameId,
        dashboardGameId,
        envelope: restoredEnvelope,
      });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
    }
  }, [dashboardGameId, flushServerSync, localUndoStack, requestedGameId]);

  const openPlayEditor = useCallback((event) => {
    setPlayEditFeedback(null);
    setEditingPlay(event);
  }, []);

  const closePlayEditor = useCallback(() => setEditingPlay(null), []);

  const saveBallContextRevision = useCallback((revision) => {
    try {
      const amendedEnvelope = updateFootballBallContextRevision(envelope, editingPlay, revision);
      const persistedEnvelope = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, amendedEnvelope) || amendedEnvelope
        : amendedEnvelope;
      const sequence = editingPlay?.sequence;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPlayEditFeedback({
        tone: 'success',
        message: `Ball context revision #${sequence} was updated. Later recorded contexts were preserved.`,
      });
      if (requestedGameId && dashboardGameId) {
        enqueueFootballEnvelopeMirror({
          gameId: requestedGameId,
          dashboardGameId,
          envelope: persistedEnvelope,
        });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    } catch (error) {
      setPlayEditFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The ball context revision could not be saved.',
      });
    }
  }, [dashboardGameId, editingPlay, envelope, flushServerSync, requestedGameId]);

  const removeBallContextRevision = useCallback(() => {
    try {
      const amendedEnvelope = deleteFootballBallContextRevision(envelope, editingPlay);
      const persistedEnvelope = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, amendedEnvelope) || amendedEnvelope
        : amendedEnvelope;
      const sequence = editingPlay?.sequence;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPlayEditFeedback({
        tone: 'success',
        message: `Ball context revision #${sequence} was deleted. Later records were renumbered and their recorded contexts were preserved.`,
      });
      if (requestedGameId && dashboardGameId) {
        enqueueFootballEnvelopeMirror({
          gameId: requestedGameId,
          dashboardGameId,
          envelope: persistedEnvelope,
        });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    } catch (error) {
      setPlayEditFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The ball context revision could not be deleted.',
      });
    }
  }, [dashboardGameId, editingPlay, envelope, flushServerSync, requestedGameId]);

  const savePlayEditor = useCallback((editedPlay) => {
    try {
      const amendedEnvelope = applyFootballPlayEditToEnvelope(envelope, editedPlay);
      const normalizedEnvelope = normalizeFootballScoringSetupEnvelope(amendedEnvelope);
      const persistedEnvelope = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, normalizedEnvelope) || normalizedEnvelope
        : normalizedEnvelope;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPlayEditFeedback({
        tone: 'success',
        message: `Play #${editedPlay.sequence} was updated in the local envelope.`,
      });
      if (requestedGameId && dashboardGameId) {
        enqueueFootballEnvelopeMirror({
          gameId: requestedGameId,
          dashboardGameId,
          envelope: persistedEnvelope,
        });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    } catch (error) {
      setPlayEditFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The play edit could not be saved.',
      });
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

  const requestPlayReplacement = useCallback((play) => {
    try {
      buildFootballPlayReplacementEnvelope(envelope, play);
      setEditingPlay(null);
      setReplacementPlay(play);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey((current) => current + 1);
      setPlayEditFeedback({
        tone: 'warning',
        message: `Replacing play #${play.sequence}. Choose the correct play family in Replacement Entry.`,
      });
    } catch (error) {
      setPlayEditFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Replacement could not be started.',
      });
    }
  }, [envelope]);

  const cancelPlayReplacement = useCallback(() => {
    setReplacementPlay(null);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey((current) => current + 1);
    setPlayEditFeedback({ tone: 'warning', message: 'Play replacement canceled. No play was changed.' });
  }, []);

  const replacementSubmitAdapter = useCallback(async (submitRequest) => {
    const result = replaceFootballPlayInEnvelope(envelope, replacementPlay, submitRequest?.event);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors,
        warnings: [],
        rawResponse: { success: false, errors: result.errors },
      };
    }
    return {
      ok: true,
      status: 'replaced',
      acceptedEvent: result.event,
      gameEnvelope: result.envelope,
      envelope: result.envelope,
      projection: null,
      warnings: result.warnings || [],
      rawResponse: { success: true, status: 'replaced', warnings: result.warnings || [] },
    };
  }, [envelope, replacementPlay]);

  const handleReplacementAccepted = useCallback((result) => {
    const replacementEnvelope = result?.gameEnvelope || result?.envelope;
    if (!replacementEnvelope || !result?.acceptedEvent) return;
    const persistedEnvelope = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, replacementEnvelope) || replacementEnvelope
      : replacementEnvelope;
    setLocalUndoStack((current) => [...current, envelope]);
    setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
    setReplacementPlay(null);
    setEditingPlay(null);
    const contextWarning = result.warnings?.find((warning) => warning.code === 'REPLACEMENT_CONTEXT_MISMATCH');
    setPlayEditFeedback({
      tone: contextWarning ? 'warning' : 'success',
      message: contextWarning
        ? `Play #${result.acceptedEvent.sequence} was replaced. ${contextWarning.message}`
        : `Play #${result.acceptedEvent.sequence} was replaced. The game remains final and downstream context was preserved.`,
    });
    if (requestedGameId && dashboardGameId) {
      enqueueFootballEnvelopeMirror({
        gameId: requestedGameId,
        dashboardGameId,
        envelope: persistedEnvelope,
      });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

  const recordPossessionClock = useCallback((clock) => {
    if (!possessionClockChange) return;
    let updatedEnvelope = recordFootballPossessionClock(possessionClockChange.envelope, {
      previousPossession: possessionClockChange.previousPossession,
      nextPossession: possessionClockChange.nextPossession,
      period: possessionClockChange.period,
      clock,
      endedDriveId: possessionClockChange.endedDriveId,
    });
    if (requestedGameId) {
      updatedEnvelope = saveDashboardSeededFootballEnvelope(requestedGameId, updatedEnvelope) || updatedEnvelope;
    }
    setAcceptedScorerState({ gameEnvelope: updatedEnvelope, projection: null, acceptedEvents: [] });
    if (requestedGameId && dashboardGameId) {
      enqueueFootballEnvelopeMirror({
        gameId: requestedGameId,
        dashboardGameId,
        envelope: updatedEnvelope,
      });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
    }
    if (possessionClockChange.driveSummaryEvent) {
      setDriveSummary(buildFootballDriveSummary(updatedEnvelope, possessionClockChange.driveSummaryEvent));
    }
    setPossessionClockChange(null);
  }, [dashboardGameId, flushServerSync, possessionClockChange, requestedGameId]);

  const closeDriveSummary = useCallback(() => setDriveSummary(null), []);
  const openPenaltyCodeEditor = useCallback(() => setPenaltyCodeEditorOpen(true), []);
  const closePenaltyCodeEditor = useCallback(() => setPenaltyCodeEditorOpen(false), []);
  const openGameWrapUp = useCallback(() => {
    setWrapUpSaveState({ saving: false, error: '' });
    setWrapUpOpen(true);
  }, []);
  const closeGameWrapUp = useCallback(() => {
    if (wrapUpSaveState.saving) return;
    setWrapUpOpen(false);
    setWrapUpSaveState((current) => ({ ...current, error: '' }));
  }, [wrapUpSaveState.saving]);

  const saveGameWrapUp = useCallback(async (input) => {
    if (!envelope) return;
    setWrapUpSaveState({ saving: true, error: '' });
    try {
      const completedEnvelope = applyFootballGameWrapUp(envelope, input);
      const persistedEnvelope = requestedGameId
        ? await persistFootballWrapUpEnvelope(requestedGameId, completedEnvelope, { dashboardGameId })
        : completedEnvelope;
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setWrapUpSaveState({ saving: false, error: '' });
      setWrapUpOpen(false);
      if (requestedGameId && dashboardGameId) {
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    } catch (error) {
      setWrapUpSaveState({
        saving: false,
        error: error instanceof Error ? error.message : 'Game wrap-up could not be saved.',
      });
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

  const handlePregameEnvelopeChange = useCallback(async (nextEnvelope) => {
    // Optimistically keep the current workspace responsive; the canonical
    // persisted envelope replaces it as soon as the configured store returns.
    setAcceptedScorerState({ gameEnvelope: nextEnvelope, projection: null, acceptedEvents: [] });
    if (!requestedGameId) return;
    try {
      const persisted = await persistFootballPregameEnvelope(requestedGameId, nextEnvelope, { dashboardGameId });
      setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
    } catch (error) {
      // The workspace remains editable, but callers receive the failure so the
      // operator is never told that an unsaved pregame change is durable.
      throw error;
    }
  }, [dashboardGameId, flushServerSync, requestedGameId]);

  const openRosterEditor = useCallback(() => {
    setPregameEditorError('');
    setRosterEditorOpen(true);
  }, []);

  const closeRosterEditor = useCallback(() => {
    setRosterEditorOpen(false);
    setPregameEditorError('');
  }, []);

  const openStartersEditor = useCallback(() => {
    setPregameEditorError('');
    setStarterTeam(null);
    setStartersEditorOpen(true);
  }, []);

  const closeStartersEditor = useCallback(() => {
    setStartersEditorOpen(false);
    setStarterTeam(null);
    setPregameEditorError('');
  }, []);

  const saveRosterEditor = useCallback(async (rosters) => {
    if (!envelope) return;
    setPregameEditorError('');
    try {
      await handlePregameEnvelopeChange({
        ...envelope,
        pregame: pregameForEnvelope(envelope),
        rosters,
      });
      closeRosterEditor();
    } catch (error) {
      setPregameEditorError(error instanceof Error
        ? `Roster changes were not saved: ${error.message}`
        : 'Roster changes were not saved.');
    }
  }, [closeRosterEditor, envelope, handlePregameEnvelopeChange]);

  const saveStartersEditor = useCallback(async ({ positionUpdates, starters, team }) => {
    if (!envelope) return;
    const players = { ...envelope.rosters.teams[team].players };
    positionUpdates.forEach(({ playerId, position }) => {
      if (players[playerId]) players[playerId] = { ...players[playerId], position };
    });
    const pregame = pregameForEnvelope(envelope);
    const nextEnvelope = {
      ...envelope,
      pregame: {
        ...pregame,
        starters: {
          ...pregame.starters,
          offense: { ...pregame.starters.offense, [team]: starters.offense },
          defense: { ...pregame.starters.defense, [team]: starters.defense },
        },
      },
      rosters: {
        ...envelope.rosters,
        teams: {
          ...envelope.rosters.teams,
          [team]: { ...envelope.rosters.teams[team], players },
        },
        updatedAt: new Date().toISOString(),
      },
    };
    setPregameEditorError('');
    try {
      await handlePregameEnvelopeChange(nextEnvelope);
      closeStartersEditor();
    } catch (error) {
      setPregameEditorError(error instanceof Error
        ? `Starter changes were not saved: ${error.message}`
        : 'Starter changes were not saved.');
    }
  }, [closeStartersEditor, envelope, handlePregameEnvelopeChange]);

  if (requestedGameId && loadedGameState.status === 'loading') {
    return (
      <ShellRouteState
        title="Loading scorer"
        message={`Loading football envelope for ${requestedGameId}.`}
      />
    );
  }

  if (requestedGameId && loadedGameState.status === 'error') {
    return (
      <ShellRouteState
        title="Game envelope not available"
        message={loadedGameState.error || `Could not load football envelope for ${requestedGameId}.`}
      />
    );
  }

  if (!envelope) {
    return (
      <ShellRouteState
        title="Fixture not found"
        message={`No fixture envelope exists for "${requestedFixture}".`}
      />
    );
  }

  const onFixtureChange = (event) => {
    setScorerSearchParams(setSearchParams, {
      fixture: event.target.value,
      debug: debugMode,
    });
  };

  const onDebugToggle = () => {
    if (requestedGameId) {
      const next = { envelopeGameId: requestedGameId };
      if (dashboardGameId) next.dashboardGameId = dashboardGameId;
      if (!debugMode) {
        next.debug = '1';
      }
      setSearchParams(next);
      return;
    }

    setScorerSearchParams(setSearchParams, {
      fixture: requestedFixture,
      debug: !debugMode,
    });
  };

  return (
    <main className={`flex min-h-screen flex-col bg-zinc-100 text-zinc-950 ${debugMode ? 'pb-[42vh]' : ''}`}>
      <ScorerHeader
        debugMode={debugMode}
        dashboardGameId={dashboardGameId}
        envelope={envelope}
        fixtureKey={requestedFixture}
        gameId={requestedGameId}
        loadSource={loadedGameState.source}
        onDebugToggle={onDebugToggle}
        onFetchFromServer={handleFetchFromServer}
        onFixtureChange={onFixtureChange}
        onRosterOpen={openRosterEditor}
        onWrapUpOpen={openGameWrapUp}
        recoveryState={recoveryState}
        syncState={syncState}
      />

      <ScorerLayoutShell
        scoreboard={<FootballScoreboardSlot envelope={envelope} />}
        stats={<FootballStatsSlot envelope={envelope} />}
        input={(
          <FootballInputSlot
            debugMode={debugMode}
            envelope={inputEnvelope}
            fcqiResetKey={fcqiResetKey}
            fcqiState={fcqiState}
            onCancelReplacement={cancelPlayReplacement}
            onFcqiStateChange={setFcqiState}
            onOpenPenaltyEditor={openPenaltyCodeEditor}
            onOpenStarters={openStartersEditor}
            onSubmitAccepted={replacementPlay ? handleReplacementAccepted : handleSubmitAccepted}
            onPregameEnvelopeChange={handlePregameEnvelopeChange}
            replacementPlay={replacementPlay}
            submitAdapter={replacementPlay
              ? replacementSubmitAdapter
              : useLocalTestGame
                ? localSubmitAdapter
                : undefined}
          />
        )}
        eventLog={(
          <FootballEventLogSlot
            canUndo={localUndoStack.length > 0}
            editFeedback={playEditFeedback}
            editingDisabled={Boolean(replacementPlay)}
            envelope={envelope}
            onEditEvent={openPlayEditor}
            onUndoLastEvent={useLocalTestGame ? undoLastLocalEvent : undefined}
          />
        )}
        inputAssistant={<FootballInputAssistantSlot envelope={envelope} fcqiState={fcqiState} />}
      />

      <FootballRosterEditorModal
        envelope={envelope}
        onClose={closeRosterEditor}
        onSave={saveRosterEditor}
        open={rosterEditorOpen}
        saveError={pregameEditorError}
      />
      <FootballStartersModal
        onChooseTeam={(team) => {
          setPregameEditorError('');
          setStarterTeam(team);
        }}
        onClose={closeStartersEditor}
        onSave={saveStartersEditor}
        open={startersEditorOpen}
        pregame={editorPregame}
        roster={editorRoster}
        saveError={pregameEditorError}
        team={starterTeam}
      />
      <FootballPossessionClockModal
        change={possessionClockChange}
        envelope={possessionClockChange?.envelope || envelope}
        onSave={recordPossessionClock}
      />
      <FootballDriveSummaryModal
        onClose={closeDriveSummary}
        summary={driveSummary}
      />
      <FootballPenaltyCodeEditorModal
        onClose={closePenaltyCodeEditor}
        open={penaltyCodeEditorOpen}
      />
      <FootballSecondHalfChoiceModal
        coinToss={pendingSecondHalfStart?.coinToss}
        onCancel={cancelSecondHalfStart}
        onConfirm={confirmSecondHalfStart}
        open={Boolean(pendingSecondHalfStart)}
        teams={envelope.game.teams}
      />
      <FootballGameWrapUpModal
        envelope={envelope}
        onClose={closeGameWrapUp}
        onSave={saveGameWrapUp}
        open={wrapUpOpen}
        saveError={wrapUpSaveState.error}
        saving={wrapUpSaveState.saving}
      />
      <FootballPlayEditorModal
        isOpen={Boolean(editingPlay) && !isFootballBallContextRevision(editingPlay)}
        onClose={closePlayEditor}
        onReplace={requestPlayReplacement}
        onSave={savePlayEditor}
        play={editingPlay}
        roster={editorRoster}
        saveError={playEditFeedback?.tone === 'error' ? playEditFeedback.message : ''}
        teamNames={{
          H: envelope.game.teams.H.name || envelope.game.teams.H.abbr || 'Home',
          V: envelope.game.teams.V.name || envelope.game.teams.V.abbr || 'Visitor',
        }}
      />
      <FootballBallContextRevisionModal
        downs={envelope.game.rules?.downs || 4}
        event={editingPlay}
        isOpen={Boolean(editingPlay) && isFootballBallContextRevision(editingPlay)}
        onClose={closePlayEditor}
        onDelete={removeBallContextRevision}
        onSave={saveBallContextRevision}
        saveError={playEditFeedback?.tone === 'error' ? playEditFeedback.message : ''}
      />

      {debugMode && <FootballDebugTracePanel entries={traceEntries} />}
    </main>
  );
}

export function FootballShellLoadingState() {
  return (
    <ShellRouteState title="Loading scorer" message="Reading fixture envelope." />
  );
}

const ShellRouteState = ({ title, message }) => (
  <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
    <section className="w-full max-w-md rounded border border-zinc-300 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
      <Link
        className="mt-4 inline-flex rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        to="/dashboard"
      >
        Open dashboard
      </Link>
    </section>
  </main>
);

const ScorerHeader = ({
  dashboardGameId,
  debugMode,
  envelope,
  fixtureKey,
  gameId,
  loadSource,
  onDebugToggle,
  onFetchFromServer,
  onFixtureChange,
  onRosterOpen,
  onWrapUpOpen,
  recoveryState,
  syncState,
}) => {
  const teams = envelope.game.teams;
  const isGameRoute = Boolean(gameId);
  const reportLinks = FOOTBALL_REPORT_OPTIONS.map((report) => ({
    ...report,
    href: buildFootballReportHref({
      baseUrl: import.meta.env.BASE_URL,
      dashboardGameId,
      gameId: isGameRoute ? gameId : envelope.gameId,
      reportId: report.id,
    }),
  }));

  return (
    <header className="border-b border-zinc-300 bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-emerald-800 text-sm font-black text-white">
            SF
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Strata Football
            </p>
            <h1 className="truncate text-xl font-semibold">
              {teams.V.name} at {teams.H.name}
            </h1>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <button
            className="rounded border border-emerald-700 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={onRosterOpen}
            type="button"
          >
            Roster
          </button>
          {envelope.game.status === 'final' && (
            <button
              className="rounded border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              onClick={onWrapUpOpen}
              type="button"
            >
              {envelope.game.wrapUp?.completedAt ? 'Edit Game Wrap-Up' : 'Game Wrap-Up'}
            </button>
          )}
          <Link
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to={isGameRoute ? '/sports/football' : '/dashboard'}
          >
            Dashboard
          </Link>
          {isGameRoute ? (
            <>
              <button
                className="rounded border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                disabled={recoveryState?.recovering}
                onClick={onFetchFromServer}
                type="button"
              >
                {recoveryState?.recovering ? 'Fetching from server…' : 'Fetch from server'}
              </button>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Game {gameId} · Local envelope
              </span>
              <span className={`rounded border px-3 py-2 text-sm font-semibold ${
                syncState?.error
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : syncState?.pending
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-700'
              }`} title={syncState?.error || loadSource || 'loaded'}>
                {syncState?.error
                  ? 'Server sync blocked'
                  : syncState?.pending
                    ? `Server sync pending: ${syncState.pending}`
                    : 'No server sync pending'}
              </span>
              {syncState?.error && (
                <span className="max-w-md rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
                  {syncState.error}
                </span>
              )}
              {recoveryState?.error && (
                <span className="max-w-md rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
                  {recoveryState.error}
                </span>
              )}
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              Dev fixture
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                value={fixtureKey}
                onChange={onFixtureChange}
              >
                {fixtureOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
              Reports
            </summary>
            <div className="absolute right-0 z-50 mt-1 min-w-52 overflow-hidden rounded border border-zinc-200 bg-white py-1 shadow-lg">
              {reportLinks.map((report) => (
                <a
                  className="block px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                  href={report.href}
                  key={report.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {report.label}
                </a>
              ))}
            </div>
          </details>
          <button
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              debugMode
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-zinc-300 text-zinc-800 hover:bg-zinc-50'
            }`}
            onClick={onDebugToggle}
            type="button"
          >
            Debug Trace
          </button>
        </nav>
      </div>
    </header>
  );
};

export const FootballScoreboardSlot = ({ envelope }) => (
  <FootballScoreboard envelope={envelope} />
);

export const FootballStatsSlot = ({ envelope }) => (
  <div className="h-full min-h-0 p-2">
    <FootballTeamStats envelope={envelope} />
  </div>
);

export const FootballInputSlot = ({
  debugMode = false,
  envelope,
  fcqiResetKey,
  fcqiState,
  onCancelReplacement,
  onFcqiStateChange,
  onOpenPenaltyEditor,
  onOpenStarters,
  onPregameEnvelopeChange,
  onSubmitAccepted,
  replacementPlay,
  submitAdapter,
}) => {
  const showPregameWorkspace = envelope.game.status === 'pregame';
  const [teamAliases, setTeamAliases] = useState(() => envelope.operatorTeamAliases || null);

  useEffect(() => {
    setTeamAliases(envelope.operatorTeamAliases || null);
  }, [envelope.gameId, envelope.operatorTeamAliases?.H, envelope.operatorTeamAliases?.V]);

  return (
    <div className="space-y-4 p-4">
      {replacementPlay && (
        <section className="rounded border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black">Replacing play #{replacementPlay.sequence}</div>
              <p className="mt-1 text-sm">
                The original sequence, Q{replacementPlay.period} {formatFootballClockDisplay(replacementPlay.clock, '--:--')}, and starting context are locked.
                If its result disagrees with the next recorded play, the replacement will be saved and the inconsistency will be flagged for review.
              </p>
            </div>
            <button
              className="rounded border border-amber-600 bg-white px-3 py-2 text-sm font-black text-amber-950 hover:bg-amber-100"
              onClick={onCancelReplacement}
              type="button"
            >
              Cancel Replacement
            </button>
          </div>
        </section>
      )}
      {showPregameWorkspace && (
        <FootballPregameWorkspace
          envelope={envelope}
          onEnvelopeChange={onPregameEnvelopeChange}
          onTeamAliasesChange={setTeamAliases}
          teamAliases={teamAliases}
        />
      )}
      <FootballConfirmedQuickInput
        debug={debugMode}
        envelope={envelope}
        key={fcqiResetKey}
        onOpenPenaltyEditor={onOpenPenaltyEditor}
        onOpenStarters={onOpenStarters}
        onSubmitAccepted={onSubmitAccepted}
        onStateChange={onFcqiStateChange}
        replacementMode={Boolean(replacementPlay)}
        state={fcqiState}
        submitAdapter={submitAdapter}
        teamAliases={teamAliases}
      />
    </div>
  );
};

export const FootballEventLogSlot = ({ canUndo = false, editFeedback, editingDisabled = false, envelope, onEditEvent, onUndoLastEvent }) => (
  <div className="h-full p-4">
    <GameLogColumn
      canUndo={canUndo}
      editFeedback={editFeedback}
      editingDisabled={editingDisabled}
      envelope={envelope}
      onEditEvent={onEditEvent}
      onUndoLastEvent={onUndoLastEvent}
    />
  </div>
);

export const FootballInputAssistantSlot = ({ envelope, fcqiState }) => {
  const lastEvent = envelope.events[envelope.events.length - 1];
  const assistantMessage = getFootballFcqiAssistantMessage(fcqiState);
  const queuedPenaltyActive = Boolean(fcqiState?.queuedPenaltyRequested);
  const miscFumbleActive = Boolean(fcqiState?.miscFumbleRequested);

  return (
    <section
      aria-label="Input Assistant"
      className={`border-t px-4 py-3 ${
        queuedPenaltyActive
          ? 'border-yellow-400 bg-yellow-100 text-yellow-950'
          : 'border-zinc-300 bg-white text-zinc-950'
      }`}
      data-testid="football-input-assistant"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className={`text-xs font-semibold uppercase tracking-wide ${queuedPenaltyActive ? 'text-yellow-800' : 'text-zinc-500'}`}>
            Input Assistant
          </div>
          <div className={`mt-1 font-medium ${queuedPenaltyActive ? 'text-yellow-950' : 'text-zinc-900'}`}>
            {assistantMessage}
          </div>
        </div>
        <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${queuedPenaltyActive ? 'text-yellow-950' : 'text-zinc-600'}`}>
          {miscFumbleActive && (
            <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">
              Misc. Fumble
            </span>
          )}
          <span className={`rounded px-2 py-1 ${queuedPenaltyActive ? 'bg-yellow-200 text-yellow-950' : 'bg-emerald-50 text-emerald-800'}`}>
            {formatStatus(envelope.game.status)}
          </span>
          <span className={`rounded px-2 py-1 ${queuedPenaltyActive ? 'bg-yellow-200' : 'bg-zinc-100'}`}>
            {formatDownDistance(envelope.liveState)}
          </span>
          <span className={`rounded px-2 py-1 ${queuedPenaltyActive ? 'bg-yellow-200' : 'bg-zinc-100'}`}>
            Last event: {lastEvent?.sequence ? `#${lastEvent.sequence}` : 'None'}
          </span>
        </div>
      </div>
    </section>
  );
};

const PlayEntryWorkspace = ({ envelope }) => {
  const playButtons = ['Rush', 'Pass', 'Punt', 'Kick', 'Penalty', 'Game Control'];
  const liveState = envelope.liveState;

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold">Play Entry</h2>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_240px]">
        <div className="min-h-[240px] rounded border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {playButtons.map((label) => (
              <button
                key={label}
                className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-500"
                disabled
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded border border-dashed border-zinc-300 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Current Context
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatDownDistance(liveState)} at {formatSpot(liveState)}
            </div>
            <div className="mt-2 text-sm text-zinc-600">
              {getPossessionTeam(envelope)?.name || 'No possession'} · {formatStatus(envelope.game.status)}
            </div>
          </div>
        </div>

        <div className="rounded border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Accepted Envelope</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <EnvelopeRow label="Game" value={envelope.gameId} />
            <EnvelopeRow label="Version" value={envelope.updatedAt} />
            <EnvelopeRow label="Events" value={String(envelope.events.length)} />
            <EnvelopeRow label="Schema" value={envelope.schemaVersion} />
          </dl>
        </div>
      </div>
    </section>
  );
};

const EnvelopeRow = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </dt>
    <dd className="mt-0.5 break-words font-medium text-zinc-900">{value}</dd>
  </div>
);

const EDITABLE_EVENT_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
const isEditableGameLogEvent = (event) => (
  EDITABLE_EVENT_TYPES.has(event?.type) || isFootballBallContextRevision(event)
);

const GameLogColumn = ({ canUndo, editFeedback, editingDisabled, envelope, onEditEvent, onUndoLastEvent }) => {
  const logItems = buildGameLogItems(envelope);
  return (
    <section className="flex h-full min-h-0 flex-col rounded border border-zinc-300 bg-white">
    <div className="border-b border-zinc-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Game Log</h2>
        {onUndoLastEvent && (
          <button
            className="rounded border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={!canUndo}
            onClick={onUndoLastEvent}
            title="Restore the local test game to its state before the most recent submitted event"
            type="button"
          >
            Undo Last Test Event
          </button>
        )}
      </div>
      {editFeedback?.message && (
        <div
          className={`mt-2 rounded border px-3 py-2 text-xs font-semibold ${
            editFeedback.tone === 'error'
              ? 'border-red-300 bg-red-50 text-red-900'
              : editFeedback.tone === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-emerald-300 bg-emerald-50 text-emerald-900'
          }`}
          role="status"
        >
          {editFeedback.message}
        </div>
      )}
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {logItems.length === 0 ? (
        <div className="p-4 text-sm text-zinc-600">No accepted events.</div>
      ) : (
        <ol className="divide-y divide-zinc-200">
          {logItems.map((item, index) => (
            item.kind === 'driveStart' ? (
              <li
                aria-label={`Drive Start - ${item.team}`}
                className="border-y border-sky-200 bg-sky-50 px-4 py-3 text-sky-950"
                key={`drive-start-${item.driveId}`}
                role="separator"
              >
                <div className="text-sm font-black">Drive Start - {item.team}</div>
                <div className="mt-0.5 text-xs font-semibold">
                  {formatFootballClockDisplay(item.time, '--:--')} at {item.yardLine} by {item.howGained}
                </div>
              </li>
            ) : (
              <li key={item.event.eventId || item.event.clientEventId || `event-${index}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold capitalize">
                      {item.event.type}
                      {item.event.subtype ? ` · ${item.event.subtype}` : ''}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700">
                      {item.event.description || item.event.result?.code || 'Accepted event'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {onEditEvent && isEditableGameLogEvent(item.event) && (
                      <button
                        aria-label={isFootballBallContextRevision(item.event)
                          ? `Edit ball context revision ${item.event.sequence ?? ''}`
                          : `Edit play ${item.event.sequence ?? ''}`}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                        disabled={editingDisabled}
                        onClick={() => onEditEvent(item.event)}
                        title={editingDisabled
                          ? 'Finish or cancel the current replacement first'
                          : isFootballBallContextRevision(item.event)
                            ? 'Edit or delete this ball context revision'
                            : 'Edit this play'}
                        type="button"
                      >
                        Edit
                      </button>
                    )}
                    <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                      #{item.event.sequence ?? '-'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Q{item.event.period || '-'} {formatFootballClockDisplay(item.event.clock, '--:--')} · {item.event.possession || '-'}
                </div>
              </li>
            )
          ))}
        </ol>
      )}
    </div>
    </section>
  );
};

const buildGameLogItems = (envelope) => {
  const events = envelope.events || [];
  const drives = [...(envelope.drives?.completed || []), envelope.drives?.current].filter(Boolean);
  const driveById = new Map(drives.map((drive) => [drive.driveId, drive]));
  const hasExplicitDriveIds = events.some((event) => event.preState?.driveId || event.postState?.driveId);
  const driveIdForEvent = (event) => (
    event.preState?.driveId
    || (!hasExplicitDriveIds ? envelope.liveState?.driveId : null)
  );
  const firstEventByDrive = new Map();
  events.forEach((event) => {
    const driveId = driveIdForEvent(event);
    if (driveId && !firstEventByDrive.has(driveId)) firstEventByDrive.set(driveId, event);
  });

  const makeDriveStartItem = (driveId) => {
    const drive = driveById.get(driveId) || {};
    const firstEvent = firstEventByDrive.get(driveId);
    const teamCode = drive.team || firstEvent?.preState?.possession || firstEvent?.possession;
    const team = envelope.game?.teams?.[teamCode]?.name || envelope.game?.teams?.[teamCode]?.abbr || teamCode || 'Unknown Team';
    return {
      kind: 'driveStart',
      driveId,
      team,
      time: drive.startClock || firstEvent?.clock || '--:--',
      yardLine: drive.startYardLine || firstEvent?.preState?.yardLine || 'Unknown Spot',
      howGained: humanizeDriveReason(drive.startReason || 'possession'),
    };
  };

  const items = [];
  const currentDriveId = envelope.drives?.current?.driveId;
  if (currentDriveId && !firstEventByDrive.has(currentDriveId)) {
    items.push(makeDriveStartItem(currentDriveId));
  }
  const newestFirstEvents = events.slice().reverse();
  newestFirstEvents.forEach((event, index) => {
    const driveId = driveIdForEvent(event);
    items.push({ kind: 'event', event });
    const nextOlderEvent = newestFirstEvents[index + 1];
    const nextOlderDriveId = nextOlderEvent ? driveIdForEvent(nextOlderEvent) : null;
    if (driveId && driveId !== nextOlderDriveId) {
      items.push(makeDriveStartItem(driveId));
    }
  });
  return items;
};

const humanizeDriveReason = (reason) => String(reason || 'possession')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const RosterLookup = ({ envelope }) => {
  const teams = envelope.rosters.teams;

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-base font-semibold">Roster Lookup</h2>
      </div>
      <div className="space-y-4 p-4">
        <input
          aria-label="Roster search"
          className="w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
          disabled
          placeholder="Search roster"
          type="search"
        />
        {Object.entries(teams).map(([teamCode, team]) => (
          <section key={teamCode}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{team.abbr}</h3>
              <span className="text-xs font-medium text-zinc-500">{teamCode}</span>
            </div>
            <div className="space-y-2">
              {Object.values(team.players).map((player) => (
                <div
                  key={player.playerId}
                  className="grid grid-cols-[42px_1fr_auto] items-center gap-2 rounded border border-zinc-200 px-2 py-2 text-sm"
                >
                  <span className="font-semibold tabular-nums">#{player.jersey}</span>
                  <span className="min-w-0 truncate">{player.displayName}</span>
                  <span className="text-xs font-semibold text-zinc-500">{player.position}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

function createEmptyAcceptedScorerState() {
  return {
    gameEnvelope: null,
    projection: null,
    acceptedEvents: [],
  };
}

function reduceAcceptedScorerState(current, result) {
  if (result?.contractMode === 'canonicalRush' && result?.gameEnvelope) {
    return {
      gameEnvelope: result.gameEnvelope,
      projection: null,
      acceptedEvents: [],
    };
  }

  const gameEnvelope = result?.gameEnvelope ?? result?.envelope ?? null;
  const projection = result?.projection ?? null;

  if (gameEnvelope || projection) {
    return {
      gameEnvelope: gameEnvelope ?? current.gameEnvelope,
      projection: projection ?? current.projection,
      acceptedEvents: [],
    };
  }

  if (isDisplayableAcceptedEvent(result?.acceptedEvent)) {
    return {
      ...current,
      acceptedEvents: appendAcceptedEvent(current.acceptedEvents, result.acceptedEvent),
    };
  }

  return current;
}

function buildActiveScorerEnvelope(fixtureEnvelope, acceptedState) {
  if (!fixtureEnvelope) return null;

  const submittedEnvelope = acceptedState.gameEnvelope || fixtureEnvelope;
  const projectedEnvelope = normalizeFootballScoringSetupEnvelope(
    applyProjectionToEnvelope(submittedEnvelope, acceptedState.projection),
  );
  if (acceptedState.acceptedEvents.length === 0) return projectedEnvelope;

  const existingClientIds = new Set(projectedEnvelope.events.map((event) => event.clientEventId).filter(Boolean));
  const existingEventIds = new Set(projectedEnvelope.events.map((event) => event.eventId).filter(Boolean));
  const appendedEvents = acceptedState.acceptedEvents.filter((event) => {
    if (event.eventId && existingEventIds.has(event.eventId)) return false;
    if (event.clientEventId && existingClientIds.has(event.clientEventId)) return false;
    return true;
  });

  if (appendedEvents.length === 0) return projectedEnvelope;

  return {
    ...projectedEnvelope,
    events: [
      ...projectedEnvelope.events,
      ...appendedEvents,
    ],
  };
}

function applyProjectionToEnvelope(envelope, projection) {
  if (!projection) return envelope;

  const liveState = projection.liveState ?? projection.live_state;
  const clock = projection.clock;
  const stats = projection.stats;
  const drives = projection.drives;
  const events = projection.events;
  const gamePatch = projection.game;
  const teamPatch = gamePatch?.teams ?? projection.teams;

  return {
    ...envelope,
    game: {
      ...envelope.game,
      ...(gamePatch || {}),
      teams: teamPatch
        ? {
            ...envelope.game.teams,
            H: { ...envelope.game.teams.H, ...(teamPatch.H || {}) },
            V: { ...envelope.game.teams.V, ...(teamPatch.V || {}) },
          }
        : envelope.game.teams,
    },
    clock: clock ? { ...envelope.clock, ...clock } : envelope.clock,
    liveState: liveState ? { ...envelope.liveState, ...liveState } : envelope.liveState,
    stats: stats ? { ...envelope.stats, ...stats } : envelope.stats,
    drives: drives ? { ...envelope.drives, ...drives } : envelope.drives,
    events: Array.isArray(events) ? events : envelope.events,
  };
}

function isDisplayableAcceptedEvent(event) {
  return Boolean(
    event
      && (event.eventId || event.clientEventId)
      && (event.type || event.description || event.result?.code),
  );
}

function appendAcceptedEvent(events, event) {
  const eventId = event.eventId;
  const clientEventId = event.clientEventId;
  const alreadyExists = events.some((existing) => (
    (eventId && existing.eventId === eventId)
    || (clientEventId && existing.clientEventId === clientEventId)
  ));

  return alreadyExists ? events : [...events, event];
}
