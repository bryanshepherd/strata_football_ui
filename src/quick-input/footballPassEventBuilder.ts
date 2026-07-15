import type { DraftScoringEvent, FootballDraftIntent, SubmitEventRequest } from '../contracts/football';
import type { DraftParticipant, FootballDraftIntent as FcqiIntent } from './footballIntentSchema';
import { generateFootballPlaySummary } from './footballPlaySummaryGrammar';

export type PassEventBuildResult =
  | { ok: true; event: DraftScoringEvent; submitRequest: SubmitEventRequest; warnings: FcqiIntent['warnings'] }
  | { ok: false; errors: Array<{ code: string; message: string; field?: string }>; warnings: FcqiIntent['warnings'] };

/** Pure FCQI boundary for the supported production Pass outcomes. */
export function buildCanonicalPassEvent(intent: FcqiIntent): PassEventBuildResult {
  const errors: Array<{ code: string; message: string; field?: string }> = [];
  const warning = [...intent.warnings];
  if (intent.status !== 'confirmed') errors.push({ code: 'UNCONFIRMED_DRAFT', message: 'Pass drafts must be confirmed before submission.', field: 'status' });
  if (intent.play.family !== 'pass') errors.push({ code: 'UNSUPPORTED_PLAY_FAMILY', message: 'Canonical Pass builder accepts Pass drafts only.', field: 'play.family' });
  if (!intent.clientEventId) errors.push({ code: 'MISSING_CLIENT_EVENT_ID', message: 'clientEventId is required.', field: 'clientEventId' });
  if (intent.penalties.length) errors.push({ code: 'PENALTIES_OUT_OF_SCOPE', message: 'Penalties are not supported by the Pass slice.', field: 'penalties' });
  const passer = intent.participants.primary;
  const target = intent.participants.secondary;
  const outcome = intent.play.subtype;
  requirePlayer(passer, 'passer', 'participants.primary', errors);
  requirePlayer(target, 'target', 'participants.secondary', errors);
  if (!['complete', 'incomplete', 'interception'].includes(String(outcome))) errors.push({ code: 'UNSUPPORTED_PASS_OUTCOME', message: 'Pass slice supports complete, incomplete, and interception only.', field: 'play.subtype' });
  if (errors.length) return { ok: false, errors, warnings: warning };

  const base = { playerId: passer!.playerId, team: passer!.team, role: 'passer' };
  const targetParticipant = { playerId: target!.playerId, team: target!.team, role: 'intendedReceiver' };
  const pass: Record<string, unknown> = { outcome, startYardLine: intent.prePlay.yardLine ?? undefined };
  const result: Record<string, unknown> = { code: outcome, pass };
  const participants: DraftScoringEvent['participants'] = { primary: base, secondary: targetParticipant, target: targetParticipant, receiver: null, interceptor: null, defenders: [] };
  if (outcome === 'complete') {
    const receiver = intent.participants.secondary;
    requirePlayer(receiver, 'receiver', 'participants.secondary', errors);
    const yards = intent.result.yards;
    const terminal = intent.result.endYardLine;
    if (!Number.isInteger(yards) || (yards as number) < 0) errors.push({ code: 'PASS_YARDS_REQUIRED', message: 'Complete Pass requires non-negative total yardage.', field: 'result.yards' });
    if (!terminal && intent.result.scoring?.type !== 'touchdown') errors.push({ code: 'PASS_TERMINAL_SPOT_REQUIRED', message: 'Non-touchdown completion requires an end spot.', field: 'result.endYardLine' });
    participants.receiver = { playerId: receiver!.playerId, team: receiver!.team, role: 'receiver' };
    pass.catchYardLine = intent.result.pass?.caughtAtYardLine;
    pass.terminalYardLine = terminal;
    pass.passingYards = yards;
    pass.receivingYards = yards;
    pass.outOfBounds = intent.result.code === 'outOfBounds';
    if (intent.result.scoring) result.scoring = { ...intent.result.scoring };
  } else if (outcome === 'interception') {
    const interceptor = intent.participants.defenders.find((player) => player.role === 'interceptor') ?? intent.participants.defenders[0];
    requirePlayer(interceptor, 'interceptor', 'participants.defenders', errors);
    const turnover = intent.result.turnover;
    const spot = turnover?.spot;
    const returnYards = turnover?.returnYards ?? 0;
    if (!spot) errors.push({ code: 'INTERCEPTION_SPOT_REQUIRED', message: 'Interception requires its catch spot.', field: 'result.turnover.spot' });
    if (returnYards > 0 && !turnover?.returnEndYardLine) errors.push({ code: 'INTERCEPTION_RETURN_END_SPOT_REQUIRED', message: 'Interception return requires an end spot.', field: 'result.turnover.returnEndYardLine' });
    participants.interceptor = { playerId: interceptor!.playerId, team: interceptor!.team, role: 'interceptor' };
    participants.defenders = [participants.interceptor];
    pass.interceptionYardLine = spot;
    pass.interceptionReturnYards = returnYards;
    pass.terminalYardLine = turnover?.returnEndYardLine;
    if (intent.result.scoring) result.scoring = { ...intent.result.scoring };
  }
  if (errors.length) return { ok: false, errors, warnings: warning };
  const summary = generateFootballPlaySummary(intent);
  const event: DraftScoringEvent = {
    clientEventId: intent.clientEventId, type: 'pass', subtype: outcome, createdAt: intent.confirmation!.confirmedAt,
    period: intent.play.period, clock: intent.play.clock!, possession: intent.play.possession!, preState: { ...intent.prePlay },
    participants, result: result as DraftScoringEvent['result'], penalties: [], description: intent.confirmation!.summaryText || summary.summaryText,
  };
  const request: SubmitEventRequest = { schemaVersion: 'football.submitEventRequest.v1', gameId: intent.game.gameId, clientContext: { clientEventId: intent.clientEventId, submittedAt: intent.confirmation!.confirmedAt, baseEventSequence: intent.source.baseEventSequence, ...(intent.source.baseEnvelopeVersion ? { baseEnvelopeVersion: intent.source.baseEnvelopeVersion } : {}), ...(intent.source.sessionId ? { sessionId: intent.source.sessionId } : {}), ...(intent.source.userId ? { userId: intent.source.userId } : {}) }, event };
  return { ok: true, event, submitRequest: request, warnings: [...warning, ...summary.warnings] };
}

function requirePlayer(player: DraftParticipant | undefined, label: string, field: string, errors: Array<{ code: string; message: string; field?: string }>) {
  if (!player?.playerId || player.resolution.source === 'explicitUnknown') errors.push({ code: 'UNRESOLVED_PLAYER', message: `A resolved ${label} is required.`, field });
}
