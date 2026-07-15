import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPregameWorkspace from './FootballPregameWorkspace';
import { getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';

const envelope = () => getGameEnvelopeFixture('pregame');

describe('FootballPregameWorkspace', () => {
  it('keeps roster, starter, and toss tools reachable from the scorer workspace', () => {
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Pregame workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Starters' }));
    expect(screen.getByText(/Special teams starters/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Coin Toss' }));
    expect(screen.getByText(/Toss summary/i)).toBeInTheDocument();
  });

  it('supports optional blank-enter captain completion without adding a player', () => {
    const onEnvelopeChange = vi.fn();
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={onEnvelopeChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Coin Toss' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Review / edit' })[0]);
    fireEvent.submit(screen.getByRole('button', { name: 'Enter' }).closest('form'));
    expect(onEnvelopeChange).toHaveBeenCalled();
    expect(screen.getAllByText('No captains recorded')).toHaveLength(2);
  });
});
