import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPlayReviewModal from './FootballPlayReviewModal';

const fixture = () => ({
  gameId: 'review', game: { teams: { V: { name: 'Away' }, H: { name: 'Home' } } },
  rosters: { teams: { V: { players: { one: { displayName: 'First Player', jersey: '7' }, two: { displayName: 'Second Player', jersey: '7' } } } } },
  events: Array.from({ length: 25 }, (_, index) => ({
    eventId: `play-${index}`, sequence: index + 1, type: 'rush', possession: 'V', period: index < 12 ? 1 : 4,
    description: `First Player rush ${index + 1}.`, participants: { primary: { playerId: 'one', team: 'V', role: 'rusher' } }, result: {}, penalties: [],
  })),
});

describe('Review Plays window', () => {
  it('searches the entire game and selects a duplicate-number player by name', () => {
    render(<FootballPlayReviewModal envelope={fixture()} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByLabelText('Review play 25')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search plays'), { target: { value: '#2' } });
    expect(screen.getByLabelText('Reviewed plays').querySelectorAll('li')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Search plays'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'By Player' }));
    fireEvent.click(screen.getByRole('button', { name: /Second Player/ }));
    expect(screen.getByText('No recorded plays to show.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /First Player/ }));
    expect(screen.getByLabelText('Reviewed plays').querySelectorAll('li')).toHaveLength(25);
    expect(screen.getAllByText('Rusher')).toHaveLength(25);
  });
  it('retains filters and scroll after edit and refreshes changed player involvement', () => {
    const game = fixture(); const onEdit = vi.fn();
    const props = { envelope: game, onClose: vi.fn(), onEdit };
    const { rerender } = render(<FootballPlayReviewModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'By Player' }));
    fireEvent.click(screen.getByRole('button', { name: /First Player/ }));
    const list = screen.getByLabelText('Reviewed plays');
    list.scrollTop = 450; fireEvent.scroll(list);
    fireEvent.click(screen.getByRole('button', { name: 'Edit reviewed play 20' }));
    expect(onEdit).toHaveBeenCalledWith(game.events[19]);
    rerender(<FootballPlayReviewModal {...props} hidden />);
    const changed = structuredClone(game); changed.events[19].participants.primary.playerId = 'two';
    rerender(<FootballPlayReviewModal {...props} envelope={changed} />);
    expect(screen.getByRole('button', { name: /First Player/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Review play 20')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reviewed plays').scrollTop).toBe(450);
    fireEvent.click(screen.getByRole('button', { name: /Second Player/ }));
    expect(screen.getByLabelText('Review play 20')).toBeInTheDocument();
  });
  it('owns Escape and Tab and keeps game-control history read-only', () => {
    const game = fixture(); game.events[0].type = 'gameControl';
    const onClose = vi.fn(); const hotkey = vi.fn(); window.addEventListener('keydown', hotkey);
    try {
      render(<FootballPlayReviewModal envelope={game} onClose={onClose} onEdit={vi.fn()} />);
      expect(within(screen.getByLabelText('Review play 1')).queryByRole('button')).not.toBeInTheDocument();
      const close = screen.getByRole('button', { name: 'Close' }); close.focus();
      fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit reviewed play 25' }));
      fireEvent.keyDown(screen.getByLabelText('Search plays'), { key: 'g' });
      expect(hotkey).not.toHaveBeenCalled();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('keydown', hotkey); }
  });
});
