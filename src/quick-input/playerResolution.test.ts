import { describe, expect, it } from 'vitest';
import { footballPositionKeys } from '../utils/footballPositions.js';
import { getPositionPriorityAdvanced } from '../utils/positionPriority.js';
import {
  createDraftPlayerResolution,
  resolvePlayerByJersey,
  type PlayerResolutionRosterPlayer,
} from './playerResolution';

describe('playerResolution', () => {
  it('uses the operator-defined defensive position names and DB aliases', () => {
    expect(footballPositionKeys('Nose Guard')).toEqual(['NG']);
    expect(footballPositionKeys('Nose Tackle')).toEqual(['NT']);
    expect(footballPositionKeys('Wide Safety')).toEqual(['WS']);
    for (const position of ['MIKE', 'WILL', 'SPUR', 'NKL', 'RVR', 'Rover']) {
      expect(footballPositionKeys(position)).toEqual(['DB']);
      expect(getPositionPriorityAdvanced({ position })).toBe(getPositionPriorityAdvanced({ position: 'DB' }));
    }
  });

  it.each([
    'NG', 'MIKE', 'WILL', 'WS', 'SPUR', 'NKL', 'RVR',
    'DE', 'DT', 'NT', 'DL', 'MLB', 'OLB', 'ILB', 'LB', 'CB', 'DB', 'FS', 'SS', 'S',
    'LDE', 'RDE', 'SDE', 'WDE', 'EDGE', 'LDT', 'RDT', 'LOLB', 'ROLB', 'LILB', 'RILB',
    'SAM', 'JACK', 'LCB', 'RCB', 'NB', 'DIME',
    'Defensive End', 'Nose Guard', 'Nose Tackle', 'Weak-side Linebacker',
    'Wide Safety', 'Nickelback', 'Rover', 'Edge Rusher', 'Strong Safety',
    'Left Outside Linebacker', 'Right Cornerback', ' w.i.l.l ', 'LB/DB', 'WR / CB',
  ])('recognizes %s for defensive lookup without changing the saved label or choosing automatically', position => {
    const roster = [
      player('offense', 'H', '7', 'Receiver', { position: 'WR' }),
      player('defense', 'H', '7', 'Defender', { position }),
    ];
    const before = clone(roster);
    const result = resolvePlayerByJersey({ jerseyToken: '7', teamScope: 'H', actionContext: 'defense', roster });
    expect(result.kind).toBe('duplicate');
    if (result.kind === 'duplicate') {
      expect(result.recommended.playerId).toBe('defense');
      expect(result.candidates.map(candidate => candidate.playerId)).toEqual(['offense', 'defense']);
      expect(result.recommended.player.position).toBe(position);
    }
    const offense = resolvePlayerByJersey({ jerseyToken: '7', teamScope: 'H', actionContext: 'offense', roster });
    if (offense.kind === 'duplicate') expect(offense.recommended.playerId).toBe('offense');
    expect(roster).toEqual(before);
  });

  it('does not mistake unrelated position words for defensive labels', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '7', teamScope: 'H', actionContext: 'defense', roster: [
        player('receiver', 'H', '7', 'Receiver', { position: 'WR' }),
        player('unknown', 'H', '7', 'Unknown', { position: 'WILLIAM' }),
      ],
    });
    if (result.kind === 'duplicate') expect(result.recommended.playerId).toBe('receiver');
  });

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

  it('excludes inactive players centrally while preserving duplicate-jersey resolution for active players', () => {
    const result = resolvePlayerByJersey({
      jerseyToken: '3',
      teamScope: 'H',
      actionContext: 'offense',
      roster: [
        player('h-3-inactive', 'H', '3', 'Inactive Back', { position: 'RB', off_position: 'RB', active: false }),
        player('h-3-active', 'H', '3', 'Active Back', { position: 'RB', off_position: 'RB' }),
      ],
    });

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') expect(result.player.playerId).toBe('h-3-active');
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
    active?: boolean;
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

describe('unnamed roster entries', () => {
  it.each(['0', '99', '101', '12345678901234567890'])('accepts numeric jersey %s without inventing a name', jerseyToken => {
    const result = resolvePlayerByJersey({ jerseyToken, teamScope: 'H', actionContext: 'offense', roster: [], allowUnnamed: true });
    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') return;
    expect(result.player).toMatchObject({ jersey: jerseyToken, displayName: '', team: 'H' });
    expect(result.player.player).toMatchObject({ displayName: '', firstName: '', lastName: '', active: true });
    expect(result.resolution.source).toBe('rosterAdded');
  });
  it('keeps IDs separate by team and avoids an existing ID after a jersey correction', () => {
    const options = { jerseyToken: '99', actionContext: 'offense' as const, roster: [], allowUnnamed: true };
    const home = resolvePlayerByJersey({ ...options, teamScope: 'H' });
    const away = resolvePlayerByJersey({ ...options, teamScope: 'V' });
    if (home.kind !== 'resolved' || away.kind !== 'resolved') throw new Error('Expected players');
    expect(home.player.playerId).not.toBe(away.player.playerId);
    const corrected = resolvePlayerByJersey({ ...options, teamScope: 'H', roster: [{ ...home.player.player, jersey: '98' }] });
    if (corrected.kind !== 'resolved') throw new Error('Expected player');
    expect(corrected.player.playerId).not.toBe(home.player.playerId);
  });
  it('reuses the same unnamed player on later entries and preserves an inactive player identity', () => {
    const player = { playerId: 'existing', team: 'H', jersey: '99', displayName: '', active: false };
    const result = resolvePlayerByJersey({ jerseyToken: '99', teamScope: 'H', actionContext: 'offense', roster: [player], allowUnnamed: true });
    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') expect(result.player).toMatchObject({ playerId: 'existing', displayName: '' });
  });
  it.each(['', 'ABC', '-2', '1.5'])('still rejects a non-jersey token %s', jerseyToken => {
    const result = resolvePlayerByJersey({ jerseyToken, teamScope: 'H', actionContext: 'offense', roster: [], allowUnnamed: true });
    expect(result.kind).toBe('error');
  });
});
