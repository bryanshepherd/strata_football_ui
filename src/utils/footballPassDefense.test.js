import { describe, expect, it } from 'vitest';
import { repairFootballPassDefense } from './footballPassDefense';
import { buildFootballDefensiveStatsReport } from '../reports/footballDefensiveStats';
import { buildFootballMaxPrepsExports } from '../reports/footballMaxPrepsExport';
import { repairFootballPlayReadoutsInEnvelope } from '../play-editor/footballPlayEditEnvelope';

const fixture = () => ({
  gameId: 'FB-PASS-DEFENSE', game: { scheduledAt: '2026-09-12', teams: { H: { name: 'Home' }, V: { name: 'Visitor' } } },
  rosters: { teams: {
    H: { players: { offense: { playerId: 'offense', jersey: '13', displayName: 'Bryce Nutall' } } },
    V: { players: {
      breakup: { playerId: 'breakup', jersey: '13', displayName: 'Bryce Nutall' },
      duplicate: { playerId: 'duplicate', jersey: '13', displayName: 'Another Player' },
      hurry: { playerId: 'hurry', jersey: '91', displayName: 'William Vernon' },
      hurry2: { playerId: 'hurry2', jersey: '11', displayName: 'Zavion Lloyd' },
    } },
  } },
  events: [{ type: 'pass', subtype: 'incomplete', status: 'accepted', sequence: 1, possession: 'H',
    participants: { defenders: [] }, result: { code: 'incomplete', pass: { outcome: 'incomplete' } }, penalties: [],
    description: 'Pass incomplete, broken up by #13 Bryce Nutall, hurried by #91 William Vernon and #11 Zavion Lloyd.',
  }],
});

describe('recorded pass defense credits', () => {
  it('restores distinct breakup and hurry clauses using team, jersey and name without altering the supplied game', () => {
    const game = fixture();
    const before = JSON.stringify(game);
    const repaired = repairFootballPlayReadoutsInEnvelope(game);
    expect(repaired.events[0].result.pass).toMatchObject({ brokenUpByPlayerId: 'breakup', hurriedByPlayerIds: ['hurry', 'hurry2'] });
    expect(repaired.events[0].participants.defenders.map(actor => actor.playerId)).toEqual(['breakup', 'hurry', 'hurry2']);
    expect(repaired.events[0].description).toBe(game.events[0].description);
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
    expect(JSON.stringify(game)).toBe(before);
    const report = buildFootballDefensiveStatsReport(game);
    expect(report.teamReports.V.totals).toMatchObject({ breakups: 1, hurries: 2 });
    expect(report.teamReports.H.players).toHaveLength(0);
    expect(report.teamReports.V.players.map(player => player.playerId).sort()).toEqual(['breakup', 'hurry', 'hurry2']);
    const exported = buildFootballMaxPrepsExports(game).exports.V.players;
    expect(exported.find(player => player.playerId === 'breakup').values.PassesDefensed).toBe(1);
    expect(exported.find(player => player.playerId === 'hurry').values.QBHurries).toBe(1);
  });

  it('does not let legacy text override explicit corrections or cleared credits', () => {
    const game = fixture();
    const event = game.events[0];
    event.result.pass.brokenUpByPlayerId = null;
    event.result.pass.hurriedByPlayerIds = [];
    event.participants.defenders = [{ playerId: 'breakup', team: 'V', role: 'passBreakup' }, { playerId: 'hurry', team: 'V', role: 'hurry' }];
    expect(repairFootballPassDefense(game, event)).toBe(event);
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.players).toHaveLength(0);
    event.result.pass.brokenUpByPlayerId = 'duplicate';
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.players[0]).toMatchObject({ playerId: 'duplicate', breakups: 1 });
  });

  it('counts structured hurry roles, including a player who also broke up the pass, only once per statistic', () => {
    const game = fixture();
    game.events[0].description = '';
    game.events[0].participants.defenders = [
      { playerId: 'breakup', team: 'V', role: 'passBreakup' },
      { playerId: 'breakup', team: 'V', role: 'hurry' },
      { playerId: 'breakup', team: 'V', role: 'qbHurry' },
    ];
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.players[0]).toMatchObject({ breakups: 1, hurries: 1, total: 0 });
  });

  it('does not guess from an ambiguous name or jersey-only match, or consume penalty actors', () => {
    const game = fixture();
    game.rosters.teams.V.players.duplicate.displayName = 'Bryce Nutall';
    game.events[0].description = 'Pass incomplete, broken up by #13 Bryce Nutall, hurried by #91 Wrong Name, PENALTY VIS (#11 Zavion Lloyd).';
    expect(repairFootballPassDefense(game, game.events[0])).toBe(game.events[0]);
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.players).toHaveLength(0);
  });

  it('excludes deleted, historical and nullified plays while keeping declined penalties', () => {
    const game = fixture();
    const event = game.events[0];
    game.playHistory = [{ originalEvent: event }];
    game.events = [
      { ...event, status: 'deleted' },
      { ...event, sequence: 2, penalties: [{ status: 'accepted', enforcedFrom: 'previousSpot' }] },
      { ...event, sequence: 3, penalties: [{ status: 'declined', enforcedFrom: 'previousSpot' }] },
    ];
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.totals).toMatchObject({ breakups: 1, hurries: 2 });
  });
});
