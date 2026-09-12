import { describe, expect, it } from 'vitest';
import { resolveFootballUnknownPlayerText } from './footballUnknownPlayerReadout';

const rosterTeams = {
  V: { players: {
    qb: { playerId: 'qb', jersey: '4', displayName: 'Brandon Edinburgh Jr' },
    wr: { playerId: 'wr', jersey: '7', displayName: 'Davyn Reid' },
    de: { playerId: 'de', jersey: '7', displayName: 'Travis Burton' },
  } },
};
const play = {
  type: 'pass', subtype: 'complete',
  participants: { primary: { playerId: 'qb' }, receiver: { playerId: 'wr' } },
};

describe('recorded unknown-player readouts', () => {
  it('resolves both players by ID despite duplicate jersey numbers and preserves every other word', () => {
    const text = 'LIV Unknown Player pass complete to unknown player for 39 yards for a touchdown.';
    const before = JSON.stringify({ play, rosterTeams });
    expect(resolveFootballUnknownPlayerText(play, text, rosterTeams)).toBe('LIV #4 Brandon Edinburgh Jr pass complete to #7 Davyn Reid for 39 yards for a touchdown.');
    expect(JSON.stringify({ play, rosterTeams })).toBe(before);
  });

  it('preserves unresolved players and does not infer an identity from a jersey', () => {
    const missing = { ...play, participants: { primary: { playerId: 'missing', jersey: '4' }, receiver: { playerId: 'wr' } } };
    expect(resolveFootballUnknownPlayerText(missing, 'unknown player pass complete to unknown player for 39 yards.', rosterTeams))
      .toBe('unknown player pass complete to #7 Davyn Reid for 39 yards.');
  });

  it('resolves rushers, kick returners and recoverers without changing yardage or penalties', () => {
    const event = { participants: { primary: { playerId: 'qb' }, returner: { playerId: 'wr' } }, result: { fumble: { recoveredByPlayerId: 'de' } } };
    expect(resolveFootballUnknownPlayerText(event, 'unknown player rush for 3 yards, fumbled, recovered by unknown player.', rosterTeams))
      .toBe('#4 Brandon Edinburgh Jr rush for 3 yards, fumbled, recovered by #7 Travis Burton.');
    expect(resolveFootballUnknownPlayerText(event, 'unknown player kickoff 65 yards, unknown player return for 20 yards, PENALTY LIV Holding.', rosterTeams))
      .toBe('#4 Brandon Edinburgh Jr kickoff 65 yards, #7 Davyn Reid return for 20 yards, PENALTY LIV Holding.');
  });

  it('leaves normal descriptions and ambiguous multi-defender placeholders alone', () => {
    const text = 'Original wording without a placeholder.';
    expect(resolveFootballUnknownPlayerText(play, text, rosterTeams)).toBe(text);
    const event = { participants: { defenders: [{ playerId: 'wr', role: 'tackler' }, { playerId: 'de', role: 'tackler' }] } };
    expect(resolveFootballUnknownPlayerText(event, 'tackled by unknown player.', rosterTeams)).toBe('tackled by unknown player.');
  });
});
