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

    expect(screen.getByText('awaiting Kickoff')).toBeInTheDocument();
  });
});
