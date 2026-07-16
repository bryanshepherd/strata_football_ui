import {
  defaultFixtureKey,
  getGameEnvelopeFixture,
} from '../data/footballGameEnvelopeFixtures';
import { getFootballScorerRuntimeConfig } from './footballRuntimeConfig';

export const FOOTBALL_DASHBOARD_STORAGE_KEY = 'strata.football.dashboard.v1';
export const FOOTBALL_ENVELOPE_ENDPOINT_PREFIX = '/api/football/games';

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
  return record?.envelope ? clone(record) : null;
}

/**
 * Dashboard-created games intentionally keep their canonical full envelope in
 * the dashboard store until they are handed to the backend. This updates that
 * same envelope record; it does not create a separate pregame/roster cache.
 */
export function saveDashboardSeededFootballEnvelope(gameId, envelope) {
  const store = readStore();
  const record = store.games?.[String(gameId)];
  if (!record || !envelope) return null;
  const updatedAt = new Date().toISOString();
  const nextRecord = {
    ...record,
    updatedAt,
    envelope: {
      ...envelope,
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

export async function persistFootballPregameEnvelope(gameId, envelope, { fetchImpl = globalThis.fetch } = {}) {
  const dashboardEnvelope = saveDashboardSeededFootballEnvelope(gameId, envelope);
  if (dashboardEnvelope) return dashboardEnvelope;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation is available to save pregame configuration.');
  const runtime = getFootballScorerRuntimeConfig();
  if (!runtime || runtime.envelopeGameId !== gameId) throw new Error('Football scorer runtime is unavailable. Open this game from the dashboard.');
  const response = await fetchImpl(runtime.pregameUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      gameId,
      baseEnvelopeVersion: envelope.updatedAt,
      pregame: envelope.pregame,
      rosters: envelope.rosters,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.schemaVersion) {
    throw new Error(payload?.errors?.map((error) => error.message || error.code).join(' ') || 'Pregame configuration was rejected.');
  }
  return payload;
}

export async function fetchFootballEnvelope(gameId, { signal, fetchImpl = globalThis.fetch } = {}) {
  if (!gameId) {
    throw new Error('A valid gameId is required to load a football envelope.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available to load a football envelope.');
  }

  const runtime = getFootballScorerRuntimeConfig();
  if (!runtime || runtime.envelopeGameId !== gameId) throw new Error('Football scorer runtime is unavailable. Open this game from the dashboard.');
  const url = runtime.envelopeUrl;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
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

  return payload;
}
