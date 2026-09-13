import React from 'react';
import { render, screen, within } from '@testing-library/react';
import baselineRecord from '../data/footballCompletedBaselineGameRecord.json';
import FootballParticipationReport, { FootballParticipationReportPage } from './FootballParticipationReport';
import { buildFootballParticipationReport } from '../reports/footballParticipationReport';

describe('FootballParticipationReport', () => {
  it('renders the shared branding and away-left/home-right starter tables above the participant lists', () => {
    const game = structuredClone(baselineRecord.envelope);
    const selections = Object.fromEntries(['V', 'H'].map((team) => [team, Object.keys(game.rosters.teams[team].players).slice(0, 3)]));
    game.pregame = { ...game.pregame, starters: {
      offense: { V: [selections.V[0]], H: [selections.H[0]] },
      defense: { V: [selections.V[1]], H: [selections.H[1]] },
    } };
    game.participation = { manualPlayed: { V: [selections.V[2]], H: [selections.H[2]] } };
    game.events = [];
    game.stats = {};
    const report = buildFootballParticipationReport(game);
    const { container } = render(<FootballParticipationReportPage report={report} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Participation' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataSportsSuite' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'StrataFootball' })).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(4);
    const teams = [...container.querySelectorAll('.football-participation-team')];
    expect(teams.map((team) => team.dataset.team)).toEqual(['V', 'H']);
    teams.forEach((team) => {
      expect(within(team).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Offensive starters', 'Defensive starters', 'Other participants']);
      expect(within(team).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Pos', '#', 'Name', 'Pos', '#', 'Name']);
      expect(within(team).getAllByRole('listitem')).toHaveLength(1);
      expect(within(team).getByText('Total participants: 3')).toBeInTheDocument();
    });
  });

  it('loads through the existing game report loader and includes print controls', () => {
    render(<FootballParticipationReport envelope={baselineRecord.envelope} />);
    expect(screen.getByRole('button', { name: 'Print / Save PDF' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scorer' })).toHaveAttribute('href', expect.stringContaining(baselineRecord.envelope.gameId));
  });
});
