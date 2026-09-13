import { describe, expect, it } from 'vitest';
import { buildFootballParticipationReport } from './footballParticipationReport';

const fixture = () => ({
  gameId: 'FB-PARTICIPATION-REPORT',
  game: { scheduledAt: '2026-09-12T17:00:00Z', teams: { V: { name: 'Away' }, H: { name: 'Home' } } },
  rosters: { teams: {
    V: { players: Object.fromEntries([
      ['two-way', '0', { position: 'ATH', off_position: 'WR', def_position: 'CB' }],
      ['offense', '12', { position: 'QB' }],
      ['defense', '12', { position: 'LB' }],
      ['manual', '9', {}], ['actor', '2', {}], ['penalty', '8', {}],
      ['stats', '4', {}], ['special', '93', {}], ['unused', '20', {}],
      ['inactive-played', '', { active: false }], ['inactive-unused', '', { active: false }],
    ].map(([playerId, jersey, details]) => [playerId, { playerId, jersey, displayName: playerId, active: true, ...details }])) },
    H: { players: { home: { playerId: 'home', jersey: '2', displayName: 'Home Player' } } },
  } },
  pregame: { starters: {
    offense: { V: ['offense', 'two-way'], H: [] },
    defense: { V: ['two-way', 'defense'], H: [] },
    specialTeams: { V: ['special'], H: [] },
  } },
  participation: { manualPlayed: { V: ['manual', 'two-way', 'inactive-played'], H: ['home'] } },
  events: [{ status: 'accepted', participants: { holder: { playerId: 'actor' } }, penalties: [{ status: 'declined', playerId: 'penalty' }] }],
  stats: { players: { stats: { rushAttempts: 1, rushYards: 0 } } },
});

describe('Participation report', () => {
  it('preserves starter order, resolves unit positions, and prints two-way starters in each unit', () => {
    const report = buildFootballParticipationReport(fixture());
    expect(report.teamReports.V.starters.offense.map((p) => p.playerId)).toEqual(['offense', 'two-way']);
    expect(report.teamReports.V.starters.defense.map((p) => p.playerId)).toEqual(['two-way', 'defense']);
    expect(report.teamReports.V.starters.offense[1]).toMatchObject({ jersey: '0', position: 'WR' });
    expect(report.teamReports.V.starters.defense[0]).toMatchObject({ jersey: '0', position: 'CB' });
    expect(report.teamReports.V.starters.offense[0].position).toBe('QB');
    expect(report.teamReports.V.starters.defense[1].position).toBe('LB');
    expect(report.teamReports.V.total).toBe(9);
  });

  it('lists all other played players in jersey order without repeating the displayed starters', () => {
    const report = buildFootballParticipationReport(fixture());
    expect(report.teamReports.V.others.map((p) => p.playerId)).toEqual([
      'actor', 'stats', 'penalty', 'manual', 'special', 'inactive-played',
    ]);
    expect(report.teamReports.H.others.map((p) => p.playerId)).toEqual(['home']);
    expect(report.teamReports.H.total).toBe(1);
  });

  it('honors manual changes and current actors without reading overturned play history', () => {
    const game = fixture();
    game.participation.manualPlayed.V = [];
    game.events = [{ status: 'deleted', participants: { holder: { playerId: 'actor' } } }];
    game.playHistory = [{ originalEvent: { participants: { holder: { playerId: 'unused' } } } }];
    expect(buildFootballParticipationReport(game).teamReports.V.others.map((p) => p.playerId)).toEqual(['stats', 'special']);
  });

  it('handles empty units, legacy starter objects and duplicate starter references without mutating the game', () => {
    const game = fixture();
    game.pregame.starters.offense.V = ['offense', { playerId: 'offense' }, { playerId: 'missing', jersey: '77', displayName: 'Saved Starter', position: 'LT' }];
    game.pregame.starters.defense.V = [];
    const before = JSON.stringify(game);
    const report = buildFootballParticipationReport(game);
    expect(report.teamReports.V.starters.offense.map((p) => p.playerId)).toEqual(['offense', 'missing']);
    expect(report.teamReports.V.starters.offense[1]).toMatchObject({ name: 'Saved Starter', jersey: '77', position: 'LT' });
    expect(report.teamReports.H.starters.defense).toEqual([]);
    expect(JSON.stringify(game)).toBe(before);
  });

  it('keeps duplicate-number players separate and does not limit the participation list', () => {
    const game = fixture();
    game.pregame.starters = {};
    game.events = [];
    game.stats = {};
    game.rosters.teams.V.players = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`player-${index}`, {
      playerId: `player-${index}`, displayName: `Player ${index}`, jersey: '7',
    }]));
    game.participation.manualPlayed.V = Object.keys(game.rosters.teams.V.players);
    const report = buildFootballParticipationReport(game);
    expect(report.teamReports.V.others).toHaveLength(100);
    expect(new Set(report.teamReports.V.others.map((p) => p.playerId)).size).toBe(100);
  });
});
