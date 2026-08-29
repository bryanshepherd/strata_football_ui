import {
  defaultFixtureKey,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';
import {
  applyFootballEventToEnvelope,
  calculateYardsGained,
  calculateYardsToGain,
  createLiveState,
  oppositeTeam,
  parseSpot,
  spotToPossessionRelative,
} from '../utils/footballRulesEngine';
import { normalizeFootballEnvelopeRuleSpots } from '../utils/footballSpotNormalization';

export const FOOTBALL_DASHBOARD_STORAGE_KEY = 'strata.football.dashboard.v1';
export const FOOTBALL_SYNC_QUEUE_STORAGE_KEY = 'strata.football.syncQueue.v1';
export const FOOTBALL_MIRROR_SOURCE_STORAGE_KEY = 'strata.football.mirrorSource.v1';
export const FOOTBALL_ENVELOPE_ENDPOINT_PREFIX = '/strata_football/api/football/games/envelope.php';
export const FOOTBALL_PREGAME_ENDPOINT = '/strata_football/api/football/games/pregame.php';
export const FOOTBALL_EVENT_ENDPOINT = '/strata_football/api/football/events/submit.php';

export const footballTeamOptions = [
  { teamId: 'TEAM-H', name: 'Home State', abbr: 'HOM' },
  { teamId: 'TEAM-V', name: 'Visitor Tech', abbr: 'VIS' },
  { teamId: 'TEAM-MTN', name: 'Mountain High', abbr: 'MTN' },
  { teamId: 'TEAM-RIV', name: 'River Valley', abbr: 'RIV' },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const readStore = () => {
  if (typeof window === 'undefined') {
    return { games: {} };
  }

  try {
    const raw = window.localStorage.getItem(FOOTBALL_DASHBOARD_STORAGE_KEY);
    if (!raw) return { games: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.games || typeof parsed.games !== 'object') {
      return { games: {} };
    }
    return { games: parsed.games };
  } catch (error) {
    console.warn('Unable to read football dashboard store', error);
    return { games: {} };
  }
};

const writeStore = (store) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOOTBALL_DASHBOARD_STORAGE_KEY, JSON.stringify({
    version: 1,
    games: store.games || {},
  }));
};

const readSyncQueue = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch (error) {
    console.warn('Unable to read football server sync queue', error);
    return [];
  }
};

const writeSyncQueue = (items) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FOOTBALL_SYNC_QUEUE_STORAGE_KEY, JSON.stringify({
    version: 2,
    items,
  }));
};

const createMirrorSourceId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `mirror-${globalThis.crypto.randomUUID()}`;
  }
  return `mirror-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
};

const readMirrorSource = () => {
  if (typeof window === 'undefined') return { sources: {} };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOOTBALL_MIRROR_SOURCE_STORAGE_KEY) || 'null');
    if (parsed?.sources && typeof parsed.sources === 'object') {
      return { sources: parsed.sources };
    }
  } catch (error) {
    console.warn('Unable to read football mirror source identity', error);
  }
  return { sources: {} };
};

const nextMirrorIdentity = (gameId) => {
  const state = readMirrorSource();
  const source = state.sources?.[gameId];
  const mirrorSourceId = typeof source?.sourceId === 'string' && source.sourceId
    ? source.sourceId
    : createMirrorSourceId();
  const mirrorRevision = Math.max(0, Number(source?.revision || 0)) + 1;
  const next = {
    sources: {
      ...state.sources,
      [gameId]: { sourceId: mirrorSourceId, revision: mirrorRevision },
    },
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FOOTBALL_MIRROR_SOURCE_STORAGE_KEY, JSON.stringify({ version: 2, ...next }));
  }
  return { mirrorSourceId, mirrorRevision };
};

const adoptMirrorIdentity = (gameId, sourceId, revision) => {
  if (typeof window === 'undefined' || typeof sourceId !== 'string' || !sourceId || !Number.isSafeInteger(revision) || revision < 1) return;
  const state = readMirrorSource();
  window.localStorage.setItem(FOOTBALL_MIRROR_SOURCE_STORAGE_KEY, JSON.stringify({
    version: 2,
    sources: {
      ...state.sources,
      [gameId]: { sourceId, revision },
    },
  }));
};

export function checksumFootballEnvelope(envelope) {
  const serialized = JSON.stringify(envelope);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    hash ^= BigInt(code & 0xff);
    hash = (hash * prime) & mask;
    hash ^= BigInt((code >>> 8) & 0xff);
    hash = (hash * prime) & mask;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}:${serialized.length}`;
}

const envelopeSourceEventSequence = (envelope) => Math.max(
  Number(envelope?.stats?.sourceEventSequence || 0),
  ...(envelope?.events || []).map((event) => Number(event?.sequence || 0)),
);

const teamById = (teamId, fallback) =>
  footballTeamOptions.find((team) => team.teamId === teamId) || fallback;

const makeGameId = (homeTeamId, visitorTeamId, existingCount) => {
  const home = teamById(homeTeamId, { abbr: 'HOME' });
  const visitor = teamById(visitorTeamId, { abbr: 'VIS' });
  const suffix = String(existingCount + 1).padStart(3, '0');
  return `FB-${visitor.abbr}-AT-${home.abbr}-${suffix}`.replace(/[^A-Z0-9-]/gi, '-').toUpperCase();
};

export function seedFootballGameEnvelope({
  gameId,
  homeTeamId,
  visitorTeamId,
  gameDate,
  startTime,
  venue,
}) {
  const template = clone(getGameEnvelopeFixture(defaultFixtureKey));
  const home = teamById(homeTeamId, template.game.teams.H);
  const visitor = teamById(visitorTeamId, template.game.teams.V);
  const scheduledAt = `${gameDate || '2026-09-01'}T${startTime || '19:00'}:00`;
  const now = new Date().toISOString();

  return {
    ...template,
    gameId,
    updatedAt: now,
    game: {
      ...template.game,
      status: 'inProgress',
      period: 1,
      scheduledAt,
      venue: {
        ...template.game.venue,
        name: venue || template.game.venue.name,
      },
      teams: {
        H: {
          ...template.game.teams.H,
          teamId: home.teamId,
          name: home.name,
          abbr: home.abbr,
          score: 0,
        },
        V: {
          ...template.game.teams.V,
          teamId: visitor.teamId,
          name: visitor.name,
          abbr: visitor.abbr,
          score: 0,
        },
      },
    },
    rosters: {
      ...template.rosters,
      gameId,
      updatedAt: now,
      teams: {
        H: {
          ...template.rosters.teams.H,
          teamId: home.teamId,
          name: home.name,
          abbr: home.abbr,
        },
        V: {
          ...template.rosters.teams.V,
          teamId: visitor.teamId,
          name: visitor.name,
          abbr: visitor.abbr,
        },
      },
    },
    events: [],
    stats: {
      ...template.stats,
      sourceEventSequence: 0,
    },
  };
}

export function listFootballDashboardGames() {
  const store = readStore();
  return Object.values(store.games)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function createFootballDashboardGame(input) {
  const store = readStore();
  const games = store.games || {};
  const gameId = input.gameId || makeGameId(input.homeTeamId, input.visitorTeamId, Object.keys(games).length);
  const envelope = seedFootballGameEnvelope({ ...input, gameId });
  const home = envelope.game.teams.H;
  const visitor = envelope.game.teams.V;
  const createdAt = new Date().toISOString();
  const record = {
    gameId,
    createdAt,
    updatedAt: createdAt,
    gameDate: input.gameDate,
    startTime: input.startTime,
    venue: input.venue,
    homeTeamId: home.teamId,
    visitorTeamId: visitor.teamId,
    homeTeam: { teamId: home.teamId, name: home.name, abbr: home.abbr },
    visitorTeam: { teamId: visitor.teamId, name: visitor.name, abbr: visitor.abbr },
    rosterStatus: {
      H: Object.keys(envelope.rosters.teams.H.players || {}).length,
      V: Object.keys(envelope.rosters.teams.V.players || {}).length,
    },
    envelope,
  };

  writeStore({
    games: {
      ...games,
      [gameId]: record,
    },
  });

  return clone(record);
}

export function getDashboardSeededFootballEnvelopeRecord(gameId) {
  if (!gameId) return null;
  const store = readStore();
  const record = store.games?.[String(gameId)];
  if (!record?.envelope) return null;
  const clonedRecord = clone(record);
  clonedRecord.envelope = normalizeFootballEnvelopeRuleSpots(clonedRecord.envelope);
  return clonedRecord;
}

/**
 * The browser copy is the authoritative scoring envelope. A dashboard-created
 * game already has a record here; a server-hydrated game creates one exactly
 * once during startup and uses it for every later reload.
 */
export function saveDashboardSeededFootballEnvelope(gameId, envelope) {
  if (!gameId || !envelope) return null;
  const normalizedEnvelope = normalizeFootballEnvelopeRuleSpots(envelope);
  const store = readStore();
  const record = store.games?.[String(gameId)] || null;
  const updatedAt = new Date().toISOString();
  const home = normalizedEnvelope.game?.teams?.H || {};
  const visitor = normalizedEnvelope.game?.teams?.V || {};
  const nextRecord = {
    ...record,
    gameId: String(gameId),
    createdAt: record?.createdAt || updatedAt,
    gameDate: record?.gameDate || String(normalizedEnvelope.game?.scheduledAt || '').slice(0, 10),
    startTime: record?.startTime || String(normalizedEnvelope.game?.scheduledAt || '').slice(11, 16),
    venue: record?.venue || normalizedEnvelope.game?.venue?.name || '',
    homeTeamId: record?.homeTeamId || home.teamId || '',
    visitorTeamId: record?.visitorTeamId || visitor.teamId || '',
    homeTeam: record?.homeTeam || { teamId: home.teamId || '', name: home.name || '', abbr: home.abbr || 'H' },
    visitorTeam: record?.visitorTeam || { teamId: visitor.teamId || '', name: visitor.name || '', abbr: visitor.abbr || 'V' },
    rosterStatus: {
      H: Object.keys(envelope.rosters?.teams?.H?.players || {}).length,
      V: Object.keys(envelope.rosters?.teams?.V?.players || {}).length,
    },
    updatedAt,
    envelope: {
      ...normalizedEnvelope,
      updatedAt,
    },
  };
  writeStore({
    games: {
      ...store.games,
      [String(gameId)]: nextRecord,
    },
  });
  return clone(nextRecord.envelope);
}

const footballSyncItemId = ({ kind, payload }) => {
  if (kind === 'envelope') {
    return `envelope:${payload.gameId}:${payload.mirrorSourceId}:${payload.mirrorRevision}`;
  }
  if (kind === 'event' && payload?.event?.clientEventId) {
    return `event:${payload.event.clientEventId}`;
  }
  return `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
};

const footballSyncEndpoint = (item) => {
  if (item.dashboardGameId) {
    const gameId = encodeURIComponent(String(item.dashboardGameId));
    if (item.kind === 'envelope') return `/api/football/games/${gameId}/mirror`;
    if (item.kind === 'event') return `/api/football/games/${gameId}/events`;
    return `/api/football/games/${gameId}/pregame`;
  }
  return item.kind === 'event' ? FOOTBALL_EVENT_ENDPOINT : FOOTBALL_PREGAME_ENDPOINT;
};

export function getPendingFootballSyncCount(gameId = '') {
  return readSyncQueue().filter((item) => !gameId || item.gameId === String(gameId)).length;
}

export function discardPendingFootballSyncForGame(gameId) {
  if (!gameId) return 0;
  const current = readSyncQueue();
  const next = current.filter((item) => item.gameId !== String(gameId));
  const discarded = current.length - next.length;
  if (discarded > 0) writeSyncQueue(next);
  return discarded;
}

export function enqueueFootballServerSync({ gameId, dashboardGameId = '', kind, payload }) {
  if (!gameId || !payload || !['event', 'pregame', 'envelope'].includes(kind)) return null;
  const items = readSyncQueue();
  const item = {
    id: footballSyncItemId({ kind, payload }),
    gameId: String(gameId),
    dashboardGameId: dashboardGameId ? String(dashboardGameId) : '',
    kind,
    payload: clone(payload),
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    lastError: '',
  };
  if (items.some((existing) => existing.id === item.id)) return clone(item);
  writeSyncQueue([...items, item]);
  return clone(item);
}

/**
 * Replaces every older per-play/pregame queue item for this game with one
 * complete local envelope snapshot. The local envelope remains stored under
 * FOOTBALL_DASHBOARD_STORAGE_KEY; this queue is only a recoverable server
 * replication journal.
 */
export function enqueueFootballEnvelopeMirror({ gameId, dashboardGameId, envelope }) {
  if (!gameId || !dashboardGameId || !envelope || envelope.gameId !== String(gameId)) return null;
  const { mirrorSourceId, mirrorRevision } = nextMirrorIdentity(String(gameId));
  const payload = {
    schemaVersion: 'football.localEnvelopeMirrorRequest.v1',
    gameId: String(gameId),
    mirrorSourceId,
    mirrorRevision,
    sourceEventSequence: envelopeSourceEventSequence(envelope),
    eventCount: Array.isArray(envelope.events) ? envelope.events.length : 0,
    envelopeUpdatedAt: String(envelope.updatedAt || ''),
    checksum: checksumFootballEnvelope(envelope),
    envelope: clone(envelope),
  };
  const item = {
    id: footballSyncItemId({ kind: 'envelope', payload }),
    gameId: String(gameId),
    dashboardGameId: String(dashboardGameId),
    kind: 'envelope',
    payload,
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    lastError: '',
  };
  const otherGames = readSyncQueue().filter((candidate) => candidate.gameId !== String(gameId));
  writeSyncQueue([...otherGames, item]);
  return clone(item);
}

export function migratePendingFootballSyncToEnvelopeMirror({ gameId, dashboardGameId, envelope }) {
  const pending = readSyncQueue().filter((item) => item.gameId === String(gameId));
  if (!pending.some((item) => item.kind !== 'envelope')) return null;
  return enqueueFootballEnvelopeMirror({ gameId, dashboardGameId, envelope });
}

const removeSyncItem = (itemId) => {
  const current = readSyncQueue();
  const next = current.filter((item) => item.id !== itemId);
  if (next.length !== current.length) writeSyncQueue(next);
};

const markSyncItemFailed = (itemId, error) => {
  const current = readSyncQueue();
  const next = current.map((item) => item.id === itemId ? {
    ...item,
    attempts: Number(item.attempts || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: error,
  } : item);
  writeSyncQueue(next);
};

const retryStaleEnvelopeMirror = (item, responsePayload) => {
  const current = responsePayload?.current;
  if (
    item?.kind !== 'envelope'
    || responsePayload?.schemaVersion !== 'football.localEnvelopeMirrorError.v1'
    || responsePayload?.code !== 'MIRROR_CONFLICT'
    || item.conflictRetries
    || current?.gameId !== item.payload?.gameId
    || current?.mirrorSourceId !== item.payload?.mirrorSourceId
    || !Number.isSafeInteger(current?.mirrorRevision)
    || current.mirrorRevision < item.payload.mirrorRevision
  ) {
    return false;
  }

  const mirrorRevision = current.mirrorRevision + 1;
  const payload = { ...item.payload, mirrorRevision };
  const retryItem = {
    ...item,
    id: footballSyncItemId({ kind: item.kind, payload }),
    payload,
    conflictRetries: 1,
    attempts: Number(item.attempts || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: responsePayload.error || 'Football mirror revision conflict.',
  };
  const queue = readSyncQueue();
  if (!queue.some((candidate) => candidate.id === item.id)) return false;
  writeSyncQueue(queue.map((candidate) => candidate.id === item.id ? retryItem : candidate));
  adoptMirrorIdentity(item.gameId, item.payload.mirrorSourceId, mirrorRevision);
  return true;
};

const mirrorAckError = (item, payload) => {
  if (!payload || payload.schemaVersion !== 'football.localEnvelopeMirrorAck.v1') {
    return 'Server mirror returned an invalid acknowledgment.';
  }
  const expected = item.payload;
  if (
    !['mirrored', 'duplicate'].includes(payload.status)
    || payload.gameId !== expected.gameId
    || payload.mirrorSourceId !== expected.mirrorSourceId
    || payload.mirrorRevision !== expected.mirrorRevision
    || payload.checksum !== expected.checksum
    || payload.sourceEventSequence !== expected.sourceEventSequence
    || payload.eventCount !== expected.eventCount
    || payload.envelopeUpdatedAt !== expected.envelopeUpdatedAt
  ) {
    return 'Server mirror acknowledgment did not match the local envelope snapshot.';
  }
  return '';
};

let activeFootballSync = null;

export async function flushFootballServerSync({ fetchImpl = globalThis.fetch } = {}) {
  if (activeFootballSync) return activeFootballSync;
  activeFootballSync = (async () => {
    if (typeof fetchImpl !== 'function') {
      return { pendingCount: readSyncQueue().length, syncedCount: 0, error: 'No network connection is available.' };
    }
    let syncedCount = 0;
    let error = '';
    while (readSyncQueue().length > 0) {
      const item = readSyncQueue()[0];
      let response;
      let responsePayload = null;
      try {
        response = await fetchImpl(footballSyncEndpoint(item), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(item.payload),
        });
        responsePayload = await response.json().catch(() => null);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Server sync failed.';
      }
      if (response?.ok) {
        if (item.kind === 'envelope') {
          error = mirrorAckError(item, responsePayload);
          if (error) {
            markSyncItemFailed(item.id, error);
            break;
          }
        }
        removeSyncItem(item.id);
        syncedCount += 1;
        continue;
      }
      if (response?.status === 409 && retryStaleEnvelopeMirror(item, responsePayload)) {
        continue;
      }
      if (!error) {
        error = responsePayload?.error || `Server sync failed (${response?.status || 'network'}).`;
      }
      markSyncItemFailed(item.id, error);
      break;
    }
    return { pendingCount: readSyncQueue().length, syncedCount, error };
  })();
  try {
    return await activeFootballSync;
  } finally {
    activeFootballSync = null;
  }
}

export async function persistFootballPregameEnvelope(gameId, envelope, { dashboardGameId = '' } = {}) {
  const localEnvelope = saveDashboardSeededFootballEnvelope(gameId, envelope);
  if (!localEnvelope) throw new Error('Pregame configuration could not be saved to this browser.');
  if (dashboardGameId) {
    enqueueFootballEnvelopeMirror({
      gameId,
      dashboardGameId,
      envelope: localEnvelope,
    });
  }
  return localEnvelope;
}

export async function persistFootballWrapUpEnvelope(gameId, envelope, { dashboardGameId = '' } = {}) {
  const localEnvelope = saveDashboardSeededFootballEnvelope(gameId, envelope);
  if (!localEnvelope) throw new Error('Game wrap-up could not be saved to this browser.');
  if (dashboardGameId) {
    enqueueFootballEnvelopeMirror({
      gameId,
      dashboardGameId,
      envelope: localEnvelope,
    });
  }
  return localEnvelope;
}

export async function fetchFootballEnvelope(gameId, { dashboardGameId = '', signal, fetchImpl = globalThis.fetch } = {}) {
  if (!gameId) {
    throw new Error('A valid gameId is required to load a football envelope.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available to load a football envelope.');
  }

  const url = dashboardGameId
    ? `/api/football/games/${encodeURIComponent(String(dashboardGameId))}/envelope`
    : `${FOOTBALL_ENVELOPE_ENDPOINT_PREFIX}?gameId=${encodeURIComponent(String(gameId))}`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Football envelope request failed (${response.status}).`);
  }
  if (!payload || payload.schemaVersion !== 'football.gameEnvelope.v1') {
    throw new Error('Football envelope API returned an unexpected payload.');
  }
  if (payload.gameId !== String(gameId)) {
    throw new Error('Football envelope API returned a different game.');
  }
  if (dashboardGameId) {
    const mirrorSourceId = response.headers?.get?.('X-Strata-Football-Mirror-Source');
    const mirrorRevision = Number(response.headers?.get?.('X-Strata-Football-Mirror-Revision') || 0);
    adoptMirrorIdentity(String(gameId), mirrorSourceId, mirrorRevision);
  }

  return normalizeFootballEnvelopeRuleSpots(payload);
}

export async function recoverFootballEnvelopeFromServer(gameId, options = {}) {
  const recoveredEnvelope = await fetchFootballEnvelope(gameId, options);
  discardPendingFootballSyncForGame(gameId);
  const savedEnvelope = saveDashboardSeededFootballEnvelope(gameId, recoveredEnvelope);
  if (!savedEnvelope) {
    throw new Error('The recovered football envelope could not be saved to this browser.');
  }
  return savedEnvelope;
}

const nextAcceptedEventSequence = (envelope, event) => {
  if (Number.isInteger(event?.sequence)) return event.sequence;
  return (envelope?.events || []).reduce(
    (maximum, existing) => Math.max(maximum, Number(existing?.sequence || 0)),
    0,
  ) + 1;
};

const normalizeAcceptedEvent = (envelope, event, acceptedAt = new Date().toISOString()) => {
  const sequence = nextAcceptedEventSequence(envelope, event);
  return {
    ...event,
    eventId: event.eventId || `LOCAL-${String(sequence).padStart(6, '0')}`,
    sequence,
    status: 'accepted',
    acceptedAt: event.acceptedAt || acceptedAt,
    createdAt: event.createdAt || acceptedAt,
  };
};

const appendEvent = (events = [], event) => {
  const duplicate = events.some((existing) => (
    (event.eventId && existing.eventId === event.eventId)
    || (event.clientEventId && existing.clientEventId === event.clientEventId)
  ));
  return duplicate ? events : [...events, event];
};

const comparableSubmittedEvent = (event = {}) => {
  const {
    eventId: _eventId,
    sequence: _sequence,
    status: _status,
    acceptedAt: _acceptedAt,
    createdAt: _createdAt,
    ...submittedFields
  } = event;
  return submittedFields;
};

const isSameSubmittedEvent = (existing, submitted) => (
  JSON.stringify(comparableSubmittedEvent(existing))
  === JSON.stringify(comparableSubmittedEvent(submitted))
);

const applyScoringUpdate = (teams, scoring) => {
  if (!scoring?.team || typeof scoring.points !== 'number') return teams;
  return {
    ...teams,
    [scoring.team]: {
      ...teams[scoring.team],
      score: Number(teams[scoring.team]?.score || 0) + scoring.points,
    },
  };
};

const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validTeamCode = (team) => team === 'H' || team === 'V';

const kickoffReceivingTeam = (event) => {
  const returnTeam = event?.participants?.returner?.team;
  if (validTeamCode(returnTeam)) return returnTeam;
  const kickingTeam = event?.participants?.kicker?.team
    || event?.participants?.primary?.team
    || event?.possession;
  if (validTeamCode(kickingTeam)) return kickingTeam === 'H' ? 'V' : 'H';
  const nextPossession = event?.result?.nextPossession || event?.postState?.possession;
  return validTeamCode(nextPossession) ? nextPossession : null;
};

const repairKickoffReturnFumbleDriveReasons = (envelope) => {
  const events = [...(envelope?.events || [])]
    .filter((event) => !event.status || event.status === 'accepted')
    .sort((left, right) => finiteNumber(left.sequence) - finiteNumber(right.sequence));
  const firstEventIndexByDrive = new Map();
  events.forEach((event, index) => {
    const driveId = event?.preState?.driveId;
    if (driveId && !firstEventIndexByDrive.has(driveId)) firstEventIndexByDrive.set(driveId, index);
  });

  const repairDrive = (drive) => {
    if (!drive || String(drive.startReason || '').toLowerCase() !== 'kickoff') return drive;
    const firstDriveEventIndex = firstEventIndexByDrive.get(drive.driveId);
    if (!Number.isInteger(firstDriveEventIndex) || firstDriveEventIndex < 1) return drive;
    const acquisition = events[firstDriveEventIndex - 1];
    const recoveryTeam = acquisition?.result?.turnover?.recoveredBy
      || acquisition?.result?.turnover?.team
      || acquisition?.result?.fumble?.recoveredByTeam
      || acquisition?.result?.nextPossession;
    const kickingTeam = acquisition?.participants?.kicker?.team
      || acquisition?.participants?.primary?.team
      || acquisition?.possession;
    const isKickoffReturnFumble = acquisition?.type === 'kickoff' && Boolean(
      acquisition?.result?.fumble?.turnover
      || acquisition?.result?.turnover?.type === 'fumble',
    );
    if (!isKickoffReturnFumble || recoveryTeam !== kickingTeam || drive.team !== recoveryTeam) return drive;
    return { ...drive, startReason: 'fumbleRecovery' };
  };

  const current = repairDrive(envelope?.drives?.current || null);
  const completed = (envelope?.drives?.completed || []).map(repairDrive);
  const changed = current !== envelope?.drives?.current
    || completed.some((drive, index) => drive !== envelope?.drives?.completed?.[index]);
  if (!changed) return envelope;
  return { ...envelope, drives: { ...envelope.drives, current, completed } };
};

const ownTeamRuleSpot = (spot, team) => {
  if (!validTeamCode(team) || !spot) return spot || null;
  if (spot === '50' || spot === 'H50' || spot === 'V50') return '50';
  const yard = String(spot).match(/^[HV](\d{1,2})$/)?.[1];
  return yard ? `${team}${yard.padStart(2, '0')}` : spot;
};

const isUsableBallSpot = (spot) => {
  const parsed = parseSpot(spot);
  return parsed.valid && !parsed.goal;
};

const repairMissingOpeningKickoffSpot = (envelope) => {
  const awaitingKickoff = envelope?.pregame?.gamePhase === 'awaitingKickoff'
    || envelope?.liveState?.nextPlayContext === 'awaitingKickoff';
  if (!awaitingKickoff || isUsableBallSpot(envelope?.liveState?.yardLine)) return envelope;

  const kickoffAccepted = (envelope?.events || []).some((event) => (
    event?.type === 'kickoff' && (!event.status || event.status === 'accepted')
  ));
  const toss = envelope?.pregame?.coinToss;
  if (kickoffAccepted || toss?.status !== 'complete') return envelope;

  const kickoffTeam = validTeamCode(envelope?.liveState?.kickoffTeam)
    ? envelope.liveState.kickoffTeam
    : toss.firstHalfKickingTeam;
  if (!validTeamCode(kickoffTeam)) return envelope;

  const kickoffSpot = ownTeamRuleSpot(envelope?.game?.rules?.kickoffSpot || 'H35', kickoffTeam);
  if (!isUsableBallSpot(kickoffSpot)) return envelope;

  return {
    ...envelope,
    liveState: {
      ...envelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: kickoffSpot,
      lineToGain: null,
      goalToGo: false,
      redZone: false,
      driveId: null,
      pendingTryTeam: null,
      kickoffTeam,
      nextPlayContext: 'awaitingKickoff',
    },
  };
};

const repairReplayDownThatReachedLineToGain = (envelope) => {
  const liveState = envelope?.liveState;
  if (!validTeamCode(liveState?.possession) || !Number.isFinite(Number(liveState?.down))) return envelope;
  const yardsToGain = calculateYardsToGain(liveState.yardLine, liveState.lineToGain, liveState.possession);
  if (yardsToGain !== 0) return envelope;

  const latestEvent = [...(envelope?.events || [])]
    .reverse()
    .find((event) => !event.status || event.status === 'accepted');
  const replayPenaltyReachedLine = latestEvent?.penalties?.some((penalty) => (
    penalty.status === 'accepted'
    && penalty.replayDown
    && penalty.finalSpot === liveState.yardLine
  ));
  if (!replayPenaltyReachedLine || !latestEvent?.preState) return envelope;

  const projection = applyFootballEventToEnvelope({
    ...envelope,
    liveState: { ...liveState, ...latestEvent.preState },
  }, latestEvent);
  if (!projection.firstDown || projection.liveState?.down !== 1) return envelope;

  return {
    ...envelope,
    liveState: { ...liveState, ...projection.liveState },
  };
};

export function normalizeFootballScoringSetupEnvelope(envelope) {
  const normalizedRuleEnvelope = normalizeFootballEnvelopeRuleSpots(envelope);
  const repairedOpeningEnvelope = repairMissingOpeningKickoffSpot(normalizedRuleEnvelope);
  const repairedSeriesEnvelope = repairReplayDownThatReachedLineToGain(repairedOpeningEnvelope);
  const repairedDriveEnvelope = repairKickoffReturnFumbleDriveReasons(repairedSeriesEnvelope);
  const replayedStats = repairFootballStatsFromCompleteEventLog(repairedDriveEnvelope);
  const repairedStats = repairFootballPossessionTimeFromDrives(repairedDriveEnvelope, replayedStats);
  const normalizedEnvelope = repairedStats === repairedDriveEnvelope?.stats
    ? repairedDriveEnvelope
    : { ...repairedDriveEnvelope, stats: repairedStats };
  const latestEvent = [...(normalizedEnvelope?.events || [])]
    .reverse()
    .find((event) => !event.status || event.status === 'accepted');
  const completedScoringSequence = latestEvent?.type === 'try'
    || (
      latestEvent?.type === 'fieldGoal'
      && (latestEvent.subtype === 'made' || latestEvent.result?.code === 'made')
    );
  if (!completedScoringSequence || normalizedEnvelope?.liveState?.possession) return normalizedEnvelope;

  const kickoffTeam = latestEvent?.result?.scoring?.team
    || latestEvent?.participants?.primary?.team
    || latestEvent?.participants?.kicker?.team
    || latestEvent?.possession;
  if (!validTeamCode(kickoffTeam)) return normalizedEnvelope;

  const kickoffSpot = ownTeamRuleSpot(normalizedEnvelope?.game?.rules?.kickoffSpot || 'H35', kickoffTeam);
  if (
    normalizedEnvelope.liveState?.nextPlayContext === 'awaitingKickoff'
    && normalizedEnvelope.liveState?.kickoffTeam === kickoffTeam
    && normalizedEnvelope.liveState?.pendingTryTeam == null
    && normalizedEnvelope.liveState?.yardLine === kickoffSpot
  ) return normalizedEnvelope;

  return {
    ...normalizedEnvelope,
    liveState: {
      ...normalizedEnvelope.liveState,
      possession: null,
      down: null,
      distance: null,
      yardLine: kickoffSpot,
      lineToGain: null,
      goalToGo: false,
      redZone: false,
      driveId: null,
      pendingTryTeam: null,
      kickoffTeam,
      nextPlayContext: 'awaitingKickoff',
    },
  };
}

const updateTeamStat = (teams, team, updater) => {
  if (!validTeamCode(team)) return teams;
  return {
    ...teams,
    [team]: updater({ ...(teams[team] || {}) }),
  };
};

const updatePlayerStat = (players, playerId, team, updater) => {
  if (!playerId) return players;
  return {
    ...players,
    [playerId]: updater({ ...(players[playerId] || {}), playerId, team }),
  };
};

const hasAcceptedSpotOfFoulPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && penalty.spotOfFoul
  && (penalty.enforcedFrom === 'SPOT' || penalty.enforcedFrom === 'spotOfFoul')
));

const hasAcceptedPreviousSpotPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted'
  && (penalty.enforcedFrom === 'PREVIOUS' || penalty.enforcedFrom === 'previousSpot')
));

const hasReplayDownPenalty = (event) => (event?.penalties || []).some((penalty) => (
  (penalty.status === 'accepted' || penalty.status === 'offsetting')
  && penalty.replayDown
));

const hasAcceptedAutomaticFirstDownPenalty = (event) => (event?.penalties || []).some((penalty) => (
  penalty.status === 'accepted' && penalty.automaticFirstDown
));

const sameDrive = (left, right) => {
  const leftDriveId = left?.preState?.driveId;
  const rightDriveId = right?.preState?.driveId;
  if (leftDriveId && rightDriveId) return leftDriveId === rightDriveId;
  return Number.isFinite(Number(left?.preState?.driveNumber))
    && Number(left.preState.driveNumber) === Number(right?.preState?.driveNumber);
};

const touchdownEarnsFirstDown = (event, projection, eventHistory = []) => {
  const touchdown = event?.result?.scoring?.type === 'touchdown'
    || projection?.scoringUpdate?.type === 'touchdown';
  if (!touchdown || !['rush', 'pass'].includes(event?.type)) return false;

  if (String(event?.preState?.lineToGain || '').toLowerCase() !== 'goal') return true;

  let seriesStartSpot = Number(event?.preState?.down) === 1
    ? event?.preState?.yardLine
    : null;
  if (!seriesStartSpot) {
    const priorSeriesPlay = [...eventHistory]
      .reverse()
      .find((candidate) => (
        (!candidate?.status || candidate.status === 'accepted')
        && Number(candidate?.sequence) < Number(event?.sequence)
        && candidate?.possession === event?.possession
        && ['rush', 'pass', 'penalty'].includes(candidate?.type)
        && Number(candidate?.preState?.down) === 1
        && sameDrive(candidate, event)
      ));
    seriesStartSpot = priorSeriesPlay?.preState?.yardLine ?? null;
  }

  const seriesStart = spotToPossessionRelative(seriesStartSpot, event?.possession);
  return Number.isFinite(seriesStart) && 100 - seriesStart >= 10;
};

const playEarnedFirstDown = (event, projection, eventHistory) => {
  if (
    !['rush', 'pass'].includes(event?.type)
    || hasAcceptedPreviousSpotPenalty(event)
    || hasReplayDownPenalty(event)
  ) return false;
  if (event?.result?.firstDown === true) return true;
  if (
    event?.result?.scoring?.type === 'touchdown'
    || projection?.scoringUpdate?.type === 'touchdown'
  ) return touchdownEarnsFirstDown(event, projection, eventHistory);
  const yardsToGain = calculateYardsToGain(
    event?.preState?.yardLine,
    event?.preState?.lineToGain,
    event?.possession,
  );
  return Number.isFinite(projection?.yardsGained)
    && Number.isFinite(yardsToGain)
    && projection.yardsGained >= yardsToGain;
};

const offenseLostPossession = (event, offense) => {
  const officialOutcome = event?.result?.officialOutcome;
  const officialState = officialOutcome?.source === 'penaltyEnforcement'
    ? officialOutcome.verified || officialOutcome.calculated
    : null;
  if (validTeamCode(officialState?.possession)) {
    return officialState.possession !== offense;
  }
  if (hasAcceptedPreviousSpotPenalty(event) && (hasReplayDownPenalty(event) || hasAcceptedAutomaticFirstDownPenalty(event))) {
    return false;
  }
  const recoveredByTeam = event?.result?.fumble?.recoveredByTeam;
  const turnoverTeam = event?.result?.turnover?.team;
  const nextPossession = event?.result?.nextPossession;
  return Boolean(
    (event?.result?.fumble?.turnover && recoveredByTeam && recoveredByTeam !== offense)
    || (turnoverTeam && turnoverTeam !== offense)
    || (nextPossession && nextPossession !== offense),
  );
};

const acceptedReturnTeamSpotOfFoul = (event, returnTeam) => [...(event?.penalties || [])]
  .reverse()
  .find((penalty) => (
    penalty.status === 'accepted'
    && penalty.team === returnTeam
    && penalty.spotOfFoul
    && (penalty.enforcedFrom === 'SPOT' || penalty.enforcedFrom === 'spotOfFoul')
  ));

const kickoffReturnStat = (event) => {
  if (event?.type !== 'kickoff') return null;
  const result = event?.result || {};
  const returner = event?.participants?.returner || event?.participants?.fumbler;
  const kickingTeam = event?.participants?.kicker?.team || event?.participants?.primary?.team;
  const returnTeam = returner?.team || oppositeTeam(kickingTeam);

  if (result.return?.type === 'Kickoff') {
    const spotOfFoul = acceptedReturnTeamSpotOfFoul(event, returnTeam)?.spotOfFoul;
    const returnStartYardLine = result.return.returnStartYardLine || result.kick?.catchYardLine;
    const spotOfFoulYards = spotOfFoul
      ? calculateYardsGained(returnStartYardLine, spotOfFoul, returnTeam)
      : null;
    return {
      returner,
      returnTeam,
      returnYards: Number.isFinite(spotOfFoulYards)
        ? spotOfFoulYards
        : finiteNumber(result.return.returnYards),
    };
  }

  const muffed = event?.subtype === 'muffed'
    || result.code === 'muffed'
    || result.kick?.receiveResultCode === 'M';
  if (!muffed || !validTeamCode(returnTeam)) return null;

  const returnYards = calculateYardsGained(
    result.kick?.catchYardLine,
    result.fumble?.recoverySpot || result.endYardLine,
    returnTeam,
  );
  if (!Number.isFinite(returnYards)) return null;
  return { returner, returnTeam, returnYards };
};

const blockedPuntStat = (event) => {
  if (event?.type !== 'punt') return null;
  const blockedByPlayerId = event?.result?.kick?.blockedByPlayerId;
  const blocker = (event?.participants?.defenders || []).find((participant) => (
    participant?.playerId === blockedByPlayerId || participant?.role === 'blocker'
  ));
  if (!blockedByPlayerId && !blocker) return null;

  const rawPuntYards = finiteNumber(event?.result?.kick?.kickYards ?? event?.result?.kickYards);
  return {
    blocker,
    blockingTeam: blocker?.team || oppositeTeam(event?.possession),
    puntYards: Math.max(0, rawPuntYards),
    returnYardsBeforeRecovery: Math.max(0, -rawPuntYards),
  };
};

const puntReturnStat = (event, blockedPunt) => {
  const result = event?.result || {};
  const returner = event?.participants?.returner;
  const hasReturn = result.return?.type === 'Punt';
  const returnYardsAfterRecovery = hasReturn ? finiteNumber(result.return?.returnYards) : 0;

  if (blockedPunt?.returnYardsBeforeRecovery > 0) {
    const blockerIsReturner = blockedPunt.blocker?.playerId
      && blockedPunt.blocker.playerId === returner?.playerId;
    return {
      returnTeam: blockedPunt.blockingTeam,
      returnYards: blockedPunt.returnYardsBeforeRecovery + returnYardsAfterRecovery,
      playerCredits: [
        blockedPunt.blocker && {
          participant: blockedPunt.blocker,
          attempts: 1,
          yards: blockedPunt.returnYardsBeforeRecovery + (blockerIsReturner ? returnYardsAfterRecovery : 0),
        },
        hasReturn && returner && !blockerIsReturner && {
          participant: returner,
          attempts: 0,
          yards: returnYardsAfterRecovery,
        },
      ].filter(Boolean),
    };
  }

  if (!hasReturn) return null;
  return {
    returnTeam: returner?.team || result.nextPossession,
    returnYards: returnYardsAfterRecovery,
    playerCredits: returner ? [{ participant: returner, attempts: 1, yards: returnYardsAfterRecovery }] : [],
  };
};

const projectFootballStats = (stats = {}, event, projection, eventHistory = []) => {
  let teams = { ...(stats.teams || {}) };
  let players = { ...(stats.players || {}) };
  const offense = event?.possession;
  const result = event?.result || {};
  const primary = event?.participants?.primary;
  const secondary = event?.participants?.receiver || event?.participants?.secondary || event?.participants?.target;
  const suppressPlayStats = hasAcceptedPreviousSpotPenalty(event);
  const teamCharged = result.teamCharged === true;

  if (validTeamCode(offense) && event.type === 'rush' && !suppressPlayStats) {
    const yards = hasAcceptedSpotOfFoulPenalty(event)
      ? finiteNumber(projection?.yardsGained, result.yards)
      : finiteNumber(result.yards, projection?.yardsGained);
    teams = updateTeamStat(teams, offense, (current) => ({
      ...current,
      rushAttempts: finiteNumber(current.rushAttempts) + 1,
      rushYards: finiteNumber(current.rushYards) + yards,
      plays: finiteNumber(current.plays) + 1,
      yards: finiteNumber(current.yards) + yards,
    }));
    if (!teamCharged) {
      players = updatePlayerStat(players, primary?.playerId, offense, (current) => ({
        ...current,
        rushAttempts: finiteNumber(current.rushAttempts) + 1,
        rushYards: finiteNumber(current.rushYards) + yards,
      }));
    }
  }

  if (validTeamCode(offense) && event.type === 'pass' && !suppressPlayStats) {
    const outcome = result.pass?.outcome || event.subtype;
    const isAttempt = ['complete', 'incomplete', 'interception'].includes(outcome);
    const passingYards = outcome === 'complete'
      ? hasAcceptedSpotOfFoulPenalty(event)
        ? finiteNumber(projection?.yardsGained, result.pass?.passingYards ?? result.yards)
        : finiteNumber(result.pass?.passingYards ?? result.yards, projection?.yardsGained)
      : event.subtype === 'sack'
        ? finiteNumber(result.yards)
        : 0;
    teams = updateTeamStat(teams, offense, (current) => {
      const pass = { ...(current.pass || {}) };
      return {
        ...current,
        pass: {
          ...pass,
          att: finiteNumber(pass.att) + (isAttempt ? 1 : 0),
          cmp: finiteNumber(pass.cmp) + (outcome === 'complete' ? 1 : 0),
          int: finiteNumber(pass.int) + (outcome === 'interception' ? 1 : 0),
          yds: finiteNumber(pass.yds) + (outcome === 'complete' ? passingYards : 0),
        },
        plays: finiteNumber(current.plays) + 1,
        yards: finiteNumber(current.yards) + passingYards,
      };
    });
    if (!teamCharged) {
      players = updatePlayerStat(players, primary?.playerId, offense, (current) => ({
        ...current,
        passAttempts: finiteNumber(current.passAttempts) + (isAttempt ? 1 : 0),
        passCompletions: finiteNumber(current.passCompletions) + (outcome === 'complete' ? 1 : 0),
        passInterceptions: finiteNumber(current.passInterceptions) + (outcome === 'interception' ? 1 : 0),
        passYards: finiteNumber(current.passYards) + (outcome === 'complete' ? passingYards : 0),
      }));
      players = updatePlayerStat(players, secondary?.playerId, secondary?.team || offense, (current) => ({
        ...current,
        targets: finiteNumber(current.targets) + (isAttempt ? 1 : 0),
        receptions: finiteNumber(current.receptions) + (outcome === 'complete' ? 1 : 0),
        receivingYards: finiteNumber(current.receivingYards) + (outcome === 'complete' ? passingYards : 0),
      }));
    }

    if (event.subtype === 'sack' || outcome === 'sack') {
      const sackYards = finiteNumber(result.yards, projection?.yardsGained);
      teams = updateTeamStat(teams, offense, (current) => ({
        ...current,
        rushAttempts: finiteNumber(current.rushAttempts) + 1,
        rushYards: finiteNumber(current.rushYards) + sackYards,
      }));
      players = updatePlayerStat(players, primary?.playerId, offense, (current) => ({
        ...current,
        rushAttempts: finiteNumber(current.rushAttempts) + 1,
        rushYards: finiteNumber(current.rushYards) + sackYards,
      }));
    }
  }

  if (result.fumble && !suppressPlayStats) {
    const fumblerPlayerId = result.fumble.fumblerPlayerId;
    const fumbler = event?.participants?.fumbler
      || [
        event?.participants?.returner,
        event?.participants?.receiver,
        event?.participants?.secondary,
        event?.participants?.primary,
      ].find((participant) => participant?.playerId === fumblerPlayerId);
    const fumbleTeam = teamCharged ? offense : fumbler?.team;
    teams = updateTeamStat(teams, fumbleTeam, (current) => ({
      ...current,
      fumbles: {
        ...(typeof current.fumbles === 'object' ? current.fumbles : {}),
        num: finiteNumber(current.fumbles?.num ?? current.fumbles) + 1,
        lost: finiteNumber(current.fumbles?.lost ?? current.fumblesLost) + (result.fumble.turnover ? 1 : 0),
      },
    }));
    if (!teamCharged) {
      players = updatePlayerStat(players, fumblerPlayerId, fumbleTeam, (current) => ({
        ...current,
        fumbles: finiteNumber(current.fumbles) + 1,
        fumblesLost: finiteNumber(current.fumblesLost) + (result.fumble.turnover ? 1 : 0),
      }));
    }
  }

  const kickoffReturn = kickoffReturnStat(event);
  if (kickoffReturn && !suppressPlayStats) {
    const { returner, returnTeam, returnYards } = kickoffReturn;
    teams = updateTeamStat(teams, returnTeam, (current) => ({
      ...current,
      kickReturns: {
        ...(typeof current.kickReturns === 'object' ? current.kickReturns : {}),
        num: finiteNumber(current.kickReturns?.num ?? current.kickReturnCount) + 1,
        yds: finiteNumber(current.kickReturns?.yds ?? current.kickReturnYds) + returnYards,
      },
    }));
    players = updatePlayerStat(players, returner?.playerId, returnTeam, (current) => ({
      ...current,
      kickReturns: finiteNumber(current.kickReturns) + 1,
      kickReturnYards: finiteNumber(current.kickReturnYards) + returnYards,
    }));
  }

  const blockedPunt = blockedPuntStat(event);
  if (validTeamCode(offense) && event.type === 'punt' && !suppressPlayStats) {
    const puntYards = blockedPunt?.puntYards
      ?? finiteNumber(result.kick?.kickYards ?? result.kickYards);
    teams = updateTeamStat(teams, offense, (current) => {
      const count = finiteNumber(current.punts?.num ?? current.punts) + 1;
      const yards = finiteNumber(current.punts?.yds ?? current.puntYards) + puntYards;
      return {
        ...current,
        punts: {
          ...(typeof current.punts === 'object' ? current.punts : {}),
          num: count,
          yds: yards,
          avg: count > 0 ? yards / count : 0,
        },
      };
    });
    if (!blockedPunt) {
      const punter = event?.participants?.punter || primary;
      players = updatePlayerStat(players, punter?.playerId, offense, (current) => ({
        ...current,
        punts: finiteNumber(current.punts) + 1,
        puntYards: finiteNumber(current.puntYards) + puntYards,
      }));
    }
  }

  const puntReturn = event.type === 'punt' && !suppressPlayStats ? puntReturnStat(event, blockedPunt) : null;
  if (puntReturn) {
    const { returnTeam, returnYards, playerCredits } = puntReturn;
    teams = updateTeamStat(teams, returnTeam, (current) => ({
      ...current,
      puntReturns: {
        ...(typeof current.puntReturns === 'object' ? current.puntReturns : {}),
        num: finiteNumber(current.puntReturns?.num ?? current.puntReturnCount) + 1,
        yds: finiteNumber(current.puntReturns?.yds ?? current.puntReturnYds) + returnYards,
      },
    }));
    for (const credit of playerCredits) {
      players = updatePlayerStat(players, credit.participant?.playerId, credit.participant?.team || returnTeam, (current) => ({
        ...current,
        puntReturns: finiteNumber(current.puntReturns) + credit.attempts,
        puntReturnYards: finiteNumber(current.puntReturnYards) + credit.yards,
      }));
    }
  }

  const prePlayDown = Number(event?.preState?.down);
  if (
    validTeamCode(offense)
    && (prePlayDown === 3 || prePlayDown === 4)
    && ['rush', 'pass'].includes(event?.type)
    && !suppressPlayStats
    && !hasReplayDownPenalty(event)
  ) {
    const converted = Boolean(
      !offenseLostPossession(event, offense)
      && (
        projection?.firstDown
        || result.firstDown
        || result.scoring?.type === 'touchdown'
      ),
    );
    const statKey = prePlayDown === 3 ? 'thirdDown' : 'fourthDown';
    teams = updateTeamStat(teams, offense, (current) => ({
      ...current,
      [statKey]: {
        ...(typeof current[statKey] === 'object' ? current[statKey] : {}),
        att: finiteNumber(current[statKey]?.att) + 1,
        made: finiteNumber(current[statKey]?.made) + (converted ? 1 : 0),
      },
    }));
  }

  const touchdown = result.scoring?.type === 'touchdown'
    || projection?.scoringUpdate?.type === 'touchdown';
  const baseFirstDownCredit = !offenseLostPossession(event, offense) && (
    touchdown
      ? touchdownEarnsFirstDown(event, projection, eventHistory)
      : Boolean(projection?.firstDown || result.firstDown)
  );
  const additionalAutomaticFirstDownCredit = (
    playEarnedFirstDown(event, projection, eventHistory)
    && hasAcceptedAutomaticFirstDownPenalty(event)
  );
  const officialOutcome = result.officialOutcome?.source === 'penaltyEnforcement'
    ? result.officialOutcome.verified || result.officialOutcome.calculated
    : null;
  const firstDownCredits = officialOutcome
    ? Number(officialOutcome.firstDownAwarded === true && officialOutcome.firstDownAwardedTo === offense)
    : Number(baseFirstDownCredit) + Number(additionalAutomaticFirstDownCredit);
  if (
    validTeamCode(offense)
    && firstDownCredits > 0
    && (officialOutcome || hasAcceptedAutomaticFirstDownPenalty(event) || ['rush', 'pass', 'penalty'].includes(event?.type))
  ) {
    teams = updateTeamStat(teams, offense, (current) => ({
      ...current,
      firstDowns: finiteNumber(current.firstDowns) + firstDownCredits,
    }));
  }

  for (const penalty of event?.penalties || []) {
    if (penalty.status !== 'accepted' || !validTeamCode(penalty.team)) continue;
    teams = updateTeamStat(teams, penalty.team, (current) => ({
      ...current,
      penalties: {
        ...(typeof current.penalties === 'object' ? current.penalties : {}),
        num: finiteNumber(current.penalties?.num ?? current.penalties) + 1,
        yds: finiteNumber(current.penalties?.yds ?? current.penaltyYds) + Math.abs(finiteNumber(penalty.yards)),
      },
    }));
  }

  return {
    ...stats,
    sourceEventSequence: event.sequence,
    teams,
    players,
  };
};

const PROJECTED_TEAM_STAT_KEYS = [
  'firstDowns',
  'rushAttempts',
  'rushYards',
  'pass',
  'plays',
  'yards',
  'kickReturns',
  'puntReturns',
  'punts',
  'thirdDown',
  'fourthDown',
  'penalties',
  'fumbles',
];

const PROJECTED_PLAYER_STAT_KEYS = [
  'rushAttempts',
  'rushYards',
  'passAttempts',
  'passCompletions',
  'passInterceptions',
  'passYards',
  'targets',
  'receptions',
  'receivingYards',
  'kickReturns',
  'kickReturnYards',
  'puntReturns',
  'puntReturnYards',
  'punts',
  'puntYards',
  'fumbles',
  'fumblesLost',
];

const replaceProjectedKeys = (current = {}, projected = {}, keys = []) => {
  const preserved = { ...current };
  keys.forEach((key) => delete preserved[key]);
  return { ...preserved, ...projected };
};

export function projectFootballStatsForEvents(envelope, selectedEvents = envelope?.events || []) {
  const acceptedEvents = [...(envelope?.events || [])]
    .filter((event) => (!event.status || event.status === 'accepted') && Number.isFinite(Number(event.sequence)))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const selectedSequences = new Set(
    [...selectedEvents]
      .filter((event) => !event?.status || event.status === 'accepted')
      .map((event) => Number(event.sequence))
      .filter(Number.isFinite),
  );
  let projectedStats = {
    sourceEventSequence: 0,
    teams: {},
    players: {},
  };
  acceptedEvents.forEach((event) => {
    if (!selectedSequences.has(Number(event.sequence))) return;
    const replayEnvelope = {
      ...envelope,
      liveState: { ...(envelope?.liveState || {}), ...(event.preState || {}) },
    };
    const projection = applyFootballEventToEnvelope(replayEnvelope, event);
    projectedStats = projectFootballStats(projectedStats, event, projection, acceptedEvents);
  });
  return projectedStats;
}

function repairFootballStatsFromCompleteEventLog(envelope) {
  const acceptedEvents = [...(envelope?.events || [])]
    .filter((event) => (!event.status || event.status === 'accepted') && Number.isFinite(Number(event.sequence)))
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  if (
    acceptedEvents.length === 0
    || acceptedEvents.some((event, index) => Number(event.sequence) !== index + 1)
  ) return envelope?.stats;

  let replayedStats = {
    ...(envelope.stats || {}),
    sourceEventSequence: 0,
    teams: {},
    players: {},
  };
  acceptedEvents.forEach((event) => {
    const replayEnvelope = {
      ...envelope,
      liveState: { ...(envelope.liveState || {}), ...(event.preState || {}) },
    };
    const projection = applyFootballEventToEnvelope(replayEnvelope, event);
    replayedStats = projectFootballStats(replayedStats, event, projection, acceptedEvents);
  });

  const currentTeams = envelope.stats?.teams || {};
  const currentPlayers = envelope.stats?.players || {};
  const teams = { ...currentTeams };
  for (const team of ['H', 'V']) {
    teams[team] = replaceProjectedKeys(currentTeams[team], replayedStats.teams?.[team], PROJECTED_TEAM_STAT_KEYS);
  }
  const players = { ...currentPlayers };
  const playerIds = new Set([...Object.keys(currentPlayers), ...Object.keys(replayedStats.players || {})]);
  playerIds.forEach((playerId) => {
    players[playerId] = replaceProjectedKeys(
      currentPlayers[playerId],
      replayedStats.players?.[playerId],
      PROJECTED_PLAYER_STAT_KEYS,
    );
  });

  const repaired = {
    ...(envelope.stats || {}),
    sourceEventSequence: Number(acceptedEvents.at(-1).sequence),
    teams,
    players,
  };
  return JSON.stringify(repaired) === JSON.stringify(envelope.stats) ? envelope.stats : repaired;
}

function repairFootballPossessionTimeFromDrives(envelope, stats) {
  const periodSeconds = Math.max(
    60,
    finiteNumber(envelope?.game?.rules?.minutesPerPeriod || envelope?.game?.rules?.minutes, 15) * 60,
  );
  const segments = { H: [], V: [] };
  const kickoffEvents = (envelope?.events || []).filter((event) => (
    event?.type === 'kickoff'
    && (!event.status || event.status === 'accepted')
    && !hasAcceptedPreviousSpotPenalty(event)
    && normalizeClockText(event.clock)
  ));
  const usedKickoffEvents = new Set();
  const timedDrives = [
    ...(envelope?.drives?.completed || []),
    envelope?.drives?.current,
  ].filter(Boolean);

  kickoffEvents.forEach((event, kickoffIndex) => {
    const receivingTeam = kickoffReceivingTeam(event);
    const kickingTeam = event?.participants?.kicker?.team
      || event?.participants?.primary?.team
      || event?.possession;
    const recoveryTeam = event?.result?.turnover?.recoveredBy
      || event?.result?.turnover?.team
      || event?.result?.fumble?.recoveredByTeam
      || event?.result?.nextPossession;
    const isKickoffReturnFumble = Boolean(
      event?.result?.fumble?.turnover
      || event?.result?.turnover?.type === 'fumble'
    );
    if (
      !isKickoffReturnFumble
      || !validTeamCode(receivingTeam)
      || !validTeamCode(kickingTeam)
      || recoveryTeam !== kickingTeam
      || recoveryTeam === receivingTeam
    ) return;

    // A return fumble recovered by the kicking team never creates a drive for
    // the receiving team. Consume it here so it cannot be attached to that
    // team's next kickoff drive, and retain the return time as its own segment.
    usedKickoffEvents.add(kickoffIndex);
    const eventPeriod = finiteNumber(event.period, 1);
    const kickoffSeconds = clockSeconds(event.clock);
    const recoveryDrive = timedDrives.reduce((closest, drive) => {
      if (
        finiteNumber(drive?.startPeriod, eventPeriod) !== eventPeriod
      ) return closest;
      const driveStartSeconds = clockSeconds(drive?.startClock);
      if (kickoffSeconds === null || driveStartSeconds === null || driveStartSeconds > kickoffSeconds) {
        return closest;
      }
      const elapsed = kickoffSeconds - driveStartSeconds;
      return !closest || elapsed < closest.elapsed ? { drive, elapsed } : closest;
    }, null)?.drive;
    if (
      recoveryDrive?.team !== recoveryTeam
      || String(recoveryDrive?.startReason || '').toLowerCase() !== 'fumblerecovery'
    ) return;
    const recoveryClock = normalizeClockText(recoveryDrive?.startClock);
    if (!recoveryClock) return;
    segments[receivingTeam].push({
      startPeriod: eventPeriod,
      startClock: normalizeClockText(event.clock),
      endPeriod: finiteNumber(recoveryDrive.startPeriod, eventPeriod),
      endClock: recoveryClock,
    });
  });

  const possessionStartClock = (drive) => {
    if (!String(drive?.startReason || '').toLowerCase().startsWith('kickoff')) return drive.startClock;
    const drivePeriod = finiteNumber(drive.startPeriod, 1);
    const driveStartSeconds = clockSeconds(drive.startClock);
    let kickoffIndex = -1;
    let closestElapsed = Number.POSITIVE_INFINITY;
    kickoffEvents.forEach((event, index) => {
      if (usedKickoffEvents.has(index)) return;
      const receivingTeam = kickoffReceivingTeam(event);
      const kickoffSeconds = clockSeconds(event.clock);
      if (
        receivingTeam !== drive.team
        || finiteNumber(event.period, drivePeriod) !== drivePeriod
        || kickoffSeconds === null
        || (driveStartSeconds !== null && kickoffSeconds < driveStartSeconds)
      ) return;
      const elapsed = driveStartSeconds === null ? 0 : kickoffSeconds - driveStartSeconds;
      if (kickoffIndex < 0 || elapsed < closestElapsed) {
        kickoffIndex = index;
        closestElapsed = elapsed;
      }
    });
    if (kickoffIndex < 0) return drive.startClock;
    usedKickoffEvents.add(kickoffIndex);
    return normalizeClockText(kickoffEvents[kickoffIndex].clock) || drive.startClock;
  };
  for (const drive of envelope?.drives?.completed || []) {
    if (!validTeamCode(drive?.team) || !drive.startClock || !drive.endClock) continue;
    const startPeriod = finiteNumber(drive.startPeriod, 1);
    const endPeriod = finiteNumber(drive.endPeriod, startPeriod);
    const halftimePeriod = Math.floor(finiteNumber(envelope?.game?.rules?.periods, 4) / 2);
    if (startPeriod <= halftimePeriod && endPeriod > halftimePeriod) continue;
    segments[drive.team].push({
      startPeriod,
      startClock: possessionStartClock(drive),
      endPeriod,
      endClock: drive.endClock,
    });
  }

  const currentDrive = envelope?.drives?.current;
  if (validTeamCode(currentDrive?.team) && currentDrive.startClock) {
    segments[currentDrive.team].push({
      startPeriod: finiteNumber(currentDrive.startPeriod, envelope?.clock?.period || 1),
      startClock: possessionStartClock(currentDrive),
    });
  }

  if (segments.H.length === 0 && segments.V.length === 0) return stats;
  const teams = { ...(stats?.teams || {}) };
  for (const team of ['H', 'V']) {
    if (segments[team].length === 0) continue;
    segments[team].sort((left, right) => (
      finiteNumber(left.startPeriod, 1) - finiteNumber(right.startPeriod, 1)
      || finiteNumber(clockSeconds(right.startClock), -1) - finiteNumber(clockSeconds(left.startClock), -1)
    ));
    const timeOfPossession = segments[team].reduce((total, segment) => {
      const timedSegment = segment.endClock
        ? segment
        : {
            ...segment,
            endPeriod: finiteNumber(envelope?.clock?.period, segment.startPeriod),
            endClock: envelope?.clock?.clock,
          };
      return total + elapsedPossessionSeconds(timedSegment, periodSeconds);
    }, 0);
    teams[team] = {
      ...(teams[team] || {}),
      possessionBaseSeconds: 0,
      possessionSegments: segments[team],
      timeOfPossession,
    };
  }
  const currentPeriod = Math.max(1, finiteNumber(envelope?.clock?.period || envelope?.game?.period, 1));
  const currentClockSeconds = clockSeconds(envelope?.clock?.clock);
  const elapsedGameSeconds = ((currentPeriod - 1) * periodSeconds)
    + (currentClockSeconds === null ? 0 : Math.max(0, periodSeconds - currentClockSeconds));
  const derivedTotal = ['H', 'V'].reduce((total, team) => total + finiteNumber(teams[team]?.timeOfPossession), 0);
  if (derivedTotal > elapsedGameSeconds + 1) return stats;
  return { ...(stats || {}), teams };
}

const acceptedPenaltyFinalSpot = (event) => [...(event?.penalties || [])]
  .reverse()
  .find((penalty) => penalty.status === 'accepted' && penalty.finalSpot)
  ?.finalSpot;

const driveEndSpot = (current, projection, event) => {
  const transition = projection?.driveTransition;
  const driveResult = transition?.driveResult;
  if (driveResult === 'touchdown') return 'goal';
  if (driveResult === 'safety') {
    return acceptedPenaltyFinalSpot(event)
      || event?.result?.endYardLine
      || event?.preState?.yardLine;
  }
  if (['punt', 'fieldGoal', 'missedFieldGoal'].includes(driveResult)) {
    return event?.preState?.yardLine;
  }
  if (driveResult === 'turnover') {
    return event?.result?.turnover?.spot
      || event?.result?.fumble?.recoverySpot
      || acceptedPenaltyFinalSpot(event)
      || event?.result?.endYardLine;
  }
  if (!transition?.shouldEndCurrent && projection?.liveState?.possession === current?.team) {
    return projection.liveState.yardLine;
  }
  return acceptedPenaltyFinalSpot(event)
    || event?.result?.endYardLine
    || projection?.liveState?.yardLine;
};

const positionalDriveYards = (current, projection, event) => {
  if (!current?.startYardLine || !current.team) return null;
  const endSpot = driveEndSpot(current, projection, event);
  const yards = calculateYardsGained(current.startYardLine, endSpot, current.team);
  return typeof yards === 'number' ? yards : null;
};

const updateDrives = (drives = {}, projection, event) => {
  const transition = projection?.driveTransition;
  if (!transition) return drives;
  const current = drives.current || null;
  const completed = Array.isArray(drives.completed) ? drives.completed : [];
  const countsAsDrivePlay = ['rush', 'pass', 'punt', 'fieldGoal'].includes(event?.type)
    && !hasAcceptedPreviousSpotPenalty(event);
  const positionedYards = positionalDriveYards(current, projection, event);
  const playedCurrent = current
    ? {
        ...current,
        plays: finiteNumber(current.plays) + (countsAsDrivePlay ? 1 : 0),
        yards: positionedYards ?? (
          finiteNumber(current.yards) + (countsAsDrivePlay ? finiteNumber(projection.yardsGained) : 0)
        ),
      }
    : current;
  const completedNext = transition.shouldEndCurrent && playedCurrent
    ? [...completed, {
        ...playedCurrent,
        result: transition.driveResult || playedCurrent.result,
        endPeriod: event?.period ?? playedCurrent.endPeriod ?? null,
        endClock: event?.clock ?? playedCurrent.endClock ?? null,
      }]
    : completed;
  return {
    ...drives,
    current: transition.shouldStartNew ? transition.startedDrive : transition.shouldEndCurrent ? null : playedCurrent,
    completed: completedNext,
  };
};

const normalizeClockText = (clock) => {
  const match = String(clock || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

const clockSeconds = (clock) => {
  const normalized = normalizeClockText(clock);
  if (!normalized) return null;
  const [minutes, seconds] = normalized.split(':').map(Number);
  return (minutes * 60) + seconds;
};

const elapsedPossessionSeconds = (segment, periodSeconds) => {
  const start = clockSeconds(segment.startClock);
  const end = clockSeconds(segment.endClock);
  const startPeriod = finiteNumber(segment.startPeriod, 1);
  const endPeriod = finiteNumber(segment.endPeriod, startPeriod);
  if (start === null || end === null || endPeriod < startPeriod) return 0;
  if (startPeriod === endPeriod) return Math.max(0, start - end);
  const fullPeriods = Math.max(0, endPeriod - startPeriod - 1);
  return Math.max(0, start) + (fullPeriods * periodSeconds) + Math.max(0, periodSeconds - end);
};

const possessionValueSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  return clockSeconds(value) ?? 0;
};

export function recordFootballPossessionClock(envelope, {
  previousPossession,
  nextPossession,
  period,
  clock,
  endedDriveId,
}) {
  const normalizedClock = normalizeClockText(clock);
  if (!envelope || !normalizedClock) throw new Error('Possession clock must use MM:SS format.');
  const periodNumber = Math.max(1, finiteNumber(period, envelope.clock?.period || envelope.game?.period || 1));
  const periodSeconds = Math.max(60, finiteNumber(envelope.game?.rules?.minutesPerPeriod || envelope.game?.rules?.minutes, 15) * 60);
  const latestEvent = [...(envelope.events || [])]
    .reverse()
    .find((event) => !event.status || event.status === 'accepted');
  if (latestEvent?.type === 'gameControl' && latestEvent?.result?.gameControl?.action === 'setPossession') {
    return envelope;
  }
  const receivingTeam = kickoffReceivingTeam(latestEvent);
  const kickoffSeconds = clockSeconds(latestEvent?.clock);
  const possessionChangeSeconds = clockSeconds(normalizedClock);
  const kickoffClock = latestEvent?.type === 'kickoff'
    && !hasAcceptedPreviousSpotPenalty(latestEvent)
    && (receivingTeam || nextPossession) === nextPossession
    && finiteNumber(latestEvent.period, periodNumber) === periodNumber
    && kickoffSeconds !== null
    && possessionChangeSeconds !== null
    && kickoffSeconds >= possessionChangeSeconds
    ? normalizeClockText(latestEvent.clock)
    : null;
  let teams = { ...(envelope.stats?.teams || {}) };

  if (validTeamCode(previousPossession) && previousPossession !== nextPossession) {
    const current = { ...(teams[previousPossession] || {}) };
    const segments = Array.isArray(current.possessionSegments)
      ? current.possessionSegments.map((segment) => ({ ...segment }))
      : [];
    let openIndex = -1;
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      if (!segments[index].endClock) {
        openIndex = index;
        break;
      }
    }
    if (openIndex < 0) {
      const activePriorDrive = envelope.drives?.current?.team === previousPossession
        ? envelope.drives.current
        : null;
      const priorDrive = activePriorDrive?.startClock
        ? activePriorDrive
        : [...(envelope.drives?.completed || [])]
            .reverse()
            .find((drive) => drive.team === previousPossession && drive.startClock);
      segments.push({
        startPeriod: periodNumber,
        startClock: priorDrive?.startClock || envelope.clock?.clock || normalizedClock,
      });
      openIndex = segments.length - 1;
    }
    segments[openIndex] = {
      ...segments[openIndex],
      endPeriod: periodNumber,
      endClock: normalizedClock,
    };
    const baseSeconds = current.possessionBaseSeconds ?? (
      current.possessionSegments?.length
        ? 0
        : possessionValueSeconds(current.timeOfPossession ?? current.possession)
    );
    const elapsedSeconds = segments.reduce(
      (total, segment) => total + elapsedPossessionSeconds(segment, periodSeconds),
      0,
    );
    teams = {
      ...teams,
      [previousPossession]: {
        ...current,
        possessionBaseSeconds: baseSeconds,
        possessionSegments: segments,
        timeOfPossession: baseSeconds + elapsedSeconds,
      },
    };
  }

  if (validTeamCode(nextPossession) && previousPossession !== nextPossession) {
    const current = { ...(teams[nextPossession] || {}) };
    const segments = Array.isArray(current.possessionSegments)
      ? current.possessionSegments.map((segment) => ({ ...segment }))
      : [];
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.endClock || !lastSegment) {
      segments.push({ startPeriod: periodNumber, startClock: kickoffClock || normalizedClock });
    }
    teams = {
      ...teams,
      [nextPossession]: {
        ...current,
        possessionSegments: segments,
      },
    };
  }

  const completedDrives = Array.isArray(envelope.drives?.completed)
    ? envelope.drives.completed.map((drive) => ({ ...drive }))
    : [];
  if (validTeamCode(previousPossession) && previousPossession !== nextPossession) {
    const targetDriveId = endedDriveId || latestEvent?.preState?.driveId;
    const targetIndex = targetDriveId
      ? completedDrives.findIndex((drive) => drive.driveId === targetDriveId)
      : -1;
    if (targetIndex >= 0 && completedDrives[targetIndex].team === previousPossession) {
      completedDrives[targetIndex] = {
        ...completedDrives[targetIndex],
        endPeriod: periodNumber,
        endClock: normalizedClock,
      };
    }
  }

  return {
    ...envelope,
    clock: {
      ...envelope.clock,
      period: periodNumber,
      clock: normalizedClock,
      clockTenths: clockTextToTenths(normalizedClock),
      isRunning: false,
    },
    drives: {
      ...envelope.drives,
      current: envelope.drives?.current && envelope.drives.current.team === nextPossession
        ? { ...envelope.drives.current, startPeriod: periodNumber, startClock: normalizedClock }
        : envelope.drives?.current || null,
      completed: completedDrives,
    },
    stats: {
      ...envelope.stats,
      teams,
    },
  };
}

const resolveTimeoutLimit = (rules = {}) => {
  const configured = Number(rules.timeouts ?? rules.timeoutsPerHalf ?? rules.timeoutsPerGame ?? rules.timeoutFull ?? rules.timeout_full);
  return Number.isFinite(configured) && configured >= 0 ? configured : 3;
};

const resolveChallengeRules = (rules = {}) => {
  const configured = Number(rules.challenge?.numberOfChallenges ?? rules.challenges ?? rules.challengesPerGame ?? rules.challengeCount);
  return {
    numberOfChallenges: Number.isFinite(configured) && configured >= 0 ? configured : 2,
    failedChallengeDecreasesTimeout: Boolean(rules.challenge?.failedChallengeDecreasesTimeout),
    successfulChallengeDecreasesChallenge: Boolean(rules.challenge?.successfulChallengeDecreasesChallenge),
  };
};

const initializeTeamCounts = (existing = {}, limit) => ({
  H: Number.isFinite(Number(existing?.H)) ? Number(existing.H) : limit,
  V: Number.isFinite(Number(existing?.V)) ? Number(existing.V) : limit,
});

const decrementTeamCount = (counts, team) => ({
  ...counts,
  [team]: Math.max(0, Number(counts[team] || 0) - 1),
});

const closeCurrentDriveAtPeriodEnd = (drives = {}, period, result) => {
  if (!drives.current) return drives;
  const completed = Array.isArray(drives.completed) ? drives.completed : [];
  if (completed.some((drive) => drive.driveId === drives.current.driveId)) {
    return { ...drives, current: null };
  }
  return {
    ...drives,
    current: null,
    completed: [...completed, {
      ...drives.current,
      result: result || drives.current.result,
      endPeriod: period,
      endClock: '00:00',
    }],
  };
};

const correctPossessionDrive = (drives = {}, { possession, period, clock, spot }) => {
  if (!validTeamCode(possession)) return drives;
  const completed = Array.isArray(drives.completed) ? drives.completed.map((drive) => ({ ...drive })) : [];
  const current = drives.current ? { ...drives.current } : null;
  if (current?.team === possession) return { ...drives, current, completed };

  if (current && finiteNumber(current.plays) === 0) {
    const correctionClock = normalizeClockText(clock);
    const reopenIndex = completed.findLastIndex((drive) => (
      drive.team === possession
      && finiteNumber(drive.endPeriod, -1) === finiteNumber(period, -2)
      && normalizeClockText(drive.endClock) === correctionClock
    ));
    if (reopenIndex >= 0) {
      const reopened = { ...completed[reopenIndex], result: null };
      reopened.driveNumber = finiteNumber(
        reopened.driveNumber,
        Number(String(reopened.driveId || '').match(/(\d+)$/)?.[1]),
      );
      delete reopened.endPeriod;
      delete reopened.endClock;
      completed.splice(reopenIndex, 1);
      return { ...drives, current: reopened, completed };
    }
  }

  if (current) {
    return {
      ...drives,
      completed,
      current: {
        ...current,
        team: possession,
        startYardLine: finiteNumber(current.plays) === 0 ? spot || current.startYardLine : current.startYardLine,
        startReason: 'manualPossessionCorrection',
      },
    };
  }

  const driveNumber = Math.max(
    completed.length,
    ...completed.map((drive) => finiteNumber(drive.driveNumber)),
  ) + 1;
  return {
    ...drives,
    completed,
    current: {
      driveId: `DRV-${String(driveNumber).padStart(4, '0')}`,
      driveNumber,
      team: possession,
      startYardLine: spot,
      startReason: 'manualPossessionChange',
      startPeriod: period,
      startClock: normalizeClockText(clock),
      plays: 0,
      yards: 0,
      result: null,
    },
  };
};

const applyGameControlProjection = (envelope, event) => {
  const control = event?.result?.gameControl;
  if (!control?.action) return null;
  const rules = envelope.game?.rules || {};
  const team = control.teamSide || control.possession;
  const currentPeriod = Number(envelope.clock?.period || envelope.game?.period || event.period || 1);
  const periods = Number(rules.periods || 4);
  const period = Number(control.period || currentPeriod);
  const updatedAt = event.acceptedAt;
  const withEvent = (patch) => ({
    ...envelope,
    ...patch,
    updatedAt,
    events: appendEvent(envelope.events, event),
    stats: { ...envelope.stats, sourceEventSequence: event.sequence },
  });

  if (control.action === 'setClock' || control.action === 'emergency') {
    const clock = control.clock || event.result.clock || envelope.clock.clock;
    return withEvent({
      clock: {
        ...envelope.clock,
        clock,
        clockTenths: event.result.clockTenths ?? clockTextToTenths(clock),
        isRunning: false,
      },
    });
  }

  if (control.action === 'timeout') {
    const limit = resolveTimeoutLimit(rules);
    const timeouts = initializeTeamCounts(envelope.liveState?.timeouts, limit);
    const clock = control.clock || event.result.clock || event.clock || envelope.clock.clock;
    return withEvent({
      clock: {
        ...envelope.clock,
        clock,
        clockTenths: event.result.clockTenths ?? clockTextToTenths(clock),
        isRunning: false,
      },
      liveState: { ...envelope.liveState, timeouts: team ? decrementTeamCount(timeouts, team) : timeouts },
    });
  }

  if (control.action === 'challenge') {
    const challengeRules = resolveChallengeRules(rules);
    let timeouts = initializeTeamCounts(envelope.liveState?.timeouts, resolveTimeoutLimit(rules));
    let challenges = initializeTeamCounts(envelope.liveState?.challenges, challengeRules.numberOfChallenges);
    const successful = ['successful', 'callOverturned'].includes(control.challengeStatus);
    const failed = ['unsuccessful', 'callStands', 'callConfirmed'].includes(control.challengeStatus);
    if (team && successful && challengeRules.successfulChallengeDecreasesChallenge) challenges = decrementTeamCount(challenges, team);
    if (team && failed && challengeRules.failedChallengeDecreasesTimeout) timeouts = decrementTeamCount(timeouts, team);
    return withEvent({
      liveState: {
        ...envelope.liveState,
        timeouts,
        challenges,
        challengeLog: [...(envelope.liveState?.challengeLog || []), { teamSide: team, status: control.challengeStatus }],
      },
    });
  }

  if (control.action === 'endQuarter') {
    const status = period >= periods ? 'final' : period === Math.floor(periods / 2) ? 'halftime' : envelope.game.status;
    const drives = ['halftime', 'final'].includes(status)
      ? closeCurrentDriveAtPeriodEnd(envelope.drives, period, status === 'halftime' ? 'endOfHalf' : 'endOfGame')
      : envelope.drives;
    return withEvent({
      game: { ...envelope.game, period, status },
      clock: { ...envelope.clock, period, clock: '00:00', clockTenths: 0, isRunning: false },
      drives,
      pregame: envelope.pregame ? { ...envelope.pregame, gamePhase: status === 'final' ? 'final' : status === 'halftime' ? 'halftime' : 'live' } : envelope.pregame,
    });
  }

  if (control.action === 'startQuarter') {
    const minutes = Number(rules.minutesPerPeriod || rules.minutes || 15);
    const resetTimeouts = period === Math.floor(periods / 2) + 1;
    const secondHalf = resetTimeouts ? control.secondHalf : null;
    const kickoffTeam = validTeamCode(secondHalf?.kickingTeam) ? secondHalf.kickingTeam : null;
    const kickoffSpot = kickoffTeam ? ownTeamRuleSpot(rules.kickoffSpot || 'H35', kickoffTeam) : null;
    const liveState = resetTimeouts
      ? { ...envelope.liveState, timeouts: initializeTeamCounts({}, resolveTimeoutLimit(rules)) }
      : envelope.liveState;
    const drives = resetTimeouts
      ? closeCurrentDriveAtPeriodEnd(envelope.drives, period - 1, 'endOfHalf')
      : envelope.drives;
    return withEvent({
      game: { ...envelope.game, period, status: 'inProgress' },
      clock: { ...envelope.clock, period, clock: `${String(minutes).padStart(2, '0')}:00`, clockTenths: minutes * 600, isRunning: false },
      liveState: kickoffTeam
        ? {
            ...liveState,
            possession: null,
            down: null,
            distance: null,
            yardLine: kickoffSpot,
            lineToGain: null,
            goalToGo: false,
            redZone: false,
            driveId: null,
            pendingTryTeam: null,
            kickoffTeam,
            nextPlayContext: 'awaitingKickoff',
          }
        : liveState,
      drives: kickoffTeam ? { ...drives, current: null } : drives,
      pregame: envelope.pregame
        ? { ...envelope.pregame, gamePhase: kickoffTeam ? 'awaitingKickoff' : 'live' }
        : envelope.pregame,
    });
  }

  if (control.action === 'setBallContext') {
    const possession = envelope.liveState?.possession || team;
    const liveState = createLiveState({
      possession,
      down: control.down,
      distance: control.distance,
      yardLine: control.spot,
      lineToGain: control.lineToGain,
      driveId: envelope.liveState?.driveId,
      driveNumber: envelope.liveState?.driveNumber,
    });
    return withEvent({ liveState: { ...envelope.liveState, ...liveState } });
  }

  if (control.action === 'setPossession') {
    const spot = envelope.liveState?.yardLine || control.spot;
    const possession = control.possession;
    const correctedDrives = correctPossessionDrive(envelope.drives, {
      possession,
      period: event.period,
      clock: event.clock,
      spot,
    });
    const currentDrive = correctedDrives.current;
    const liveState = createLiveState({
      possession,
      down: 1,
      yardLine: spot,
      driveId: currentDrive?.driveId || envelope.liveState?.driveId,
      driveNumber: currentDrive?.driveNumber
        || Number(String(currentDrive?.driveId || '').match(/(\d+)$/)?.[1])
        || envelope.liveState?.driveNumber,
    });
    return withEvent({
      liveState: { ...envelope.liveState, ...liveState },
      drives: correctedDrives,
    });
  }

  if (control.action === 'startDrive') {
    const driveNumber = Math.max(Number(envelope.liveState?.driveNumber || 0), Number(envelope.drives?.current?.driveNumber || 0)) + 1;
    const drive = {
      driveId: `DRV-${String(driveNumber).padStart(4, '0')}`,
      driveNumber,
      team: control.possession,
      startYardLine: control.spot,
      startReason: 'manualControl',
      plays: 0,
      yards: 0,
      result: null,
    };
    const liveState = createLiveState({ possession: control.possession, down: 1, yardLine: control.spot, driveId: drive.driveId, driveNumber });
    return withEvent({
      liveState: { ...envelope.liveState, ...liveState },
      drives: { ...envelope.drives, current: drive },
    });
  }

  return withEvent({});
};

const clockTextToTenths = (clock) => {
  const [minutes, seconds] = String(clock || '00:00').split(':').map(Number);
  return ((minutes * 60) + seconds) * 10;
};

export function applyFootballScorerEventToEnvelope(baseEnvelope, acceptedEvent) {
  const event = normalizeAcceptedEvent(baseEnvelope, acceptedEvent, acceptedEvent.acceptedAt);
  const gameControlEnvelope = applyGameControlProjection(baseEnvelope, event);
  if (gameControlEnvelope) return { envelope: gameControlEnvelope, projection: null, diagnostics: [] };

  let projection;
  try {
    projection = applyFootballEventToEnvelope(baseEnvelope, event, {
      nextDriveId: `DRV-${String((baseEnvelope.liveState?.driveNumber || 0) + 1).padStart(4, '0')}`,
    });
  } catch (error) {
    return {
      envelope: { ...baseEnvelope, updatedAt: event.acceptedAt, events: appendEvent(baseEnvelope.events, event) },
      projection: null,
      diagnostics: [{ code: 'PROJECTION_FAILED', message: error instanceof Error ? error.message : 'Local projection failed.' }],
    };
  }

  const scoring = projection.scoringUpdate ?? null;
  return {
    envelope: {
      ...baseEnvelope,
      updatedAt: event.acceptedAt,
      game: {
        ...baseEnvelope.game,
        status: baseEnvelope.game.status === 'pregame' ? 'inProgress' : baseEnvelope.game.status,
        teams: applyScoringUpdate(baseEnvelope.game.teams, scoring),
      },
      pregame: baseEnvelope.pregame ? { ...baseEnvelope.pregame, gamePhase: 'live' } : baseEnvelope.pregame,
      liveState: { ...baseEnvelope.liveState, ...projection.liveState },
      drives: updateDrives(baseEnvelope.drives, projection, event),
      events: appendEvent(baseEnvelope.events, event),
      stats: projectFootballStats(baseEnvelope.stats, event, projection, baseEnvelope.events),
    },
    projection,
    diagnostics: [],
  };
}

export async function submitFootballEventLocally(baseEnvelope, submitRequest) {
  if (!baseEnvelope || !submitRequest?.event) {
    return { ok: false, errors: [{ code: 'INVALID_LOCAL_SUBMIT', message: 'Local test-game submit requires an envelope and event.' }], warnings: [] };
  }
  const duplicate = (baseEnvelope.events || []).find((event) => event.clientEventId === submitRequest.event.clientEventId);
  if (duplicate && !isSameSubmittedEvent(duplicate, submitRequest.event)) {
    return {
      ok: false,
      status: 'rejected',
      acceptedEvent: null,
      gameEnvelope: baseEnvelope,
      envelope: baseEnvelope,
      projection: null,
      errors: [{
        code: 'CLIENT_EVENT_ID_CONFLICT',
        field: 'event.clientEventId',
        message: 'This submission ID already belongs to a different play. Start the play again to create a new submission ID.',
      }],
      warnings: [],
    };
  }
  const acceptedEvent = duplicate || normalizeAcceptedEvent(
    baseEnvelope,
    submitRequest.event,
    submitRequest.clientContext?.submittedAt || new Date().toISOString(),
  );
  const projected = duplicate
    ? { envelope: baseEnvelope, projection: null, diagnostics: [] }
    : applyFootballScorerEventToEnvelope(baseEnvelope, acceptedEvent);
  const localEnvelope = saveDashboardSeededFootballEnvelope(baseEnvelope.gameId, projected.envelope)
    || projected.envelope;
  const status = duplicate ? 'duplicateAccepted' : 'accepted';
  return {
    ok: true,
    status,
    acceptedEvent,
    gameEnvelope: localEnvelope,
    envelope: localEnvelope,
    projection: projected.projection,
    warnings: projected.diagnostics.map((diagnostic) => ({ ...diagnostic, severity: 'warning', source: 'localTestGame' })),
    rawResponse: { schemaVersion: 'football.submitEventResponse.v1', success: true, status, acceptedEvent, gameEnvelope: localEnvelope, warnings: [], errors: [] },
  };
}
