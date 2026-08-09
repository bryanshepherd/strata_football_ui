import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPlaySummaryModal from './FootballPlaySummaryModal';

const renderSummary = (props = {}) => {
  const onConfirm = vi.fn();
  const onEnterPenalty = vi.fn();
  render(
    <FootballPlaySummaryModal
      onCancel={vi.fn()}
      onConfirm={onConfirm}
      onEdit={vi.fn()}
      onEnterPenalty={onEnterPenalty}
      onStepClick={vi.fn()}
      summary={{ summaryText: 'Rush for 7 yards.', warnings: [] }}
      {...props}
    />,
  );
  return { onConfirm, onEnterPenalty };
};

describe('FootballPlaySummaryModal', () => {
  it('submits the reviewed play when Enter is pressed', () => {
    const { onConfirm, onEnterPenalty } = renderSummary();

    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onEnterPenalty).not.toHaveBeenCalled();
  });

  it('stays yellow and opens penalty entry on Enter while a queued penalty is unresolved', () => {
    const { onConfirm, onEnterPenalty } = renderSummary({ unresolvedQueuedPenalty: true });
    const dialog = screen.getByRole('dialog', { name: /play summary review/i });

    expect(dialog).toHaveClass('border-amber-400', 'bg-amber-50');
    expect(screen.getByText('Shift+E for Flag on the Play')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onEnterPenalty).toHaveBeenCalledTimes(1);
  });
});
