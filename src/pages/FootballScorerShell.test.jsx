import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import { gameEnvelopeFixtures } from '../data/footballGameEnvelopeFixtures';
import { createCoinTossRecord } from '../pregame/footballPregame';
import {
  createFootballDashboardGame,
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  FOOTBALL_MIRROR_SOURCE_STORAGE_KEY,
  FOOTBALL_SYNC_QUEUE_STORAGE_KEY,
} from '../services/footballDashboardService';
import { buildFootballFixtureDebugTrace } from '../utils/footballDebugTrace';
import { getHighestFootballFcqiSeedCounter } from '../components/fcqi/FootballConfirmedQuickInput';
import FootballDashboard from './FootballDashboard';
import FootballReportPlaceholder from './FootballReportPlaceholder';
import FootballScorerShell, {
  FootballEventLogSlot,
  shouldUseLocalFootballEnvelope,
} from './FootballScorerShell';

const renderScorer = (initialEntry = '/scorer') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<FootballDashboard />} />
        <Route path="/dashboard" element={<FootballDashboard />} />
        <Route path="/scorer" element={<FootballScorerShell />} />
        <Route path="/reports" element={<FootballReportPlaceholder />} />
      </Routes>
    </MemoryRouter>,
  );

function mockSubmitSuccess(overrides = {}) {
  const originalFetch = globalThis.fetch;
  const fetchSpy = vi.fn().mockImplementation(async (_url, init) => {
    const request = JSON.parse(init.body);
    if (request.schemaVersion === 'football.localEnvelopeMirrorRequest.v1') {
      const payload = {
        schemaVersion: 'football.localEnvelopeMirrorAck.v1',
        status: 'mirrored',
        gameId: request.gameId,
        mirrorSourceId: request.mirrorSourceId,
        mirrorRevision: request.mirrorRevision,
        sourceEventSequence: request.sourceEventSequence,
        eventCount: request.eventCount,
        envelopeUpdatedAt: request.envelopeUpdatedAt,
        checksum: request.checksum,
      };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      };
    }
    const canonicalEvent = ['rush', 'pass'].includes(request.event.type) && !request.event.source;
    const base = canonicalEvent
      ? makeCanonicalSubmitSuccess(request)
      : {
          success: true,
          status: 'accepted',
          acceptedEvent: { eventId: 'EVT-TEST', clientEventId: request.event.clientEventId },
          gameEnvelope: null,
          warnings: [],
        };
    const selectedOverrides = typeof overrides === 'function' ? overrides(request) : overrides;
    const payload = { ...base, ...selectedOverrides };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(payload),
      json: async () => payload,
    };
  });
  globalThis.fetch = fetchSpy;

  return {
    fetchSpy,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function mockSubmitFailure({
  errors = [{ code: 'STALE_SEQUENCE', message: 'Submitted baseEventSequence is stale.' }],
  status = 409,
  statusText = 'Conflict',
  body,
} = {}) {
  const originalFetch = globalThis.fetch;
  const fetchSpy = vi.fn().mockImplementation(async (_url, init) => {
    const request = JSON.parse(init.body);
    const payload = body ? {
      schemaVersion: 'football.submitEventResponse.v1',
      success: false,
      status: 'rejected',
      acceptedEvent: null,
      gameEnvelope: canonicalEnvelopeForRequest(request),
      errors: [{
        code: body.code || 'BACKEND_ERROR',
        message: body.error || body.message || 'Football submit failed.',
        field: body.details?.field || null,
      }],
      warnings: body.warnings || [],
    } : {
      schemaVersion: 'football.submitEventResponse.v1',
      success: false,
      status: 'rejected',
      acceptedEvent: null,
      gameEnvelope: canonicalEnvelopeForRequest(request),
      errors,
      warnings: [],
    };
    const responseText = JSON.stringify(payload);
    return {
      ok: false,
      status,
      statusText,
      text: async () => responseText,
      json: async () => payload,
    };
  });
  globalThis.fetch = fetchSpy;

  return {
    fetchSpy,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function submittedRequest(fetchSpy) {
  return JSON.parse(fetchSpy.mock.calls[0][1].body);
}

function cloneNormalEnvelope() {
  return JSON.parse(JSON.stringify(gameEnvelopeFixtures.normal));
}

function canonicalEnvelopeForRequest(request) {
  const envelope = cloneNormalEnvelope();
  envelope.gameId = request.gameId;
  envelope.rosters.gameId = request.gameId;
  return envelope;
}

function makeCanonicalSubmitSuccess(request) {
  const envelope = canonicalEnvelopeForRequest(request);
  const sequence = Math.max(0, ...envelope.events.map((event) => event.sequence || 0)) + 1;
  const acceptedEvent = {
    ...request.event,
    eventId: `EVT-TEST-${sequence}`,
    sequence,
    status: 'accepted',
    acceptedAt: '2026-06-23T21:00:00Z',
    postState: request.event.preState,
  };
  envelope.events = [...envelope.events, acceptedEvent];
  envelope.stats.sourceEventSequence = sequence;
  return {
    schemaVersion: 'football.submitEventResponse.v1',
    success: true,
    status: 'accepted',
    acceptedEvent,
    gameEnvelope: envelope,
    warnings: [],
    errors: [],
  };
}

function makeReturnedEnvelope(request) {
  const envelope = canonicalEnvelopeForRequest(request);
  const acceptedEvent = {
    ...request.event,
    eventId: 'EVT-BACKEND-001',
    sequence: 13,
    status: 'accepted',
    acceptedAt: '2026-06-23T21:00:00Z',
    description: 'Backend accepted rush for 9 yards.',
    result: {
      code: 'tackle',
      yards: 9,
      endYardLine: 'V35',
    },
  };

  envelope.updatedAt = '2026-06-23T21:00:00Z';
  envelope.clock = {
    ...envelope.clock,
    clock: '08:01',
  };
  envelope.liveState = {
    ...envelope.liveState,
    possession: 'V',
    down: 1,
    distance: 10,
    yardLine: 'V35',
    lineToGain: 'V45',
    nextPlayContext: 'Backend accepted state',
  };
  const { nextPlayContext: _ignored, ...postState } = envelope.liveState;
  acceptedEvent.postState = postState;
  envelope.game = {
    ...envelope.game,
    teams: {
      ...envelope.game.teams,
      H: { ...envelope.game.teams.H, score: 14 },
      V: { ...envelope.game.teams.V, score: 7 },
    },
  };
  envelope.events = [...envelope.events.filter((event) => (event.sequence || 0) < 13), acceptedEvent];
  envelope.stats = {
    ...envelope.stats,
    sourceEventSequence: 13,
  };

  return { envelope, acceptedEvent };
}

describe('FootballScorerShell', () => {
  beforeEach(() => {
    window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
    window.localStorage.removeItem(FOOTBALL_MIRROR_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY);
  });

  it('renders the main scorer route from the default fixture envelope', () => {
    renderScorer();

    expect(screen.getByRole('heading', { name: /visitor tech at home state/i })).toBeInTheDocument();
    expect(screen.queryByText('Football Confirmed Quick Input')).not.toBeInTheDocument();
    expect(screen.getAllByText('2 and 6').length).toBeGreaterThan(0);
    expect(screen.getByText('H44')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /game log/i })).toBeInTheDocument();
    const driveStart = screen.getByRole('separator', { name: 'Drive Start - Home State' });
    expect(driveStart).toHaveTextContent('Drive Start - Home State');
    expect(driveStart).toHaveTextContent('12:00 at H25 by Possession');
    expect(screen.getByRole('heading', { name: /team stats/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /roster lookup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pregame workspace/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/scorer layout/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/input assistant/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/football debug trace/i)).not.toBeInTheDocument();
  });

  it('continues submission IDs above an imported envelope instead of reusing an old play ID', async () => {
    const importedEnvelope = gameEnvelopeFixtures.secondQuarterRecovery;
    expect(getHighestFootballFcqiSeedCounter(importedEnvelope)).toBe(52);
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer('/scorer?fixture=secondQuarterRecovery');
      fireEvent.click(screen.getByRole('button', { name: /^rush/i }));
      const rusherInput = screen.getByLabelText(/rusher jersey/i);
      fireEvent.change(rusherInput, { target: { value: '10' } });
      fireEvent.submit(rusherInput.closest('form'));
      fireEvent.click(screen.getByRole('button', { name: /^end of play/i }));
      const spotInput = screen.getByLabelText(/final ball spot/i);
      fireEvent.change(spotInput, { target: { value: 'H28' } });
      fireEvent.submit(spotInput.closest('form'));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      await waitFor(() => expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1));
      expect(submittedRequest(submitMock.fetchSpy).event.clientEventId).toBe('fcqi-rush-53-client');
    } finally {
      submitMock.restore();
    }
  });

  it('places a drive-start separator between the drive plays and the event that created the drive', () => {
    const envelope = JSON.parse(JSON.stringify(gameEnvelopeFixtures.kickoffDrive));
    envelope.drives.current = {
      ...envelope.drives.current,
      startClock: '14:54',
      startReason: 'kickoff',
      plays: 2,
    };
    envelope.events = [
      envelope.events[0],
      {
        eventId: 'EVT-000002',
        sequence: 2,
        type: 'pass',
        subtype: 'incomplete',
        period: 1,
        clock: '14:54',
        possession: 'V',
        preState: { possession: 'V', driveId: 'DRV-0001', yardLine: 'V25' },
        result: { code: 'incomplete' },
        description: 'Pass incomplete.',
      },
      {
        eventId: 'EVT-000003',
        sequence: 3,
        type: 'rush',
        period: 1,
        clock: '14:40',
        possession: 'V',
        preState: { possession: 'V', driveId: 'DRV-0001', yardLine: 'V25' },
        result: { code: 'tackle', yards: 1, endYardLine: 'V26' },
        description: 'Rush for 1 yard.',
      },
    ];

    const { container } = render(<FootballEventLogSlot envelope={envelope} />);
    const logItems = Array.from(container.querySelector('ol').children).map((item) => item.textContent);

    expect(logItems[0]).toContain('#3');
    expect(logItems[1]).toContain('#2');
    expect(logItems[2]).toContain('Drive Start - Visitor Tech');
    expect(logItems[3]).toContain('#1');
  });

  it('uses the fixture fallback only when no gameId is provided', () => {
    renderScorer('/scorer');

    expect(screen.getByRole('heading', { name: /visitor tech at home state/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dev fixture/i)).toBeInTheDocument();
    expect(screen.queryByText(/Game FB-/i)).not.toBeInTheDocument();
  });

  it('loads the requested dashboard game envelope by gameId', async () => {
    createFootballDashboardGame({
      gameId: 'FB-DASH-LOAD',
      gameDate: '2026-09-12',
      startTime: '19:30',
      venue: 'Dashboard Field',
      visitorTeamId: 'TEAM-RIV',
      homeTeamId: 'TEAM-MTN',
    });

    renderScorer('/scorer?gameId=FB-DASH-LOAD');

    expect(await screen.findByRole('heading', { name: /river valley at mountain high/i })).toBeInTheDocument();
    expect(screen.getByText('Game FB-DASH-LOAD · Local envelope')).toBeInTheDocument();
    expect(screen.queryByLabelText(/dev fixture/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('MTN').length).toBeGreaterThan(0);
  });

  it('submits FCQI using the launched dashboard gameId', async () => {
    const submitMock = mockSubmitSuccess();
    createFootballDashboardGame({
      gameId: 'FB-DASH-FCQI',
      gameDate: '2026-09-12',
      startTime: '19:30',
      venue: 'Dashboard Field',
      visitorTeamId: 'TEAM-RIV',
      homeTeamId: 'TEAM-MTN',
    });

    try {
      renderScorer('/scorer?dashboardGameId=DASH-FCQI&envelopeGameId=FB-DASH-FCQI');
      expect(await screen.findByRole('heading', { name: /river valley at mountain high/i })).toBeInTheDocument();

      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      await waitFor(() => expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1));
      const mirrorRequest = submittedRequest(submitMock.fetchSpy);
      expect(mirrorRequest.gameId).toBe('FB-DASH-FCQI');
      expect(mirrorRequest.envelope.events.at(-1).type).toBe('rush');
      expect(submitMock.fetchSpy.mock.calls[0][0]).toBe('/api/football/games/DASH-FCQI/mirror');
      expect(screen.getByText('Server mirror current')).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('migrates legacy sync entries from the exact stored envelope, not its display normalization', async () => {
    const submitMock = mockSubmitSuccess();
    createFootballDashboardGame({
      gameId: 'FB-EXACT-MIRROR',
      gameDate: '2026-09-12',
      startTime: '19:30',
      venue: 'Dashboard Field',
      visitorTeamId: 'TEAM-RIV',
      homeTeamId: 'TEAM-MTN',
    });
    const store = JSON.parse(window.localStorage.getItem(FOOTBALL_DASHBOARD_STORAGE_KEY));
    const authoritativeEnvelope = store.games['FB-EXACT-MIRROR'].envelope;
    authoritativeEnvelope.liveState = {
      ...authoritativeEnvelope.liveState,
      possession: null,
      yardLine: null,
      kickoffTeam: 'V',
      nextPlayContext: 'awaitingKickoff',
    };
    authoritativeEnvelope.pregame = {
      ...(authoritativeEnvelope.pregame || {}),
      coinToss: {
        status: 'complete',
        winner: 'H',
        firstHalfChoice: 'receive',
        firstHalfReceivingTeam: 'H',
        firstHalfKickingTeam: 'V',
      },
    };
    authoritativeEnvelope.events = Array.from({ length: 9 }, (_, index) => ({
      eventId: `LOCAL-${String(index + 1).padStart(6, '0')}`,
      clientEventId: `legacy-${index + 1}`,
      sequence: index + 1,
      type: 'rush',
    }));
    authoritativeEnvelope.stats.sourceEventSequence = 9;
    window.localStorage.setItem(FOOTBALL_DASHBOARD_STORAGE_KEY, JSON.stringify(store));
    window.localStorage.setItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY, JSON.stringify({
      version: 1,
      items: authoritativeEnvelope.events.map((event) => ({
        id: `event:${event.clientEventId}`,
        gameId: authoritativeEnvelope.gameId,
        dashboardGameId: 'DASH-EXACT-MIRROR',
        kind: 'event',
        payload: { gameId: authoritativeEnvelope.gameId, event },
      })),
    }));

    try {
      renderScorer('/scorer?dashboardGameId=DASH-EXACT-MIRROR&envelopeGameId=FB-EXACT-MIRROR');
      await waitFor(() => expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1));
      const mirrorRequest = submittedRequest(submitMock.fetchSpy);

      expect(mirrorRequest.eventCount).toBe(9);
      expect(mirrorRequest.envelope.events).toEqual(authoritativeEnvelope.events);
      expect(mirrorRequest.envelope.liveState.yardLine).toBeNull();
      expect(JSON.parse(window.localStorage.getItem(FOOTBALL_DASHBOARD_STORAGE_KEY)).games['FB-EXACT-MIRROR'].envelope.liveState.yardLine).toBeNull();
    } finally {
      submitMock.restore();
    }
  });

  it('hydrates a dashboard launch once, then reloads only from the local envelope', async () => {
    const originalFetch = globalThis.fetch;
    const envelope = cloneNormalEnvelope();
    envelope.gameId = 'FB-PROD-HYDRATE';
    envelope.rosters.gameId = envelope.gameId;
    envelope.game.teams.H.name = 'Hydrated Home';
    envelope.game.teams.V.name = 'Hydrated Visitor';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => envelope,
    });
    globalThis.fetch = fetchSpy;

    try {
      const first = renderScorer('/scorer?dashboardGameId=DASH-PROD&envelopeGameId=FB-PROD-HYDRATE');
      expect(await screen.findByRole('heading', { name: /hydrated visitor at hydrated home/i })).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/football/games/DASH-PROD/envelope');

      first.unmount();
      renderScorer('/scorer?dashboardGameId=DASH-PROD&envelopeGameId=FB-PROD-HYDRATE');
      expect(await screen.findByRole('heading', { name: /hydrated visitor at hydrated home/i })).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('treats a local pregame envelope without a completed coin toss as absent', async () => {
    createFootballDashboardGame({
      gameId: 'FB-INCOMPLETE-PREGAME',
      gameDate: '2026-09-12',
      startTime: '19:30',
      venue: 'Dashboard Field',
      visitorTeamId: 'TEAM-RIV',
      homeTeamId: 'TEAM-MTN',
    });
    const store = JSON.parse(window.localStorage.getItem(FOOTBALL_DASHBOARD_STORAGE_KEY));
    const localEnvelope = store.games['FB-INCOMPLETE-PREGAME'].envelope;
    localEnvelope.game.status = 'pregame';
    localEnvelope.pregame = {
      ...(localEnvelope.pregame || {}),
      gamePhase: 'pregame',
      coinToss: { status: 'pending' },
    };
    window.localStorage.setItem(FOOTBALL_DASHBOARD_STORAGE_KEY, JSON.stringify(store));

    const originalFetch = globalThis.fetch;
    const serverEnvelope = cloneNormalEnvelope();
    serverEnvelope.gameId = 'FB-INCOMPLETE-PREGAME';
    serverEnvelope.rosters.gameId = serverEnvelope.gameId;
    serverEnvelope.game.teams.H.name = 'Server Home';
    serverEnvelope.game.teams.V.name = 'Server Visitor';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => serverEnvelope,
    });
    globalThis.fetch = fetchSpy;

    try {
      renderScorer('/scorer?dashboardGameId=DASH-PREGAME&envelopeGameId=FB-INCOMPLETE-PREGAME');

      expect(await screen.findByRole('heading', { name: /server visitor at server home/i })).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/football/games/DASH-PREGAME/envelope');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps completed coin-toss and post-pregame local envelopes authoritative', () => {
    const incompletePregame = cloneNormalEnvelope();
    incompletePregame.game.status = 'pregame';
    incompletePregame.pregame = {
      gamePhase: 'pregame',
      coinToss: { status: 'pending' },
    };
    const awaitingKickoff = {
      ...incompletePregame,
      pregame: {
        ...incompletePregame.pregame,
        gamePhase: 'awaitingKickoff',
        coinToss: { status: 'complete' },
      },
    };
    const halftime = {
      ...incompletePregame,
      game: { ...incompletePregame.game, status: 'halftime' },
      pregame: { ...incompletePregame.pregame, gamePhase: 'halftime' },
    };

    expect(shouldUseLocalFootballEnvelope(incompletePregame)).toBe(false);
    expect(shouldUseLocalFootballEnvelope(awaitingKickoff)).toBe(true);
    expect(shouldUseLocalFootballEnvelope(halftime)).toBe(true);
  });

  it('slots routed football internals into the canonical scorer shell', () => {
    renderScorer();

    const shell = screen.getByTestId('scorer-layout-shell');
    const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
    const statsSlot = shell.querySelector('[data-scorer-slot="stats"]');
    const inputSlot = shell.querySelector('[data-scorer-slot="input"]');
    const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
    const assistantSlot = shell.querySelector('[data-scorer-slot="input-assistant"]');

    expect(within(scoreboardSlot).getByText('8:42')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByText('Down/Distance')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByLabelText('Possession football')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByLabelText('V timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('H timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('V challenges').children).toHaveLength(2);
    expect(within(scoreboardSlot).getByLabelText('H challenges').children).toHaveLength(2);
    expect(within(scoreboardSlot).queryByLabelText('Possession', { exact: true })).not.toBeInTheDocument();
    expect(within(scoreboardSlot).queryByText('Ball')).not.toBeInTheDocument();
    expect(within(statsSlot).getByRole('heading', { name: /team stats/i })).toBeInTheDocument();
    expect(within(statsSlot).queryByRole('heading', { name: /roster lookup/i })).not.toBeInTheDocument();
    expect(within(inputSlot).getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(within(eventLogSlot).getByRole('heading', { name: /game log/i })).toBeInTheDocument();
    expect(within(assistantSlot).getByText(/input assistant/i)).toBeInTheDocument();
  });

  it('renders the compact team stats panel with safe default values', () => {
    renderScorer();

    const statsSlot = screen
      .getByTestId('scorer-layout-shell')
      .querySelector('[data-scorer-slot="stats"]');
    const statRows = [
      '1st Downs',
      'Rushing',
      'Passing',
      'Passing Yards',
      'Plays',
      'Avg/play',
      'Kick Returns',
      'Punt Returns',
      'Int. Returns',
      'Fumble Returns',
      'Fumbles',
      'Penalties',
      'Punts',
      'Time of Possession',
      '3rd Downs',
      '4th Downs',
    ];

    expect(within(statsSlot).getByRole('heading', { name: /team stats/i })).toBeInTheDocument();
    expect(within(statsSlot).getByText('VIS')).toBeInTheDocument();
    expect(within(statsSlot).getByText('HOME')).toBeInTheDocument();
    statRows.forEach((row) => {
      expect(within(statsSlot).getByText(row)).toBeInTheDocument();
    });
    expect(within(statsSlot).getAllByText('0 for 0 yards').length).toBeGreaterThan(0);
    expect(within(statsSlot).getAllByText('0.0').length).toBeGreaterThan(0);
    expect(within(statsSlot).getAllByText('0:00').length).toBeGreaterThan(0);
  });

  it('renders scoreboard refinements on the /scorer route', () => {
    renderScorer('/scorer');

    const shell = screen.getByTestId('scorer-layout-shell');
    const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');

    expect(within(scoreboardSlot).getByLabelText('Possession football')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByLabelText('V timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('H timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('V challenges').children).toHaveLength(2);
    expect(within(scoreboardSlot).getByLabelText('H challenges').children).toHaveLength(2);
    expect(within(scoreboardSlot).queryByLabelText('Possession', { exact: true })).not.toBeInTheDocument();
    expect(within(scoreboardSlot).queryByText('Ball')).not.toBeInTheDocument();
  });

  it('renders the acceptance fixture states without backend data', () => {
    const fixtures = [
      ['/scorer?fixture=pregame', 'FB-PREGAME', 'Not set'],
      ['/scorer?fixture=redzone', 'FB-REDZONE', 'V18'],
      ['/scorer?fixture=goalToGo', 'FB-GOALTOGO', '2 and goal'],
      ['/scorer?fixture=final', 'FB-FINAL', 'End of game.'],
    ];

    fixtures.forEach(([entry, gameId, expectedText]) => {
      const { unmount } = renderScorer(entry);
      expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
      unmount();
    });
  });

  it('renders production FCQI controls on the scorer route', () => {
    renderScorer('/scorer');

    expect(screen.getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(screen.queryByText('Football Confirmed Quick Input')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rush/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /pass/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /punt/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /kick/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /penalty/i })).toBeEnabled();
    expect(screen.getAllByText('Choose a play type.').length).toBeGreaterThan(0);
  });

  it('opens the rush modal from the Rush button', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));

    expect(screen.getByRole('dialog', { name: /rush/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rusher jersey/i)).toBeInTheDocument();
    expect(screen.getAllByText('Enter rusher jersey number.').length).toBeGreaterThan(0);
  });

  it('opens the rush modal from the R hotkey', () => {
    renderScorer();

    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });

    expect(screen.getByRole('dialog', { name: /rush/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rusher jersey/i)).toBeInTheDocument();
  });

  it('cancels an open quick-input modal with the Escape key', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    expect(screen.getByRole('dialog', { name: /rush/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog', { name: /rush/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Choose a play type.').length).toBeGreaterThan(0);
  });

  it('keeps flow progress on play and penalty modals where it verifies entered data', () => {
    const cases = [
      [/^rush/i, /^rush$/i],
      [/^pass/i, /^pass$/i],
      [/^punt/i, /^punt$/i],
      [/^kick/i, /^kick$/i],
      [/^penalty/i, /^penalty$/i],
    ];

    cases.forEach(([buttonName, dialogName]) => {
      const { unmount } = renderScorer();
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      const dialog = screen.getByRole('dialog', { name: dialogName });

      expect(within(dialog).getByLabelText(/fcqi flow progress/i)).toBeInTheDocument();
      unmount();
    });
  });

  it('shows clickable rush flow progress with current, complete, and future styling', async () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));

    let progress = currentFlowProgress();
    expect(progress).not.toHaveClass('overflow-x-auto');
    expect(progress.querySelector('ol')).toHaveClass('flex-wrap');
    expect(within(progress).getAllByText('->')).toHaveLength(2);
    expect(within(progress).getByText('Rusher')).toHaveClass('bg-red-100');
    expect(within(progress).getByText('Result')).toHaveClass('bg-zinc-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-zinc-100');
    expect(within(progress).queryByRole('button', { name: /^result$/i })).not.toBeInTheDocument();

    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.submit(jerseyInput.closest('form'));

    progress = currentFlowProgress();
    expect(within(progress).getByRole('button', { name: /#22 smith/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByText('Result')).toHaveClass('bg-red-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-zinc-100');

    fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));

    progress = currentFlowProgress();
    expect(within(progress).getByRole('button', { name: /#22 smith/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByRole('button', { name: /^tackle$/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByText('Tacklers')).toHaveClass('bg-red-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-zinc-100');

    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '44' } });
    fireEvent.submit(tacklerInput.closest('form'));

    progress = currentFlowProgress();
    expect(within(progress).getByText(/#44 moss/i)).toHaveClass('bg-red-100');

    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '31' } });
    fireEvent.submit(secondTacklerInput.closest('form'));

    progress = currentFlowProgress();
    expect(within(progress).getByRole('button', { name: /#44 moss, #31 price/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-red-100');

    const spotInput = screen.getByLabelText(/final ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'V49' } });
    fireEvent.submit(spotInput.closest('form'));

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    progress = within(summaryDialog).getByLabelText(/fcqi flow progress/i);
    expect(within(progress).getByRole('button', { name: /#22 smith/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByRole('button', { name: /^tackle$/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByRole('button', { name: /#44 moss, #31 price/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByRole('button', { name: /^v49$/i })).toHaveClass('bg-emerald-100');
  });

  it('clicks completed rush progress steps to edit and clear dependent data', async () => {
    renderScorer();

    completeRushFlowInputs();
    let summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    let progress = within(summaryDialog).getByLabelText(/fcqi flow progress/i);

    fireEvent.click(within(progress).getByRole('button', { name: /^tackle$/i }));

    expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();
    progress = currentFlowProgress();
    expect(within(progress).getByRole('button', { name: /#22 smith/i })).toHaveClass('bg-emerald-100');
    expect(within(progress).getByText('Tackle')).toHaveClass('bg-red-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-zinc-100');
    expect(within(progress).queryByText(/#44 moss/i)).not.toBeInTheDocument();
    expect(within(progress).queryByText(/^v49$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '44' } });
    fireEvent.submit(tacklerInput.closest('form'));
    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '' } });
    fireEvent.submit(secondTacklerInput.closest('form'));
    const spotInput = screen.getByLabelText(/final ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'V49' } });
    fireEvent.submit(spotInput.closest('form'));

    summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    progress = within(summaryDialog).getByLabelText(/fcqi flow progress/i);
    fireEvent.click(within(progress).getByRole('button', { name: /#22 smith/i }));

    expect(screen.getByRole('dialog', { name: /^rush$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rusher jersey/i)).toHaveValue('22');
    progress = currentFlowProgress();
    expect(within(progress).getByText(/#22 smith/i)).toHaveClass('bg-red-100');
    expect(within(progress).getByText('Result')).toHaveClass('bg-zinc-100');
    expect(within(progress).getByText('Spot')).toHaveClass('bg-zinc-100');
    expect(within(progress).queryByText(/^tackle$/i)).not.toBeInTheDocument();
    expect(within(progress).queryByText(/#44 moss/i)).not.toBeInTheDocument();
    expect(within(progress).queryByText(/^v49$/i)).not.toBeInTheDocument();
  });

  it('opens the pass modal from the Pass button and P hotkey', () => {
    const { unmount } = renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /^pass/i }));

    expect(screen.getByRole('dialog', { name: /pass/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/passer jersey/i)).toBeInTheDocument();
    unmount();

    renderScorer();
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP' });

    expect(screen.getByRole('dialog', { name: /pass/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/passer jersey/i)).toBeInTheDocument();
  });

  it('commits rusher jersey on Enter and advances to result selection', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.submit(jerseyInput.closest('form'));

    expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tackle/i })).toBeInTheDocument();
    expect(screen.getAllByText('Choose rush result.').length).toBeGreaterThan(0);
  });

  it('uses Backspace to restore the previous modal answer without overriding text deletion', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.keyDown(jerseyInput, { key: 'Backspace', code: 'Backspace' });
    expect(screen.getByLabelText(/rusher jersey/i)).toHaveValue('22');

    fireEvent.submit(jerseyInput.closest('form'));
    expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
    expect(screen.getByRole('dialog', { name: /^rush$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rusher jersey/i)).toHaveValue('22');
  });

  it('removes text inputs from one-key selection modals while keeping hotkey buttons active', () => {
    renderScorer();

    startRushResultSelection();
    const resultDialog = screen.getByRole('dialog', { name: /rush result/i });

    expect(within(resultDialog).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 't', code: 'KeyT' });

    expect(screen.getByRole('dialog', { name: /rush tackler/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^tackler jersey/i)).toBeInTheDocument();
  });

  it('keeps text inputs for multi-character prompts', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const rushDialog = screen.getByRole('dialog', { name: /^rush$/i });
    expect(within(rushDialog).getByRole('textbox', { name: /rusher jersey/i })).toBeInTheDocument();

    fireEvent.click(within(rushDialog).getByRole('button', { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ball context b$/i }));
    const ballDialog = screen.getByRole('dialog', { name: /ball context/i });

    expect(within(ballDialog).getByRole('textbox', { name: /^down$/i })).toBeInTheDocument();
  });

  it('opens duplicate player selection for duplicate jerseys', () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '3' } });
    fireEvent.submit(jerseyInput.closest('form'));

    expect(screen.getByRole('dialog', { name: /duplicate jersey selection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /taylor jones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /micah smith/i })).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();
  });

  it('supports rush result hotkeys during result selection', () => {
    const cases = [
      ['T', /tackler jersey/i],
      ['O', /tackler jersey/i],
      ['F', /forced by jersey/i],
      ['C', /lateral to jersey/i],
      ['.', /final ball spot/i],
    ];

    cases.forEach(([key, expected]) => {
      const { unmount } = renderScorer();
      startRushResultSelection();

      fireEvent.keyDown(window, { key, code: key === '.' ? 'Period' : `Key${key}` });

      expect(screen.getByLabelText(expected)).toBeInTheDocument();
      unmount();
    });
  });

  it('shows pass result choices with hotkey badges', () => {
    renderScorer();

    startPassResultSelection();

    PASS_BUTTON_EXPECTATIONS.forEach(([label, hotkey]) => {
      const button = screen.getByRole('button', { name: new RegExp(`^${label} ${hotkey}$`, 'i') });
      expect(within(button).getByText(hotkey)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^broken up b$/i })).not.toBeInTheDocument();
  });

  it('asks Broken Up or No Pass Breakup after an incomplete pass', () => {
    renderScorer();
    startPassResultSelection();

    fireEvent.click(screen.getByRole('button', { name: /^incomplete i$/i }));
    submitTextToken(/intended for jersey/i, '88');
    submitTextToken(/^yardline$/i, '');

    const dialog = screen.getByRole('dialog', { name: /pass breakup/i });
    expect(within(dialog).getByRole('button', { name: /^broken up b$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^no pass breakup n$/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens the punt modal from the Punt button and U hotkey', () => {
    const { unmount } = renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /^punt/i }));

    expect(screen.getByRole('dialog', { name: /punt/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/punter jersey/i)).toBeInTheDocument();
    unmount();

    renderScorer();
    fireEvent.keyDown(window, { key: 'u', code: 'KeyU' });

    expect(screen.getByRole('dialog', { name: /punt/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/punter jersey/i)).toBeInTheDocument();
  });

  it('opens the kick menu from the Kick button and K hotkey', () => {
    const { unmount } = renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /^kick/i }));

    expect(screen.getByRole('dialog', { name: /^kick$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^kickoff \/ free kick o$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^field goal f$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pat a$/i })).toBeInTheDocument();
    unmount();

    renderScorer();
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });

    expect(screen.getByRole('dialog', { name: /^kick$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^kickoff \/ free kick o$/i })).toBeInTheDocument();
  });

  it('one-key kick and penalty menus do not render text inputs', () => {
    const { unmount } = renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /^kick/i }));
    let dialog = screen.getByRole('dialog', { name: /^kick$/i });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^pat a$/i }));
    dialog = screen.getByRole('dialog', { name: /pat type/i });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    unmount();

    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: /^penalty/i }));
    const penaltyNameInput = screen.getByPlaceholderText(/hold or holding/i);
    fireEvent.change(penaltyNameInput, { target: { value: 'Holding' } });
    fireEvent.submit(penaltyNameInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^home state h$/i }));

    dialog = screen.getByRole('dialog', { name: /penalty resolution/i });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens the game control menu from the Game Control button and G hotkey', () => {
    const { unmount } = renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));

    assertGameControlMenu();
    unmount();

    renderScorer();
    fireEvent.keyDown(window, { key: 'g', code: 'KeyG' });

    assertGameControlMenu();
  });

  it('keeps only Game Control available at halftime so the next quarter can start', () => {
    renderScorer('/scorer?fixture=halftime');

    expect(screen.getByRole('button', { name: /^rush/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^game control/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));

    assertGameControlMenu();
  });

  it('requires the recorded second-half choice before accepting the third-quarter start', async () => {
    const fixture = gameEnvelopeFixtures.halftime;
    const originalPregame = fixture.pregame;
    fixture.pregame = {
      gamePhase: 'halftime',
      coinToss: {
        ...createCoinTossRecord(),
        status: 'complete',
        winnerTeam: 'H',
        loserTeam: 'V',
        winnerInitialChoice: 'receive',
        direction: 'west',
        directionChoiceTeam: 'V',
        firstHalfKickingTeam: 'V',
        firstHalfReceivingTeam: 'H',
        secondHalfChoiceTeam: 'V',
        completedAt: '2026-06-20T00:00:00Z',
      },
      starters: {},
    };

    try {
      renderScorer('/scorer?fixture=halftime&local=1');
      fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
      fireEvent.click(within(screen.getByRole('dialog', { name: /^game control$/i })).getByRole('button', { name: /^quarter functions q$/i }));
      fireEvent.click(within(screen.getByRole('dialog', { name: /quarter functions/i })).getByRole('button', { name: /^start quarter s$/i }));
      fireEvent.click(within(await screen.findByRole('dialog', { name: /play summary review/i })).getByRole('button', { name: /^submit play$/i }));

      const choiceDialog = await screen.findByRole('dialog', { name: 'Second-Half Choice' });
      expect(within(choiceDialog).getByRole('heading', { name: "Visitor Tech's Second-Half Choice" })).toBeInTheDocument();
      expect(within(screen.getByRole('heading', { name: /game log/i }).closest('section')).queryByText(/start quarter 3\./i)).not.toBeInTheDocument();
      fireEvent.click(within(choiceDialog).getByRole('button', { name: 'Receive' }));
      expect(within(choiceDialog).getByRole('heading', { name: 'Home State Chooses Direction' })).toBeInTheDocument();
      fireEvent.click(within(choiceDialog).getByRole('button', { name: 'North' }));

      const summary = within(choiceDialog).getByRole('region', { name: 'Second-Half Initialization Summary' });
      expect(summary).toHaveTextContent('Home State');
      expect(summary).toHaveTextContent('Visitor Tech');
      fireEvent.click(within(choiceDialog).getByRole('button', { name: 'Start Third Quarter' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Second-Half Choice' })).not.toBeInTheDocument());
      expect(screen.getByText('Q3')).toBeInTheDocument();
      expect(screen.getByText('15:00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^rush/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^kick k$/i })).toBeEnabled();
      expect(screen.getByText(/home state will kick to visitor tech; home state chose north/i)).toBeInTheDocument();
    } finally {
      fixture.pregame = originalPregame;
    }
  });

  it('opens the roster workspace from the scorer header', () => {
    renderScorer('/scorer?fixture=pregame');

    expect(screen.getByRole('button', { name: /^game control/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /edit home starters/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roster' }));

    expect(screen.getByRole('dialog', { name: 'Football roster editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Home H-12 jersey')).toHaveValue('12');
    expect(screen.queryByRole('button', { name: 'Open roster editor' })).not.toBeInTheDocument();
  });

  it('keeps the coin toss moving after operator team aliases are accepted', () => {
    renderScorer('/scorer?fixture=pregame');
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));

    expect(screen.getByLabelText('West Virginia St. abbreviation')).toHaveValue('W');
    expect(screen.getByLabelText('Fairmont St. abbreviation')).toHaveValue('F');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Team Captains' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Team Abbreviations' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'West Virginia St.', exact: true }));
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });
    expect(screen.getByRole('heading', { name: 'Away Chooses Direction' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /kick type/i })).not.toBeInTheDocument();
  });

  it('blocks kickoff entry when an awaiting-kickoff envelope has no ball spot', () => {
    const fixture = gameEnvelopeFixtures.pregame;
    const originalPregame = fixture.pregame;
    const originalLiveState = fixture.liveState;
    fixture.pregame = {
      gamePhase: 'awaitingKickoff',
      coinToss: { ...createCoinTossRecord(), status: 'inProgress' },
      starters: {},
    };
    fixture.liveState = {
      ...fixture.liveState,
      yardLine: '',
      nextPlayContext: 'awaitingKickoff',
    };

    try {
      renderScorer('/scorer?fixture=pregame');

      expect(screen.getByRole('button', { name: /^kick k$/i })).toBeDisabled();
      expect(screen.getByText(/kickoff spot is not set/i)).toBeInTheDocument();
    } finally {
      fixture.pregame = originalPregame;
      fixture.liveState = originalLiveState;
    }
  });

  it('game control emergency builds a clock-stop summary and starters opens the optional team flow', () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    try {
      renderScorer();
      fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
      fireEvent.click(screen.getByRole('button', { name: /^emergency clock stop e$/i }));

      expect(screen.getByText(/emergency clock stop at/i)).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /cancel play/i }));

      fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
      fireEvent.click(screen.getByRole('button', { name: /^starters r$/i }));

      expect(screen.getByRole('dialog', { name: 'Choose starters team' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Home starters' }));
      expect(screen.getByRole('dialog', { name: 'Home starters editor' })).toBeInTheDocument();
      expect(screen.getAllByLabelText(/^Home offense starter \d+ jersey$/)).toHaveLength(11);
      expect(screen.getAllByLabelText(/^Home defense starter \d+ jersey$/)).toHaveLength(11);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('opens the penalty-code editor from Game Control with the F hotkey', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF' });

    expect(screen.getByRole('dialog', { name: 'Edit penalty codes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Penalty Type' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /^game control$/i })).not.toBeInTheDocument();
  });

  it('game control quarter functions build a reviewable period update', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
    fireEvent.click(screen.getByRole('button', { name: /^quarter functions q$/i }));

    const quarterDialog = screen.getByRole('dialog', { name: /quarter functions/i });
    expect(within(quarterDialog).queryByLabelText(/fcqi flow progress/i)).not.toBeInTheDocument();
    expect(within(quarterDialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(quarterDialog).getByRole('button', { name: /^start quarter s$/i })).toBeInTheDocument();
    expect(within(quarterDialog).getByRole('button', { name: /^end quarter e$/i })).toBeInTheDocument();

    fireEvent.click(within(quarterDialog).getByRole('button', { name: /^start quarter s$/i }));

    expect(screen.getByText(/start quarter 2/i)).toBeInTheDocument();
  });

  it('asks for the game clock after a timeout selection and applies the entered time', async () => {
    renderScorer('/scorer?fixture=normal&local=1');
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
    fireEvent.click(screen.getByRole('button', { name: /^timeout t$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^home state h$/i }));

    const clockDialog = screen.getByRole('dialog', { name: /timeout clock/i });
    const clockInput = within(clockDialog).getByLabelText('Game Clock');
    expect(clockInput).toHaveValue('8:42');
    fireEvent.change(clockInput, { target: { value: '634' } });
    expect(clockInput).toHaveValue('6:34');
    fireEvent.submit(clockInput.closest('form'));

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(summaryDialog).toHaveTextContent('(6:34) Timeout called by Home State.');
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

    const scoreboardSlot = screen.getByTestId('scorer-layout-shell').querySelector('[data-scorer-slot="scoreboard"]');
    await waitFor(() => expect(within(scoreboardSlot).getByText('6:34')).toBeInTheDocument());
  });

  it('game control ball context collects values and calculates line to gain', () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    try {
      renderScorer();
      fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
      fireEvent.click(screen.getByRole('button', { name: /^ball context b$/i }));

      const downInput = screen.getByLabelText(/^down$/i);
      fireEvent.change(downInput, { target: { value: '2' } });
      fireEvent.submit(downInput.closest('form'));

      const distanceInput = screen.getByLabelText(/^distance$/i);
      fireEvent.change(distanceInput, { target: { value: '5' } });
      fireEvent.submit(distanceInput.closest('form'));

      const spotInput = screen.getByLabelText(/^spot$/i);
      fireEvent.change(spotInput, { target: { value: 'H44' } });
      fireEvent.submit(spotInput.closest('form'));

      expect(screen.getByText((text) => (
        /ball context set to 2 and 5/i.test(text)
        && /line to gain/i.test(text)
      ))).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('game control set possession collects H/V and builds a reviewable update', () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: /^game control/i }));
    fireEvent.click(screen.getByRole('button', { name: /^set possession p$/i }));

    const possessionDialog = screen.getByRole('dialog', { name: /select team/i });
    fireEvent.click(within(possessionDialog).getByRole('button', { name: /^visitor tech v$/i }));

    expect(screen.getByText(/possession set to VIS/i)).toBeInTheDocument();
  });

  it('field goal good flow shows summary immediately and submits through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      startFieldGoalResultSelection();
      FIELD_GOAL_RESULT_BUTTON_EXPECTATIONS.forEach(([label, hotkey]) => {
        const button = screen.getByRole('button', { name: new RegExp(`^${label} ${hotkey}$`, 'i') });
        expect(within(button).getByText(hotkey)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^good/i }));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(within(summaryDialog).getByText(/jordan smith 28-yard field goal good/i)).toBeInTheDocument();

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('fieldGoal');
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    } finally {
      submitMock.restore();
    }
  });

  it('field goal missed and blocked branches collect details', async () => {
    const { unmount } = renderScorer();

    startFieldGoalResultSelection();
    fireEvent.click(screen.getByRole('button', { name: /^missed/i }));
    expect(screen.getByRole('dialog', { name: /missed how/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^wide right/i }));
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/no good, wide right/i);
    unmount();

    renderScorer();
    startFieldGoalResultSelection();
    fireEvent.click(screen.getByRole('button', { name: /^blocked/i }));
    const blockerInput = screen.getByLabelText(/blocked by jersey/i);
    fireEvent.change(blockerInput, { target: { value: '44' } });
    fireEvent.submit(blockerInput.closest('form'));
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/blocked by #44 caleb moss/i);
  });

  it('PAT flow shows type choices and submits kick PAT through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      startPatTypeSelection();
      const patTypeDialog = screen.getByRole('dialog', { name: /pat type/i });
      PAT_TYPE_BUTTON_EXPECTATIONS.forEach(([label, hotkey]) => {
        const button = within(patTypeDialog).getByRole('button', { name: new RegExp(`^${label} ${hotkey}$`, 'i') });
        expect(within(button).getByText(hotkey)).toBeInTheDocument();
      });

      fireEvent.click(within(patTypeDialog).getByRole('button', { name: /^kick k$/i }));
      const kickerInput = screen.getByLabelText(/kicker jersey/i);
      fireEvent.change(kickerInput, { target: { value: '22' } });
      fireEvent.submit(kickerInput.closest('form'));
      fireEvent.click(screen.getByRole('button', { name: /^good/i }));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(within(summaryDialog).getByText(/jordan smith extra point good/i)).toBeInTheDocument();

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('try');
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    } finally {
      submitMock.restore();
    }
  });

  it('PAT rush and pass branches build summary without submitting', async () => {
    const { unmount } = renderScorer();

    startPatTypeSelection();
    fireEvent.click(within(screen.getByRole('dialog', { name: /pat type/i })).getByRole('button', { name: /^rush r$/i }));
    let playerInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(playerInput, { target: { value: '22' } });
    fireEvent.submit(playerInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^good/i }));
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/two-point rush by #22 jordan smith good/i);
    expect(screen.queryByText(/built event — not submitted/i)).not.toBeInTheDocument();
    unmount();

    renderScorer();
    startPatTypeSelection();
    fireEvent.click(within(screen.getByRole('dialog', { name: /pat type/i })).getByRole('button', { name: /^pass p$/i }));
    playerInput = screen.getByLabelText(/passer jersey/i);
    fireEvent.change(playerInput, { target: { value: '12' } });
    fireEvent.submit(playerInput.closest('form'));
    const receiverInput = screen.getByLabelText(/receiver jersey/i);
    fireEvent.change(receiverInput, { target: { value: '88' } });
    fireEvent.submit(receiverInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^good/i }));
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/two-point pass from #12 mason reed to #88 eli grant good/i);
    expect(screen.queryByText(/built event — not submitted/i)).not.toBeInTheDocument();
  });

  it('shows punt kick receive result choices with scoped hotkey badges', () => {
    renderScorer();

    startPuntReceiveResultSelection();

    PUNT_RECEIVE_BUTTON_EXPECTATIONS.forEach(([label, hotkey]) => {
      const button = screen.getByRole('button', { name: new RegExp(`^${label} ${hotkey}$`, 'i') });
      expect(within(button).getByText(hotkey)).toBeInTheDocument();
    });
    expect(screen.getByText(/T means Touchback and C means Fair Catch here/i)).toBeInTheDocument();
  });

  it('collects a punt blocker and removes Blocked from the second result screen', () => {
    renderScorer();
    startPuntReceiveResultSelection();
    fireEvent.click(screen.getByRole('button', { name: /^blocked b$/i }));
    const blockerInput = screen.getByLabelText(/blocked by jersey/i);
    fireEvent.change(blockerInput, { target: { value: '44' } });
    fireEvent.submit(blockerInput.closest('form'));

    expect(screen.getByRole('dialog', { name: /kick receive result/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^blocked b$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^return r$/i })).toBeInTheDocument();
  });

  it('punt return tackle flow shows summary immediately and submits through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      completePuntReturnFlowInputs('T');

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(within(summaryDialog).getByText(/jordan smith punt 30 yards to the v26, #31 noah price return for 5 yards to the v31, tackled by #22 jordan smith/i)).toBeInTheDocument();

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('punt');
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    } finally {
      submitMock.restore();
    }
  });

  it('asks for the clock after a local punt changes possession and records both possession timestamps', async () => {
    renderScorer('/scorer?fixture=normal&local=1');
    completePuntReturnFlowInputs('T');

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

    const clockDialog = await screen.findByRole('dialog', { name: /change of possession clock/i });
    expect(clockDialog).not.toHaveTextContent(/home state.*visitor tech/i);
    const clockInput = within(clockDialog).getByLabelText('Game Clock');
    fireEvent.change(clockInput, { target: { value: '0801' } });
    expect(clockInput).toHaveValue('8:01');
    fireEvent.submit(clockInput.closest('form'));

    const shell = screen.getByTestId('scorer-layout-shell');
    const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
    const statsSlot = shell.querySelector('[data-scorer-slot="stats"]');
    const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
    await waitFor(() => expect(within(scoreboardSlot).getByText('8:01')).toBeInTheDocument());
    expect(within(statsSlot).getByText('3:59')).toBeInTheDocument();
    const driveStart = within(eventLogSlot).getByRole('separator', { name: 'Drive Start - Visitor Tech' });
    expect(driveStart).toHaveTextContent('8:01 at V31 by Punt');
    expect(screen.queryByRole('dialog', { name: /change of possession clock/i })).not.toBeInTheDocument();
  });

  it('prompts for a preselected clock after a touchdown, then runs the PAT from the try spot and respots for kickoff', async () => {
    renderScorer('/scorer?fixture=goalToGo&local=1');

    fireEvent.click(screen.getByRole('button', { name: /^rush/i }));
    const rusherInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(rusherInput, { target: { value: '31' } });
    fireEvent.submit(rusherInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^end of play/i }));
    const spotInput = screen.getByLabelText(/final ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'H00' } });
    fireEvent.submit(spotInput.closest('form'));

    let summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(summaryDialog).toHaveTextContent(/to the H goal line for a touchdown/i);
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));
    expect(screen.queryByRole('dialog', { name: /drive summary/i })).not.toBeInTheDocument();

    const clockDialog = await screen.findByRole('dialog', { name: /change of possession clock/i });
    const clockInput = within(clockDialog).getByLabelText('Game Clock');
    expect(clockInput).toHaveValue('1:32');
    await waitFor(() => {
      expect(clockInput.selectionStart).toBe(0);
      expect(clockInput.selectionEnd).toBe(4);
    });
    fireEvent.submit(clockInput.closest('form'));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /change of possession clock/i })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: /drive summary/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('H03').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Point After Try' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assistant: Press A to enter PAT Try.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    expect(screen.queryByRole('button', { name: 'Point After Try' })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog', { name: /pat type/i })).getByRole('button', { name: /^kick k$/i }));
    const kickerInput = screen.getByLabelText(/kicker jersey/i);
    fireEvent.change(kickerInput, { target: { value: '31' } });
    fireEvent.submit(kickerInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^good/i }));
    summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

    const driveSummary = await screen.findByRole('dialog', { name: /drive summary/i });
    expect(screen.queryByRole('button', { name: 'Point After Try' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assistant: Press A to enter PAT Try.')).not.toBeInTheDocument();
    expect(driveSummary).toHaveTextContent('Price 5 yard rush (Price Kick)');
    expect(driveSummary).toHaveTextContent('Start: 3:08 at V35 by Punt');
    expect(within(driveSummary).getByText('10')).toBeInTheDocument();
    expect(within(driveSummary).getByText('65')).toBeInTheDocument();
    expect(within(driveSummary).getByText('1:36')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('V35').length).toBeGreaterThan(0));
    expect(screen.queryByRole('dialog', { name: /change of possession clock/i })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByRole('dialog', { name: /drive summary/i })).not.toBeInTheDocument();
  });

  it('punt touchback and fair catch use kick receive meanings for T and C', async () => {
    const { unmount } = renderScorer();

    completePuntReceiveFlowInputs('T');
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/touchback/i);
    expect(screen.queryByLabelText(/returner jersey/i)).not.toBeInTheDocument();
    unmount();

    renderScorer();
    completePuntFairCatchFlowInputs();
    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(within(summaryDialog).getByText(/fair catch by #31 noah price/i)).toBeInTheDocument();
  });

  it('punt return fumble and lateral continue to their detail prompts', () => {
    const { unmount } = renderScorer();

    startPuntReturnTerminalSelection();
    fireEvent.click(screen.getByRole('button', { name: /^fumble/i }));
    expect(screen.getByRole('textbox', { name: /final spot/i })).toBeInTheDocument();
    unmount();

    renderScorer();
    startPuntReturnTerminalSelection();
    fireEvent.click(screen.getByRole('button', { name: /^lateral/i }));
    expect(screen.getByLabelText(/lateral to jersey/i)).toBeInTheDocument();
  });

  it('kickoff return tackle flow shows summary immediately and submits through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      completeKickoffReturnFlowInputs('T');

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(within(summaryDialog).getByText(/jordan smith kickoff .*#31 noah price return .*to the v31, tackled by #22 jordan smith/i)).toBeInTheDocument();

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('kickoff');
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    } finally {
      submitMock.restore();
    }
  });

  it('kickoff receive branches use kick receive meanings for T and C', async () => {
    const { unmount } = renderScorer();

    completeKickoffReceiveFlowInputs('T');
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toHaveTextContent(/touchback/i);
    expect(screen.queryByLabelText(/returner jersey/i)).not.toBeInTheDocument();
    unmount();

    renderScorer();
    completeKickoffFairCatchFlowInputs();
    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(within(summaryDialog).getByText(/fair catch by #31 noah price/i)).toBeInTheDocument();
  });

  it('kickoff out-of-bounds builds with no returner and muffed/downed continue to details', async () => {
    let rendered = renderScorer();

    completeKickoffReceiveFlowInputs('O');
    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(within(summaryDialog).getByText(/kickoff out-of-bounds at the v08, ball spotted at the v35/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/returner jersey/i)).not.toBeInTheDocument();
    rendered.unmount();

    rendered = renderScorer();
    startKickoffReceiveResultSelection();
    fireEvent.click(screen.getByRole('button', { name: /^muffed/i }));
    expect(screen.getByLabelText(/returner jersey/i)).toBeInTheDocument();
    rendered.unmount();

    rendered = renderScorer();
    startKickoffReceiveResultSelection();
    fireEvent.click(screen.getByRole('button', { name: /^downed/i }));
    const touchbackDecision = screen.getByRole('dialog', { name: 'Advance Ball To Touchback Spot?' });
    fireEvent.click(within(touchbackDecision).getByRole('button', { name: /keep downed spot/i }));
    expect(screen.getByLabelText(/downing player jersey/i)).toBeInTheDocument();
  });

  it('kickoff return fumble and lateral continue to their detail prompts', () => {
    const { unmount } = renderScorer();

    startKickoffReturnTerminalSelection();
    fireEvent.click(screen.getByRole('button', { name: /^fumble/i }));
    expect(screen.getByRole('textbox', { name: /final spot/i })).toBeInTheDocument();
    unmount();

    renderScorer();
    startKickoffReturnTerminalSelection();
    fireEvent.click(screen.getByRole('button', { name: /^lateral/i }));
    expect(screen.getByLabelText(/lateral to jersey/i)).toBeInTheDocument();
  });

  it('keeps the play summary visible for an unresolved queued penalty and advances to penalty entry on Enter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();

      fireEvent.click(screen.getByRole('button', { name: /rush/i }));
      const jerseyInput = screen.getByLabelText(/rusher jersey/i);
      fireEvent.change(jerseyInput, { target: { value: '22' } });
      fireEvent.submit(jerseyInput.closest('form'));

      const assistant = screen.getByTestId('football-input-assistant');
      expect(assistant).not.toHaveClass('bg-yellow-100');

      fireEvent.keyDown(window, { key: 'E', code: 'KeyE', shiftKey: true });
      expect(screen.getAllByText('Penalty queued — resolve before submitting').length).toBeGreaterThan(0);
      expect(assistant).toHaveClass('bg-yellow-100');
      const queuedFlowDialog = screen.getByRole('dialog', { name: /rush result/i });
      expect(queuedFlowDialog).toHaveClass('border-amber-400', 'bg-amber-50');
      expect(within(queuedFlowDialog).getByText('Shift+E for Flag on the Play')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));
      const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
      fireEvent.change(tacklerInput, { target: { value: '44' } });
      fireEvent.submit(tacklerInput.closest('form'));

      const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
      fireEvent.change(secondTacklerInput, { target: { value: '' } });
      fireEvent.submit(secondTacklerInput.closest('form'));

      const spotInput = screen.getByLabelText(/final ball spot/i);
      fireEvent.change(spotInput, { target: { value: 'V49' } });
      fireEvent.submit(spotInput.closest('form'));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(summaryDialog).toHaveTextContent(/jordan smith rush for 7 yards/i);
      expect(summaryDialog).toHaveClass('border-amber-400', 'bg-amber-50');
      expect(within(summaryDialog).getByText('Penalty queued — resolve before submitting')).toBeInTheDocument();
      const enterPenaltyButton = within(summaryDialog).getByRole('button', { name: /^enter penalty$/i });
      expect(enterPenaltyButton).toBeEnabled();
      expect(enterPenaltyButton).toHaveClass('bg-amber-100');
      const submitButton = within(summaryDialog).getByRole('button', { name: /^submit play$/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveClass('bg-zinc-200');
      expect(submitButton).toHaveClass('border-zinc-300');
      expect(submitButton).toHaveClass('text-zinc-500');
      expect(submitButton).toHaveClass('cursor-not-allowed');
      expect(submitButton).not.toHaveClass('bg-emerald-700');
      expect(submitButton).toHaveAttribute('title', 'Resolve queued penalty before submitting');
      expect(assistant).toHaveClass('bg-yellow-100');
      expect(screen.queryByText(/built event — not submitted/i)).not.toBeInTheDocument();

      fireEvent.click(submitButton);
      fireEvent.keyDown(summaryDialog, { key: 'Enter', code: 'Enter' });
      expect(submitMock.fetchSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: /^penalty$/i })).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('resolves a queued declined penalty from the summary and clears the warning', async () => {
    renderScorer();

    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.submit(jerseyInput.closest('form'));

    const assistant = screen.getByTestId('football-input-assistant');
    fireEvent.keyDown(window, { key: 'E', code: 'KeyE', shiftKey: true });
    expect(assistant).toHaveClass('bg-yellow-100');

    fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '44' } });
    fireEvent.submit(tacklerInput.closest('form'));
    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '' } });
    fireEvent.submit(secondTacklerInput.closest('form'));
    const spotInput = screen.getByLabelText(/final ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'V49' } });
    fireEvent.submit(spotInput.closest('form'));

    const unresolvedSummary = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(unresolvedSummary).toHaveTextContent(/jordan smith rush for 7 yards/i);
    expect(within(unresolvedSummary).getByRole('button', { name: /^submit play$/i })).toBeDisabled();
    fireEvent.click(within(unresolvedSummary).getByRole('button', { name: /^enter penalty$/i }));
    expect(screen.getByRole('dialog', { name: /^penalty$/i })).toBeInTheDocument();

    const penaltyNameInput = screen.getByPlaceholderText(/hold or holding/i);
    fireEvent.change(penaltyNameInput, { target: { value: 'Holding' } });
    fireEvent.submit(penaltyNameInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^home state h$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^declined d$/i }));

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(summaryDialog).toHaveTextContent(/jordan smith rush for 7 yards/i);
    expect(summaryDialog).toHaveTextContent(/penalty holding/i);
    expect(summaryDialog).toHaveTextContent(/declined/i);
    const resolvedSubmitButton = within(summaryDialog).getByRole('button', { name: /^submit play$/i });
    expect(resolvedSubmitButton).toBeEnabled();
    expect(resolvedSubmitButton).toHaveClass('bg-emerald-700');
    expect(screen.queryByText('Penalty queued — resolve before submitting')).not.toBeInTheDocument();
    expect(assistant).not.toHaveClass('bg-yellow-100');
  });

  it('starts immediate penalty from E and submits a penalty-only request through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
      expect(screen.getByRole('dialog', { name: /^penalty$/i })).toBeInTheDocument();

      const penaltyNameInput = screen.getByPlaceholderText(/hold or holding/i);
      fireEvent.change(penaltyNameInput, { target: { value: 'Offside' } });
      fireEvent.submit(penaltyNameInput.closest('form'));
      fireEvent.click(screen.getByRole('button', { name: /^visitor tech v$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^accepted a$/i }));

      const playerInput = screen.getByLabelText(/penalized player/i);
      fireEvent.change(playerInput, { target: { value: '' } });
      fireEvent.submit(playerInput.closest('form'));

      expect(screen.queryByLabelText(/^yards$/i)).not.toBeInTheDocument();

      const finalSpotDialog = screen.getByRole('dialog', { name: /penalty final spot/i });
      const finalSpotInput = within(finalSpotDialog).getByLabelText(/^final spot$/i);
      expect(finalSpotInput).toHaveValue('H49');
      fireEvent.change(finalSpotInput, { target: { value: 'H48' } });
      fireEvent.submit(finalSpotInput.closest('form'));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(summaryDialog).toHaveTextContent(/penalty: offsides on vis/i);
      expect(summaryDialog).toHaveTextContent(/4 yards/i);
      expect(summaryDialog).toHaveTextContent(/from the previous spot/i);

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      const request = submittedRequest(submitMock.fetchSpy);
      expect(request.event.type).toBe('penalty');
      expect(request.event.penalties[0]).toMatchObject({
        finalSpot: 'H48',
        yards: 4,
      });
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    } finally {
      submitMock.restore();
    }
  });

  it('prepopulates the penalty final-spot modal with defensive holding yardage', () => {
    renderScorer();

    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
    const penaltyNameInput = screen.getByPlaceholderText(/hold or holding/i);
    fireEvent.change(penaltyNameInput, { target: { value: 'Defensive Holding' } });
    fireEvent.submit(penaltyNameInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^visitor tech v$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^accepted a$/i }));

    const playerInput = screen.getByLabelText(/penalized player/i);
    fireEvent.change(playerInput, { target: { value: '' } });
    fireEvent.submit(playerInput.closest('form'));

    const finalSpotDialog = screen.getByRole('dialog', { name: /penalty final spot/i });
    expect(within(finalSpotDialog).getByLabelText(/^final spot$/i)).toHaveValue('V46');
  });

  it('shows the play summary immediately after completing the rush flow', async () => {
    renderScorer();

    completeRushFlowInputs();

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(within(summaryDialog).getByText(/jordan smith rush for 7 yards to the v49, tackled by #44 caleb moss/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review summary/i })).not.toBeInTheDocument();
    expect(within(summaryDialog).getByRole('button', { name: /^enter penalty$/i })).toBeInTheDocument();
    expect(within(summaryDialog).getByRole('button', { name: /^cancel play$/i })).toBeInTheDocument();
    expect(within(summaryDialog).getByRole('button', { name: /^edit play$/i })).toBeInTheDocument();
    expect(within(summaryDialog).getByRole('button', { name: /^submit play$/i })).toBeInTheDocument();
  });

  it('builds a canonical Rush touchdown when the confirmed end spot is goal', async () => {
    renderScorer();
    fireEvent.click(screen.getByRole('button', { name: /rush/i }));
    const jerseyInput = screen.getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.submit(jerseyInput.closest('form'));
    fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '44' } });
    fireEvent.submit(tacklerInput.closest('form'));
    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '' } });
    fireEvent.submit(secondTacklerInput.closest('form'));
    const spotInput = screen.getByLabelText(/final ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'goal' } });
    fireEvent.submit(spotInput.closest('form'));

    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    expect(within(summaryDialog).getByText(/jordan smith rush for 56 yards to the goal line for a touchdown/i)).toBeInTheDocument();
  });

  it('submit play calls the FCQI submit adapter once and clears the draft on success', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      completeRushFlowInputs();
      expect(await screen.findByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();
      expect(screen.getByText(/jordan smith rush for 7 yards to the v49, tackled by #44 caleb moss/i)).toBeInTheDocument();
      expect(submitMock.fetchSpy).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('rush');
      expect(submittedRequest(submitMock.fetchSpy).clientContext.clientEventId).toBe(
        submittedRequest(submitMock.fetchSpy).event.clientEventId,
      );
      expect(screen.queryByRole('dialog', { name: /play summary review/i })).not.toBeInTheDocument();
      expect(screen.getAllByText('Choose a play type.').length).toBeGreaterThan(0);
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents + 1);
    } finally {
      submitMock.restore();
    }
  });

  it('undoes the last event in a local test game and restores the prior log', async () => {
    renderScorer('/scorer?fixture=normal&local=1');
    const eventLogSlot = screen.getByTestId('scorer-layout-shell').querySelector('[data-scorer-slot="event-log"]');
    const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;
    const undoButton = within(eventLogSlot).getByRole('button', { name: /undo last test event/i });
    expect(undoButton).toBeDisabled();

    completeRushFlowInputs();
    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

    expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
    expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents + 1);
    expect(undoButton).toBeEnabled();

    fireEvent.click(undoButton);

    expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents);
    expect(undoButton).toBeDisabled();
    expect(screen.queryByText('Submitted play.')).not.toBeInTheDocument();
  });

  it('populates the visible team stats after a local rush is submitted', async () => {
    renderScorer('/scorer?fixture=normal&local=1');
    const statsSlot = screen.getByTestId('scorer-layout-shell').querySelector('[data-scorer-slot="stats"]');

    completeRushFlowInputs();
    const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
    fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

    const rushingRow = within(statsSlot).getByText('Rushing').closest('tr');
    await waitFor(() => expect(within(rushingRow).getByText('1 for 7 yards')).toBeInTheDocument());
  });

  it('returned gameEnvelope updates the active scoreboard and event log after submit', async () => {
    const submitMock = mockSubmitSuccess((request) => {
      const { envelope, acceptedEvent } = makeReturnedEnvelope(request);
      return { acceptedEvent, gameEnvelope: envelope };
    });

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');

      expect(within(scoreboardSlot).getByText('8:42')).toBeInTheDocument();
      expect(within(eventLogSlot).queryByText(/backend accepted rush/i)).not.toBeInTheDocument();

      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(within(scoreboardSlot).getByText('8:01')).toBeInTheDocument();
        expect(within(scoreboardSlot).getByText('1 and 10')).toBeInTheDocument();
        expect(within(scoreboardSlot).getByText('V35')).toBeInTheDocument();
      });
      expect(within(eventLogSlot).getByText(/backend accepted rush for 9 yards/i)).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('replaces scorer state with the authoritative defensive-fumble recovery envelope', async () => {
    const submitMock = mockSubmitSuccess((request) => {
      const payload = makeCanonicalSubmitSuccess(request);
      payload.gameEnvelope.liveState = {
        possession: 'V', down: 1, distance: 10, yardLine: 'H49', lineToGain: 'H39',
        goalToGo: false, redZone: false, driveId: 'DRV-0003', driveNumber: 3,
        nextPlayContext: 'V,1,10,H49',
      };
      const { nextPlayContext: _ignored, ...postState } = payload.gameEnvelope.liveState;
      payload.acceptedEvent.postState = postState;
      payload.gameEnvelope.events[payload.gameEnvelope.events.length - 1] = payload.acceptedEvent;
      return payload;
    });

    try {
      renderScorer();
      fireEvent.click(screen.getByRole('button', { name: /rush/i }));
      submitTextToken(/rusher jersey/i, '22');
      fireEvent.click(screen.getByRole('button', { name: /^fumble/i }));
      submitTextToken(/forced by jersey/i, '44');
      submitTextToken(/recovering team/i, 'V');
      submitTextToken(/recovery player jersey/i, '4');
      submitTextToken(/recovery spot/i, 'H49');
      fireEvent.click(screen.getByRole('button', { name: /^no return n$/i }));

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(summaryDialog).toHaveTextContent(/recovered by #4 andre cole for vis at the h49/i);
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      const scoreboardSlot = screen.getByTestId('scorer-layout-shell').querySelector('[data-scorer-slot="scoreboard"]');
      await waitFor(() => {
        expect(within(scoreboardSlot).getByText('1 and 10')).toBeInTheDocument();
        expect(within(scoreboardSlot).getByText('H49')).toBeInTheDocument();
      });
      expect(submittedRequest(submitMock.fetchSpy).event.result.fumble).toMatchObject({
        recoveredByPlayerId: 'V-04', recoveredByTeam: 'V', turnover: true,
      });
    } finally {
      submitMock.restore();
    }
  });

  it('canonical Rush rejects a legacy projection alias and retains the draft', async () => {
    const submitMock = mockSubmitSuccess({
      projection: {
        liveState: { down: 3, distance: 2, yardLine: 'V12' },
      },
    });

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect(await screen.findByText(/cannot use legacy alias projection/i)).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('2 and 6')).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('H44')).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('canonical Rush rejects acceptedEvent-only responses and retains the draft', async () => {
    const submitMock = mockSubmitSuccess({
      acceptedEvent: {
        eventId: 'EVT-LOCAL-ONLY',
        clientEventId: 'fcqi-local-only',
        sequence: 13,
        type: 'rush',
        period: 1,
        clock: '08:42',
        possession: 'H',
        description: 'Accepted event only from backend.',
      },
      gameEnvelope: null,
    });

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect(await screen.findByText(/response envelope fields are malformed/i)).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('8:42')).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('2 and 6')).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('H44')).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('guards duplicate submit clicks while a request is pending', async () => {
    const originalFetch = globalThis.fetch;
    let resolveSubmit;
    const fetchSpy = vi.fn(() => new Promise((resolve) => {
      resolveSubmit = resolve;
    }));
    globalThis.fetch = fetchSpy;

    try {
      renderScorer();
      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      const submitButton = within(summaryDialog).getByRole('button', { name: /^submit play$/i });

      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      expect(await screen.findByRole('button', { name: /^submitting/i })).toBeDisabled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(fetchSpy).clientContext.clientEventId).toBe(
        submittedRequest(fetchSpy).event.clientEventId,
      );

      const payload = makeCanonicalSubmitSuccess(submittedRequest(fetchSpy));
      resolveSubmit({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      });

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps the draft editable and displays a submit error when canonical submit fails', async () => {
    const submitMock = mockSubmitFailure();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderScorer();
      const scoreboardSlot = screen
        .getByTestId('scorer-layout-shell')
        .querySelector('[data-scorer-slot="scoreboard"]');
      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect(await screen.findByText('Football submit failed with HTTP 409: Submitted baseEventSequence is stale.')).toBeInTheDocument();
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[fcqi-submit] failed', expect.objectContaining({
        status: 409,
        statusText: 'Conflict',
        clientEventId: expect.any(String),
        gameId: expect.any(String),
        eventType: 'rush',
        eventSubtype: null,
        responseText: expect.stringContaining('Submitted baseEventSequence is stale.'),
        responseJson: expect.objectContaining({
          status: 'rejected',
          errors: expect.any(Array),
        }),
        requestSummary: expect.objectContaining({
          event: expect.objectContaining({ type: 'rush' }),
        }),
      }));
      expect(screen.getByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^edit play$/i })).toBeEnabled();
      expect(within(scoreboardSlot).getByText('8:42')).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('2 and 6')).toBeInTheDocument();
      expect(within(scoreboardSlot).getByText('H44')).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
      submitMock.restore();
    }
  });

  it('surfaces backend submit error details from HTTP 500 responses', async () => {
    const submitMock = mockSubmitFailure({
      status: 500,
      statusText: 'Internal Server Error',
      body: {
        success: false,
        error: 'Missing event.type',
        details: { field: 'event.type' },
        traceId: 'trace-500',
        warnings: [],
      },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderScorer();
      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect(await screen.findByText('Football submit failed with HTTP 500: Missing event.type')).toBeInTheDocument();
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[fcqi-submit] failed', expect.objectContaining({
        status: 500,
        statusText: 'Internal Server Error',
        clientEventId: expect.any(String),
        gameId: expect.any(String),
        eventType: 'rush',
        eventSubtype: null,
        responseText: expect.stringContaining('Missing event.type'),
        responseJson: expect.objectContaining({
          status: 'rejected',
          errors: [expect.objectContaining({ message: 'Missing event.type', field: 'event.type' })],
        }),
        requestSummary: expect.objectContaining({
          event: expect.objectContaining({ type: 'rush' }),
        }),
      }));
      expect(screen.getByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^edit play$/i })).toBeEnabled();
    } finally {
      consoleError.mockRestore();
      submitMock.restore();
    }
  });

  it('complete pass flow shows summary immediately and submits through the adapter', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      const shell = screen.getByTestId('scorer-layout-shell');
      const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
      const initialEvents = within(eventLogSlot).getAllByRole('listitem').length;

      completePassFlowInputs();

      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(within(summaryDialog).getByText(/mason reed pass complete to #88 eli grant for 7 yards to the v49, tackled by #44 caleb moss/i)).toBeInTheDocument();
      expect(within(summaryDialog).getByRole('button', { name: /^submit play$/i })).toBeInTheDocument();

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.type).toBe('pass');
      expect(submittedRequest(submitMock.fetchSpy).event.result).toMatchObject({
        yards: 7,
        endYardLine: 'V49',
        pass: { terminalYardLine: 'V49' },
      });
      expect(within(eventLogSlot).getAllByRole('listitem')).toHaveLength(initialEvents + 1);
    } finally {
      submitMock.restore();
    }
  });

  it('retains and selects the last submitted passer so typing replaces the default', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();
      completePassFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });
      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^submit play$/i }));
      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: /^pass/i }));
      const passerInput = screen.getByLabelText(/passer jersey/i);
      await waitFor(() => {
        expect(passerInput).toHaveValue('12');
        expect(passerInput.selectionStart).toBe(0);
        expect(passerInput.selectionEnd).toBe(2);
      });

      fireEvent.submit(passerInput.closest('form'));
      expect(screen.getByRole('dialog', { name: /pass result/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /cancel quick input/i }));

      fireEvent.click(screen.getByRole('button', { name: /^pass/i }));
      const replacementInput = screen.getByLabelText(/passer jersey/i);
      await waitFor(() => {
        expect(replacementInput).toHaveValue('12');
        expect(replacementInput.selectionStart).toBe(0);
        expect(replacementInput.selectionEnd).toBe(2);
      });

      fireEvent.change(replacementInput, { target: { value: '22' } });
      expect(replacementInput).toHaveValue('22');
      fireEvent.submit(replacementInput.closest('form'));
      expect(screen.getByRole('dialog', { name: /pass result/i })).toBeInTheDocument();
    } finally {
      submitMock.restore();
    }
  });

  it('cancel play clears the draft and returns to play selection', async () => {
    renderScorer();

    completeRushFlowInputs();
    expect(await screen.findByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel play$/i }));

    expect(screen.queryByRole('dialog', { name: /play summary review/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('Choose a play type.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/jordan smith rush for 7 yards/i)).not.toBeInTheDocument();
  });

  it('edit play returns to the editable rush flow without submitting', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    try {
      renderScorer();

      completeRushFlowInputs();
      expect(await screen.findByRole('dialog', { name: /play summary review/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^edit play$/i }));

      expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^tackle/i })).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.queryByText(/built event — not submitted/i)).not.toBeInTheDocument();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('submits a Rush with its resolved queued penalty', async () => {
    const submitMock = mockSubmitSuccess();

    try {
      renderScorer();

      completeRushFlowInputs();
      const summaryDialog = await screen.findByRole('dialog', { name: /play summary review/i });

      fireEvent.click(within(summaryDialog).getByRole('button', { name: /^enter penalty$/i }));

      expect(screen.getByRole('dialog', { name: /^penalty$/i })).toBeInTheDocument();
      const penaltyNameInput = screen.getByPlaceholderText(/hold or holding/i);
      fireEvent.change(penaltyNameInput, { target: { value: 'Holding' } });
      fireEvent.submit(penaltyNameInput.closest('form'));
      fireEvent.click(screen.getByRole('button', { name: /^home state h$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^accepted a$/i }));

      const playerInput = screen.getByLabelText(/penalized player/i);
      fireEvent.change(playerInput, { target: { value: '' } });
      fireEvent.submit(playerInput.closest('form'));
      expect(screen.queryByLabelText(/^yards$/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^spot of foul f$/i }));

      const spotOfFoulDialog = screen.getByRole('dialog', { name: /^spot of foul$/i });
      const spotOfFoulInput = within(spotOfFoulDialog).getByLabelText(/^spot of foul$/i);
      fireEvent.change(spotOfFoulInput, { target: { value: 'V45' } });
      fireEvent.submit(spotOfFoulInput.closest('form'));
      const finalSpotDialog = screen.getByRole('dialog', { name: /penalty final spot/i });
      const finalSpotInput = within(finalSpotDialog).getByLabelText(/^final spot$/i);
      fireEvent.change(finalSpotInput, { target: { value: 'H45' } });
      fireEvent.submit(finalSpotInput.closest('form'));
      fireEvent.click(screen.getByRole('button', { name: /^repeat down r$/i }));

      const updatedSummary = await screen.findByRole('dialog', { name: /play summary review/i });
      expect(updatedSummary).toHaveTextContent(/jordan smith rush for 7 yards/i);
      expect(updatedSummary).toHaveTextContent(/penalty holding, enforced 10 yards from the v45 to the h45/i);

      expect(submitMock.fetchSpy).not.toHaveBeenCalled();
      fireEvent.click(within(updatedSummary).getByRole('button', { name: /^submit play$/i }));

      expect((await screen.findAllByText('Submitted play.')).length).toBeGreaterThan(0);
      expect(submitMock.fetchSpy).toHaveBeenCalledTimes(1);
      expect(submittedRequest(submitMock.fetchSpy).event.penalties).toEqual([expect.objectContaining({
        code: 'HOLD',
        team: 'H',
        status: 'accepted',
        enforcedFrom: 'spotOfFoul',
        spotOfFoul: 'V45',
        finalSpot: 'H45',
        replayDown: true,
      })]);
    } finally {
      submitMock.restore();
    }
  });

  it('renders the report route without football providers', () => {
    renderScorer('/reports?fixture=final');

    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByText(/FB-FINAL/)).toBeInTheDocument();
    expect(screen.getByText('Report Workspace')).toBeInTheDocument();
  });

  it('shows a route error for an unknown fixture key', () => {
    renderScorer('/scorer?fixture=missing');

    expect(screen.getByRole('heading', { name: /fixture not found/i })).toBeInTheDocument();
    expect(screen.getByText(/No fixture envelope exists/)).toBeInTheDocument();
  });

  it('renders the bottom debug trace panel when debug mode is enabled', () => {
    renderScorer('/scorer?fixture=goalToGo&debug=1');

    const panel = screen.getByLabelText(/football debug trace/i);
    expect(within(panel).getByRole('heading', { name: /debug trace/i })).toBeInTheDocument();
    expect(within(panel).getByText(/pre-play state read/i)).toBeInTheDocument();
    expect(within(panel).getByText(/possession-relative yard math/i)).toBeInTheDocument();
    expect(within(panel).getByText(/goal-to-go checks/i)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /copy session/i })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /export json/i })).toBeInTheDocument();
    expect(within(panel).getAllByRole('button', { name: /copy play/i }).length).toBeGreaterThan(0);
  });

  it('emits structured trace entries for key rule and submit checks', () => {
    const entries = buildFootballFixtureDebugTrace(gameEnvelopeFixtures.kickoffDrive);
    const checkNames = entries.map((entry) => entry.checkName);

    expect(checkNames).toContain('pre-play state read');
    expect(checkNames).toContain('possession normalization');
    expect(checkNames).toContain('yard-line parsing');
    expect(checkNames).toContain('possession-relative yard math');
    expect(checkNames).toContain('yards gained');
    expect(checkNames).toContain('line-to-gain lookup');
    expect(checkNames).toContain('yards-to-gain');
    expect(checkNames).toContain('first-down checks');
    expect(checkNames).toContain('kickoff new-drive checks');
    expect(checkNames).toContain('drive start/end decisions');
    expect(checkNames).toContain('penalty accepted/declined/offsetting checks');
    expect(checkNames).toContain('backend submit request creation');
    expect(checkNames).toContain('backend accepted envelope response');
    expect(checkNames).toContain('duplicate clientEventId handling');
    expect(checkNames).toContain('stale sequence/conflict handling');

    expect(entries[0]).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        gameId: 'FB-KICKOFF-DRIVE',
        clientEventId: expect.any(String),
        category: expect.any(String),
        checkName: expect.any(String),
        inputSummary: expect.any(String),
        calculationDetails: expect.any(String),
        result: expect.any(String),
        reason: expect.any(String),
        severity: expect.stringMatching(/info|pass|warning|error/),
      }),
    );
  });
});

function startRushResultSelection() {
  fireEvent.click(screen.getByRole('button', { name: /rush/i }));
  const jerseyInput = screen.getByLabelText(/rusher jersey/i);
  fireEvent.change(jerseyInput, { target: { value: '22' } });
  fireEvent.submit(jerseyInput.closest('form'));
  expect(screen.getByRole('dialog', { name: /rush result/i })).toBeInTheDocument();
}

function assertGameControlMenu() {
  const dialog = screen.getByRole('dialog', { name: /^game control$/i });
  expect(within(dialog).queryByLabelText(/fcqi flow progress/i)).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  [
    ['Emergency Clock Stop', 'E'],
    ['Quarter Functions', 'Q'],
    ['Set Clock', 'K'],
    ['Timeout', 'T'],
    ['Challenge', 'C'],
    ['Ball Context', 'B'],
    ['Drive Start', 'D'],
    ['Set Possession', 'P'],
    ['Edit Penalties', 'F'],
    ['Starters', 'R'],
  ].forEach(([label, hotkey]) => {
    const button = within(dialog).getByRole('button', { name: new RegExp(`^${label} ${hotkey}$`, 'i') });
    expect(within(button).getByText(hotkey)).toBeInTheDocument();
  });
  expect(within(dialog).queryByRole('button', { name: /coin toss/i })).not.toBeInTheDocument();
}

function currentFlowProgress() {
  return within(screen.getByRole('dialog')).getByLabelText(/fcqi flow progress/i);
}

function startPassResultSelection() {
  fireEvent.click(screen.getByRole('button', { name: /^pass/i }));
  const passerInput = screen.getByLabelText(/passer jersey/i);
  fireEvent.change(passerInput, { target: { value: '12' } });
  fireEvent.submit(passerInput.closest('form'));
  expect(screen.getByRole('dialog', { name: /pass result/i })).toBeInTheDocument();
}

function completeRushFlowInputs() {
  fireEvent.click(screen.getByRole('button', { name: /rush/i }));
  const jerseyInput = screen.getByLabelText(/rusher jersey/i);
  fireEvent.change(jerseyInput, { target: { value: '22' } });
  fireEvent.submit(jerseyInput.closest('form'));

  fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));
  const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
  fireEvent.change(tacklerInput, { target: { value: '44' } });
  fireEvent.submit(tacklerInput.closest('form'));

  const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
  fireEvent.change(secondTacklerInput, { target: { value: '' } });
  fireEvent.submit(secondTacklerInput.closest('form'));

  const spotInput = screen.getByLabelText(/final ball spot/i);
  fireEvent.change(spotInput, { target: { value: 'V49' } });
  fireEvent.submit(spotInput.closest('form'));
}

function submitTextToken(label, value) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form'));
}

function completePassFlowInputs() {
  fireEvent.click(screen.getByRole('button', { name: /^pass/i }));
  const passerInput = screen.getByLabelText(/passer jersey/i);
  fireEvent.change(passerInput, { target: { value: '12' } });
  fireEvent.submit(passerInput.closest('form'));

  fireEvent.click(screen.getByRole('button', { name: /^complete/i }));

  const receiverInput = screen.getByLabelText(/receiver jersey/i);
  fireEvent.change(receiverInput, { target: { value: '88' } });
  fireEvent.submit(receiverInput.closest('form'));

  const caughtAtInput = screen.getByLabelText(/caught at yardline/i);
  fireEvent.change(caughtAtInput, { target: { value: '' } });
  fireEvent.submit(caughtAtInput.closest('form'));

  fireEvent.click(screen.getByRole('button', { name: /^tackle/i }));

  const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
  fireEvent.change(tacklerInput, { target: { value: '44' } });
  fireEvent.submit(tacklerInput.closest('form'));

  const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
  fireEvent.change(secondTacklerInput, { target: { value: '' } });
  fireEvent.submit(secondTacklerInput.closest('form'));

  const spotInput = screen.getByLabelText(/final ball spot/i);
  fireEvent.change(spotInput, { target: { value: 'V49' } });
  fireEvent.submit(spotInput.closest('form'));
}

function startPuntReceiveResultSelection() {
  fireEvent.click(screen.getByRole('button', { name: /^punt/i }));
  const punterInput = screen.getByLabelText(/punter jersey/i);
  fireEvent.change(punterInput, { target: { value: '22' } });
  fireEvent.submit(punterInput.closest('form'));

  const spotInput = screen.getByLabelText(/receive or dead-ball spot/i);
  fireEvent.change(spotInput, { target: { value: 'V26' } });
  fireEvent.submit(spotInput.closest('form'));

  expect(screen.getByRole('dialog', { name: /kick receive result/i })).toBeInTheDocument();
}

function startPuntReturnTerminalSelection() {
  startPuntReceiveResultSelection();
  fireEvent.click(screen.getByRole('button', { name: /^return/i }));

  const returnerInput = screen.getByLabelText(/returner jersey/i);
  fireEvent.change(returnerInput, { target: { value: '31' } });
  fireEvent.submit(returnerInput.closest('form'));

  expect(screen.getByRole('dialog', { name: /return result/i })).toBeInTheDocument();
}

function completePuntReturnFlowInputs(terminalResult) {
  startPuntReturnTerminalSelection();
  const buttonName = terminalResult === 'T' ? /^tackle/i : terminalResult === 'O' ? /^out of bounds/i : /^end of play/i;
  fireEvent.click(screen.getByRole('button', { name: buttonName }));

  if (terminalResult === 'T') {
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '22' } });
    fireEvent.submit(tacklerInput.closest('form'));

    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '' } });
    fireEvent.submit(secondTacklerInput.closest('form'));
  } else if (terminalResult === 'O') {
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '' } });
    fireEvent.submit(tacklerInput.closest('form'));
  }

  const finalSpotDialog = screen.getByRole('dialog', { name: /return final spot/i });
  const spotInput = within(finalSpotDialog).getByLabelText(/^final spot$/i);
  fireEvent.change(spotInput, { target: { value: 'V31' } });
  fireEvent.submit(spotInput.closest('form'));
}

function completePuntReceiveFlowInputs(receiveResult) {
  startPuntReceiveResultSelection();
  const label = receiveResult === 'T' ? /^touchback/i : /^out of bounds/i;
  fireEvent.click(screen.getByRole('button', { name: label }));
}

function completePuntFairCatchFlowInputs() {
  startPuntReceiveResultSelection();
  fireEvent.click(screen.getByRole('button', { name: /^fair catch/i }));

  const returnerInput = screen.getByLabelText(/fair caught by/i);
  fireEvent.change(returnerInput, { target: { value: '31' } });
  fireEvent.submit(returnerInput.closest('form'));
}

function startKickoffReceiveResultSelection(kickedToSpot = 'V20') {
  fireEvent.click(screen.getByRole('button', { name: /^kick/i }));
  fireEvent.click(screen.getByRole('button', { name: /^kickoff \/ free kick/i }));

  const kickerInput = screen.getByLabelText(/kicker jersey/i);
  fireEvent.change(kickerInput, { target: { value: '22' } });
  fireEvent.submit(kickerInput.closest('form'));

  const kickedToInput = screen.getByLabelText(/kicked to spot/i);
  fireEvent.change(kickedToInput, { target: { value: kickedToSpot } });
  fireEvent.submit(kickedToInput.closest('form'));

  expect(screen.getByRole('dialog', { name: /kick receive result/i })).toBeInTheDocument();
}

function startKickoffReturnTerminalSelection() {
  startKickoffReceiveResultSelection();
  fireEvent.click(screen.getByRole('button', { name: /^return/i }));

  const returnerInput = screen.getByLabelText(/returner jersey/i);
  fireEvent.change(returnerInput, { target: { value: '31' } });
  fireEvent.submit(returnerInput.closest('form'));

  expect(screen.getByRole('dialog', { name: /return result/i })).toBeInTheDocument();
}

function completeKickoffReturnFlowInputs(terminalResult) {
  startKickoffReturnTerminalSelection();
  const buttonName = terminalResult === 'T' ? /^tackle/i : terminalResult === 'O' ? /^out of bounds/i : /^end of play/i;
  fireEvent.click(screen.getByRole('button', { name: buttonName }));

  if (terminalResult === 'T') {
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '22' } });
    fireEvent.submit(tacklerInput.closest('form'));

    const secondTacklerInput = screen.getByLabelText(/second tackler jersey/i);
    fireEvent.change(secondTacklerInput, { target: { value: '' } });
    fireEvent.submit(secondTacklerInput.closest('form'));
  } else if (terminalResult === 'O') {
    const tacklerInput = screen.getByLabelText(/^tackler jersey/i);
    fireEvent.change(tacklerInput, { target: { value: '' } });
    fireEvent.submit(tacklerInput.closest('form'));
  }

  const finalSpotDialog = screen.getByRole('dialog', { name: /return final spot/i });
  const spotInput = within(finalSpotDialog).getByLabelText(/^final spot$/i);
  fireEvent.change(spotInput, { target: { value: 'V31' } });
  fireEvent.submit(spotInput.closest('form'));
}

function completeKickoffReceiveFlowInputs(receiveResult) {
  startKickoffReceiveResultSelection(receiveResult === 'O' ? 'V08' : 'V20');
  const label = receiveResult === 'T' ? /^touchback/i : /^out of bounds/i;
  fireEvent.click(screen.getByRole('button', { name: label }));

  if (receiveResult === 'O') {
    expect(screen.getByRole('dialog', { name: /rekick or spot the ball/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^spot the ball/i }));
    const spotInput = screen.getByLabelText(/awarded ball spot/i);
    fireEvent.change(spotInput, { target: { value: 'V35' } });
    fireEvent.submit(spotInput.closest('form'));
  }
}

function completeKickoffFairCatchFlowInputs() {
  startKickoffReceiveResultSelection('V26');
  fireEvent.click(screen.getByRole('button', { name: /^fair catch/i }));

  const returnerInput = screen.getByLabelText(/returner jersey/i);
  fireEvent.change(returnerInput, { target: { value: '31' } });
  fireEvent.submit(returnerInput.closest('form'));

}

function startFieldGoalResultSelection() {
  fireEvent.click(screen.getByRole('button', { name: /^kick/i }));
  fireEvent.click(screen.getByRole('button', { name: /^field goal/i }));

  const kickerInput = screen.getByLabelText(/kicker jersey/i);
  fireEvent.change(kickerInput, { target: { value: '22' } });
  fireEvent.submit(kickerInput.closest('form'));

  const spotInput = screen.getByLabelText(/yardline kicked from/i);
  fireEvent.change(spotInput, { target: { value: 'V18' } });
  fireEvent.submit(spotInput.closest('form'));

  expect(screen.getByRole('dialog', { name: /field goal result/i })).toBeInTheDocument();
}

function startPatTypeSelection() {
  fireEvent.click(screen.getByRole('button', { name: /^kick/i }));
  fireEvent.click(screen.getByRole('button', { name: /^pat/i }));

  expect(screen.getByRole('dialog', { name: /pat type/i })).toBeInTheDocument();
}

const PASS_BUTTON_EXPECTATIONS = [
  ['Complete', 'C'],
  ['Incomplete', 'I'],
  ['Sack', 'S'],
  ['Sack Fumble', 'F'],
  ['Rush Conversion', 'R'],
  ['Intercepted', 'X'],
];

const PUNT_RECEIVE_BUTTON_EXPECTATIONS = [
  ['Return', 'R'],
  ['Touchback', 'T'],
  ['Fair Catch', 'C'],
  ['Out of Bounds', 'O'],
  ['Muffed', 'M'],
  ['Downed', 'D'],
  ['Blocked', 'B'],
];

const FIELD_GOAL_RESULT_BUTTON_EXPECTATIONS = [
  ['Good', 'G'],
  ['Missed', 'M'],
  ['Blocked', 'B'],
];

const PAT_TYPE_BUTTON_EXPECTATIONS = [
  ['Rush', 'R'],
  ['Pass', 'P'],
  ['Kick', 'K'],
];
