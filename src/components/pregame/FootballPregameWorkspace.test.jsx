import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FootballPregameWorkspace from './FootballPregameWorkspace';
import FootballRosterEditorModal from './FootballRosterEditorModal';
import FootballStartersModal from './FootballStartersModal';
import { getGameEnvelopeFixture } from '../../data/footballGameEnvelopeFixtures';
import { pregameForEnvelope } from '../../pregame/footballPregame';

const envelope = () => getGameEnvelopeFixture('pregame');
const rosterForEnvelope = (gameEnvelope) => ['V', 'H'].flatMap((team) => (
  Object.values(gameEnvelope.rosters.teams[team].players)
));

describe('FootballPregameWorkspace', () => {
  it('keeps coin toss details out of the inline workspace and opens them in a modal', () => {
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Pregame Workspace' })).toBeInTheDocument();
    expect(screen.queryByText(/Complete pregame setup without crowding the scorer/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coin Toss' })).toBeInTheDocument();
    expect(screen.queryByText(/Record optional captains and complete the toss in a guided modal/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Coin Toss' })).toBeInTheDocument();
    expect(screen.queryByText('Coin Toss Summary')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Home H-12 jersey')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roster/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /starters/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    expect(screen.getByRole('dialog', { name: 'Coin Toss' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team Abbreviations' })).toBeInTheDocument();
    expect(screen.getByLabelText('West Virginia St. abbreviation')).toHaveValue('W');
    expect(screen.getByLabelText('Fairmont St. abbreviation')).toHaveValue('F');
    expect(screen.queryByText('Coin Toss Summary')).not.toBeInTheDocument();
  });

  it('normalizes unique team aliases and uses them to choose the toss winner', () => {
    const onTeamAliasesChange = vi.fn();
    render(
      <FootballPregameWorkspace
        envelope={envelope()}
        onEnvelopeChange={vi.fn()}
        onTeamAliasesChange={onTeamAliasesChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.change(screen.getByLabelText('West Virginia St. abbreviation'), { target: { value: 'w' } });
    fireEvent.change(screen.getByLabelText('Fairmont St. abbreviation'), { target: { value: 'f' } });
    expect(screen.getByLabelText('West Virginia St. abbreviation')).toHaveValue('W');
    expect(screen.getByLabelText('Fairmont St. abbreviation')).toHaveValue('F');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onTeamAliasesChange).toHaveBeenCalledWith({ H: 'W', V: 'F' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF' });
    expect(screen.getByRole('heading', { name: "Away's Initial Choice" })).toBeInTheDocument();
  });

  it('uses Enter to advance the modal primary actions', async () => {
    const onEnvelopeChange = vi.fn();
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={onEnvelopeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));

    fireEvent.keyDown(screen.getByLabelText('Fairmont St. abbreviation'), { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Team Captains' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Who Won the Coin Toss?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'West Virginia St.', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Kick', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'North', exact: true }));
    expect(screen.getByRole('region', { name: 'Coin Toss Summary' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(onEnvelopeChange).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Coin Toss' })).not.toBeInTheDocument();
  });

  it('maps coin-toss choices and field directions to their operator hotkeys', () => {
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'West Virginia St.', exact: true }));

    for (const [choice, hotkey] of [
      ['Kick', 'K'],
      ['Receive', 'R'],
      ['Choose Direction', 'C'],
      ['Defer', 'D'],
    ]) {
      expect(within(screen.getByRole('button', { name: choice, exact: true })).getByText(hotkey)).toBeInTheDocument();
    }

    fireEvent.keyDown(window, { key: 'k', code: 'KeyK' });
    expect(screen.getByRole('heading', { name: 'Away Chooses Direction' })).toBeInTheDocument();
    for (const [direction, hotkey] of [
      ['North', 'N'],
      ['South', 'S'],
      ['East', 'E'],
      ['West', 'W'],
    ]) {
      expect(within(screen.getByRole('button', { name: direction, exact: true })).getByText(hotkey)).toBeInTheDocument();
    }

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    expect(screen.getByRole('region', { name: 'Coin Toss Summary' })).toHaveTextContent('North');
  });

  it('requires different team abbreviations', () => {
    const onTeamAliasesChange = vi.fn();
    render(
      <FootballPregameWorkspace
        envelope={envelope()}
        onEnvelopeChange={vi.fn()}
        onTeamAliasesChange={onTeamAliasesChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.change(screen.getByLabelText('West Virginia St. abbreviation'), { target: { value: 'f' } });
    fireEvent.change(screen.getByLabelText('Fairmont St. abbreviation'), { target: { value: 'f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('status')).toHaveTextContent('Team abbreviations must be different.');
    expect(screen.getByRole('heading', { name: 'Team Abbreviations' })).toBeInTheDocument();
    expect(onTeamAliasesChange).not.toHaveBeenCalled();
  });

  it('keeps captain entry optional and staged inside the modal', () => {
    const onEnvelopeChange = vi.fn();
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={onEnvelopeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Review / Edit' })[0]);
    fireEvent.submit(screen.getByRole('button', { name: 'Enter' }).closest('form'));
    expect(onEnvelopeChange).not.toHaveBeenCalled();
    expect(screen.getAllByText('No Captains Recorded')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Who Won the Coin Toss?' })).toBeInTheDocument();
  });

  it('uses consistently capitalized options and shows the summary only as the final screen', async () => {
    const onEnvelopeChange = vi.fn();
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={onEnvelopeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'West Virginia St.', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fairmont St.', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Home', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Away', exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'West Virginia St.', exact: true }));

    expect(screen.getByRole('heading', { name: "Home's Initial Choice" })).toBeInTheDocument();
    ['Kick', 'Receive', 'Choose Direction', 'Defer'].forEach((option) => {
      expect(screen.getByRole('button', { name: option, exact: true })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kick', exact: true }));

    expect(screen.getByRole('heading', { name: 'Away Chooses Direction' })).toBeInTheDocument();
    ['North', 'South', 'East', 'West'].forEach((direction) => {
      expect(screen.getByRole('button', { name: direction, exact: true })).toBeInTheDocument();
    });
    expect(screen.queryByText('Coin Toss Summary')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'North', exact: true }));

    const summary = screen.getByRole('region', { name: 'Coin Toss Summary' });
    expect(within(summary).getByRole('heading', { name: 'Coin Toss Summary' })).toBeInTheDocument();
    expect(within(summary).getByText('Kick')).toBeInTheDocument();
    expect(within(summary).getByText('North')).toBeInTheDocument();
    expect(within(summary).getAllByText('West Virginia St.').length).toBeGreaterThan(0);
    expect(within(summary).getAllByText('Fairmont St.').length).toBeGreaterThan(0);
    expect(within(summary).queryByText('Home')).not.toBeInTheDocument();
    expect(within(summary).queryByText('Away')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Coin Toss' }));

    await waitFor(() => expect(onEnvelopeChange).toHaveBeenCalledTimes(1));
    const nextEnvelope = onEnvelopeChange.mock.calls[0][0];
    expect(nextEnvelope.pregame.coinToss.status).toBe('complete');
    expect(nextEnvelope.pregame.coinToss.winnerInitialChoice).toBe('kick');
    expect(nextEnvelope.pregame.gamePhase).toBe('awaitingKickoff');
  });

  it('uses Choose Direction consistently through the defer branch', () => {
    render(<FootballPregameWorkspace envelope={envelope()} onEnvelopeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Coin Toss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fairmont St.', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Defer', exact: true }));

    expect(screen.getByRole('heading', { name: "Home's Choice" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Direction', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Direction', exact: true }));

    expect(screen.getByRole('heading', { name: "Away's Choice" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Receive', exact: true }));
    expect(screen.getByRole('heading', { name: 'Home Chooses Direction' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'East', exact: true }));

    const summary = screen.getByRole('region', { name: 'Coin Toss Summary' });
    expect(within(summary).getByText('Defer')).toBeInTheDocument();
    expect(within(summary).getByText('Choose Direction')).toBeInTheDocument();
    expect(within(summary).getByText('Receive')).toBeInTheDocument();
    expect(within(summary).getByText('East')).toBeInTheDocument();
  });

  it('allows every offense and defense starter slot to remain blank', () => {
    const gameEnvelope = envelope();
    const onSave = vi.fn();
    render(
      <FootballStartersModal
        onClose={vi.fn()}
        onSave={onSave}
        open
        pregame={pregameForEnvelope(gameEnvelope)}
        roster={rosterForEnvelope(gameEnvelope)}
        team="V"
      />,
    );
    expect(screen.getAllByLabelText(/^Away offense starter \d+ jersey$/)).toHaveLength(11);
    expect(screen.getAllByLabelText(/^Away defense starter \d+ jersey$/)).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Save starters' }));

    const payload = onSave.mock.calls.at(-1)[0];
    expect(payload.starters.offense).toEqual([]);
    expect(payload.starters.defense).toEqual([]);
  });

  it('defaults duplicate jerseys by starter unit and keeps the name selectable', () => {
    const gameEnvelope = envelope();
    render(
      <FootballStartersModal
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
        pregame={pregameForEnvelope(gameEnvelope)}
        roster={rosterForEnvelope(gameEnvelope)}
        team="H"
      />,
    );

    const offenseJersey = screen.getByLabelText('Home offense starter 1 jersey');
    fireEvent.change(offenseJersey, { target: { value: '3' } });
    fireEvent.blur(offenseJersey);
    expect(screen.getByRole('combobox', { name: 'Home offense starter 1 player' })).toHaveValue('H-3');
    expect(screen.getByLabelText('Home offense starter 1 position')).toHaveValue('WR');

    const defenseJersey = screen.getByLabelText('Home defense starter 1 jersey');
    fireEvent.change(defenseJersey, { target: { value: '3' } });
    fireEvent.blur(defenseJersey);
    expect(screen.getByRole('combobox', { name: 'Home defense starter 1 player' })).toHaveValue('H-3R');
    expect(screen.getByLabelText('Home defense starter 1 position')).toHaveValue('CB');
  });

  it('allows duplicate selection changes and saves the operator-entered position', () => {
    const gameEnvelope = envelope();
    const onSave = vi.fn();
    render(
      <FootballStartersModal
        onClose={vi.fn()}
        onSave={onSave}
        open
        pregame={pregameForEnvelope(gameEnvelope)}
        roster={rosterForEnvelope(gameEnvelope)}
        team="H"
      />,
    );

    const jersey = screen.getByLabelText('Home offense starter 1 jersey');
    fireEvent.change(jersey, { target: { value: '3' } });
    fireEvent.blur(jersey);
    fireEvent.change(screen.getByRole('combobox', { name: 'Home offense starter 1 player' }), { target: { value: 'H-3R' } });
    fireEvent.change(screen.getByLabelText('Home offense starter 1 position'), { target: { value: 'EDGE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save starters' }));

    const payload = onSave.mock.calls.at(-1)[0];
    expect(payload.starters.offense).toEqual(['H-3R']);
    expect(payload.positionUpdates).toContainEqual({ group: 'offense', playerId: 'H-3R', position: 'EDGE' });
  });

  it('saves roster workspace edits as a rebuilt game roster', () => {
    const onSave = vi.fn();
    render(
      <FootballRosterEditorModal
        envelope={envelope()}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    );
    fireEvent.change(screen.getByLabelText('Home H-12 name'), { target: { value: 'Duri T. Trahan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rosters' }));

    const rosters = onSave.mock.calls.at(-1)[0];
    expect(rosters.teams.H.players['H-12'].displayName).toBe('Duri T. Trahan');
    expect(rosters.teams.H.jerseyIndex['3']).toEqual(['H-3', 'H-3R']);
  });
});
