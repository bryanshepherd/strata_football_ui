import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGameEnvelopeFixture } from '../data/footballGameEnvelopeFixtures';
import { createCoinTossRecord } from '../pregame/footballPregame';
import {
  checksumFootballEnvelope,
  discardPendingFootballSyncForGame,
  enqueueFootballEnvelopeMirror,
  enqueueFootballServerSync,
  fetchFootballEnvelope,
  flushFootballServerSync,
  FOOTBALL_DASHBOARD_STORAGE_KEY,
  FOOTBALL_MIRROR_SOURCE_STORAGE_KEY,
  FOOTBALL_SYNC_QUEUE_STORAGE_KEY,
  getDashboardSeededFootballEnvelopeRecord,
  getPendingFootballSyncCount,
  migratePendingFootballSyncToEnvelopeMirror,
  normalizeFootballScoringSetupEnvelope,
  persistFootballPregameEnvelope,
  persistFootballWrapUpEnvelope,
  recordFootballPossessionClock,
  recoverFootballEnvelopeFromServer,
  saveDashboardSeededFootballEnvelope,
  submitFootballEventLocally,
} from './footballDashboardService';

const clone = (value) => JSON.parse(JSON.stringify(value));

const mirrorAck = (request) => ({
  schemaVersion: 'football.localEnvelopeMirrorAck.v1',
  status: 'mirrored',
  gameId: request.gameId,
  mirrorSourceId: request.mirrorSourceId,
  mirrorRevision: request.mirrorRevision,
  sourceEventSequence: request.sourceEventSequence,
  eventCount: request.eventCount,
  envelopeUpdatedAt: request.envelopeUpdatedAt,
  checksum: request.checksum,
});

const gameControlRequest = (eventId, action, fields = {}) => ({
  event: {
    schemaVersion: 'football.scoringEvent.v1',
    eventId,
    clientEventId: eventId,
    type: 'gameControl',
    subtype: action,
    period: 1,
    clock: '08:42',
    possession: 'H',
    result: {
      code: action === 'setClock' ? 'clockUpdate' : 'noPlay',
      gameControl: { action, ...fields },
    },
  },
  clientContext: { submittedAt: '2026-08-07T12:00:00.000Z' },
});

const playRequest = (envelope, clientEventId, event) => {
  const { nextPlayContext: _ignored, ...preState } = envelope.liveState;
  return {
    event: {
      clientEventId,
      period: envelope.clock.period,
      clock: envelope.clock.clock,
      possession: envelope.liveState.possession,
      preState,
      participants: { primary: null, secondary: null, defenders: [] },
      penalties: [],
      ...event,
    },
    clientContext: { submittedAt: '2026-08-07T12:00:00.000Z' },
  };
};

describe('local-first football persistence', () => {
  beforeEach(() => {
    window.localStorage.removeItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
    window.localStorage.removeItem(FOOTBALL_MIRROR_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY);
  });

  it('uses the stable cross-runtime checksum for complete envelopes', () => {
    expect(checksumFootballEnvelope({
      schemaVersion: 'football.gameEnvelope.v1',
      gameId: 'FB-CHECKSUM',
      updatedAt: '2026-08-25T04:00:00.000Z',
      events: [],
    })).toBe('fnv1a64:a8b63cf28ee37641:118');
  });

  it('creates a durable browser record when the initial envelope came from the server', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-SERVER-SEED-001';
    envelope.rosters.gameId = envelope.gameId;

    const stored = saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    const record = getDashboardSeededFootballEnvelopeRecord(envelope.gameId);

    expect(stored.gameId).toBe(envelope.gameId);
    expect(record.envelope.gameId).toBe(envelope.gameId);
    expect(record.envelope.game.teams.H.name).toBe(envelope.game.teams.H.name);
  });

  it('hydrates through the authenticated dashboard proxy and never from it again once local data exists', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-ENVELOPE-001';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => envelope,
    });

    const loaded = await fetchFootballEnvelope(envelope.gameId, {
      dashboardGameId: 'DASH-GAME-001',
      fetchImpl,
    });
    saveDashboardSeededFootballEnvelope(loaded.gameId, loaded);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/football/games/DASH-GAME-001/envelope',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.gameId).toBe(envelope.gameId);
  });

  it('rejects a fetched envelope whose identity does not match the requested game', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-DIFFERENT-GAME';

    await expect(fetchFootballEnvelope('FB-REQUESTED-GAME', {
      dashboardGameId: 'DASH-REQUESTED-GAME',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => envelope,
      }),
    })).rejects.toThrow('different game');
  });

  it('recovers explicitly from the server and discards only that game pending sync', async () => {
    const localEnvelope = clone(getGameEnvelopeFixture('normal'));
    localEnvelope.gameId = 'FB-EXPLICIT-RECOVERY';
    localEnvelope.rosters.gameId = localEnvelope.gameId;
    localEnvelope.game.teams.H.score = 26;
    saveDashboardSeededFootballEnvelope(localEnvelope.gameId, localEnvelope);
    enqueueFootballEnvelopeMirror({
      gameId: localEnvelope.gameId,
      dashboardGameId: 'DASH-EXPLICIT-RECOVERY',
      envelope: localEnvelope,
    });
    enqueueFootballServerSync({
      gameId: 'FB-OTHER-GAME',
      dashboardGameId: 'DASH-OTHER-GAME',
      kind: 'event',
      payload: { gameId: 'FB-OTHER-GAME', event: { clientEventId: 'other-event' } },
    });

    const serverEnvelope = clone(localEnvelope);
    serverEnvelope.game.status = 'final';
    serverEnvelope.game.teams.H.score = 60;
    serverEnvelope.game.teams.V.score = 39;
    serverEnvelope.events = Array.from({ length: 214 }, (_, index) => ({
      clientEventId: `server-event-${index + 1}`,
      eventId: `SERVER-${index + 1}`,
      sequence: index + 1,
      type: 'gameControl',
    }));
    serverEnvelope.stats.sourceEventSequence = 214;

    const recovered = await recoverFootballEnvelopeFromServer(localEnvelope.gameId, {
      dashboardGameId: 'DASH-EXPLICIT-RECOVERY',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => serverEnvelope,
      }),
    });

    expect(recovered.game.status).toBe('final');
    expect(recovered.game.teams.H.score).toBe(60);
    expect(getDashboardSeededFootballEnvelopeRecord(localEnvelope.gameId).envelope.events).toHaveLength(214);
    expect(getPendingFootballSyncCount(localEnvelope.gameId)).toBe(0);
    expect(getPendingFootballSyncCount('FB-OTHER-GAME')).toBe(1);
  });

  it('leaves the local envelope and pending sync intact when explicit recovery fails', async () => {
    const localEnvelope = clone(getGameEnvelopeFixture('normal'));
    localEnvelope.gameId = 'FB-FAILED-RECOVERY';
    localEnvelope.rosters.gameId = localEnvelope.gameId;
    localEnvelope.game.teams.H.score = 26;
    saveDashboardSeededFootballEnvelope(localEnvelope.gameId, localEnvelope);
    enqueueFootballEnvelopeMirror({
      gameId: localEnvelope.gameId,
      dashboardGameId: 'DASH-FAILED-RECOVERY',
      envelope: localEnvelope,
    });

    await expect(recoverFootballEnvelopeFromServer(localEnvelope.gameId, {
      dashboardGameId: 'DASH-FAILED-RECOVERY',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Server unavailable.' }),
      }),
    })).rejects.toThrow('Server unavailable');

    expect(getDashboardSeededFootballEnvelopeRecord(localEnvelope.gameId).envelope.game.teams.H.score).toBe(26);
    expect(getPendingFootballSyncCount(localEnvelope.gameId)).toBe(1);
    expect(discardPendingFootballSyncForGame('')).toBe(0);
  });

  it('normalizes numeric and team-alias rule spots at the API and local-state boundaries', async () => {
    const envelope = clone(getGameEnvelopeFixture('pregame'));
    envelope.gameId = 'FB-WVSU-FAIRMONT-001';
    envelope.game.teams.H = { ...envelope.game.teams.H, name: 'West Virginia St.', abbr: 'WVSU' };
    envelope.game.teams.V = { ...envelope.game.teams.V, name: 'Fairmont St.', abbr: 'FAIR' };
    envelope.operatorTeamAliases = { H: 'W', V: 'F' };
    envelope.game.rules = {
      ...envelope.game.rules,
      kickoffSpot: 35,
      touchbackSpot: 'F20',
      kickoffTouchbackSpot: 'W25',
      safetyKickSpot: { side: 'W', yard: 20 },
      patSpot: 3,
    };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => envelope });

    const loaded = await fetchFootballEnvelope(envelope.gameId, { fetchImpl });
    expect(loaded.game.rules).toMatchObject({
      kickoffSpot: 'H35',
      touchbackSpot: 'V20',
      kickoffTouchbackSpot: 'H25',
      patSpot: 'V03',
    });
    expect(loaded.game.rules).not.toHaveProperty('safetyKickSpot');
    expect(loaded.operatorTeamAliases).toEqual({ H: 'W', V: 'F' });

    window.localStorage.setItem(FOOTBALL_DASHBOARD_STORAGE_KEY, JSON.stringify({
      version: 1,
      games: { [envelope.gameId]: { gameId: envelope.gameId, envelope } },
    }));
    const local = getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope;
    expect(local.game.rules.kickoffSpot).toBe('H35');
    expect(local.game.rules.touchbackSpot).toBe('V20');
    expect(local.game.rules.safetyKickSpot).toBeUndefined();
    expect(local.operatorTeamAliases).toEqual({ H: 'W', V: 'F' });
  });

  it('saves pregame locally and queues the mirror without waiting for a server response', async () => {
    const envelope = clone(getGameEnvelopeFixture('pregame'));
    envelope.gameId = 'FB-PREGAME-LOCAL-001';

    const persisted = await persistFootballPregameEnvelope(envelope.gameId, envelope, {
      dashboardGameId: 'DASH-PREGAME-001',
    });

    expect(persisted.gameId).toBe(envelope.gameId);
    expect(getPendingFootballSyncCount(envelope.gameId)).toBe(1);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.pregame).toEqual(envelope.pregame);
  });

  it('saves the final game wrap-up locally and queues the complete envelope mirror', async () => {
    const envelope = clone(getGameEnvelopeFixture('final'));
    envelope.gameId = 'FB-WRAP-UP-LOCAL-001';
    envelope.game.wrapUp = {
      startedAt: '2026-08-25T23:04:00.000Z',
      endedAt: '2026-08-26T02:16:00.000Z',
      durationMinutes: 192,
      completedAt: '2026-08-26T02:20:00.000Z',
    };

    const persisted = await persistFootballWrapUpEnvelope(envelope.gameId, envelope, {
      dashboardGameId: 'DASH-WRAP-UP-001',
    });

    expect(persisted.game.wrapUp).toMatchObject({ durationMinutes: 192 });
    expect(getPendingFootballSyncCount(envelope.gameId)).toBe(1);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.game.wrapUp).toMatchObject({
      durationMinutes: 192,
      completedAt: '2026-08-26T02:20:00.000Z',
    });
  });

  it('treats a server response as acknowledgment only and keeps the local envelope authoritative', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-LOCAL-AUTHORITY-001';
    envelope.game.teams.H.score = 21;
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-LOCAL-AUTHORITY-001',
      envelope,
    });
    const fetchImpl = vi.fn().mockImplementation(async (_url, init) => {
      const request = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => mirrorAck(request) };
    });

    const result = await flushFootballServerSync({ fetchImpl });
    const local = getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope;

    expect(result).toMatchObject({ pendingCount: 0, syncedCount: 1, error: '' });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/football/games/DASH-LOCAL-AUTHORITY-001/mirror',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(local.game.teams.H.score).toBe(21);
    expect(getPendingFootballSyncCount(envelope.gameId)).toBe(0);
  });

  it('keeps a failed mirror request queued without changing the local envelope', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-OFFLINE-001';
    saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-OFFLINE-001',
      envelope,
    });

    const result = await flushFootballServerSync({
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    });

    expect(result).toMatchObject({ pendingCount: 1, syncedCount: 0, error: 'offline' });
    expect(getPendingFootballSyncCount(envelope.gameId)).toBe(1);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.liveState.yardLine).toBe(envelope.liveState.yardLine);
  });

  it('retries one same-source stale mirror conflict with newer metadata and the exact local envelope', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-STALE-MIRROR-001';
    envelope.events = [{ clientEventId: 'local-event-1', eventId: 'LOCAL-000001', sequence: 1, type: 'rush' }];
    envelope.stats.sourceEventSequence = 1;
    const saved = saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-STALE-MIRROR-001',
      envelope: saved,
    });
    const requests = [];
    const fetchImpl = vi.fn().mockImplementation(async (_url, init) => {
      const request = JSON.parse(init.body);
      requests.push(request);
      if (requests.length === 1) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            schemaVersion: 'football.localEnvelopeMirrorError.v1',
            code: 'MIRROR_CONFLICT',
            error: 'Football mirror revision is stale.',
            current: {
              gameId: request.gameId,
              mirrorSourceId: request.mirrorSourceId,
              mirrorRevision: 7,
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => mirrorAck(request) };
    });

    const result = await flushFootballServerSync({ fetchImpl });

    expect(result).toMatchObject({ pendingCount: 0, syncedCount: 1, error: '' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(requests[1]).toEqual({ ...requests[0], mirrorRevision: 8 });
    expect(requests[1].envelope).toEqual(saved);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope).toEqual(saved);

    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-STALE-MIRROR-001',
      envelope: saved,
    });
    const queued = JSON.parse(window.localStorage.getItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY));
    expect(queued.items[0].payload.mirrorRevision).toBe(9);
  });

  it('migrates a legacy nine-event queue into one exact envelope snapshot', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-LEGACY-MIGRATION-001';
    envelope.events = Array.from({ length: 9 }, (_, index) => ({
      clientEventId: `legacy-${index + 1}`,
      eventId: `LOCAL-${String(index + 1).padStart(6, '0')}`,
      sequence: index + 1,
      type: index === 5 ? 'punt' : 'rush',
      penalties: index === 8 ? [{ penaltyId: 'penalty-9', status: 'accepted' }] : [],
    }));
    envelope.stats.sourceEventSequence = 9;
    const saved = saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    envelope.events.forEach((event) => enqueueFootballServerSync({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-LEGACY-MIGRATION-001',
      kind: 'event',
      payload: { gameId: envelope.gameId, event },
    }));

    const migrated = migratePendingFootballSyncToEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-LEGACY-MIGRATION-001',
      envelope: saved,
    });
    const queue = JSON.parse(window.localStorage.getItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY));

    expect(migrated.kind).toBe('envelope');
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].payload.envelope.events).toEqual(saved.events);
    expect(queue.items[0].payload.sourceEventSequence).toBe(9);
    expect(queue.items[0].payload.checksum).toBe(checksumFootballEnvelope(saved));
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.events).toEqual(saved.events);
  });

  it('keeps a mirror queued when the server acknowledgment does not match it', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-ACK-MISMATCH-001';
    const saved = saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-ACK-MISMATCH-001',
      envelope: saved,
    });

    const result = await flushFootballServerSync({
      fetchImpl: vi.fn().mockImplementation(async (_url, init) => {
        const request = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ ...mirrorAck(request), checksum: 'wrong' }) };
      }),
    });

    expect(result).toMatchObject({ pendingCount: 1, syncedCount: 0 });
    expect(result.error).toContain('did not match');
    expect(getPendingFootballSyncCount(envelope.gameId)).toBe(1);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.events).toEqual(saved.events);
  });

  it('does not drop a newer local snapshot enqueued while an older mirror request is in flight', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-CONCURRENT-MIRROR-001';
    const first = saveDashboardSeededFootballEnvelope(envelope.gameId, envelope);
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-CONCURRENT-MIRROR-001',
      envelope: first,
    });
    let releaseFirst;
    const firstResponse = new Promise((resolve) => { releaseFirst = resolve; });
    const fetchImpl = vi.fn().mockImplementation(async (_url, init) => {
      const request = JSON.parse(init.body);
      if (request.mirrorRevision === 1) {
        await firstResponse;
      }
      return { ok: true, status: 200, json: async () => mirrorAck(request) };
    });

    const flushing = flushFootballServerSync({ fetchImpl });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const second = saveDashboardSeededFootballEnvelope(envelope.gameId, {
      ...first,
      events: [{ clientEventId: 'newer-event', eventId: 'LOCAL-000001', sequence: 1, type: 'punt' }],
      stats: { ...first.stats, sourceEventSequence: 1 },
    });
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-CONCURRENT-MIRROR-001',
      envelope: second,
    });
    releaseFirst();
    const result = await flushing;

    expect(result).toMatchObject({ pendingCount: 0, syncedCount: 2, error: '' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).envelope.events).toEqual(second.events);
    expect(getDashboardSeededFootballEnvelopeRecord(envelope.gameId).envelope.events).toEqual(second.events);
  });

  it('continues the stored mirror identity when recovering an envelope from the server', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.gameId = 'FB-MIRROR-RECOVERY-001';
    const recovered = await fetchFootballEnvelope(envelope.gameId, {
      dashboardGameId: 'DASH-MIRROR-RECOVERY-001',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => ({
            'X-Strata-Football-Mirror-Source': 'mirror-original-browser',
            'X-Strata-Football-Mirror-Revision': '7',
          }[name] || null),
        },
        json: async () => envelope,
      }),
    });
    enqueueFootballEnvelopeMirror({
      gameId: envelope.gameId,
      dashboardGameId: 'DASH-MIRROR-RECOVERY-001',
      envelope: recovered,
    });
    const queue = JSON.parse(window.localStorage.getItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY));

    expect(queue.items[0].payload.mirrorSourceId).toBe('mirror-original-browser');
    expect(queue.items[0].payload.mirrorRevision).toBe(8);
    expect(queue.items[0].payload.envelope).toEqual(envelope);
  });
});

describe('local football test-game projection', () => {
  it('rebuilds time of possession from all timed drives instead of retaining a partial imported total', () => {
    const envelope = clone(getGameEnvelopeFixture('secondQuarterRecovery'));
    envelope.stats.teams = {
      H: { timeOfPossession: 0 },
      V: { timeOfPossession: '01:36' },
    };

    const normalized = normalizeFootballScoringSetupEnvelope(envelope);

    expect(normalized.stats.teams.H.timeOfPossession).toBe(504);
    expect(normalized.stats.teams.V.timeOfPossession).toBe(396);
    expect(normalized.stats.teams.H.timeOfPossession + normalized.stats.teams.V.timeOfPossession).toBe(900);
    expect(normalized.stats.teams.H.possessionSegments).toHaveLength(4);
    expect(normalized.stats.teams.V.possessionSegments).toHaveLength(3);
    expect(normalized.stats.teams.H.possessionSegments[0]).toMatchObject({
      startPeriod: 1,
      startClock: '15:00',
      endClock: '13:32',
    });
    expect(normalized.stats.teams.H.possessionSegments[1]).toMatchObject({
      startPeriod: 1,
      startClock: '09:49',
      endClock: '08:09',
    });
    expect(normalized.stats.teams.V.possessionSegments[2]).toMatchObject({
      startPeriod: 1,
      startClock: '02:02',
      endClock: '00:35',
    });
    expect(normalized.stats.teams.H.possessionSegments.at(-1)).toEqual({
      startPeriod: 1,
      startClock: '00:35',
    });
  });

  it('credits elapsed kickoff time to the receiving team without changing the drive start clock', () => {
    const envelope = clone(getGameEnvelopeFixture('kickoffDrive'));
    envelope.stats.teams = {};

    const recorded = recordFootballPossessionClock(envelope, {
      previousPossession: null,
      nextPossession: 'V',
      period: 1,
      clock: '14:54',
    });

    expect(recorded.stats.teams.V.possessionSegments).toEqual([{
      startPeriod: 1,
      startClock: '15:00',
    }]);
    expect(recorded.drives.current).toMatchObject({
      team: 'V',
      startPeriod: 1,
      startClock: '14:54',
    });
  });

  it('repairs a stored kickoff drive reason when the kicking team recovered a return fumble', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.events = [
      {
        eventId: 'KO-FUMBLE-1',
        sequence: 1,
        status: 'accepted',
        type: 'kickoff',
        subtype: 'returned',
        period: 2,
        clock: '06:46',
        participants: {
          kicker: { playerId: 'H-36', team: 'H', role: 'kicker' },
          returner: { playerId: 'V-85', team: 'V', role: 'returner' },
        },
        result: {
          code: 'returned',
          endYardLine: 'V28',
          nextPossession: 'H',
          fumble: { turnover: true, recoveredByTeam: 'H', recoverySpot: 'V28' },
          turnover: { type: 'fumble', recoveredBy: 'H', spot: 'V28' },
        },
      },
      {
        eventId: 'KO-FUMBLE-DRIVE-PLAY-2',
        sequence: 2,
        status: 'accepted',
        type: 'rush',
        period: 2,
        clock: '06:38',
        possession: 'H',
        preState: {
          possession: 'H',
          down: 1,
          distance: 10,
          yardLine: 'V28',
          lineToGain: 'V18',
          driveId: 'DRV-0010',
          driveNumber: 10,
        },
        result: { code: 'tackle', yards: 2, endYardLine: 'V26' },
        penalties: [],
      },
    ];
    envelope.drives = {
      current: null,
      completed: [{
        driveId: 'DRV-0010',
        driveNumber: 10,
        team: 'H',
        startYardLine: 'V28',
        startReason: 'kickoff',
        plays: 3,
        yards: 28,
        result: 'touchdown',
      }],
    };

    const normalized = normalizeFootballScoringSetupEnvelope(envelope);

    expect(normalized.drives.completed[0].startReason).toBe('fumbleRecovery');
    expect(envelope.drives.completed[0].startReason).toBe('kickoff');
  });

  it('does not double-count an opponent drive between two kickoffs to the same receiving team', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.clock = { ...envelope.clock, period: 2, clock: '02:24' };
    envelope.events = [
      {
        eventId: 'KO-FUMBLE-1',
        status: 'accepted',
        type: 'kickoff',
        subtype: 'returned',
        period: 2,
        clock: '06:46',
        participants: {
          kicker: { playerId: 'H-36', team: 'H', role: 'kicker' },
          returner: { playerId: 'V-85', team: 'V', role: 'returner' },
        },
        result: {
          code: 'returned',
          nextPossession: 'H',
          fumble: { turnover: true, recoveredByTeam: 'H' },
          turnover: { type: 'fumble', recoveredBy: 'H' },
        },
      },
      {
        eventId: 'KO-NEXT-1',
        status: 'accepted',
        type: 'kickoff',
        subtype: 'returned',
        period: 2,
        clock: '05:41',
        participants: {
          kicker: { playerId: 'H-36', team: 'H', role: 'kicker' },
          returner: { playerId: 'V-85', team: 'V', role: 'returner' },
        },
        result: { code: 'returned', nextPossession: 'V' },
      },
    ];
    envelope.drives = {
      current: null,
      completed: [
        {
          driveId: 'DRV-H-FUMBLE-RECOVERY',
          team: 'H',
          startReason: 'fumbleRecovery',
          startPeriod: 2,
          startClock: '06:38',
          endPeriod: 2,
          endClock: '05:41',
        },
        {
          driveId: 'DRV-V-NEXT-KICKOFF',
          team: 'V',
          startReason: 'kickoff',
          startPeriod: 2,
          startClock: '05:39',
          endPeriod: 2,
          endClock: '02:24',
        },
      ],
    };
    envelope.stats.teams = {};

    const normalized = normalizeFootballScoringSetupEnvelope(envelope);

    expect(normalized.stats.teams.H.timeOfPossession).toBe(57);
    expect(normalized.stats.teams.H.possessionSegments).toEqual([{
      startPeriod: 2,
      startClock: '06:38',
      endPeriod: 2,
      endClock: '05:41',
    }]);
    expect(normalized.stats.teams.V.timeOfPossession).toBe(205);
    expect(normalized.stats.teams.V.possessionSegments).toEqual([
      {
        startPeriod: 2,
        startClock: '06:46',
        endPeriod: 2,
        endClock: '06:38',
      },
      {
        startPeriod: 2,
        startClock: '05:41',
        endPeriod: 2,
        endClock: '02:24',
      },
    ]);
    expect(
      normalized.stats.teams.H.timeOfPossession + normalized.stats.teams.V.timeOfPossession,
    ).toBe(262);
  });

  it('accepts an exact retry but rejects a reused client event ID for a different play', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    const firstRequest = playRequest(envelope, 'fcqi-rush-10-client', {
      type: 'rush',
      result: { code: 'tackle', yards: 3, endYardLine: 'H47' },
      description: 'First rush.',
    });
    const first = await submitFootballEventLocally(envelope, firstRequest);
    const retry = await submitFootballEventLocally(first.gameEnvelope, firstRequest);
    const conflictingRequest = playRequest(first.gameEnvelope, 'fcqi-rush-10-client', {
      type: 'rush',
      result: { code: 'touchdown', yards: 56, endYardLine: 'V00' },
      description: 'Different touchdown rush.',
    });
    const conflict = await submitFootballEventLocally(first.gameEnvelope, conflictingRequest);

    expect(first).toMatchObject({ ok: true, status: 'accepted' });
    expect(retry).toMatchObject({ ok: true, status: 'duplicateAccepted' });
    expect(retry.gameEnvelope.events).toHaveLength(first.gameEnvelope.events.length);
    expect(conflict).toMatchObject({
      ok: false,
      status: 'rejected',
      errors: [expect.objectContaining({ code: 'CLIENT_EVENT_ID_CONFLICT' })],
    });
    expect(conflict.gameEnvelope.events).toHaveLength(first.gameEnvelope.events.length);
  });

  it('accepts a clock correction and advances the event sequence', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    const response = await submitFootballEventLocally(
      envelope,
      gameControlRequest('LOCAL-CLOCK-1', 'setClock', { clock: '05:17', isRunning: false }),
    );

    expect(response.ok).toBe(true);
    expect(response.gameEnvelope.clock).toMatchObject({ clock: '05:17', clockTenths: 3170, isRunning: false });
    expect(response.acceptedEvent.status).toBe('accepted');
    expect(response.gameEnvelope.events.at(-1).eventId).toBe('LOCAL-CLOCK-1');
    expect(response.gameEnvelope.stats.sourceEventSequence).toBe(response.acceptedEvent.sequence);
  });

  it('records a timeout without losing it during a later possession correction', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    const timeout = await submitFootballEventLocally(
      envelope,
      gameControlRequest('LOCAL-TIMEOUT-1', 'timeout', {
        teamSide: 'H',
        clock: '06:34',
        isRunning: false,
      }),
    );
    const possession = await submitFootballEventLocally(
      timeout.gameEnvelope,
      gameControlRequest('LOCAL-POSSESSION-1', 'setPossession', { possession: 'V' }),
    );

    expect(timeout.gameEnvelope.liveState.timeouts).toEqual({ H: 2, V: 3 });
    expect(timeout.gameEnvelope.clock).toMatchObject({ clock: '06:34', clockTenths: 3940, isRunning: false });
    expect(possession.gameEnvelope.liveState.possession).toBe('V');
    expect(possession.gameEnvelope.liveState.timeouts).toEqual({ H: 2, V: 3 });
  });

  it('treats roughing-the-kicker enforcement as the final authority and suppresses the nullified punt', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = { ...envelope.liveState, down: 4 };
    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-RTK-PUNT-1', {
      type: 'punt',
      subtype: 'fairCatch',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'punter' },
        punter: { playerId: 'H-12', team: 'H', role: 'punter' },
        returner: { playerId: 'V-31', team: 'V', role: 'returner' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'fairCatch', kickYards: 36, endYardLine: 'V20', nextPossession: 'V', driveEnds: true },
      penalties: [{
        penaltyId: 'rtk-1', code: 'RTK', team: 'V', status: 'accepted', timing: 'liveBall', yards: 15,
        enforcedFrom: 'previousSpot', finalSpot: 'V41', automaticFirstDown: true, replayDown: true,
      }],
    }));

    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: 'H', down: 1, distance: 10, yardLine: 'V41', lineToGain: 'V31', driveId: 'DRV-0002',
    });
    expect(response.gameEnvelope.drives.current).toMatchObject({ driveId: 'DRV-0002', team: 'H' });
    expect(response.gameEnvelope.drives.completed).toHaveLength(0);
    expect(response.gameEnvelope.stats.teams.H?.punts?.num || 0).toBe(0);
    expect(response.gameEnvelope.stats.teams.H.firstDowns).toBe(1);
    expect(response.gameEnvelope.stats.teams.V.penalties).toMatchObject({ num: 1, yds: 15 });
  });

  it('repairs the active drive when set possession corrects an immediately-created empty drive', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.clock = { ...envelope.clock, period: 2, clock: '01:20' };
    envelope.game = { ...envelope.game, period: 2 };
    envelope.drives = {
      completed: [{ ...envelope.drives.current, result: 'punt', endPeriod: 2, endClock: '01:20' }],
      current: { driveId: 'DRV-0003', driveNumber: 3, team: 'V', startYardLine: 'V20', startReason: 'punt', plays: 0, yards: 0, result: null },
    };
    envelope.liveState = { ...envelope.liveState, possession: 'V', driveId: 'DRV-0003', driveNumber: 3, yardLine: 'V41' };
    const request = gameControlRequest('LOCAL-POSSESSION-REOPEN-1', 'setPossession', { possession: 'H' });
    request.event.period = 2;
    request.event.clock = '01:20';
    const response = await submitFootballEventLocally(envelope, request);

    expect(response.gameEnvelope.liveState).toMatchObject({ possession: 'H', down: 1, driveId: 'DRV-0002', driveNumber: 2 });
    expect(response.gameEnvelope.drives.current).toMatchObject({ driveId: 'DRV-0002', team: 'H', result: null });
    expect(response.gameEnvelope.drives.completed).toHaveLength(0);
  });

  it('reassigns an empty third-quarter drive instead of reopening a first-half drive', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.clock = { ...envelope.clock, period: 3, clock: '12:00' };
    envelope.game = { ...envelope.game, period: 3 };
    envelope.drives = {
      completed: [{ ...envelope.drives.current, result: 'endOfHalf', endPeriod: 2, endClock: '00:00' }],
      current: { driveId: 'DRV-0003', driveNumber: 3, team: 'V', startYardLine: 'V25', startReason: 'kickoff', plays: 0, yards: 0, result: null },
    };
    envelope.liveState = { ...envelope.liveState, possession: 'V', driveId: 'DRV-0003', driveNumber: 3, yardLine: 'H35' };
    const request = gameControlRequest('LOCAL-POSSESSION-Q3-1', 'setPossession', { possession: 'H' });
    request.event.period = 3;
    request.event.clock = '12:00';
    const response = await submitFootballEventLocally(envelope, request);

    expect(response.gameEnvelope.drives.completed).toHaveLength(1);
    expect(response.gameEnvelope.drives.current).toMatchObject({
      driveId: 'DRV-0003', team: 'H', startReason: 'manualPossessionCorrection', startYardLine: 'H35',
    });
  });

  it('initializes the third quarter as an awaiting-kickoff state from the second-half choice', async () => {
    const envelope = clone(getGameEnvelopeFixture('halftime'));
    envelope.pregame = {
      gamePhase: 'halftime',
      coinToss: {
        status: 'complete',
        secondHalfChoiceTeam: 'V',
      },
      starters: {},
    };
    const response = await submitFootballEventLocally(
      envelope,
      gameControlRequest('LOCAL-START-Q3-1', 'startQuarter', {
        period: 3,
        secondHalf: {
          choiceTeam: 'V',
          choice: 'receive',
          otherTeamChoice: null,
          direction: 'north',
          directionChoiceTeam: 'H',
          kickingTeam: 'H',
          receivingTeam: 'V',
        },
      }),
    );

    expect(response.gameEnvelope.game).toMatchObject({ status: 'inProgress', period: 3 });
    expect(response.gameEnvelope.clock).toMatchObject({ period: 3, clock: '15:00', isRunning: false });
    expect(response.gameEnvelope.pregame.gamePhase).toBe('awaitingKickoff');
    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H35',
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
      timeouts: { H: 3, V: 3 },
    });
  });

  it('closes the current drive at halftime so it cannot span the half', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.clock = { ...envelope.clock, period: 2, clock: '00:00' };
    envelope.game = { ...envelope.game, period: 2 };
    const response = await submitFootballEventLocally(
      envelope,
      gameControlRequest('LOCAL-END-HALF-1', 'endQuarter', { period: 2 }),
    );

    expect(response.gameEnvelope.game.status).toBe('halftime');
    expect(response.gameEnvelope.drives.current).toBeNull();
    expect(response.gameEnvelope.drives.completed.at(-1)).toMatchObject({
      driveId: 'DRV-0002', team: 'H', result: 'endOfHalf', endPeriod: 2, endClock: '00:00',
    });
  });

  it('sets an explicit down, distance, spot, and line to gain', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    const response = await submitFootballEventLocally(
      envelope,
      gameControlRequest('LOCAL-CONTEXT-1', 'setBallContext', {
        possession: 'H',
        down: 2,
        distance: 5,
        spot: 'H44',
        lineToGain: 'H49',
      }),
    );

    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: 'H',
      down: 2,
      distance: 5,
      yardLine: 'H44',
      lineToGain: 'H49',
      nextPlayContext: 'H,2,5,H44',
    });
  });

  it('applies an accepted queued penalty final spot and repeats the down', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    const preState = { ...envelope.liveState };
    delete preState.nextPlayContext;
    const response = await submitFootballEventLocally(envelope, {
      event: {
        clientEventId: 'LOCAL-RUSH-PENALTY-1',
        type: 'rush',
        period: envelope.game.period,
        clock: envelope.clock.clock,
        possession: envelope.liveState.possession,
        preState,
        participants: { primary: { playerId: 'H-22', team: 'H', role: 'rusher' }, secondary: null, defenders: [] },
        result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
        penalties: [{
          penaltyId: 'LOCAL-PENALTY-1',
          code: 'HOLD',
          team: 'H',
          status: 'accepted',
          yards: 10,
          enforcedFrom: 'spotOfFoul',
          spotOfFoul: 'V45',
          finalSpot: 'H45',
          replayDown: true,
        }],
      },
      clientContext: { submittedAt: '2026-08-07T12:00:00.000Z' },
    });

    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: envelope.liveState.possession,
      down: envelope.liveState.down,
      yardLine: 'H45',
      lineToGain: envelope.liveState.lineToGain,
    });
  });

  it('starts a new series when replay-down enforcement reaches the line to gain and repairs an already-saved zero distance', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 3,
      distance: 4,
      yardLine: 'H24',
      lineToGain: 'H20',
      goalToGo: false,
      redZone: false,
      driveId: 'DRV-0023',
      driveNumber: 23,
    };
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-ABORTED-REPLAY-FIRST-DOWN-1', {
      type: 'rush',
      subtype: 'aborted',
      participants: {
        primary: null,
        secondary: null,
        defenders: [{ playerId: 'V-5', team: 'V', role: 'recoverer' }],
      },
      result: {
        code: 'fumble',
        yards: -50,
        teamCharged: true,
        endYardLine: 'V26',
        nextPossession: 'V',
        fumble: {
          fumblerPlayerId: 'TM',
          spot: 'V26',
          recoveredByPlayerId: 'V-5',
          recoveredByTeam: 'V',
          recoverySpot: 'V26',
          turnover: false,
        },
      },
      penalties: [{
        penaltyId: 'LOCAL-ABORTED-REPLAY-FIRST-DOWN-PENALTY-1',
        code: 'SUB',
        team: 'H',
        status: 'accepted',
        yards: 5,
        enforcedFrom: 'previousSpot',
        finalSpot: 'H19',
        replayDown: true,
      }],
    }));

    expect(response.projection).toMatchObject({ firstDown: true });
    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'H19',
      lineToGain: 'H09',
      nextPlayContext: 'V,1,10,H19',
    });
    expect(response.gameEnvelope.stats.teams.V).toMatchObject({ firstDowns: 1 });
    expect(response.gameEnvelope.stats.teams.V.rushAttempts).toBeUndefined();

    const staleEnvelope = {
      ...response.gameEnvelope,
      liveState: {
        ...response.gameEnvelope.liveState,
        down: 3,
        distance: 0,
        lineToGain: 'H20',
        nextPlayContext: 'V,3,0,H19',
      },
    };
    expect(normalizeFootballScoringSetupEnvelope(staleEnvelope).liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'H19',
      lineToGain: 'H09',
      nextPlayContext: 'V,1,10,H19',
    });
  });

  it('credits a spot-of-foul rush only through the foul spot while preserving its description', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 3,
      distance: 9,
      yardLine: 'H27',
      lineToGain: 'H36',
    };
    envelope.drives.current = {
      ...envelope.drives.current,
      team: 'H',
      startYardLine: 'H27',
      plays: 0,
      yards: 0,
    };
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-SPOT-FOUL-RUSH-1', {
      type: 'rush',
      subtype: null,
      participants: {
        primary: { playerId: 'H-10', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'tackle', yards: 8, endYardLine: 'H35' },
      penalties: [{
        penaltyId: 'LOCAL-SPOT-FOUL-PENALTY-1',
        code: 'IBB',
        team: 'H',
        status: 'accepted',
        yards: -10,
        enforcedFrom: 'spotOfFoul',
        spotOfFoul: 'H24',
        finalSpot: 'H14',
        replayDown: true,
      }],
      description: 'WVSU #10 Kaleb Jackson rush for 8 yards to the H35, PENALTY Illegal Block in the Back, enforced 10 yards from the H24 to the H14, replay down.',
    }));

    expect(response.acceptedEvent.result).toMatchObject({ yards: 8, endYardLine: 'H35' });
    expect(response.acceptedEvent.description).toContain('rush for 8 yards to the H35');
    expect(response.projection.yardsGained).toBe(-3);
    expect(response.gameEnvelope.liveState).toMatchObject({ down: 3, yardLine: 'H14', lineToGain: 'H36' });
    expect(response.gameEnvelope.stats.teams.H).toMatchObject({
      rushAttempts: 1,
      rushYards: -3,
      plays: 1,
      yards: -3,
      penalties: { num: 1, yds: 10 },
    });
    expect(response.gameEnvelope.stats.players['H-10']).toMatchObject({ rushAttempts: 1, rushYards: -3 });
    expect(response.gameEnvelope.stats.teams.H.thirdDown).toBeUndefined();
    expect(response.gameEnvelope.drives.current).toMatchObject({ plays: 1, yards: -13 });
  });

  it('erases play stats at the previous spot but still credits an automatic first down', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 3,
      distance: 16,
      yardLine: 'V41',
      lineToGain: 'H43',
    };
    envelope.drives.current = {
      ...envelope.drives.current,
      team: 'V',
      startYardLine: 'V47',
      plays: 8,
      yards: -6,
    };
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PREVIOUS-SPOT-PASS-1', {
      type: 'pass',
      subtype: 'incomplete',
      participants: {
        primary: { playerId: 'V-11', team: 'V', role: 'passer' },
        secondary: { playerId: 'V-5', team: 'V', role: 'intendedReceiver' },
        defenders: [],
      },
      result: {
        code: 'incomplete',
        pass: { outcome: 'incomplete', targetPlayerId: 'V-5' },
      },
      penalties: [{
        penaltyId: 'LOCAL-PREVIOUS-SPOT-PENALTY-1',
        code: 'DH',
        team: 'H',
        status: 'accepted',
        yards: 10,
        enforcedFrom: 'previousSpot',
        finalSpot: 'H49',
        automaticFirstDown: true,
      }],
    }));

    expect(response.projection).toMatchObject({ yardsGained: 0, firstDown: true });
    expect(response.gameEnvelope.liveState).toMatchObject({ possession: 'V', down: 1, yardLine: 'H49' });
    expect(response.gameEnvelope.stats.teams.V).toMatchObject({ firstDowns: 1 });
    expect(response.gameEnvelope.stats.teams.V.plays).toBeUndefined();
    expect(response.gameEnvelope.stats.teams.V.pass).toBeUndefined();
    expect(response.gameEnvelope.stats.teams.V.thirdDown).toBeUndefined();
    expect(response.gameEnvelope.stats.players['V-11']).toBeUndefined();
    expect(response.gameEnvelope.stats.players['V-5']).toBeUndefined();
    expect(response.gameEnvelope.stats.teams.H.penalties).toEqual({ num: 1, yds: 10 });
    expect(response.gameEnvelope.drives.current).toMatchObject({ plays: 8, yards: 4 });

    const touchdown = await submitFootballEventLocally(response.gameEnvelope, playRequest(
      response.gameEnvelope,
      'LOCAL-PREVIOUS-SPOT-DRIVE-TD-1',
      {
        type: 'rush',
        subtype: null,
        participants: {
          primary: { playerId: 'V-2', team: 'V', role: 'rusher' },
          secondary: null,
          defenders: [],
        },
        result: { code: 'tackle', yards: 49, endYardLine: 'H00' },
      },
    ));
    expect(touchdown.gameEnvelope.drives.completed.at(-1)).toMatchObject({
      team: 'V',
      result: 'touchdown',
      yards: 53,
    });
  });

  it('credits a succeeding-spot pass in full while enforcing the penalty afterward', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-SUCCEEDING-SPOT-PASS-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'passer' },
        secondary: { playerId: 'H-88', team: 'H', role: 'receiver' },
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 8,
        endYardLine: 'V48',
        pass: { outcome: 'complete', passingYards: 8, receivingYards: 8, terminalYardLine: 'V48' },
      },
      penalties: [{
        penaltyId: 'LOCAL-SUCCEEDING-SPOT-PENALTY-1',
        code: 'DPI',
        team: 'V',
        status: 'accepted',
        yards: 15,
        enforcedFrom: 'succeedingSpot',
        finalSpot: 'V33',
        automaticFirstDown: true,
      }],
    }));

    expect(response.projection.yardsGained).toBe(8);
    expect(response.gameEnvelope.liveState.yardLine).toBe('V33');
    expect(response.gameEnvelope.stats.teams.H).toMatchObject({
      firstDowns: 2,
      pass: { att: 1, cmp: 1, yds: 8 },
      plays: 1,
      yards: 8,
    });
    expect(response.gameEnvelope.stats.players['H-12']).toMatchObject({ passAttempts: 1, passCompletions: 1, passYards: 8 });
    expect(response.gameEnvelope.drives.current.yards).toBe(42);
  });

  it('credits only the automatic first down when a succeeding-spot play finishes short of the line to gain', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-SUCCEEDING-SPOT-AUTO-FIRST-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'passer' },
        secondary: { playerId: 'H-88', team: 'H', role: 'receiver' },
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 3,
        endYardLine: 'H47',
        pass: { outcome: 'complete', passingYards: 3, receivingYards: 3, terminalYardLine: 'H47' },
      },
      penalties: [{
        penaltyId: 'LOCAL-SUCCEEDING-SPOT-AUTO-FIRST-PENALTY-1',
        code: 'DPI',
        team: 'V',
        status: 'accepted',
        yards: 15,
        enforcedFrom: 'succeedingSpot',
        finalSpot: 'V38',
        automaticFirstDown: true,
      }],
    }));

    expect(response.projection).toMatchObject({ yardsGained: 3, firstDown: true });
    expect(response.gameEnvelope.stats.teams.H).toMatchObject({
      firstDowns: 1,
      pass: { att: 1, cmp: 1, yds: 3 },
      plays: 1,
      yards: 3,
    });
  });

  it('counts the completed play and advances the down normally for an offensive succeeding-spot foul', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 2,
      distance: 6,
      yardLine: 'H44',
      lineToGain: '50',
    };
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-DOWN-COUNTS-1', {
      type: 'rush',
      subtype: null,
      participants: {
        primary: { playerId: 'H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'outOfBounds', yards: 3, endYardLine: 'H47' },
      penalties: [{
        penaltyId: 'LOCAL-DOWN-COUNTS-PENALTY-1',
        code: 'UNS',
        team: 'H',
        status: 'accepted',
        yards: 15,
        enforcedFrom: 'succeedingSpot',
        finalSpot: 'H32',
        downCounts: true,
      }],
    }));

    expect(response.projection).toMatchObject({ yardsGained: 3, firstDown: false });
    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: 'H',
      down: 3,
      yardLine: 'H32',
    });
    expect(response.gameEnvelope.stats.teams.H).toMatchObject({
      rushAttempts: 1,
      rushYards: 3,
      plays: 1,
      yards: 3,
    });
    expect(response.gameEnvelope.events.at(-1).penalties[0].downCounts).toBe(true);
  });

  it('classifies a rush to the opponent goal line, scores it, and sets up the PAT and kickoff', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.game.teams.H.score = 0;
    envelope.game.teams.V.score = 0;
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 1,
      distance: 5,
      yardLine: 'H05',
      lineToGain: 'goal',
      goalToGo: true,
    };
    envelope.drives.current = {
      ...envelope.drives.current,
      team: 'V',
      startYardLine: 'H05',
      plays: 0,
      yards: 0,
    };
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const touchdown = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-GOAL-LINE-RUSH-1', {
      type: 'rush',
      subtype: null,
      participants: { primary: { playerId: 'V-10', team: 'V', role: 'rusher' }, secondary: null, defenders: [] },
      result: { code: 'tackle', yards: 5, endYardLine: 'H00' },
      description: 'WVSU #10 Kaleb Jackson rush for 5 yards to the H goal line.',
    }));

    expect(touchdown.projection).toMatchObject({
      yardsGained: 5,
      scoringUpdate: { team: 'V', points: 6, type: 'touchdown' },
    });
    expect(touchdown.gameEnvelope.game.teams.V.score).toBe(6);
    expect(touchdown.gameEnvelope.liveState).toMatchObject({
      possession: null,
      yardLine: 'H03',
      pendingTryTeam: 'V',
      nextPlayContext: 'awaitingTry',
    });
    expect(touchdown.gameEnvelope.stats.teams.V).toMatchObject({ rushAttempts: 1, rushYards: 5, plays: 1, yards: 5 });
    expect(touchdown.gameEnvelope.stats.teams.V.firstDowns).toBeUndefined();
    expect(touchdown.gameEnvelope.stats.players['V-10']).toMatchObject({ rushAttempts: 1, rushYards: 5 });
    expect(touchdown.gameEnvelope.drives.completed.at(-1)).toMatchObject({ team: 'V', plays: 1, yards: 5, result: 'touchdown' });

    for (const [code, scoring, expectedScore] of [
      ['made', { team: 'V', points: 1, type: 'patKick' }, 7],
      ['missed', undefined, 6],
    ]) {
      const tryEnvelope = clone(touchdown.gameEnvelope);
      const pat = await submitFootballEventLocally(tryEnvelope, playRequest(tryEnvelope, `LOCAL-PAT-${code}`, {
        type: 'try',
        subtype: 'kick',
        participants: { primary: { playerId: 'V-30', team: 'V', role: 'kicker' }, secondary: null, defenders: [] },
        result: { code, ...(scoring ? { scoring } : {}) },
      }));
      expect(pat.gameEnvelope.game.teams.V.score).toBe(expectedScore);
      expect(pat.gameEnvelope.liveState).toMatchObject({
        possession: null,
        yardLine: 'V35',
        kickoffTeam: 'V',
        nextPlayContext: 'awaitingKickoff',
      });
    }
  });

  it.each([
    ['inside the 10', 'H05', 4, undefined],
    ['at the 10', 'H10', 9, 1],
  ])('applies the NCAA touchdown first-down rule when a goal-to-go series starts %s', async (
    _label,
    startYardLine,
    openingYards,
    expectedFirstDowns,
  ) => {
    let envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.events = [];
    envelope.stats = { sourceEventSequence: 0, teams: {}, players: {} };
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 1,
      distance: Number(startYardLine.slice(1)),
      yardLine: startYardLine,
      lineToGain: 'goal',
      goalToGo: true,
      driveId: 'DRV-GOAL-TO-GO-FIRST-DOWN',
      driveNumber: 7,
    };
    envelope.drives.current = {
      driveId: 'DRV-GOAL-TO-GO-FIRST-DOWN',
      driveNumber: 7,
      team: 'V',
      startYardLine,
      startReason: 'firstDown',
      plays: 0,
      yards: 0,
      result: null,
    };

    const openingPlay = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-GOAL-TO-GO-OPENING-1', {
      type: 'rush',
      subtype: null,
      participants: { primary: { playerId: 'V-10', team: 'V', role: 'rusher' }, secondary: null, defenders: [] },
      result: { code: 'tackle', yards: openingYards, endYardLine: 'H01' },
    }));
    envelope = openingPlay.gameEnvelope;

    const touchdown = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-GOAL-TO-GO-TOUCHDOWN-2', {
      type: 'rush',
      subtype: null,
      participants: { primary: { playerId: 'V-10', team: 'V', role: 'rusher' }, secondary: null, defenders: [] },
      result: {
        code: 'touchdown',
        yards: 1,
        endYardLine: 'H00',
        firstDown: true,
        scoring: { team: 'V', points: 6, type: 'touchdown' },
      },
    }));

    expect(touchdown.gameEnvelope.stats.teams.V.firstDowns).toBe(expectedFirstDowns);
  });

  it('advances the live state from the canonical endpoint of a complete pass', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 2,
      distance: 7,
      yardLine: 'H46',
      lineToGain: 'H39',
    };
    envelope.drives.current = {
      ...envelope.drives.current,
      team: 'V',
      startYardLine: 'V25',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-COMPLETE-PASS-ENDPOINT-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'V-10', team: 'V', role: 'passer' },
        secondary: { playerId: 'V-3', team: 'V', role: 'intendedReceiver' },
        receiver: { playerId: 'V-3', team: 'V', role: 'receiver' },
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 11,
        endYardLine: 'H35',
        pass: {
          outcome: 'complete',
          terminalYardLine: 'H35',
          passingYards: 11,
          receivingYards: 11,
        },
      },
    }));

    expect(response.projection).toMatchObject({ yardsGained: 11, firstDown: true });
    expect(response.gameEnvelope.liveState).toMatchObject({
      possession: 'V',
      down: 1,
      distance: 10,
      yardLine: 'H35',
      lineToGain: 'H25',
    });
  });

  it('projects rush, pass, player, penalty, and drive totals into the local test envelope', async () => {
    let envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};

    const rushOne = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-RUSH-STAT-1', {
      type: 'rush',
      subtype: null,
      participants: {
        primary: { playerId: 'H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'tackle', yards: 3, endYardLine: 'H47' },
    }));
    envelope = rushOne.gameEnvelope;

    const rushTwo = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-RUSH-STAT-2', {
      type: 'rush',
      subtype: null,
      participants: {
        primary: { playerId: 'H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'tackle', yards: 2, endYardLine: 'H49' },
    }));
    envelope = rushTwo.gameEnvelope;

    const pass = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PASS-STAT-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'passer' },
        secondary: { playerId: 'H-88', team: 'H', role: 'intendedReceiver' },
        receiver: { playerId: 'H-88', team: 'H', role: 'receiver' },
        defenders: [],
      },
      result: {
        code: 'complete',
        endYardLine: 'V43',
        pass: { outcome: 'complete', passingYards: 8, receivingYards: 8, terminalYardLine: 'V43' },
      },
    }));
    envelope = pass.gameEnvelope;

    const penalty = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PENALTY-STAT-1', {
      type: 'penalty',
      subtype: 'accepted',
      result: { code: 'accepted', endYardLine: 'H47' },
      penalties: [{
        penaltyId: 'PEN-1',
        code: 'HOLD',
        team: 'H',
        status: 'accepted',
        yards: 10,
        finalSpot: 'H47',
        replayDown: true,
      }],
    }));

    expect(penalty.gameEnvelope.stats.teams.H).toMatchObject({
      rushAttempts: 2,
      rushYards: 5,
      pass: { att: 1, cmp: 1, int: 0, yds: 8 },
      plays: 3,
      yards: 13,
      penalties: { num: 1, yds: 10 },
    });
    expect(penalty.gameEnvelope.stats.players['H-22']).toMatchObject({ rushAttempts: 2, rushYards: 5 });
    expect(penalty.gameEnvelope.stats.players['H-12']).toMatchObject({ passAttempts: 1, passCompletions: 1, passYards: 8 });
    expect(penalty.gameEnvelope.stats.players['H-88']).toMatchObject({ targets: 1, receptions: 1, receivingYards: 8 });
    expect(penalty.gameEnvelope.drives.current).toMatchObject({ plays: 7, yards: 22 });
  });

  it('charges spike, kneel, and aborted play statistics to the team without individual attempts', async () => {
    let envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 1,
      distance: 10,
      yardLine: 'H44',
      lineToGain: 'V46',
    };

    const kneel = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-TEAM-KNEEL-1', {
      type: 'rush',
      subtype: 'kneel',
      participants: {
        primary: { playerId: 'H-10', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'tackle', yards: -1, endYardLine: 'H43', teamCharged: true },
    }));
    envelope = kneel.gameEnvelope;

    const spike = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-TEAM-SPIKE-1', {
      type: 'pass',
      subtype: 'spike',
      participants: {
        primary: { playerId: 'H-10', team: 'H', role: 'passer' },
        secondary: null,
        defenders: [],
      },
      result: { code: 'incomplete', teamCharged: true, pass: { outcome: 'incomplete' } },
    }));
    envelope = spike.gameEnvelope;

    const aborted = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-TEAM-ABORTED-1', {
      type: 'rush',
      subtype: 'aborted',
      participants: {
        primary: null,
        secondary: null,
        defenders: [{ playerId: 'H-22', team: 'H', role: 'recoverer' }],
      },
      result: {
        code: 'fumble',
        yards: -3,
        endYardLine: 'H40',
        nextPossession: 'H',
        teamCharged: true,
        fumble: {
          fumblerPlayerId: 'TM',
          recoveredByPlayerId: 'H-22',
          recoveredByTeam: 'H',
          recoverySpot: 'H40',
          turnover: false,
        },
      },
    }));

    expect(aborted.gameEnvelope.stats.teams.H).toMatchObject({
      rushAttempts: 2,
      rushYards: -4,
      pass: { att: 1, cmp: 0, int: 0, yds: 0 },
      plays: 3,
      yards: -4,
      fumbles: { num: 1, lost: 0 },
    });
    expect(aborted.gameEnvelope.stats.players['H-10']).toBeUndefined();
    expect(aborted.gameEnvelope.stats.players.TM).toBeUndefined();
  });

  it('credits sacks as team and quarterback rushes without double-counting total plays', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 2,
      distance: 8,
      yardLine: 'H44',
      lineToGain: 'V48',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-SACK-STAT-1', {
      type: 'pass',
      subtype: 'sack',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'sackVictim' },
        secondary: null,
        defenders: [{ playerId: 'V-44', team: 'V', role: 'sacker' }],
      },
      result: { code: 'sack', yards: -9, endYardLine: 'H35', pass: { outcome: 'sack' } },
    }));

    expect(response.gameEnvelope.stats.teams.H).toMatchObject({
      rushAttempts: 1,
      rushYards: -9,
      plays: 1,
      yards: -9,
      pass: { att: 0, cmp: 0, int: 0, yds: 0 },
    });
    expect(response.gameEnvelope.stats.players['H-12']).toMatchObject({
      rushAttempts: 1,
      rushYards: -9,
      passAttempts: 0,
    });
  });

  it('projects kickoff returns, punts, and punt returns into team and player totals', async () => {
    let envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H35',
      lineToGain: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    };

    const kickoff = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-KICK-RETURN-STAT-1', {
      type: 'kickoff',
      subtype: 'returned',
      possession: 'H',
      participants: {
        primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-9', team: 'H', role: 'kicker' },
        returner: { playerId: 'V-3', team: 'V', role: 'returner' },
        defenders: [],
      },
      result: {
        code: 'returned',
        endYardLine: 'V26',
        nextPossession: 'V',
        driveEnds: true,
        kick: { kickYards: 65 },
        return: { type: 'Kickoff', returnerPlayerId: 'V-3', returnYards: 26 },
      },
    }));
    envelope = kickoff.gameEnvelope;
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 4,
      distance: 8,
      yardLine: 'V40',
      lineToGain: 'V48',
    };

    const punt = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PUNT-RETURN-STAT-1', {
      type: 'punt',
      subtype: 'returned',
      participants: {
        primary: { playerId: 'V-9', team: 'V', role: 'punter' },
        punter: { playerId: 'V-9', team: 'V', role: 'punter' },
        returner: { playerId: 'H-31', team: 'H', role: 'returner' },
        defenders: [],
      },
      result: {
        code: 'returned',
        endYardLine: 'H21',
        nextPossession: 'H',
        driveEnds: true,
        kick: { kickYards: 39 },
        return: { type: 'Punt', returnerPlayerId: 'H-31', returnYards: 10 },
      },
    }));

    expect(punt.gameEnvelope.stats.teams.V.punts).toEqual({ num: 1, yds: 39, avg: 39 });
    expect(punt.gameEnvelope.stats.players['V-9']).toMatchObject({ punts: 1, puntYards: 39 });
    expect(punt.gameEnvelope.stats.teams.V.fourthDown).toBeUndefined();
    expect(punt.gameEnvelope.stats.teams.V.thirdDown).toBeUndefined();
    expect(punt.gameEnvelope.stats.teams.V).not.toHaveProperty('plays');
    expect(punt.gameEnvelope.stats.teams.H.puntReturns).toEqual({ num: 1, yds: 10 });
    expect(punt.gameEnvelope.stats.players['H-31']).toMatchObject({ puntReturns: 1, puntReturnYards: 10 });
    expect(punt.gameEnvelope.stats.teams.V.kickReturns).toEqual({ num: 1, yds: 26 });
    expect(punt.gameEnvelope.stats.players['V-3']).toMatchObject({ kickReturns: 1, kickReturnYards: 26 });
  });

  it('ends kickoff return statistics at an accepted return-team spot of foul', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H20',
      lineToGain: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-KICK-SPOT-FOUL-STAT-1', {
      type: 'kickoff',
      subtype: 'returned',
      possession: null,
      participants: {
        primary: { playerId: 'H-38', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-38', team: 'H', role: 'kicker' },
        returner: { playerId: 'V-6', team: 'V', role: 'returner' },
        defenders: [],
      },
      result: {
        code: 'returned',
        endYardLine: 'H40',
        nextPossession: 'V',
        driveEnds: false,
        kick: { catchYardLine: 'V27', kickYards: 38, receiveResultCode: 'R' },
        return: {
          type: 'Kickoff',
          returnerPlayerId: 'V-6',
          returnYards: 33,
          returnStartYardLine: 'V27',
          returnEndYardLine: 'H40',
        },
      },
      penalties: [{
        penaltyId: 'LOCAL-KICK-SPOT-FOUL-PENALTY-1',
        code: 'HOLD',
        team: 'V',
        status: 'accepted',
        yards: 10,
        enforcedFrom: 'spotOfFoul',
        spotOfFoul: 'V48',
        finalSpot: 'V38',
        replayDown: true,
      }],
    }));

    expect(response.gameEnvelope.stats.teams.V.kickReturns).toEqual({ num: 1, yds: 21 });
    expect(response.gameEnvelope.stats.players['V-6']).toMatchObject({ kickReturns: 1, kickReturnYards: 21 });
    expect(response.gameEnvelope.stats.teams.V.penalties).toEqual({ num: 1, yds: 10 });
  });

  it('records a negative blocked punt as a zero-yard team punt and blocker return', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 4,
      distance: 17,
      yardLine: 'V34',
      lineToGain: 'H49',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-BLOCKED-PUNT-STAT-1', {
      type: 'punt',
      subtype: 'outOfBounds',
      participants: {
        primary: { playerId: 'V-31', team: 'V', role: 'punter' },
        punter: { playerId: 'V-31', team: 'V', role: 'punter' },
        returner: null,
        defenders: [{ playerId: 'H-6', team: 'H', role: 'blocker' }],
      },
      result: {
        code: 'outOfBounds',
        endYardLine: 'V26',
        nextPossession: 'H',
        driveEnds: true,
        kick: {
          catchYardLine: 'V26',
          kickYards: -8,
          receiveResultCode: 'O',
          blockedByPlayerId: 'H-6',
        },
      },
    }));

    expect(response.gameEnvelope.stats.teams.V.punts).toEqual({ num: 1, yds: 0, avg: 0 });
    expect(response.gameEnvelope.stats.players['V-31']).toBeUndefined();
    expect(response.gameEnvelope.stats.teams.H.puntReturns).toEqual({ num: 1, yds: 8 });
    expect(response.gameEnvelope.stats.players['H-6']).toMatchObject({ puntReturns: 1, puntReturnYards: 8 });
    expect(response.gameEnvelope.stats.teams.V.fourthDown).toBeUndefined();
  });

  it('counts a kickoff-return fumble and lost fumble for the receiving team', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H35',
      lineToGain: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-KICK-FUMBLE-STAT-1', {
      type: 'kickoff',
      subtype: 'returned',
      possession: 'H',
      participants: {
        primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-9', team: 'H', role: 'kicker' },
        returner: { playerId: 'V-3', team: 'V', role: 'returner' },
        defenders: [{ playerId: 'H-31', team: 'H', role: 'recoverer' }],
      },
      result: {
        code: 'returned',
        endYardLine: 'V28',
        nextPossession: 'H',
        driveEnds: true,
        kick: { kickYards: 57, catchYardLine: 'V08' },
        return: { type: 'Kickoff', returnerPlayerId: 'V-3', returnYards: 20, returnEndYardLine: 'V28' },
        fumble: {
          fumblerPlayerId: 'V-3',
          forcedByPlayerId: 'H-31',
          spot: 'V26',
          recoveredByPlayerId: 'H-31',
          recoveredByTeam: 'H',
          recoverySpot: 'V28',
          turnover: true,
        },
        turnover: { type: 'fumble', team: 'H', spot: 'V28' },
      },
    }));

    expect(response.gameEnvelope.stats.teams.V.fumbles).toEqual({ num: 1, lost: 1 });
    expect(response.gameEnvelope.stats.players['V-3']).toMatchObject({ fumbles: 1, fumblesLost: 1 });
  });

  it('derives a kickoff return from legacy muff and recovery spots', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: 'H35',
      lineToGain: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-KICK-MUFF-STAT-1', {
      type: 'kickoff',
      subtype: 'muffed',
      possession: null,
      participants: {
        primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
        kicker: { playerId: 'H-9', team: 'H', role: 'kicker' },
        returner: { playerId: 'V-80', team: 'V', role: 'returner' },
        fumbler: { playerId: 'V-80', team: 'V', role: 'returner' },
        recoveredBy: { playerId: 'V-80', team: 'V', role: 'recoverer' },
        defenders: [],
      },
      result: {
        code: 'muffed',
        endYardLine: 'V32',
        nextPossession: 'V',
        driveEnds: false,
        kick: { kickYards: 35, catchYardLine: 'V30', receiveResultCode: 'M' },
        fumble: {
          fumblerPlayerId: 'V-80',
          spot: 'V32',
          recoveredByPlayerId: 'V-80',
          recoveredByTeam: 'V',
          recoverySpot: 'V32',
          turnover: false,
        },
        turnover: { type: 'muffedKick', team: 'V', playerId: 'V-80', spot: 'V32', recoveredBy: 'V' },
      },
    }));

    expect(response.gameEnvelope.stats.teams.V.kickReturns).toEqual({ num: 1, yds: 2 });
    expect(response.gameEnvelope.stats.players['V-80']).toMatchObject({ kickReturns: 1, kickReturnYards: 2 });
  });

  it('counts third- and fourth-down attempts only on scrimmage conversion tries', async () => {
    let envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 3,
      distance: 5,
      yardLine: 'H40',
      lineToGain: 'H45',
    };

    const thirdDown = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-THIRD-DOWN-1', {
      type: 'rush',
      participants: { primary: { playerId: 'H-22', team: 'H', role: 'rusher' }, defenders: [] },
      result: { code: 'tackle', yards: 6, endYardLine: 'H46' },
    }));
    envelope = thirdDown.gameEnvelope;
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'H',
      down: 4,
      distance: 2,
      yardLine: 'V40',
      lineToGain: 'V38',
    };

    const fourthDown = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-FOURTH-DOWN-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'H-12', team: 'H', role: 'passer' },
        receiver: { playerId: 'H-88', team: 'H', role: 'receiver' },
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 3,
        endYardLine: 'V37',
        pass: { outcome: 'complete', passingYards: 3, receivingYards: 3, terminalYardLine: 'V37' },
      },
    }));

    expect(fourthDown.gameEnvelope.stats.teams.H.thirdDown).toEqual({ att: 1, made: 1 });
    expect(fourthDown.gameEnvelope.stats.teams.H.fourthDown).toEqual({ att: 1, made: 1 });
  });

  it('credits completion yardage through the fumble spot without a first down after an opponent recovery', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    envelope.stats.players = {};
    envelope.liveState = {
      ...envelope.liveState,
      possession: 'V',
      down: 3,
      distance: 10,
      yardLine: 'H19',
      lineToGain: 'H09',
      driveId: 'DRV-TUCKER',
      driveNumber: 23,
    };

    const response = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PASS-FUMBLE-TURNOVER-1', {
      type: 'pass',
      subtype: 'complete',
      participants: {
        primary: { playerId: 'V-11', team: 'V', role: 'passer' },
        receiver: { playerId: 'V-85', team: 'V', role: 'receiver' },
        fumbler: { playerId: 'V-85', team: 'V', role: 'fumbler' },
        recoveredBy: { playerId: 'H-43', team: 'H', role: 'recoverer' },
        defenders: [],
      },
      result: {
        code: 'complete',
        yards: 13,
        endYardLine: 'H06',
        nextPossession: 'H',
        pass: {
          outcome: 'complete',
          terminalYardLine: 'H06',
          passingYards: 13,
          receivingYards: 13,
        },
        fumble: {
          fumblerPlayerId: 'V-85',
          spot: 'H06',
          recoveredByPlayerId: 'H-43',
          recoveredByTeam: 'H',
          recoverySpot: 'H06',
          turnover: true,
        },
        turnover: { type: 'fumble', team: 'H', playerId: 'H-43', spot: 'H06' },
      },
    }));

    expect(response.projection).toMatchObject({ firstDown: false, yardsGained: 13 });
    expect(response.gameEnvelope.liveState).toMatchObject({ possession: 'H', down: 1, yardLine: 'H06' });
    expect(response.gameEnvelope.stats.teams.V).toMatchObject({
      pass: { att: 1, cmp: 1, int: 0, yds: 13 },
      plays: 1,
      yards: 13,
      thirdDown: { att: 1, made: 0 },
      fumbles: { num: 1, lost: 1 },
    });
    expect(response.gameEnvelope.stats.teams.V.firstDowns).toBeUndefined();
    expect(response.gameEnvelope.stats.players['V-11']).toMatchObject({ passAttempts: 1, passCompletions: 1, passYards: 13 });
    expect(response.gameEnvelope.stats.players['V-85']).toMatchObject({ receptions: 1, receivingYards: 13, fumblesLost: 1 });
  });

  it('repairs stale team totals by replaying a complete accepted event log', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats = { ...envelope.stats, sourceEventSequence: 2, teams: {}, players: {} };
    envelope.events = [
      {
        eventId: 'REPLAY-KICKOFF-1',
        sequence: 1,
        status: 'accepted',
        type: 'kickoff',
        subtype: 'returned',
        possession: 'H',
        preState: { possession: null, down: null, distance: null, yardLine: 'H35', lineToGain: null },
        participants: {
          primary: { playerId: 'H-9', team: 'H', role: 'kicker' },
          returner: { playerId: 'V-3', team: 'V', role: 'returner' },
          defenders: [],
        },
        result: {
          code: 'returned',
          endYardLine: 'V26',
          nextPossession: 'V',
          kick: { catchYardLine: 'V00', kickYards: 65 },
          return: { type: 'Kickoff', returnerPlayerId: 'V-3', returnYards: 26, returnEndYardLine: 'V26' },
        },
        penalties: [],
      },
      {
        eventId: 'REPLAY-PUNT-2',
        sequence: 2,
        status: 'accepted',
        type: 'punt',
        subtype: 'fairCatch',
        possession: 'V',
        preState: { possession: 'V', down: 4, distance: 8, yardLine: 'V40', lineToGain: 'V48' },
        participants: {
          primary: { playerId: 'V-9', team: 'V', role: 'punter' },
          punter: { playerId: 'V-9', team: 'V', role: 'punter' },
          defenders: [],
        },
        result: {
          code: 'fairCatch',
          endYardLine: 'H21',
          nextPossession: 'H',
          kick: { catchYardLine: 'H21', kickYards: 39 },
        },
        penalties: [],
      },
    ];

    const repaired = normalizeFootballScoringSetupEnvelope(envelope);

    expect(repaired.stats.teams.V.kickReturns).toEqual({ num: 1, yds: 26 });
    expect(repaired.stats.teams.V.punts).toEqual({ num: 1, yds: 39, avg: 39 });
    expect(repaired.stats.teams.V.fourthDown).toBeUndefined();
    expect(repaired.stats.players['V-3']).toMatchObject({ kickReturns: 1, kickReturnYards: 26 });
    expect(repaired.stats.players['V-9']).toMatchObject({ punts: 1, puntYards: 39 });
  });

  it('repairs a stale made-field-goal setup to the scoring team kickoff spot', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.game.rules.kickoffSpot = 'H35';
    envelope.events = [{
      eventId: 'FIELD-GOAL-35',
      sequence: 35,
      status: 'accepted',
      type: 'fieldGoal',
      subtype: 'made',
      possession: 'H',
      participants: { primary: { playerId: 'H-36', team: 'H', role: 'kicker' } },
      result: { code: 'made', scoring: { team: 'H', points: 3, type: 'fieldGoal' } },
    }];
    envelope.liveState = {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: 'V20',
      lineToGain: null,
      pendingTryTeam: 'V',
      kickoffTeam: 'V',
      nextPlayContext: null,
    };

    expect(normalizeFootballScoringSetupEnvelope(envelope).liveState).toMatchObject({
      possession: null,
      yardLine: 'H35',
      pendingTryTeam: null,
      kickoffTeam: 'H',
      nextPlayContext: 'awaitingKickoff',
    });
  });

  it('repairs a missing opening kickoff spot from the completed coin toss', () => {
    const envelope = clone(getGameEnvelopeFixture('pregame'));
    envelope.game.rules.kickoffSpot = 40;
    envelope.pregame = {
      gamePhase: 'awaitingKickoff',
      coinToss: {
        ...createCoinTossRecord(),
        status: 'complete',
        firstHalfKickingTeam: 'V',
        firstHalfReceivingTeam: 'H',
      },
      starters: {},
    };
    envelope.liveState = {
      ...envelope.liveState,
      yardLine: '',
      kickoffTeam: null,
      nextPlayContext: 'awaitingKickoff',
    };

    expect(normalizeFootballScoringSetupEnvelope(envelope).liveState).toMatchObject({
      possession: null,
      yardLine: 'V40',
      kickoffTeam: 'V',
      nextPlayContext: 'awaitingKickoff',
    });
  });

  it('records the old possession end and new possession start from one clock prompt', async () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    const punt = await submitFootballEventLocally(envelope, playRequest(envelope, 'LOCAL-PUNT-CLOCK-1', {
      type: 'punt',
      subtype: 'downed',
      result: { code: 'downed', endYardLine: 'V30', nextPossession: 'V', driveEnds: true },
    }));

    expect(punt.gameEnvelope.drives.completed.at(-1)).toMatchObject({
      team: 'H',
      endPeriod: 1,
      endClock: '08:42',
    });

    const recorded = recordFootballPossessionClock(punt.gameEnvelope, {
      previousPossession: 'H',
      nextPossession: 'V',
      period: 1,
      clock: '07:30',
    });

    expect(recorded.clock).toMatchObject({ clock: '07:30', clockTenths: 4500, isRunning: false });
    expect(recorded.stats.teams.H).toMatchObject({
      timeOfPossession: 270,
      possessionSegments: [{ startPeriod: 1, startClock: '12:00', endPeriod: 1, endClock: '07:30' }],
    });
    expect(recorded.stats.teams.V.possessionSegments).toEqual([{ startPeriod: 1, startClock: '07:30' }]);
    expect(recorded.drives.completed.at(-1)).toMatchObject({
      team: 'H',
      endPeriod: 1,
      endClock: '07:30',
    });
    expect(recorded.drives.current).toMatchObject({ team: 'V', startPeriod: 1, startClock: '07:30' });
  });

  it('uses the active drive start clock when possession is changed manually', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.stats.teams = {};
    const changed = {
      ...envelope,
      liveState: { ...envelope.liveState, possession: 'V' },
    };

    const recorded = recordFootballPossessionClock(changed, {
      previousPossession: 'H',
      nextPossession: 'V',
      period: 1,
      clock: '07:30',
    });

    expect(recorded.stats.teams.H.timeOfPossession).toBe(270);
    expect(recorded.stats.teams.H.possessionSegments[0]).toMatchObject({
      startClock: '12:00',
      endClock: '07:30',
    });
  });

  it('does not create possession time or rewrite a drive for a manual possession correction event', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.events.push({
      clientEventId: 'manual-possession-correction', sequence: 13, status: 'accepted', type: 'gameControl', period: 1, clock: '08:42',
      result: { code: 'noPlay', gameControl: { action: 'setPossession', possession: 'V' } },
    });
    const before = clone(envelope);
    const recorded = recordFootballPossessionClock(envelope, {
      previousPossession: 'H', nextPossession: 'V', period: 1, clock: '08:42', endedDriveId: 'DRV-0002',
    });

    expect(recorded).toEqual(before);
  });

  it('updates only the exact ended drive supplied by the possession transition', () => {
    const envelope = clone(getGameEnvelopeFixture('normal'));
    envelope.drives.completed = [
      { driveId: 'DRV-0001', driveNumber: 1, team: 'H', startPeriod: 1, startClock: '15:00', endPeriod: 1, endClock: '12:00' },
      { driveId: 'DRV-0002', driveNumber: 2, team: 'H', startPeriod: 1, startClock: '10:00', endPeriod: 1, endClock: '08:42' },
    ];
    envelope.drives.current = { driveId: 'DRV-0003', driveNumber: 3, team: 'V', startPeriod: 1, startClock: '08:42' };
    const recorded = recordFootballPossessionClock(envelope, {
      previousPossession: 'H', nextPossession: 'V', period: 1, clock: '08:30', endedDriveId: 'DRV-0001',
    });

    expect(recorded.drives.completed[0].endClock).toBe('08:30');
    expect(recorded.drives.completed[1].endClock).toBe('08:42');
  });
});
