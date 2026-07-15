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
  if (spot === 'goal') {
    return { raw: spot, valid: true, goal: true };
  }

  if (spot === '50') {
    return { raw: spot, valid: true, side: '50', yard: 50 };
  }

  if (typeof spot !== 'string') {
    return { raw: spot, valid: false, reason: 'spot must be a string' };
  }

  const match = spot.match(/^([HV])(\d{2})$/);
  if (!match) {
    return { raw: spot, valid: false, reason: 'spot must use H35, V20, or 50 format' };
  }

  const yard = Number(match[2]);
  if (yard < 0 || yard > 50) {
    return { raw: spot, valid: false, reason: 'yard must be between 00 and 50' };
  }

  return {
    raw: spot,
    valid: true,
    side: match[1],
    yard,
  };
}

export function spotToPossessionRelative(spot, possession) {
  const parsed = typeof spot === 'string' ? parseSpot(spot) : spot;
  const team = normalizeTeamCode(possession);

  if (!team || !parsed?.valid || parsed.goal) {
    return null;
  }

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
    nextPlayContext:
      normalizedPossession && down && activeDistance !== null && yardLine
        ? `${normalizedPossession},${down},${activeLineToGain === 'goal' ? 'goal' : activeDistance},${yardLine}`
        : null,
  };
}

export function applyFootballEventToEnvelope(envelope, event, options = {}) {
  const trace = [];
  const rules = {
    downs: envelope?.game?.rules?.downs || DEFAULT_DOWNS,
    yardsToFirstDown: envelope?.game?.rules?.yardsToFirstDown || DEFAULT_YARDS_TO_FIRST,
  };
  const preState = normalizePreState(envelope, event);
  const eventType = event?.type;
  const result = event?.result || {};
  const endYardLine = result.endYardLine || result.returnEndYardLine || event?.postState?.yardLine || preState.yardLine;
  const possession = normalizeTeamCode(event?.possession || preState.possession);

  addTrace(trace, 'state', 'pre-play state read', {
    input: preState,
    result: 'read',
    reason: 'Engine consumes canonical GameEnvelope.liveState plus ScoringEvent.preState.',
  });

  if (eventType === 'kickoff') {
    return applyKickoff(envelope, event, preState, endYardLine, options, trace, rules);
  }

  if (eventType === 'try') {
    return endPossessionFreeContext(envelope, event, preState, 'try', trace);
  }

  if (isTouchdownEvent(event, endYardLine, possession)) {
    return endDriveOnly(envelope, event, preState, endYardLine, 'touchdown', trace);
  }

  if (isSafetyEvent(event)) {
    return endDriveOnly(envelope, event, preState, endYardLine, 'safety', trace);
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

  return applyScrimmagePlay(envelope, event, preState, endYardLine, options, trace, rules);
}

function applyScrimmagePlay(envelope, event, preState, endYardLine, options, trace, rules) {
  const possession = normalizeTeamCode(event.possession || preState.possession);
  const yardsGained = resultYards(event, preState, endYardLine, possession);
  const yardsToGain = calculateYardsToGain(preState.yardLine, preState.lineToGain, possession);
  const firstDown =
    event.result?.firstDown === true ||
    hasAutomaticFirstDown(event) ||
    (typeof yardsGained === 'number' && typeof yardsToGain === 'number' && yardsGained >= yardsToGain);

  addTrace(trace, 'field', 'possession-relative yard math', {
    input: { start: preState.yardLine, end: endYardLine, possession },
    result: `${yardsGained ?? 'unknown'} yards`,
    reason: 'Gain/loss is calculated from offense-relative field positions.',
  });

  addTrace(trace, 'down-distance', 'first-down checks', {
    input: { yardsGained, yardsToGain, resultFirstDown: event.result?.firstDown, automaticFirstDown: hasAutomaticFirstDown(event) },
    result: firstDown ? 'first down' : 'no first down',
    reason: 'First down can come from yardage, accepted result metadata, or typed penalty flag.',
  });

  if (preState.down >= rules.downs && !firstDown) {
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
  });
}

function applyKickoff(envelope, event, preState, endYardLine, options, trace, rules) {
  const kickingTeam = normalizeTeamCode(event.possession || preState.possession);
  const receivingTeam = normalizeTeamCode(event.result?.nextPossession || event.postState?.possession) || oppositeTeam(kickingTeam);
  const drive = createStartedDrive(envelope, receivingTeam, endYardLine, 'kickoff', options);
  const lineToGain = calculateLineToGain(endYardLine, receivingTeam, rules.yardsToFirstDown);

  addTrace(trace, 'drive', 'kickoff new-drive checks', {
    input: { kickingTeam, receivingTeam, endYardLine },
    result: `start ${drive.driveId}`,
    reason: 'Kickoffs create the receiving team drive and do not assign a kickoff return as the previous drive result.',
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createLiveState({
      possession: receivingTeam,
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
      reason: 'kickoff',
    },
    yardsGained: null,
    firstDown: true,
  });
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
    return endDriveOnly(envelope, event, preState, endYardLine, 'fieldGoal', trace);
  }

  return applyPossessionChangeEndDrive(envelope, event, preState, endYardLine, 'missedFieldGoal', options, trace, rules);
}

function endDriveOnly(envelope, event, preState, endYardLine, driveResult, trace) {
  addTrace(trace, 'drive', 'drive start/end decisions', {
    input: { driveId: preState.driveId, driveResult },
    result: `end ${preState.driveId || 'none'}`,
    reason: `${driveResult} ends the drive and leaves no active scrimmage liveState until the next accepted event.`,
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createInactiveLiveState(preState, endYardLine),
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
  });
}

function endPossessionFreeContext(envelope, event, preState, driveResult, trace) {
  addTrace(trace, 'scoring', 'PAT/two-point context', {
    input: { type: event.type, subtype: event.subtype, result: event.result },
    result: driveResult,
    reason: 'Try context is not a normal down-and-distance drive state.',
  });

  return finish({
    envelope,
    event,
    trace,
    liveState: createInactiveLiveState(preState, event.result?.endYardLine || preState.yardLine),
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

function finish({ envelope, event, liveState, driveTransition, trace, yardsGained, firstDown }) {
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
    scoringUpdate: event.result?.scoring || null,
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

function createInactiveLiveState(preState, yardLine) {
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
    nextPlayContext: null,
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
  if (typeof event.result?.yards === 'number') {
    return event.result.yards;
  }

  return calculateYardsGained(preState.yardLine, endYardLine, possession);
}

function hasAutomaticFirstDown(event) {
  return Boolean(event.penalties?.some((penalty) => penalty.status === 'accepted' && penalty.automaticFirstDown));
}

function penaltyDownAdjustment(event) {
  if (event.penalties?.some((penalty) => penalty.status === 'accepted' && penalty.replayDown)) {
    return 0;
  }

  return 1;
}

function isTouchdownEvent(event, endYardLine, possession) {
  if (event.result?.scoring?.type === 'touchdown') {
    return true;
  }

  return spotToPossessionRelative(endYardLine, possession) >= 100;
}

function isSafetyEvent(event) {
  return event.result?.scoring?.type === 'safety' || event.result?.code === 'safety';
}

function turnoverEndSpot(result, fallbackSpot) {
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
