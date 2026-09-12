import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballTeamAliasesModal from './FootballTeamAliasesModal';
import { getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';

const open = (onSave = vi.fn(), onClose = vi.fn()) => {
  render(<FootballTeamAliasesModal envelope={getGameEnvelopeFixture('normal')} onClose={onClose} onSave={onSave} />);
  return { onSave, onClose };
};

describe('Game Control team abbreviations', () => {
  it.each([
    ['', 'A', 'Enter one letter for each team.'],
    ['A', 'A', 'Team abbreviations must be different.'],
    ['V', 'A', 'H and V remain reserved for their canonical Home and Visitor teams.'],
    ['A', 'H', 'H and V remain reserved for their canonical Home and Visitor teams.'],
  ])('rejects invalid team letters %s and %s', (home, visitor, message) => {
    const { onSave, onClose } = open();
    fireEvent.change(screen.getByLabelText('Home State abbreviation'), { target: { value: home } });
    fireEvent.change(screen.getByLabelText('Visitor Tech abbreviation'), { target: { value: visitor } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Abbreviations' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('normalizes letters, blocks scoring hotkeys, and cancels without saving', () => {
    const { onSave, onClose } = open();
    const scoringHotkey = vi.fn();
    window.addEventListener('keydown', scoringHotkey);
    try {
      fireEvent.keyDown(screen.getByLabelText('Home State abbreviation'), { key: 'r' });
      expect(scoringHotkey).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText('Home State abbreviation'), { target: { value: 'b' } });
      expect(screen.getByLabelText('Home State abbreviation')).toHaveValue('B');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledOnce();
      expect(onSave).not.toHaveBeenCalled();
    } finally { window.removeEventListener('keydown', scoringHotkey); }
  });

  it('keeps the editor open and reports a save failure', () => {
    const { onClose } = open(() => { throw new Error('Storage unavailable'); });
    fireEvent.click(screen.getByRole('button', { name: 'Save Abbreviations' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(onClose).not.toHaveBeenCalled();
  });
});
