import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FootballPlayEditorSandbox from './FootballPlayEditorSandbox';

describe('FootballPlayEditorSandbox', () => {
  it('opens with play 129 selected and saves changes only inside the sandbox', () => {
    render(<FootballPlayEditorSandbox />);
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    expect(screen.getByRole('heading', { name: /play-only football editor/i })).toBeInTheDocument();
    expect(screen.getByText(/everything here is local and disposable/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/End spot/i), { target: { value: 'H40' } });
    expect(within(dialog).getByLabelText('Calculated yards')).toHaveTextContent('6');
    expect(within(dialog).getByLabelText('Calculated penalty yards')).toHaveTextContent('13');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(screen.queryByRole('dialog', { name: /edit play 129/i })).not.toBeInTheDocument();
    expect(screen.getByText(/sandbox edit saved/i)).toBeInTheDocument();
    expect(screen.getByText(/Play #129 · 3 changed fields/i)).toBeInTheDocument();
  });

  it('lets the operator select a different play before opening the modal', () => {
    render(<FootballPlayEditorSandbox />);
    fireEvent.click(screen.getByRole('button', { name: /close play editor/i }));
    fireEvent.click(screen.getByRole('button', { name: /pass · interception.*#137/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit selected play/i }));

    expect(screen.getByRole('dialog', { name: /edit play 137/i })).toBeInTheDocument();
  });

  it('simulates a replacement request without changing the selected play', () => {
    render(<FootballPlayEditorSandbox />);
    const dialog = screen.getByRole('dialog', { name: /edit play 129/i });

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Replace This Play' })[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start Replacement' }));

    expect(screen.queryByRole('dialog', { name: /edit play 129/i })).not.toBeInTheDocument();
    expect(screen.getByText('Replacement requested')).toBeInTheDocument();
    expect(screen.getByText(/would reopen in the normal replacement workflow/i)).toBeInTheDocument();
  });
});
