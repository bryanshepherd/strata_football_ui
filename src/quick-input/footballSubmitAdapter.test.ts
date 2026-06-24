import { describe, expect, it, vi } from 'vitest';
import {
  FOOTBALL_SUBMIT_EVENT_ENDPOINT,
  submitFootballFcqiEvent,
} from './footballSubmitAdapter';
import type { FootballSubmitEventRequest } from './footballEventBuilder';

describe('footballSubmitAdapter', () => {
  it('posts the canonical FCQI submit request to the football submit endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      status: 'accepted',
      acceptedEvent: { eventId: 'EVT-1', clientEventId: 'client-1' },
      gameEnvelope: { gameId: 'FB-1001' },
      warnings: [],
    }));

    const result = await submitFootballFcqiEvent(makeSubmitRequest(), { fetchImpl });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      FOOTBALL_SUBMIT_EVENT_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeSubmitRequest()),
      }),
    );
    if (result.ok) {
      expect(result.acceptedEvent).toEqual({ eventId: 'EVT-1', clientEventId: 'client-1' });
      expect(result.gameEnvelope).toEqual({ gameId: 'FB-1001' });
      expect(result.envelope).toEqual({ gameId: 'FB-1001' });
    }
  });

  it('treats duplicateAccepted as an idempotent success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      status: 'duplicateAccepted',
      acceptedEvent: { eventId: 'EVT-1', clientEventId: 'client-1' },
    }));

    const result = await submitFootballFcqiEvent(makeSubmitRequest(), { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe('duplicateAccepted');
  });

  it('returns typed rejection errors without throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: false,
      status: 'rejected',
      errors: [{
        code: 'STALE_SEQUENCE',
        message: 'Submitted baseEventSequence is stale.',
        field: 'clientContext.baseEventSequence',
      }],
    }, 409, 'Conflict'));

    const result = await submitFootballFcqiEvent(makeSubmitRequest(), { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{
        code: 'STALE_SEQUENCE',
        message: 'Football submit failed with HTTP 409: Submitted baseEventSequence is stale.',
        field: 'clientContext.baseEventSequence',
        status: 409,
        statusText: 'Conflict',
        url: FOOTBALL_SUBMIT_EVENT_ENDPOINT,
        responseText: expect.stringContaining('Submitted baseEventSequence is stale.'),
        responseJson: expect.objectContaining({ status: 'rejected' }),
        requestSummary: expect.objectContaining({
          gameId: 'FB-1001',
          clientEventId: 'client-1',
        }),
        clientEventId: 'client-1',
        gameId: 'FB-1001',
        eventType: 'rush',
        eventSubtype: null,
        traceId: undefined,
        details: undefined,
      }]);
    }
    expect(consoleError).toHaveBeenCalledWith('[fcqi-submit] failed', expect.objectContaining({
      url: FOOTBALL_SUBMIT_EVENT_ENDPOINT,
      status: 409,
      statusText: 'Conflict',
      clientEventId: 'client-1',
      gameId: 'FB-1001',
      eventType: 'rush',
      eventSubtype: null,
      responseText: expect.stringContaining('Submitted baseEventSequence is stale.'),
      responseJson: expect.objectContaining({ status: 'rejected' }),
      requestSummary: expect.objectContaining({
        schemaVersion: 'football.submitEventRequest.v1',
        gameId: 'FB-1001',
        event: expect.objectContaining({
          type: 'rush',
          subtype: null,
          penaltyCount: 0,
        }),
      }),
    }));
    consoleError.mockRestore();
  });

  it('parses JSON error body and surfaces backend details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: false,
      error: 'Missing event.type',
      details: { field: 'event.type' },
      traceId: 'trace-500',
    }, 500, 'Internal Server Error'));

    const result = await submitFootballFcqiEvent(makeSubmitRequest(), { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.responseText).toContain('Missing event.type');
      expect(result.requestSummary).toMatchObject({
        gameId: 'FB-1001',
        clientEventId: 'client-1',
      });
      expect(result.errors[0]).toMatchObject({
        code: 'SUBMIT_REJECTED',
        message: 'Football submit failed with HTTP 500: Missing event.type',
        status: 500,
        statusText: 'Internal Server Error',
        responseText: expect.stringContaining('Missing event.type'),
        responseJson: expect.objectContaining({ error: 'Missing event.type', traceId: 'trace-500' }),
        clientEventId: 'client-1',
        gameId: 'FB-1001',
        eventType: 'rush',
        eventSubtype: null,
        details: { field: 'event.type' },
        traceId: 'trace-500',
      });
    }
    expect(consoleError).toHaveBeenCalledWith('[fcqi-submit] failed', expect.objectContaining({
      status: 500,
      responseText: expect.stringContaining('Missing event.type'),
      responseJson: expect.objectContaining({ error: 'Missing event.type' }),
    }));
    consoleError.mockRestore();
  });

  it('handles empty 500 response bodies with useful typed diagnostics', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('', 500, 'Internal Server Error'));

    const result = await submitFootballFcqiEvent(makeSubmitRequest(), { fetchImpl });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.responseText).toBe('');
      expect(result.requestSummary).toMatchObject({
        gameId: 'FB-1001',
        clientEventId: 'client-1',
      });
      expect(result.errors[0]).toMatchObject({
        code: 'HTTP_ERROR',
        message: 'Football submit failed with HTTP 500. Empty response body. See console for request/response details.',
        status: 500,
        statusText: 'Internal Server Error',
        responseText: '',
        clientEventId: 'client-1',
        gameId: 'FB-1001',
        eventType: 'rush',
        eventSubtype: null,
      });
    }
    expect(consoleError).toHaveBeenCalledWith('[fcqi-submit] failed', expect.objectContaining({
      status: 500,
      responseText: '',
      responseJson: undefined,
      requestSummary: expect.objectContaining({
        gameId: 'FB-1001',
        event: expect.objectContaining({ type: 'rush' }),
      }),
    }));
    consoleError.mockRestore();
  });

  it('rejects malformed FCQI submit requests before network submit', async () => {
    const fetchImpl = vi.fn();
    const invalidRequest = {
      ...makeSubmitRequest(),
      clientContext: { ...makeSubmitRequest().clientContext, clientEventId: '' },
    };

    const result = await submitFootballFcqiEvent(invalidRequest, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    if (!result.ok) expect(result.errors[0].field).toBe('clientContext.clientEventId');
  });
});

function jsonResponse(payload: unknown, status = 200, statusText = status >= 400 ? 'Error' : 'OK') {
  const body = JSON.stringify(payload);
  return textResponse(body, status, statusText, async () => payload);
}

function textResponse(
  body: string,
  status = 200,
  statusText = status >= 400 ? 'Error' : 'OK',
  json?: () => Promise<unknown>,
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
    json: json ?? (async () => JSON.parse(body)),
  } as Response;
}

function makeSubmitRequest(): FootballSubmitEventRequest {
  return {
    schemaVersion: 'football.submitEventRequest.v1',
    gameId: 'FB-1001',
    clientContext: {
      clientEventId: 'client-1',
      submittedAt: '2026-06-23T00:00:00.000Z',
      baseEventSequence: 4,
    },
    event: {
      clientEventId: 'client-1',
      type: 'rush',
      subtype: null,
      period: 1,
      clock: '08:42',
      possession: 'H',
      preState: {
        possession: 'H',
        down: 2,
        distance: 6,
        yardLine: 'H44',
        lineToGain: '50',
        goalToGo: false,
        redZone: false,
        driveId: 'DRV-1',
        driveNumber: 1,
      },
      participants: {
        primary: { playerId: 'H-22', team: 'H', role: 'rusher' },
        secondary: null,
        defenders: [],
        returner: null,
        kicker: null,
        punter: null,
        holder: null,
        fumbler: null,
        forcedBy: null,
        recoveredBy: null,
        penalizedPlayers: [],
        others: [],
      },
      result: {
        code: 'tackle',
        yards: 7,
        endYardLine: 'V49',
      },
      penalties: [],
      description: 'HOM #22 Jordan Smith rush for 7 yards to the V49.',
      source: {
        kind: 'fcqi',
        draftIntentId: 'intent-1',
        draftRevision: 1,
        summaryRevision: 1,
        confirmedAt: '2026-06-23T00:00:00.000Z',
      },
      confirmation: {
        summaryText: 'HOM #22 Jordan Smith rush for 7 yards to the V49.',
        confirmedAt: '2026-06-23T00:00:00.000Z',
      },
      warnings: [],
    },
  };
}
