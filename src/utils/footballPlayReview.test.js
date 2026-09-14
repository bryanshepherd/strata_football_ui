import { describe, expect, it } from 'vitest';
import { buildFootballPlayReview, footballReviewContext, isEditableFootballReviewEvent } from './footballPlayReview';

export const reviewFixture = () => ({
  gameId: 'FB-REVIEW', game: { teams: { V: { name: 'Away', abbr: 'AWY' }, H: { name: 'Home', abbr: 'HOM' } }, rules: { periods: 4 } },
  rosters: { teams: {
    H: { players: { passer: { displayName: 'Home Passer', jersey: '7' }, target: { displayName: 'Home Target', jersey: '7' }, holder: { displayName: 'Home Holder', jersey: '9' } } },
    V: { players: { hurry: { displayName: 'Away Defender', jersey: '7' }, foul: { displayName: 'Away Foul', jersey: '22' } } },
  } },
  events: [
    { eventId: 'pass', sequence: 1, type: 'pass', subtype: 'incomplete', period: 1, clock: '10:00', possession: 'H',
      preState: { possession: 'H', down: 1, distance: 10, yardLine: 'H30' },
      description: 'Home Passer incomplete to Home Target.',
      participants: { primary: { playerId: 'passer', team: 'H', role: 'passer' }, secondary: { playerId: 'target', team: 'H', role: 'intendedReceiver' } },
      result: { pass: { targetPlayerId: 'target', hurriedByPlayerIds: ['hurry', 'hurry'] } },
      penalties: [{ playerId: 'foul', team: 'V', status: 'declined', code: 'HOLD' }],
    },
    { eventId: 'kick', sequence: 2, type: 'try', subtype: 'kick', period: 5, clock: '', possession: 'H',
      participants: { holder: { playerId: 'holder', team: 'H', role: 'holder' } }, result: {}, description: 'Kick missed.', penalties: [] },
  ],
});

describe('Play review index', () => {
  it('includes targets, result-only hurries, penalty actors and no-stat holders once per play by ID', () => {
    const game = reviewFixture(); const before = JSON.stringify(game);
    const review = buildFootballPlayReview(game);
    expect([...review.rows[0].involvement.keys()]).toEqual(['passer', 'target', 'hurry', 'foul']);
    expect([...review.rows[0].involvement.get('target')]).toEqual(['Target']);
    expect([...review.rows[0].involvement.get('hurry')]).toEqual(['QB hurry']);
    expect([...review.rows[0].involvement.get('foul')]).toEqual(['Penalty']);
    expect(review.players.filter(player => player.jersey === '7')).toHaveLength(3);
    expect(review.players.every(player => player.playCount === 1)).toBe(true);
    expect(footballReviewContext(game, game.events[1])).toMatch(/^OT1 ·/);
    expect(JSON.stringify(game)).toBe(before);
  });
  it('includes nullified-play actors, nested laterals and recoverers without treating TEAM as a player', () => {
    const game = reviewFixture();
    game.events[0].result = { laterals: [{ fromPlayerId: 'passer', toPlayerId: 'target' }], fumble: { fumblerPlayerId: 'target', recoveredByPlayerId: 'TM', recoveredByTeam: 'H' } };
    game.events[0].penalties[0] = { playerId: 'foul', status: 'accepted', enforcedFrom: 'previousSpot' };
    game.events[1].result = { blockedByPlayerId: 'hurry' };
    const review = buildFootballPlayReview(game);
    expect([...review.rows[0].involvement.get('target')]).toContain('Fumble');
    expect([...review.rows[0].involvement.get('target')]).toContain('Lateral receiver');
    expect(review.rows[0].involvement.has('foul')).toBe(true);
    expect(review.rows[1].involvement.has('hurry')).toBe(true);
    expect(review.players.some(player => player.playerId === 'TM')).toBe(false);
  });
  it('excludes deleted/history records and incidental names and uses current corrected actors', () => {
    const game = reviewFixture();
    game.events[0].description += ' Home Holder on the sideline.';
    game.events.push({ ...game.events[0], eventId: 'deleted', sequence: 3, status: 'deleted' });
    game.playHistory = [{ originalEvent: game.events[1] }];
    const first = buildFootballPlayReview(game);
    expect(first.rows).toHaveLength(2);
    expect(first.rows[0].involvement.has('holder')).toBe(false);
    game.events[0].participants.secondary.playerId = 'holder';
    game.events[0].result.pass.targetPlayerId = 'holder';
    const next = buildFootballPlayReview(game);
    expect(next.players.find(player => player.playerId === 'target').playCount).toBe(0);
    expect(next.rows[0].involvement.has('holder')).toBe(true);
    expect(isEditableFootballReviewEvent({ type: 'gameControl', result: { gameControl: { action: 'endGame' } } })).toBe(false);
    expect(isEditableFootballReviewEvent({ type: 'rush' })).toBe(true);
  });
});
