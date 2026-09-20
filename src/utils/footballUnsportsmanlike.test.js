import { describe, expect, it } from 'vitest';
import { footballUnsportsmanlikeCounts, footballUnsportsmanlikeKey } from './footballUnsportsmanlike';

const foul = (overrides = {}) => ({ name: 'Unsportsmanlike Conduct', team: 'H', playerId: 'player-1', status: 'accepted', ...overrides });
describe('football unsportsmanlike discipline', () => {
  it('counts recorded fouls per team and player, including declined and offsetting enforcement', () => {
    const counts = footballUnsportsmanlikeCounts([
      { penalties: [foul(), foul({ status: 'declined' }), foul({ status: 'offsetting' })] },
      { penalties: [foul({ team: 'V' }), foul({ playerId: 'player-2' })] },
      { status: 'deleted', penalties: [foul()] },
      { penalties: [foul({ status: 'pending' }), foul({ playerId: null }), foul({ name: 'Personal Foul' })] },
    ]);
    expect(counts).toEqual({
      [footballUnsportsmanlikeKey('H', 'player-1')]: 3,
      [footballUnsportsmanlikeKey('V', 'player-1')]: 1,
      [footballUnsportsmanlikeKey('H', 'player-2')]: 1,
    });
  });
  it('rebuilds from the log instead of trusting previously stored totals', () => {
    expect(footballUnsportsmanlikeCounts([{ penalties: [foul({ unsportsmanlikeCount: 9 })] }]))
      .toEqual({ [footballUnsportsmanlikeKey('H', 'player-1')]: 1 });
  });
});
