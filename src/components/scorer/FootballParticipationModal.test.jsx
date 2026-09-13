import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballParticipationModal from './FootballParticipationModal';

const fixture = () => ({
  game: { teams: { H: { name: 'Home' }, V: { name: 'Away' } } },
  rosters: { teams: { H: { players: Object.fromEntries(['starter', 'actor', 'penalty', 'stats', 'manual', 'inactive'].map((id) => [id, { playerId: id, jersey: '7', displayName: id, active: id !== 'inactive' }])) }, V: { players: {} } } },
  pregame: { starters: { offense: { H: ['starter'] } } },
  events: [{ participants: { holder: { playerId: 'actor' } }, penalties: [{ playerId: 'penalty' }] }],
  stats: { players: { stats: { rushAttempts: 1 } } },
});

describe('Participation modal', () => {
  it('lists active players, locks automatic participation, and saves manual selection only', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FootballParticipationModal envelope={fixture()} onSave={onSave} onClose={onClose} />);
    expect(screen.queryByRole('checkbox', { name: /inactive/ })).not.toBeInTheDocument();
    for (const id of ['starter', 'actor', 'penalty', 'stats']) {
      const checkbox = screen.getByRole('checkbox', { name: `Home #7 ${id} played` });
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    }
    const manual = screen.getByRole('checkbox', { name: 'Home #7 manual played' });
    expect(manual).not.toBeChecked();
    fireEvent.click(manual);
    fireEvent.click(screen.getByRole('button', { name: 'Save Participation' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ H: ['manual'], V: [] });
  });

  it('can clear a saved manual selection and cancel without saving or passing hotkeys to the scorer', () => {
    const game = fixture();
    game.participation = { manualPlayed: { H: ['manual'] } };
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<FootballParticipationModal envelope={game} onSave={onSave} onClose={onClose} />);
    const manual = screen.getByRole('checkbox', { name: 'Home #7 manual played' });
    expect(manual).toBeChecked();
    fireEvent.click(manual);
    expect(manual).not.toBeChecked();
    const scorerHotkey = vi.fn();
    window.addEventListener('keydown', scorerHotkey);
    fireEvent.keyDown(window, { key: 'r' });
    expect(scorerHotkey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', scorerHotkey);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the modal open and the selection intact if saving fails', async () => {
    const onClose = vi.fn();
    render(<FootballParticipationModal envelope={fixture()} onSave={vi.fn().mockRejectedValue(new Error('Storage failed'))} onClose={onClose} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Home #7 manual played' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Participation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage failed');
    expect(screen.getByRole('checkbox', { name: 'Home #7 manual played' })).toBeChecked();
    expect(onClose).not.toHaveBeenCalled();
  });
});
