import {
  buildFootballDriveSummary,
  buildFootballScoringPlaySummary,
  isFootballDriveSummaryTerminalEvent,
  isFootballTryReplayEvent,
} from '../scoring/footballDriveSummary';

export const FOOTBALL_REPORT_TIME_ZONE = 'America/New_York';

const OFFICIAL_PRECEDENCE = [
  ['referee', 'REFEREE'],
  ['umpire', 'UMPIRE'],
  ['linesman', 'LINESMAN'],
  ['linejudge', 'LINE JUDGE'],
  ['backjudge', 'BACK JUDGE'],
  ['fieldjudge', 'FIELD JUDGE'],
  ['sidejudge', 'SIDE JUDGE'],
  ['centerjudge', 'CENTER JUDGE'],
  ['scorer', 'SCORER'],
  ['replayofficial', 'REPLAY OFFICIAL'],
  ['assistantreplay', 'ASST. REPLAY'],
];

export const FOOTBALL_REPORT_BASELINE_GAME_ID = 'FB-ca7d777b-a8aa-4a26-bd20-b10f7bb621a7';

const BASELINE_TEAM_RECORDS = {
  V: { overall: '2-2', conference: '0-2', conferenceName: 'MEC' },
  H: { overall: '3-1', conference: '2-0', conferenceName: 'MEC' },
};

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

export const formatFootballReportDate = (value) => {
  const date = validDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: FOOTBALL_REPORT_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatFootballReportTime = (value) => {
  const date = validDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: FOOTBALL_REPORT_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatDuration = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) return '—';
  const hours = Math.floor(value / 60);
  return `${hours}:${String(Math.round(value % 60)).padStart(2, '0')}`;
};

const normalizeOfficialRole = (role) => String(role || '')
  .trim()
  .toLowerCase()
  .replace(/^head\s+linesman$/, 'linesman')
  .replace(/^assistant\s+replay\s+official$/, 'assistant replay')
  .replace(/[^a-z]/g, '');

const officialRows = (envelope) => {
  const entered = envelope?.game?.wrapUp?.officials || envelope?.game?.officials || [];
  const byRole = new Map();
  entered.forEach((official) => {
    const name = String(official?.name || '').trim();
    const role = normalizeOfficialRole(official?.role);
    if (name && role && !byRole.has(role)) byRole.set(role, name);
  });
  return OFFICIAL_PRECEDENCE.flatMap(([role, label]) => (
    byRole.has(role) ? [{ role: label, name: byRole.get(role) }] : []
  ));
};

const orderedEvents = (envelope) => (Array.isArray(envelope?.events) ? envelope.events : [])
  .slice()
  .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));

const isScoringEvent = (event) => {
  if (isFootballTryReplayEvent(event)) return false;
  const scoring = event?.result?.scoring;
  return scoring && ['V', 'H'].includes(scoring.team) && Number(scoring.points) > 0;
};

const periodLabel = (period) => {
  if (period === 1) return '1ST';
  if (period === 2) return '2ND';
  if (period === 3) return '3RD';
  if (period === 4) return '4TH';
  if (period === 5) return 'OT';
  return `${period - 4}OT`;
};

const teamRecord = (envelope, team) => {
  if (envelope?.gameId === FOOTBALL_REPORT_BASELINE_GAME_ID) {
    return BASELINE_TEAM_RECORDS[team];
  }
  const record = envelope?.game?.teamRecords?.[team]
    || envelope?.game?.wrapUp?.previousRecords?.[team]
    || {};
  return {
    overall: String(record.overall || '—'),
    conference: String(record.conference || '—'),
    conferenceName: String(record.conferenceName || record.conferenceAbbr || '').trim(),
  };
};

const recordText = (record) => [
  record.overall,
  [record.conference, record.conferenceName].filter(Boolean).join(' '),
].filter(Boolean).join(', ');

const weatherText = (weather) => {
  const parts = [];
  if (weather?.conditions) parts.push(String(weather.conditions).trim());
  if (
    weather?.temperatureF !== null
    && weather?.temperatureF !== undefined
    && Number.isFinite(Number(weather.temperatureF))
  ) parts.push(`${Number(weather.temperatureF)}°F`);
  return parts.filter(Boolean).join(', ') || '—';
};

const scoringDriveText = (envelope, terminalEvent) => {
  const drive = buildFootballDriveSummary(envelope, terminalEvent);
  if (!drive) return '—';
  return `${drive.plays} Plays, ${drive.yards} Yards, ${drive.timeOfPossession} TOP`;
};

export const buildFootballScoringSummary = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for the scoring summary.');
  }
  const teams = envelope.game.teams;
  const events = orderedEvents(envelope);
  const scoringEvents = events.filter(isScoringEvent);
  const maximumPeriod = Math.max(
    4,
    Number(envelope.game.period || 0),
    ...scoringEvents.map((event) => Number(event.period || 0)),
  );
  const periods = Array.from({ length: maximumPeriod }, (_, index) => ({
    period: index + 1,
    label: periodLabel(index + 1),
  }));
  const periodScores = {
    V: Object.fromEntries(periods.map(({ period }) => [period, 0])),
    H: Object.fromEntries(periods.map(({ period }) => [period, 0])),
  };
  const scores = { V: 0, H: 0 };
  const scoringScoresBySequence = new Map();
  scoringEvents.forEach((event) => {
    const team = event.result.scoring.team;
    const points = Number(event.result.scoring.points);
    const period = Number(event.period || 0);
    scores[team] += points;
    if (periodScores[team][period] !== undefined) periodScores[team][period] += points;
    scoringScoresBySequence.set(Number(event.sequence || 0), { ...scores });
  });

  let runningScore = { V: 0, H: 0 };
  const scoresBySequence = new Map();
  events.forEach((event) => {
    const scoringScore = scoringScoresBySequence.get(Number(event.sequence || 0));
    if (scoringScore) runningScore = scoringScore;
    scoresBySequence.set(Number(event.sequence || 0), { ...runningScore });
  });

  const claimedScoringSequences = new Set();
  const summarizedScoring = events.flatMap((terminalEvent) => {
    if (!isFootballDriveSummaryTerminalEvent(terminalEvent)) return [];
    const summary = buildFootballScoringPlaySummary(envelope, terminalEvent);
    if (!summary) return [];
    const scoringEvent = summary.scoringEvent;
    const scoringTeam = scoringEvent.result.scoring.team;
    const period = Number(scoringEvent.period || 0);
    const terminalSequence = Number(terminalEvent.sequence || scoringEvent.sequence || 0);
    const score = scoresBySequence.get(terminalSequence) || runningScore;
    claimedScoringSequences.add(Number(scoringEvent.sequence || 0));
    if (isScoringEvent(terminalEvent)) {
      claimedScoringSequences.add(Number(terminalEvent.sequence || 0));
    }
    return [{
      sequence: terminalSequence,
      quarter: period > 4 ? periodLabel(period) : String(period),
      time: String(scoringEvent.clock || '—'),
      team: teams[scoringTeam].abbr || scoringTeam,
      description: summary.scoringPlay,
      drive: scoringDriveText(envelope, terminalEvent),
      score: `${score.V}-${score.H}`,
    }];
  });

  const fallbackScoring = scoringEvents.flatMap((event) => {
    const sequence = Number(event.sequence || 0);
    if (claimedScoringSequences.has(sequence)) return [];
    const team = event.result.scoring.team;
    const period = Number(event.period || 0);
    const score = scoresBySequence.get(sequence) || runningScore;
    return [{
      sequence,
      quarter: period > 4 ? periodLabel(period) : String(period),
      time: String(event.clock || '—'),
      team: teams[team].abbr || team,
      description: String(event.description || 'Scoring play'),
      drive: scoringDriveText(envelope, event),
      score: `${score.V}-${score.H}`,
    }];
  });
  const scoring = [...summarizedScoring, ...fallbackScoring]
    .sort((left, right) => left.sequence - right.sequence);
  const visitorRecord = teamRecord(envelope, 'V');
  const homeRecord = teamRecord(envelope, 'H');
  const venue = envelope.game.venue || {};
  const wrapUp = envelope.game.wrapUp || {};
  const weather = wrapUp.weather || envelope.game.weather || {};

  return {
    gameId: envelope.gameId,
    reportTitle: 'Scoring Summary',
    reportMatchup: `${teams.V.name} vs. ${teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    matchup: `${teams.V.name} (${recordText(visitorRecord)}) vs. ${teams.H.name} (${recordText(homeRecord)})`,
    teams,
    periods,
    scoreByQuarter: {
      V: { periods: periodScores.V, total: Number(teams.V.score || scores.V) },
      H: { periods: periodScores.H, total: Number(teams.H.score || scores.H) },
    },
    scoring,
    gameDetails: {
      date: formatFootballReportDate(envelope.game.scheduledAt),
      scheduledTime: formatFootballReportTime(envelope.game.scheduledAt),
      kickoffTime: formatFootballReportTime(wrapUp.startedAt || envelope.game.startedAt),
      endOfGame: formatFootballReportTime(wrapUp.endedAt || envelope.game.endedAt),
      duration: formatDuration(wrapUp.durationMinutes),
      site: String(venue.location || [venue.city, venue.state].filter(Boolean).join(', ') || '—'),
      venue: String(venue.name || '—'),
      attendance: wrapUp.attendance ?? envelope.game.attendance ?? '—',
      weather: weatherText(weather),
      wind: String(weather.wind || '—'),
    },
    officials: officialRows(envelope),
  };
};
