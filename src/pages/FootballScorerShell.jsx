import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FootballDebugTracePanel from '../components/FootballDebugTracePanel';
import FootballConfirmedQuickInput, {
  getFootballFcqiAssistantMessage,
} from '../components/fcqi/FootballConfirmedQuickInput';
import FootballScoreboard from '../components/scorer/FootballScoreboard';
import FootballTeamStats from '../components/scorer/FootballTeamStats';
import FootballPregameWorkspace from '../components/pregame/FootballPregameWorkspace';
import ScorerLayoutShell from '../components/scorer/ScorerLayoutShell';
import {
  defaultFixtureKey,
  fixtureOptions,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';
import { createInitialFootballQuickInputState } from '../quick-input/footballConfirmedQuickInputMachine';
import {
  fetchFootballEnvelope,
  getDashboardSeededFootballEnvelopeRecord,
  persistFootballPregameEnvelope,
} from '../services/footballDashboardService';
import { buildFootballFixtureDebugTrace } from '../utils/footballDebugTrace';

const formatStatus = (status) =>
  String(status || 'unknown').replace(/([a-z])([A-Z])/g, '$1 $2');

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

const formatDriveResult = (drive) => drive?.result || 'Active';

const isDebugEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const getRequestedGameId = (searchParams) =>
  searchParams.get('gameId') || searchParams.get('game_id') || searchParams.get('id') || '';

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
  const [acceptedScorerState, setAcceptedScorerState] = useState(() => createEmptyAcceptedScorerState());
  const baseEnvelope = requestedGameId ? loadedGameState.envelope : fixtureEnvelope;
  const envelope = useMemo(
    () => buildActiveScorerEnvelope(baseEnvelope, acceptedScorerState),
    [acceptedScorerState, baseEnvelope],
  );
  const traceEntries = useMemo(
    () => (debugMode && envelope ? buildFootballFixtureDebugTrace(envelope) : []),
    [debugMode, envelope],
  );

  useEffect(() => {
    setAcceptedScorerState(createEmptyAcceptedScorerState());
    setFcqiState(createInitialFootballQuickInputState());
  }, [requestedFixture, requestedGameId]);

  useEffect(() => {
    if (!requestedGameId) {
      setLoadedGameState({ status: 'idle', envelope: null, source: '', error: '' });
      return undefined;
    }

    const seededRecord = getDashboardSeededFootballEnvelopeRecord(requestedGameId);
    if (seededRecord?.envelope) {
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
    fetchFootballEnvelope(requestedGameId, { signal: controller.signal })
      .then((loadedEnvelope) => {
        setLoadedGameState({
          status: 'ready',
          envelope: loadedEnvelope,
          source: 'server',
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
  }, [requestedGameId]);

  const handleSubmitAccepted = useCallback((result) => {
    setAcceptedScorerState((current) => reduceAcceptedScorerState(current, result));
  }, []);

  const handlePregameEnvelopeChange = useCallback(async (nextEnvelope) => {
    // Optimistically keep the current workspace responsive; the canonical
    // persisted envelope replaces it as soon as the configured store returns.
    setAcceptedScorerState({ gameEnvelope: nextEnvelope, projection: null, acceptedEvents: [] });
    if (!requestedGameId) return;
    try {
      const persisted = await persistFootballPregameEnvelope(requestedGameId, nextEnvelope);
      setAcceptedScorerState({ gameEnvelope: persisted, projection: null, acceptedEvents: [] });
    } catch (error) {
      // The workspace remains editable, but callers receive the failure so the
      // operator is never told that an unsaved pregame change is durable.
      throw error;
    }
  }, [requestedGameId]);

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
      const next = { gameId: requestedGameId };
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
        envelope={envelope}
        fixtureKey={requestedFixture}
        gameId={requestedGameId}
        loadSource={loadedGameState.source}
        onDebugToggle={onDebugToggle}
        onFixtureChange={onFixtureChange}
      />

      <ScorerLayoutShell
        scoreboard={<FootballScoreboardSlot envelope={envelope} />}
        stats={<FootballStatsSlot envelope={envelope} />}
        input={(
          <FootballInputSlot
            debugMode={debugMode}
            envelope={envelope}
            fcqiState={fcqiState}
            onFcqiStateChange={setFcqiState}
            onSubmitAccepted={handleSubmitAccepted}
            onPregameEnvelopeChange={handlePregameEnvelopeChange}
          />
        )}
        eventLog={<FootballEventLogSlot envelope={envelope} />}
        inputAssistant={<FootballInputAssistantSlot envelope={envelope} fcqiState={fcqiState} />}
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
  debugMode,
  envelope,
  fixtureKey,
  gameId,
  loadSource,
  onDebugToggle,
  onFixtureChange,
}) => {
  const teams = envelope.game.teams;
  const isGameRoute = Boolean(gameId);

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
          <Link
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to="/dashboard"
          >
            Dashboard
          </Link>
          {isGameRoute ? (
            <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              Game {gameId} · {loadSource || 'loaded'}
            </span>
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
          <Link
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to={isGameRoute ? `/reports?gameId=${encodeURIComponent(gameId)}` : `/reports?fixture=${fixtureKey}`}
          >
            Reports
          </Link>
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
  fcqiState,
  onFcqiStateChange,
  onPregameEnvelopeChange,
  onSubmitAccepted,
}) => (
  <div className="space-y-4 p-4">
    <DriveStatusBand envelope={envelope} />
    <FootballPregameWorkspace envelope={envelope} onEnvelopeChange={onPregameEnvelopeChange} />
    <FootballConfirmedQuickInput
      debug={debugMode}
      envelope={envelope}
      onSubmitAccepted={onSubmitAccepted}
      onStateChange={onFcqiStateChange}
      state={fcqiState}
    />
  </div>
);

export const FootballEventLogSlot = ({ envelope }) => (
  <div className="h-full p-4">
    <GameLogColumn envelope={envelope} />
  </div>
);

export const FootballInputAssistantSlot = ({ envelope, fcqiState }) => {
  const lastEvent = envelope.events[envelope.events.length - 1];
  const assistantMessage = getFootballFcqiAssistantMessage(fcqiState);
  const queuedPenaltyActive = Boolean(fcqiState?.queuedPenaltyRequested);

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

const DriveStatusBand = ({ envelope }) => {
  const currentDrive = envelope.drives.current;
  const team = currentDrive?.team ? getTeam(envelope, currentDrive.team) : null;

  return (
    <section className="rounded border border-zinc-300 bg-white">
      <div className="grid gap-px overflow-hidden rounded bg-zinc-200 text-sm md:grid-cols-5">
        <DriveMetric label="Drive" value={currentDrive?.driveId || 'None'} />
        <DriveMetric label="Team" value={team?.abbr || 'None'} />
        <DriveMetric label="Start" value={currentDrive?.startYardLine || 'None'} />
        <DriveMetric label="Plays" value={String(currentDrive?.plays ?? 0)} />
        <DriveMetric label="Yards" value={String(currentDrive?.yards ?? 0)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 text-sm">
        <span className="font-medium text-zinc-700">
          Drive {envelope.liveState.driveNumber || '-'} · {formatDriveResult(currentDrive)}
        </span>
        <span className="text-zinc-500">{envelope.liveState.nextPlayContext || envelope.gameId}</span>
      </div>
    </section>
  );
};

const DriveMetric = ({ label, value }) => (
  <div className="bg-white p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

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

const GameLogColumn = ({ envelope }) => (
  <section className="flex h-full min-h-0 flex-col rounded border border-zinc-300 bg-white">
    <div className="border-b border-zinc-200 px-4 py-3">
      <h2 className="text-base font-semibold">Game Log</h2>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {envelope.events.length === 0 ? (
        <div className="p-4 text-sm text-zinc-600">No accepted events.</div>
      ) : (
        <ol className="divide-y divide-zinc-200">
          {envelope.events
            .slice()
            .reverse()
            .map((event, index) => (
              <li key={event.eventId || event.clientEventId || `event-${index}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold capitalize">
                      {event.type}
                      {event.subtype ? ` · ${event.subtype}` : ''}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700">
                      {event.description || event.result?.code || 'Accepted event'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                    #{event.sequence ?? '-'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Q{event.period || '-'} {event.clock || '--:--'} · {event.possession || '-'}
                </div>
              </li>
            ))}
        </ol>
      )}
    </div>
  </section>
);

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
  const projectedEnvelope = applyProjectionToEnvelope(submittedEnvelope, acceptedState.projection);
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
