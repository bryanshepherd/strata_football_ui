import { formatFootballReportDate } from './footballScoringSummary';
import { formatFootballClockDisplay } from '../utils/footballClock';

const TEAM_CODES = ['V', 'H'];
const PERIODS = [1, 2, 3, 4];

const finiteNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const orderedEvents = (envelope) => (Array.isArray(envelope?.events) ? envelope.events : [])
  .filter((event) => !event?.status || event.status === 'accepted')
  .slice()
  .sort((left, right) => finiteNumber(left.sequence, 0) - finiteNumber(right.sequence, 0));

const oppositeTeam = (team) => (team === 'V' ? 'H' : 'V');

const fieldLength = (envelope) => Math.max(1, finiteNumber(envelope?.game?.rules?.fieldLength, 100));

const relativeSpot = (spot, team, length) => {
  const value = String(spot || '').trim();
  if (/^goal$/i.test(value)) return length;
  if (/^(?:50|midfield)$/i.test(value)) return length / 2;
  const match = value.match(/^([HV])(\d{1,2})$/i);
  if (!match) return null;
  const yard = finiteNumber(match[2]);
  return match[1].toUpperCase() === team ? yard : length - yard;
};

const fieldPosition = (position, team, length, average = false) => {
  if (!Number.isFinite(position)) return '—';
  const clamped = Math.max(0, Math.min(length, position));
  const rounded = average ? Math.round(clamped * 10) / 10 : Math.round(clamped);
  const displayYard = (yard) => {
    if (!average || Number.isInteger(yard)) return String(Math.round(yard)).padStart(2, '0');
    return yard.toFixed(1);
  };
  if (rounded === length / 2) return '50';
  if (rounded <= length / 2) return `${team}${displayYard(rounded)}`;
  return `${oppositeTeam(team)}${displayYard(length - rounded)}`;
};

const clockSeconds = (clock) => {
  const match = String(clock || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
};

const elapsedSeconds = (envelope, drive) => {
  const start = clockSeconds(drive.startClock);
  const end = clockSeconds(drive.endClock);
  if (start === null || end === null) return null;
  const startPeriod = Math.max(1, finiteNumber(drive.startPeriod, 1));
  const endPeriod = Math.max(startPeriod, finiteNumber(drive.endPeriod, startPeriod));
  const periodSeconds = Math.max(60, finiteNumber(envelope?.game?.rules?.minutesPerPeriod, 15) * 60);
  if (startPeriod === endPeriod) return Math.max(0, start - end);
  return Math.max(0, start)
    + (Math.max(0, endPeriod - startPeriod - 1) * periodSeconds)
    + Math.max(0, periodSeconds - end);
};

const formatElapsed = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const humanize = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .trim()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const turnoverKind = (event) => {
  if (event?.result?.turnover?.type === 'interception' || event?.result?.code === 'interception') return 'Interception';
  if (event?.result?.fumble?.turnover || event?.result?.turnover?.type === 'fumble') return 'Fumble';
  return 'Turnover';
};

const obtainedLabel = (reason, acquisitionEvent) => {
  const normalized = String(reason || '').toLowerCase();
  const penaltyStartReason = normalized === 'penaltyenforcement' || normalized === 'penaltypossessionchange';
  if (penaltyStartReason && acquisitionEvent?.type === 'kickoff') return 'Kickoff';
  if (penaltyStartReason && acquisitionEvent?.type === 'punt') return 'Punt';
  if (normalized === 'kickoff') return 'Kickoff';
  if (normalized === 'punt') return 'Punt';
  if (normalized === 'fumblerecovery') return 'Fumble';
  if (normalized === 'interception') return 'Interception';
  if (normalized === 'turnoverondowns') return 'Downs';
  if (normalized === 'turnover') return turnoverKind(acquisitionEvent);
  if (normalized === 'missedfieldgoal') return 'Missed Field Goal';
  return humanize(reason) || 'Possession';
};

const lostLabel = (drive, terminalEvent, gameFinal) => {
  const normalized = String(drive.result || '').toLowerCase();
  if (!normalized) return gameFinal ? 'End of Game' : 'In Progress';
  if (normalized === 'touchdown') return 'Touchdown';
  if (normalized === 'fieldgoal') return 'Field Goal';
  if (normalized === 'missedfieldgoal') return 'Missed Field Goal';
  if (normalized === 'turnoverondowns') return 'Downs';
  if (normalized === 'turnover') return turnoverKind(terminalEvent);
  if (normalized === 'endofhalf') return 'End of Half';
  if (normalized === 'endofgame') return 'End of Game';
  return humanize(drive.result) || 'Possession';
};

const driveEvents = (events, driveId) => events.filter((event) => event?.preState?.driveId === driveId);

const projectDrive = (envelope, events, drive) => {
  const matchingEvents = driveEvents(events, drive.driveId);
  const firstEvent = matchingEvents[0] || null;
  const terminalEvent = [...matchingEvents].reverse().find((event) => event.type !== 'gameControl') || matchingEvents.at(-1) || null;
  const firstIndex = firstEvent ? events.indexOf(firstEvent) : -1;
  const acquisitionEvent = firstIndex > 0 ? events[firstIndex - 1] : null;
  const gameFinal = envelope?.game?.status === 'final';
  const isCurrent = !drive.result;
  const endPeriod = finiteNumber(
    drive.endPeriod,
    isCurrent ? finiteNumber(matchingEvents.at(-1)?.period, drive.startPeriod) : drive.startPeriod,
  );
  const endClock = drive.endClock
    || (isCurrent && gameFinal ? '00:00' : matchingEvents.at(-1)?.clock)
    || null;
  const length = fieldLength(envelope);
  const startPosition = relativeSpot(drive.startYardLine, drive.team, length);
  const endPosition = Number.isFinite(startPosition)
    ? startPosition + finiteNumber(drive.yards, 0)
    : null;
  const completeDrive = { ...drive, endPeriod, endClock };

  return {
    id: drive.driveId || `drive-${drive.driveNumber}`,
    driveNumber: finiteNumber(drive.driveNumber, 0),
    team: drive.team,
    teamLabel: envelope.game.teams[drive.team]?.abbr || drive.team,
    quarter: finiteNumber(drive.startPeriod, 1),
    startSpot: drive.startYardLine || fieldPosition(startPosition, drive.team, length),
    startTime: formatFootballClockDisplay(drive.startClock, '—'),
    howObtained: obtainedLabel(drive.startReason, acquisitionEvent),
    endSpot: fieldPosition(endPosition, drive.team, length),
    endTime: formatFootballClockDisplay(endClock, '—'),
    howLost: lostLabel(drive, terminalEvent, gameFinal),
    plays: finiteNumber(drive.plays, 0),
    yards: finiteNumber(drive.yards, 0),
    time: formatElapsed(elapsedSeconds(envelope, completeDrive)),
    startPeriod: finiteNumber(drive.startPeriod, 1),
    endPeriod,
    startPosition,
    endPosition,
  };
};

const possessionLost = (event, team) => Boolean(
  (event?.result?.fumble?.turnover && event.result.fumble.recoveredByTeam && event.result.fumble.recoveredByTeam !== team)
  || (event?.result?.turnover?.team && event.result.turnover.team !== team)
  || (event?.result?.nextPossession && event.result.nextPossession !== team),
);

const conversionAttempt = (envelope, event) => {
  if (!['rush', 'pass'].includes(event.type)) return null;
  const down = finiteNumber(event?.preState?.down);
  if (![3, 4].includes(down)) return null;
  const team = event.possession || event?.preState?.possession;
  if (!TEAM_CODES.includes(team)) return null;
  const penalties = event.penalties || [];
  if (penalties.some((penalty) => penalty.status === 'offsetting' || (penalty.status === 'accepted' && penalty.replayDown))) return null;

  const length = fieldLength(envelope);
  const start = relativeSpot(event?.preState?.yardLine, team, length);
  const end = relativeSpot(event?.result?.endYardLine, team, length);
  const yards = Number.isFinite(start) && Number.isFinite(end)
    ? end - start
    : finiteNumber(event?.result?.yards, 0);
  const touchdown = event?.result?.scoring?.type === 'touchdown' && event.result.scoring.team === team;
  const madeWithoutPenalty = !possessionLost(event, team)
    && (touchdown || yards >= finiteNumber(event?.preState?.distance, Number.POSITIVE_INFINITY));
  if (!madeWithoutPenalty && penalties.some((penalty) => penalty.status === 'accepted' && penalty.automaticFirstDown)) return null;

  return {
    team,
    period: finiteNumber(event.period, 1),
    down,
    made: madeWithoutPenalty,
  };
};

const efficiency = (attempts, team, period, down) => {
  const matching = attempts.filter((attempt) => (
    attempt.team === team
    && attempt.down === down
    && (period === 'total' || attempt.period === period)
  ));
  return `${matching.filter((attempt) => attempt.made).length}-${matching.length}`;
};

const averagePosition = (drives, team, period, field, periodField, length) => {
  const positions = drives
    .filter((drive) => drive.team === team && (period === 'total' || drive[periodField] === period))
    .map((drive) => drive[field])
    .filter(Number.isFinite);
  if (positions.length === 0) return '—';
  return fieldPosition(
    positions.reduce((total, position) => total + position, 0) / positions.length,
    team,
    length,
    true,
  );
};

const buildBreakdown = (envelope, drives, attempts, team) => {
  const length = fieldLength(envelope);
  const columns = [...PERIODS, 'total'];
  const values = (formatter) => Object.fromEntries(columns.map((period) => [period, formatter(period)]));
  return [
    { id: 'third-down', label: '3rd Down Efficiency', values: values((period) => efficiency(attempts, team, period, 3)) },
    { id: 'fourth-down', label: '4th Down Efficiency', values: values((period) => efficiency(attempts, team, period, 4)) },
    { id: 'average-start', label: 'Avg. Starting Position', values: values((period) => averagePosition(drives, team, period, 'startPosition', 'startPeriod', length)) },
    { id: 'average-end', label: 'Avg. Ending Position', values: values((period) => averagePosition(drives, team, period, 'endPosition', 'endPeriod', length)) },
  ];
};

export const buildFootballDriveChartReport = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for the drive chart report.');
  }
  const events = orderedEvents(envelope);
  const sourceDrives = [
    ...(Array.isArray(envelope?.drives?.completed) ? envelope.drives.completed : []),
    ...(envelope?.drives?.current ? [envelope.drives.current] : []),
  ].sort((left, right) => finiteNumber(left.driveNumber, 0) - finiteNumber(right.driveNumber, 0));
  const chronological = sourceDrives.map((drive) => projectDrive(envelope, events, drive));
  const attempts = events.map((event) => conversionAttempt(envelope, event)).filter(Boolean);
  const teams = Object.fromEntries(TEAM_CODES.map((team) => [team, {
    ...envelope.game.teams[team],
    drives: chronological.filter((drive) => drive.team === team),
    breakdown: buildBreakdown(envelope, chronological, attempts, team),
  }]));

  return {
    gameId: envelope.gameId,
    reportTitle: 'Drive Chart',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    chronological,
  };
};
