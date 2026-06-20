const FIXTURE_SESSION_ID = 'fixture-preview-session';

const spotPattern = /^([HV])(\d{2})$|^50$/;

export function createDebugTraceCollector({ gameId, timestamp = new Date().toISOString() }) {
  const entries = [];

  return {
    add(entry) {
      const normalized = {
        id: `${entries.length + 1}-${entry.category}-${entry.checkName}`.replace(/\s+/g, '-'),
        timestamp,
        gameId,
        eventId: entry.eventId || null,
        clientEventId: entry.clientEventId || FIXTURE_SESSION_ID,
        category: entry.category,
        checkName: entry.checkName,
        inputSummary: entry.inputSummary,
        calculationDetails: entry.calculationDetails,
        result: entry.result,
        reason: entry.reason,
        severity: entry.severity || 'info',
        rawData: entry.rawData || null,
      };

      entries.push(normalized);
      return normalized;
    },
    entries,
  };
}

export function buildFootballFixtureDebugTrace(envelope, options = {}) {
  if (!envelope) {
    return [];
  }

  const collector = createDebugTraceCollector({
    gameId: envelope.gameId,
    timestamp: options.timestamp || '2026-06-20T00:00:00.000Z',
  });

  traceEnvelopeRead(collector, envelope);
  tracePossession(collector, envelope);
  traceYardLineAndDistance(collector, envelope);
  traceScoringAndDriveChecks(collector, envelope);
  tracePenaltyChecks(collector, envelope);
  traceSubmitEnvelopeChecks(collector, envelope);

  envelope.events.forEach((event) => {
    traceAcceptedEvent(collector, envelope, event);
  });

  return collector.entries;
}

export function groupTraceEntriesByEvent(entries) {
  return entries.reduce((groups, entry) => {
    const key = entry.clientEventId || entry.eventId || 'session';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
    return groups;
  }, {});
}

export function serializeTraceEntries(entries) {
  return JSON.stringify(entries, null, 2);
}

function traceEnvelopeRead(collector, envelope) {
  const liveState = envelope.liveState;

  collector.add({
    category: 'state',
    checkName: 'pre-play state read',
    inputSummary: `${envelope.gameId} ${envelope.game.status} Q${envelope.clock.period} ${envelope.clock.clock}`,
    calculationDetails: `Read possession=${liveState.possession || 'none'}, down=${liveState.down || 'none'}, distance=${liveState.distance || 'none'}, yardLine=${liveState.yardLine || 'none'}, lineToGain=${liveState.lineToGain || 'none'}.`,
    result: 'Fixture envelope loaded as the accepted state for this preview.',
    reason: 'STR-58 shell renders only from fixture GameEnvelope data until backend load/submit exists.',
    severity: 'pass',
    rawData: {
      gameId: envelope.gameId,
      clock: envelope.clock,
      liveState,
      sourceEventSequence: envelope.stats.sourceEventSequence,
    },
  });
}

function tracePossession(collector, envelope) {
  const possession = envelope.liveState.possession;
  const normalized = possession === 'H' || possession === 'V' ? possession : null;

  collector.add({
    category: 'state',
    checkName: 'possession normalization',
    inputSummary: `Raw possession=${possession || 'none'}.`,
    calculationDetails: normalized
      ? `Possession already uses canonical ${normalized} team code.`
      : 'No offensive possession is active for this fixture state.',
    result: normalized || 'none',
    reason: normalized
      ? 'Canonical contract permits only H or V for active possession.'
      : 'Pregame, halftime, and final fixtures can have no active possession.',
    severity: normalized ? 'pass' : 'info',
    rawData: {
      possession,
      teams: envelope.game.teams,
    },
  });
}

function traceYardLineAndDistance(collector, envelope) {
  const { liveState } = envelope;
  const yardLine = parseSpot(liveState.yardLine);
  const lineToGain = parseSpot(liveState.lineToGain);
  const possession = liveState.possession;
  const ballYardsFromOwnGoal = yardLine && possession ? spotToPossessionYards(yardLine, possession) : null;
  const lineToGainYards = lineToGain && possession ? spotToPossessionYards(lineToGain, possession) : null;
  const yardsToGain =
    typeof ballYardsFromOwnGoal === 'number' && typeof lineToGainYards === 'number'
      ? Math.max(lineToGainYards - ballYardsFromOwnGoal, 0)
      : liveState.distance ?? null;

  collector.add({
    category: 'field',
    checkName: 'yard-line parsing',
    inputSummary: `yardLine=${liveState.yardLine || 'none'}, lineToGain=${liveState.lineToGain || 'none'}.`,
    calculationDetails: `Ball spot parse=${describeSpot(yardLine)}; line-to-gain parse=${describeSpot(lineToGain)}.`,
    result: yardLine ? 'parsed' : 'no active spot',
    reason: yardLine
      ? 'Yard-line values match the canonical H35, V20, or 50 format.'
      : 'No active spot exists in this game state.',
    severity: yardLine ? 'pass' : 'info',
    rawData: {
      yardLine,
      lineToGain,
    },
  });

  collector.add({
    category: 'field',
    checkName: 'possession-relative yard math',
    inputSummary: `Possession=${possession || 'none'}, spot=${liveState.yardLine || 'none'}.`,
    calculationDetails:
      typeof ballYardsFromOwnGoal === 'number'
        ? `Converted ${liveState.yardLine} to ${ballYardsFromOwnGoal} yards from ${possession}'s goal line.`
        : 'Skipped conversion because possession or spot is not active.',
    result: typeof ballYardsFromOwnGoal === 'number' ? `${ballYardsFromOwnGoal} yards` : 'not applicable',
    reason: 'All gain/loss decisions should use possession-relative math instead of string comparison.',
    severity: typeof ballYardsFromOwnGoal === 'number' ? 'pass' : 'info',
    rawData: {
      possession,
      ballYardsFromOwnGoal,
    },
  });

  collector.add({
    category: 'field',
    checkName: 'line-to-gain lookup',
    inputSummary: `lineToGain=${liveState.lineToGain || 'none'}.`,
    calculationDetails:
      liveState.lineToGain === 'goal'
        ? 'Goal-to-go uses the goal line as the target instead of a spot string.'
        : lineToGain
          ? `Parsed target spot and converted it to ${lineToGainYards} possession-relative yards.`
          : 'No line to gain exists for this state.',
    result: liveState.lineToGain || 'none',
    reason: liveState.lineToGain
      ? 'Line to gain is read from the accepted envelope, not recalculated in the component.'
      : 'Pregame, halftime, final, kickoff, and try contexts can omit line to gain.',
    severity: liveState.lineToGain ? 'pass' : 'info',
    rawData: {
      lineToGain: liveState.lineToGain,
      lineToGainYards,
    },
  });

  collector.add({
    category: 'down-distance',
    checkName: 'yards-to-gain',
    inputSummary: `down=${liveState.down || 'none'}, distance=${liveState.distance || 'none'}.`,
    calculationDetails:
      typeof yardsToGain === 'number'
        ? `Current accepted distance is ${liveState.distance}; spot math implies ${yardsToGain}.`
        : 'No yards-to-gain calculation applies.',
    result: typeof yardsToGain === 'number' ? `${yardsToGain} yards` : 'not applicable',
    reason: 'The accepted envelope distance remains the display value until the rules engine is implemented.',
    severity: 'info',
    rawData: {
      acceptedDistance: liveState.distance,
      computedYardsToGain: yardsToGain,
    },
  });

  const firstDown = Boolean(
    liveState.down &&
      liveState.distance &&
      typeof yardsToGain === 'number' &&
      yardsToGain <= 0,
  );

  collector.add({
    category: 'down-distance',
    checkName: 'first-down checks',
    inputSummary: `distance=${liveState.distance || 'none'}, computed yardsToGain=${yardsToGain ?? 'none'}.`,
    calculationDetails: firstDown
      ? 'Computed yards-to-gain is zero, so a new series would be awarded.'
      : 'Computed yards-to-gain remains positive or the state has no active down.',
    result: firstDown ? 'first down' : 'no first down',
    reason: 'Fixture preview does not mutate the envelope; this explains the check only.',
    severity: firstDown ? 'pass' : 'info',
    rawData: {
      firstDown,
      liveState,
    },
  });

  collector.add({
    category: 'down-distance',
    checkName: 'post-down/post-distance/post-yard-line calculations',
    inputSummary: `Accepted post state is ${liveState.nextPlayContext || envelope.gameId}.`,
    calculationDetails: 'No scoring draft was submitted, so post-play values remain equal to the accepted liveState.',
    result: `${liveState.down || 'none'}, ${liveState.distance || 'none'}, ${liveState.yardLine || 'none'}`,
    reason: 'STR-65 trace panel supports fixture previews before STR-60/STR-61 rule engines submit drafts.',
    severity: 'info',
    rawData: {
      liveState,
    },
  });

  collector.add({
    category: 'down-distance',
    checkName: 'new line-to-gain calculations',
    inputSummary: `Existing lineToGain=${liveState.lineToGain || 'none'}.`,
    calculationDetails: 'No new first-down series was accepted in this fixture render.',
    result: liveState.lineToGain || 'none',
    reason: 'New line-to-gain calculation will run when an accepted postState changes the series.',
    severity: 'info',
    rawData: {
      lineToGain: liveState.lineToGain,
    },
  });
}

function traceScoringAndDriveChecks(collector, envelope) {
  const { liveState } = envelope;
  const events = envelope.events || [];
  const lastEvent = events[events.length - 1] || null;
  const lastResult = lastEvent?.result || {};
  const touchdownEvent = events.find((event) => event.result?.scoring?.type === 'touchdown') || null;
  const fieldGoalEvent = events.find((event) => event.type === 'fieldGoal') || null;
  const puntEvent = events.find((event) => event.type === 'punt') || null;
  const kickoffEvent = events.find((event) => event.type === 'kickoff') || null;
  const turnoverEvent = events.find((event) => event.result?.turnover) || null;

  collector.add({
    category: 'scoring',
    checkName: 'yards gained',
    inputSummary: lastEvent ? `Last event ${lastEvent.type} sequence ${lastEvent.sequence}.` : 'No accepted events.',
    calculationDetails:
      typeof lastResult.yards === 'number'
        ? `Accepted event result includes ${lastResult.yards} yards.`
        : 'No accepted event yardage is available for this fixture state.',
    result: typeof lastResult.yards === 'number' ? `${lastResult.yards} yards` : 'not available',
    reason: 'Yards gained must come from an accepted event result or a future draft preview.',
    severity: typeof lastResult.yards === 'number' ? 'pass' : 'info',
    rawData: {
      lastEvent,
    },
  });

  collector.add({
    category: 'scoring',
    checkName: 'touchdown checks',
    inputSummary: `Checked ${events.length} accepted events for touchdown scoring.`,
    calculationDetails: touchdownEvent
      ? `Event ${touchdownEvent.eventId} has scoring.type=touchdown.`
      : 'No accepted event currently marks a touchdown.',
    result: touchdownEvent ? 'touchdown found' : 'no touchdown',
    reason: 'Touchdown updates must be based on accepted scoring metadata.',
    severity: touchdownEvent ? 'pass' : 'info',
    rawData: {
      touchdownEvent,
    },
  });

  collector.add({
    category: 'scoring',
    checkName: 'safety checks',
    inputSummary: `Checked ${events.length} accepted events for safety scoring.`,
    calculationDetails: 'No fixture event includes safety scoring metadata.',
    result: 'no safety',
    reason: 'Safety detection will use accepted event scoring metadata and post-yard-line rules when implemented.',
    severity: 'info',
    rawData: {
      events: events.map((event) => ({ eventId: event.eventId, type: event.type, result: event.result })),
    },
  });

  collector.add({
    category: 'drive',
    checkName: 'turnover checks',
    inputSummary: `Checked ${events.length} accepted events for turnover metadata.`,
    calculationDetails: turnoverEvent
      ? `Event ${turnoverEvent.eventId} includes turnover type ${turnoverEvent.result.turnover.type}.`
      : 'No accepted event currently includes turnover metadata.',
    result: turnoverEvent ? 'turnover found' : 'no turnover',
    reason: 'Turnovers must be explicit in accepted event results before possession changes.',
    severity: turnoverEvent ? 'warning' : 'info',
    rawData: {
      turnoverEvent,
    },
  });

  collector.add({
    category: 'drive',
    checkName: 'turnover-on-downs checks',
    inputSummary: `down=${liveState.down || 'none'}, distance=${liveState.distance || 'none'}.`,
    calculationDetails:
      liveState.down === 4
        ? 'Fourth down is active, so a failed gain would trigger turnover-on-downs evaluation.'
        : 'Fourth down is not active in this accepted fixture state.',
    result: liveState.down === 4 ? 'watch fourth down result' : 'not active',
    reason: 'Turnover-on-downs requires a fourth-down result and post-play distance calculation.',
    severity: liveState.down === 4 ? 'warning' : 'info',
    rawData: {
      liveState,
    },
  });

  collector.add({
    category: 'drive',
    checkName: 'punt drive-end checks',
    inputSummary: puntEvent ? `Punt event ${puntEvent.eventId} found.` : 'No accepted punt event.',
    calculationDetails: puntEvent
      ? `driveEnds=${Boolean(puntEvent.result?.driveEnds)} and nextPossession=${puntEvent.result?.nextPossession || 'none'}.`
      : 'No punt drive-end decision applies.',
    result: puntEvent?.result?.driveEnds ? 'drive ended by punt' : 'not applicable',
    reason: 'Punt drive-end logic must come from accepted event result flags.',
    severity: puntEvent?.result?.driveEnds ? 'pass' : 'info',
    rawData: {
      puntEvent,
    },
  });

  collector.add({
    category: 'drive',
    checkName: 'kickoff new-drive checks',
    inputSummary: kickoffEvent ? `Kickoff event ${kickoffEvent.eventId} found.` : 'No accepted kickoff event.',
    calculationDetails: kickoffEvent
      ? `Current drive ${envelope.drives.current?.driveId || 'none'} starts at ${envelope.drives.current?.startYardLine || 'none'} after kickoff.`
      : 'No kickoff-started drive applies.',
    result: kickoffEvent ? 'new drive checked' : 'not applicable',
    reason: 'Kickoff should create the receiving team drive only after accepted envelope state confirms it.',
    severity: kickoffEvent ? 'pass' : 'info',
    rawData: {
      kickoffEvent,
      currentDrive: envelope.drives.current,
    },
  });

  collector.add({
    category: 'scoring',
    checkName: 'field-goal checks',
    inputSummary: fieldGoalEvent ? `Field goal event ${fieldGoalEvent.eventId} found.` : 'No accepted field goal event.',
    calculationDetails: fieldGoalEvent
      ? `Result code=${fieldGoalEvent.result?.code}; points=${fieldGoalEvent.result?.points || 0}.`
      : 'No field-goal scoring update applies.',
    result: fieldGoalEvent?.result?.code || 'not applicable',
    reason: 'Field-goal scoring uses accepted result metadata.',
    severity: fieldGoalEvent ? 'pass' : 'info',
    rawData: {
      fieldGoalEvent,
    },
  });

  collector.add({
    category: 'field',
    checkName: 'red-zone checks',
    inputSummary: `redZone=${Boolean(liveState.redZone)}; yardLine=${liveState.yardLine || 'none'}.`,
    calculationDetails: liveState.redZone
      ? 'Accepted liveState marks this possession as inside the opponent red zone.'
      : 'Accepted liveState does not mark red zone.',
    result: liveState.redZone ? 'red zone' : 'not red zone',
    reason: 'The fixture shell displays the accepted envelope flag without recomputing authoritative state.',
    severity: liveState.redZone ? 'pass' : 'info',
    rawData: {
      redZone: liveState.redZone,
      yardLine: liveState.yardLine,
    },
  });

  collector.add({
    category: 'field',
    checkName: 'goal-to-go checks',
    inputSummary: `goalToGo=${Boolean(liveState.goalToGo)}; lineToGain=${liveState.lineToGain || 'none'}.`,
    calculationDetails: liveState.goalToGo
      ? 'Accepted liveState marks goal-to-go and uses the goal line as the target.'
      : 'Accepted liveState does not mark goal-to-go.',
    result: liveState.goalToGo ? 'goal to go' : 'not goal to go',
    reason: 'Goal-to-go drives must be explicit in accepted envelope state.',
    severity: liveState.goalToGo ? 'pass' : 'info',
    rawData: {
      goalToGo: liveState.goalToGo,
      lineToGain: liveState.lineToGain,
    },
  });

  collector.add({
    category: 'drive',
    checkName: 'drive start/end decisions',
    inputSummary: `currentDrive=${envelope.drives.current?.driveId || 'none'}, completed=${envelope.drives.completed.length}.`,
    calculationDetails: envelope.drives.current
      ? `Drive ${envelope.drives.current.driveId} remains active for ${envelope.drives.current.team}.`
      : 'No current drive is active in this accepted state.',
    result: envelope.drives.current ? 'drive active' : 'no active drive',
    reason: 'Drive lifecycle displays accepted envelope drive projections.',
    severity: envelope.drives.current ? 'pass' : 'info',
    rawData: {
      drives: envelope.drives,
    },
  });

  collector.add({
    category: 'scoring',
    checkName: 'scoring updates',
    inputSummary: `Score H=${envelope.game.teams.H.score}, V=${envelope.game.teams.V.score}.`,
    calculationDetails: `Scoreboard reads accepted envelope teams.H.score=${envelope.game.teams.H.score} and teams.V.score=${envelope.game.teams.V.score}.`,
    result: `${envelope.game.teams.V.abbr} ${envelope.game.teams.V.score}, ${envelope.game.teams.H.abbr} ${envelope.game.teams.H.score}`,
    reason: 'Scoring display must be projected from the accepted envelope.',
    severity: 'pass',
    rawData: {
      teams: envelope.game.teams,
    },
  });
}

function tracePenaltyChecks(collector, envelope) {
  const penaltyEvents = envelope.events.filter((event) => event.type === 'penalty' || event.penalties?.length);
  const acceptedPenalty = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.status === 'accepted'),
  );
  const declinedPenalty = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.status === 'declined'),
  );
  const offsettingPenalty = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.status === 'offsetting'),
  );
  const automaticFirstDown = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.automaticFirstDown),
  );
  const lossOfDown = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.lossOfDown),
  );
  const replayDown = penaltyEvents.find((event) =>
    event.penalties?.some((penalty) => penalty.replayDown),
  );

  collector.add({
    category: 'penalty',
    checkName: 'penalty accepted/declined/offsetting checks',
    inputSummary: `Checked ${penaltyEvents.length} penalty-bearing accepted events.`,
    calculationDetails: `accepted=${Boolean(acceptedPenalty)}, declined=${Boolean(declinedPenalty)}, offsetting=${Boolean(offsettingPenalty)}.`,
    result: penaltyEvents.length ? 'penalty event found' : 'no penalty event',
    reason: penaltyEvents.length
      ? 'Penalty status must come from typed penalties on the accepted event.'
      : 'Penalty workflow is not implemented in the fixture shell yet.',
    severity: penaltyEvents.length ? 'pass' : 'info',
    rawData: {
      penaltyEvents,
    },
  });

  collector.add({
    category: 'penalty',
    checkName: 'automatic first down',
    inputSummary: `automaticFirstDown=${Boolean(automaticFirstDown)}.`,
    calculationDetails: automaticFirstDown
      ? `Penalty event ${automaticFirstDown.eventId} grants an automatic first down.`
      : 'No accepted penalty grants automatic first down.',
    result: automaticFirstDown ? 'automatic first down' : 'not applied',
    reason: 'Automatic first down is a typed penalty flag, not a UI assumption.',
    severity: automaticFirstDown ? 'pass' : 'info',
    rawData: {
      automaticFirstDown,
    },
  });

  collector.add({
    category: 'penalty',
    checkName: 'loss of down',
    inputSummary: `lossOfDown=${Boolean(lossOfDown)}.`,
    calculationDetails: lossOfDown
      ? `Penalty event ${lossOfDown.eventId} applies loss of down.`
      : 'No accepted penalty applies loss of down.',
    result: lossOfDown ? 'loss of down' : 'not applied',
    reason: 'Loss of down is a typed penalty flag, not inferred from text.',
    severity: lossOfDown ? 'warning' : 'info',
    rawData: {
      lossOfDown,
    },
  });

  collector.add({
    category: 'penalty',
    checkName: 'replay down',
    inputSummary: `replayDown=${Boolean(replayDown)}.`,
    calculationDetails: replayDown
      ? `Penalty event ${replayDown.eventId} replays the down.`
      : 'No accepted penalty replays the down.',
    result: replayDown ? 'replay down' : 'not applied',
    reason: 'Replay down is a typed penalty flag emitted by the penalty workflow.',
    severity: replayDown ? 'pass' : 'info',
    rawData: {
      replayDown,
    },
  });
}

function traceSubmitEnvelopeChecks(collector, envelope) {
  collector.add({
    category: 'submit',
    checkName: 'backend submit request creation',
    inputSummary: 'No submit request was created for fixture preview.',
    calculationDetails: `A future SubmitEventRequest would use gameId=${envelope.gameId}, baseEventSequence=${envelope.stats.sourceEventSequence}, and a clientEventId.`,
    result: 'not submitted',
    reason: 'STR-58/STR-65 shell intentionally does not implement scoring submit behavior.',
    severity: 'info',
    rawData: {
      gameId: envelope.gameId,
      baseEventSequence: envelope.stats.sourceEventSequence,
    },
  });

  collector.add({
    category: 'submit',
    checkName: 'backend accepted envelope response',
    inputSummary: 'No backend response exists in fixture mode.',
    calculationDetails: 'The fixture GameEnvelope is already treated as accepted state for rendering.',
    result: 'fixture envelope accepted',
    reason: 'Backend accepted envelope response tracing will attach here when STR-59 submit skeleton exists.',
    severity: 'info',
    rawData: {
      schemaVersion: envelope.schemaVersion,
      updatedAt: envelope.updatedAt,
    },
  });

  collector.add({
    category: 'submit',
    checkName: 'duplicate clientEventId handling',
    inputSummary: 'No clientEventId was submitted.',
    calculationDetails: 'No duplicate lookup is needed because fixture preview does not submit events.',
    result: 'not checked',
    reason: 'Duplicate handling belongs to the backend submit path and will emit trace entries when submit exists.',
    severity: 'info',
    rawData: {
      eventClientIds: envelope.events.map((event) => event.clientEventId),
    },
  });

  collector.add({
    category: 'submit',
    checkName: 'stale sequence/conflict handling',
    inputSummary: `Current sourceEventSequence=${envelope.stats.sourceEventSequence}.`,
    calculationDetails: 'No base sequence was submitted, so no stale sequence conflict can be detected.',
    result: 'not checked',
    reason: 'Conflict tracing will compare submitted baseEventSequence against the accepted envelope sequence.',
    severity: 'info',
    rawData: {
      sourceEventSequence: envelope.stats.sourceEventSequence,
    },
  });
}

function traceAcceptedEvent(collector, envelope, event) {
  collector.add({
    category: 'event',
    checkName: 'accepted event read',
    eventId: event.eventId,
    clientEventId: event.clientEventId,
    inputSummary: `${event.type}${event.subtype ? `/${event.subtype}` : ''} sequence ${event.sequence}.`,
    calculationDetails: event.description || `Accepted ${event.type} event has no description.`,
    result: event.result?.code || event.result?.turnover?.type || 'accepted',
    reason: 'Game log and downstream reports must use accepted envelope events.',
    severity: 'pass',
    rawData: {
      event,
      sourceEventSequence: envelope.stats.sourceEventSequence,
    },
  });
}

function parseSpot(value) {
  if (!value || value === 'goal') {
    return null;
  }

  if (!spotPattern.test(value)) {
    return { raw: value, valid: false };
  }

  if (value === '50') {
    return { raw: value, valid: true, side: 'midfield', yard: 50 };
  }

  return {
    raw: value,
    valid: true,
    side: value.slice(0, 1),
    yard: Number(value.slice(1)),
  };
}

function describeSpot(spot) {
  if (!spot) {
    return 'none';
  }

  if (!spot.valid) {
    return `${spot.raw} invalid`;
  }

  if (spot.side === 'midfield') {
    return '50 midfield';
  }

  return `${spot.side}${String(spot.yard).padStart(2, '0')}`;
}

function spotToPossessionYards(spot, possession) {
  if (!spot?.valid) {
    return null;
  }

  if (spot.side === 'midfield') {
    return 50;
  }

  if (spot.side === possession) {
    return spot.yard;
  }

  return 100 - spot.yard;
}
