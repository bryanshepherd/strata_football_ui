import type { DraftFootballEvent, FootballSubmitEventRequest } from './footballEventBuilder';
import type { DraftWarning } from './footballIntentSchema';
import {
  isCanonicalRushSubmitRequest,
  submitCanonicalRushEvent,
} from './footballRushSubmitAdapter';
import { isCanonicalPassSubmitRequest, submitCanonicalPassEvent } from './footballPassSubmitAdapter';

export const FOOTBALL_SUBMIT_EVENT_ENDPOINT = '/strata_football/api/football/events/submit.php' as const;

export type FootballSubmitErrorCode =
  | 'INVALID_SUBMIT_REQUEST'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'SUBMIT_REJECTED';

export type FootballSubmitError = {
  code: FootballSubmitErrorCode | string;
  message: string;
  field?: string;
  status?: number;
  statusText?: string;
  url?: string;
  responseText?: string;
  responseJson?: unknown;
  requestSummary?: FootballSubmitRequestSummary;
  clientEventId?: string;
  gameId?: string;
  eventType?: string;
  eventSubtype?: string | null;
  details?: unknown;
  traceId?: string;
};

export type FootballSubmitRequestSummary = {
  schemaVersion: string;
  gameId: string;
  clientEventId: string;
  baseEventSequence: number;
  event: {
    clientEventId: string;
    type: string;
    subtype: string | null;
    period: number;
    clock: string | null;
    possession: string | null;
    description: string;
    penaltyCount: number;
    warningCount: number;
  };
};

export type CanonicalFootballSubmitResponse = {
  schemaVersion?: string;
  success?: boolean;
  ok?: boolean;
  status?: string;
  acceptedEvent?: DraftFootballEvent | Record<string, unknown> | null;
  event?: DraftFootballEvent | Record<string, unknown> | null;
  gameEnvelope?: Record<string, unknown> | null;
  envelope?: Record<string, unknown> | null;
  projection?: Record<string, unknown> | null;
  warnings?: DraftWarning[];
  errors?: FootballSubmitError[];
  error?: string | FootballSubmitError;
  message?: string;
  details?: unknown;
  traceId?: string;
  trace_id?: string;
};

export type FootballSubmitSuccessResult = {
  ok: true;
  status: 'accepted' | 'duplicateAccepted' | string;
  acceptedEvent: DraftFootballEvent | Record<string, unknown> | null;
  gameEnvelope: Record<string, unknown> | null;
  envelope: Record<string, unknown> | null;
  projection: Record<string, unknown> | null;
  warnings: DraftWarning[];
  rawResponse: CanonicalFootballSubmitResponse;
};

export type FootballSubmitFailureResult = {
  ok: false;
  errors: FootballSubmitError[];
  warnings: DraftWarning[];
  rawResponse?: CanonicalFootballSubmitResponse;
  responseText?: string;
  requestSummary?: FootballSubmitRequestSummary;
};

export type FootballSubmitAdapterResult = FootballSubmitSuccessResult | FootballSubmitFailureResult;

export type FootballSubmitAdapterOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export async function submitFootballFcqiEvent(
  submitRequest: FootballSubmitEventRequest,
  options: FootballSubmitAdapterOptions = {},
): Promise<FootballSubmitAdapterResult> {
  if (isCanonicalRushSubmitRequest(submitRequest)) {
    return submitCanonicalRushEvent(submitRequest, options) as unknown as Promise<FootballSubmitAdapterResult>;
  }
  if (isCanonicalPassSubmitRequest(submitRequest)) {
    return submitCanonicalPassEvent(submitRequest, options) as unknown as Promise<FootballSubmitAdapterResult>;
  }
  const preflightError = validateSubmitRequest(submitRequest);
  if (preflightError) {
    return { ok: false, errors: [preflightError], warnings: [] };
  }

  const fetcher = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    return {
      ok: false,
      errors: [{
        code: 'NETWORK_ERROR',
        message: 'No fetch implementation is available for football submit.',
      }],
      warnings: [],
    };
  }

  const url = options.endpoint ?? FOOTBALL_SUBMIT_EVENT_ENDPOINT;
  const requestSummary = summarizeSubmitRequest(submitRequest);

  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitRequest),
    });
  } catch (error) {
    return {
      ok: false,
      errors: [{
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Football submit request failed.',
        url,
        requestSummary,
        clientEventId: requestSummary.clientEventId,
        gameId: requestSummary.gameId,
        eventType: requestSummary.event.type,
        eventSubtype: requestSummary.event.subtype,
      }],
      warnings: [],
    };
  }

  const parsed = await parseSubmitResponse(response);
  if (!parsed.ok) {
    if (!response.ok) {
      logSubmitFailure({
        url,
        status: response.status,
        statusText: response.statusText,
        responseText: parsed.result.responseText ?? '',
        responseJson: undefined,
        requestSummary,
      });
    }
    const errors = parsed.result.errors.map((error) => ({
      ...error,
      url,
      requestSummary,
      clientEventId: requestSummary.clientEventId,
      gameId: requestSummary.gameId,
      eventType: requestSummary.event.type,
      eventSubtype: requestSummary.event.subtype,
    }));
    return {
      ...parsed.result,
      errors,
      requestSummary,
    };
  }

  const payload = parsed.payload;
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const accepted = payload.success === true
    || payload.ok === true
    || payload.status === 'accepted'
    || payload.status === 'duplicateAccepted';

  if (!response.ok || !accepted) {
    if (!response.ok) {
      logSubmitFailure({
        url,
        status: response.status,
        statusText: response.statusText,
        responseText: parsed.responseText,
        responseJson: parsed.responseJson,
        requestSummary,
      });
    }

    return {
      ok: false,
      errors: normalizeSubmitErrors(payload, {
        status: response.status,
        statusText: response.statusText,
        url,
        responseText: parsed.responseText,
        responseJson: parsed.responseJson,
        requestSummary,
      }),
      warnings,
      rawResponse: payload,
      responseText: parsed.responseText,
      requestSummary,
    };
  }

  const gameEnvelope = payload.gameEnvelope ?? payload.envelope ?? null;

  return {
    ok: true,
    status: payload.status ?? 'accepted',
    acceptedEvent: payload.acceptedEvent ?? payload.event ?? null,
    gameEnvelope,
    envelope: gameEnvelope,
    projection: payload.projection ?? null,
    warnings,
    rawResponse: payload,
  };
}

function validateSubmitRequest(submitRequest: FootballSubmitEventRequest): FootballSubmitError | null {
  if (!submitRequest || submitRequest.schemaVersion !== 'football.submitEventRequest.v1') {
    return {
      code: 'INVALID_SUBMIT_REQUEST',
      message: 'FCQI submit requires football.submitEventRequest.v1.',
      field: 'schemaVersion',
    };
  }

  if (!submitRequest.gameId) {
    return {
      code: 'INVALID_SUBMIT_REQUEST',
      message: 'FCQI submit requires a gameId.',
      field: 'gameId',
    };
  }

  if (!submitRequest.clientContext?.clientEventId) {
    return {
      code: 'INVALID_SUBMIT_REQUEST',
      message: 'FCQI submit requires clientContext.clientEventId.',
      field: 'clientContext.clientEventId',
    };
  }

  if (!submitRequest.event?.clientEventId) {
    return {
      code: 'INVALID_SUBMIT_REQUEST',
      message: 'FCQI submit requires event.clientEventId.',
      field: 'event.clientEventId',
    };
  }

  return null;
}

async function parseSubmitResponse(response: Response): Promise<
  | { ok: true; payload: CanonicalFootballSubmitResponse; responseText: string; responseJson: unknown }
  | { ok: false; result: FootballSubmitFailureResult }
> {
  const responseText = await readResponseText(response);
  const parsedJson = parseJsonResponseText(responseText);

  if (parsedJson.ok) {
    return {
      ok: true,
      payload: parsedJson.value as CanonicalFootballSubmitResponse,
      responseText,
      responseJson: parsedJson.value,
    };
  }

  try {
    const payload = await response.json() as CanonicalFootballSubmitResponse;
    return { ok: true, payload, responseText: JSON.stringify(payload), responseJson: payload };
  } catch {
    return {
      ok: false,
      result: {
        ok: false,
        errors: [{
          code: response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR',
          message: response.ok
            ? 'Football submit response was not valid JSON.'
            : responseText
              ? `Football submit failed with HTTP ${response.status}. See console for request/response details.`
              : `Football submit failed with HTTP ${response.status}. Empty response body. See console for request/response details.`,
          status: response.status,
          statusText: response.statusText,
          responseText,
        }],
        warnings: [],
        responseText,
      },
    };
  }
}

function normalizeSubmitErrors(
  payload: CanonicalFootballSubmitResponse,
  debug: {
    status: number;
    statusText?: string;
    url: string;
    responseText: string;
    responseJson: unknown;
    requestSummary: FootballSubmitRequestSummary;
  },
): FootballSubmitError[] {
  const status = debug.status;
  const baseDebug = {
    status,
    statusText: debug.statusText,
    url: debug.url,
    responseText: debug.responseText,
    responseJson: debug.responseJson,
    requestSummary: debug.requestSummary,
    clientEventId: debug.requestSummary.clientEventId,
    gameId: debug.requestSummary.gameId,
    eventType: debug.requestSummary.event.type,
    eventSubtype: debug.requestSummary.event.subtype,
    traceId: extractTraceId(payload),
  };

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((error) => ({
      code: error.code ?? 'SUBMIT_REJECTED',
      message: formatSubmitFailureMessage(status, error.message ?? extractBackendMessage(payload) ?? 'Football submit was rejected.'),
      field: error.field,
      status: error.status ?? status,
      details: extractDetails(payload) ?? error.details,
      ...baseDebug,
    }));
  }

  if (payload.error) {
    if (typeof payload.error === 'string') {
      return [{
        code: 'SUBMIT_REJECTED',
        message: formatSubmitFailureMessage(status, payload.error),
        status,
        details: extractDetails(payload),
        ...baseDebug,
      }];
    }

    return [{
      code: payload.error.code ?? 'SUBMIT_REJECTED',
      message: formatSubmitFailureMessage(status, payload.error.message ?? extractBackendMessage(payload) ?? 'Football submit was rejected.'),
      field: payload.error.field,
      status: payload.error.status ?? status,
      details: payload.error.details ?? extractDetails(payload),
      ...baseDebug,
    }];
  }

  const backendMessage = extractBackendMessage(payload);
  return [{
    code: status >= 400 ? 'HTTP_ERROR' : 'SUBMIT_REJECTED',
    message: status >= 400
      ? formatSubmitFailureMessage(status, backendMessage)
      : backendMessage ?? 'Football submit was rejected.',
    status,
    details: extractDetails(payload),
    ...baseDebug,
  }];
}

async function readResponseText(response: Response): Promise<string> {
  if (typeof response.text === 'function') {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
  return '';
}

function parseJsonResponseText(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text.trim()) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function summarizeSubmitRequest(submitRequest: FootballSubmitEventRequest): FootballSubmitRequestSummary {
  return {
    schemaVersion: submitRequest.schemaVersion,
    gameId: submitRequest.gameId,
    clientEventId: submitRequest.clientContext.clientEventId,
    baseEventSequence: submitRequest.clientContext.baseEventSequence,
    event: {
      clientEventId: submitRequest.event.clientEventId,
      type: submitRequest.event.type,
      subtype: submitRequest.event.subtype,
      period: submitRequest.event.period,
      clock: submitRequest.event.clock,
      possession: submitRequest.event.possession,
      description: submitRequest.event.description,
      penaltyCount: submitRequest.event.penalties.length,
      warningCount: submitRequest.event.warnings.length,
    },
  };
}

function logSubmitFailure(input: {
  url: string;
  status: number;
  statusText?: string;
  responseText: string;
  responseJson: unknown;
  requestSummary: FootballSubmitRequestSummary;
}) {
  const { requestSummary } = input;
  console.error('[fcqi-submit] failed', {
    url: input.url,
    status: input.status,
    statusText: input.statusText,
    clientEventId: requestSummary.clientEventId,
    gameId: requestSummary.gameId,
    eventType: requestSummary.event.type,
    eventSubtype: requestSummary.event.subtype,
    responseText: input.responseText,
    responseJson: input.responseJson,
    requestSummary,
  });
}

function formatSubmitFailureMessage(status: number, backendMessage?: string): string {
  if (status >= 400) {
    return backendMessage
      ? `Football submit failed with HTTP ${status}: ${backendMessage}`
      : `Football submit failed with HTTP ${status}. See console for request/response details.`;
  }
  return backendMessage ?? 'Football submit was rejected.';
}

function extractBackendMessage(payload: CanonicalFootballSubmitResponse): string | undefined {
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload.details === 'string' && payload.details.trim()) return payload.details;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (payload.error && typeof payload.error === 'object' && typeof payload.error.message === 'string') return payload.error.message;
  return undefined;
}

function extractDetails(payload: CanonicalFootballSubmitResponse): unknown {
  return payload.details;
}

function extractTraceId(payload: CanonicalFootballSubmitResponse): string | undefined {
  if (typeof payload.traceId === 'string') return payload.traceId;
  if (typeof payload.trace_id === 'string') return payload.trace_id;
  if (payload.error && typeof payload.error === 'object' && typeof payload.error.traceId === 'string') return payload.error.traceId;
  return undefined;
}
