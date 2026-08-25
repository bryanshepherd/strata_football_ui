import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPossessionClockModal from './FootballPossessionClockModal';

describe('FootballPossessionClockModal', () => {
  it('formats four typed digits as a game clock and records the reading', () => {
    const onSave = vi.fn();
    render(
      <FootballPossessionClockModal
        change={{ previousPossession: 'H', nextPossession: 'V', defaultClock: '' }}
        envelope={{ game: { teams: { H: { name: 'Home State' }, V: { name: 'Visitor Tech' } } } }}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText('Game Clock');
    expect(input).toHaveAttribute('placeholder', 'M:SS or MM:SS');
    fireEvent.change(input, { target: { value: '1454' } });
    expect(input).toHaveValue('14:54');
    fireEvent.submit(input.closest('form'));

    expect(onSave).toHaveBeenCalledWith('14:54');
    expect(screen.queryByText(/closes the previous possession timestamp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No active possession/i)).not.toBeInTheDocument();
  });

  it('continues to normalize a clock entered with a colon', () => {
    const onSave = vi.fn();
    render(
      <FootballPossessionClockModal
        change={{ previousPossession: 'H', nextPossession: 'V', defaultClock: '08:42' }}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText('Game Clock');
    fireEvent.change(input, { target: { value: '7:05' } });
    expect(input).toHaveValue('7:05');
    fireEvent.submit(input.closest('form'));

    expect(onSave).toHaveBeenCalledWith('07:05');
  });

  it('accepts three digits or an optional typed leading zero and drops that zero from display', () => {
    const onSave = vi.fn();
    render(
      <FootballPossessionClockModal
        change={{ previousPossession: 'H', nextPossession: 'V', defaultClock: '' }}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText('Game Clock');
    fireEvent.change(input, { target: { value: '801' } });
    expect(input).toHaveValue('8:01');
    fireEvent.submit(input.closest('form'));
    expect(onSave).toHaveBeenLastCalledWith('08:01');

    fireEvent.change(input, { target: { value: '0801' } });
    expect(input).toHaveValue('8:01');
    fireEvent.submit(input.closest('form'));
    expect(onSave).toHaveBeenLastCalledWith('08:01');
  });
});
