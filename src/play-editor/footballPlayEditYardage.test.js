import { describe, expect, it } from 'vitest';
import {
  calculateEditedPenaltyYards,
  penaltyEnforcementBasisSpot,
  recalculatePlayEditorPenaltyYards,
} from './footballPlayEditYardage';

const play = {
  possession: 'V',
  preState: { possession: 'V', yardLine: 'H46' },
  result: { endYardLine: 'H42' },
  penalties: [],
};

describe('footballPlayEditYardage', () => {
  it.each(['H', 'V'])('retains five-yard previous-spot enforcement when a %s kickoff has no possession', (team) => {
    const kickoff = { type: 'kickoff', possession: null, preState: { possession: null, yardLine: `${team}35` }, participants: { kicker: { team } } };
    const penalty = { status: 'accepted', enforcedFrom: 'previousSpot', finalSpot: `${team}30`, yards: 5 };
    expect(calculateEditedPenaltyYards(kickoff, penalty)).toBe(5);
    expect(recalculatePlayEditorPenaltyYards({ ...kickoff, penalties: [penalty] }).penalties[0].yards).toBe(5);
  });

  it('measures explicit spots across midfield without possession but leaves ambiguous goal-line enforcement unresolved', () => {
    expect(calculateEditedPenaltyYards({ preState: { yardLine: 'H45' } }, { status: 'accepted', enforcedFrom: 'previousSpot', finalSpot: 'V45' })).toBe(10);
    expect(calculateEditedPenaltyYards({ preState: { yardLine: 'H05' } }, { status: 'accepted', enforcedFrom: 'previousSpot', finalSpot: 'goal' })).toBeNull();
  });

  it('derives end-of-play penalty yards from the play end spot', () => {
    expect(calculateEditedPenaltyYards(play, {
      status: 'accepted',
      enforcedFrom: 'endOfPlay',
      finalSpot: 'H27',
    })).toBe(15);
  });

  it('derives previous-spot and spot-of-foul enforcement yards', () => {
    expect(calculateEditedPenaltyYards(play, {
      status: 'accepted',
      enforcedFrom: 'previousSpot',
      finalSpot: 'H40',
    })).toBe(6);
    expect(calculateEditedPenaltyYards(play, {
      status: 'accepted',
      enforcedFrom: 'spotOfFoul',
      spotOfFoul: 'H30',
      finalSpot: 'H20',
    })).toBe(10);
  });

  it('stores the absolute statistical distance for offensive penalties', () => {
    const offensivePlay = {
      ...play,
      possession: 'H',
      preState: { possession: 'H', yardLine: 'H27' },
    };
    expect(calculateEditedPenaltyYards(offensivePlay, {
      status: 'accepted',
      enforcedFrom: 'previousSpot',
      finalSpot: 'H14',
    })).toBe(13);
  });

  it('sets declined and offsetting penalties to zero', () => {
    expect(calculateEditedPenaltyYards(play, { status: 'declined' })).toBe(0);
    expect(calculateEditedPenaltyYards(play, { status: 'offsetting' })).toBe(0);
  });

  it('uses the prior accepted final spot for succeeding-spot enforcement', () => {
    const twoPenaltyPlay = {
      ...play,
      penalties: [
        { status: 'accepted', finalSpot: 'H32' },
        { status: 'accepted', enforcedFrom: 'succeedingSpot', finalSpot: 'H27' },
      ],
    };
    expect(penaltyEnforcementBasisSpot(twoPenaltyPlay, twoPenaltyPlay.penalties[1], 1)).toBe('H32');
    expect(calculateEditedPenaltyYards(twoPenaltyPlay, twoPenaltyPlay.penalties[1], 1)).toBe(5);
  });

  it('recalculates every penalty without mutating the source play', () => {
    const source = {
      ...play,
      penalties: [{ status: 'accepted', enforcedFrom: 'endOfPlay', finalSpot: 'H27', yards: 0 }],
    };
    const recalculated = recalculatePlayEditorPenaltyYards(source);

    expect(recalculated.penalties[0].yards).toBe(15);
    expect(source.penalties[0].yards).toBe(0);
  });
});
