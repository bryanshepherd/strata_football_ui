import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FootballLayoutPreview from './FootballLayoutPreview';

describe('FootballLayoutPreview', () => {
  it('renders the canonical shell with preview-only football refinements', () => {
    render(<FootballLayoutPreview />);

    const shell = screen.getByTestId('scorer-layout-shell');
    const scoreboardSlot = shell.querySelector('[data-scorer-slot="scoreboard"]');
    const statsSlot = shell.querySelector('[data-scorer-slot="stats"]');
    const inputSlot = shell.querySelector('[data-scorer-slot="input"]');
    const eventLogSlot = shell.querySelector('[data-scorer-slot="event-log"]');
    const assistantSlot = shell.querySelector('[data-scorer-slot="input-assistant"]');

    expect(screen.getByRole('heading', { name: /football canonical scorer shell/i })).toBeInTheDocument();
    expect(within(scoreboardSlot).getByText('8:42')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByLabelText('Possession football')).toBeInTheDocument();
    expect(within(scoreboardSlot).getByLabelText('V timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('H timeouts').children).toHaveLength(3);
    expect(within(scoreboardSlot).getByLabelText('V challenges').children).toHaveLength(2);
    expect(within(scoreboardSlot).getByLabelText('H challenges').children).toHaveLength(2);
    expect(within(statsSlot).getByRole('heading', { name: /team stats/i })).toBeInTheDocument();
    expect(within(statsSlot).getByText('VIS')).toBeInTheDocument();
    expect(within(statsSlot).getByText('HOME')).toBeInTheDocument();
    TEAM_STAT_LABELS.forEach((label) => {
      expect(within(statsSlot).getByText(label)).toBeInTheDocument();
    });
    expect(within(statsSlot).getAllByText('0 for 0 yards').length).toBeGreaterThan(0);
    expect(within(statsSlot).getAllByText('0 for 0, 0 INT')).toHaveLength(2);
    expect(within(statsSlot).getAllByText('0.0').length).toBeGreaterThan(0);
    expect(within(statsSlot).getAllByText('0:00')).toHaveLength(2);
    expect(within(inputSlot).getByRole('heading', { name: /play entry/i })).toBeInTheDocument();
    expect(within(inputSlot).getByRole('heading', { name: /fcqi rush preview/i })).toBeInTheDocument();
    expect(within(inputSlot).getByText(/preview harness only/i)).toBeInTheDocument();
    expect(within(eventLogSlot).getByRole('heading', { name: /game log/i })).toBeInTheDocument();
    expect(within(assistantSlot).getByText(/input assistant/i)).toBeInTheDocument();

    PLAY_BUTTON_EXPECTATIONS.forEach(([label, hotkey]) => {
      const button = within(inputSlot).getByRole('button', { name: `${label} ${hotkey}` });
      expect(within(button).getByText(hotkey)).toBeInTheDocument();
    });

    expect(screen.queryByText('Accepted Envelope')).not.toBeInTheDocument();
    expect(screen.queryByText('Field State')).not.toBeInTheDocument();
    expect(screen.queryByText('Roster Lookup')).not.toBeInTheDocument();
    expect(screen.queryByText('Current Context')).not.toBeInTheDocument();
    expect(screen.queryByText(/Play 25/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ball')).not.toBeInTheDocument();
    expect(within(scoreboardSlot).queryByLabelText('Possession', { exact: true })).not.toBeInTheDocument();
  });

  it('starts the FCQI rush preview flow', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();

    fireEvent.click(within(panel).getByRole('button', { name: /start rush/i }));

    expect(within(panel).getByText('token.awaiting')).toBeInTheDocument();
    expect(within(panel).getByText('rusherJersey')).toBeInTheDocument();
    expect(within(panel).getByLabelText(/rusher jersey/i)).not.toBeDisabled();
  });

  it('commits rusher jersey with Enter and advances state without submit', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();
    fireEvent.click(within(panel).getByRole('button', { name: /start rush/i }));

    const jerseyInput = within(panel).getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '22' } });
    fireEvent.keyDown(jerseyInput, { key: 'Enter', code: 'Enter' });

    expect(within(panel).getByText('token.awaiting')).toBeInTheDocument();
    expect(within(panel).getByText('result')).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^result$/i)).not.toBeDisabled();
    expect(screen.queryByText(/built request only/i)).not.toBeInTheDocument();
  });

  it('shows a duplicate roster selector for duplicate jerseys', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();
    fireEvent.click(within(panel).getByRole('button', { name: /start rush/i }));

    const jerseyInput = within(panel).getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '3' } });
    fireEvent.keyDown(jerseyInput, { key: 'Enter', code: 'Enter' });

    expect(within(panel).getByRole('dialog', { name: /duplicate jersey selector/i })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /#3 Taylor Jones RB Recommended/i })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /#3 Micah Smith OLB/i })).toBeInTheDocument();
  });

  it('selects a duplicate candidate and continues the rush flow', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();
    fireEvent.click(within(panel).getByRole('button', { name: /start rush/i }));

    const jerseyInput = within(panel).getByLabelText(/rusher jersey/i);
    fireEvent.change(jerseyInput, { target: { value: '3' } });
    fireEvent.keyDown(jerseyInput, { key: 'Enter', code: 'Enter' });
    fireEvent.click(within(panel).getByRole('button', { name: /#3 Smith OLB/i }));

    expect(within(panel).getByText('token.awaiting')).toBeInTheDocument();
    expect(within(panel).getByText('result')).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^result$/i)).not.toBeDisabled();
  });

  it('shows summary text after generating a rush summary', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();

    completeRushDraft(panel);
    fireEvent.click(within(panel).getByRole('button', { name: /generate summary/i }));

    expect(within(panel).getByText('summary.reviewing')).toBeInTheDocument();
    expect(within(panel).getByText('HOM #22 Jordan Smith rush for 7 yards to the V49, tackled by #44 Caleb Moss.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /confirm build request/i })).toBeInTheDocument();
  });

  it('confirm displays build result without submit', () => {
    render(<FootballLayoutPreview />);
    const panel = fcqiPanel();

    completeRushDraft(panel);
    fireEvent.click(within(panel).getByRole('button', { name: /generate summary/i }));
    fireEvent.click(within(panel).getByRole('button', { name: /confirm build request/i }));

    expect(within(panel).getByText('submitting.confirmed')).toBeInTheDocument();
    expect(within(panel).getByText(/built request only/i)).toBeInTheDocument();
    expect(within(panel).getByText(/football.submitEventRequest.v1/i)).toBeInTheDocument();
    expect(screen.queryByText(/accepted event/i)).not.toBeInTheDocument();
  });
});

function fcqiPanel() {
  return screen.getByLabelText('FCQI Rush Preview');
}

function completeRushDraft(panel) {
  fireEvent.click(within(panel).getByRole('button', { name: /start rush/i }));

  const jerseyInput = within(panel).getByLabelText(/rusher jersey/i);
  fireEvent.change(jerseyInput, { target: { value: '22' } });
  fireEvent.keyDown(jerseyInput, { key: 'Enter', code: 'Enter' });

  const resultInput = within(panel).getByLabelText(/^result$/i);
  fireEvent.change(resultInput, { target: { value: 'T' } });
  fireEvent.keyDown(resultInput, { key: 'Enter', code: 'Enter' });

  const tacklerAInput = within(panel).getByLabelText(/tackler a/i);
  fireEvent.change(tacklerAInput, { target: { value: '44' } });
  fireEvent.keyDown(tacklerAInput, { key: 'Enter', code: 'Enter' });

  const tacklerBInput = within(panel).getByLabelText(/tackler b/i);
  fireEvent.change(tacklerBInput, { target: { value: '' } });
  fireEvent.keyDown(tacklerBInput, { key: 'Enter', code: 'Enter' });

  const endSpotInput = within(panel).getByLabelText(/end spot/i);
  fireEvent.change(endSpotInput, { target: { value: 'V49' } });
  fireEvent.keyDown(endSpotInput, { key: 'Enter', code: 'Enter' });

  expect(within(panel).getByText('draft.ready')).toBeInTheDocument();
}

const PLAY_BUTTON_EXPECTATIONS = [
  ['Rush', 'R'],
  ['Pass', 'P'],
  ['Punt', 'U'],
  ['Kick', 'K'],
  ['Penalty', 'E'],
  ['Game Control', 'G'],
];

const TEAM_STAT_LABELS = [
  '1st Downs',
  'Rushing',
  'Passing',
  'Passing Yards',
  'Plays',
  'Avg/Play',
  'Kick Returns',
  'Punt Returns',
  'Int. Returns',
  'Fumble Returns',
  'Fumbles',
  'Penalties',
  'Punts',
  'TOP',
  '3rd Downs',
  '4th Downs',
];
