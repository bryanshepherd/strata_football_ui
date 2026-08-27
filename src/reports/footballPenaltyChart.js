import legacyPenaltyTable from '../data/legacyPenaltyTable.json';
import { formatFootballReportDate } from './footballScoringSummary';

const TEAM_CODES = ['V', 'H'];
const SPECIAL_TEAMS_TYPES = new Set(['punt', 'kickoff', 'fieldGoal', 'try']);
const SECTION_DEFINITIONS = [
  { id: 'offense', title: 'Offensive Penalties' },
  { id: 'defense', title: 'Defensive Penalties' },
  { id: 'specialTeams', title: 'Special Teams Penalties' },
];

const legacyPenaltyNames = Object.fromEntries(
  legacyPenaltyTable.map((penalty) => [String(penalty.code || '').toUpperCase(), penalty.name]),
);

const fallbackPenaltyNames = {
  BBW: 'Block Below the Waist',
  SUB: 'Substitution Infraction (Illegal Substitution)',
};

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const orderedEvents = (envelope) => (Array.isArray(envelope?.events) ? envelope.events : [])
  .filter((event) => !event?.status || event.status === 'accepted')
  .slice()
  .sort((left, right) => finiteNumber(left.sequence) - finiteNumber(right.sequence));

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const teamAliases = (envelope) => TEAM_CODES.flatMap((team) => {
  const record = envelope?.game?.teams?.[team] || {};
  return [record.name, record.abbr]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}).sort((left, right) => right.length - left.length);

const foulNameFromDescription = (envelope, event) => {
  const description = String(event?.description || '').trim();
  const immediate = description.match(/^Penalty:\s+(.+?)\s+on\s+[^,]+(?:,|$)/i);
  if (immediate) return immediate[1].trim();

  const aliases = teamAliases(envelope);
  if (aliases.length === 0) return '';
  const aliasPattern = aliases.map(escapeRegExp).join('|');
  const attached = description.match(new RegExp(
    `\\bPENALTY\\s+(?:${aliasPattern})\\s+(.+?)(?=\\s+\\(#|,\\s*(?:[-+]?\\d+\\s+yards?|declined|offsetting|enforced|from\\b|accepted\\b)|\\.$|$)`,
    'i',
  ));
  if (attached?.[1]) return attached[1].trim();

  const generic = description.match(/\bPENALTY\s+(.+?)(?=\s+\(#|,\s*(?:[-+]?\d+\s+yards?|declined|offsetting|enforced|from\b|accepted\b)|\.$|$)/i);
  if (!generic?.[1]) return '';
  const candidate = generic[1].trim();
  const leadingAlias = aliases.find((alias) => candidate.toLowerCase().startsWith(`${alias.toLowerCase()} `));
  return leadingAlias ? candidate.slice(leadingAlias.length).trim() : candidate;
};

const penaltyName = (envelope, event, penalty) => (
  String(penalty?.name || '').trim()
  || foulNameFromDescription(envelope, event)
  || legacyPenaltyNames[String(penalty?.code || '').toUpperCase()]
  || fallbackPenaltyNames[String(penalty?.code || '').toUpperCase()]
  || String(penalty?.code || 'Penalty')
);

const rosterPlayer = (envelope, team, playerId) => {
  const players = envelope?.rosters?.teams?.[team]?.players;
  if (!players || !playerId) return null;
  if (Array.isArray(players)) return players.find((player) => player?.playerId === playerId) || null;
  return players[playerId] || Object.values(players).find((player) => player?.playerId === playerId) || null;
};

const participantPlayer = (event, playerId) => {
  if (!playerId) return null;
  const participants = Object.values(event?.participants || {}).flatMap((value) => (
    Array.isArray(value) ? value : value ? [value] : []
  ));
  return participants.find((participant) => participant?.playerId === playerId) || null;
};

const playerLabel = (envelope, event, penalty) => {
  const playerId = penalty?.playerId;
  if (!playerId) return '—';
  const player = rosterPlayer(envelope, penalty.team, playerId) || participantPlayer(event, playerId) || {};
  const jersey = String(player.jersey || '').trim();
  const name = String(
    player.displayName
    || [player.firstName, player.lastName].filter(Boolean).join(' ')
    || penalty.playerName
    || '',
  ).trim();
  if (jersey && name) return `#${jersey} ${name}`;
  if (jersey) return `#${jersey}`;
  return name || '—';
};

const downAndDistance = (event) => {
  const down = finiteNumber(event?.preState?.down);
  if (down === null) return '—';
  if (String(event?.preState?.lineToGain || '').toLowerCase() === 'goal') return `${down} & GOAL`;
  const distance = finiteNumber(event?.preState?.distance);
  return distance === null ? String(down) : `${down} & ${distance}`;
};

const dispositionLabel = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted') return 'Accepted';
  if (normalized === 'declined') return 'Declined';
  if (normalized === 'offsetting') return 'Offsetting';
  return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : '—';
};

const penaltySection = (events, eventIndex, event, penalty) => {
  if (SPECIAL_TEAMS_TYPES.has(event.type)) return 'specialTeams';
  if (!event.possession && !event?.preState?.possession) {
    const nextEvent = events[eventIndex + 1];
    if (SPECIAL_TEAMS_TYPES.has(nextEvent?.type)) return 'specialTeams';
  }
  const possession = event.possession || event?.preState?.possession;
  return possession && penalty.team === possession ? 'offense' : 'defense';
};

const postFoulSpot = (event, penalty) => {
  if (penalty?.finalSpot) return penalty.finalSpot;
  if (String(penalty?.status || '').toLowerCase() === 'offsetting') return event?.preState?.yardLine || '—';
  return event?.result?.endYardLine || event?.preState?.yardLine || '—';
};

const preFoulSpot = (event, penalty) => {
  const enforcedFrom = String(penalty?.enforcedFrom || '').toLowerCase();
  if (['spot', 'spotoffoul'].includes(enforcedFrom)) {
    return penalty?.spotOfFoul || event?.preState?.yardLine || '—';
  }
  if (['end', 'endofplay', 'succeedingspot'].includes(enforcedFrom)) {
    return event?.result?.return?.returnEndYardLine
      || event?.result?.endYardLine
      || event?.preState?.yardLine
      || '—';
  }
  return event?.preState?.yardLine || '—';
};

const projectPenalty = (envelope, event, penalty, penaltyIndex, section) => {
  const yards = finiteNumber(penalty?.yards);
  const status = String(penalty?.status || '').toLowerCase();
  return {
    id: penalty.penaltyId || `${event.sequence}-${penaltyIndex}`,
    sequence: finiteNumber(event.sequence) || 0,
    team: penalty.team,
    section,
    downAndDistance: downAndDistance(event),
    preFoulSpot: preFoulSpot(event, penalty),
    disposition: dispositionLabel(status),
    status,
    accepted: status === 'accepted',
    foulName: penaltyName(envelope, event, penalty),
    player: playerLabel(envelope, event, penalty),
    yards: yards === null ? '—' : String(Math.abs(yards)),
    postFoulSpot: postFoulSpot(event, penalty),
    play: String(event?.description || '').trim() || '—',
  };
};

export const buildFootballPenaltyChartReport = (envelope) => {
  if (!envelope?.game?.teams?.V || !envelope?.game?.teams?.H) {
    throw new Error('A football game envelope is required for the penalty chart report.');
  }
  const events = orderedEvents(envelope);
  const penalties = events.flatMap((event, eventIndex) => (
    (event.penalties || [])
      .filter((penalty) => TEAM_CODES.includes(penalty?.team))
      .map((penalty, penaltyIndex) => projectPenalty(
        envelope,
        event,
        penalty,
        penaltyIndex,
        penaltySection(events, eventIndex, event, penalty),
      ))
  ));
  const teams = Object.fromEntries(TEAM_CODES.map((team) => {
    const teamRecord = envelope.game.teams[team];
    return [team, {
      team,
      ...teamRecord,
      sections: SECTION_DEFINITIONS.map((section) => ({
        ...section,
        penalties: penalties.filter((penalty) => penalty.team === team && penalty.section === section.id),
      })),
    }];
  }));

  return {
    gameId: envelope.gameId,
    reportTitle: 'Penalty Chart',
    reportMatchup: `${envelope.game.teams.V.name} vs. ${envelope.game.teams.H.name} (${formatFootballReportDate(envelope.game.scheduledAt)})`,
    teams,
    penaltyCount: penalties.length,
  };
};
