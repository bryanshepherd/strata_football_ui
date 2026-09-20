import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballUnnamedPlayersAlert from './FootballUnnamedPlayersAlert';
const envelope = { game: { teams: { H: { abbr: 'MID' }, V: { abbr: 'BU' } } }, rosters: { teams: {
  H: { players: { h: { playerId: 'h', jersey: '0', displayName: '' }, named: { playerId: 'named', jersey: '5', firstName: 'Taylor', lastName: 'Quinn' } } },
  V: { players: { v: { playerId: 'v', jersey: '0', displayName: '' } } },
} } };
it('lists separate buttons for both teams, including number zero, only on standby', () => {
  const view = render(<FootballUnnamedPlayersAlert envelope={envelope} visible={false} onEditingChange={vi.fn()} onSaveName={vi.fn()} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  view.rerender(<FootballUnnamedPlayersAlert envelope={envelope} visible onEditingChange={vi.fn()} onSaveName={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'MID #0' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'BU #0' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'MID #5' })).not.toBeInTheDocument();
});
it('keeps a failed name save open and supports a retry without losing the name', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValueOnce();
  const editing = vi.fn();
  render(<FootballUnnamedPlayersAlert envelope={envelope} visible onEditingChange={editing} onSaveName={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'MID #0' }));
  fireEvent.change(screen.getByLabelText('Player name'), { target: { value: '  Taylor Quinn  ' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save name' }).closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
  expect(screen.getByLabelText('Player name')).toHaveValue('  Taylor Quinn  ');
  fireEvent.submit(screen.getByRole('button', { name: 'Save name' }).closest('form'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(save).toHaveBeenLastCalledWith('H', 'h', 'Taylor Quinn');
  expect(editing).toHaveBeenLastCalledWith(false);
});
