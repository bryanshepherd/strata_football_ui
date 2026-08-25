const TEAM_CODES = new Set(['H', 'V']);
const DEFAULT_DOWNS = 4;
const DEFAULT_YARDS_TO_FIRST = 10;

export function normalizeTeamCode(value) {
  if (value === 'H' || value === 'HOME' || value === 'home') {
    return 'H';
  }

  if (value === 'V' || value === 'VISITOR' || value === 'visitor' || value === 'away') {
    return 'V';
  }

  return null;
}

export function oppositeTeam(team) {
  const normalized = normalizeTeamCode(team);
  if (normalized === 'H') return 'V';
  if (normalized === 'V') return 'H';
  return null;
}

export function parseSpot(spot) {
  if (typeof spot !== 'string') {
    return { raw: spot, valid: false, reason: 'spot must be a string' };
  }

  const normalized = spot.trim().toUpperCase();
  if (normalized === 'GOAL') {
    return { raw: 'goal', valid: true, goal: true };
  }

  if (normalized === '50') {
    return { raw: normalized, valid: true, side: '50', yard: 50 };
  }

  const match = normalized.match(/^([HV])(\d{1,2})$/);
  if (!match) {
    return { raw: normalized, valid: false, reason: 'spot must use H35, V20, or 50 format' };
  }

  const yard = Number(match[2]);
  if (yard < 0 || yard > 50) {
    return { raw: spot, valid: false, reason: 'yard must be between 00 and 50' };
  }

  return {
    raw: `${match[1]}${String(yard).padStart(2, '0')}`,
    valid: true,
    side: match[1],
    yard,
  };
}

export function spotToPossessionRelative(spot, possession) {
  const parsed = typeof spot === 'string' ? parseSpot(spot) : spot;
  const team = normalizeTeamCode(possession);

  if (!team || !parsed?.valid) {
    return null;
  }

  if (parsed.goal) return 100;

  if (parsed.side === '50') {
    return 50;
  }

  return parsed.side === team ? parsed.yard : 100 - parsed.yard;
}

export function possessionRelativeToSpot(relativeYards, possession) {
  const team = normalizeTeamCode(possession);
  if (!team || typeof relativeYards !== 'number' || Number.isNaN(relativeYards)) {
    return null;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(relativeYards)));
  if (clamped === 50) {
    return '50';
  }

  if (clamped <= 50) {
    return `${team}${String(clamped).padStart(2, '0')}`;
  }

  const opponent = oppositeTeam(team);
  return `${opponent}${String(100 - clamped).padStart(2, '0')}`;
}

export function calculateYardsGained(startSpot, endSpot, possession) {
  const startRelative = spotToPossessionRelative(startSpot, possession);
  const parsedEnd = typeof endSpot === 'string' ? parseSpot(endSpot) : endSpot;
  if (typeof startRelative === 'number' && parsedEnd?.valid && parsedEnd.goal) {
    return 100 - startRelative;
  }
  const endRelative = spotToPossessionRelative(endSpot, possession);

  if (typeof startRelative !== 'number' || typeof endRelative !== 'number') {
    return null;
  }

  return endRelative - startRelative;
}

export function calculateLineToGain(yardLine, possession, yardsToFirstDown = DEFAULT_YARDS_TO_FIRST) {
  const currentRelative = spotToPossessionRelative(yardLine, possession);
  if (typeof currentRelative !== 'number') {
    return null;
  }

  const targetRelative = currentRelative + yardsToFirstDown;
  if (targetRelative >= 100) {
    return 'goal';
  }

  return possessionRelativeToSpot(targetRelative, possession);
}

export function calculateYardsToGain(yardLine, lineToGain, possession) {
  const currentRelative = spotToPossessionRelative(yardLine, possession);
  if (typeof currentRelative !== 'number') {
    return null;
  }

  if (lineToGain === 'goal') {
    return Math.max(100 - currentRelative, 0);
  }

  const targetRelative = spotToPossessionRelative(lineToGain, possession);
  if (typeof targetRelative !== 'number') {
    return null;
  }

  return Math.max(targetRelative - currentRelative, 0);
}

export function isRedZone(yardLine, possession) {
  const relative = spotToPossessionRelative(yardLine, possession);
  return typeof relative === 'number' && relative >= 80 && relative < 100;
}

export function isGoalToGo(yardLine, lineToGain, possession) {
  if (lineToGain === 'goal') {
    return true;
  }

  const targetRelative = spotToPossessionRelative(lineToGain, possession);
  return typeof targetRelative === 'number' && targetRelative >= 100;
}

export function createLiveState({
  possession,
  down,
  distance,
  yardLine,
  lineToGain,
  driveId,
  driveNumber,
}) {
  const normalizedPossession = normalizeTeamCode(possession);
  const activeLineToGain =
    lineToGain || (normalizedPossession && yardLine ? calculateLineToGain(yardLine, normalizedPossession) : null);
  const activeDistance =
    typeof distance === 'number'
      ? distance
      : normalizedPossession && yardLine
        ? calculateYardsToGain(yardLine, activeLineToGain, normalizedPossession)
        : null;

  return {
    possession: normalizedPossession,
    down: down ?? null,
    distance: activeDistance,
    yardLine: yardLine ?? null,
    lineToGain: activeLineToGain,
    goalToGo: Boolean(normalizedPossession && yardLine && isGoalToGo(yardLine, activeLineToGain, normalizedPossession)),
    redZone: Boolean(normalizedPossession && yardLine && isRedZone(yardLine, normalizedPossession)),
    driveId: driveId ?? null,
    driveNumber: driveNumber ?? 0,
    pendingTryTeam: null,
    kickoffTeam: null,
    nextPlayContext:
      normalizedPossession && down && activeDistance !== null && yardLine
        ? `${normalizedPossession},${down},${activeLineToGain === 'goal' ? 'goal' : activeDistance},${yardLine}`
        : null,
  };
}

export function applyFootballEventToEnvelope(envelope, event, options = {}) {
  const trace = [];
  const rules = {
    ...(envelope?.game?.rules || {}),
    downs: envelope?.game?.rules?.downs || DEFAULT_DOWNS,
    yardsToFirstDown: envelope?.game?.rules?.yardsToFirstDown || DEFAULT_YARDS_TO_FIRST,
  };
  const preState = normalizePreState(envelope, event);
  const eventType = event?.type;
  const result = event?.result || {};
  const endYardLine = penaltyAdjustedEndYardLine(event, preState) || result.endYardLine || result.returnEndYardLine || event?.postState?.yardLine || preState.yardLine;
  const statisticalEndYardLine = acceptedPreviousSpotPenalty(event)
    ? preState.yardLine
    : acceptedSpotOfFoul(event) || result.endYardLine || result.returnEndYardLine || endYardLine;
  const possession = normalizeTeamCode(event?.possession || preState.possession);
  const explicitScoringCounts = !acceptedPreviousSpotPenalty(event) && !acceptedSpotOfFoul(event);

  addTrace(trace, 'state', 'pre-play state read', {
    input: preState,
    result: 'read',
    reason: 'Engine consumes canonical GameEnvelope.liveState plus ScoringEvent.preState.',
  });

  if (eventType === 'try') {
    const tryTeam = normalizeTeamCode(event?.participants?.primary?.team || event?.participants?.kicker?.team || event?.result?.scoring?.team);
    const kickoffSpot = ruleSpotForTeam(rules.kickoffSpot || 'H35', tryTeam, 'own');
    return endPossessionFreeContext(envelope, event, preState, 'try', trace, kickoffSpot, {
      kickoffTeam: tryTeam,
      nextPlayContext: 'awaitingKickoff',
    });
  }

  if (isTouchdownEvent(event, statisticalEndYardLine, possession, explicitScoringCounts)) {
    const scoring = event.result?.scoring || { team: possession, points: 6, type: 'touchdown' };
    const scoringTeam = normalizeTeamCode(scoring.team) || possession;
    const patSpot = ruleSpotForTeam(rules.patSpot || 'V03', scoringTeam, 'opponent');
    return endDriveOnly(envelope, event, preState, statisticalEndYardLine, 'touchdown', trace, patSpot, scoring, {
      pendingTryTeam: scoringTeam,
      nextPlayContext: 'awaitingTry',
    });
  }

  if (isSafetyEvent(event, statisticalEndYardLine, possession, explicitScoringCounts)) {
    const scoring = event.result?.scoring || { team: oppositeTeam(possession), points: 2, type: 'safety' };
    const scoringTeam = normalizeTeamCode(scoring.team) || oppositeTeam(possession);
    const safetyTeam = oppositeTeam(scoringTeam);
    const safetyKickSpot = ruleSpotForTeam(rules.safetyKickSpot || rules.freeKickSpot || 'H20', safetyTeam, 'own');
    return endDriveOnly(envelope, event, preState, statisticalEndYardLine, 'safety', trace, safetyKickSpot, scoring, {
      kickoffTeam: safetyTeam,
      nextPlayContext: 'awaitingSafetyKick',
    });
  }

  if (eventType === 'kickoff') {
    if (acceptedPreviousSpotPenalty(event) && hasReplayDown(event)) {
      return applyKickoffRekick(envelope, event, preState, endYardLine, trace);
    }
    return applyKickoff(envelope, event, preState, endYardLine, options, trace, rules);
  }

  if (eventType === 'punt') {
    return applyPossessionChangeEndDrive(envelope, event, preState, endYardLine, 'punt', options, trace, rules);
  }

  if (eventType === 'fieldGoal') {
    return applyFieldGoal(envelope, event, preState, endYardLine, options, trace, rules);
  }

  if (result.turnover) {
    return applyPossessionChangeEndDrive(envelope, event, preState, turnoverEndSpot(result, endYardLine), 'turnover', options, trace, rules);
  }

  return applyScrimmagePlay(envelope, event, preState, endYardLine, options, trace, rules, statisticalEndYardLine);
}

function applyScrimmagePlay(envelope, event, preState, endYardLine, options, trace, rules, statisticalEndYardLine = endYardLine) {
  const possession = normalizeTeamCode(event.possession || preState.possession);
  const yardsGained = resultYards(event, preState, statisticalEndYardLine, possession);
  const yardsToGain = calculateYardsToGain(preState.yardLine, preState.lineToGain, possession);
  const automaticFirstDown = hasAutomaticFirstDown(event);
  const replayDown = hasReplayDown(event);
  const explicitPlayResultCounts = !acceptedPreviousSpotPenalty(event) && !acceptedSpotOfFoul(event);
  const firstDown = automaticFirstDown || (!replayDown && (
    (explicitPlayResultCounts && event.result?.firstDown === true)
    || (typeof yardsGained === 'number' && typeof yardsToGain === 'number' && yardsGained >= yardsToGain)
  ));

  addTrace(trace, 'field', 'possession-relative yard math', {
    input: { start: preState.yardLine, statisticalEnd: statisticalEndYardLine, enforcedEnd: endYardLine, possession },
    result: `${yardsGained ?? 'unknown'} yards`,
    reason: 'Gain/loss is calculated from offense-relative field positions.',
  });

  addTrace(trace, 'down-distance', 'first-down checks', {
    input: { yardsGained, yardsToGain, resultFirstDown: event.result?.firstDown, automaticFirstDown, replayDown },
    result: firstDown ? 'first down' : 'no first down',
    reason: 'First down can come from yardage, accepted result metadata, or typed penalty flag.',
  });

  if (preState.down >= rules.downs && !firstDown && !replayDown) {
    return applyPossessionChangeEndDrive(envelope, event, preState, endYardLine, 'turnoverOnDowns', options, trace, rules);
  }

  if (firstDown) {
    const lineToGain = calculateLineToGain(endYardLine, possession, rules.yardsToFirstDown);
    return finish({
      envelope,
      event,
      trace,
      liveState: createLiveState({
        possession,
        down: 1,
        yardLine: endYardLine,
        lineToGain,
        driveId: preState.driveId,
        driveNumber: preState.driveNumber,
      }),
      driveTransition: continueDrive(preState.driveId),
      yardsGained,
      firstDown: true,
      scoringUpdate: null,
    });
  }

  const nextDown = (preState.down || 1) + penaltyDownAdjustment(event);
  const lineToGain = preState.lineToGain || calculateLineToGain(preState.yardLine, possession, rules.yardsToFirstDown);
  return finish({
    envelope,
    event,
    trace,
    liveState: createLiveState({
      possession,
      down: nextDown,
      yardLine: endYardLine,
      lineToGain,
      driveId: preState.driveId,
      driveNumber: preState.driveNumber,
    }),
    driveTransition: continueDrive(preState.driveId),
    yardsGained,
    firstDown: false,
    scoringUpdate: null,
  });
}

function applyKickoff(envelope, event, preState, endYardLine, options, trace, rules) {
  const kickingTeam = kickoffKickingTeam(event, preState);
  const possessionTeam = normalizeTeamCode(
    event.result?.nextPossession
    || event.result?.turnover?.recoveredBy
    || event.result?.turnover?.team
    || event.postState?.possession,
  ) || oppositeTeam(kickingTeam);
  const kickoffReturnTurnover = Boolean(
    event.result?.fumble?.turnover
    || event.result?.turnover?.type === 'fumble',
  ) && possessionTeam === kickingTeam;
  const startReason = kickoffReturnTurnover ? 'fumbleRecovery' : 'kickoff';
  const drive = createStartedDrive(envelope, possessionTeam, endYardLine, startReason, options);
  const lineToGain = calculateLineToGain(endYardLine, possessionTeam, rules.yardsToFirstDown);

  addTrace(trace, 'drive', 'kickoff new-drive checks', {
    input: { kickingTeam, possessionTeam, endYardLine, kickoffReturnTurnover },
    result: `start ${drive.driveId}`,
    reason: kickoffReturnTurnover
      ? 'A fumble recovered by the kicking team starts its drive by fumble recovery.'
      : 'Kickoffs create the receiving team drive and do not assign a kickoff return as the previous drive result.',
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createLiveState({
      possession: possessionTeam,
      down: 1,
      yardLine: endYardLine,
      lineToGain,
      driveId: drive.driveId,
      driveNumber: drive.driveNumber,
    }),
    driveTransition: {
      shouldEndCurrent: false,
      shouldStartNew: true,
      endedDriveId: null,
      startedDrive: drive,
      driveResult: null,
      reason: startReason,
    },
    yardsGained: null,
    firstDown: true,
  });
}

function applyKickoffRekick(envelope, event, preState, endYardLine, trace) {
  const kickingTeam = kickoffKickingTeam(event, preState);
  addTrace(trace, 'drive', 'free-kick infraction rekick', {
    input: { kickingTeam, endYardLine, penalties: event.penalties },
    result: `awaiting rekick at ${endYardLine}`,
    reason: 'An accepted previous-spot Free Kick Infraction with repeat down does not start the receiving team drive.',
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createInactiveLiveState(preState, endYardLine, {
      kickoffTeam: kickingTeam,
      nextPlayContext: 'awaitingKickoff',
    }),
    driveTransition: {
      shouldEndCurrent: false,
      shouldStartNew: false,
      endedDriveId: null,
      startedDrive: null,
      driveResult: 'rekick',
      reason: 'freeKickInfraction',
    },
    yardsGained: null,
    firstDown: false,
    scoringUpdate: null,
  });
}

function kickoffKickingTeam(event, preState) {
  return normalizeTeamCode(
    event?.participants?.kicker?.team
    || event?.participants?.primary?.team
    || event?.possession
    || preState.possession,
  );
}

function applyPossessionChangeEndDrive(envelope, event, preState, endYardLine, driveResult, options, trace, rules) {
  const previousPossession = normalizeTeamCode(event.possession || preState.possession);
  const nextPossession =
    normalizeTeamCode(event.result?.nextPossession || event.result?.turnover?.recoveredBy || event.postState?.possession) ||
    oppositeTeam(previousPossession);
  const drive = createStartedDrive(envelope, nextPossession, endYardLine, driveResult, options);
  const lineToGain = calculateLineToGain(endYardLine, nextPossession, rules.yardsToFirstDown);

  addTrace(trace, 'drive', 'drive start/end decisions', {
    input: { previousDriveId: preState.driveId, previousPossession, nextPossession, driveResult },
    result: `end ${preState.driveId || 'none'}, start ${drive.driveId}`,
    reason: `${driveResult} ends the current drive and creates an explicit next possession state.`,
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createLiveState({
      possession: nextPossession,
      down: 1,
      yardLine: endYardLine,
      lineToGain,
      driveId: drive.driveId,
      driveNumber: drive.driveNumber,
    }),
    driveTransition: {
      shouldEndCurrent: true,
      shouldStartNew: true,
      endedDriveId: preState.driveId,
      startedDrive: drive,
      driveResult,
      reason: driveResult,
    },
    yardsGained: resultYards(event, preState, endYardLine, previousPossession),
    firstDown: false,
  });
}

function applyFieldGoal(envelope, event, preState, endYardLine, options, trace, rules) {
  const made = event.subtype === 'made' || event.result?.code === 'made';
  addTrace(trace, 'scoring', 'field-goal checks', {
    input: { subtype: event.subtype, code: event.result?.code, points: event.result?.points },
    result: made ? 'made field goal' : 'missed field goal',
    reason: 'Every field-goal attempt ends the offensive drive.',
  });

  if (made) {
    const scoringTeam = normalizeTeamCode(
      event.result?.scoring?.team
      || event?.participants?.primary?.team
      || event?.participants?.kicker?.team
      || event?.possession
      || preState.possession,
    );
    const kickoffSpot = ruleSpotForTeam(rules.kickoffSpot || 'H35', scoringTeam, 'own');
    return endDriveOnly(
      envelope,
      event,
      preState,
      endYardLine,
      'fieldGoal',
      trace,
      kickoffSpot,
      event.result?.scoring || null,
      {
        kickoffTeam: scoringTeam,
        nextPlayContext: 'awaitingKickoff',
      },
    );
  }

  return applyPossessionChangeEndDrive(envelope, event, preState, endYardLine, 'missedFieldGoal', options, trace, rules);
}

function endDriveOnly(envelope, event, preState, endYardLine, driveResult, trace, nextSpot = endYardLine, scoringUpdate = event.result?.scoring || null, setup = {}) {
  addTrace(trace, 'drive', 'drive start/end decisions', {
    input: { driveId: preState.driveId, driveResult },
    result: `end ${preState.driveId || 'none'}`,
    reason: `${driveResult} ends the drive and leaves no active scrimmage liveState until the next accepted event.`,
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createInactiveLiveState(preState, nextSpot, setup),
    driveTransition: {
      shouldEndCurrent: true,
      shouldStartNew: false,
      endedDriveId: preState.driveId,
      startedDrive: null,
      driveResult,
      reason: driveResult,
    },
    yardsGained: resultYards(event, preState, endYardLine, preState.possession),
    firstDown: false,
    scoringUpdate,
  });
}

function endPossessionFreeContext(envelope, event, preState, driveResult, trace, nextSpot = event.result?.endYardLine || preState.yardLine, setup = {}) {
  addTrace(trace, 'scoring', 'PAT/two-point context', {
    input: { type: event.type, subtype: event.subtype, result: event.result },
    result: driveResult,
    reason: 'Try context is not a normal down-and-distance drive state.',
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createInactiveLiveState(preState, nextSpot, setup),
    driveTransition: {
      shouldEndCurrent: false,
      shouldStartNew: false,
      endedDriveId: null,
      startedDrive: null,
      driveResult,
      reason: driveResult,
    },
    yardsGained: null,
    firstDown: false,
  });
}

function finish({ envelope, event, liveState, driveTransition, trace, yardsGained, firstDown, scoringUpdate = event.result?.scoring || null }) {
  addTrace(trace, 'down-distance', 'line-to-gain lookup', {
    input: { yardLine: liveState.yardLine, lineToGain: liveState.lineToGain, possession: liveState.possession },
    result: liveState.lineToGain ?? 'none',
    reason: liveState.possession ? 'Active states always carry explicit lineToGain.' : 'Inactive states have no active line to gain.',
  });

  return {
    schemaVersion: 'football.rulesResult.v1',
    gameId: envelope.gameId,
    eventId: event.eventId || null,
    clientEventId: event.clientEventId || null,
    liveState,
    driveTransition,
    yardsGained,
    firstDown,
    scoringUpdate,
    trace,
  };
}

function normalizePreState(envelope, event) {
  const source = event?.preState || envelope?.liveState || {};
  const possession = normalizeTeamCode(source.possession);
  const lineToGain =
    source.lineToGain ||
    (possession && source.yardLine ? calculateLineToGain(source.yardLine, possession, envelope?.game?.rules?.yardsToFirstDown) : null);

  return {
    possession,
    down: source.down ?? null,
    distance: source.distance ?? null,
    yardLine: source.yardLine ?? null,
    lineToGain,
    driveId: source.driveId ?? envelope?.liveState?.driveId ?? null,
    driveNumber: source.driveNumber ?? envelope?.liveState?.driveNumber ?? 0,
  };
}

function createInactiveLiveState(preState, yardLine, setup = {}) {
  return {
    possession: null,
    down: null,
    distance: null,
    yardLine: yardLine ?? null,
    lineToGain: null,
    goalToGo: false,
    redZone: false,
    driveId: null,
    driveNumber: preState.driveNumber ?? 0,
    pendingTryTeam: null,
    kickoffTeam: null,
    nextPlayContext: null,
    ...setup,
  };
}

function createStartedDrive(envelope, team, startYardLine, reason, options) {
  const driveNumber = nextDriveNumber(envelope);
  return {
    driveId: options.nextDriveId || `DRV-${String(driveNumber).padStart(4, '0')}`,
    driveNumber,
    team,
    startYardLine,
    startReason: reason,
    plays: 0,
    yards: 0,
    result: null,
  };
}

function nextDriveNumber(envelope) {
  const liveNumber = Number(envelope?.liveState?.driveNumber || 0);
  const currentNumber = Number(envelope?.drives?.current?.driveNumber || 0);
  const completedCount = Array.isArray(envelope?.drives?.completed) ? envelope.drives.completed.length : 0;
  return Math.max(liveNumber, currentNumber, completedCount) + 1;
}

function continueDrive(driveId) {
  return {
    shouldEndCurrent: false,
    shouldStartNew: false,
    endedDriveId: null,
    startedDrive: null,
    driveResult: null,
    reason: driveId ? 'driveContinues' : 'noActiveDrive',
  };
}

function resultYards(event, preState, endYardLine, possession) {
  if (event.penalties?.some((penalty) => penalty.status === 'accepted' && penalty.finalSpot)) {
    return calculateYardsGained(preState.yardLine, endYardLine, possession);
  }

  if (event.penalties?.some((penalty) => penalty.status === 'offsetting' && penalty.replayDown)) {
    return 0;
  }

  if (typeof event.result?.yards === 'number') {
    return event.result.yards;
  }

  return calculateYardsGained(preState.yardLine, endYardLine, possession);
}

function penaltyAdjustedEndYardLine(event, preState) {
  const acceptedFinalSpot = [...(event.penalties || [])]
    .reverse()
    .find((penalty) => penalty.status === 'accepted' && penalty.finalSpot)?.finalSpot;
  if (acceptedFinalSpot) return acceptedFinalSpot;

  if (event.penalties?.some((penalty) => penalty.status === 'offsetting' && penalty.replayDown)) {
    return preState.yardLine;
  }

  return null;
}

function acceptedSpotOfFoul(event) {
  return [...(event.penalties || [])]
    .reverse()
    .find((penalty) => (
      penalty.status === 'accepted'
      && penalty.spotOfFoul
      && (penalty.enforcedFrom === 'SPOT' || penalty.enforcedFrom === 'spotOfFoul')
    ))?.spotOfFoul || null;
}

function acceptedPreviousSpotPenalty(event) {
  return (event.penalties || []).some((penalty) => (
    penalty.status === 'accepted'
    && (penalty.enforcedFrom === 'PREVIOUS' || penalty.enforcedFrom === 'previousSpot')
  ));
}

function hasAutomaticFirstDown(event) {
  return Boolean(event.penalties?.some((penalty) => penalty.status === 'accepted' && penalty.automaticFirstDown));
}

function hasReplayDown(event) {
  return Boolean(event.penalties?.some((penalty) => penalty.status === 'accepted' && penalty.replayDown));
}

function penaltyDownAdjustment(event) {
  if (hasReplayDown(event)) {
    return 0;
  }

  return 1;
}

function isTouchdownEvent(event, endYardLine, possession, explicitScoringCounts = true) {
  if (explicitScoringCounts && event.result?.scoring?.type) {
    return event.result.scoring.type === 'touchdown';
  }
  if (event.result?.code === 'safety' || event.result?.code === 'touchback') return false;

  return spotToPossessionRelative(endYardLine, possession) >= 100;
}

function isSafetyEvent(event, endYardLine, possession, explicitScoringCounts = true) {
  if (explicitScoringCounts && event.result?.scoring?.type) return event.result.scoring.type === 'safety';
  if (explicitScoringCounts && event.result?.code === 'safety') return true;
  if (event.result?.code === 'touchdown' || event.result?.code === 'touchback') return false;
  return spotToPossessionRelative(endYardLine, possession) === 0;
}

function ruleSpotForTeam(spot, team, fieldSide) {
  const parsed = parseSpot(spot);
  const normalizedTeam = normalizeTeamCode(team);
  if (!parsed.valid || parsed.goal || parsed.side === '50' || !normalizedTeam) return parsed.valid ? parsed.raw : spot;
  const side = fieldSide === 'opponent' ? oppositeTeam(normalizedTeam) : normalizedTeam;
  return `${side}${String(parsed.yard).padStart(2, '0')}`;
}

function turnoverEndSpot(result, fallbackSpot) {
  if (result.code === 'touchback' && result.endYardLine) return result.endYardLine;
  return result.turnover?.returnEndYardLine || result.endYardLine || fallbackSpot;
}

function addTrace(trace, category, checkName, { input, result, reason }) {
  trace.push({
    category,
    checkName,
    input,
    result,
    reason,
  });
}
