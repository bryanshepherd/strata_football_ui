import { describe, expect, it } from 'vitest';
import { repairFootballPassDefense } from './footballPassDefense';
import { buildFootballDefensiveStatsReport } from '../reports/footballDefensiveStats';
import { buildFootballMaxPrepsExports } from '../reports/footballMaxPrepsExport';
import { footballParticipationForEnvelope } from './footballParticipation';
import { applyFootballPlayEditToEnvelope, repairFootballPlayReadoutsInEnvelope } from '../play-editor/footballPlayEditEnvelope';

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

const completionFixture = (description = 'Pass complete, tackled by #13 Bryce Nutall and #91 William Vernon.') => {
  const game = fixture();
  game.game.status = 'final';
  game.game.teams.H.score = 30; game.game.teams.V.score = 44;
  game.events[0] = { ...game.events[0], subtype: 'complete', period: 1, clock: '10:00',
    preState: { possession: 'H', down: 1, distance: 10, yardLine: 'H40', driveId: 'D1' },
    result: { code: 'complete', pass: { outcome: 'complete' }, yards: -3, endYardLine: 'H37' }, description };
  return game;
};

describe('completed-pass defensive recovery', () => {
  it('restores shared tackles, loss yards and participation without changing the saved final game', () => {
    const game = completionFixture(); const before = JSON.stringify(game);
    const repaired = repairFootballPlayReadoutsInEnvelope(game);
    expect(repaired.events[0].participants.defenders.map(actor => actor.playerId)).toEqual(['breakup', 'hurry']);
    expect(repaired.events[0].result.passDefenseRecorded).toBe(true);
    expect(repaired.events[0].preState).toEqual(game.events[0].preState);
    expect(repaired.events[0].description).toBe(game.events[0].description);
    expect(repaired.game).toBe(game.game);
    expect(repairFootballPlayReadoutsInEnvelope(repaired)).toBe(repaired);
    const report = buildFootballDefensiveStatsReport(game).teamReports.V;
    expect(report.totals).toMatchObject({ solo: 0, assists: 2, total: 2, tfl: 1, tflYards: 3 });
    expect(footballParticipationForEnvelope(game).V.breakup).toMatchObject({ played: true, locked: true });
    expect(footballParticipationForEnvelope(game).V.hurry).toMatchObject({ played: true, locked: true });
    expect(JSON.stringify(game)).toBe(before);
  });

  it('keeps penalty actors out of the tackle clause', () => {
    const game = completionFixture('Pass complete, tackled by #13 Bryce Nutall, PENALTY VIS (#91 William Vernon).');
    expect(repairFootballPassDefense(game, game.events[0]).participants.defenders.map(actor => actor.playerId)).toEqual(['breakup']);
  });

  it.each([
    'Pass complete, tackled by #13 Bryce Nutall and #91 Wrong Name.',
    'Pass complete, tackled by unknown player and #13 Bryce Nutall.',
  ])('does not convert an unresolved shared tackle into solo credit: %s', description => {
    const game = completionFixture(description);
    expect(repairFootballPassDefense(game, game.events[0])).toBe(game.events[0]);
  });

  it('respects recorded actors, ambiguous identities, deleted plays and explicitly empty selections', () => {
    const game = completionFixture(); const event = game.events[0];
    for (const candidate of [
      { ...event, result: { ...event.result, passDefenseRecorded: true } },
      { ...event, status: 'deleted' },
      { ...event, participants: { defenders: [{ playerId: 'hurry2', team: 'V', role: 'tackler' }] } },
    ]) expect(repairFootballPassDefense(game, candidate)).toBe(candidate);
    game.rosters.teams.V.players.duplicate.displayName = 'Bryce Nutall';
    expect(repairFootballPassDefense(game, event)).toBe(event);
  });

  it('preserves an operator removal on subsequent report generation and reload', () => {
    const game = repairFootballPlayReadoutsInEnvelope(completionFixture());
    const edited = structuredClone(game.events[0]); edited.participants.defenders = [];
    const saved = applyFootballPlayEditToEnvelope(game, edited);
    // Even old text cannot resurrect a deliberately cleared actor list.
    saved.events[0].description = game.events[0].description;
    expect(saved.events[0].result.passDefenseRecorded).toBe(true);
    expect(repairFootballPlayReadoutsInEnvelope(saved).events[0].participants.defenders).toEqual([]);
    expect(buildFootballDefensiveStatsReport(saved).teamReports.V.players).toHaveLength(0);
    expect(footballParticipationForEnvelope(saved).V.breakup.played).toBe(false);
  });

  it('continues to exclude nullified completions from stats while retaining declined-penalty tackles', () => {
    const game = completionFixture(); const event = game.events[0];
    game.events = [{ ...event, penalties: [{ status: 'accepted', enforcedFrom: 'previousSpot' }] },
      { ...event, sequence: 2, penalties: [{ status: 'declined', enforcedFrom: 'previousSpot' }] }];
    expect(buildFootballDefensiveStatsReport(game).teamReports.V.totals).toMatchObject({ assists: 2, total: 2, tfl: 1 });
  });
});
