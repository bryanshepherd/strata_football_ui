import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballBallContextRevisionModal from './FootballBallContextRevisionModal';

const revisionEvent = {
  eventId: 'EVT-CONTEXT',
  sequence: 125,
  type: 'gameControl',
  period: 4,
  clock: '04:12',
  possession: 'H',
  result: {
    gameControl: {
      action: 'setBallContext',
      down: 2,
      distance: 7,
      spot: 'V21',
      lineToGain: 'V14',
    },
  },
};

describe('FootballBallContextRevisionModal', () => {
  it('edits only revision-owned context fields', () => {
    const onSave = vi.fn();
    render(
      <FootballBallContextRevisionModal
        event={revisionEvent}
        isOpen
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onSave={onSave}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /edit ball context revision 125/i });
    expect(within(dialog).getByLabelText(/down/i)).toHaveValue(2);
    expect(within(dialog).getByLabelText(/distance/i)).toHaveValue(7);
    expect(within(dialog).getByLabelText(/ball spot/i)).toHaveValue('V21');
    expect(within(dialog).getByLabelText(/line to gain/i)).toHaveValue('V14');

    fireEvent.change(within(dialog).getByLabelText(/down/i), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText(/distance/i), { target: { value: '6' } });
    fireEvent.change(within(dialog).getByLabelText(/ball spot/i), { target: { value: 'R20' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith({ down: '3', distance: '6', spot: 'R20', lineToGain: 'V14' });
  });

  it('requires confirmation before deleting the revision', () => {
    const onDelete = vi.fn();
    render(
      <FootballBallContextRevisionModal
        event={revisionEvent}
        isOpen
        onClose={vi.fn()}
        onDelete={onDelete}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /delete revision/i }));
    expect(onDelete).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('alertdialog', { name: /delete ball context revision 125/i });
    fireEvent.click(within(confirmation).getByRole('button', { name: /delete revision/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
