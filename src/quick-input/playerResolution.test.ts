import { describe, expect, it } from 'vitest';
import {
  createDraftPlayerResolution,
  resolvePlayerByJersey,
  type PlayerResolutionRosterPlayer,
} from './playerResolution';

describe('playerResolution', () => {
  it('returns a blocking error when no roster player matches the jersey and team', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '99',
      teamScope: 'H',
      actionContext: 'offense',
      roster: duplicateNumberRoster(),
    });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error.code).toBe('NO_MATCHING_PLAYER');
      expect(result.error.message).toContain('#99');
    }
  });

  it('resolves a single matching roster player immediately', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '#12',
      teamScope: 'H',
      actionContext: 'offense',
      roster: [...duplicateNumberRoster(), player('h-12', 'H', '12', 'Reed', { position: 'QB' })],
    });

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.player.playerId).toBe('h-12');
      expect(result.player.jersey).toBe('12');
      expect(result.resolution).toEqual({
        source: 'singleMatch',
        jerseyToken: '12',
        teamScope: 'H',
        duplicateCandidateIds: undefined,
        recommendedPlayerId: undefined,
        selectedRecommended: undefined,
        actionContext: 'offense',
      });
    }
  });

  it('keeps duplicate candidates and recommends the offensive player for a rush context', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'offense',
      roster: duplicateNumberRoster(),
    });

    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.candidates.map((candidate) => candidate.playerId)).toEqual(['h-3-rb', 'h-3-olb', 'h-3-pr']);
      expect(result.recommended.playerId).toBe('h-3-rb');
      expect(result.recommended.position).toBe('RB');
      expect(result.recommendedResolution.source).toBe('duplicateConfirmed');
      expect(result.recommendedResolution.recommendedPlayerId).toBe('h-3-rb');
    }
  });

  it('keeps duplicate candidates and recommends the defensive player for interception or tackle context', () => {
    const interception = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'defense',
      roster: duplicateNumberRoster(),
    });

    const tackle = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'defense',
      roster: duplicateNumberRoster(),
    });

    for (const result of [interception, tackle]) {
      expect(result.kind).toBe('duplicate');
      if (result.kind === 'duplicate') {
        expect(result.recommended.playerId).toBe('h-3-olb');
        expect(result.recommended.position).toBe('OLB');
      }
    }
  });

  it('keeps duplicate candidates and recommends the return specialist for punt return context', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'specialTeams',
      roster: duplicateNumberRoster(),
    });

    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.recommended.playerId).toBe('h-3-pr');
      expect(result.recommended.position).toBe('PR');
    }
  });

  it('preserves roster order when duplicate candidates tie', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '8',
      teamScope: 'V',
      actionContext: 'offense',
      roster: [
        player('v-8-first', 'V', '8', 'First RB', { position: 'RB' }),
        player('v-8-second', 'V', '8', 'Second RB', { position: 'RB' }),
      ],
    });

    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.recommended.playerId).toBe('v-8-first');
      expect(result.recommendedIndex).toBe(0);
      expect(result.candidates.map((candidate) => candidate.playerId)).toEqual(['v-8-first', 'v-8-second']);
    }
  });

  it('maps selected recommendation metadata into DraftPlayerResolution', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'specialTeams',
      roster: duplicateNumberRoster(),
    });

    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      const selectedResolution = createDraftPlayerResolution({
        ...result.recommendedResolution,
        selectedRecommended: true,
      });

      expect(selectedResolution).toEqual({
        source: 'duplicateConfirmed',
        jerseyToken: '3',
        teamScope: 'H',
        duplicateCandidateIds: ['h-3-rb', 'h-3-olb', 'h-3-pr'],
        recommendedPlayerId: 'h-3-pr',
        selectedRecommended: true,
        actionContext: 'specialTeams',
      });
    }
  });

  it('does not mutate roster input', () => {
    const roster = duplicateNumberRoster();
    const before = clone(roster);

    resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'defense',
      roster,
    });

    expect(roster).toEqual(before);
  });
});

function duplicateNumberRoster(): PlayerResolutionRosterPlayer[] {
  return [
    player('h-3-rb', 'H', '3', 'Jones', { position: 'RB', off_position: 'RB' }),
    player('h-3-olb', 'H', '3', 'Smith', { position: 'OLB', def_position: 'OLB' }),
    player('h-3-pr', 'H', '3', 'Davis', { position: 'PR', st_position: 'PR' }),
    player('v-3-cb', 'V', '3', 'Visitor CB', { position: 'CB', def_position: 'CB' }),
  ];
}

function player(
  playerId: string,
  team: 'H' | 'V',
  jersey: string,
  displayName: string,
  options: {
    position?: string;
    off_position?: string;
    def_position?: string;
    st_position?: string;
  } = {},
): PlayerResolutionRosterPlayer {
  return {
    playerId,
    team,
    jersey,
    displayName,
    ...options,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
