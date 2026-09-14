import { isFootballBallContextRevision } from '../play-editor/footballBallContextRevision';
import { repairFootballEditedActorReferences } from '../play-editor/footballActorReferences';
import { repairFootballPassDefense } from './footballPassDefense';
import { formatFootballFumbleReadout } from './footballFumbleReadout';
import { formatFootballSafetyReadout } from './footballSafety';
import { resolveFootballUnknownPlayerText } from './footballUnknownPlayerReadout';
import { footballTeamAliasesForEnvelope } from './footballTeamAliases';
import { formatFootballClockDisplay } from './footballClock';
import { formatFootballSpotForDisplay } from './footballSpotNormalization';

const EDITABLE_TYPES = new Set(['rush', 'pass', 'punt', 'kickoff', 'fieldGoal', 'try', 'penalty']);
export const isEditableFootballReviewEvent = event => EDITABLE_TYPES.has(event?.type) || isFootballBallContextRevision(event);
const humanize = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
const ROLES = {
  intendedReceiver: 'Target', target: 'Target', receiver: 'Receiver', passer: 'Passer', quarterback: 'Passer',
  rusher: 'Rusher', returner: 'Returner', interceptor: 'Interception', tackler: 'Tackle', soloTackler: 'Tackle',
  assistTackler: 'Assisted tackle', assistedTackler: 'Assisted tackle', sack: 'Sack', sackVictim: 'Passer',
  kicker: 'Kicker', punter: 'Punter', holder: 'Holder', snapper: 'Snapper', longSnapper: 'Snapper',
  fumbler: 'Fumble', forcedBy: 'Forced fumble', forcedFumble: 'Forced fumble',
  recoveredBy: 'Fumble recovery', recoverer: 'Fumble recovery', fumbleRecovery: 'Fumble recovery',
  passBreakup: 'Pass breakup', breakup: 'Pass breakup', brokenUpBy: 'Pass breakup',
  hurriedBy: 'QB hurry', hurry: 'QB hurry', qbHurry: 'QB hurry', blocker: 'Blocked kick', blockedBy: 'Blocked kick',
  from: 'Lateral passer', to: 'Lateral receiver', penalty: 'Penalty',
};
const roleLabel = role => ROLES[role] || humanize(role) || 'Participant';
const primaryRole = event => event.type === 'pass' ? 'passer'
  : event.type === 'rush' ? 'rusher' : event.type === 'punt' ? 'punter'
    : event.type === 'try' && event.subtype !== 'kick' ? event.subtype === 'pass' ? 'passer' : 'rusher' : 'kicker';
const playerName = player => player.displayName || player.name || [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Unlisted player';

export function footballReviewContext(envelope, event) {
  const period = Number(event.result?.gameControl?.action === 'startQuarter'
    ? event.result.gameControl.period || event.period || 1 : event.period || 1);
  const regulation = Number(envelope.game?.rules?.periods) || 4;
  const label = period > regulation ? `OT${period - regulation}` : `Q${period}`;
  const context = event.preState || {};
  const side = context.possession ?? event.possession;
  const team = footballTeamAliasesForEnvelope(envelope)[side] || side || '—';
  const possession = context.down ? `${team} - ${context.down} & ${context.goalToGo ? 'Goal' : context.distance ?? '—'}` : team;
  return `${[label, formatFootballClockDisplay(event.clock)].filter(Boolean).join(' ')} · ${possession} · ${formatFootballSpotForDisplay(context.yardLine, envelope) || '—'}`;
}

// Match recorded IDs, never a jersey or an incidental name in the play text.
export function buildFootballPlayReview(envelope) {
  const players = new Map();
  for (const team of ['V', 'H']) {
    for (const [playerId, player] of Object.entries(envelope.rosters?.teams?.[team]?.players || {})) {
      players.set(playerId, { playerId, team, name: playerName(player), jersey: String(player.jersey ?? ''), position: player.position || '', playCount: 0 });
    }
  }
  const rows = (envelope.events || []).filter(event => !event.status || event.status === 'accepted').map((savedEvent, index) => {
    const event = repairFootballPassDefense(envelope, repairFootballEditedActorReferences(envelope, savedEvent));
    const involvement = new Map();
    const add = (playerId, role, details = {}) => {
      if (typeof playerId !== 'string' || !playerId || playerId === 'TM' || playerId.startsWith('TEAM:')) return;
      if (!players.has(playerId)) players.set(playerId, {
        playerId, team: details.team || '', name: playerName(details), jersey: String(details.jersey ?? ''), position: details.position || '', playCount: 0,
      });
      if (!involvement.has(playerId)) involvement.set(playerId, new Set());
      involvement.get(playerId).add(roleLabel(role));
    };
    const collect = (value, role, participant = false) => {
      if (Array.isArray(value)) { value.forEach(item => collect(item, role, participant)); return; }
      if (typeof value === 'string' && participant) { add(value, role); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (key === 'playerId' || /PlayerIds?$/.test(key)) {
          const fieldRole = key === 'playerId' ? value.role || role : key.replace(/PlayerIds?$/, '');
          for (const id of Array.isArray(item) ? item : [item]) add(id, role === 'penalty' ? 'penalty' : fieldRole, value);
        } else if (item && typeof item === 'object') collect(item, role, participant);
      }
    };
    for (const [slot, actor] of Object.entries(event.participants || {})) {
      collect(actor, slot === 'primary' ? primaryRole(event) : slot === 'secondary' && event.type === 'pass' ? 'target' : slot, true);
    }
    for (const [section, result] of Object.entries(event.result || {})) {
      collect(/PlayerIds?$/.test(section) ? { [section]: result } : result,
        section === 'turnover' && result?.type === 'interception' ? 'interceptor' : section);
    }
    collect(event.penalties, 'penalty');
    involvement.forEach((roles, id) => { players.get(id).playCount += 1; });
    const description = formatFootballSafetyReadout(event, formatFootballFumbleReadout(event,
      resolveFootballUnknownPlayerText(event, event.description || event.result?.code || 'Recorded event', envelope.rosters?.teams)));
    const context = footballReviewContext(envelope, event);
    const identities = [...involvement.keys()].map(id => players.get(id));
    return {
      key: savedEvent.eventId || savedEvent.clientEventId || `sequence-${savedEvent.sequence ?? index}`,
      event: savedEvent, description, context, involvement,
      searchText: [savedEvent.sequence, `#${savedEvent.sequence}`, context, humanize(event.type), humanize(event.subtype), description,
        ...identities.flatMap(player => [player.name, player.jersey, player.team, envelope.game?.teams?.[player.team]?.name])].join(' ').toLowerCase(),
    };
  }).sort((a, b) => Number(a.event.sequence) - Number(b.event.sequence));
  return {
    rows,
    players: [...players.values()].sort((a, b) => a.jersey.localeCompare(b.jersey, undefined, { numeric: true }) || a.name.localeCompare(b.name)),
  };
}

export const footballReviewMatches = (text, query) => String(query || '').trim().toLowerCase().split(/\s+/).every(token => text.toLowerCase().includes(token));
