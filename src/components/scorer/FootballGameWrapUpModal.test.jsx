import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballGameWrapUpModal from './FootballGameWrapUpModal';

const envelope = {
  gameId: 'FB-WRAP-MODAL',
  updatedAt: '2026-08-26T02:16:00Z',
  game: {
    status: 'final',
    scheduledAt: '2026-08-25T23:00:00Z',
    rules: { periods: 4 },
    teams: {
      H: { name: 'Home State', score: 24 },
      V: { name: 'Visitor Tech', score: 17 },
    },
    teamRecords: {
      H: { overall: '2-1', conference: '1-0' },
      V: { overall: '2-1', conference: '0-1' },
    },
    officials: [
      { role: 'Referee', name: 'Alex Referee' },
      { role: 'Umpire', name: 'Casey Umpire' },
    ],
  },
  events: [
    { sequence: 1, type: 'kickoff', status: 'accepted', acceptedAt: '2026-08-25T23:04:00Z' },
    { sequence: 200, type: 'gameControl', subtype: 'endQuarter', period: 4, status: 'accepted', acceptedAt: '2026-08-26T02:16:00Z' },
  ],
};

describe('FootballGameWrapUpModal', () => {
  it('prepopulates records, officials, timestamps, and calculated duration', () => {
    render(
      <FootballGameWrapUpModal
        envelope={envelope}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Game Wrap-Up' });
    expect(within(dialog).getByLabelText('Home State previous overall record')).toHaveValue('2-1');
    expect(within(dialog).getByLabelText('Home State previous conference record')).toHaveValue('1-0');
    expect(within(dialog).getByLabelText('Visitor Tech previous overall record')).toHaveValue('2-1');
    expect(within(dialog).getByLabelText('Visitor Tech previous conference record')).toHaveValue('0-1');
    expect(within(dialog).getByLabelText('Referee')).toHaveValue('Alex Referee');
    expect(within(dialog).getByLabelText('Umpire')).toHaveValue('Casey Umpire');
    expect(within(dialog).getByText('3:12')).toBeInTheDocument();
  });

  it('submits weather, attendance, notes, and recalculated timestamps', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <FootballGameWrapUpModal
        envelope={envelope}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Game Wrap-Up' });
    fireEvent.change(within(dialog).getByLabelText('Actual Start Time'), { target: { value: '2026-08-25T19:00' } });
    fireEvent.change(within(dialog).getByLabelText('Actual End Time'), { target: { value: '2026-08-25T22:15' } });
    fireEvent.change(within(dialog).getByLabelText('Attendance'), { target: { value: '4200' } });
    fireEvent.change(within(dialog).getByLabelText('Temperature (°F)'), { target: { value: '72' } });
    fireEvent.change(within(dialog).getByLabelText('Wind'), { target: { value: 'NW 8 mph' } });
    fireEvent.change(within(dialog).getByLabelText('Weather Conditions'), { target: { value: 'Clear' } });
    fireEvent.change(within(dialog).getByLabelText('Game Notes'), { target: { value: 'Senior night.' } });
    expect(within(dialog).getByText('3:15')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Game Wrap-Up' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      durationMinutes: 195,
      attendance: '4200',
      weather: { temperatureF: '72', wind: 'NW 8 mph', conditions: 'Clear' },
      notes: 'Senior night.',
    });
    expect(Number.isFinite(new Date(onSave.mock.calls[0][0].startedAt).getTime())).toBe(true);
    expect(Number.isFinite(new Date(onSave.mock.calls[0][0].endedAt).getTime())).toBe(true);
  });
});
