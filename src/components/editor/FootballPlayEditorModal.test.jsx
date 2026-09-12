import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FootballPlayEditorModal from './FootballPlayEditorModal';
import {
  footballPlayEditorSandboxPlays,
  footballPlayEditorSandboxRoster,
} from '../../pages/FootballPlayEditorSandbox';

const teamNames = { H: 'West Virginia State', V: 'Fairmont State' };

describe('FootballPlayEditorModal', () => {
  it('shows the mismatch and prevents recalculation from discarding unsaved detail edits', () => {
    const onRecalculate = vi.fn();
    renderEditor({ onRecalculate, contextReview: {
      expected: { down: 1, distance: 10 }, fields: ['distance'], previousSequence: 128,
      recordedLabel: 'H ball, 1 & 5 on V43', expectedLabel: 'H ball, 1 & 10 on V43',
    } });
    const review = screen.getByLabelText('Play context review');
    expect(review).toHaveTextContent('Context mismatch');
    expect(review).toHaveTextContent('Recorded: H ball, 1 & 5 on V43');
    expect(review).toHaveTextContent('Expected after #128: H ball, 1 & 10 on V43');
    fireEvent.change(screen.getByLabelText(/End spot/i), { target: { value: 'H40' } });
    expect(within(review).getByRole('button', { name: 'Recalculate this play' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(within(review).getByRole('button', { name: 'Recalculate this play' }));
    expect(onRecalculate).toHaveBeenCalledExactlyOnceWith(footballPlayEditorSandboxPlays[0]);
  });

  it('requires confirmation before deleting the original play and cancels deletion with Escape', () => {
    const onDelete = vi.fn();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderEditor({ onDelete, onSave, onClose });
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });
    fireEvent.change(within(dialog).getByLabelText(/End spot/i), { target: { value: 'H40' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Play' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alertdialog', { name: 'Delete play #129?' })).toHaveTextContent('any attached penalties');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Play' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete Play' }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(footballPlayEditorSandboxPlays[0]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('edits rush-owned and existing penalty fields without exposing context controls', () => {
    renderEditor();
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    expect(within(dialog).getByRole('heading', { name: /edit this play’s recorded details/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Rush fields' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Penalty details (1)' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Locked play context')).toHaveTextContent('Q3 6:55');
    expect(within(dialog).getByLabelText('Result')).toHaveValue('outOfBounds');
    expect(within(dialog).getByLabelText('Calculated yards')).toHaveTextContent('4');
    expect(within(dialog).queryByRole('spinbutton', { name: 'Yards' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Rusher')).toHaveValue('600309ad-35f6-7a21-ca81-c0f62b3e1a31');
    expect(within(dialog).getByLabelText('Calculated penalty yards')).toHaveTextContent('15');
    expect(within(dialog).queryByRole('spinbutton', { name: 'Penalty yards' })).not.toBeInTheDocument();

    ['Play type', 'Period', 'Game clock', 'Possession', 'Down', 'Distance', 'Ball spot', 'Drive ID', 'Record status'].forEach((label) => {
      expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument();
    });
    expect(within(dialog).queryByRole('button', { name: 'Add Penalty' })).not.toBeInTheDocument();
  });

  it('offers only the permitted direct result changes for an out-of-bounds rush', () => {
    renderEditor();
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });
    const result = within(dialog).getByLabelText('Result');

    expect(within(result).getByRole('option', { name: 'Out of Bounds' })).toBeInTheDocument();
    expect(within(result).getByRole('option', { name: 'Tackle' })).toBeInTheDocument();
    expect(within(result).getByRole('option', { name: 'End of Play' })).toBeInTheDocument();
    expect(within(result).queryByRole('option', { name: 'Fumble' })).not.toBeInTheDocument();

    fireEvent.change(result, { target: { value: 'tackle' } });
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('allows a non-turnover result to become End of Play directly', () => {
    renderEditor();
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.change(within(dialog).getByLabelText('Result'), { target: { value: 'endOfPlay' } });

    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('routes type, result-family, and penalty-presence changes through replacement', () => {
    const onReplace = vi.fn();
    renderEditor({ onReplace });
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Replace This Play' })[0]);
    const confirmation = within(dialog).getByRole('alertdialog', { name: /replace this play/i });
    expect(confirmation).toHaveTextContent(/play type, result family, or penalty presence/i);
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Start Replacement' }));

    expect(onReplace).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'LOCAL-000129', type: 'rush' }),
      expect.objectContaining({ mode: 'replace' }),
    );
  });

  it('does not offer End of Play as a direct change for a turnover', () => {
    renderEditor({ play: footballPlayEditorSandboxPlays[2] });
    const dialog = screen.getByRole('dialog', { name: /edit play 137/i });
    const result = within(dialog).getByLabelText('Result');

    expect(result).toHaveValue('interception');
    expect(within(result).queryByRole('option', { name: 'End of Play' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Turnover fields' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Return fields' })).toBeInTheDocument();
  });

  it('recalculates yards from the locked start spot when the end spot changes', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.change(within(dialog).getByLabelText(/End spot/i), { target: { value: 'H40' } });

    expect(within(dialog).getByLabelText('Calculated yards')).toHaveTextContent('6');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].result.yards).toBe(6);
    expect(onSave.mock.calls[0][1]).toMatchObject({
      mode: 'update',
      changedPaths: ['result.yards', 'result.endYardLine', 'penalties'],
    });
  });

  it('recalculates an existing penalty from its enforcement and final spots', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.change(within(dialog).getByLabelText('Final spot'), { target: { value: 'H30' } });
    expect(within(dialog).getByLabelText('Calculated penalty yards')).toHaveTextContent('12');
    expect(within(dialog).queryByRole('button', { name: 'Add Penalty' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Remove$/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(onSave.mock.calls[0][0].penalties).toHaveLength(1);
    expect(onSave.mock.calls[0][0].penalties[0].yards).toBe(12);
  });

  it('shows pass fields instead of rush fields for a pass', () => {
    renderEditor({ play: footballPlayEditorSandboxPlays[1] });
    const dialog = screen.getByRole('dialog', { name: /edit play 130/i });

    expect(within(dialog).getByRole('heading', { name: 'Pass fields' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Passer')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Intended receiver')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Broken up by')).toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Rush fields' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/a penalty cannot be added through direct edit/i)).toBeInTheDocument();
  });

  it('protects unsaved work when Escape is pressed', () => {
    const onClose = vi.fn();
    renderEditor({ onClose });
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.change(within(dialog).getByLabelText(/End spot/i), { target: { value: 'H41' } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alertdialog', { name: /discard play edits/i })).toBeInTheDocument();
  });

  it.each(['catchYardLine', 'caughtAtYardLine'])('saves a catch-spot correction in the existing %s field without changing the touchdown', (field) => {
    const play = structuredClone(footballPlayEditorSandboxPlays[1]);
    play.subtype = 'complete';
    play.possession = 'V';
    play.preState = { ...play.preState, possession: 'V', yardLine: 'H39', down: 2, distance: 6 };
    play.result = {
      code: 'complete', yards: 39, endYardLine: 'goal',
      scoring: { team: 'V', type: 'touchdown', points: 6 },
      pass: { outcome: 'complete', [field]: 'V14', terminalYardLine: 'goal', passingYards: 39, receivingYards: 39 },
    };
    const onSave = vi.fn();
    renderEditor({ play, onSave });
    expect(screen.getByLabelText(/Caught at/i)).toHaveValue('V14');
    fireEvent.change(screen.getByLabelText(/Caught at/i), { target: { value: 'H14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].result).toEqual({ ...play.result, pass: { ...play.result.pass, [field]: 'H14' } });
    expect(play.result.pass[field]).toBe('V14');
  });

  it('flags excessive YAC immediately, permits saving it, and clears the flag after correcting the catch side', () => {
    const play = structuredClone(footballPlayEditorSandboxPlays[1]);
    play.subtype = 'complete';
    play.possession = 'V';
    play.preState = { ...play.preState, possession: 'V', yardLine: 'H39' };
    play.result = {
      code: 'complete', yards: 39, endYardLine: 'goal',
      scoring: { team: 'V', type: 'touchdown', points: 6 },
      pass: { outcome: 'complete', catchYardLine: 'V14', terminalYardLine: 'goal', passingYards: 39, receivingYards: 39 },
    };
    const onSave = vi.fn();
    renderEditor({ play, onSave });
    const warning = screen.getByRole('alert', { name: 'Receiving yardage warning' });
    expect(warning).toHaveTextContent('86 YAC is 47 yards more than the 39 receiving yards');
    expect(warning).toHaveTextContent('Catch: Fairmont State 14. End: goal line.');
    fireEvent.change(screen.getByLabelText(/Caught at/i), { target: { value: 'V15' } });
    expect(warning).toHaveTextContent('85 YAC');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].result.pass.catchYardLine).toBe('V15');
    fireEvent.change(screen.getByLabelText(/Caught at/i), { target: { value: 'H14' } });
    expect(screen.queryByRole('alert', { name: 'Receiving yardage warning' })).not.toBeInTheDocument();
    expect(play.result.pass.catchYardLine).toBe('V14');
  });
});

function renderEditor({
  play = footballPlayEditorSandboxPlays[0],
  onClose = vi.fn(),
  onDelete = vi.fn(),
  onRecalculate,
  contextReview,
  onReplace = vi.fn(),
  onSave = vi.fn(),
} = {}) {
  return render(
    <FootballPlayEditorModal
      isOpen
      onClose={onClose}
      onDelete={onDelete}
      onRecalculate={onRecalculate}
      contextReview={contextReview}
      onReplace={onReplace}
      onSave={onSave}
      play={play}
      roster={footballPlayEditorSandboxRoster}
      teamNames={teamNames}
    />,
  );
}
