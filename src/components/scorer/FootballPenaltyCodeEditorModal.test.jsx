import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findFootballPenaltyDefinition,
  resetFootballPenaltyTableForTests,
} from '../../quick-input/penaltyTable';
import FootballPenaltyCodeEditorModal from './FootballPenaltyCodeEditorModal';

afterEach(() => resetFootballPenaltyTableForTests());

describe('FootballPenaltyCodeEditorModal', () => {
  it('adds a penalty type that becomes available to quick input immediately', () => {
    render(<FootballPenaltyCodeEditorModal onClose={vi.fn()} open />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Penalty Type' }));
    fireEvent.change(screen.getByLabelText('Penalty Code'), { target: { value: 'newp' } });
    fireEvent.change(screen.getByLabelText('Penalty Name'), { target: { value: 'New Prototype Penalty' } });
    fireEvent.change(screen.getByLabelText('Default Yards'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Default Enforcement'), { target: { value: 'SPOT' } });
    fireEvent.click(screen.getByLabelText('Dead-Ball Penalty'));
    fireEvent.click(screen.getByLabelText('Ejectionable'));
    fireEvent.click(screen.getByLabelText('Requires Spot of Foul'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Penalty Type' }));

    expect(screen.getByRole('status')).toHaveTextContent('New Prototype Penalty (NEWP) saved.');
    expect(findFootballPenaltyDefinition('NEWP')).toMatchObject({
      name: 'New Prototype Penalty',
      yards: 8,
      requiresSpot: true,
      defaultEnforcement: 'SPOT',
      deadBall: true,
      ejectionable: true,
    });
  });
});
