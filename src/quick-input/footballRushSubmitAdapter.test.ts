import { describe, expect, it, vi } from 'vitest';
import type { SubmitEventRequest } from '../contracts/football';
import { gameEnvelopeFixtures } from '../data/footballGameEnvelopeFixtures';
import {
  CANONICAL_FOOTBALL_SUBMIT_ENDPOINT,
  submitCanonicalRushEvent,
} from './footballRushSubmitAdapter';

describe('footballRushSubmitAdapter', () => {
  it('accepts only the canonical response and returns the authoritative envelope', async () => {
    const request = makeRequest();
    const payload = makeResponse(request);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));

    const result = await submitCanonicalRushEvent(request, { fetchImpl });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(CANONICAL_FOOTBALL_SUBMIT_ENDPOINT, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }));
    if (result.ok) {
      expect(result.contractMode).toBe('canonicalRush');
      expect(result.gameEnvelope).toStrictEqual(payload.gameEnvelope);
      expect(result.acceptedEvent.eventId).toBe(payload.acceptedEvent.eventId);
      expect(result).not.toHaveProperty('projection');
      expect(result).not.toHaveProperty('envelope');
    }
  });

  it.each(['ok', 'event', 'envelope', 'projection'])('rejects the legacy %s response alias', async (alias) => {
    const request = makeRequest();
    const payload = { ...makeResponse(request), [alias]: {} };

    const result = await submitCanonicalRushEvent(request, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse(payload)) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ code: 'INVALID_RESPONSE', field: alias });
  });

  it('rejects game and accepted-event identity mismatches', async () => {
    const request = makeRequest();
    const gameMismatch = makeResponse(request);
    gameMismatch.gameEnvelope.gameId = 'OTHER-GAME';
    const acceptedMismatch = makeResponse(request);
    acceptedMismatch.acceptedEvent.clientEventId = 'OTHER-CLIENT';

    const first = await submitCanonicalRushEvent(request, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse(gameMismatch)) });
    const second = await submitCanonicalRushEvent(request, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse(acceptedMismatch)) });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    if (!first.ok) expect(first.errors[0].code).toBe('RESPONSE_IDENTITY_MISMATCH');
    if (!second.ok) expect(second.errors[0].code).toBe('RESPONSE_IDENTITY_MISMATCH');
  });

  it('rejects out-of-order authoritative events', async () => {
    const request = makeRequest();
    const payload = makeResponse(request);
    payload.gameEnvelope.events = [...payload.gameEnvelope.events].reverse();

    const result = await submitCanonicalRushEvent(request, { fetchImpl: vi.fn().mockResolvedValue(jsonResponse(payload)) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ code: 'INVALID_RESPONSE', field: 'gameEnvelope.events' });
  });

  it('rejects backend acceptance fields in a Rush draft before fetch', async () => {
    const request = makeRequest() as SubmitEventRequest & { event: SubmitEventRequest['event'] & { sequence: number } };
    request.event.sequence = 5;
    const fetchImpl = vi.fn();

    const result = await submitCanonicalRushEvent(request, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    if (!result.ok) expect(result.errors[0].field).toBe('event.sequence');
  });
});

function makeRequest(): SubmitEventRequest {
  return {
    schemaVersion: 'football.submitEventRequest.v1',
    gameId: 'TEST-UI-RUSH-001',
    clientContext: {
      clientEventId: 'CLIENT-UI-RUSH-001',
      submittedAt: '2026-09-01T23:00:00Z',
      baseEventSequence: 12,
    },
    event: {
      clientEventId: 'CLIENT-UI-RUSH-001',
      type: 'rush',
      subtype: null,
      createdAt: '2026-09-01T23:00:00Z',
      period: 1,
      clock: '08:42',
      possession: 'H',
      preState: {
        possession: 'H', down: 2, distance: 6, yardLine: 'H44', lineToGain: '50',
        goalToGo: false, redZone: false, driveId: 'DRV-0002', driveNumber: 2,
      },
      participants: {
        primary: { playerId: 'PLAYER-H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [{ playerId: 'PLAYER-V-44', team: 'V', role: 'tackler' }],
      },
      result: { code: 'tackle', yards: 7, endYardLine: 'V49' },
      penalties: [],
      description: 'HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.',
    },
  };
}

function makeResponse(request: SubmitEventRequest) {
  const envelope = JSON.parse(JSON.stringify(gameEnvelopeFixtures.normal));
  envelope.gameId = request.gameId;
  envelope.rosters.gameId = request.gameId;
  const sequence = Math.max(...envelope.events.map((event: { sequence?: number }) => event.sequence ?? 0)) + 1;
  const acceptedEvent = {
    ...request.event,
    eventId: 'EVT-UI-RUSH-001',
    sequence,
    status: 'accepted' as const,
    acceptedAt: '2026-09-01T23:00:01Z',
    postState: request.event.preState,
  };
  envelope.events.push(acceptedEvent);
  envelope.stats.sourceEventSequence = sequence;
  return {
    schemaVersion: 'football.submitEventResponse.v1' as const,
    success: true,
    status: 'accepted' as const,
    acceptedEvent,
    gameEnvelope: envelope,
    warnings: [],
    errors: [],
  };
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify(payload),
  } as Response;
}
