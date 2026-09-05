import { formatFootballClockDisplay } from '../utils/footballClock';

const TEAM_CODES = ['H', 'V'];

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clockSeconds = (clock) => {
  const match = String(clock || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const formatElapsed = (seconds) => {
  const total = Math.max(0, Math.round(finiteNumber(seconds)));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const playerForId = (envelope, playerId) => {
  if (!playerId) return null;
  for (const team of TEAM_CODES) {
    const player = envelope?.rosters?.teams?.[team]?.players?.[playerId];
    if (player) return player;
  }
  return null;
};

export const footballPlayerLastName = (displayName) => {
  let value = String(displayName || '').trim();
  if (!value) return 'Unknown';
  if (value.includes(',')) {
    const [beforeComma = '', afterComma = ''] = value.split(',').map((part) => part.trim());
    if (!/^(?:Jr\.?|Sr\.?|II|III|IV|V)$/i.test(afterComma)) return beforeComma || 'Unknown';
    value = beforeComma;
  }
  const parts = value.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && /^(?:Jr\.?|Sr\.?|II|III|IV|V)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts[parts.length - 1] || 'Unknown';
};

const participantPlayerId = (event, ...roles) => {
  for (const role of roles) {
    const participant = event?.participants?.[role];
    if (participant?.playerId) return participant.playerId;
  }
  return null;
};

const participantLastName = (envelope, event, roles, fallbackPlayerId = null) => {
  const playerId = participantPlayerId(event, ...roles) || fallbackPlayerId;
  return footballPlayerLastName(playerForId(envelope, playerId)?.displayName);
};

const participantFullName = (envelope, event, roles, fallbackPlayerId = null) => {
  const playerId = participantPlayerId(event, ...roles) || fallbackPlayerId;
  return String(playerForId(envelope, playerId)?.displayName || '').trim() || 'Unknown';
};

const scoringType = (event) => event?.result?.scoring?.type || null;

const isTouchdown = (event) => (
  scoringType(event) === 'touchdown'
  || event?.result?.code === 'touchdown'
);

export const isFootballTryReplayEvent = (event) => Boolean(
  event?.type === 'try'
  && event.penalties?.some((penalty) => (
    penalty.replayDown
    && (penalty.status === 'accepted' || penalty.status === 'offsetting')
  )),
);

export const isFootballDriveSummaryTerminalEvent = (event) => {
  if (!event || isTouchdown(event)) return false;
  if (event.type === 'try') return !isFootballTryReplayEvent(event);
  if (scoringType(event) === 'safety' || event.result?.code === 'safety') return true;
  return event.type === 'fieldGoal'
    && scoringType(event) === 'fieldGoal'
    && (event.subtype === 'made' || event.result?.code === 'made');
};

const sameEvent = (left, right) => Boolean(left && right && (
  (left.eventId && right.eventId && left.eventId === right.eventId)
  || (left.clientEventId && right.clientEventId && left.clientEventId === right.clientEventId)
));

const eventsThrough = (events, terminalEvent) => {
  const index = events.findIndex((event) => sameEvent(event, terminalEvent));
  return index >= 0 ? events.slice(0, index + 1) : events;
};

const scoringEventForTerminal = (events, terminalEvent) => {
  if (terminalEvent?.type !== 'try') return terminalEvent;
  const throughTerminal = eventsThrough(events, terminalEvent);
  for (let index = throughTerminal.length - 2; index >= 0; index -= 1) {
    if (isTouchdown(throughTerminal[index])) return throughTerminal[index];
  }
  return null;
};

const completedDriveForScore = (envelope, scoringEvent) => {
  if (
    ['kickoff', 'punt'].includes(scoringEvent?.type)
    && scoringType(scoringEvent) === 'touchdown'
    && (scoringEvent?.participants?.returner || scoringEvent?.result?.return?.returnerPlayerId)
  ) return null;
  const completed = envelope?.drives?.completed || [];
  const driveId = scoringEvent?.preState?.driveId;
  if (driveId) {
    const exact = completed.find((drive) => drive.driveId === driveId);
    if (exact) return exact;
  }
  const expectedResult = scoringType(scoringEvent) === 'fieldGoal'
    ? 'fieldGoal'
    : scoringType(scoringEvent) === 'safety' || scoringEvent?.result?.code === 'safety'
      ? 'safety'
      : 'touchdown';
  const scoringTeam = scoringEvent?.possession || scoringEvent?.result?.scoring?.team;
  return [...completed].reverse().find((drive) => (
    drive.result === expectedResult && (!scoringTeam || drive.team === scoringTeam)
  )) || null;
};

const driveElapsedSeconds = (envelope, drive, scoringEvent) => {
  const start = clockSeconds(drive?.startClock);
  const end = clockSeconds(drive?.endClock || scoringEvent?.clock);
  if (start === null || end === null) return 0;
  const startPeriod = Math.max(1, finiteNumber(drive?.startPeriod, scoringEvent?.period || 1));
  const endPeriod = Math.max(startPeriod, finiteNumber(drive?.endPeriod, scoringEvent?.period || startPeriod));
  const periodSeconds = Math.max(
    60,
    finiteNumber(envelope?.game?.rules?.minutesPerPeriod || envelope?.game?.rules?.minutes, 15) * 60,
  );
  if (startPeriod === endPeriod) return Math.max(0, start - end);
  return Math.max(0, start)
    + (Math.max(0, endPeriod - startPeriod - 1) * periodSeconds)
    + Math.max(0, periodSeconds - end);
};

export const footballDriveTimeOfPossession = (envelope, drive, terminalEvent = null) => (
  formatElapsed(driveElapsedSeconds(envelope, drive, terminalEvent))
);

const humanizeDriveReason = (reason) => {
  const normalized = String(reason || 'possession')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (/^turnover on downs$/i.test(normalized)) return 'Downs';
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Possession';
};

const inferredDriveReason = (events, drive, scoringEvent) => {
  const scoringIndex = events.findIndex((event) => sameEvent(event, scoringEvent));
  let firstDriveIndex = scoringIndex;
  if (drive?.driveId) {
    const located = events.findIndex((event) => event?.preState?.driveId === drive.driveId);
    if (located >= 0) firstDriveIndex = located;
  }
  const acquisition = firstDriveIndex > 0 ? events[firstDriveIndex - 1] : null;
  const kickoffReturnFumble = acquisition?.type === 'kickoff' && (
    acquisition.result?.turnover?.type === 'fumble'
    || acquisition.result?.fumble?.turnover
  );
  if (kickoffReturnFumble) return 'fumbleRecovery';
  if (drive?.startReason) return drive.startReason;
  if (!acquisition) return 'possession';
  if (acquisition.type === 'punt') return 'punt';
  if (acquisition.type === 'kickoff') return 'kickoff';
  if (acquisition.type === 'fieldGoal') return 'missedFieldGoal';
  if (acquisition.result?.turnover?.type === 'interception' || acquisition.result?.code === 'interception') return 'interception';
  if (acquisition.result?.turnover?.type === 'fumble' || acquisition.result?.fumble?.turnover) return 'fumbleRecovery';
  if (acquisition.preState?.down === 4) return 'turnoverOnDowns';
  return acquisition.result?.driveResult || acquisition.type || 'possession';
};

const scoringPlayText = (envelope, scoringEvent) => {
  const yards = finiteNumber(
    scoringEvent?.result?.pass?.passingYards ?? scoringEvent?.result?.yards,
    0,
  );
  if (scoringType(scoringEvent) === 'safety' || scoringEvent?.result?.code === 'safety') {
    const player = participantLastName(envelope, scoringEvent, ['primary']);
    if (scoringEvent?.type === 'rush') return `${player} rush for safety`;
    if (scoringEvent?.type === 'pass') return `${player} pass play results in safety`;
    return 'Safety';
  }
  if (scoringEvent?.type === 'rush') {
    return `${participantFullName(envelope, scoringEvent, ['primary'])} ${yards} yard rush`;
  }
  if (scoringEvent?.type === 'pass') {
    const passer = participantFullName(envelope, scoringEvent, ['primary']);
    const receiverId = scoringEvent?.result?.pass?.targetPlayerId;
    const receiver = participantFullName(envelope, scoringEvent, ['receiver', 'secondary', 'target'], receiverId);
    return `${passer} ${yards} yd. pass to ${receiver}`;
  }
  if (scoringEvent?.type === 'fieldGoal') {
    const kicker = participantFullName(envelope, scoringEvent, ['kicker', 'primary']);
    const attemptYards = finiteNumber(scoringEvent?.result?.kick?.attemptYards, 0);
    return `${kicker} ${attemptYards} yd. field goal`;
  }
  return scoringEvent?.description || 'Scoring play';
};

const tryTypeLabel = (event) => {
  if (event?.subtype === 'rush') return 'Rush';
  if (event?.subtype === 'pass') return 'Pass';
  return 'Kick';
};

const trySummaryText = (envelope, event) => {
  const type = tryTypeLabel(event);
  if (scoringType(event) === 'defensiveConversion') {
    const returnerId = participantPlayerId(event, 'returner') || event?.result?.return?.returnerPlayerId;
    const returner = footballPlayerLastName(playerForId(envelope, returnerId)?.displayName);
    const failure = event?.result?.fumble
      ? `${type} fumbled`
      : event?.result?.code === 'interception'
        ? 'Pass intercepted'
        : event?.result?.code === 'blocked'
          ? 'Kick blocked'
          : `${type} failed`;
    return `${failure} - ${returner} Def. Conversion`;
  }
  if (!event?.result?.scoring) return `${type} Failed`;
  if (event.subtype === 'pass') {
    const passer = participantLastName(envelope, event, ['primary']);
    const receiverId = event?.result?.pass?.targetPlayerId;
    const receiver = participantLastName(envelope, event, ['secondary', 'receiver', 'target'], receiverId);
    return `${passer} Pass to ${receiver}`;
  }
  const player = participantLastName(envelope, event, event.subtype === 'kick' ? ['kicker', 'primary'] : ['primary']);
  return `${player} ${type}`;
};

export const buildFootballScoringPlaySummary = (envelope, terminalEvent) => {
  if (!envelope || !isFootballDriveSummaryTerminalEvent(terminalEvent)) return null;
  const scoringEvent = scoringEventForTerminal(envelope.events || [], terminalEvent);
  if (!scoringEvent) return null;
  const scoringPlay = scoringPlayText(envelope, scoringEvent);
  return {
    scoringEvent,
    terminalEvent,
    scoringPlay: terminalEvent.type === 'try'
      ? `${scoringPlay} (${trySummaryText(envelope, terminalEvent)})`
      : scoringPlay,
  };
};

export function buildFootballDriveSummary(envelope, terminalEvent) {
  if (!envelope || !isFootballDriveSummaryTerminalEvent(terminalEvent)) return null;
  const events = envelope.events || [];
  const scoringPlaySummary = buildFootballScoringPlaySummary(envelope, terminalEvent);
  const scoringEvent = scoringPlaySummary?.scoringEvent;
  const drive = completedDriveForScore(envelope, scoringEvent);
  if (!scoringEvent || !drive) return null;

  const reason = humanizeDriveReason(inferredDriveReason(events, drive, scoringEvent));
  const teamCode = scoringType(scoringEvent) === 'safety'
    ? scoringEvent.result?.scoring?.team
    : drive.team || scoringEvent.possession || scoringEvent.result?.scoring?.team;

  return {
    driveId: drive.driveId,
    team: teamCode,
    teamName: envelope.game?.teams?.[teamCode]?.name || envelope.game?.teams?.[teamCode]?.abbr || teamCode || 'Scoring Team',
    plays: finiteNumber(drive.plays),
    yards: finiteNumber(drive.yards),
    timeOfPossession: footballDriveTimeOfPossession(envelope, drive, scoringEvent),
    scoringPlay: scoringPlaySummary.scoringPlay,
    startInfo: `Start: ${formatFootballClockDisplay(drive.startClock, '--:--')} at ${drive.startYardLine || 'Unknown Spot'} by ${reason}`,
  };
}
