import type { DraftScoringEvent, FootballDraftIntent, SubmitEventRequest } from '../contracts/football';
import type { DraftParticipant, FootballDraftIntent as FcqiIntent } from './footballIntentSchema';
import { mapDraftPenaltyToCanonicalEvent } from './footballPenaltyMapper';
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
  const passer = intent.participants.primary;
  const target = intent.participants.secondary;
  const subtype = intent.play.subtype;
  const isSpike = subtype === 'spike' && intent.result.teamCharged === true;
  const outcome = isSpike ? 'incomplete' : subtype;
  requirePlayer(passer, 'passer', 'participants.primary', errors);
  if (outcome !== 'interception' && !isSpike) requirePlayer(target, 'target', 'participants.secondary', errors);
  if (!['complete', 'incomplete', 'interception', 'spike'].includes(String(subtype))) errors.push({ code: 'UNSUPPORTED_PASS_OUTCOME', message: 'Pass slice supports complete, incomplete, spike, and interception only.', field: 'play.subtype' });
  if (errors.length) return { ok: false, errors, warnings: warning };

  const base = { playerId: passer!.playerId, team: passer!.team, role: 'passer' };
  const targetParticipant = target
    ? { playerId: target.playerId, team: target.team, role: 'intendedReceiver' }
    : null;
  const pass: Record<string, unknown> = { outcome, startYardLine: intent.prePlay.yardLine ?? undefined };
  const result: Record<string, unknown> = { code: outcome, pass, ...(isSpike ? { teamCharged: true } : {}) };
  const participants: DraftScoringEvent['participants'] = { primary: base, secondary: targetParticipant, target: targetParticipant, receiver: null, interceptor: null, defenders: [] };
  if (outcome === 'complete') {
    const receiver = intent.participants.secondary;
    requirePlayer(receiver, 'receiver', 'participants.secondary', errors);
    const yards = intent.result.yards;
    const terminal = intent.result.endYardLine;
    if (!Number.isInteger(yards)) errors.push({ code: 'PASS_YARDS_REQUIRED', message: 'Complete Pass requires whole-number total yardage.', field: 'result.yards' });
    if (!terminal && intent.result.scoring?.type !== 'touchdown') errors.push({ code: 'PASS_TERMINAL_SPOT_REQUIRED', message: 'Non-touchdown completion requires an end spot.', field: 'result.endYardLine' });
    participants.receiver = { playerId: receiver!.playerId, team: receiver!.team, role: 'receiver' };
    result.yards = yards;
    if (terminal) result.endYardLine = terminal;
    pass.catchYardLine = intent.result.pass?.caughtAtYardLine;
    pass.terminalYardLine = terminal;
    pass.passingYards = yards;
    pass.receivingYards = yards;
    pass.outOfBounds = intent.result.code === 'outOfBounds';
    if (intent.result.scoring) result.scoring = { ...intent.result.scoring };
    if (intent.result.fumble) result.fumble = { ...intent.result.fumble };
    if (intent.result.turnover) result.turnover = { ...intent.result.turnover };
    if (intent.result.return) result.return = { ...intent.result.return };
    if (intent.result.laterals) result.laterals = intent.result.laterals.map((lateral) => ({ ...lateral }));
    if (intent.result.nextPossession) result.nextPossession = intent.result.nextPossession;
  } else if (outcome === 'interception') {
    const interceptor = intent.participants.defenders.find((player) => player.role === 'interceptor') ?? intent.participants.defenders[0];
    requirePlayer(interceptor, 'interceptor', 'participants.defenders', errors);
    const turnover = intent.result.turnover;
    const spot = turnover?.spot;
    const returnYards = turnover?.returnYards ?? 0;
    if (!spot) errors.push({ code: 'INTERCEPTION_SPOT_REQUIRED', message: 'Interception requires its catch spot.', field: 'result.turnover.spot' });
    if (returnYards > 0 && !turnover?.returnEndYardLine) errors.push({ code: 'INTERCEPTION_RETURN_END_SPOT_REQUIRED', message: 'Interception return requires an end spot.', field: 'result.turnover.returnEndYardLine' });
    participants.interceptor = { playerId: interceptor!.playerId, team: interceptor!.team, role: 'interceptor' };
    participants.defenders = intent.participants.defenders.map((participant) => ({
      playerId: participant.playerId,
      team: participant.team,
      role: participant.role,
    }));
    pass.interceptionYardLine = spot;
    pass.interceptionReturnYards = returnYards;
    pass.terminalYardLine = turnover?.returnEndYardLine;
    if (intent.result.scoring) result.scoring = { ...intent.result.scoring };
    result.turnover = turnover ? { ...turnover } : null;
    if (intent.result.return) result.return = { ...intent.result.return };
    if (intent.result.fumble) result.fumble = { ...intent.result.fumble };
    if (intent.result.laterals) result.laterals = intent.result.laterals.map((lateral) => ({ ...lateral }));
    if (intent.result.endYardLine) result.endYardLine = intent.result.endYardLine;
    if (intent.result.nextPossession) result.nextPossession = intent.result.nextPossession;
  }
  if (errors.length) return { ok: false, errors, warnings: warning };
  const summary = generateFootballPlaySummary(intent);
  const event: DraftScoringEvent = {
    clientEventId: intent.clientEventId, type: 'pass', subtype, createdAt: intent.confirmation!.confirmedAt,
    period: intent.play.period, clock: intent.play.clock!, possession: intent.play.possession!, preState: { ...intent.prePlay },
    participants, result: result as DraftScoringEvent['result'], penalties: intent.penalties.map(mapDraftPenaltyToCanonicalEvent), description: intent.confirmation!.summaryText || summary.summaryText,
  };
  const request: SubmitEventRequest = { schemaVersion: 'football.submitEventRequest.v1', gameId: intent.game.gameId, clientContext: { clientEventId: intent.clientEventId, submittedAt: intent.confirmation!.confirmedAt, baseEventSequence: intent.source.baseEventSequence, ...(intent.source.baseEnvelopeVersion ? { baseEnvelopeVersion: intent.source.baseEnvelopeVersion } : {}), ...(intent.source.sessionId ? { sessionId: intent.source.sessionId } : {}), ...(intent.source.userId ? { userId: intent.source.userId } : {}) }, event };
  return { ok: true, event, submitRequest: request, warnings: [...warning, ...summary.warnings] };
}

function requirePlayer(player: DraftParticipant | undefined, label: string, field: string, errors: Array<{ code: string; message: string; field?: string }>) {
  if (!player?.playerId || player.resolution.source === 'explicitUnknown') errors.push({ code: 'UNRESOLVED_PLAYER', message: `A resolved ${label} is required.`, field });
}
