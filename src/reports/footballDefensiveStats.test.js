import { describe, expect, it } from 'vitest';
import { buildFootballDefensiveStatsReport, formatDefensiveStatYards } from './footballDefensiveStats';

const actor = (playerId, role, team = 'V') => ({ playerId, role, team });
const fixture = (events) => ({
  gameId: 'FB-DEFENSE-TEST',
  game: { scheduledAt: '2026-09-12T17:00:00Z', teams: { V: { name: 'Visitor' }, H: { name: 'Home' } } },
  rosters: { teams: {
    V: { players: Object.fromEntries(['solo', 'shared', 'assist', 'recovery', 'force', 'intercept', 'breakup', 'block', 'hurry', 'unused'].map((id, index) => [id, {
      playerId: id, displayName: `${id} Player`, jersey: id === 'hurry' ? '' : String(index),
    }])) },
    H: { players: { home: { playerId: 'home', displayName: 'Home Player', jersey: '25' } } },
  } },
  events: events.map((event, index) => ({ sequence: index + 1, status: 'accepted', possession: 'H', penalties: [], ...event })),
});
const tackle = (defenders, yards = 4) => ({ type: 'rush', participants: { defenders }, result: { yards } });

describe('Defensive Stats report', () => {
  it('puts a defensive team recovery on TEAM and excludes retained offensive fumbles', () => {
    const envelope = fixture(['H', 'V'].map(recoveredByTeam => ({
      type: 'rush', participants: { primary: actor('home', 'rusher', 'H') },
      result: { fumble: { fumblerPlayerId: 'home', recoveredByPlayerId: 'TM', recoveredByTeam } },
    })));
    const before = structuredClone(envelope);
    const report = buildFootballDefensiveStatsReport(envelope);
    expect(report.teamReports.H.players).toEqual([]);
    expect(report.teamReports.V.players).toHaveLength(1);
    expect(report.teamReports.V.players[0]).toMatchObject({ name: 'TEAM', jersey: 'TM', recoveries: 1, recoveryYards: 0 });
    expect(envelope).toEqual(before);
  });
  it('sorts all qualifying players by tackles and keeps zero-tackle defenders and missing numbers', () => {
    const envelope = fixture([
      tackle([actor('solo', 'tackler')]),
      tackle([actor('solo', 'tackler'), actor('assist', 'assistTackler')]),
      { type: 'pass', participants: { defenders: [actor('hurry', 'qbHurry')] }, result: { pass: { hurriedByPlayerIds: ['hurry'] } } },
      tackle([actor('home', 'tackler', 'H')]),
    ]);
    const report = buildFootballDefensiveStatsReport(envelope);
    expect(report.teamReports.V.players.map((p) => p.playerId)).toEqual(['solo', 'assist', 'hurry']);
    expect(report.teamReports.V.players[0]).toMatchObject({ jersey: '0', solo: 2, assists: 0, total: 2 });
    expect(report.teamReports.V.players[2]).toMatchObject({ jersey: '', total: 0, hurries: 1 });
    expect(report.teamReports.H.players.map((p) => p.playerId)).toEqual(['home']);
    expect(report.teamReports.V.totals).toMatchObject({ solo: 2, assists: 1, total: 3, hurries: 1 });
  });

  it('preserves shared sack and loss yardage without double counting duplicate actors', () => {
    const report = buildFootballDefensiveStatsReport(fixture([
      { type: 'pass', subtype: 'sack', result: { yards: -7, pass: { outcome: 'sack' } }, participants: {
        defenders: [actor('solo', 'sack'), actor('shared', 'sack'), actor('solo', 'sack')],
      } },
      tackle([actor('solo', 'tackler'), actor('assist', 'assistTackler')], -3),
    ]));
    const solo = report.teamReports.V.players.find((p) => p.playerId === 'solo');
    expect(solo).toMatchObject({ solo: 1, assists: 1, total: 2, sacks: 0.5, sackYards: 4, tfl: 1, tflYards: 6 });
    expect(report.teamReports.V.totals).toMatchObject({ sacks: 1, sackYards: 7, tfl: 2, tflYards: 10 });
    expect(formatDefensiveStatYards(solo.sacks, solo.sackYards)).toBe('0.5-4');
  });

  it('credits recoveries, forced fumbles, interceptions, breakups and every kind of blocked kick', () => {
    const report = buildFootballDefensiveStatsReport(fixture([
      { type: 'rush', participants: { forcedBy: actor('force', 'forcedFumble'), recoveredBy: actor('recovery', 'recoverer'), fumbler: actor('home', 'fumbler', 'H') }, result: {
        fumble: { recoveredByTeam: 'V', returnYards: 92 },
      } },
      { type: 'pass', subtype: 'interception', participants: { interceptor: actor('intercept', 'interceptor') }, result: { turnover: { returnYards: 95 } } },
      { type: 'pass', participants: { defenders: [actor('breakup', 'passBreakup')] }, result: { pass: { brokenUpByPlayerId: 'breakup' } } },
      ...['punt', 'fieldGoal', 'try'].map((type) => ({ type, participants: { defenders: [actor('block', 'blocker')] }, result: { kick: { blockedByPlayerId: 'block' } } })),
      // An offense recovering its own fumble is not a defensive recovery.
      { type: 'rush', participants: { recoveredBy: actor('home', 'recoverer', 'H'), fumbler: actor('home', 'fumbler', 'H') }, result: { fumble: { recoveredByTeam: 'H' } } },
    ]));
    expect(report.teamReports.V.totals).toMatchObject({ total: 0, forcedFumbles: 1, recoveries: 1, recoveryYards: 92, interceptions: 1, interceptionYards: 95, breakups: 1, blocks: 3 });
    expect(report.teamReports.V.players).toHaveLength(5);
    expect(report.teamReports.H.players).toHaveLength(0);
  });

  it('excludes deleted, nullified, historical and cached statistics', () => {
    const play = tackle([actor('solo', 'tackler')]);
    const envelope = fixture([
      play, { ...play, status: 'deleted' },
      { ...play, penalties: [{ status: 'accepted', enforcedFrom: 'previous' }] },
    ]);
    envelope.playHistory = [{ originalEvent: play }];
    envelope.stats = { players: { solo: { playerId: 'solo', team: 'V', Tackles: 99 }, unused: { playerId: 'unused', team: 'V', sacks: 4 } } };
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.V.totals.total).toBe(1);
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.V.players).toHaveLength(1);
  });

  it('does not apply a leader limit', () => {
    const envelope = fixture(Array.from({ length: 80 }, (_, index) => tackle([{
      ...actor(`player-${index}`, 'tackler'), displayName: `Player ${index}`, jersey: String(index),
    }])));
    expect(buildFootballDefensiveStatsReport(envelope).teamReports.V.players).toHaveLength(80);
  });
});
