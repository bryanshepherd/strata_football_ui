import { formatFootballClockDisplay } from '../utils/footballClock';
import { buildFootballQuickieStatsReport } from './footballQuickieStats';
import { formatFootballReportDate } from './footballScoringSummary';

const TEAM_CODES = ['V', 'H'];
const STRUCTURAL_GAME_CONTROLS = new Set([
  'endgame',
  'endquarter',
  'halftime',
  'startgame',
  'startquarter',
]);

const finiteNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const acceptedEvents = (envelope) => (Array.isArray(envelope?.events) ? envelope.events : [])
  .filter((event) => !event?.status || event.status === 'accepted')
  .slice()
  .sort((left, right) => finiteNumber(left.sequence, 0) - finiteNumber(right.sequence, 0));

const isDisplayEvent = (event) => !(
  event?.type === 'gameControl'
  && STRUCTURAL_GAME_CONTROLS.has(String(event?.subtype || '').toLowerCase())
);

export const footballPeriodName = (period) => {
  const names = ['First Quarter', 'Second Quarter', 'Third Quarter', 'Fourth Quarter'];
  if (period <= names.length) return names[period - 1];
  const overtime = period - names.length;
  return overtime === 1 ? 'First Overtime' : `Overtime ${overtime}`;
};

const selectedPeriods = (envelope, events, input = {}) => {
  const params = input instanceof URLSearchParams ? input : null;
  const available = [...new Set(events
    .filter(isDisplayEvent)
    .map((event) => finiteNumber(event.period))
    .filter((period) => Number.isInteger(period) && period > 0))]
    .sort((left, right) => left - right);
  const fallback = available.length > 0 ? available : [Math.max(1, finiteNumber(envelope?.game?.period, 1))];
  const requestedQuarter = finiteNumber(params?.get('quarter') ?? input.quarter);
  if (Number.isInteger(requestedQuarter) && requestedQuarter > 0) return [requestedQuarter];

  const start = finiteNumber(params?.get('startQuarter') ?? input.startQuarter, fallback[0]);
  const end = finiteNumber(params?.get('endQuarter') ?? input.endQuarter, fallback.at(-1));
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  const inRange = fallback.filter((period) => period >= lower && period <= upper);
  return inRange.length > 0 ? inRange : fallback;
};

const formatDownAndDistance = (event) => {
  const down = finiteNumber(event?.preState?.down);
  if (!Number.isInteger(down) || down < 1) return '';
  const suffix = down === 1 ? 'st' : down === 2 ? 'nd' : down === 3 ? 'rd' : 'th';
  const distance = event?.preState?.goalToGo
    || String(event?.preState?.lineToGain || '').toLowerCase() === 'goal'
    ? 'Goal'
    : finiteNumber(event?.preState?.distance, '—');
  return `${down}${suffix} & ${distance}`;
};

export const formatFootballPlaySpot = (spot, teams) => {
  const value = String(spot || '').trim();
  if (!value) return '';
  if (/^(?:50|midfield)$/i.test(value)) return '50';
  const match = value.match(/^([HV])(\d{1,2})$/i);
  if (!match) return value;
  const team = match[1].toUpperCase();
  const abbreviation = teams?.[team]?.abbr || team;
  return `${abbreviation} ${finiteNumber(match[2], 0)}`;
};

const clockSeconds = (clock) => {
  const match = String(clock || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
};

const elapsedSeconds = (envelope, drive) => {
  const start = clockSeconds(drive?.startClock);
  const isFinalActiveDrive = envelope?.game?.status === 'final' && !drive?.endClock;
  const endClock = isFinalActiveDrive
    ? (envelope?.clock?.clock || '00:00')
    : drive?.endClock;
  const end = clockSeconds(endClock);
  if (start === null || end === null) return null;
  const startPeriod = Math.max(1, finiteNumber(drive?.startPeriod, 1));
  const endPeriodValue = isFinalActiveDrive
    ? (envelope?.clock?.period ?? envelope?.game?.period ?? drive?.startPeriod)
    : drive?.endPeriod;
  const endPeriod = Math.max(startPeriod, finiteNumber(endPeriodValue, startPeriod));
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

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const formatFootballPlayText = (event, teams) => {
  let text = String(event?.description || humanize(event?.subtype || event?.type) || 'Play').trim();
  const timeout = event?.type === 'gameControl' && String(event?.subtype || '').toLowerCase() === 'timeout';
  if (!timeout) {
    const prefixes = Object.values(teams || {})
      .flatMap((team) => [team?.abbr, team?.name])
      .filter(Boolean)
      .sort((left, right) => String(right).length - String(left).length);
    const prefix = prefixes.find((candidate) => new RegExp(`^${escapeRegExp(candidate)}(?:\\s+|:\\s*)`, 'i').test(text));
    if (prefix) text = text.replace(new RegExp(`^${escapeRegExp(prefix)}(?:\\s+|:\\s*)`, 'i'), '');
  }
  text = text
    .replace(/\b([HV])\s+(goal line|end zone)\b/gi, (_match, team, location) => (
      `${teams?.[team.toUpperCase()]?.abbr || team.toUpperCase()} ${location.toLowerCase()}`
    ))
    .replace(/\b([HV])(\d{1,2})\b/gi, (_match, team, yard) => (
      `${teams?.[team.toUpperCase()]?.abbr || team.toUpperCase()} ${finiteNumber(yard, 0)}`
    ));
  if (timeout) {
    const clock = formatFootballClockDisplay(event?.clock, '');
    if (clock && !new RegExp(`^\\(${escapeRegExp(clock)}\\)`).test(text)) text = `(${clock}) ${text}`;
  }
  return text;
};

const driveResult = (envelope, drive) => {
  if (drive?.result) return humanize(drive.result);
  return envelope?.game?.status === 'final' ? 'End of Game' : 'In Progress';
};

const driveSummary = (envelope, drive, teams) => {
  const team = teams?.[drive.team]?.abbr || drive.team;
  const plays = Math.max(0, finiteNumber(drive.plays, 0));
  const yards = finiteNumber(drive.yards, 0);
  const playLabel = plays === 1 ? 'play' : 'plays';
  const yardLabel = Math.abs(yards) === 1 ? 'yard' : 'yards';
  return `${team} drive: ${plays} ${playLabel}, ${yards} ${yardLabel}, ${formatElapsed(elapsedSeconds(envelope, drive))}; ${driveResult(envelope, drive)}.`;
};

const followingTry = (events, terminalEvent) => {
  const terminalIndex = events.indexOf(terminalEvent);
  for (let index = terminalIndex + 1; index < events.length; index += 1) {
    const event = events[index];
    if (event.type === 'try') return event;
    if (event.type === 'kickoff') return null;
    if (event?.preState?.driveId && event.preState.driveId !== terminalEvent?.preState?.driveId) return null;
  }
  return null;
};

const driveRows = (envelope, events) => {
  const drives = [
    ...(Array.isArray(envelope?.drives?.completed) ? envelope.drives.completed : []),
    ...(envelope?.drives?.current ? [envelope.drives.current] : []),
  ];
  const byDriveId = new Map();
  const byEndSequence = new Map();
  drives.forEach((drive) => {
    const matching = events.filter((event) => event?.preState?.driveId === drive.driveId);
    if (matching.length === 0) return;
    const terminalEvent = matching.at(-1);
    const tryEvent = String(drive.result || '').toLowerCase() === 'touchdown'
      ? followingTry(events, terminalEvent)
      : null;
    const boundary = {
      drive,
      firstSequence: finiteNumber(matching[0].sequence, 0),
      lastSequence: finiteNumber(tryEvent?.sequence ?? terminalEvent.sequence, 0),
    };
    byDriveId.set(drive.driveId, boundary);
    byEndSequence.set(boundary.lastSequence, boundary);
  });
  return { byDriveId, byEndSequence };
};

const scoreBySequence = (events) => {
  const score = { V: 0, H: 0 };
  let pendingTouchdown = false;
  return events.reduce((map, event) => {
    const scoring = event?.result?.scoring;
    if (TEAM_CODES.includes(scoring?.team) && finiteNumber(scoring?.points, 0) > 0) {
      score[scoring.team] += finiteNumber(scoring.points, 0);
    }
    if (String(scoring?.type || '').toLowerCase() === 'touchdown') {
      pendingTouchdown = true;
      return map;
    }
    if (event.type === 'try') {
      if (pendingTouchdown) map.set(finiteNumber(event.sequence, 0), { ...score });
      pendingTouchdown = false;
      return map;
    }
    if (TEAM_CODES.includes(scoring?.team) && finiteNumber(scoring?.points, 0) > 0) {
      map.set(finiteNumber(event.sequence, 0), { ...score });
    }
    return map;
  }, new Map());
};

const eventRows = (envelope, events, period, drives, scores) => {
  const teams = envelope.game.teams;
  return events
    .filter((event) => finiteNumber(event.period) === period && isDisplayEvent(event))
    .flatMap((event) => {
      const sequence = finiteNumber(event.sequence, 0);
      const drive = drives.byDriveId.get(event?.preState?.driveId);
      const endingDrive = drives.byEndSequence.get(sequence);
      const rows = [];
      if (drive?.firstSequence === sequence) {
        const team = teams?.[drive.drive.team]?.abbr || drive.drive.team;
        rows.push({
          id: `drive-start-${drive.drive.driveId}`,
          kind: 'drive-start',
          text: `${team} drive start at ${formatFootballClockDisplay(drive.drive.startClock, '—')}.`,
        });
      }
      rows.push({
        id: `play-${sequence}`,
        kind: 'play',
        sequence,
        downAndDistance: formatDownAndDistance(event),
        spot: formatFootballPlaySpot(event?.preState?.yardLine, teams),
        text: formatFootballPlayText(event, teams),
      });
      const score = scores.get(sequence);
      if (score) {
        rows.push({
          id: `score-${sequence}`,
          kind: 'score',
          sequence,
          text: `${teams.V.abbr || 'VIS'} ${score.V} – ${teams.H.abbr || 'HOME'} ${score.H}`,
        });
      }
      if (endingDrive) {
        rows.push({
          id: `drive-end-${endingDrive.drive.driveId}`,
          kind: 'drive-end',
          text: driveSummary(envelope, endingDrive.drive, teams),
        });
      }
      return rows;
    });
};

export const buildFootballPlayByPlayReport = (envelope, scopeInput = {}) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for the Play-by-Play report.');
  }
  const events = acceptedEvents(envelope);
  const periods = selectedPeriods(envelope, events, scopeInput);
  const drives = driveRows(envelope, events.filter(isDisplayEvent));
  const scores = scoreBySequence(events);
  const teams = envelope.game.teams;
  return {
    gameId: envelope.gameId,
    reportTitle: 'Play-by-Play',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    periods,
    quarters: periods.map((period) => ({
      period,
      label: footballPeriodName(period),
      rows: eventRows(envelope, events, period, drives, scores),
      quickie: buildFootballQuickieStatsReport(envelope, { mode: 'quarter', quarter: period }),
    })),
  };
};
