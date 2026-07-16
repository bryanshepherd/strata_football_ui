import type { AcceptedScoringEvent, GameEnvelope, SubmitEventRequest, SubmitEventResponse } from '../contracts/football';
import { getFootballScorerRuntimeConfig } from '../services/footballRuntimeConfig';

export const CANONICAL_FOOTBALL_PASS_SUBMIT_ENDPOINT = '/api/football/events' as const;
export type CanonicalPassSubmitResult =
  | { ok: true; contractMode: 'canonicalPass'; status: 'accepted' | 'duplicateAccepted'; acceptedEvent: AcceptedScoringEvent; gameEnvelope: GameEnvelope; warnings: SubmitEventResponse['warnings']; rawResponse: SubmitEventResponse }
  | { ok: false; contractMode: 'canonicalPass'; errors: Array<{ code: string; message: string; field?: string; status?: number }>; warnings: SubmitEventResponse['warnings']; rawResponse?: unknown };

export function isCanonicalPassSubmitRequest(value: unknown): value is SubmitEventRequest {
  return isRecord(value) && isRecord(value.event) && value.schemaVersion === 'football.submitEventRequest.v1' && value.event.type === 'pass' && !['source', 'confirmation', 'warnings', 'eventId', 'sequence', 'status', 'acceptedAt', 'postState'].some((key) => key in value.event);
}

export async function submitCanonicalPassEvent(request: SubmitEventRequest, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<CanonicalPassSubmitResult> {
  const invalid = validateRequest(request);
  if (invalid) return fail(invalid);
  const fetcher = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetcher !== 'function') return fail({ code: 'NETWORK_ERROR', message: 'No fetch implementation is available for canonical Pass submit.' });
  let response: Response;
  try { response = await fetcher(options.endpoint ?? getFootballScorerRuntimeConfig()?.eventSubmitUrl ?? CANONICAL_FOOTBALL_PASS_SUBMIT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }); }
  catch (error) { return fail({ code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Canonical Pass submit failed.' }); }
  let payload: unknown;
  try { payload = JSON.parse(await response.text()); } catch { return fail({ code: 'INVALID_RESPONSE', message: 'Canonical Pass response was not valid JSON.', status: response.status }); }
  const invalidResponse = validateResponse(payload, request);
  if (invalidResponse) return fail({ ...invalidResponse, status: response.status }, payload);
  const canonical = payload as SubmitEventResponse;
  if (!response.ok || !canonical.success) return fail({ ...(canonical.errors[0] ?? { code: 'SUBMIT_REJECTED', message: 'Canonical Pass submit was rejected.' }), status: response.status }, canonical, canonical.warnings);
  return { ok: true, contractMode: 'canonicalPass', status: canonical.status as 'accepted' | 'duplicateAccepted', acceptedEvent: canonical.acceptedEvent as AcceptedScoringEvent, gameEnvelope: canonical.gameEnvelope, warnings: canonical.warnings, rawResponse: canonical };
}

function validateRequest(request: SubmitEventRequest) {
  if (!isCanonicalPassSubmitRequest(request)) return { code: 'INVALID_SUBMIT_REQUEST', message: 'Canonical Pass submit requires a backend-field-free football.submitEventRequest.v1 Pass event.' };
  if (request.clientContext.clientEventId !== request.event.clientEventId) return { code: 'CLIENT_EVENT_ID_MISMATCH', message: 'Request and event clientEventId must match.', field: 'event.clientEventId' };
  if (!/^\d{2}:[0-5]\d$/.test(request.event.clock) || !['H', 'V'].includes(request.event.possession)) return { code: 'INVALID_SUBMIT_REQUEST', message: 'Pass clock and possession must be canonical.', field: 'event' };
  return null;
}
function validateResponse(payload: unknown, request: SubmitEventRequest) {
  if (!isRecord(payload)) return { code: 'INVALID_RESPONSE', message: 'Canonical Pass response must be an object.' };
  for (const alias of ['ok', 'event', 'envelope', 'projection']) if (alias in payload) return { code: 'INVALID_RESPONSE', message: `Canonical Pass response cannot use legacy alias ${alias}.`, field: alias };
  for (const field of ['schemaVersion','success','status','acceptedEvent','gameEnvelope','warnings','errors']) if (!(field in payload)) return { code: 'INVALID_RESPONSE', message: `Canonical Pass response is missing ${field}.`, field };
  if (payload.schemaVersion !== 'football.submitEventResponse.v1' || !isRecord(payload.gameEnvelope) || !Array.isArray(payload.gameEnvelope.events) || !Array.isArray(payload.warnings) || !Array.isArray(payload.errors)) return { code: 'INVALID_RESPONSE', message: 'Canonical Pass response shape is invalid.' };
  if (payload.gameEnvelope.schemaVersion !== 'football.gameEnvelope.v1' || payload.gameEnvelope.gameId !== request.gameId) return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Authoritative envelope identity does not match the submitted game.' };
  if (!payload.success) return payload.status === 'rejected' && payload.acceptedEvent === null ? null : { code: 'INVALID_RESPONSE', message: 'Rejected response must include errors and no accepted event.' };
  if (!isRecord(payload.acceptedEvent) || payload.acceptedEvent.type !== 'pass' || payload.acceptedEvent.clientEventId !== request.clientContext.clientEventId || !Number.isInteger(payload.acceptedEvent.sequence) || payload.acceptedEvent.status !== 'accepted') return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Accepted Pass event identity does not match the request.' };
  let previous = 0; for (const event of payload.gameEnvelope.events) { if (!isRecord(event) || !Number.isInteger(event.sequence) || Number(event.sequence) <= previous) return { code: 'INVALID_RESPONSE', message: 'Authoritative events must be strictly sequence ordered.' }; previous = Number(event.sequence); }
  const copies = payload.gameEnvelope.events.filter((event) => isRecord(event) && event.eventId === payload.acceptedEvent.eventId); if (copies.length !== 1) return { code: 'RESPONSE_IDENTITY_MISMATCH', message: 'Accepted Pass event must appear exactly once in the authoritative envelope.' };
  return null;
}
function fail(error: { code: string; message: string; field?: string; status?: number }, rawResponse?: unknown, warnings: SubmitEventResponse['warnings'] = []): CanonicalPassSubmitResult { return { ok: false, contractMode: 'canonicalPass', errors: [error], warnings, rawResponse }; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
