import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballDuplicatePlayerModal from './FootballDuplicatePlayerModal';

describe('FootballDuplicatePlayerModal', () => {
  it('selects the recommended player when Enter is pressed', () => {
    const onSelect = vi.fn();
    render(
      <FootballDuplicatePlayerModal
        duplicate={{
          actionContext: 'offense',
          jerseyToken: '3',
          recommendedPlayerId: 'H-3-RB',
          candidates: [
            { playerId: 'H-3-WR', jersey: '3', displayName: 'Wide Receiver', position: 'WR' },
            { playerId: 'H-3-RB', jersey: '3', displayName: 'Running Back', position: 'RB' },
          ],
        }}
        onCancel={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('H-3-RB');
    expect(screen.getByRole('button', { name: /running back/i })).toHaveAttribute('data-default-player', 'true');
  });
});
