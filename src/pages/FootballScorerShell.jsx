import { buildFootballEditedPlaySummary } from '../play-editor/footballPlayEditEnvelope';
import FootballUnnamedPlayersAlert from '../components/pregame/FootballUnnamedPlayersAlert';
import { addFootballRosterPlayers } from '../utils/footballUnnamedPlayers';
import { footballOvertimePending } from '../utils/footballOvertime';
import { footballPenaltyPendingForInput, withFootballPenaltyIndicator } from '../utils/footballLiveIndicators';
import FootballOvertimeModal from '../components/scorer/FootballOvertimeModal';
import { formatFootballSafetyReadout } from '../utils/footballSafety';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FootballDebugTracePanel from '../components/FootballDebugTracePanel';
import FootballBallContextRevisionModal from '../components/editor/FootballBallContextRevisionModal';
import FootballPlayEditorModal from '../components/editor/FootballPlayEditorModal';
import FootballPlayInsertionModal from '../components/editor/FootballPlayInsertionModal';
import { buildFootballPlayInsertionEnvelope, previewFootballPlayInsertion } from '../play-editor/footballPlayInsertion';
import FootballConfirmedQuickInput, {
  getFootballFcqiAssistantMessage,
} from '../components/fcqi/FootballConfirmedQuickInput';
import FootballScoreboard from '../components/scorer/FootballScoreboard';
import FootballDriveSummaryModal from '../components/scorer/FootballDriveSummaryModal';
import FootballGameWrapUpModal from '../components/scorer/FootballGameWrapUpModal';
import FootballPossessionClockModal from '../components/scorer/FootballPossessionClockModal';
import FootballPenaltyCodeEditorModal from '../components/scorer/FootballPenaltyCodeEditorModal';
import FootballTeamAliasesModal from '../components/scorer/FootballTeamAliasesModal';
import FootballParticipationModal from '../components/scorer/FootballParticipationModal';
import FootballPlayReviewModal from '../components/scorer/FootballPlayReviewModal';
import { isEditableFootballReviewEvent as isEditableGameLogEvent } from '../utils/footballPlayReview';
import FootballChallengeRescoreModal from '../components/scorer/FootballChallengeRescoreModal';
import { pendingFootballChallengeRescore, isOverturnedFootballChallenge, footballChallengeEventKey } from '../utils/footballChallengeRescore';
import { buildFootballChallengeRescoreEnvelope, rescoreOverturnedFootballPlay } from '../play-editor/footballChallengeRescore';
import { applyFootballParticipation } from '../utils/footballParticipation';
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
import { deleteFootballPlayFromEnvelope } from '../play-editor/footballPlayDeletion';
import { footballContextEventKey, recalculateFootballPlayContext, reviewFootballPlayContexts, saveFootballPlayEditToEnvelope } from '../play-editor/footballPlayContext';
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
import { formatFootballFumbleReadout } from '../utils/footballFumbleReadout';
import { resolveFootballUnknownPlayerText } from '../utils/footballUnknownPlayerReadout';
import { formatFootballSpotForDisplay } from '../utils/footballSpotNormalization';
import { footballTeamAliasesForEnvelope, normalizeFootballTeamAliases, validateFootballTeamAliases } from '../utils/footballTeamAliases';

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
  const [teamAliasesEditorOpen, setTeamAliasesEditorOpen] = useState(false);
  const [participationOpen, setParticipationOpen] = useState(false);
  const [playReviewOpen, setPlayReviewOpen] = useState(false);
  const [pendingSecondHalfStart, setPendingSecondHalfStart] = useState(null);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [wrapUpSaveState, setWrapUpSaveState] = useState({ saving: false, error: '' });
  const [editingPlay, setEditingPlay] = useState(null);
  const [replacementPlay, setReplacementPlay] = useState(null);
  const [replacementContext, setReplacementContext] = useState(null);
  const [insertionSession, setInsertionSession] = useState(null);
  const [challengeReview, setChallengeReview] = useState(null);
  const [dismissedChallenge, setDismissedChallenge] = useState(null);
  const [replacementChallenge, setReplacementChallenge] = useState(null);
  const [challengeWorkingEnvelope, setChallengeWorkingEnvelope] = useState(null);
  const [challengeBaseEnvelope, setChallengeBaseEnvelope] = useState(null);
  const [playEditFeedback, setPlayEditFeedback] = useState(null);
  const [syncState, setSyncState] = useState(() => ({ pending: 0, error: '' }));
  const [recoveryState, setRecoveryState] = useState(() => ({ recovering: false, error: '' }));
  const baseEnvelope = requestedGameId ? loadedGameState.envelope : fixtureEnvelope;
  const envelope = useMemo(
    () => buildActiveScorerEnvelope(baseEnvelope, acceptedScorerState),
    [acceptedScorerState, baseEnvelope],
  );
  const inputEnvelope = useMemo(() => (
    insertionSession?.inputEnvelope || (envelope && replacementPlay
      ? replacementChallenge
        ? buildFootballChallengeRescoreEnvelope(challengeWorkingEnvelope || envelope, replacementPlay)
        : buildFootballPlayReplacementEnvelope(replacementContext?.baseEnvelope || envelope, replacementPlay, replacementContext || {})
      : envelope)
  ), [envelope, replacementPlay, replacementContext, replacementChallenge, challengeWorkingEnvelope, insertionSession]);
  const pendingChallenge = pendingFootballChallengeRescore(envelope);
  useEffect(() => {
    if (pendingChallenge && !replacementPlay && !insertionSession && footballChallengeEventKey(pendingChallenge) !== dismissedChallenge) {
      setChallengeReview(pendingChallenge);
      setPossessionClockChange(null);
      setDriveSummary(null);
      setWrapUpOpen(false);
    }
  }, [pendingChallenge, dismissedChallenge, replacementPlay, insertionSession]);
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
    setTeamAliasesEditorOpen(false);
    setParticipationOpen(false);
    setPlayReviewOpen(false);
    setPendingSecondHalfStart(null);
    setWrapUpOpen(false);
    setWrapUpSaveState({ saving: false, error: '' });
    setEditingPlay(null);
    setReplacementPlay(null);
    setReplacementContext(null);
    setInsertionSession(null);
    setChallengeReview(null);
    setDismissedChallenge(null);
    setReplacementChallenge(null);
    setChallengeBaseEnvelope(null);
    setChallengeWorkingEnvelope(null);
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
        // Pregame hydration still loads server setup, while saved operator
        // abbreviations remain authoritative even if their mirror is pending.
        const savedAliases = getDashboardSeededFootballEnvelopeRecord(requestedGameId)?.envelope?.operatorTeamAliases;
        const hydratedEnvelope = savedAliases && validateFootballTeamAliases(savedAliases).ok
          ? { ...loadedEnvelope, operatorTeamAliases: savedAliases } : loadedEnvelope;
        const localEnvelope = saveDashboardSeededFootballEnvelope(loadedEnvelope.gameId || requestedGameId, hydratedEnvelope)
          || hydratedEnvelope;
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
    try {
      const result = await flushFootballServerSync({ gameId: requestedGameId });
      setSyncState({
        pending: getPendingFootballSyncCount(requestedGameId),
        error: result.error || '',
      });
    } catch (error) {
      setSyncState({
        pending: getPendingFootballSyncCount(requestedGameId),
        error: `Server sync could not be saved: ${error?.message || 'Browser storage is unavailable.'}`,
      });
    }
  }, [dashboardGameId, requestedGameId]);

  const penaltyPending = !replacementPlay && !insertionSession && footballPenaltyPendingForInput(fcqiState);
  useEffect(() => {
    if (insertionSession || !envelope || (requestedGameId && envelope.gameId !== requestedGameId)) return;
    // Drafts are not restored after reload, so an abandoned flag clears here.
    // Status changes use the normal mirror without adding a play or undo entry.
    const current = requestedGameId
      ? getDashboardSeededFootballEnvelopeRecord(requestedGameId)?.envelope || envelope : envelope;
    const next = withFootballPenaltyIndicator(current, penaltyPending, new Date().toISOString());
    if (next === current) return;
    try {
      const persisted = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, next) || next : next;
      setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
      if (requestedGameId && dashboardGameId) {
        enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persisted });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      }
    } catch (error) {
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: `The live penalty indicator could not be synced: ${error.message}` });
    }
  }, [dashboardGameId, envelope, flushServerSync, penaltyPending, requestedGameId, insertionSession]);

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
    setReplacementContext(null);
      setInsertionSession(null);
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
    let needsInitialMirror = true;
    const retrySync = async () => {
      if (needsInitialMirror) {
        try {
          // Read again on retry so a failed initial queue write cannot later
          // mirror an older envelope over the operator's newer local work.
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
          needsInitialMirror = false;
        } catch (error) {
          setSyncState({
            pending: getPendingFootballSyncCount(requestedGameId),
            error: `Server sync could not be prepared: ${error?.message || 'Browser storage is unavailable.'} The game remains open; sync will retry automatically.`,
          });
          return;
        }
      }
      await flushServerSync();
    };
    void retrySync();
    const retry = window.setInterval(() => void retrySync(), 15_000);
    const onOnline = () => void retrySync();
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
    const startsNewDrive = result?.status !== 'duplicateAccepted'
      && Boolean(result?.projection?.driveTransition?.shouldStartNew);
    const sameTeamDriveStart = startsNewDrive
      && previousPossession === nextPossession
      && Boolean(nextPossession);
    if (acceptedEnvelope?.game?.status === 'final' && !acceptedEnvelope.game.wrapUp?.completedAt) {
      setWrapUpSaveState({ saving: false, error: '' });
      setWrapUpOpen(true);
    }
    if (acceptedEnvelope?.liveState?.overtime) {
      setPossessionClockChange(null);
      setDriveSummary(null);
      return;
    }
    if (acceptedEnvelope && (kickoffReturnTouchdown || sameTeamDriveStart || (
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
        driveStartOnly: sameTeamDriveStart,
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

  const confirmOvertime = async ({ team, spot }) => {
    const pending = footballOvertimePending(envelope);
    const now = new Date().toISOString();
    const result = await submitLocalRequest({ event: {
      clientEventId: `overtime-${crypto.randomUUID()}`, type: 'gameControl', subtype: 'startDrive',
      period: Number(envelope.game.rules?.periods || 4) + pending.round, clock: '00:00', possession: team,
      preState: { ...envelope.liveState }, participants: { primary: null, secondary: null, defenders: [] }, penalties: [],
      description: `Start overtime ${pending.round}, possession ${pending.series}. ${envelope.game.teams[team].abbr} ball on ${spot}.`,
      result: { code: 'noPlay', gameControl: { action: 'startDrive', possession: team, spot, overtime: true } },
    }, clientContext: { submittedAt: now } });
    if (!result.ok) throw new Error(result.errors?.[0]?.message || 'Could not start overtime.');
    handleSubmitAccepted(result);
    setWrapUpOpen(false);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey(value => value + 1);
  };

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
    // Undo scoring changes without reverting separately saved game settings.
    const restore = {
      ...previousEnvelope,
      ...(envelope.operatorTeamAliases ? { operatorTeamAliases: envelope.operatorTeamAliases } : {}),
      ...(envelope.participation ? { participation: envelope.participation } : {}),
    };
    const restoredEnvelope = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, restore) || restore
      : restore;
    setLocalUndoStack((current) => current.slice(0, -1));
    setPlayEditFeedback({ tone: 'success', message: 'Last change undone.' });
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
  }, [dashboardGameId, envelope?.operatorTeamAliases, envelope?.participation, flushServerSync, localUndoStack, requestedGameId]);

  const openPlayEditor = useCallback((event) => {
    setPlayEditFeedback(null);
    setEditingPlay(event);
  }, []);

  const closePlayEditor = useCallback(() => setEditingPlay(null), []);

  const editingContextReview = useMemo(() => {
    if (!editingPlay) return null;
    const review = reviewFootballPlayContexts(envelope).reviews.get(footballContextEventKey(editingPlay));
    return review ? {
      ...review,
      recordedLabel: playContextLabel(envelope, review.recorded),
      expectedLabel: playContextLabel(envelope, review.expected),
    } : null;
  }, [editingPlay, envelope]);

  const recalculatePlay = useCallback((play) => {
    try {
      const amended = recalculateFootballPlayContext(envelope, play);
      const persisted = requestedGameId ? saveDashboardSeededFootballEnvelope(requestedGameId, amended) || amended : amended;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPossessionClockChange(null);
      setDriveSummary(null);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey((current) => current + 1);
      setPlayEditFeedback({ tone: 'success', message: `Play #${play.sequence} was recalculated.` });
      if (requestedGameId && dashboardGameId) {
        try {
          enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persisted });
          setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
          void flushServerSync();
        } catch (error) {
          setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: `The recalculation was saved locally, but server sync could not be prepared: ${error.message}` });
        }
      }
    } catch (error) {
      setPlayEditFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'The play context could not be recalculated.' });
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

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

  const deletePlay = useCallback((play) => {
    try {
      const amendedEnvelope = deleteFootballPlayFromEnvelope(envelope, play);
      const persistedEnvelope = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, amendedEnvelope) || amendedEnvelope
        : amendedEnvelope;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPossessionClockChange(null);
      setDriveSummary(null);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey((current) => current + 1);
      setPlayEditFeedback({ tone: 'success', message: `Play #${play.sequence} was deleted. Statistics were updated and later plays were renumbered. Use Undo Last Change to restore it.` });
      if (requestedGameId && dashboardGameId) {
        try {
          enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persistedEnvelope });
          setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
          void flushServerSync();
        } catch (error) {
          setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: `The deletion was saved locally, but server sync could not be prepared: ${error.message}` });
        }
      }
    } catch (error) {
      setPlayEditFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'The play could not be deleted.' });
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);

  const savePlayEditor = useCallback((editedPlay) => {
    try {
      const normalizedEnvelope = saveFootballPlayEditToEnvelope(envelope, editedPlay);
      const persistedEnvelope = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, normalizedEnvelope) || normalizedEnvelope
        : normalizedEnvelope;
      setLocalUndoStack((current) => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
      setEditingPlay(null);
      setPossessionClockChange(null);
      setDriveSummary(null);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey((current) => current + 1);
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

  const requestPlayInsertion = (play) => {
    try {
      if (fcqiState.flow && !['idle', 'cancelled', 'submitted', 'submitting.confirmed'].includes(fcqiState.status)) {
        throw new Error('Finish or cancel the current play before inserting a historical play.');
      }
      buildFootballPlayInsertionEnvelope(envelope, play);
      setEditingPlay(null);
      setPlayEditFeedback(null);
      setInsertionSession({ target: play, baseEnvelope: envelope, clock: play.clock, phase: 'setup' });
    } catch (error) { setPlayEditFeedback({ tone: 'error', message: error.message }); }
  };
  const cancelPlayInsertion = () => {
    setInsertionSession(null);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey(value => value + 1);
    setPlayEditFeedback({ tone: 'warning', message: 'Insertion canceled. No play was changed.' });
  };
  const startPlayInsertion = clock => {
    try {
      if (insertionSession.baseEnvelope !== envelope) throw new Error('The game changed. Cancel and reopen insertion.');
      const historical = buildFootballPlayInsertionEnvelope(envelope, insertionSession.target, clock);
      if (insertionSession.inputEnvelope) historical.rosters = insertionSession.inputEnvelope.rosters;
      setInsertionSession({ ...insertionSession, clock, inputEnvelope: historical, phase: 'entry', preview: null });
      setPlayEditFeedback(null);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey(value => value + 1);
    } catch (error) { setPlayEditFeedback({ tone: 'error', message: error.message }); }
  };
  const insertionSubmitAdapter = async request => {
    try {
      if (insertionSession.baseEnvelope !== envelope) throw new Error('The game changed. Cancel and reopen insertion.');
      const preview = previewFootballPlayInsertion(
        { ...envelope, rosters: insertionSession.inputEnvelope.rosters },
        insertionSession.target, request.event, { clock: insertionSession.clock },
      );
      return { ok: true, status: 'insertionPreview', preview };
    } catch (error) { return { ok: false, errors: [{ code: 'INSERTION_FAILED', message: error.message }] }; }
  };
  const savePlayInsertion = () => {
    try {
      if (insertionSession.baseEnvelope !== envelope) throw new Error('The game changed during the preview. Cancel and reopen insertion.');
      const { preview } = insertionSession;
      const saved = requestedGameId
        ? saveDashboardSeededFootballEnvelope(requestedGameId, preview.envelope) || preview.envelope : preview.envelope;
      setLocalUndoStack(current => [...current, envelope]);
      setAcceptedScorerState({ gameEnvelope: saved, projection: null, acceptedEvents: [] });
      setInsertionSession(null);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey(value => value + 1);
      setPlayEditFeedback({ tone: preview.affected.length ? 'warning' : 'success', message: `Play #${preview.event.sequence} inserted. Later plays were renumbered.${preview.affected.length ? ` Review play #${preview.affected[0].sequence} next; its recorded starting context was preserved.` : ''} Use Undo Last Change to restore the previous game.` });
      if (requestedGameId && dashboardGameId) {
        try {
          enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: saved });
          setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
          void flushServerSync();
        } catch (error) { setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: `Insertion saved locally; server sync could not be prepared: ${error.message}` }); }
      }
    } catch (error) { setPlayEditFeedback({ tone: 'error', message: error.message }); }
  };

  const requestPlayReplacement = useCallback((play) => {
    try {
      const review = reviewFootballPlayContexts(envelope).reviews.get(footballContextEventKey(play));
      const context = {
        baseEnvelope: envelope,
        startingContext: review?.fields.length && !review.unavailable ? review.expected : undefined,
      };
      buildFootballPlayReplacementEnvelope(envelope, play, context);
      setReplacementContext(context);
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
    setReplacementContext(null);
    setReplacementChallenge(null);
    setChallengeBaseEnvelope(null);
    setChallengeWorkingEnvelope(null);
    setFcqiState(createInitialFootballQuickInputState());
    setFcqiResetKey((current) => current + 1);
    setPlayEditFeedback({ tone: 'warning', message: 'Play replacement canceled. No play was changed.' });
  }, []);

  const startChallengeRescore = (play) => {
    try {
      buildFootballChallengeRescoreEnvelope(envelope, play);
      setReplacementChallenge(challengeReview);
      setChallengeBaseEnvelope(envelope);
      setDismissedChallenge(footballChallengeEventKey(challengeReview));
      setChallengeReview(null);
      setChallengeWorkingEnvelope(null);
      setEditingPlay(null);
      setReplacementPlay(play);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey(value => value + 1);
      setPlayEditFeedback({ tone: 'warning', message: `Rescoring overturned play #${play.sequence}. Enter the corrected ruling. The original remains saved until you finish.` });
    } catch (error) { setPlayEditFeedback({ tone: 'error', message: error.message }); }
  };

  const replacementSubmitAdapter = useCallback(async (submitRequest) => {
    if (!replacementChallenge && replacementContext?.baseEnvelope !== envelope) return { ok: false, errors: [{ code: 'REPLACEMENT_GAME_CHANGED', message: 'The game changed during replacement. Cancel and reopen the play to use the latest saved game.' }] };
    if (replacementChallenge && challengeBaseEnvelope !== envelope) return { ok: false, errors: [{ code: 'CHALLENGE_GAME_CHANGED', message: 'The game changed during this correction. Cancel and reopen the challenge to use the latest saved game.' }] };
    const result = replacementChallenge
      ? rescoreOverturnedFootballPlay(challengeWorkingEnvelope || envelope, replacementChallenge, replacementPlay, submitRequest?.event)
      : replaceFootballPlayInEnvelope(envelope, replacementPlay, submitRequest?.event, replacementContext || {});
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
      needsRescore: result.needsRescore,
      warnings: result.warnings || [],
      rawResponse: { success: true, status: 'replaced', warnings: result.warnings || [] },
    };
  }, [envelope, replacementPlay, replacementContext, replacementChallenge, challengeWorkingEnvelope, challengeBaseEnvelope]);

  const handleReplacementAccepted = useCallback((result) => {
    const replacementEnvelope = result?.gameEnvelope || result?.envelope;
    if (!replacementEnvelope || !result?.acceptedEvent) return;
    if (replacementChallenge && result.needsRescore) {
      setChallengeWorkingEnvelope(replacementEnvelope);
      setReplacementPlay(result.needsRescore.target);
      setFcqiState(createInitialFootballQuickInputState());
      setFcqiResetKey(value => value + 1);
      setPlayEditFeedback({ tone: 'warning', message: `Confirm affected play #${result.needsRescore.target.sequence}. ${result.needsRescore.message} The correction has not been saved yet.` });
      return;
    }
    const persistedEnvelope = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, replacementEnvelope) || replacementEnvelope
      : replacementEnvelope;
    setLocalUndoStack((current) => [...current, envelope]);
    setAcceptedScorerState({ gameEnvelope: persistedEnvelope, projection: null, acceptedEvents: [] });
    setReplacementPlay(null);
    setReplacementContext(null);
    setReplacementChallenge(null);
    setChallengeBaseEnvelope(null);
    setChallengeWorkingEnvelope(null);
    setChallengeReview(null);
    setEditingPlay(null);
    const contextWarning = result.warnings?.find((warning) => warning.code === 'REPLACEMENT_CONTEXT_MISMATCH');
    setPlayEditFeedback({
      tone: contextWarning ? 'warning' : 'success',
      message: replacementChallenge
        ? `Challenge corrected. Original play retained in history; scores, statistics and following context recalculated.`
        : contextWarning
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
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId, replacementChallenge]);

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
  const openParticipation = useCallback(() => setParticipationOpen(true), []);
  const closeParticipation = useCallback(() => setParticipationOpen(false), []);
  const saveParticipation = useCallback((selections) => {
    const updated = applyFootballParticipation(envelope, selections);
    const persisted = requestedGameId ? saveDashboardSeededFootballEnvelope(requestedGameId, updated) : updated;
    if (!persisted) throw new Error('Participation could not be saved.');
    setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
    if (requestedGameId && dashboardGameId) {
      enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persisted });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
    }
  }, [dashboardGameId, envelope, flushServerSync, requestedGameId]);
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

  const openTeamAliasesEditor = useCallback(() => setTeamAliasesEditorOpen(true), []);
  const closeTeamAliasesEditor = useCallback(() => setTeamAliasesEditorOpen(false), []);
  const saveTeamAliases = useCallback((aliases) => {
    const validation = validateFootballTeamAliases(aliases);
    if (!validation.ok) throw new Error(validation.message);
    const amendedEnvelope = {
      ...envelope,
      operatorTeamAliases: normalizeFootballTeamAliases(aliases),
      updatedAt: new Date().toISOString(),
    };
    const persisted = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, amendedEnvelope) : amendedEnvelope;
    if (!persisted) throw new Error('Team abbreviations could not be saved.');
    setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
    if (requestedGameId && dashboardGameId) {
      enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persisted });
      setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
      void flushServerSync();
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

  const saveQuickRosterEnvelope = useCallback(async (nextEnvelope) => {
    const persisted = requestedGameId
      ? saveDashboardSeededFootballEnvelope(requestedGameId, nextEnvelope)
      : nextEnvelope;
    if (!persisted) throw new Error('Roster changes could not be saved to this browser.');
    setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
    if (requestedGameId && dashboardGameId) {
      try {
        enqueueFootballEnvelopeMirror({ gameId: requestedGameId, dashboardGameId, envelope: persisted });
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: '' });
        void flushServerSync();
      } catch (error) {
        setSyncState({ pending: getPendingFootballSyncCount(requestedGameId), error: `Roster saved locally. Server sync could not be prepared: ${error.message}` });
      }
    }
    return persisted;
  }, [dashboardGameId, flushServerSync, requestedGameId]);

  const addRosterPlayers = useCallback(async (players) => {
    if (insertionSession) {
      const updatedInput = addFootballRosterPlayers(insertionSession.inputEnvelope, players);
      setInsertionSession(current => ({ ...current, inputEnvelope: updatedInput }));
      return;
    }
    const persisted = await saveQuickRosterEnvelope(addFootballRosterPlayers(envelope, players));
    if (replacementChallenge) {
      setChallengeBaseEnvelope(persisted);
      setChallengeWorkingEnvelope(current => current ? addFootballRosterPlayers(current, players) : current);
    }
  }, [envelope, insertionSession, replacementChallenge, saveQuickRosterEnvelope]);

  const saveQuickPlayerName = useCallback(async (team, playerId, displayName) => {
    const player = envelope.rosters?.teams?.[team]?.players?.[playerId];
    if (!player) throw new Error('This player is no longer in the roster.');
    const nextEnvelope = {
      ...envelope,
      rosters: { ...envelope.rosters, updatedAt: new Date().toISOString(), teams: {
        ...envelope.rosters.teams,
        [team]: { ...envelope.rosters.teams[team], players: {
          ...envelope.rosters.teams[team].players, [playerId]: { ...player, displayName },
        } },
      } },
    };
    nextEnvelope.events = envelope.events.map(event => {
      if (event.source?.kind !== 'fcqi' && !String(event.clientEventId || '').startsWith('fcqi-')) return event;
      const participants = Object.values(event.participants || {}).flat().filter(Boolean);
      const affected = participants.some(actor => actor.playerId === playerId && actor.team === team)
        || (event.penalties || []).some(penalty => (penalty.playerId || penalty.penalizedPlayerId) === playerId && penalty.team === team);
      if (!affected) return event;
      const description = buildFootballEditedPlaySummary(nextEnvelope, event);
      return { ...event, description, ...(event.confirmation ? { confirmation: { ...event.confirmation, summaryText: description } } : {}) };
    });
    await saveQuickRosterEnvelope(nextEnvelope);
  }, [envelope, saveQuickRosterEnvelope]);

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
    <main className={`flex min-h-screen flex-col bg-zinc-100 text-zinc-950 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden ${debugMode ? 'pb-[42vh]' : ''}`}>
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
          pendingChallenge && !replacementPlay && !insertionSession ? <div className="p-4"><p className="font-bold">An overturned challenge needs a corrected play before scoring continues.</p><button className="mt-3 rounded bg-emerald-700 px-4 py-2 font-bold text-white" onClick={() => setChallengeReview(pendingChallenge)}>Resume Challenge Rescore</button></div>
          : footballOvertimePending(envelope) && !replacementPlay && !insertionSession ? <p className="p-4 font-semibold">Confirm the overtime possession to continue.</p> : <FootballInputSlot
            debugMode={debugMode}
            envelope={inputEnvelope}
            fcqiResetKey={fcqiResetKey}
            fcqiState={fcqiState}
            onCancelReplacement={cancelPlayReplacement}
            insertionSession={insertionSession}
            onCancelInsertion={cancelPlayInsertion}
            onFcqiStateChange={setFcqiState}
            onRosterPlayersAdded={addRosterPlayers}
            onSavePlayerName={saveQuickPlayerName}
            onOpenPenaltyEditor={openPenaltyCodeEditor}
            onOpenStarters={openStartersEditor}
            onOpenParticipation={openParticipation}
            onReviewPlays={() => { setPlayEditFeedback(null); setPlayReviewOpen(true); }}
            interactionBlocked={Boolean(insertionSession && insertionSession.phase !== 'entry') || (playReviewOpen && !replacementPlay && !insertionSession)}
            onSubmitAccepted={insertionSession ? result => setInsertionSession(current => ({ ...current, phase: 'preview', preview: result.preview })) : replacementPlay ? handleReplacementAccepted : handleSubmitAccepted}
            onPregameEnvelopeChange={handlePregameEnvelopeChange}
            onTeamAliasesChange={saveTeamAliases}
            onOpenTeamAliases={openTeamAliasesEditor}
            replacementPlay={replacementPlay}
            challengeRescore={Boolean(replacementChallenge)}
            submitAdapter={insertionSession ? insertionSubmitAdapter : replacementPlay
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
            editingDisabled={Boolean(replacementPlay || insertionSession)}
            onInsertBefore={requestPlayInsertion}
            envelope={envelope}
            onEditEvent={openPlayEditor}
            onChallengeRescore={setChallengeReview}
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
      {teamAliasesEditorOpen && <FootballTeamAliasesModal envelope={envelope} onClose={closeTeamAliasesEditor} onSave={saveTeamAliases} />}
      {participationOpen && <FootballParticipationModal envelope={envelope} onClose={closeParticipation} onSave={saveParticipation} />}
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
      {footballOvertimePending(envelope) && !pendingChallenge && !replacementPlay && !insertionSession && <FootballOvertimeModal key={`${footballOvertimePending(envelope).round}-${footballOvertimePending(envelope).series}`} envelope={envelope} pending={footballOvertimePending(envelope)} onConfirm={confirmOvertime} />}
      <FootballChallengeRescoreModal envelope={envelope} challenge={challengeReview} onClose={() => { setDismissedChallenge(footballChallengeEventKey(challengeReview)); setChallengeReview(null); }} onConfirm={startChallengeRescore} error={playEditFeedback?.tone === 'error' ? playEditFeedback.message : ''} />
      <FootballGameWrapUpModal
        envelope={envelope}
        onClose={closeGameWrapUp}
        onSave={saveGameWrapUp}
        open={wrapUpOpen && !footballOvertimePending(envelope)}
        saveError={wrapUpSaveState.error}
        saving={wrapUpSaveState.saving}
      />
      {playReviewOpen && <FootballPlayReviewModal
        envelope={envelope}
        feedback={playEditFeedback}
        hidden={Boolean(editingPlay || replacementPlay || insertionSession || challengeReview || possessionClockChange || driveSummary)}
        key={envelope.gameId}
        onClose={() => setPlayReviewOpen(false)}
        onEdit={openPlayEditor}
        onInsertBefore={requestPlayInsertion}
      />}
      {insertionSession && insertionSession.phase !== 'entry' && <FootballPlayInsertionModal
        session={insertionSession} teams={envelope.game.teams}
        error={playEditFeedback?.tone === 'error' ? playEditFeedback.message : ''}
        onStart={startPlayInsertion} onSave={savePlayInsertion} onCancel={cancelPlayInsertion}
        onReenter={() => startPlayInsertion(insertionSession.clock)}
      />}
      <FootballPlayEditorModal
        contextReview={editingContextReview}
        fieldLength={envelope.game.rules?.fieldLength}
        isOpen={Boolean(editingPlay) && !isFootballBallContextRevision(editingPlay)}
        onClose={closePlayEditor}
        onDelete={deletePlay}
        onRecalculate={recalculatePlay}
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

// Suite routes live outside this SPA; navigation must leave the scorer iframe.
const dashboardHref = (isGameRoute = false) => isGameRoute || import.meta.env.PROD
  ? '/sports/football' : '/dashboard';

const ShellRouteState = ({ title, message }) => (
  <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
    <section className="w-full max-w-md rounded border border-zinc-300 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-950">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
      <a
        className="mt-4 inline-flex rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        href={dashboardHref()}
        target="_top"
      >
        Open dashboard
      </a>
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
      source: 'local',
    }),
  }));

  return (
    <header className="shrink-0 border-b border-zinc-300 bg-white">
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
          <a
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            href={dashboardHref(isGameRoute)}
            target="_top"
          >
            Dashboard
          </a>
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
  insertionSession,
  onCancelInsertion,
  onRosterPlayersAdded,
  onSavePlayerName,
  onFcqiStateChange,
  onOpenPenaltyEditor,
  onOpenTeamAliases,
  onTeamAliasesChange,
  onOpenStarters,
  onOpenParticipation,
  onReviewPlays,
  interactionBlocked,
  onPregameEnvelopeChange,
  onSubmitAccepted,
  replacementPlay,
  challengeRescore = false,
  submitAdapter,
}) => {
  const [namingPlayer, setNamingPlayer] = useState(false);
  const standby = !fcqiState || ['idle', 'cancelled'].includes(fcqiState.status);
  const showPregameWorkspace = envelope.game.status === 'pregame';
  const teamAliases = footballTeamAliasesForEnvelope(envelope);

  return (
    <div className="space-y-4 p-4">
      {insertionSession && <section className="rounded border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950" role="status">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black">Inserting before play #{insertionSession.target.sequence}</div>
          <p className="mt-1 text-sm">Q{insertionSession.target.period} {insertionSession.clock}. Enter the missing play, then preview before saving. Following recorded contexts stay unchanged until reviewed.</p></div>
          <button className="rounded border border-amber-600 bg-white px-3 py-2 text-sm font-black" onClick={onCancelInsertion} type="button">Cancel Insertion</button></div>
      </section>}
      {replacementPlay && (
        <section className="rounded border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black">Replacing play #{replacementPlay.sequence}</div>
              <p className="mt-1 text-sm">
                {challengeRescore
                  ? 'Enter the corrected play. The original will remain in history. Following context and statistics will be recalculated when the correction is complete.'
                  : `The original play number and time (Q${replacementPlay.period} ${formatFootballClockDisplay(replacementPlay.clock, '--:--')}) are retained. Starting context: ${playContextLabel(envelope, envelope.liveState)}. If its result disagrees with the next recorded play, the replacement will be saved and the inconsistency will be flagged for review.`}
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
          onTeamAliasesChange={onTeamAliasesChange}
          teamAliases={teamAliases}
        />
      )}
      <FootballUnnamedPlayersAlert envelope={envelope} onSaveName={onSavePlayerName} onEditingChange={setNamingPlayer} visible={standby && !replacementPlay && !insertionSession && !interactionBlocked} />
      <FootballConfirmedQuickInput
        debug={debugMode}
        envelope={envelope}
        key={fcqiResetKey}
        onOpenPenaltyEditor={onOpenPenaltyEditor}
        onOpenTeamAliases={onOpenTeamAliases}
        onOpenStarters={onOpenStarters}
        onOpenParticipation={onOpenParticipation}
        onReviewPlays={onReviewPlays}
        interactionBlocked={interactionBlocked || namingPlayer}
        onRosterPlayersAdded={onRosterPlayersAdded}
        onSubmitAccepted={onSubmitAccepted}
        onStateChange={onFcqiStateChange}
        replacementMode={Boolean(replacementPlay || insertionSession)}
        insertionMode={Boolean(insertionSession)}
        state={fcqiState}
        submitAdapter={submitAdapter}
        teamAliases={teamAliases}
      />
    </div>
  );
};

export const FootballEventLogSlot = ({ canUndo = false, editFeedback, editingDisabled = false, envelope, onEditEvent, onInsertBefore, onChallengeRescore, onUndoLastEvent }) => (
  <div className="h-[65vh] min-h-[18rem] p-4 lg:h-full lg:min-h-0">
    <GameLogColumn
      canUndo={canUndo}
      editFeedback={editFeedback}
      editingDisabled={editingDisabled}
      envelope={envelope}
      onEditEvent={onEditEvent}
      onInsertBefore={onInsertBefore}
      onChallengeRescore={onChallengeRescore}
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

// Quarter-start controls are recorded against the previous play context, but
// belong with the quarter they open. All other records keep their entered period.
const gameLogPeriodForEvent = (event) => {
  const control = event.result?.gameControl;
  return Number(control?.action === 'startQuarter' ? control.period || event.period || 1 : event.period || 1);
};

const gameLogContextLabel = (envelope, event, periodLabel) => {
  const context = event.preState || {};
  const side = context.possession ?? event.possession;
  const team = footballTeamAliasesForEnvelope(envelope)[side] || side || '—';
  const distance = context.goalToGo ? 'Goal' : context.distance ?? '—';
  const possession = context.down ? `${team} - ${context.down} & ${distance}` : team;
  const periodAndTime = [periodLabel(gameLogPeriodForEvent(event)), formatFootballClockDisplay(event.clock)]
    .filter(Boolean).join(' ');
  const spot = formatFootballSpotForDisplay(context.yardLine, envelope) || '—';
  return `${periodAndTime} · ${possession} · ${spot}`;
};

const playContextLabel = (envelope, context) => {
  if (!context) return 'Unavailable';
  const team = footballTeamAliasesForEnvelope(envelope)[context.possession] || context.possession;
  const spot = formatFootballSpotForDisplay(context.yardLine, envelope) || '—';
  return `${team ? `${team} ball` : 'No possession'}${context.down ? `, ${context.down} & ${context.goalToGo ? 'Goal' : context.distance ?? '—'}` : ''} on ${spot}`;
};

const GameLogColumn = ({ canUndo, editFeedback, editingDisabled, envelope, onEditEvent, onInsertBefore, onChallengeRescore, onUndoLastEvent }) => {
  const contextReviews = useMemo(() => reviewFootballPlayContexts(envelope).reviews, [envelope]);
  const regulationPeriods = Math.max(1, Number(envelope.game?.rules?.periods) || 4);
  const currentPeriod = Math.max(1, Number(envelope.clock?.period || envelope.game?.period) || 1);
  const lastPeriod = Math.max(regulationPeriods, currentPeriod,
    ...(envelope.events || []).map(gameLogPeriodForEvent));
  const periods = Array.from({ length: lastPeriod }, (_, index) => index + 1);
  const periodLabel = (period) => period <= regulationPeriods ? `Q${period}` : `OT${period - regulationPeriods}`;
  const [selection, setSelection] = useState(null);
  // A new game or quarter follows live play; ordinary updates preserve the
  // operator's selected historical quarter while they review or edit it.
  const selectedPeriod = selection?.gameId === envelope.gameId && selection?.currentPeriod === currentPeriod
    ? selection.period : currentPeriod;
  const logId = useId();
  const tabsRef = useRef(null);
  const panelRef = useRef(null);
  const selectPeriod = (period) => setSelection({ gameId: envelope.gameId, currentPeriod, period });
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const tabs = tabsRef.current;
    const activeTab = tabs?.querySelector('[aria-selected="true"]');
    if (tabs && activeTab) tabs.scrollLeft = Math.max(0, activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2);
  }, [selectedPeriod, envelope.gameId]);
  const onTabKeyDown = (event, period) => {
    const index = periods.indexOf(period);
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % periods.length
      : event.key === 'ArrowLeft' ? (index + periods.length - 1) % periods.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? periods.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    selectPeriod(periods[nextIndex]);
    tabsRef.current?.querySelector(`[data-quarter="${periods[nextIndex]}"]`)?.focus({ preventScroll: true });
  };
  const logItems = buildGameLogItems(envelope).filter((item) => (
    (item.kind === 'event' ? gameLogPeriodForEvent(item.event) : item.period) === selectedPeriod
  ));
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-zinc-300 bg-white">
    <div className="shrink-0 border-b border-zinc-200 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Game Log</h2>
        {onUndoLastEvent && (
          <button
            className="rounded border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={!canUndo}
            onClick={onUndoLastEvent}
            title="Restore the game to its state before the most recent local change"
            type="button"
          >
            Undo Last Change
          </button>
        )}
      </div>
      {editFeedback?.message && (
        <div
          className={`mt-2 max-h-20 overflow-y-auto rounded border px-3 py-2 text-xs font-semibold ${
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
    <div aria-label="Game Log quarters" className="relative flex shrink-0 gap-1 overflow-x-auto overscroll-contain border-b border-zinc-300 bg-zinc-50 px-1" ref={tabsRef} role="tablist">
      {periods.map((period) => (
        <button
          aria-controls={`${logId}-panel`}
          aria-selected={selectedPeriod === period}
          className={`shrink-0 border-b-2 px-2 py-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${selectedPeriod === period ? 'border-emerald-700 bg-white text-emerald-800' : 'border-transparent text-zinc-600 hover:bg-white hover:text-zinc-900'}`}
          data-quarter={period}
          id={`${logId}-tab-${period}`}
          key={period}
          onClick={() => selectPeriod(period)}
          onKeyDown={(event) => onTabKeyDown(event, period)}
          role="tab"
          tabIndex={selectedPeriod === period ? 0 : -1}
          type="button"
        >
          {periodLabel(period)}
        </button>
      ))}
    </div>
    <div
      aria-labelledby={`${logId}-tab-${selectedPeriod}`}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      id={`${logId}-panel`}
      ref={panelRef}
      role="tabpanel"
      tabIndex={0}
    >
      {logItems.length === 0 ? (
        <div className="p-4 text-sm text-zinc-600">No accepted events in {periodLabel(selectedPeriod)}.</div>
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
                <div className="flex flex-wrap items-center gap-2">
                  {onChallengeRescore && isOverturnedFootballChallenge(item.event) && item.event.result.gameControl.rescore?.status !== 'complete' && <button className="rounded border border-amber-500 px-2 py-1 text-xs font-bold" disabled={editingDisabled} onClick={() => onChallengeRescore(item.event)}>Rescore</button>}
                  {onInsertBefore && item.event.preState && <button aria-label={`Insert before play ${item.event.sequence}`} className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold hover:border-emerald-600 disabled:opacity-40" disabled={editingDisabled} onClick={() => onInsertBefore(item.event)} type="button">Insert Before</button>}
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
                <div className="mt-2 text-sm font-semibold capitalize">
                  {item.event.type}
                  {item.event.subtype ? ` · ${item.event.subtype}` : ''}
                </div>
                <p className="mt-1 break-words text-sm text-zinc-700">
                  {formatFootballSafetyReadout(item.event, formatFootballFumbleReadout(item.event, resolveFootballUnknownPlayerText(item.event, item.event.description || item.event.result?.code || 'Accepted event', envelope.rosters?.teams)))}
                </p>
                <div className="mt-2 text-xs text-zinc-500">
                  {gameLogContextLabel(envelope, item.event, periodLabel)}
                </div>
                {(envelope.playHistory || []).filter(record => record.replacementEventId === item.event.eventId).map(record => <details key={record.historyId} className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm">
                  <summary className="cursor-pointer font-bold">Original Play #{record.originalEvent.sequence} — {record.status === 'overturned' ? 'Overturned' : 'Recalculated'}</summary>
                  <p className="mt-2">{record.originalEvent.description}</p>
                  <p className="mt-1 text-xs">{gameLogContextLabel(envelope, record.originalEvent, periodLabel)}. Historical record only; excluded from statistics. Replaced by corrected Play #{item.event.sequence}.</p>
                </details>)}
                {contextReviews.get(footballContextEventKey(item.event))?.fields.length > 0 && (
                  <div className="mt-2 inline-block rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900" aria-label={`Context mismatch for play ${item.event.sequence}`}>
                    Context mismatch
                  </div>
                )}
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
      period: Number(drive.startPeriod || firstEvent?.period || envelope.clock?.period || 1),
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
  const gameEnvelope = result?.gameEnvelope ?? result?.envelope ?? null;
  if (gameEnvelope) {
    // A complete accepted envelope already includes the operator's correction.
    // Never layer a calculation from this or a previous submission over it.
    return {
      gameEnvelope,
      projection: null,
      acceptedEvents: [],
    };
  }

  const projection = result?.projection ?? null;

  if (projection) {
    return {
      gameEnvelope: current.gameEnvelope,
      projection,
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
