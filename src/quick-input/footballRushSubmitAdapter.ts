import type {
  AcceptedScoringEvent,
  GameEnvelope,
  SubmitEventRequest,
  SubmitEventResponse,
} from '../contracts/football';

export const CANONICAL_FOOTBALL_SUBMIT_ENDPOINT = '/strata_football/api/football/events/submit.php' as const;

export type CanonicalRushSubmitResult =
  | {
      ok: true;
      contractMode: 'canonicalRush';
      status: 'accepted' | 'duplicateAccepted';
      acceptedEvent: AcceptedScoringEvent;
      gameEnvelope: GameEnvelope;
      warnings: SubmitEventResponse['warnings'];
      rawResponse: SubmitEventResponse;
    }
  | {
      ok: false;
      contractMode: 'canonicalRush';
      errors: Array<{ code: string; message: string; field?: string | null; status?: number }>;
      warnings: SubmitEventResponse['warnings'];
      rawResponse?: unknown;
    };

export function isCanonicalRushSubmitRequest(value: unknown): value is SubmitEventRequest {
  if (!isRecord(value) || !isRecord(value.event)) return false;
  return value.schemaVersion === 'football.submitEventRequest.v1'
    && value.event.type === 'rush'
    && !('source' in value.event)
    && !('confirmation' in value.event)
    && !('warnings' in value.event);
}

export async function submitCanonicalRushEvent(
  request: SubmitEventRequest,
  options: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<CanonicalRushSubmitResult> {
  const requestError = validateRequest(request);
  if (requestError) {
    return { ok: false, contractMode: 'canonicalRush', errors: [requestError], warnings: [] };
  }

  const fetcher = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    return { ok: false, contractMode: 'canonicalRush', errors: [{ code: 'NETWORK_ERROR', message: 'No fetch implementation is available for canonical Rush submit.' }], warnings: [] };
  }

  let response: Response;
  try {
    response = await fetcher(options.endpoint ?? CANONICAL_FOOTBALL_SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (error) {
    return {
      ok: false,
      contractMode: 'canonicalRush',
      errors: [{ code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Canonical Rush submit failed.' }],
      warnings: [],
    };
  }

  const text = await response.text().catch(() => '');
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return {
      ok: false,
      contractMode: 'canonicalRush',
      errors: [{ code: 'INVALID_RESPONSE', message: response.ok ? 'Canonical Rush response was not valid JSON.' : `Football submit failed with HTTP ${response.status}.`, status: response.status }],
      warnings: [],
      rawResponse: text,
    };
  }

  const responseError = validateResponseEnvelope(payload, request);
  if (responseError) {
    return {
      ok: false,
      contractMode: 'canonicalRush',
      errors: [{ ...responseError, status: response.status }],
      warnings: isRecord(payload) && Array.isArray(payload.warnings) ? payload.warnings as SubmitEventResponse['warnings'] : [],
      rawResponse: payload,
    };
  }

  const canonical = payload as SubmitEventResponse;
  if (!response.ok || !canonical.success) {
    console.error('[fcqi-submit] failed', {
      url: options.endpoint ?? CANONICAL_FOOTBALL_SUBMIT_ENDPOINT,
      status: response.status,
      statusText: response.statusText,
      clientEventId: request.clientContext.clientEventId,
      gameId: request.gameId,
      eventType: request.event.type,
      eventSubtype: request.event.subtype,
      responseText: text,
      responseJson: canonical,
      requestSummary: {
        schemaVersion: request.schemaVersion,
        gameId: request.gameId,
        clientEventId: request.clientContext.clientEventId,
        event: { type: request.event.type, subtype: request.event.subtype },
      },
    });
    return {
      ok: false,
      contractMode: 'canonicalRush',
      errors: canonical.errors.map((error) => ({
        ...error,
        message: response.status >= 400
          ? `Football submit failed with HTTP ${response.status}: ${error.message}`
          : error.message,
        status: response.status,
      })),
      warnings: canonical.warnings,
      rawResponse: canonical,
    };
  }

  return {
    ok: true,
    contractMode: 'canonicalRush',
    status: canonical.status as 'accepted' | 'duplicateAccepted',
    acceptedEvent: canonical.acceptedEvent as AcceptedScoringEvent,
    gameEnvelope: canonical.gameEnvelope,
    warnings: canonical.warnings,
    rawResponse: canonical,
  };
}

function validateRequest(request: SubmitEventRequest): { code: string; message: string; field?: string } | null {
  if (!isRecord(request) || request.schemaVersion !== 'football.submitEventRequest.v1') {
    return { code: 'INVALID_SUBMIT_REQUEST', message: 'Canonical Rush submit requires football.submitEventRequest.v1.', field: 'schemaVersion' };
  }
  if (!isRecord(request.event) || request.event.type !== 'rush') {
    return { code: 'INVALID_SUBMIT_REQUEST', message: 'Canonical Rush submit accepts event.type rush only.', field: 'event.type' };
  }
  for (const field of ['eventId', 'sequence', 'status', 'acceptedAt', 'postState', 'source', 'confirmation', 'warnings']) {
    if (field in request.event) return { code: 'INVALID_SUBMIT_REQUEST', message: `Draft Rush event cannot contain ${field}.`, field: `event.${field}` };
  }
  if (request.clientContext?.clientEventId !== request.event.clientEventId) {
    return { code: 'CLIENT_EVENT_ID_MISMATCH', message: 'Request and event clientEventId must match.', field: 'event.clientEventId' };
  }
  if (!/^[0-9]{2}:[0-5][0-9]$/.test(request.event.clock)) {
    return { code: 'INVALID_SUBMIT_REQUEST', message: 'Rush clock must use MM:SS.', field: 'event.clock' };
  }
  if (!['H', 'V'].includes(request.event.possession)) {
    return { code: 'INVALID_SUBMIT_REQUEST', message: 'Rush possession must be H or V.', field: 'event.possession' };
  }
  const spots = [request.event.preState.yardLine, request.event.result.endYardLine].filter((spot): spot is string => typeof spot === 'string');
  if (spots.some((spot) => !isCanonicalSpot(spot))) {
    return { code: 'INVALID_SUBMIT_REQUEST', message: 'Rush spots must use canonical zero-padded field notation.', field: 'event.result.endYardLine' };
  }
  return null;
}

function validateResponseEnvelope(payload: unknown, request: SubmitEventRequest): { code: string; message: string; field?: string } | null {
  if (!isRecord(payload)) return { code: 'INVALID_RESPONSE', message: 'Canonical Rush response must be an object.' };
  for (const alias of ['ok', 'event', 'envelope', 'projection']) {
    if (alias in payload) return { code: 'INVALID_RESPONSE', message: `Canonical Rush response cannot use legacy alias ${alias}.`, field: alias };
  }
  for (const field of ['schemaVersion', 'success', 'status', 'acceptedEvent', 'gameEnvelope', 'warnings', 'errors']) {
    if (!(field in payload)) return { code: 'INVALID_RESPONSE', message: `Canonical Rush response is missing ${field}.`, field };
  }
  if (payload.schemaVersion !== 'football.submitEventResponse.v1' || typeof payload.success !== 'boolean') {
    return { code: 'INVALID_RESPONSE', message: 'Canonical Rush response schema identity is invalid.', field: 'schemaVersion' };
  }
  if (!Array.isArray(payload.warnings) || !Array.isArray(payload.errors) || !isRecord(payload.gameEnvelope)) {
    return { code: 'INVALID_RESPONSE', message: 'Canonical Rush response envelope fields are malformed.' };
  }
  if (payload.gameEnvelope.schemaVersion !== 'football.gameEnvelope.v1' || payload.gameEnvelope.gameId !== request.gameId || !Array.isArray(payload.gameEnvelope.events)) {
    return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Authoritative game envelope identity does not match the submitted game.', field: 'gameEnvelope.gameId' };
  }
  if (payload.success === false) {
    if (payload.status !== 'rejected' || payload.acceptedEvent !== null || payload.errors.length === 0) {
      return { code: 'INVALID_RESPONSE', message: 'Rejected canonical response must contain typed errors and no accepted event.' };
    }
    return null;
  }
  if (!['accepted', 'duplicateAccepted'].includes(String(payload.status)) || !isRecord(payload.acceptedEvent)) {
    return { code: 'INVALID_RESPONSE', message: 'Successful canonical response requires a full accepted event.', field: 'acceptedEvent' };
  }
  const accepted = payload.acceptedEvent;
  if (typeof accepted.eventId !== 'string' || !Number.isInteger(accepted.sequence) || accepted.status !== 'accepted' || typeof accepted.acceptedAt !== 'string') {
    return { code: 'INVALID_RESPONSE', message: 'Accepted Rush event is missing backend identity or sequence.', field: 'acceptedEvent' };
  }
  if (accepted.clientEventId !== request.clientContext.clientEventId || accepted.type !== 'rush') {
    return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Accepted event identity does not match the submitted Rush event.', field: 'acceptedEvent.clientEventId' };
  }
  let previous = 0;
  for (const event of payload.gameEnvelope.events) {
    if (!isRecord(event) || !Number.isInteger(event.sequence) || Number(event.sequence) <= previous) {
      return { code: 'INVALID_RESPONSE', message: 'Authoritative envelope events must be strictly sequence ordered.', field: 'gameEnvelope.events' };
    }
    previous = Number(event.sequence);
  }
  const authoritativeEvent = payload.gameEnvelope.events.find((event) => isRecord(event) && event.eventId === accepted.eventId);
  if (!isRecord(authoritativeEvent) || authoritativeEvent.clientEventId !== accepted.clientEventId || authoritativeEvent.sequence !== accepted.sequence) {
    return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Accepted event must be present unchanged in the authoritative envelope.', field: 'gameEnvelope.events' };
  }
  return null;
}

function isCanonicalSpot(value: string): boolean {
  return value === '50' || /^(?:H|V)[0-4][0-9]$/.test(value);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
