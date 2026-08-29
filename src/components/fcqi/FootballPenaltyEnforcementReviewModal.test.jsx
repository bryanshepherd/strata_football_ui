import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPenaltyEnforcementReviewModal from './FootballPenaltyEnforcementReviewModal';

describe('FootballPenaltyEnforcementReviewModal', () => {
  it('reorders fouls and submits one verified official state', () => {
    const onConfirm = vi.fn();
    render(
      <FootballPenaltyEnforcementReviewModal
        draft={draft()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        teamAliases={{ H: 'H', V: 'V' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Set Enforcement Order' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move personal foul earlier/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText('Down'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Ball Spot'), { target: { value: 'V45' } });
    fireEvent.click(screen.getByRole('button', { name: /first down awarded/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Play' }));

    expect(onConfirm).toHaveBeenCalledWith({
      enforcementOrder: ['pf-2', 'hold-1'],
      down: 1,
      distance: 10,
      yardLine: 'V45',
      firstDownAwarded: true,
    });
  });
});

const draft = () => ({
  game: { rules: { downs: 4, yardsToFirstDown: 10 } },
  play: { actionTeam: 'H', possession: 'H' },
  prePlay: { possession: 'H', down: 2, distance: 10, yardLine: 'H40', lineToGain: '50' },
  participants: { defenders: [], penalizedPlayers: [], others: [] },
  result: { code: 'tackle', yards: 8, endYardLine: 'H48' },
  penalties: [
    {
      penaltyId: 'hold-1', team: 'H', name: 'Holding', code: 'HOLD', status: 'accepted', resolution: 'accepted', accepted: true,
      liveBall: true, deadBall: false, enforcedFrom: 'PREVIOUS', yards: -10, finalSpot: 'H30', replayDown: true,
    },
    {
      penaltyId: 'pf-2', team: 'V', name: 'Personal Foul', code: 'PF', status: 'accepted', resolution: 'accepted', accepted: true,
      liveBall: false, deadBall: true, enforcedFrom: 'END', yards: 15, finalSpot: 'V37', downCounts: true,
    },
  ],
});
