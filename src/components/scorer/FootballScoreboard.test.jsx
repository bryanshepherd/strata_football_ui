import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FootballScoreboard from './FootballScoreboard';
import { getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';

describe('FootballScoreboard', () => {
  it('displays the explicit awaiting-kickoff lifecycle while game status remains pregame', () => {
    const fixture = getGameEnvelopeFixture('pregame');
    const envelope = {
      ...fixture,
      game: { ...fixture.game, status: 'pregame' },
      pregame: { gamePhase: 'awaitingKickoff' },
    };

    render(<FootballScoreboard envelope={envelope} />);

    expect(screen.getByText('Awaiting Kickoff')).toBeInTheDocument();
  });

  it('keeps drive context in the same strip as down and distance', () => {
    render(<FootballScoreboard envelope={getGameEnvelopeFixture('normal')} />);

    expect(screen.getByText('8:42')).toBeInTheDocument();
    expect(screen.queryByText('08:42')).not.toBeInTheDocument();
    expect(screen.getByText('Down/Distance')).toBeInTheDocument();
    expect(screen.getByText('Spot')).toBeInTheDocument();
    expect(screen.getByText('Line To Gain')).toBeInTheDocument();
    expect(screen.getByText('Drive')).toBeInTheDocument();
    expect(screen.getByText('DRV-0002 · Active')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Plays')).toBeInTheDocument();
    expect(screen.getByText('Yards')).toBeInTheDocument();
  });

  it('shows timeout ovals and challenge circles as filled availability or empty spent indicators', () => {
    const fixture = getGameEnvelopeFixture('normal');
    const envelope = {
      ...fixture,
      game: {
        ...fixture.game,
        rules: { ...fixture.game.rules, timeouts: 3, challenges: 2 },
      },
      liveState: {
        ...fixture.liveState,
        timeouts: { V: 2, H: 1 },
        challenges: { V: 1, H: 0 },
      },
    };

    render(<FootballScoreboard envelope={envelope} />);

    expect(screen.getByLabelText('V timeout 1 available')).toHaveClass('h-4', 'w-8', 'rounded-full', 'bg-emerald-500');
    expect(screen.getByLabelText('V timeout 3 used')).toHaveClass('h-4', 'w-8', 'rounded-full', 'border-emerald-600', 'bg-white');
    expect(screen.getByLabelText('V challenge 1 available')).toHaveClass('h-4', 'w-4', 'rounded-full', 'bg-red-500');
    expect(screen.getByLabelText('V challenge 2 unavailable')).toHaveClass('h-4', 'w-4', 'rounded-full', 'border-red-600', 'bg-white');
    expect(screen.getByLabelText('H challenge 1 unavailable')).toHaveClass('border-red-600', 'bg-white');
  });
});
