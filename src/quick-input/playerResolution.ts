import type { DraftPlayerResolution, TeamCode } from './footballIntentSchema';
import { getPositionPriorityAdvanced } from '../utils/positionPriority.js';

export type PlayerResolutionActionContext = DraftPlayerResolution['actionContext'];

export type PlayerResolutionRosterPlayer = {
  playerId?: string | number;
  id?: string | number;
  PlayerID?: string | number;
  player_id?: string | number;
  team?: string;
  teamCode?: string;
  team_code?: string;
  Team?: string;
  jersey?: string | number;
  jerseyNumber?: string | number;
  number?: string | number;
  Jersey?: string | number;
  displayName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  FirstName?: string;
  LastName?: string;
  position?: string;
  pos?: string;
  off_position?: string;
  def_position?: string;
  st_position?: string;
  side?: string;
  /** Game-roster snapshot availability. Defaults to active for legacy snapshots. */
  active?: boolean;
  [key: string]: unknown;
};

export type ResolvedPlayerCandidate = {
  player: PlayerResolutionRosterPlayer;
  playerId: string;
  team: TeamCode;
  jersey: string;
  displayName: string;
  position?: string;
  rosterIndex: number;
};

export type PlayerResolutionBlockingErrorCode =
  | 'INVALID_JERSEY_TOKEN'
  | 'INVALID_TEAM_SCOPE'
  | 'NO_MATCHING_PLAYER';

export type PlayerResolutionBlockingError = {
  code: PlayerResolutionBlockingErrorCode;
  message: string;
  jerseyToken: string;
  teamScope: TeamCode | string;
  actionContext: PlayerResolutionActionContext;
};

export type SinglePlayerResolutionResult = {
  kind: 'resolved';
  jerseyToken: string;
  teamScope: TeamCode;
  actionContext: PlayerResolutionActionContext;
  player: ResolvedPlayerCandidate;
  resolution: DraftPlayerResolution;
};

export type DuplicatePlayerResolutionResult = {
  kind: 'duplicate';
  jerseyToken: string;
  teamScope: TeamCode;
  actionContext: PlayerResolutionActionContext;
  candidates: ResolvedPlayerCandidate[];
  recommended: ResolvedPlayerCandidate;
  recommendedIndex: number;
  recommendedResolution: DraftPlayerResolution;
};

export type BlockingPlayerResolutionResult = {
  kind: 'error';
  jerseyToken: string;
  teamScope: TeamCode | string;
  actionContext: PlayerResolutionActionContext;
  error: PlayerResolutionBlockingError;
};

export type PlayerResolutionResult =
  | SinglePlayerResolutionResult
  | DuplicatePlayerResolutionResult
  | BlockingPlayerResolutionResult;

export type ResolvePlayerOptions = {
  jerseyToken: string | number;
  teamScope: TeamCode | string;
  actionContext: PlayerResolutionActionContext;
  roster: readonly PlayerResolutionRosterPlayer[];
};

const OFFENSE_POSITIONS = ['RB', 'TB', 'HB', 'FB', 'QB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'OT', 'OG'];
const DEFENSE_POSITIONS = ['DE', 'DT', 'NT', 'DL', 'MLB', 'OLB', 'ILB', 'LB', 'CB', 'DB', 'FS', 'SS', 'S'];
const SPECIAL_TEAMS_POSITIONS = ['PR', 'KR', 'K', 'P', 'LS'];

const POSITION_ORDERS: Record<'offense' | 'defense' | 'specialTeams', string[]> = {
  offense: OFFENSE_POSITIONS,
  defense: DEFENSE_POSITIONS,
  specialTeams: SPECIAL_TEAMS_POSITIONS,
};

export function resolvePlayerByJersey(options: ResolvePlayerOptions): PlayerResolutionResult {
  const jerseyToken = normalizeJerseyToken(options.jerseyToken);
  const teamScope = options.teamScope;

  if (!jerseyToken) {
    return blockingError('INVALID_JERSEY_TOKEN', 'Jersey token must be numeric', '', teamScope, options.actionContext);
  }

  if (!isTeamScope(teamScope)) {
    return blockingError('INVALID_TEAM_SCOPE', 'Team scope must be H or V', jerseyToken, teamScope, options.actionContext);
  }

  const matches = options.roster
    .map((player, rosterIndex) => normalizeCandidate(player, rosterIndex))
    .filter((candidate): candidate is ResolvedPlayerCandidate => Boolean(candidate))
    .filter((candidate) => candidate.player.active !== false)
    .filter((candidate) => candidate.team === teamScope && candidate.jersey === jerseyToken);

  if (matches.length === 0) {
    return blockingError(
      'NO_MATCHING_PLAYER',
      `No active ${teamScope} player found for #${jerseyToken}`,
      jerseyToken,
      teamScope,
      options.actionContext,
    );
  }

  if (matches.length === 1) {
    const [player] = matches;
    return {
      kind: 'resolved',
      jerseyToken,
      teamScope,
      actionContext: options.actionContext,
      player,
      resolution: createDraftPlayerResolution({
        source: 'singleMatch',
        jerseyToken,
        teamScope,
        actionContext: options.actionContext,
      }),
    };
  }

  const recommendedIndex = chooseRecommendedIndex(matches, options.actionContext);
  const recommended = matches[recommendedIndex] ?? matches[0];
  const candidateIds = matches.map((candidate) => candidate.playerId);

  return {
    kind: 'duplicate',
    jerseyToken,
    teamScope,
    actionContext: options.actionContext,
    candidates: matches,
    recommended,
    recommendedIndex,
    recommendedResolution: createDraftPlayerResolution({
      source: 'duplicateConfirmed',
      jerseyToken,
      teamScope,
      actionContext: options.actionContext,
      duplicateCandidateIds: candidateIds,
      recommendedPlayerId: recommended.playerId,
    }),
  };
}

export function createDraftPlayerResolution(input: {
  source: DraftPlayerResolution['source'];
  jerseyToken: string;
  teamScope: TeamCode;
  actionContext: PlayerResolutionActionContext;
  duplicateCandidateIds?: string[];
  recommendedPlayerId?: string;
  selectedRecommended?: boolean;
}): DraftPlayerResolution {
  return {
    source: input.source,
    jerseyToken: input.jerseyToken,
    teamScope: input.teamScope,
    duplicateCandidateIds: input.duplicateCandidateIds ? [...input.duplicateCandidateIds] : undefined,
    recommendedPlayerId: input.recommendedPlayerId,
    selectedRecommended: input.selectedRecommended,
    actionContext: input.actionContext,
  };
}

export function chooseRecommendedIndex(
  candidates: readonly ResolvedPlayerCandidate[],
  actionContext: PlayerResolutionActionContext,
): number {
  if (candidates.length === 0) return -1;

  const priorityContext = toPriorityContext(actionContext);
  if (!priorityContext) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const score = scoreCandidateForContext(candidate.player, priorityContext);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function scoreCandidateForContext(
  player: PlayerResolutionRosterPlayer,
  actionContext: 'offense' | 'defense' | 'specialTeams',
): number {
  const positions = collectPositions(player);
  const orderedPositions = POSITION_ORDERS[actionContext];
  const exactPosition = positions.find((position) => orderedPositions.includes(position));
  const exactPositionScore = exactPosition ? orderedPositions.length - orderedPositions.indexOf(exactPosition) : 0;
  const sideScore = sideMatches(player.side, actionContext) ? 100 : 0;
  const fieldScore = positionFieldScore(player, actionContext);
  const legacyScore = getPositionPriorityAdvanced({
    position: player.position ?? player.pos,
    off_position: player.off_position,
    def_position: player.def_position,
    st_position: player.st_position,
    side: player.side,
  });

  return fieldScore + sideScore + exactPositionScore + legacyScore / 1000;
}

function positionFieldScore(
  player: PlayerResolutionRosterPlayer,
  actionContext: 'offense' | 'defense' | 'specialTeams',
): number {
  if (actionContext === 'offense' && isNonEmptyString(player.off_position)) return 1000;
  if (actionContext === 'defense' && isNonEmptyString(player.def_position)) return 1000;
  if (actionContext === 'specialTeams' && isNonEmptyString(player.st_position)) return 1000;
  return 0;
}

function collectPositions(player: PlayerResolutionRosterPlayer): string[] {
  return [player.position, player.pos, player.off_position, player.def_position, player.st_position]
    .filter(isNonEmptyString)
    .map((position) => position.toUpperCase());
}

function sideMatches(side: unknown, actionContext: 'offense' | 'defense' | 'specialTeams'): boolean {
  if (!isNonEmptyString(side)) return false;
  const normalized = side.toLowerCase();
  if (actionContext === 'specialTeams') return normalized.includes('special');
  return normalized === actionContext;
}

function toPriorityContext(
  actionContext: PlayerResolutionActionContext,
): 'offense' | 'defense' | 'specialTeams' | null {
  if (actionContext === 'offense' || actionContext === 'defense' || actionContext === 'specialTeams') {
    return actionContext;
  }

  return null;
}

function normalizeCandidate(
  player: PlayerResolutionRosterPlayer,
  rosterIndex: number,
): ResolvedPlayerCandidate | null {
  const playerId = normalizeString(player.playerId ?? player.id ?? player.PlayerID ?? player.player_id);
  const team = normalizeTeam(player.team ?? player.teamCode ?? player.team_code ?? player.Team);
  const jersey = normalizeJerseyToken(player.jersey ?? player.jerseyNumber ?? player.number ?? player.Jersey);

  if (!playerId || !team || !jersey) return null;

  return {
    player,
    playerId,
    team,
    jersey,
    displayName: displayNameForPlayer(player, playerId),
    position: normalizeString(player.position ?? player.pos ?? player.off_position ?? player.def_position ?? player.st_position) || undefined,
    rosterIndex,
  };
}

function normalizeJerseyToken(value: unknown): string {
  const normalized = normalizeString(value).replace(/^#/, '');
  if (!/^\d+$/.test(normalized)) return '';
  return String(Number(normalized));
}

function normalizeTeam(value: unknown): TeamCode | null {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized === 'H' || normalized === 'HOME') return 'H';
  if (normalized === 'V' || normalized === 'VISITOR' || normalized === 'AWAY') return 'V';
  return null;
}

function isTeamScope(value: unknown): value is TeamCode {
  return value === 'H' || value === 'V';
}

function displayNameForPlayer(player: PlayerResolutionRosterPlayer, fallback: string): string {
  const direct = normalizeString(player.displayName ?? player.name);
  if (direct) return direct;

  const firstName = normalizeString(player.firstName ?? player.FirstName);
  const lastName = normalizeString(player.lastName ?? player.LastName);
  return [firstName, lastName].filter(Boolean).join(' ') || fallback;
}

function blockingError(
  code: PlayerResolutionBlockingErrorCode,
  message: string,
  jerseyToken: string,
  teamScope: TeamCode | string,
  actionContext: PlayerResolutionActionContext,
): BlockingPlayerResolutionResult {
  return {
    kind: 'error',
    jerseyToken,
    teamScope,
    actionContext,
    error: {
      code,
      message,
      jerseyToken,
      teamScope,
      actionContext,
    },
  };
}

function normalizeString(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
