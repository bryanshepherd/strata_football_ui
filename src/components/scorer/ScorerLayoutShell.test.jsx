import React from 'react';
import { render, screen } from '@testing-library/react';
import ScorerLayoutShell from './ScorerLayoutShell';

describe('ScorerLayoutShell', () => {
  it('renders canonical scorer slots in basketball layout order', () => {
    render(
      <ScorerLayoutShell
        scoreboard={<div>Scoreboard slot</div>}
        stats={<div>Stats slot</div>}
        input={<div>Input slot</div>}
        eventLog={<div>Event log slot</div>}
        inputAssistant={<div>Input assistant slot</div>}
      />,
    );

    const shell = screen.getByTestId('scorer-layout-shell');
    const slots = [...shell.querySelectorAll('[data-scorer-slot]')].map((slot) =>
      slot.getAttribute('data-scorer-slot'),
    );

    expect(slots).toEqual([
      'scoreboard',
      'stats',
      'input',
      'event-log',
      'input-assistant',
    ]);
    expect(screen.getByText('Scoreboard slot')).toBeInTheDocument();
    expect(screen.getByText('Stats slot')).toBeInTheDocument();
    expect(screen.getByText('Input slot')).toBeInTheDocument();
    expect(screen.getByText('Event log slot')).toBeInTheDocument();
    expect(screen.getByText('Input assistant slot')).toBeInTheDocument();
  });

  it('keeps the desktop middle row at the canonical 20/65/15 widths', () => {
    render(
      <ScorerLayoutShell
        scoreboard={<div>Scoreboard slot</div>}
        stats={<div>Stats slot</div>}
        input={<div>Input slot</div>}
        eventLog={<div>Event log slot</div>}
        inputAssistant={<div>Input assistant slot</div>}
      />,
    );

    const middle = screen.getByTestId('scorer-layout-middle');
    const stats = middle.querySelector('[data-scorer-slot="stats"]');
    const input = middle.querySelector('[data-scorer-slot="input"]');
    const eventLog = middle.querySelector('[data-scorer-slot="event-log"]');

    expect(stats).toHaveClass('lg:w-1/5');
    expect(input).toHaveClass('lg:w-[65%]');
    expect(eventLog).toHaveClass('lg:w-[15%]');
  });
});
