import { describe, expect, it } from 'vitest';
import { resolvePlayerByJersey } from '../quick-input/playerResolution';
import { getGameEnvelopeFixture } from './footballGameEnvelopeFixtures';

function pregameRoster() {
  const envelope = getGameEnvelopeFixture('pregame');
  return ['V', 'H'].flatMap((team) => Object.values(envelope.rosters.teams[team].players));
}

describe('football pregame test rosters', () => {
  it('installs the supplied visitor and home teams without changing other fixtures', () => {
    const pregame = getGameEnvelopeFixture('pregame');
    const normal = getGameEnvelopeFixture('normal');

    expect(pregame.game.teams.V).toMatchObject({ teamId: 'TEAM-FAI', name: 'Fairmont St.', abbr: 'FAIR' });
    expect(pregame.game.teams.H).toMatchObject({ teamId: 'TEAM-WVS', name: 'West Virginia St.', abbr: 'WVSU' });
    expect(Object.keys(pregame.rosters.teams.V.players)).toHaveLength(53);
    expect(Object.keys(pregame.rosters.teams.H.players)).toHaveLength(59);
    expect(normal.game.teams.V.name).toBe('Visitor Tech');
    expect(normal.rosters.teams.H.players['H-22'].displayName).toBe('Jordan Smith');
  });

  it('keeps duplicate jersey identities and recommends the matching side of the ball', () => {
    const roster = pregameRoster();
    const fairmontOffense = resolvePlayerByJersey({
      jerseyToken: '11',
      teamScope: 'V',
      actionContext: 'offense',
      roster,
    });
    const fairmontDefense = resolvePlayerByJersey({
      jerseyToken: '11',
      teamScope: 'V',
      actionContext: 'defense',
      roster,
    });
    const westVirginiaOffense = resolvePlayerByJersey({
      jerseyToken: '1',
      teamScope: 'H',
      actionContext: 'offense',
      roster,
    });
    const westVirginiaDefense = resolvePlayerByJersey({
      jerseyToken: '1',
      teamScope: 'H',
      actionContext: 'defense',
      roster,
    });

    expect(fairmontOffense.kind).toBe('duplicate');
    expect(fairmontDefense.kind).toBe('duplicate');
    expect(westVirginiaOffense.kind).toBe('duplicate');
    expect(westVirginiaDefense.kind).toBe('duplicate');
    expect(fairmontOffense.recommended.player.displayName).toBe('Nino Marzullo');
    expect(fairmontDefense.recommended.player.displayName).toBe('Nick Longo');
    expect(westVirginiaOffense.recommended.player.displayName).toBe('Amare Ary');
    expect(westVirginiaDefense.recommended.player.displayName).toBe('Jacob Camacho');
  });

  it('assigns stable unique IDs to every XML player, including a player with no source code', () => {
    const pregame = getGameEnvelopeFixture('pregame');
    const roster = pregameRoster();
    const ids = roster.map((player) => player.playerId);

    expect(new Set(ids).size).toBe(112);
    expect(pregame.rosters.teams.H.players['H-45-TREY-TANNER']).toMatchObject({
      jersey: '45',
      displayName: 'Trey Tanner',
      def_position: 'CB',
    });
    expect(pregame.rosters.teams.V.jerseyIndex['11']).toEqual(['V-11', 'V-1A']);
    expect(pregame.rosters.teams.H.jerseyIndex['1']).toEqual(['H-1', 'H-1C']);
  });
});
